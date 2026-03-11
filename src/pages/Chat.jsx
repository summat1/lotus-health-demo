import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import Nav from '../components/Nav'
import { sendMessage } from '../lib/claude'
import { useHealthData } from '../lib/useHealthData'
import styles from './Chat.module.css'

const SUGGESTED_PROMPTS = [
  "My knee is hurting really badly, what should I do?",
  "I'm having mild chest and arm pain",
  "I've got an awful headache"
]

const WELCOME = {
  role: 'assistant',
  content: "Hey Shivesh — I'm your Lotus health assistant. How can I help?",
  id: 'welcome',
}

export default function Chat() {
  const health = useHealthData()

  const [messages, setMessages] = useState(() => health.savedSession || [WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Resume conversation after Strava OAuth return
  useEffect(() => {
    if (!loading) {
      const resumeMsg = health.checkOAuthResume(health.stravaActivities)
      if (resumeMsg) handleSend(resumeMsg)
    }
  }, [health.stravaActivities])

  function addMessage(role, content) {
    const msg = { role, content, id: Date.now() + Math.random() }
    setMessages(prev => [...prev, msg])
    return msg
  }

  async function handleSend(text) {
    const userText = (text || input).trim()
    if (!userText || loading) return

    setInput('')
    health.hideAllPrompts()
    addMessage('user', userText)
    setLoading(true)

    try {
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }))
      history.push({ role: 'user', content: userText })

      const reply = await sendMessage({
        messages: history,
        stravaActivities: health.stravaActivities,
        garminSleepData: health.garminSleepData,
      })

      const cleanReply = health.processReply(reply)
      addMessage('assistant', cleanReply)
    } catch (err) {
      addMessage('assistant', "I'm having trouble connecting right now. Please try again in a moment.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={styles.page}>
      <Nav />

      {/* Connected sources data bar */}
      {health.connectedSummary.length > 0 && (
        <div className={styles.dataBar}>
          <span className={styles.dataBarDot} />
          <span className={styles.dataBarText}>
            {health.connectedSummary.join('  ·  ')}
          </span>
        </div>
      )}

      {/* Loading indicator */}
      {health.isLoading && (
        <div className={styles.dataBar}>
          <span className={styles.dataBarSpinner} />
          <span className={styles.dataBarText}>
            Loading {health.loadingLabel} data...
          </span>
        </div>
      )}

      {/* Proactive health alerts */}
      {health.visibleAlerts.length > 0 && messages.length <= 1 && (
        <div className={styles.alertsBanner}>
          {health.visibleAlerts.map(alert => (
            <AlertCard
              key={alert.type}
              alert={alert}
              onTap={() => {
                health.dismissAlert(alert.type)
                handleSend(`I saw the alert about my ${alert.title.toLowerCase().replace(' detected', '')}. What should I know?`)
              }}
            />
          ))}
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.messages}>
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id || i} message={msg} />
          ))}

          {/* Integration connect prompts (driven by AI tokens) */}
          {health.pendingPrompts.map(integration => (
            <IntegrationCard
              key={integration.key}
              integration={integration}
              onConnect={() => {
                if (integration.requiresRedirect) {
                  health.connectWithRedirect(integration.key, messages)
                } else {
                  health.connectInline(integration.key).then(msg => {
                    if (msg) handleSend(msg)
                  })
                }
              }}
            />
          ))}

          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Suggested prompts */}
        {messages.length === 1 && !loading && (
          <div className={styles.suggestions}>
            {SUGGESTED_PROMPTS.map(p => (
              <button key={p} className={styles.suggestion} onClick={() => handleSend(p)}>
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Input area */}
        <div className={styles.inputArea}>
          <p className={styles.disclaimer}>
            <span className={styles.disclaimerIcon}>ⓘ</span> Medical Disclaimer
          </p>
          <div className={styles.inputRow}>
            <textarea
              ref={inputRef}
              className={styles.input}
              placeholder="Message"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            {input.trim() ? (
              <button className={styles.sendBtn} onClick={() => handleSend()} disabled={loading}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M5 12H19M19 12L12 5M19 12L12 19" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : (
              <button className={styles.voiceBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill="white" />
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                Voice
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

/* ─── Subcomponents ─── */

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`${styles.messageWrap} ${isUser ? styles.messageUser : styles.messageAssistant} fade-in`}>
      {!isUser && <div className={styles.assistantDot} />}
      <div className={`${styles.bubble} ${isUser ? styles.bubbleUser : styles.bubbleAssistant}`}>
        {isUser ? (
          message.content
        ) : (
          <div className={styles.markdown}>
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  )
}

function IntegrationCard({ integration, onConnect }) {
  return (
    <div className={`${styles.integrationCard} slide-up`}>
      <div className={styles.integrationCardInner}>
        <div className={styles.integrationIcon} style={{ background: integration.color }}>
          {integration.icon}
        </div>
        <div className={styles.integrationCardText}>
          <p className={styles.integrationCardTitle}>Connect {integration.name}</p>
          <p className={styles.integrationCardDesc}>{integration.description}</p>
        </div>
        <button className={styles.integrationConnectBtn} onClick={onConnect}>
          Connect
        </button>
      </div>
    </div>
  )
}

function AlertCard({ alert, onTap }) {
  return (
    <button
      className={`${styles.alertCard} ${styles[`alert_${alert.severity}`]} slide-up`}
      onClick={onTap}
    >
      <div className={styles.alertIconWrap}>
        {alert.severity === 'critical' ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <div className={styles.alertContent}>
        <div className={styles.alertHeader}>
          <span className={styles.alertTitle}>{alert.title}</span>
          <span className={styles.alertMetric}>{alert.metric}</span>
        </div>
        <p className={styles.alertMessage}>{alert.message}</p>
        <span className={styles.alertCta}>Tap to discuss with Lotus →</span>
      </div>
    </button>
  )
}

function TypingIndicator() {
  return (
    <div className={`${styles.messageWrap} ${styles.messageAssistant}`}>
      <div className={styles.assistantDot} />
      <div className={`${styles.bubble} ${styles.bubbleAssistant} ${styles.typing}`}>
        <span className={styles.dot} style={{ animationDelay: '0ms' }} />
        <span className={styles.dot} style={{ animationDelay: '150ms' }} />
        <span className={styles.dot} style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  )
}
