import { normalizeActivity, type Session } from './model'

export function localDay(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function dateFromDay(day: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date)
}

export function dayOffset(day: string, offset: number): string {
  const date = dateFromDay(day)
  date.setDate(date.getDate() + offset)
  return localDay(date.getTime())
}

export function addDailyTotals(sessions: Session[], activity?: string): Map<string, number> {
  const totals = new Map<string, number>()
  for (const session of sessions) {
    if (activity && normalizeActivity(session.activity) !== normalizeActivity(activity)) continue
    const focusSegments = session.segments?.filter(segment => segment.kind === 'focus')
    const pieces = focusSegments?.length ? focusSegments.map(({ start, end }) => ({ start, end, multiplier: 1 }))
      : [{ start: session.startedAt, end: session.endedAt,
          multiplier: session.endedAt > session.startedAt ? session.focusMs / (session.endedAt - session.startedAt) : 0 }]
    for (const piece of pieces) {
      let cursor = piece.start
      while (cursor < piece.end) {
        const day = localDay(cursor)
        const next = dateFromDay(dayOffset(day, 1)).getTime()
        const span = Math.min(piece.end, next) - cursor
        totals.set(day, (totals.get(day) ?? 0) + span * piece.multiplier)
        cursor += span
      }
    }
  }
  return totals
}

export function activityTotals(sessions: Session[]) {
  const groups = new Map<string, { name: string, focusMs: number, pausedMs: number, sessions: number, lastAt: number }>()
  for (const session of sessions) {
    const key = normalizeActivity(session.activity)
    if (!key) continue
    const group = groups.get(key) ?? { name: session.activity, focusMs: 0, pausedMs: 0, sessions: 0, lastAt: 0 }
    if (session.endedAt > group.lastAt) group.name = session.activity
    group.focusMs += session.focusMs
    group.pausedMs += session.pausedMs
    group.sessions += 1
    group.lastAt = Math.max(group.lastAt, session.endedAt)
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.focusMs - a.focusMs)
}

export function statsFor(sessions: Session[]) {
  const focusMs = sessions.reduce((sum, item) => sum + item.focusMs, 0)
  const pausedMs = sessions.reduce((sum, item) => sum + item.pausedMs, 0)
  const breakMs = sessions.reduce((sum, item) => sum + item.breakMs, 0)
  const ratings = sessions.flatMap(item => item.rating ? [item.rating] : [])
  return {
    focusMs, pausedMs, breakMs, count: sessions.filter(item => item.status === 'completed').length,
    averageFocusMs: sessions.length ? focusMs / sessions.length : 0,
    activeShare: focusMs + pausedMs ? focusMs / (focusMs + pausedMs) : 0,
    averageRating: ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : undefined,
    ratedCount: ratings.length,
  }
}

export type Period = 'day' | 'week' | 'month'

export function periodBounds(period: Period, anchor = new Date()): [number, number] {
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate())
  if (period === 'week') start.setDate(start.getDate() - ((start.getDay() + 6) % 7))
  if (period === 'month') start.setDate(1)
  const end = new Date(start)
  if (period === 'day') end.setDate(end.getDate() + 1)
  if (period === 'week') end.setDate(end.getDate() + 7)
  if (period === 'month') end.setMonth(end.getMonth() + 1)
  return [start.getTime(), end.getTime()]
}

export function sessionsInPeriod(sessions: Session[], period: Period, anchor = new Date()): Session[] {
  const [start, end] = periodBounds(period, anchor)
  return sessions.filter(session => session.startedAt < end && session.endedAt > start).map(session => {
    const overlap = Math.max(0, Math.min(end, session.endedAt) - Math.max(start, session.startedAt))
    const ratio = session.endedAt > session.startedAt ? overlap / (session.endedAt - session.startedAt) : 0
    const measure = (kind: 'focus' | 'pause' | 'break', fallback: number) => session.segments?.length
      ? session.segments.filter(segment => segment.kind === kind).reduce((sum, segment) =>
        sum + Math.max(0, Math.min(end, segment.end) - Math.max(start, segment.start)), 0)
      : fallback * ratio
    return {
      ...session,
      startedAt: Math.max(start, session.startedAt),
      endedAt: Math.min(end, session.endedAt),
      focusMs: measure('focus', session.focusMs),
      pausedMs: measure('pause', session.pausedMs),
      breakMs: measure('break', session.breakMs),
      status: session.status === 'completed' && session.endedAt >= start && session.endedAt < end ? 'completed' : 'ended early',
    }
  })
}

export function trendBuckets(sessions: Session[], period: Period, anchor = new Date()) {
  const [start, end] = periodBounds(period, anchor)
  const buckets: { label: string, focusMs: number }[] = []
  if (period === 'day') {
    for (let hour = 0; hour < 24; hour += 3) buckets.push({ label: `${String(hour).padStart(2, '0')}:00`, focusMs: 0 })
    for (const item of sessions) {
      const parts = item.segments?.filter(segment => segment.kind === 'focus') ?? [{ start: item.startedAt, end: item.endedAt }]
      const scale = item.segments?.length ? 1 : item.endedAt > item.startedAt ? item.focusMs / (item.endedAt - item.startedAt) : 0
      for (const part of parts) {
        for (let hour = 0; hour < 8; hour++) {
          const bucketStart = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), hour * 3).getTime()
          const bucketEnd = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), (hour + 1) * 3).getTime()
          buckets[hour].focusMs += Math.max(0, Math.min(bucketEnd, part.end) - Math.max(bucketStart, part.start)) * scale
        }
      }
    }
  } else {
    for (let date = start; date < end;) {
      const d = new Date(date)
      buckets.push({ label: period === 'week' ? d.toLocaleDateString(undefined, { weekday: 'short' }) : String(d.getDate()), focusMs: 0 })
      d.setDate(d.getDate() + 1)
      date = d.getTime()
    }
    const totals = addDailyTotals(sessions)
    for (const [key, focusMs] of totals) {
      const date = dateFromDay(key)
      const first = new Date(start)
      const index = Math.round((Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) - Date.UTC(first.getFullYear(), first.getMonth(), first.getDate())) / 86_400_000)
      if (buckets[index]) buckets[index].focusMs += focusMs
    }
  }
  return buckets
}
