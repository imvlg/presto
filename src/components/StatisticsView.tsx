import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { activityTotals, periodBounds, sessionsInPeriod, statsFor, trendBuckets, type Period } from '../lib/stats'
import { formatCompact, type Session } from '../lib/model'

interface Props { sessions: Session[] }
const colors = ['#b8f27d', '#79c9b2', '#e8ae6a', '#8ea7ee', '#d995aa', '#8bc3df']

function shift(anchor: Date, period: Period, amount: number) {
  const date = new Date(anchor)
  if (period === 'day') date.setDate(date.getDate() + amount)
  if (period === 'week') date.setDate(date.getDate() + amount * 7)
  if (period === 'month') date.setMonth(date.getMonth() + amount)
  return date
}

export function StatisticsView({ sessions }: Props) {
  const [period, setPeriod] = useState<Period>('week')
  const [anchor, setAnchor] = useState(new Date())
  const scoped = useMemo(() => sessionsInPeriod(sessions, period, anchor), [sessions, period, anchor])
  const summary = useMemo(() => statsFor(scoped), [scoped])
  const activities = useMemo(() => activityTotals(scoped).filter(item => item.focusMs > 0), [scoped])
  const trend = useMemo(() => trendBuckets(sessions, period, anchor), [sessions, period, anchor])
  const max = Math.max(1, ...trend.map(item => item.focusMs))
  const [start, end] = periodBounds(period, anchor)
  const label = period === 'day' ? new Date(start).toLocaleDateString(undefined, { dateStyle: 'long' })
    : `${new Date(start).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} — ${new Date(end - 1).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`

  return <div className="screen-content">
    <div className="page-heading"><span className="eyebrow">STATISTICS</span></div>
    <div className="stats-toolbar"><div className="segmented" aria-label="Statistics period">{(['day','week','month'] as Period[]).map(option => <button key={option} className={period === option ? 'selected' : ''} onClick={() => { setPeriod(option); setAnchor(new Date()) }}>{option}</button>)}</div><div className="period-nav"><button className="icon-button" aria-label="Previous period" onClick={() => setAnchor(shift(anchor, period, -1))}><ChevronLeft size={18}/></button><span>{label}</span><button className="icon-button" aria-label="Next period" disabled={periodBounds(period, shift(anchor, period, 1))[0] > Date.now()} onClick={() => setAnchor(shift(anchor, period, 1))}><ChevronRight size={18}/></button></div></div>
    <div className="stat-cards">
      <Metric label="FOCUSED" value={formatCompact(summary.focusMs)} prominent />
      <Metric label="MANUALLY PAUSED" value={formatCompact(summary.pausedMs)} />
      <Metric label="SCHEDULED BREAKS" value={formatCompact(summary.breakMs)} />
      <Metric label="COMPLETED SESSIONS" value={String(summary.count)} />
    </div>
    <div className="stats-grid">
      <div className="panel trend-panel"><div className="section-title"><div><span className="eyebrow">FOCUS OVER TIME</span><h2>{period === 'day' ? 'By hour' : period === 'week' ? 'This week' : 'By day'}</h2></div></div><div className={`trend-chart ${period === 'month' ? 'month-chart' : ''}`} role="img" aria-label="Focus time by period"><div className="trend-bars">{trend.map((item, index) => <div className="trend-column" key={`${item.label}-${index}`}><div className="trend-track"><div className="trend-bar" title={`${item.label}: ${formatCompact(item.focusMs)}`} style={{ height: `${item.focusMs ? Math.max(5, item.focusMs / max * 100) : 2}%` }}/></div><span>{period === 'month' && index % 5 !== 0 ? '' : item.label}</span></div>)}</div></div></div>
      <div className="panel distribution-panel"><span className="eyebrow">DISTRIBUTION</span><h2>By activity</h2>{activities.length ? <><div className="donut-area"><div className="donut" style={{ background: `conic-gradient(${activities.map((_, index) => `${colors[index % colors.length]} ${(activities.slice(0,index).reduce((sum, part) => sum + part.focusMs, 0) / summary.focusMs * 100).toFixed(2)}% ${((activities.slice(0,index + 1).reduce((sum, part) => sum + part.focusMs, 0)) / summary.focusMs * 100).toFixed(2)}%`).join(', ')})` }}><div><strong>{activities.length}</strong><span>ACTIVITIES</span></div></div></div><div className="distribution-list">{activities.map((item, index) => <div key={item.name}><span><i style={{ background: colors[index % colors.length] }}/>{item.name}</span><strong>{Math.round(item.focusMs / summary.focusMs * 100)}%</strong></div>)}</div></> : <p className="empty-note">No activity data for this period.</p>}</div>
    </div>
    <div className="panel context-panel"><span className="eyebrow">SUMMARY</span><div className="context-metrics"><div><strong>{formatCompact(summary.averageFocusMs)}</strong><span>Average session focus</span></div><div><strong>{Math.round(summary.activeShare * 100)}%</strong><span>Active share of focus + manual pause</span></div></div><p>Percentages use recorded sessions only.</p></div>
  </div>
}

function Metric({ label, value, prominent = false }: { label: string; value: string; prominent?: boolean }) {
  return <div className={`metric-card ${prominent ? 'prominent' : ''}`}><span className="eyebrow">{label}</span><strong>{value}</strong></div>
}
