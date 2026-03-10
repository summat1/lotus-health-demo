/**
 * Send a message via the /api/chat Vercel serverless proxy.
 * The Anthropic API key lives only in Vercel env vars — never in the browser.
 */
export async function sendMessage({ messages, stravaActivities = null }) {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, stravaActivities }),
  })

  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || 'Failed to reach chat API')
  }

  const data = await response.json()
  return data.text ?? ''
}
