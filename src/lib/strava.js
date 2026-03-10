const STRAVA_CLIENT_ID = import.meta.env.VITE_STRAVA_CLIENT_ID
const REDIRECT_URI = `${window.location.origin}/strava/callback`

export function getStravaAuthUrl() {
  const params = new URLSearchParams({
    client_id: STRAVA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'read,activity:read_all',
  })
  return `https://www.strava.com/oauth/authorize?${params}`
}

export function getStoredToken() {
  try {
    const raw = localStorage.getItem('strava_token')
    if (!raw) return null
    const token = JSON.parse(raw)
    if (Date.now() / 1000 > token.expires_at) {
      localStorage.removeItem('strava_token')
      return null
    }
    return token
  } catch {
    return null
  }
}

export function storeToken(token) {
  localStorage.setItem('strava_token', JSON.stringify(token))
}

export function clearToken() {
  localStorage.removeItem('strava_token')
}

export function isStravaConnected() {
  return !!getStoredToken()
}

/**
 * Fetch the last N activities from Strava
 * Returns a simplified array for Claude to reason about
 */
export async function fetchRecentActivities(perPage = 10) {
  const token = getStoredToken()
  if (!token) throw new Error('Not authenticated with Strava')

  const res = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`,
    { headers: { Authorization: `Bearer ${token.access_token}` } }
  )

  if (!res.ok) throw new Error('Failed to fetch Strava activities')

  const activities = await res.json()

  return activities.map(a => ({
    id: a.id,
    name: a.name,
    type: a.type,
    date: a.start_date_local?.split('T')[0],
    distance_km: a.distance ? (a.distance / 1000).toFixed(2) : null,
    duration_min: a.moving_time ? Math.round(a.moving_time / 60) : null,
    avg_hr: a.average_heartrate ?? null,
    max_hr: a.max_heartrate ?? null,
    suffer_score: a.suffer_score ?? null,
    perceived_exertion: a.perceived_exertion ?? null,
    elevation_gain_m: a.total_elevation_gain ?? null,
    kudos: a.kudos_count ?? 0,
  }))
}

/**
 * Fetch the authenticated athlete profile
 */
export async function fetchAthlete() {
  const token = getStoredToken()
  if (!token) throw new Error('Not authenticated with Strava')

  const res = await fetch('https://www.strava.com/api/v3/athlete', {
    headers: { Authorization: `Bearer ${token.access_token}` }
  })
  if (!res.ok) throw new Error('Failed to fetch athlete')
  return res.json()
}
