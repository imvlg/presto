import { ArrowRight, Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react'
import { displayed } from '../lib/timer'
import { formatCompact, formatDuration, modeDurations, modeNames, type LiveSession, type Mode, type Session, type Settings } from '../lib/model'

interface Props {
  draft: string; setDraft: (value: string) => void
  mode: Mode; setMode: (value: Mode) => void
  settings: Settings; updateSettings: (changes: Partial<Settings>) => void
  live: LiveSession | null; completed: Session | null; now: number
  onStart: () => void; onPause: () => void; onResume: () => void
  onBreak: (long: boolean) => void; onFocus: () => void; onContinue: () => void
  onFinish: () => void; onNew: () => void; onHome: () => void; onRate: (rating: number) => void
  onDismissReminder: () => void
}

const modes: { id: Mode; title: string; detail: string }[] = [
  { id: 'short', title: 'Short focus', detail: '25 / 5 MIN' },
  { id: 'balanced', title: 'Balanced', detail: '45 / 10 MIN' },
  { id: 'flow', title: 'Flow', detail: 'OPEN ENDED' },
  { id: 'custom', title: 'Custom', detail: 'SET DURATION' },
]

export function TimerView(props: Props) {
  const { draft, setDraft, mode, setMode, settings, updateSettings, live, completed, now } = props
  const current = live ? displayed(live, now) : null
  const inFocus = live?.phase === 'focusing'
  const inBreak = live?.phase === 'break'
  const isPaused = live?.phase === 'paused'
  const target = inBreak ? (live!.longBreak ? 25 * 60_000 : live!.breakTargetMs) : live?.focusTargetMs ?? 45 * 60_000
  const interval = inBreak ? current!.breakIntervalMs : current?.focusIntervalMs ?? 0
  const timerValue = !live ? modeDurations(mode, settings).focus : (inBreak || live.mode !== 'flow') ? Math.max(0, target - interval) : current!.focusIntervalMs
  const progress = live && target ? Math.min(100, interval / target * 100) : 0
  const reminderMinutes = live?.mode === 'flow' ? settings.flowReminderMinutes : settings.longFocusReminderMinutes
  const reminderDue = Boolean(live && inFocus && reminderMinutes > 0 && current!.focusIntervalMs >= reminderMinutes * 60_000 &&
    (!live.reminderDismissedAt || now - live.reminderDismissedAt >= 60 * 60_000))
  const phaseLabel = !live ? 'READY' : isPaused ? 'PAUSED' : inBreak ? 'BREAK' : 'FOCUS'

  if (completed) return <div className="screen-content completion-screen">
    <span className="eyebrow">{new Date(completed.endedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
    <h1>Session complete</h1><p className="completion-subtitle"><strong>{completed.activity}</strong> · Saved to history</p>
    <div className="completion-focus"><span>FOCUSED TIME</span><strong>{formatDuration(completed.focusMs, true)}</strong></div>
    <div className={`completion-details ${completed.awayMs ? 'with-away' : ''}`}><div><span>MANUALLY PAUSED</span><strong>{formatCompact(completed.pausedMs)}</strong></div><div><span>SCHEDULED BREAK</span><strong>{formatCompact(completed.breakMs)}</strong></div>{Boolean(completed.awayMs) && <div><span>AWAY / UNTRACKED</span><strong>{formatCompact(completed.awayMs ?? 0)}</strong></div>}<div><span>TOTAL ELAPSED</span><strong>{formatCompact(completed.endedAt - completed.startedAt)}</strong></div></div>
    <div className="rating-area"><span className="eyebrow">FOCUS RATING · OPTIONAL</span><div className="rating-buttons" role="group" aria-label="Optional focus rating">{[1,2,3,4,5].map(rating => <button key={rating} className={completed.rating === rating ? 'rated' : ''} aria-pressed={completed.rating === rating} aria-label={`Rate focus ${rating} out of 5`} onClick={() => props.onRate(rating)}>{rating}</button>)}</div></div>
    <div className="completion-actions"><button className="button primary completion-next" onClick={props.onNew}>Start another session <ArrowRight size={18}/></button><button className="button subtle" onClick={props.onHome}>Return to timer</button></div>
  </div>

  return <div className="screen-content timer-screen">
    <div className="page-heading timer-heading"><div><span className="eyebrow">FOCUS TIMER</span><h1>presto</h1></div></div>
    <div className="timer-layout">
      <div className="timer-main panel">
        <div className="timer-topline"><span className="eyebrow">ACTIVITY</span></div>
        <label className="sr-only" htmlFor="activity-name">What are you doing?</label>
        <input id="activity-name" className="activity-input" placeholder="What are you doing?" value={live ? live.activity : draft} onChange={event => setDraft(event.target.value)} disabled={Boolean(live)} maxLength={80} autoComplete="off" onKeyDown={event => { if (event.key === 'Enter' && !live && draft.trim()) props.onStart() }}/>
        {!live && <><div className="mode-heading"><span className="eyebrow">MODE</span></div><div className="mode-grid">{modes.map(item => <button key={item.id} className={`mode-card ${mode === item.id ? 'selected' : ''}`} onClick={() => setMode(item.id)} aria-pressed={mode === item.id}><strong>{item.title}</strong><small>{item.detail}</small></button>)}</div>{mode === 'custom' && <div className="custom-durations"><label>Focus <input type="number" min="1" max="240" value={settings.customFocusMinutes} onChange={event => updateSettings({ customFocusMinutes: Number(event.target.value) })}/> min</label><label>Break <input type="number" min="1" max="90" value={settings.customBreakMinutes} onChange={event => updateSettings({ customBreakMinutes: Number(event.target.value) })}/> min</label></div>}</>}
        <div className={`timer-stage ${live ? 'is-live' : ''} ${inBreak ? 'is-break' : ''}`}>
          <div className="timer-stage-header"><span className="phase-indicator" aria-live="polite"><i/>{phaseLabel}</span><span className="timer-index">{modeNames[live?.mode ?? mode].toUpperCase()}</span></div>
          <div className="timer-numbers" aria-live="off">{formatDuration(timerValue, live?.mode === 'flow' || timerValue >= 60 * 60_000)}</div>
          <div className="timer-stage-footer"><span>{live?.mode === 'flow' ? 'ELAPSED' : inBreak ? 'BREAK REMAINING' : 'FOCUS REMAINING'}</span>{live && <span>{formatCompact(current!.focusMs)} FOCUSED</span>}</div>
          <div className="progress-track" role="progressbar" aria-label={`${inBreak ? 'Break' : 'Focus'} interval progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div style={{ width: `${progress}%` }}/></div>
        </div>
        {live && current?.focusDue && <div className="event-card"><span className="eyebrow">FOCUS INTERVAL COMPLETE</span><h3>Focus interval complete</h3><div className="event-actions"><button className="button primary" onClick={() => props.onBreak(live.cycles + 1 >= 4)}>Begin {live.cycles + 1 >= 4 ? 'long' : ''} break</button><button className="button subtle" onClick={props.onContinue}>Continue focus</button></div></div>}
        {live && current?.breakDue && <div className="event-card"><span className="eyebrow">BREAK INTERVAL COMPLETE</span><h3>Break complete</h3><div className="event-actions"><button className="button primary" onClick={props.onFocus}>Begin focus</button><button className="button subtle" onClick={props.onFinish}>Finish session</button></div></div>}
        {reminderDue && !current?.focusDue && <div className="reminder-card"><div><span className="eyebrow">BREAK REMINDER</span><p>Consider taking a break.</p></div><button className="text-button" onClick={props.onDismissReminder}>Dismiss</button></div>}
    <div className="timer-controls">{!live ? <button className="button primary start-button" onClick={props.onStart} disabled={!draft.trim()}><Play size={18} fill="currentColor"/> Start <ArrowRight size={18}/></button> : <>{isPaused ? <button className="button primary" onClick={props.onResume}><Play size={17} fill="currentColor"/> Resume</button> : <button className="button primary" onClick={props.onPause}><Pause size={17} fill="currentColor"/> Pause</button>}{inBreak ? <button className="button subtle" onClick={props.onFocus}><SkipForward size={17}/> Start focus</button> : <button className="button subtle" onClick={() => props.onBreak(live.cycles + 1 >= 4)}><RotateCcw size={16}/> Take a break</button>}<button className="button finish-button" onClick={props.onFinish}><Square size={14} fill="currentColor"/> Finish</button></>}</div>
      </div>
      <aside className="timer-aside"><div className="aside-title"><span className="eyebrow">SESSION</span></div><div className="live-metrics"><div><span>FOCUSED</span><strong>{formatCompact(current?.focusMs ?? 0)}</strong></div><div><span>PAUSED</span><strong>{formatCompact(current?.pausedMs ?? 0)}</strong></div><div><span>BREAK</span><strong>{formatCompact(current?.breakMs ?? 0)}</strong></div>{Boolean(live?.awayMs) && <div><span>AWAY / UNTRACKED</span><strong>{formatCompact(live?.awayMs ?? 0)}</strong></div>}<div><span>ELAPSED</span><strong>{formatCompact(live ? now - live.startedAt : 0)}</strong></div></div></aside>
    </div>
  </div>
}
