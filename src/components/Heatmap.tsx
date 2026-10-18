import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDailyTotals, dayOffset } from '../lib/stats'
import { formatCompact, type Session } from '../lib/model'

interface Props { sessions: Session[]; activity?: string }

export function Heatmap({ sessions, activity }: Props) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [selected, setSelected] = useState<string | null>(null)
  const totals = useMemo(() => addDailyTotals(sessions, activity), [sessions, activity])
  const first = `${year}-01-01`
  const offset = new Date(year, 0, 1).getDay()
  const mondayOffset = (offset + 6) % 7
  const start = dayOffset(first, -mondayOffset)
  const last = `${year}-12-31`
  const finalOffset = (7 - ((new Date(year, 11, 31).getDay() + 6) % 7) - 1) % 7
  const end = dayOffset(last, finalOffset)
  const cells: string[] = []
  for (let day = start; day <= end; day = dayOffset(day, 1)) cells.push(day)
  const weeks = Math.ceil(cells.length / 7)
  const months = Array.from({ length: 12 }, (_, index) => ({
    name: new Date(year, index, 1).toLocaleDateString(undefined, { month: 'short' }),
    column: Math.floor((cells.indexOf(`${year}-${String(index + 1).padStart(2, '0')}-01`)) / 7) + 1,
  }))
  const yearTotal = cells.reduce((sum, day) => day.startsWith(`${year}-`) ? sum + (totals.get(day) ?? 0) : sum, 0)
  const selectedTotal = selected ? (totals.get(selected) ?? 0) : 0

  return <div className="heatmap-wrap">
    <div className="heatmap-heading">
      <div><span className="eyebrow">FOCUS MAP</span><h3>{formatCompact(yearTotal)} recorded</h3></div>
      <div className="heatmap-year-controls">
        <button className="icon-button" aria-label="Previous year" onClick={() => setYear(year - 1)}><ChevronLeft size={17}/></button>
        <span>{year}</span>
        <button className="icon-button" aria-label="Next year" disabled={year >= new Date().getFullYear()} onClick={() => setYear(year + 1)}><ChevronRight size={17}/></button>
      </div>
    </div>
    <div className="heatmap-scroll">
      <div className="heatmap-inner" style={{ width: `calc(${weeks} * var(--heat-cell) + ${weeks - 1} * var(--heat-gap) + 28px)` }}>
        <div className="month-labels" style={{ gridTemplateColumns: `28px repeat(${weeks}, var(--heat-cell))`, columnGap: 'var(--heat-gap)' }}>
          {months.map(month => <span key={month.name} style={{ gridColumn: month.column + 1 }}>{month.name}</span>)}
        </div>
        <div className="heatmap-body">
          <div className="weekday-labels"><span>Mon</span><span>Wed</span><span>Fri</span></div>
          <div className="heatmap-grid" style={{ gridTemplateRows: 'repeat(7, var(--heat-cell))', gridTemplateColumns: `repeat(${weeks}, var(--heat-cell))` }}>
            {cells.map(day => {
              const value = totals.get(day) ?? 0
              const level = value === 0 ? 0 : value < 30 * 60_000 ? 1 : value < 90 * 60_000 ? 2 : value < 180 * 60_000 ? 3 : 4
              return <button key={day} className={`heat-cell level-${level}${day.startsWith(`${year}-`) ? '' : ' outside'}${selected === day ? ' selected' : ''}`}
                aria-label={`${day}: ${value ? formatCompact(value) : 'no recorded focus'}`}
                title={`${new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'full' })} · ${value ? formatCompact(value) : 'No recorded focus'}`}
                onClick={() => setSelected(day)} />
            })}
          </div>
        </div>
      </div>
    </div>
    <div className="heatmap-footer">
      <span>{selected ? `${new Date(`${selected}T12:00:00`).toLocaleDateString(undefined, { dateStyle: 'medium' })} · ${selectedTotal ? formatCompact(selectedTotal) : 'No recorded focus'}` : 'Select a day to inspect it'}</span>
      <div className="heatmap-legend"><span>Less</span>{[0,1,2,3,4].map(level => <i key={level} className={`heat-cell level-${level}`}/>)}<span>More</span></div>
    </div>
  </div>
}
