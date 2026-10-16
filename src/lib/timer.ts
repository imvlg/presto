import { cleanActivity, modeDurations, type LiveSession, type Mode, type Session, type Settings } from './model'

export const RECOVERY_GAP_MS = 2 * 60 * 60_000

export function createLive(activity: string, mode: Mode, settings: Settings, now = Date.now()): LiveSession {
  const durations = modeDurations(mode, settings)
  return {
    id: crypto.randomUUID(), activity: cleanActivity(activity), startedAt: now, mode,
    focusTargetMs: durations.focus, breakTargetMs: durations.break,
    phase: 'focusing', resumePhase: 'focusing', phaseStartedAt: now,
    focusMs: 0, pausedMs: 0, breakMs: 0, awayMs: 0, pauseCount: 0, cycles: 0,
    focusIntervalStartMs: 0, breakIntervalStartMs: 0, longBreak: false,
    lastSeenAt: now, reminderDismissedAt: 0, segments: [],
  }
}

export function settle(live: LiveSession, now = Date.now()): LiveSession {
  const safeNow = Math.max(live.phaseStartedAt, now)
  const delta = safeNow - live.phaseStartedAt
  const kind: 'focus' | 'pause' | 'break' = live.phase === 'focusing' ? 'focus' : live.phase === 'paused' ? 'pause' : 'break'
  const previous = live.segments.at(-1)
  const segments = delta <= 0 ? live.segments : previous && previous.kind === kind && previous.end === live.phaseStartedAt
    ? [...live.segments.slice(0, -1), { ...previous, end: safeNow }]
    : [...live.segments, { start: live.phaseStartedAt, end: safeNow, kind }]
  return {
    ...live,
    segments,
    focusMs: live.focusMs + (live.phase === 'focusing' ? delta : 0),
    pausedMs: live.pausedMs + (live.phase === 'paused' ? delta : 0),
    breakMs: live.breakMs + (live.phase === 'break' ? delta : 0),
    phaseStartedAt: safeNow,
    lastSeenAt: safeNow,
  }
}

export function displayed(live: LiveSession, now = Date.now()) {
  const current = settle(live, now)
  const focusIntervalMs = current.focusMs - current.focusIntervalStartMs
  const breakIntervalMs = current.breakMs - current.breakIntervalStartMs
  return {
    ...current,
    focusIntervalMs,
    breakIntervalMs,
    focusDue: live.mode !== 'flow' && live.phase === 'focusing' && focusIntervalMs >= live.focusTargetMs,
    breakDue: live.phase === 'break' && breakIntervalMs >= (live.longBreak ? 25 * 60_000 : live.breakTargetMs),
    activeShare: current.focusMs + current.pausedMs > 0 ? current.focusMs / (current.focusMs + current.pausedMs) : 0,
  }
}

export function pause(live: LiveSession, now = Date.now()): LiveSession {
  if (live.phase === 'paused') return live
  const current = settle(live, now)
  return { ...current, phase: 'paused', resumePhase: live.phase, pauseCount: live.pauseCount + 1 }
}

export function resume(live: LiveSession, now = Date.now()): LiveSession {
  if (live.phase !== 'paused') return live
  const current = settle(live, now)
  return { ...current, phase: live.resumePhase }
}

export function beginBreak(live: LiveSession, now = Date.now(), longBreak = false): LiveSession {
  if (live.phase === 'break') return live
  const current = settle(live, now)
  return { ...current, phase: 'break', resumePhase: 'break', cycles: live.cycles + 1,
    breakIntervalStartMs: current.breakMs, longBreak }
}

export function beginFocus(live: LiveSession, now = Date.now()): LiveSession {
  if (live.phase === 'focusing') return live
  const current = settle(live, now)
  return { ...current, phase: 'focusing', resumePhase: 'focusing',
    focusIntervalStartMs: current.focusMs, longBreak: false, reminderDismissedAt: 0 }
}

export function continueFocus(live: LiveSession, now = Date.now()): LiveSession {
  if (live.phase !== 'focusing') return live
  const current = settle(live, now)
  return { ...current, focusIntervalStartMs: current.focusMs, reminderDismissedAt: now }
}

export function finish(live: LiveSession, now = Date.now()): Session {
  const current = settle(live, now)
  const focusGoal = live.mode === 'flow' ? 0 : live.focusTargetMs
  return {
    id: live.id, activity: live.activity, startedAt: live.startedAt, endedAt: current.phaseStartedAt,
    mode: live.mode, focusMs: current.focusMs, pausedMs: current.pausedMs, breakMs: current.breakMs, awayMs: current.awayMs,
    pauseCount: current.pauseCount,
    status: !focusGoal || current.focusMs >= focusGoal ? 'completed' : 'ended early',
    segments: current.segments,
  }
}

export function freezeForRecovery(live: LiveSession): LiveSession {
  return settle(live, live.lastSeenAt)
}
