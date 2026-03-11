import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { isStravaConnected, fetchRecentActivities, getStravaAuthUrl } from './strava'
import { isGarminConnected, connectGarmin as connectGarminLib, fetchGarminSleepData } from './garmin'
import { analyzeHealthData } from './healthAnalysis'

/**
 * Integration registry — add new sources here, everything else adapts.
 * Each entry defines how to check, load, and connect a data source.
 */
const INTEGRATIONS = {
  strava: {
    name: 'Strava',
    label: 'activities',
    token: '[REQUEST_STRAVA_AUTH]',
    color: '#FFF3ED',
    brandColor: '#FC4C02',
    description: 'Pull your recent training data for better insights.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066l-2.084 4.116z" fill="#FC4C02" />
        <path d="M11.094 13.828l2.089 4.116 2.204-4.116H13.12L11.094 9.828 9.066 13.828h2.028z" fill="#FC4C02" opacity="0.7" />
      </svg>
    ),
    checkConnected: isStravaConnected,
    fetchData: () => fetchRecentActivities(10),
    resumeMessage: 'I just connected Strava — check my most recent activities and help me figure out what might be going on.',
    requiresRedirect: true,
    getAuthUrl: getStravaAuthUrl,
  },
  garmin: {
    name: 'Garmin',
    label: 'nights',
    token: '[REQUEST_GARMIN_AUTH]',
    color: '#EBF5FF',
    brandColor: '#007DC5',
    description: 'Pull your sleep, HRV, and recovery data.',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" fill="#007DC5" />
        <path d="M12 6c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z" fill="#007DC5" />
        <circle cx="12" cy="12" r="2" fill="#007DC5" />
      </svg>
    ),
    checkConnected: isGarminConnected,
    fetchData: () => fetchGarminSleepData(7),
    connectFn: connectGarminLib,
    resumeMessage: 'I just connected my Garmin — you now have my recent sleep and recovery data.',
    requiresRedirect: false,
  },
}

const SESSION_KEY = 'lotus_chat_session'

/**
 * useHealthData — single hook that manages all integration state,
 * data loading, health alerts, and connection flows.
 */
export function useHealthData() {
  const [sources, setSources] = useState({})
  const [loading, setLoading] = useState({})
  const [promptsVisible, setPromptsVisible] = useState({})
  const [dismissedAlerts, setDismissedAlerts] = useState([])

  const resumedFromOAuth = useRef(!!sessionStorage.getItem(SESSION_KEY))

  // Initialize all integrations on mount
  useEffect(() => {
    Object.entries(INTEGRATIONS).forEach(([key, integration]) => {
      if (integration.checkConnected()) {
        loadSource(key)
      }
    })
  }, [])

  // Load data for a specific source
  const loadSource = useCallback(async (key) => {
    const integration = INTEGRATIONS[key]
    if (!integration) return

    setLoading(prev => ({ ...prev, [key]: true }))
    try {
      const data = await integration.fetchData()
      setSources(prev => ({ ...prev, [key]: data }))
    } catch (err) {
      console.error(`Failed to load ${integration.name} data:`, err)
    } finally {
      setLoading(prev => ({ ...prev, [key]: false }))
    }
  }, [])

  // Handle connecting an integration that requires redirect (e.g., Strava)
  const connectWithRedirect = useCallback((key, messages) => {
    const integration = INTEGRATIONS[key]
    if (!integration?.requiresRedirect) return

    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages))
    } catch {}
    window.location.href = integration.getAuthUrl()
  }, [])

  // Handle connecting an integration without redirect (e.g., Garmin)
  const connectInline = useCallback(async (key) => {
    const integration = INTEGRATIONS[key]
    if (!integration?.connectFn) return null

    integration.connectFn()
    setPromptsVisible(prev => ({ ...prev, [key]: false }))
    await loadSource(key)
    return integration.resumeMessage
  }, [loadSource])

  // Show/hide integration prompts
  const showPrompt = useCallback((key) => {
    setPromptsVisible(prev => ({ ...prev, [key]: true }))
  }, [])

  const hideAllPrompts = useCallback(() => {
    setPromptsVisible({})
  }, [])

  // Show Garmin prompt if Garmin isn't connected (used after Strava OAuth return)
  const showGarminIfNeeded = useCallback(() => {
    if (!INTEGRATIONS.garmin.checkConnected()) {
      showPrompt('garmin')
    }
  }, [showPrompt])

  // Parse auth tokens from AI reply and trigger prompts
  const processReply = useCallback((reply) => {
    let cleaned = reply
    const triggered = []

    Object.entries(INTEGRATIONS).forEach(([key, integration]) => {
      if (cleaned.includes(integration.token)) {
        cleaned = cleaned.replace(integration.token, '').trim()
        if (!integration.checkConnected()) {
          triggered.push(key)
        }
      }
    })

    triggered.forEach(key => showPrompt(key))
    return cleaned
  }, [showPrompt])

  // Check for OAuth resume (returning from Strava redirect)
  const checkOAuthResume = useCallback((stravaData) => {
    if (!resumedFromOAuth.current || !stravaData) return null
    resumedFromOAuth.current = false
    sessionStorage.removeItem(SESSION_KEY)
    return INTEGRATIONS.strava.resumeMessage
  }, [])

  // Health alerts — derived from all loaded data
  const healthAlerts = useMemo(() => {
    return analyzeHealthData({
      stravaActivities: sources.strava || null,
      garminSleepData: sources.garmin || null,
    })
  }, [sources])

  const visibleAlerts = useMemo(() => {
    return healthAlerts.filter(a => !dismissedAlerts.includes(a.type))
  }, [healthAlerts, dismissedAlerts])

  const dismissAlert = useCallback((type) => {
    setDismissedAlerts(prev => [...prev, type])
  }, [])

  // Build connected sources summary for the data bar
  const connectedSummary = useMemo(() => {
    return Object.entries(INTEGRATIONS)
      .filter(([key]) => sources[key])
      .map(([key, integration]) => {
        const data = sources[key]
        const count = Array.isArray(data) ? data.length : 0
        return `${integration.name} · ${count} ${integration.label}`
      })
  }, [sources])

  // Which sources are currently loading
  const isLoading = Object.values(loading).some(Boolean)
  const loadingName = Object.entries(loading).find(([, v]) => v)?.[0]
  const loadingLabel = loadingName ? INTEGRATIONS[loadingName]?.name : null

  // Pending integration prompts
  const pendingPrompts = Object.entries(INTEGRATIONS)
    .filter(([key]) => promptsVisible[key] && !INTEGRATIONS[key].checkConnected())
    .map(([key, integration]) => ({
      key,
      ...integration,
    }))

  // Saved session (for OAuth return)
  const savedSession = (() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 1) return parsed
      }
    } catch {}
    return null
  })()

  return {
    // Data
    sources,
    stravaActivities: sources.strava || null,
    garminSleepData: sources.garmin || null,

    // Connection
    connectWithRedirect,
    connectInline,
    pendingPrompts,
    hideAllPrompts,
    showGarminIfNeeded,

    // Loading
    isLoading,
    loadingLabel,

    // Alerts
    visibleAlerts,
    dismissAlert,

    // Data bar
    connectedSummary,

    // Reply processing
    processReply,

    // OAuth resume
    savedSession,
    checkOAuthResume,
  }
}

