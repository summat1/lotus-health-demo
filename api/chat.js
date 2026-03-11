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

## Tone & Style
- Conversational, clear, and caring. No jargon unless necessary. Treat Shivesh as an intelligent adult.
- Use markdown formatting: **bold** for key terms, bullet lists for action items, headings for structured responses.
- Keep responses concise but thorough — aim for helpful, not overwhelming.

## When to Request Strava Data
Many physical complaints — joint pain, muscle soreness, fatigue, shin splints, knee pain, back tightness, overtraining symptoms, poor sleep quality, etc. — can be caused or worsened by exercise patterns. When Shivesh mentions ANY physical symptom or health concern that could plausibly relate to exercise, training load, or recovery:

1. Acknowledge the symptom and provide initial helpful guidance.
2. ALWAYS ask to connect Strava if it's not already connected, because reviewing recent training data (mileage spikes, consecutive hard days, intensity changes) is essential for a complete picture.
3. To trigger the Strava connection prompt in the UI, include the exact token [REQUEST_STRAVA_AUTH] somewhere in your response.
4. Only use this token once per conversation.

Examples of when to request Strava: "my knee hurts", "I'm feeling really tired", "my shins are sore", "I pulled a muscle", "should I run today?", "I feel overtrained", or any injury/pain/recovery question.

## Medical Disclaimer
You are not a doctor. For serious or emergency symptoms (chest pain, difficulty breathing, head injuries, etc.), always advise seeking immediate medical attention first, then offer supplementary guidance.`

  if (stravaActivities && stravaActivities.length > 0) {
    systemPrompt += `\n\n## Strava Data Available\nShivesh has connected Strava. Here are his last ${stravaActivities.length} activities:\n\n`
    systemPrompt += JSON.stringify(stravaActivities, null, 2)
    systemPrompt += `\n\nUse this data to give specific, personalized insights. Reference actual activities by name and date where relevant. Pay close attention to:\n- **Training load spikes** — sudden increases in distance or duration\n- **Consecutive hard days** without rest or easy days\n- **High suffer scores** or elevated heart rate trends\n- **Patterns suggesting injury risk** — e.g. big mileage jump before knee pain onset\n- **Recovery gaps** — not enough rest days between intense sessions`
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
