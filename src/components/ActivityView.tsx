import { useMemo, useState } from 'react'
import { ArrowUpRight, PenLine } from 'lucide-react'
import { Heatmap } from './Heatmap'
import { activityTotals, addDailyTotals, localDay } from '../lib/stats'
import { formatCompact, normalizeActivity, type Session } from '../lib/model'

interface Props { sessions: Session[]; onRename: (oldName: string, newName: string) => Promise<void> }

export function ActivityView({ sessions, onRename }: Props) {
  const groups = useMemo(() => activityTotals(sessions), [sessions])
  const [selected, setSelected] = useState<string | null>(null)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState('')
  const active = groups.find(group => normalizeActivity(group.name) === selected)
  const chosen = active?.name
  const daily = useMemo(() => addDailyTotals(sessions, chosen), [sessions, chosen])
  const trackedDays = [...daily.values()].filter(value => value > 0).length
  const bestDay = Math.max(0, ...daily.values())

  return <div className="screen-content">
    <div className="page-heading"><span className="eyebrow">ACTIVITY</span></div>
    <div className="panel activity-heatmap"><Heatmap sessions={sessions} activity={chosen}/></div>
    <div className="activity-layout">
      <div className="panel activity-list-panel">
        <div className="section-title"><div><span className="eyebrow">ACTIVITIES</span><h2>{groups.length} recorded</h2></div></div>
        <button className={`activity-row ${!active ? 'active' : ''}`} onClick={() => { setSelected(null); setRenaming(false) }}>
          <span className="activity-row-name">All activity</span><span>{formatCompact(sessions.reduce((sum, item) => sum + item.focusMs, 0))}</span><ArrowUpRight size={16}/>
        </button>
        {groups.map((group, index) => <button className={`activity-row ${active && normalizeActivity(group.name) === normalizeActivity(active.name) ? 'active' : ''}`} key={normalizeActivity(group.name)} onClick={() => { setSelected(normalizeActivity(group.name)); setRenaming(false) }}>
          <span className="activity-row-name"><i className={`activity-indicator tone-${index % 5}`}/>{group.name}</span><span>{formatCompact(group.focusMs)}</span><ArrowUpRight size={16}/>
        </button>)}
        {!groups.length && <p className="empty-note">Start a focus session to see your activity patterns here.</p>}
      </div>
      <div className="panel activity-detail-panel">
        <span className="eyebrow">{active ? 'ACTIVITY PROFILE' : 'OVERALL VIEW'}</span>
        <div className="detail-title-row"><h2>{active?.name ?? 'All recorded time'}</h2>{active && <button className="text-button" onClick={() => { setNewName(active.name); setRenaming(!renaming) }}><PenLine size={15}/> Rename</button>}</div>
        {renaming && active && <form className="rename-form" onSubmit={async event => { event.preventDefault(); if (newName.trim()) { await onRename(active.name, newName); setSelected(normalizeActivity(newName)); setRenaming(false) } }}>
          <label htmlFor="rename-activity">New activity name</label><div><input id="rename-activity" value={newName} onChange={event => setNewName(event.target.value)} maxLength={80}/><button className="button button-small" type="submit">Save name</button></div><small>If the name already exists, their histories merge.</small>
        </form>}
        <div className="detail-metrics">
          <div><strong>{formatCompact(active?.focusMs ?? sessions.reduce((sum, item) => sum + item.focusMs, 0))}</strong><span>Focused time</span></div>
          <div><strong>{active?.sessions ?? sessions.length}</strong><span>Sessions</span></div>
          <div><strong>{trackedDays}</strong><span>Active days</span></div>
          <div><strong>{formatCompact(bestDay)}</strong><span>Most in a day</span></div>
        </div>
        <div className="detail-footnote">{daily.get(localDay(Date.now())) ? `Today · ${formatCompact(daily.get(localDay(Date.now())) ?? 0)} recorded` : 'No focus recorded today.'}</div>
      </div>
    </div>
  </div>
}
