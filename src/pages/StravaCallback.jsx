import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { storeToken } from '../lib/strava'
import styles from './StravaCallback.module.css'

export default function StravaCallback() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('Connecting to Strava...')
  const [error, setError] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const errorParam = params.get('error')

    if (errorParam) {
      setError('Access was denied. You can try connecting again from the integrations page.')
      return
    }

    if (!code) {
      setError('No authorization code received.')
      return
    }

    exchangeCode(code)
  }, [])

  async function exchangeCode(code) {
    try {
      setStatus('Exchanging authorization code...')

      const res = await fetch('/api/strava/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || 'Token exchange failed')
      }

      const token = await res.json()
      storeToken(token)

      setStatus('Connected! Redirecting...')
      setTimeout(() => navigate('/chat'), 1000)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
            <circle cx="16" cy="16" r="16" fill="#7C3AED"/>
            <path d="M16 8 C16 8 10 13 10 18 C10 21.3 12.7 24 16 24 C19.3 24 22 21.3 22 18 C22 13 16 8 16 8Z" fill="white" opacity="0.9"/>
            <path d="M16 12 C16 12 12 15.5 12 18 C12 20.2 13.8 22 16 22 C18.2 22 20 20.2 20 18 C20 15.5 16 12 16 12Z" fill="#7C3AED"/>
          </svg>
        </div>

        {error ? (
          <>
            <p className={styles.errorText}>{error}</p>
            <button className={styles.btn} onClick={() => navigate('/integrations')}>
              Back to integrations
            </button>
          </>
        ) : (
          <>
            <div className={styles.spinner} />
            <p className={styles.statusText}>{status}</p>
          </>
        )}
      </div>
    </div>
  )
}
