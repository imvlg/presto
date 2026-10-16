import { describe, expect, it } from 'vitest'
import { activityTotals, addDailyTotals, localDay, sessionsInPeriod, statsFor } from './stats'
import type { Session } from './model'

function record(id: string, activity: string, startedAt: number, endedAt: number, focusMs: number, pausedMs = 0): Session {
  return { id, activity, startedAt, endedAt, focusMs, pausedMs, breakMs: 0, pauseCount: pausedMs ? 1 : 0, mode: 'flow', status: 'completed' }
}

describe('activity aggregation', () => {
  it('groups capitalization and extra whitespace', () => {
    const start = new Date(2026, 9, 15, 9).getTime()
    const sessions = [record('a', '  Reading  ', start, start + 60000, 60000), record('b', 'reading', start + 60000, start + 120000, 60000)]
    expect(activityTotals(sessions)).toHaveLength(1)
    expect(activityTotals(sessions)[0].focusMs).toBe(120000)
  })

  it('attributes focus segments to the correct local day across midnight', () => {
    const start = new Date(2026, 9, 15, 23, 50).getTime()
    const midnight = new Date(2026, 9, 16, 0, 0).getTime()
    const session = record('x', 'Study', start, midnight + 20 * 60000, 20 * 60000, 10 * 60000)
    session.segments = [
      { start, end: midnight, kind: 'focus' },
      { start: midnight, end: midnight + 10 * 60000, kind: 'pause' },
      { start: midnight + 10 * 60000, end: midnight + 20 * 60000, kind: 'focus' },
    ]
    const daily = addDailyTotals([session])
    expect(daily.get(localDay(start))).toBe(10 * 60000)
    expect(daily.get(localDay(midnight))).toBe(10 * 60000)
    const day = sessionsInPeriod([session], 'day', new Date(midnight))
    expect(statsFor(day).focusMs).toBe(10 * 60000)
    expect(statsFor(day).pausedMs).toBe(10 * 60000)
  })

  it('updates totals after a record is removed', () => {
    const start = new Date(2026, 9, 15, 9).getTime()
    const sessions = [record('a', 'Read', start, start + 60000, 60000), record('b', 'Read', start, start + 120000, 120000)]
    expect(statsFor(sessions).focusMs).toBe(180000)
    expect(statsFor(sessions.filter(item => item.id !== 'b')).focusMs).toBe(60000)
  })
})
