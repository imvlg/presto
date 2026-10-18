import { useState } from 'react'
import { ChevronDown, Trash2 } from 'lucide-react'
import { formatCompact, modeNames, type Session } from '../lib/model'

interface Props { sessions: Session[]; onDelete: (id: string) => Promise<void> }

export function HistoryView({ sessions, onDelete }: Props) {
  const [open, setOpen] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  return <div className="screen-content">
    <div className="panel history-panel"><div className="history-head"><span>ACTIVITY / DATE</span><span>FOCUS</span><span>MODE</span><span></span></div>
      {sessions.length ? sessions.map(item => <div className="history-entry" key={item.id}>
        <button className="history-row" aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}>
          <span className="history-name"><strong>{item.activity}</strong><small>{new Date(item.startedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })} · {new Date(item.startedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</small></span>
          <strong className="history-focus">{formatCompact(item.focusMs)}</strong><span className="history-mode">{modeNames[item.mode]}</span><ChevronDown className={open === item.id ? 'rotated' : ''} size={17}/>
        </button>
        {open === item.id && <div className="history-detail"><div className="history-detail-grid"><div><span>STARTED</span><strong>{new Date(item.startedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</strong></div><div><span>ENDED</span><strong>{new Date(item.endedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</strong></div><div><span>FOCUSED</span><strong>{formatCompact(item.focusMs)}</strong></div><div><span>PAUSED</span><strong>{formatCompact(item.pausedMs)} · {item.pauseCount} {item.pauseCount === 1 ? 'pause' : 'pauses'}</strong></div><div><span>BREAK</span><strong>{formatCompact(item.breakMs)}</strong></div>{Boolean(item.awayMs) && <div><span>AWAY / UNTRACKED</span><strong>{formatCompact(item.awayMs ?? 0)}</strong></div>}<div><span>TOTAL ELAPSED</span><strong>{formatCompact(item.endedAt - item.startedAt)}</strong></div><div><span>STATUS</span><strong>{item.status}</strong></div></div><div className="history-actions">{confirming === item.id ? <><span>Delete this session?</span><button className="text-button danger" onClick={async () => { await onDelete(item.id); setConfirming(null); setOpen(null) }}>Delete</button><button className="text-button" onClick={() => setConfirming(null)}>Cancel</button></> : <button className="text-button danger" onClick={() => setConfirming(item.id)}><Trash2 size={15}/> Delete session</button>}</div></div>}
      </div>) : <div className="history-empty"><h2>No sessions yet</h2><p>Start a timer to record a session.</p></div>}
    </div>
  </div>
}
