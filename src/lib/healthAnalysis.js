/**
 * Health analysis engine — detects anomalies and generates proactive alerts
 * by cross-referencing training data (Strava) and recovery data (Garmin).
 * 
 * This is the "proactive intelligence" layer — the system surfaces concerns
 * BEFORE the user asks, like a physician reviewing a chart.
 */

/**
 * Analyze all available health data and return prioritized alerts.
 * Returns an array of alert objects, sorted by severity.
 */
export function analyzeHealthData({ stravaActivities, garminSleepData }) {
  const alerts = []

  if (garminSleepData && garminSleepData.length >= 3) {
    alerts.push(...analyzeSleepTrends(garminSleepData))
  }

  if (stravaActivities && stravaActivities.length >= 2) {
    alerts.push(...analyzeTrainingLoad(stravaActivities))
  }

  if (stravaActivities && garminSleepData) {
    alerts.push(...analyzeCrossData(stravaActivities, garminSleepData))
  }

  // Sort by severity: critical > warning > info
  const severityOrder = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  // Return top 2 most important alerts
  return alerts.slice(0, 2)
}

/**
 * Analyze sleep data for concerning trends
 */
function analyzeSleepTrends(sleepData) {
  const alerts = []
  const recent = sleepData.slice(0, 3) // last 3 nights
  const older = sleepData.slice(3) // older nights

  // Check for declining sleep scores
  const recentAvgScore = avg(recent.map(d => d.sleep_score))
  const olderAvgScore = older.length > 0 ? avg(older.map(d => d.sleep_score)) : null

  if (olderAvgScore && recentAvgScore < olderAvgScore * 0.75) {
    const dropPct = Math.round((1 - recentAvgScore / olderAvgScore) * 100)
    alerts.push({
      severity: 'warning',
      type: 'sleep_decline',
      title: 'Sleep quality declining',
      message: `Your sleep score has dropped ${dropPct}% over the last 3 nights (avg ${Math.round(recentAvgScore)} vs. your usual ${Math.round(olderAvgScore)}). Poor sleep compounds injury risk and slows recovery.`,
      metric: `${Math.round(recentAvgScore)} avg score`,
      icon: 'sleep',
    })
  }

  // Check for elevated resting HR
  const recentAvgHR = avg(recent.map(d => d.resting_hr))
  const olderAvgHR = older.length > 0 ? avg(older.map(d => d.resting_hr)) : null

  if (olderAvgHR && recentAvgHR > olderAvgHR + 5) {
    alerts.push({
      severity: 'warning',
      type: 'elevated_hr',
      title: 'Resting heart rate elevated',
      message: `Your resting HR has risen to ${Math.round(recentAvgHR)} bpm (up from ${Math.round(olderAvgHR)} bpm). This can signal inadequate recovery, stress, or early illness.`,
      metric: `${Math.round(recentAvgHR)} bpm`,
      icon: 'heart',
    })
  }

  // Check for low HRV
  const recentAvgHRV = avg(recent.map(d => d.hrv_ms))
  if (recentAvgHRV < 35) {
    alerts.push({
      severity: 'warning',
      type: 'low_hrv',
      title: 'HRV is low',
      message: `Your heart rate variability has averaged ${Math.round(recentAvgHRV)}ms over the last 3 nights. Low HRV indicates your nervous system is under stress — recovery is compromised.`,
      metric: `${Math.round(recentAvgHRV)}ms`,
      icon: 'heart',
    })
  }

  // Check for low body battery
  const lastNight = recent[0]
  if (lastNight && lastNight.body_battery_morning < 30) {
    alerts.push({
      severity: 'critical',
      type: 'low_battery',
      title: 'Body battery critically low',
      message: `You woke up with a body battery of just ${lastNight.body_battery_morning}/100 this morning. Your body isn't recovering overnight — consider a rest day.`,
      metric: `${lastNight.body_battery_morning}/100`,
      icon: 'battery',
    })
  }

  return alerts
}

/**
 * Analyze training data for load spikes and patterns
 */
function analyzeTrainingLoad(activities) {
  const alerts = []

  // Check for training load spike (most recent vs average)
  const mostRecent = activities[0]
  const rest = activities.slice(1)
  
  if (mostRecent && rest.length > 0 && mostRecent.distance_km && rest.some(a => a.distance_km)) {
    const avgDistance = avg(rest.filter(a => a.distance_km).map(a => parseFloat(a.distance_km)))
    const recentDistance = parseFloat(mostRecent.distance_km)

    if (avgDistance > 0 && recentDistance > avgDistance * 1.5) {
      const spikePct = Math.round((recentDistance / avgDistance - 1) * 100)
      alerts.push({
        severity: 'warning',
        type: 'load_spike',
        title: 'Training load spike detected',
        message: `Your last activity (${mostRecent.name}) was ${recentDistance}km — ${spikePct}% above your average of ${avgDistance.toFixed(1)}km. Sudden load spikes are the #1 predictor of overuse injuries.`,
        metric: `+${spikePct}%`,
        icon: 'activity',
      })
    }
  }

  // Check for consecutive hard days (no rest)
  const recentDates = activities
    .slice(0, 5)
    .filter(a => a.date)
    .map(a => new Date(a.date))
  
  let consecutiveDays = 1
  for (let i = 1; i < recentDates.length; i++) {
    const diff = (recentDates[i - 1] - recentDates[i]) / (1000 * 60 * 60 * 24)
    if (diff <= 1.5) {
      consecutiveDays++
    } else {
      break
    }
  }

  if (consecutiveDays >= 3) {
    alerts.push({
      severity: 'warning',
      type: 'no_rest',
      title: `${consecutiveDays} training days in a row`,
      message: `You've trained ${consecutiveDays} consecutive days without a rest day. Your body needs recovery time — back-to-back training without rest increases injury risk significantly.`,
      metric: `${consecutiveDays} days`,
      icon: 'activity',
    })
  }

  return alerts
}

/**
 * Cross-reference training and sleep data for deeper insights
 */
function analyzeCrossData(activities, sleepData) {
  const alerts = []

  const recentSleep = sleepData.slice(0, 3)
  const recentAvgScore = avg(recentSleep.map(d => d.sleep_score))
  const recentAvgHRV = avg(recentSleep.map(d => d.hrv_ms))

  // Check for high training load + poor recovery combo
  const hasRecentHardSession = activities.length > 0 && activities[0].suffer_score && activities[0].suffer_score > 100

  if (recentAvgScore < 55 && hasRecentHardSession) {
    alerts.push({
      severity: 'critical',
      type: 'overtraining_risk',
      title: 'Overtraining risk detected',
      message: `Your sleep quality is poor (avg score ${Math.round(recentAvgScore)}) and you're still pushing hard in training. This combination is a strong signal of overtraining — your body isn't getting the recovery it needs between sessions.`,
      metric: 'High risk',
      icon: 'alert',
    })
  }

  // Check for training with low HRV
  if (recentAvgHRV < 35 && activities.length > 0) {
    const lastActivity = activities[0]
    if (lastActivity.avg_hr && lastActivity.avg_hr > 140) {
      alerts.push({
        severity: 'warning',
        type: 'hrv_training_mismatch',
        title: 'Training hard with low recovery',
        message: `Your HRV is averaging ${Math.round(recentAvgHRV)}ms (low) but your last activity had an avg HR of ${lastActivity.avg_hr} bpm (high intensity). Training hard when your nervous system is stressed delays recovery and increases injury risk.`,
        metric: `${Math.round(recentAvgHRV)}ms HRV`,
        icon: 'heart',
      })
    }
  }

  return alerts
}

function avg(arr) {
  if (!arr.length) return 0
  return arr.reduce((a, b) => a + b, 0) / arr.length
}
