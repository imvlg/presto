import type { Settings } from './model'

type Cue = 'start' | 'focusDone' | 'breakDone' | 'finish'
let context: AudioContext | null = null

export function playSound(cue: Cue, settings: Settings) {
  if (!settings.soundEnabled || settings.volume <= 0) return
  try {
    context ??= new AudioContext()
    if (context.state === 'suspended') void context.resume()
    const now = context.currentTime
    const notes: Record<Cue, number[]> = {
      start: [392, 523], focusDone: [523, 659, 784], breakDone: [392, 523, 659], finish: [659, 523],
    }
    notes[cue].forEach((frequency, index) => {
      const oscillator = context!.createOscillator()
      const gain = context!.createGain()
      const start = now + index * 0.12
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, settings.volume * 0.055), start + 0.018)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.38)
      oscillator.connect(gain).connect(context!.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.4)
    })
  } catch {
    // Audio is best effort, especially on locked mobile devices.
  }
}
