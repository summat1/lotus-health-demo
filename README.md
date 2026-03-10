# Lotus Health AI — Integrations Prototype

A prototype integration portal for [Lotus Health AI](https://lotushealth.ai), built to demonstrate unified health data as a physician co-pilot accelerator.

**Two pages:**
- `/integrations` — Connect health data sources (Strava live, others coming soon)
- `/chat` — AI health assistant powered by Claude that pulls your Strava data mid-conversation to reason about injury risk and recovery

---

## Demo Flow

1. Visit `/integrations` and connect Strava via OAuth
2. Navigate to `/chat`
3. Ask something like: *"My knee has been sore — should I train tomorrow?"*
4. If Strava isn't connected yet, Claude will ask to connect inline
5. After connecting, Claude pulls your last 10 activities and gives a personalized injury/recovery assessment

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/yourusername/lotus-health.git
cd lotus-health
npm install
```

### 2. Create a Strava API Application

1. Go to [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
2. Create a new application:
   - **Application Name:** Lotus Health (or anything you like)
   - **Category:** Health & Fitness
   - **Website:** `http://localhost:5173` (update to your Vercel URL after deploy)
   - **Authorization Callback Domain:** `localhost` (update to your Vercel domain after deploy)
3. After creating, note your **Client ID** and **Client Secret**

### 3. Get an Anthropic API Key

1. Go to [https://console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Note it for the next step

### 4. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env`:

```
VITE_STRAVA_CLIENT_ID=your_strava_client_id
STRAVA_CLIENT_SECRET=your_strava_client_secret
VITE_ANTHROPIC_API_KEY=your_anthropic_api_key
```

> **Note:** `VITE_` prefix exposes the variable to the browser. The Strava client secret does NOT get a `VITE_` prefix — it only runs inside the Vercel serverless function.

### 5. Run locally

```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

---

## Deploy to Vercel

### Option A: Vercel CLI

```bash
npm install -g vercel
vercel
```

Follow the prompts. Then add environment variables in the Vercel dashboard:

| Variable | Value | Where |
|---|---|---|
| `VITE_STRAVA_CLIENT_ID` | Your Strava Client ID | Vercel env vars |
| `STRAVA_CLIENT_SECRET` | Your Strava Client Secret | Vercel env vars |
| `VITE_ANTHROPIC_API_KEY` | Your Anthropic API key | Vercel env vars |

### Option B: Connect GitHub repo in Vercel dashboard

1. Push to GitHub
2. Import project at [vercel.com/new](https://vercel.com/new)
3. Add the three environment variables above
4. Deploy

### After deploying: Update Strava callback URL

1. Go back to your [Strava API settings](https://www.strava.com/settings/api)
2. Update **Authorization Callback Domain** to your Vercel domain (e.g. `lotus-health.vercel.app`)

---

## Architecture

```
src/
├── pages/
│   ├── Integrations.jsx     # Data source hub
│   ├── Chat.jsx             # AI chat with inline Strava auth trigger
│   └── StravaCallback.jsx   # OAuth redirect handler
├── components/
│   └── Nav.jsx              # Shared navigation
├── lib/
│   ├── strava.js            # OAuth flow + activity fetching
│   └── claude.js            # Anthropic Messages API
api/
└── strava/
    └── callback.js          # Vercel serverless: token exchange (keeps secret server-side)
```

## Integrations

| Source | Status | Data |
|---|---|---|
| Strava | ✅ Live | Activities, HR, suffer score, effort |
| Apple Health | 🔜 Coming soon | HRV, sleep, steps, blood oxygen |
| Oura Ring | 🔜 Coming soon | Readiness, deep sleep, temp trends |
| MyFitnessPal | 🔜 Coming soon | Calories, macros, meal logs |
| Epic MyChart | 🔜 Coming soon | Labs, prescriptions, visit history |

---

## Why This Exists

Lotus Health AI's core thesis is eliminating medical data silos — the fragmentation that causes missed diagnoses and delayed care. This prototype demonstrates what a unified health data layer looks like in practice: wearable data + EMR context flowing into a physician co-pilot that can reason across all of it.

Built as a conversation starter for the Lotus team.
