import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../components/Nav'
import { isStravaConnected, getStravaAuthUrl, clearToken } from '../lib/strava'
import { isGarminConnected, connectGarmin, disconnectGarmin } from '../lib/garmin'
import styles from './Integrations.module.css'

const INTEGRATIONS = [
  {
    id: 'strava',
    name: 'Strava',
    description: 'Runs, rides, swims — activity history, heart rate, effort scores.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116z" fill="#FC4C02"/>
        <path d="M11.094 13.828l2.089 4.116 2.204-4.116H13.12L11.094 9.828 9.066 13.828h2.028z" fill="#FC4C02" opacity="0.7"/>
        <path d="M9.066 13.828H7.04L11.094 6l2.026 3.828H11.1L9.066 13.828z" fill="#FC4C02" opacity="0.4"/>
      </svg>
    ),
    available: true,
    comingSoon: false,
    dataPoints: ['Activities', 'Heart rate zones', 'Effort & suffer score', 'Elevation & pace'],
  },
  {
    id: 'garmin',
    name: 'Garmin',
    description: 'Sleep stages, HRV, resting heart rate, body battery, and stress.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#007DC5"/>
        <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="#007DC5"/>
        <circle cx="12" cy="12" r="2" fill="#007DC5"/>
      </svg>
    ),
    available: true,
    comingSoon: false,
    dataPoints: ['Sleep stages', 'HRV', 'Resting heart rate', 'Body battery'],
  },
  {
    id: 'apple-health',
    name: 'Apple Health',
    description: 'HRV, sleep stages, steps, blood oxygen, and more from your iPhone.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" fill="#000"/>
      </svg>
    ),
    available: false,
    comingSoon: true,
    dataPoints: ['HRV', 'Sleep stages', 'Resting heart rate', 'Blood oxygen'],
  },
  {
    id: 'oura',
    name: 'Oura Ring',
    description: 'Readiness score, deep sleep, body temperature trends.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="9" stroke="#1a1a1a" strokeWidth="2.5" fill="none"/>
        <circle cx="12" cy="12" r="4" fill="#1a1a1a"/>
      </svg>
    ),
    available: false,
    comingSoon: true,
    dataPoints: ['Readiness', 'Deep sleep', 'Temp deviation', 'Respiratory rate'],
  },
  {
    id: 'myfitnesspal',
    name: 'MyFitnessPal',
    description: 'Calorie intake, macros, micronutrients, and meal logs.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#00B2FF" opacity="0.15"/>
        <path d="M8 12 L11 15 L16 9" stroke="#00B2FF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    available: false,
    comingSoon: true,
    dataPoints: ['Calories', 'Macros', 'Micronutrients', 'Meal timing'],
  },
  {
    id: 'epic',
    name: 'Epic MyChart',
    description: 'Lab results, prescriptions, visit notes, and imaging from your provider.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="4" y="3" width="16" height="18" rx="2" stroke="#2D6A4F" strokeWidth="2" fill="none"/>
        <path d="M8 8h8M8 12h8M8 16h5" stroke="#2D6A4F" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    available: false,
    comingSoon: true,
    dataPoints: ['Lab results', 'Medications', 'Visit history', 'Allergies'],
  },
]

export default function Integrations() {
  const [connected, setConnected] = useState({ strava: false, garmin: false })
  const navigate = useNavigate()

  useEffect(() => {
    setConnected({
      strava: isStravaConnected(),
      garmin: isGarminConnected(),
    })
  }, [])

  function handleConnect(id) {
    if (id === 'strava') {
      window.location.href = getStravaAuthUrl()
    } else if (id === 'garmin') {
      connectGarmin()
      setConnected(prev => ({ ...prev, garmin: true }))
    }
  }

  function handleDisconnect(id) {
    if (id === 'strava') {
      clearToken()
    } else if (id === 'garmin') {
      disconnectGarmin()
    }
    setConnected(prev => ({ ...prev, [id]: false }))
  }

  const connectedCount = Object.values(connected).filter(Boolean).length

  return (
    <div className={styles.page}>
      <Nav />
      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.headerTop}>
            <div>
              <h1 className={styles.title}>Your health data, unified.</h1>
              <p className={styles.subtitle}>
                Connect your apps and wearables so your Lotus physician sees the full picture — not just what you remember to mention.
              </p>
            </div>
            {connectedCount > 0 && (
              <button className={styles.chatCta} onClick={() => navigate('/chat')}>
                Ask your physician →
              </button>
            )}
          </div>

          {connectedCount > 0 && (
            <div className={styles.statusBar}>
              <span className={styles.statusDot} />
              <span className={styles.statusText}>
                {connectedCount} {connectedCount === 1 ? 'source' : 'sources'} connected · Syncing automatically
              </span>
            </div>
          )}
        </div>

        <div className={styles.grid}>
          {INTEGRATIONS.map((integration, i) => {
            const isConnected = connected[integration.id] || false

            return (
              <div
                key={integration.id}
                className={`${styles.card} ${integration.comingSoon ? styles.cardDim : ''} ${isConnected ? styles.cardConnected : ''}`}
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className={styles.cardTop}>
                  <div className={styles.cardLeft}>
                    <div className={styles.iconWrap}>
                      {integration.icon}
                    </div>
                    <div>
                      <div className={styles.cardName}>{integration.name}</div>
                      {integration.comingSoon && (
                        <span className={styles.soonBadge}>Coming soon</span>
                      )}
                    </div>
                  </div>

                  {!integration.comingSoon && (
                    <div>
                      {isConnected ? (
                        <div className={styles.connectedGroup}>
                          <div className={styles.connectedBadge}>
                            <span className={styles.connectedDot} />
                            Connected
                          </div>
                          <button
                            className={styles.disconnectBtn}
                            onClick={() => handleDisconnect(integration.id)}
                          >
                            Disconnect
                          </button>
                        </div>
                      ) : (
                        <button
                          className={styles.connectBtn}
                          onClick={() => handleConnect(integration.id)}
                        >
                          Connect
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <p className={styles.cardDesc}>{integration.description}</p>

                <div className={styles.dataPoints}>
                  {integration.dataPoints.map(dp => (
                    <span key={dp} className={styles.chip}>{dp}</span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <p className={styles.footer}>
          Your data is encrypted in transit and never sold. Lotus uses it solely to help your care team.
        </p>
      </main>
    </div>
  )
}
