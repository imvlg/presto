import { ChevronDown, ChevronUp } from 'lucide-react'

interface Props {
  id: string
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
}

export function NumberStepper({ id, label, value, min, max, onChange }: Props) {
  return <div className="number-stepper">
    <input id={id} type="number" inputMode="numeric" min={min} max={max} step="1" value={value} aria-label={label} onChange={event => onChange(Number(event.target.value))}/>
    <div className="stepper-buttons">
      <button type="button" aria-label={`Increase ${label}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><ChevronUp size={14} strokeWidth={2.4}/></button>
      <button type="button" aria-label={`Decrease ${label}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><ChevronDown size={14} strokeWidth={2.4}/></button>
    </div>
  </div>
}
