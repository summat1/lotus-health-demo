// api/strava/callback.js
// Vercel serverless function — handles Strava OAuth token exchange server-side
// so STRAVA_CLIENT_SECRET never touches the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { code } = req.body

  if (!code) {
    return res.status(400).json({ message: 'Missing authorization code' })
  }

  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return res.status(500).json({ message: 'Strava credentials not configured' })
  }

  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return res.status(400).json({ message: err.message || 'Token exchange failed' })
    }

    const token = await response.json()

    // Return only what the client needs — never log or store this server-side
    return res.status(200).json({
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: token.expires_at,
      athlete: {
        id: token.athlete?.id,
        firstname: token.athlete?.firstname,
        lastname: token.athlete?.lastname,
        profile: token.athlete?.profile_medium,
      },
    })
  } catch (err) {
    console.error('Strava token exchange error:', err)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
