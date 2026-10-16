export type Mode = 'short' | 'balanced' | 'flow' | 'custom'
export type Phase = 'focusing' | 'paused' | 'break'
export type SessionStatus = 'completed' | 'ended early'

export interface Session {
  id: string
  activity: string
  startedAt: number
  endedAt: number
  mode: Mode
  focusMs: number
  pausedMs: number
  breakMs: number
  awayMs?: number
  pauseCount: number
  rating?: number
  status: SessionStatus
  segments?: TimeSegment[]
}

export interface TimeSegment {
  start: number
  end: number
  kind: 'focus' | 'pause' | 'break'
}

export interface LiveSession {
  id: string
  activity: string
  startedAt: number
  mode: Mode
  focusTargetMs: number
  breakTargetMs: number
  phase: Phase
  resumePhase: 'focusing' | 'break'
  phaseStartedAt: number
  focusMs: number
  pausedMs: number
  breakMs: number
  awayMs: number
  pauseCount: number
  cycles: number
  focusIntervalStartMs: number
  breakIntervalStartMs: number
  longBreak: boolean
  lastSeenAt: number
  reminderDismissedAt: number
  segments: TimeSegment[]
}

export interface Settings {
  soundEnabled: boolean
  volume: number
  flowReminderMinutes: number
  longFocusReminderMinutes: number
  customFocusMinutes: number
  customBreakMinutes: number
}

export const defaultSettings: Settings = {
  soundEnabled: true,
  volume: 0.35,
  flowReminderMinutes: 60,
  longFocusReminderMinutes: 150,
  customFocusMinutes: 30,
  customBreakMinutes: 7,
}

export function normalizeActivity(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

export function cleanActivity(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 80)
}

export const modeNames: Record<Mode, string> = {
  short: 'Short focus',
  balanced: 'Balanced',
  flow: 'Flow',
  custom: 'Custom',
}

export function modeDurations(mode: Mode, settings: Settings) {
  if (mode === 'short') return { focus: 25 * 60_000, break: 5 * 60_000 }
  if (mode === 'balanced') return { focus: 45 * 60_000, break: 10 * 60_000 }
  if (mode === 'custom') return { focus: settings.customFocusMinutes * 60_000, break: settings.customBreakMinutes * 60_000 }
  return { focus: 0, break: 10 * 60_000 }
}

export function formatDuration(ms: number, exact = false): string {
  const seconds = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(seconds / 3600)
  const m = Math.floor(seconds / 60) % 60
  const s = seconds % 60
  if (exact || h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function formatCompact(ms: number): string {
  if (ms > 0 && ms < 60_000) return `${Math.max(1, Math.floor(ms / 1000))}s`
  const minutes = Math.round(Math.max(0, ms) / 60_000)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}
