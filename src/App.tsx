import { useCallback, useEffect, useRef, useState } from 'react'
import { Activity, BarChart3, Clock3, Download, History, Menu, Settings2, Timer, Upload, Volume2, VolumeX, X } from 'lucide-react'
import { ActivityView } from './components/ActivityView'
import { HistoryView } from './components/HistoryView'
import { MetronomeMark } from './components/MetronomeMark'
import { StatisticsView } from './components/StatisticsView'
import { TimerView } from './components/TimerView'
import { cleanActivity, defaultSettings, normalizeActivity, type LiveSession, type Mode, type Session, type Settings } from './lib/model'
import { beginBreak, beginFocus, continueFocus, createLive, displayed, finish, freezeForRecovery, pause, RECOVERY_GAP_MS, resume } from './lib/timer'
import { deleteSession, exportBackup, importBackup, loadLive, loadSessions, loadSettings, saveLive, saveSession, saveSettings } from './lib/storage'
import { playSound } from './lib/sound'
import './styles.css'

type Screen = 'timer' | 'activity' | 'statistics' | 'history'
const nav: { id: Screen; label: string; icon: typeof Timer }[] = [
  { id: 'timer', label: 'Timer', icon: Timer },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'statistics', label: 'Statistics', icon: BarChart3 },
  { id: 'history', label: 'History', icon: History },
]

export default function App() {
  const [screen, setScreen] = useState<Screen>('timer')
  const [menuOpen, setMenuOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [live, setLive] = useState<LiveSession | null>(null)
  const [recovery, setRecovery] = useState(false)
  const [completed, setCompleted] = useState<Session | null>(null)
  const [draft, setDraft] = useState('')
  const [mode, setMode] = useState<Mode>('balanced')
  const [now, setNow] = useState(Date.now())
  const fileRef = useRef<HTMLInputElement>(null)
  const liveRef = useRef<LiveSession | null>(null)
  const seenRef = useRef(Date.now())
  const dueRef = useRef({ focus: '', break: '' })

  const announce = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 4500) }
  const report = (message: string) => { setError(message); window.setTimeout(() => setError(''), 7000) }

  useEffect(() => {
    Promise.all([loadSessions(), loadSettings(), loadLive()]).then(([records, preferences, active]) => {
      setSessions(records); setSettings(preferences)
      if (active) {
        if (Date.now() - active.lastSeenAt > RECOVERY_GAP_MS) {
          const frozen = freezeForRecovery(active)
          liveRef.current = frozen; setLive(frozen); setRecovery(true)
        } else { liveRef.current = active; setLive(active) }
        seenRef.current = active.lastSeenAt
      }
      setLoaded(true)
    }).catch(() => { report('Local storage could not be opened. Check your browser storage settings and reload.'); setLoaded(true) })
  }, [])

  const commitLive = useCallback((next: LiveSession | null) => {
    liveRef.current = next
    setLive(next)
    void saveLive(next).catch(() => report('The current session could not be saved locally.'))
  }, [])

  useEffect(() => {
    if (!loaded) return
    const interval = window.setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (document.visibilityState !== 'visible' || recovery) return
      seenRef.current = current
      if (liveRef.current) void saveLive({ ...liveRef.current, lastSeenAt: current }).catch(() => report('The current session could not be saved locally.'))
    }, 15_000)
    const clock = window.setInterval(() => { if (document.visibilityState === 'visible') setNow(Date.now()) }, 500)
    const visibility = () => {
      const current = Date.now()
      if (document.visibilityState === 'hidden') {
        seenRef.current = current
        if (liveRef.current && !recovery) void saveLive({ ...liveRef.current, lastSeenAt: current })
      } else {
        if (liveRef.current && !recovery && current - seenRef.current > RECOVERY_GAP_MS) {
          const frozen = freezeForRecovery({ ...liveRef.current, lastSeenAt: seenRef.current })
          liveRef.current = frozen; setLive(frozen); setRecovery(true)
        }
        setNow(current)
      }
    }
    document.addEventListener('visibilitychange', visibility)
    return () => { window.clearInterval(interval); window.clearInterval(clock); document.removeEventListener('visibilitychange', visibility) }
  }, [loaded, recovery])

  useEffect(() => {
    if (!live || recovery) return
    const view = displayed(live, now)
    const focusKey = `${live.id}:${live.focusIntervalStartMs}`
    const breakKey = `${live.id}:${live.breakIntervalStartMs}`
    if (view.focusDue && dueRef.current.focus !== focusKey) { playSound('focusDone', settings); dueRef.current.focus = focusKey }
    if (view.breakDue && dueRef.current.break !== breakKey) { playSound('breakDone', settings); dueRef.current.break = breakKey }
  }, [live, now, recovery, settings])

  const updateSettings = (changes: Partial<Settings>) => {
    const next = { ...settings, ...changes }
    next.customFocusMinutes = Math.min(240, Math.max(1, Math.round(next.customFocusMinutes || 1)))
    next.customBreakMinutes = Math.min(90, Math.max(1, Math.round(next.customBreakMinutes || 1)))
    next.flowReminderMinutes = Math.min(240, Math.max(0, Math.round(next.flowReminderMinutes || 0)))
    next.longFocusReminderMinutes = Math.min(480, Math.max(0, Math.round(next.longFocusReminderMinutes || 0)))
    setSettings(next)
    void saveSettings(next).catch(() => report('Settings could not be saved.'))
  }

  const start = () => {
    if (liveRef.current || !cleanActivity(draft)) return
    const next = createLive(draft, mode, settings)
    commitLive(next)
    seenRef.current = Date.now()
    playSound('start', settings)
  }
  const handleFinish = async (at = Date.now()) => {
    const current = liveRef.current
    if (!current) return
    const record = finish(current, at)
    try {
      await saveSession(record)
      setSessions(previous => [record, ...previous.filter(item => item.id !== record.id)].sort((a, b) => b.startedAt - a.startedAt))
      commitLive(null); setRecovery(false); setCompleted(record); setScreen('timer')
      playSound('finish', settings)
    } catch { report('This session could not be saved. Please try again.') }
  }
  const rename = async (oldName: string, newName: string) => {
    const clean = cleanActivity(newName)
    if (!clean) return
    const changed = sessions.filter(item => normalizeActivity(item.activity) === normalizeActivity(oldName)).map(item => ({ ...item, activity: clean }))
    try {
      for (const item of changed) await saveSession(item)
      setSessions(previous => previous.map(item => normalizeActivity(item.activity) === normalizeActivity(oldName) ? { ...item, activity: clean } : item))
      if (liveRef.current && normalizeActivity(liveRef.current.activity) === normalizeActivity(oldName)) commitLive({ ...liveRef.current, activity: clean })
      announce('Activity name updated.')
    } catch { report('Activity could not be renamed.') }
  }
  const remove = async (id: string) => {
    try { await deleteSession(id); setSessions(previous => previous.filter(item => item.id !== id)); announce('Session deleted.') }
    catch { report('Session could not be deleted.') }
  }
  const importFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const result = await importBackup(file, sessions)
      setSessions(result.sessions); announce(`${result.added} ${result.added === 1 ? 'session' : 'sessions'} imported.`)
    } catch (cause) { report(cause instanceof Error ? cause.message : 'Import failed.') }
    if (fileRef.current) fileRef.current.value = ''
  }
  const chooseScreen = (next: Screen) => { setScreen(next); setMenuOpen(false); setSettingsOpen(false) }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setSettingsOpen(false); setMenuOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!loaded) return <div className="loading-screen"><span className="brand-mark">P</span><span>OPENING PRESTO</span></div>

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'mobile-open' : ''}`}>
      <div className="brand"><MetronomeMark/><strong>presto</strong></div>
      <nav aria-label="Main navigation">{nav.map(item => { const Icon = item.icon; return <button key={item.id} className={`nav-link ${screen === item.id ? 'active' : ''}`} onClick={() => chooseScreen(item.id)}><Icon size={18}/><span>{item.label}</span></button> })}</nav>
      <div className="sidebar-bottom"><button className="settings-link" onClick={() => { setSettingsOpen(true); setMenuOpen(false) }}><Settings2 size={18}/> Settings</button></div>
    </aside>
    {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)}/>}
    <div className="workspace"><header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMenuOpen(true)}><Menu size={22}/></button><div className="topbar-right"><span className="topbar-clock"><Clock3 size={14}/> {new Date(now).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span><button className="topbar-settings icon-button" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><Settings2 size={18}/></button></div></header>
      <main>{screen === 'timer' && <TimerView draft={draft} setDraft={setDraft} mode={mode} setMode={setMode} settings={settings} updateSettings={updateSettings} live={live} completed={completed} now={now} onStart={start} onPause={() => live && commitLive(pause(live))} onResume={() => live && commitLive(resume(live))} onBreak={long => live && commitLive(beginBreak(live, Date.now(), long))} onFocus={() => live && commitLive(beginFocus(live))} onContinue={() => live && commitLive(continueFocus(live))} onFinish={() => void handleFinish()} onNew={() => { setDraft(completed?.activity ?? ''); setCompleted(null) }} onHome={() => { setCompleted(null); setDraft('') }} onDismissReminder={() => live && commitLive({ ...live, reminderDismissedAt: Date.now() })}/>}
        {screen === 'activity' && <ActivityView sessions={sessions} onRename={rename}/>}
        {screen === 'statistics' && <StatisticsView sessions={sessions}/>}
        {screen === 'history' && <HistoryView sessions={sessions} onDelete={remove}/>}</main>
    </div>
    {settingsOpen && <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false) }}><section className="settings-drawer" role="dialog" aria-modal="true" aria-labelledby="settings-title"><div className="drawer-head"><span className="eyebrow">PREFERENCES</span><button className="icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}><X size={20}/></button></div><h2 id="settings-title">Settings</h2><p>Saved on this device.</p>
      <div className="setting-group"><span className="eyebrow">SOUND</span><label className="toggle-row"><span>{settings.soundEnabled ? <Volume2 size={19}/> : <VolumeX size={19}/>} Session sounds</span><input type="checkbox" checked={settings.soundEnabled} onChange={event => updateSettings({ soundEnabled: event.target.checked })}/></label><label className="range-label">Volume <span>{Math.round(settings.volume * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={settings.volume} disabled={!settings.soundEnabled} onChange={event => updateSettings({ volume: Number(event.target.value) })}/></label></div>
      <div className="setting-group"><span className="eyebrow">GENTLE REMINDERS</span><label className="number-setting">Flow reminder <span><input type="number" min="0" max="240" value={settings.flowReminderMinutes} onChange={event => updateSettings({ flowReminderMinutes: Number(event.target.value) })}/> min</span></label><label className="number-setting">Long focus reminder <span><input type="number" min="0" max="480" value={settings.longFocusReminderMinutes} onChange={event => updateSettings({ longFocusReminderMinutes: Number(event.target.value) })}/> min</span></label><small>Set to 0 to turn a reminder off.</small></div>
      <div className="setting-group"><span className="eyebrow">YOUR DATA</span><button className="data-action" onClick={() => void exportBackup(sessions)}><Download size={18}/> Export JSON backup <span>↗</span></button><button className="data-action" onClick={() => fileRef.current?.click()}><Upload size={18}/> Import JSON backup <span>↗</span></button><input ref={fileRef} type="file" accept=".json,application/json" className="sr-only" onChange={event => void importFile(event.target.files?.[0])}/><small>Import adds sessions with new IDs and skips duplicates.</small></div>
      </section></div>}
    {recovery && live && <div className="modal-backdrop"><section className="recovery-modal" role="alertdialog" aria-modal="true" aria-labelledby="recovery-title"><span className="eyebrow">SESSION RECOVERY</span><h2 id="recovery-title">Welcome back.</h2><p>Your session was away for a while. We stopped counting at the last time Presto was active, so no extra focus time was added.</p><div className="recovery-summary"><strong>{live.activity}</strong><span>{new Date(live.lastSeenAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · last active</span></div><button className="button primary" onClick={() => { const current = Date.now(); const next = { ...live, phaseStartedAt: current, lastSeenAt: current, awayMs: live.awayMs + Math.max(0, current - live.phaseStartedAt) }; setRecovery(false); commitLive(next); seenRef.current = current }}>Resume from here</button><button className="button subtle" onClick={() => void handleFinish(live.phaseStartedAt)}>Finish at last active time</button><button className="text-button danger" onClick={() => { commitLive(null); setRecovery(false); announce('Interrupted session discarded.') }}>Discard session</button></section></div>}
    {(error || toast) && <div className={`toast ${error ? 'error-toast' : ''}`} role="status">{error || toast}</div>}
  </div>
}
