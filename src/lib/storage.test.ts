import { describe, expect, it } from 'vitest'
import { validSession } from './storage'

describe('stored records', () => {
  it('rejects negative, impossible, and malformed durations', () => {
    const record = { id: 'a', activity: 'Read', startedAt: 1000, endedAt: 11_000,
      mode: 'flow', focusMs: 8000, pausedMs: 2000, breakMs: 0, pauseCount: 1, status: 'completed' }
    expect(validSession(record)).toBe(true)
    expect(validSession({ ...record, focusMs: -1 })).toBe(false)
    expect(validSession({ ...record, focusMs: 20_000 })).toBe(false)
    expect(validSession({ ...record, segments: [{ start: 0, end: 1000, kind: 'focus' }] })).toBe(false)
  })
})
