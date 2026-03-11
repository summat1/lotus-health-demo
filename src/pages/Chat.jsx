import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import Nav from '../components/Nav'
import { sendMessage } from '../lib/claude'
import { isStravaConnected, fetchRecentActivities, getStravaAuthUrl } from '../lib/strava'
import { isGarminConnected, connectGarmin, fetchGarminSleepData } from '../lib/garmin'
import { analyzeHealthData } from '../lib/healthAnalysis'
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
  const [messages, setMessages] = useState(() => {
    // Restore session if returning from Strava OAuth
    try {
      const saved = sessionStorage.getItem('lotus_chat_session')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 1) return parsed
      }
    } catch {}
    return [WELCOME]
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [stravaConnected, setStravaConnected] = useState(false)
  const [stravaActivities, setStravaActivities] = useState(null)
  const [showStravaPrompt, setShowStravaPrompt] = useState(false)
  const [fetchingStrava, setFetchingStrava] = useState(false)
  const [garminConnected, setGarminConnected] = useState(false)
  const [garminSleepData, setGarminSleepData] = useState(null)
  const [showGarminPrompt, setShowGarminPrompt] = useState(false)
  const [fetchingGarmin, setFetchingGarmin] = useState(false)
  const [resumedFromStrava, setResumedFromStrava] = useState(() => {
    return !!sessionStorage.getItem('lotus_chat_session')
  })
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()
  const [dismissedAlerts, setDismissedAlerts] = useState([])

  // Proactive health analysis — runs whenever data changes
  const healthAlerts = useMemo(() => {
    if (!stravaActivities && !garminSleepData) return []
    return analyzeHealthData({ stravaActivities, garminSleepData })
  }, [stravaActivities, garminSleepData])

  const visibleAlerts = healthAlerts.filter(a => !dismissedAlerts.includes(a.type))

  useEffect(() => {
    const sConnected = isStravaConnected()
    setStravaConnected(sConnected)
    if (sConnected && !stravaActivities) {
      loadStravaData()
    }
    const gConnected = isGarminConnected()
    setGarminConnected(gConnected)
    if (gConnected && !garminSleepData) {
      loadGarminData()
    }
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, showStravaPrompt])

  // After Strava data loads and we resumed from OAuth, auto-continue the conversation
  useEffect(() => {
    if (resumedFromStrava && stravaActivities && stravaActivities.length > 0 && !loading) {
      sessionStorage.removeItem('lotus_chat_session')
      setResumedFromStrava(false)
      // Auto-send a follow-up so Claude can analyze the data
      handleSend('I just connected Strava — check my most recent activities and help me figure out what might be going on.')
    }
  }, [resumedFromStrava, stravaActivities])

  async function loadStravaData() {
    try {
      setFetchingStrava(true)
      const activities = await fetchRecentActivities(10)
      setStravaActivities(activities)
    } catch (err) {
      console.error('Failed to load Strava data:', err)
    } finally {
      setFetchingStrava(false)
    }
  }

  async function loadGarminData() {
    try {
      setFetchingGarmin(true)
      const sleep = await fetchGarminSleepData(7)
      setGarminSleepData(sleep)
    } catch (err) {
      console.error('Failed to load Garmin data:', err)
    } finally {
      setFetchingGarmin(false)
    }
  }

  async function handleGarminConnect() {
    connectGarmin()
    setGarminConnected(true)
    setShowGarminPrompt(false)
    await loadGarminData()
    // Auto-send a message so the AI knows sleep data is now available
    handleSend('I just connected my Garmin — you now have my recent sleep and recovery data.')
  }

  function addMessage(role, content) {
    const msg = { role, content, id: Date.now() + Math.random() }
    setMessages(prev => [...prev, msg])
    return msg
  }

  async function handleSend(text) {
    const userText = (text || input).trim()
    if (!userText || loading) return

    setInput('')
    setShowStravaPrompt(false)
    setShowGarminPrompt(false)
    addMessage('user', userText)
    setLoading(true)

    try {
      // Build history from real messages (exclude welcome placeholder), always append current user message
      const history = messages
        .filter(m => m.id !== 'welcome')
        .map(m => ({ role: m.role, content: m.content }))

      history.push({ role: 'user', content: userText })

      const reply = await sendMessage({
        messages: history,
        stravaActivities,
        garminSleepData,
      })

      let cleanReply = reply
      let shouldShowStrava = false
      let shouldShowGarmin = false

      if (cleanReply.includes('[REQUEST_STRAVA_AUTH]')) {
        cleanReply = cleanReply.replace('[REQUEST_STRAVA_AUTH]', '').trim()
        shouldShowStrava = true
      }
      if (cleanReply.includes('[REQUEST_GARMIN_AUTH]')) {
        cleanReply = cleanReply.replace('[REQUEST_GARMIN_AUTH]', '').trim()
        shouldShowGarmin = true
      }

      addMessage('assistant', cleanReply)
      if (shouldShowStrava) setShowStravaPrompt(true)
      if (shouldShowGarmin) setShowGarminPrompt(true)
    } catch (err) {
      addMessage('assistant', "I'm having trouble connecting right now. Please try again in a moment.")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  function handleStravaConnect() {
    // Save chat session before redirecting so we can resume after OAuth
    try {
      sessionStorage.setItem('lotus_chat_session', JSON.stringify(messages))
    } catch {}
    window.location.href = getStravaAuthUrl()
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

      {(stravaConnected && stravaActivities || garminConnected && garminSleepData) && (
        <div className={styles.dataBar}>
          <span className={styles.dataBarDot} />
          <span className={styles.dataBarText}>
            {[stravaConnected && stravaActivities && `Strava · ${stravaActivities.length} activities`, garminConnected && garminSleepData && `Garmin · ${garminSleepData.length} nights`].filter(Boolean).join('  ·  ')}
          </span>
        </div>
      )}

      {(fetchingStrava || fetchingGarmin) && (
        <div className={styles.dataBar}>
          <span className={styles.dataBarSpinner} />
          <span className={styles.dataBarText}>
            Loading {fetchingStrava ? 'Strava' : 'Garmin'} data...
          </span>
        </div>
      )}

      {visibleAlerts.length > 0 && messages.length <= 1 && (
        <div className={styles.alertsBanner}>
          {visibleAlerts.map(alert => (
            <button
              key={alert.type}
              className={`${styles.alertCard} ${styles[`alert_${alert.severity}`]} slide-up`}
              onClick={() => {
                setDismissedAlerts(prev => [...prev, alert.type])
                handleSend(`I saw the alert about my ${alert.title.toLowerCase().replace(' detected', '')}. What should I know?`)
              }}
            >
              <div className={styles.alertIconWrap}>
                {alert.severity === 'critical' ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 9v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
          ))}
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.messages}>
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id || i} message={msg} />
          ))}

          {showStravaPrompt && !stravaConnected && (
            <div className={`${styles.integrationCard} slide-up`}>
              <div className={styles.integrationCardInner}>
                <div className={styles.integrationIcon} style={{ background: '#FFF3ED' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116z" fill="#FC4C02" />
                    <path d="M11.094 13.828l2.089 4.116 2.204-4.116H13.12L11.094 9.828 9.066 13.828h2.028z" fill="#FC4C02" opacity="0.7" />
                  </svg>
                </div>
                <div className={styles.integrationCardText}>
                  <p className={styles.integrationCardTitle}>Connect Strava</p>
                  <p className={styles.integrationCardDesc}>Pull your recent training data for better insights.</p>
                </div>
                <button className={styles.integrationConnectBtn} onClick={handleStravaConnect}>
                  Connect
                </button>
              </div>
            </div>
          )}

          {showGarminPrompt && !garminConnected && (
            <div className={`${styles.integrationCard} slide-up`}>
              <div className={styles.integrationCardInner}>
                <div className={styles.integrationIcon} style={{ background: '#EBF5FF' }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#007DC5" />
                    <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="#007DC5" />
                    <circle cx="12" cy="12" r="2" fill="#007DC5" />
                  </svg>
                </div>
                <div className={styles.integrationCardText}>
                  <p className={styles.integrationCardTitle}>Connect Garmin</p>
                  <p className={styles.integrationCardDesc}>Pull your sleep, HRV, and recovery data.</p>
                </div>
                <button className={styles.integrationConnectBtn} onClick={handleGarminConnect}>
                  Connect
                </button>
              </div>
            </div>
          )}

          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {messages.length === 1 && !loading && (
          <div className={styles.suggestions}>
            {SUGGESTED_PROMPTS.map(p => (
              <button
                key={p}
                className={styles.suggestion}
                onClick={() => handleSend(p)}
              >
                {p}
              </button>
            ))}
          </div>
        )}

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
              <button
                className={styles.sendBtn}
                onClick={() => handleSend()}
                disabled={loading}
              >
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

function MessageBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`${styles.messageWrap} ${isUser ? styles.messageUser : styles.messageAssistant} fade-in`}>
      {!isUser && (
        <div className={styles.assistantDot} />
      )}
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
