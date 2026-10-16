import { describe, expect, it } from 'vitest'
import { defaultSettings } from './model'
import { beginBreak, beginFocus, createLive, displayed, finish, freezeForRecovery, pause, resume, settle } from './timer'

describe('timer accounting', () => {
  it('keeps pause time out of the focus target and active share', () => {
    let live = createLive('Reading', 'balanced', defaultSettings, 0)
    live = pause(live, 20 * 60_000)
    live = resume(live, 35 * 60_000)
    const view = displayed(live, 60 * 60_000)
    expect(view.focusMs).toBe(45 * 60_000)
    expect(view.pausedMs).toBe(15 * 60_000)
    expect(view.focusDue).toBe(true)
    expect(view.activeShare).toBe(.75)
    const record = finish(live, 60 * 60_000)
    expect(record.status).toBe('completed')
    expect(record.pauseCount).toBe(1)
    expect(record.endedAt - record.startedAt).toBe(60 * 60_000)
  })

  it('does not count a scheduled break as focused or paused time', () => {
    let live = createLive('Design', 'short', defaultSettings, 1000)
    live = beginBreak(live, 26 * 60_000 + 1000)
    live = beginFocus(live, 31 * 60_000 + 1000)
    const record = finish(live, 36 * 60_000 + 1000)
    expect(record.focusMs).toBe(31 * 60_000)
    expect(record.breakMs).toBe(5 * 60_000)
    expect(record.pausedMs).toBe(0)
    expect(record.segments?.map(part => part.kind)).toEqual(['focus', 'break', 'focus'])
  })

  it('ignores backward clock movement and duplicate pause', () => {
    const live = createLive('Write', 'flow', defaultSettings, 5000)
    const paused = pause(live, 4000)
    expect(paused.focusMs).toBe(0)
    expect(pause(paused, 6000).pauseCount).toBe(1)
    expect(settle(paused, 4000).pausedMs).toBe(0)
  })

  it('freezes a long absence at the last known active time', () => {
    const live = createLive('Reading', 'flow', defaultSettings, 1_000)
    const frozen = freezeForRecovery({ ...live, lastSeenAt: 11_000 })
    expect(frozen.focusMs).toBe(10_000)
    expect(frozen.phaseStartedAt).toBe(11_000)
  })
})
