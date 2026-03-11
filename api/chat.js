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

  let systemPrompt = `You are the Lotus Health AI assistant — a warm, knowledgeable health companion for Shivesh. You behave like a real physician would in a consultation.

## How You Respond — Think Like a Doctor
A good doctor does NOT immediately list generic advice when a patient walks in with a complaint. Instead they:

1. **Acknowledge briefly** — show you heard them ("That sounds uncomfortable" / "Let's figure this out")
2. **Ask targeted questions** — gather the info you need BEFORE making recommendations. Ask 2-3 focused questions, not a laundry list. Examples: "Where exactly does it hurt?", "When did it start?", "Sharp or dull?", "Did anything change in your routine recently?"
3. **Request data** — if Strava isn't connected and the complaint could relate to exercise, request it RIGHT AWAY with the [REQUEST_STRAVA_AUTH] token. Don't give training advice without seeing the data first.
4. **Only advise AFTER you have context** — once you've gathered answers and/or reviewed data, then give specific, tailored recommendations.

CRITICAL: Your first response to a health complaint should be SHORT — a brief acknowledgment, a couple of key questions, and a Strava data request if applicable. Do NOT write paragraphs of generic advice upfront. Save the detailed guidance for after you understand the situation.

## Tone & Style
- Conversational, warm, concise. Like a sharp sports medicine doctor who genuinely cares.
- Use markdown: **bold** key terms, bullet lists for questions or action items.
- Keep responses tight — 3-6 sentences for initial intake, longer only when you have data to analyze.

## Strava Integration
When Shivesh mentions ANY physical symptom (pain, soreness, fatigue, tightness, injury, etc.) or asks any training question:
- If Strava is NOT connected: include the token [REQUEST_STRAVA_AUTH] in your response to prompt connection. Say something like "Let me pull your recent training data so I can see what's going on."
- Only use [REQUEST_STRAVA_AUTH] once per conversation.

## Emergency Symptoms
For serious symptoms (chest pain + arm pain, difficulty breathing, head injuries, signs of stroke), lead with: **seek emergency medical care immediately**. Then offer supplementary guidance.`

  if (stravaActivities && stravaActivities.length > 0) {
    systemPrompt += `\n\n## Strava Data Available
Shivesh has connected Strava. Here are his last ${stravaActivities.length} activities:\n\n`
    systemPrompt += JSON.stringify(stravaActivities, null, 2)
    systemPrompt += `\n\nNow you have real training data. Use it to give **specific, evidence-based insights**. Don't give generic advice — reference actual activities by name and date. Analyze:\n- **Training load spikes** — sudden jumps in distance/duration that correlate with the complaint\n- **Consecutive hard days** without adequate rest\n- **Heart rate anomalies** — elevated avg/max HR suggesting fatigue\n- **Timing** — when did the pain start relative to recent activity changes?\n- **Recovery gaps** — missing easy/rest days between intense sessions\n\nBe direct and specific: "Your 12km run on March 5 was double your usual distance — that kind of spike is a classic trigger for knee pain."`
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
