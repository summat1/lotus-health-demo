// api/chat.js
// Vercel serverless function — proxies Anthropic API so the key never touches the browser.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' })
  }

  const { messages, stravaActivities } = req.body

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ message: 'Missing messages array' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ message: 'Anthropic API key not configured' })
  }

  let systemPrompt = `You are the Lotus Health AI assistant — a warm, knowledgeable health companion helping Shivesh understand his body and training.

Your role mirrors the Lotus physician co-pilot: you surface insights from health data, flag recovery concerns, and help users understand injury risk before it becomes a problem.

Tone: Conversational, clear, and caring. No jargon unless necessary. Treat Shivesh as an intelligent adult.

When you don't have enough data to answer a health or fitness question well, proactively ask to connect to Strava by responding with a message that includes the exact token: [REQUEST_STRAVA_AUTH]

This token tells the UI to show a Strava connect button inline. Only use it once per conversation if data is missing.`

  if (stravaActivities && stravaActivities.length > 0) {
    systemPrompt += `\n\nShivesh has connected Strava. Here are his last ${stravaActivities.length} activities:\n\n`
    systemPrompt += JSON.stringify(stravaActivities, null, 2)
    systemPrompt += `\n\nUse this data to give specific, personalized insights. Reference actual activities by name and date where relevant. Pay attention to: training load spikes, consecutive hard days without rest, high suffer scores, elevated HR trends, and patterns that suggest injury risk or overtraining.`
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      return res.status(response.status).json({ message: err?.error?.message || 'Anthropic API error' })
    }

    const data = await response.json()
    const text = data.content?.[0]?.text ?? ''
    return res.status(200).json({ text })
  } catch (err) {
    console.error('Chat proxy error:', err)
    return res.status(500).json({ message: 'Internal server error' })
  }
}
