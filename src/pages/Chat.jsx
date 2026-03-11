import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import Nav from '../components/Nav'
import { sendMessage } from '../lib/claude'
import { isStravaConnected, fetchRecentActivities, getStravaAuthUrl } from '../lib/strava'
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
  const [resumedFromStrava, setResumedFromStrava] = useState(() => {
    return !!sessionStorage.getItem('lotus_chat_session')
  })
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const connected = isStravaConnected()
    setStravaConnected(connected)
    if (connected && !stravaActivities) {
      loadStravaData()
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
      handleSend('I just connected Strava — take a look at my recent activity data and continue helping me.')
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
      })

      if (reply.includes('[REQUEST_STRAVA_AUTH]')) {
        const cleanReply = reply.replace('[REQUEST_STRAVA_AUTH]', '').trim()
        addMessage('assistant', cleanReply)
        setShowStravaPrompt(true)
      } else {
        addMessage('assistant', reply)
      }
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

      {stravaConnected && stravaActivities && (
        <div className={styles.dataBar}>
          <span className={styles.dataBarDot} />
          <span className={styles.dataBarText}>
            Strava connected · {stravaActivities.length} recent activities loaded
          </span>
        </div>
      )}

      {fetchingStrava && (
        <div className={styles.dataBar}>
          <span className={styles.dataBarSpinner} />
          <span className={styles.dataBarText}>Loading your Strava data...</span>
        </div>
      )}

      <main className={styles.main}>
        <div className={styles.messages}>
          {messages.map((msg, i) => (
            <MessageBubble key={msg.id || i} message={msg} />
          ))}

          {showStravaPrompt && !stravaConnected && (
            <div className={`${styles.stravaCard} slide-up`}>
              <div className={styles.stravaCardInner}>
                <div className={styles.stravaIcon}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116z" fill="#FC4C02" />
                    <path d="M11.094 13.828l2.089 4.116 2.204-4.116H13.12L11.094 9.828 9.066 13.828h2.028z" fill="#FC4C02" opacity="0.7" />
                  </svg>
                </div>
                <div className={styles.stravaCardText}>
                  <p className={styles.stravaCardTitle}>Connect Strava</p>
                  <p className={styles.stravaCardDesc}>I'll pull your recent activities to give you a real answer.</p>
                </div>
                <button className={styles.stravaConnectBtn} onClick={handleStravaConnect}>
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
