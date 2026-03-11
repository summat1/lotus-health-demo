/**
 * Garmin integration — simulated sleep & recovery data.
 * 
 * In production this would use the Garmin Health API (OAuth 2.0 + PKCE).
 * For the demo, we generate realistic sleep data based on the current date
 * so it always looks fresh and relevant.
 */

const GARMIN_TOKEN_KEY = 'garmin_token'

/**
 * Generate realistic sleep data for the last N nights
 * anchored to the current date so it always looks current.
 */
function generateSleepData(nights = 7) {
  const data = []
  const now = new Date()

  for (let i = 0; i < nights; i++) {
    const date = new Date(now)
    date.setDate(date.getDate() - i - 1) // last night = index 0
    const dateStr = date.toISOString().split('T')[0]

    // Simulate a pattern: declining sleep quality over the week
    // (most recent nights are worse — supports overtraining narrative)
    const qualityTrend = i < 3 ? 'poor' : 'good'
    const baseDuration = qualityTrend === 'poor' ? 5.5 + Math.random() * 1 : 7 + Math.random() * 1.2
    const baseScore = qualityTrend === 'poor' ? 45 + Math.floor(Math.random() * 15) : 72 + Math.floor(Math.random() * 18)
    const restingHR = qualityTrend === 'poor' ? 62 + Math.floor(Math.random() * 8) : 52 + Math.floor(Math.random() * 6)
    const hrv = qualityTrend === 'poor' ? 28 + Math.floor(Math.random() * 12) : 45 + Math.floor(Math.random() * 20)
    const bodyBattery = qualityTrend === 'poor' ? 25 + Math.floor(Math.random() * 20) : 65 + Math.floor(Math.random() * 25)
    const stressAvg = qualityTrend === 'poor' ? 45 + Math.floor(Math.random() * 20) : 20 + Math.floor(Math.random() * 15)

    const totalMin = Math.round(baseDuration * 60)
    const deepPct = qualityTrend === 'poor' ? 0.10 + Math.random() * 0.05 : 0.18 + Math.random() * 0.07
    const remPct = qualityTrend === 'poor' ? 0.12 + Math.random() * 0.05 : 0.20 + Math.random() * 0.05
    const awakePct = qualityTrend === 'poor' ? 0.08 + Math.random() * 0.07 : 0.02 + Math.random() * 0.04
    const lightPct = 1 - deepPct - remPct - awakePct

    data.push({
      date: dateStr,
      sleep_score: baseScore,
      total_sleep_hours: Number(baseDuration.toFixed(1)),
      deep_sleep_min: Math.round(totalMin * deepPct),
      light_sleep_min: Math.round(totalMin * lightPct),
      rem_sleep_min: Math.round(totalMin * remPct),
      awake_min: Math.round(totalMin * awakePct),
      resting_hr: restingHR,
      hrv_ms: hrv,
      body_battery_morning: bodyBattery,
      stress_avg: stressAvg,
      times_woken: qualityTrend === 'poor' ? 3 + Math.floor(Math.random() * 3) : 0 + Math.floor(Math.random() * 2),
    })
  }

  return data
}

export function isGarminConnected() {
  return !!localStorage.getItem(GARMIN_TOKEN_KEY)
}

export function connectGarmin() {
  // Simulate storing a token — in production this would be an OAuth flow
  localStorage.setItem(GARMIN_TOKEN_KEY, JSON.stringify({
    connected_at: Date.now(),
    device: 'Garmin Forerunner 265',
  }))
}

export function disconnectGarmin() {
  localStorage.removeItem(GARMIN_TOKEN_KEY)
}

/**
 * Fetch sleep data — returns simulated data anchored to current date.
 * In production, this would call the Garmin Health API.
 */
export async function fetchGarminSleepData(nights = 7) {
  if (!isGarminConnected()) throw new Error('Not connected to Garmin')

  // Simulate a brief network delay for realism
  await new Promise(resolve => setTimeout(resolve, 800))

  return generateSleepData(nights)
}
