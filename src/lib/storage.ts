import { cleanActivity, defaultSettings, type LiveSession, type Session, type Settings } from './model'

const DB_NAME = 'presto-data'
const DB_VERSION = 1

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' })
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv')
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function transaction<T>(storeName: 'sessions' | 'kv', mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      const request = run(tx.objectStore(storeName))
      let result: T
      request.onsuccess = () => { result = request.result }
      request.onerror = () => reject(request.error)
      tx.onerror = () => reject(tx.error)
      tx.oncomplete = () => resolve(result)
    })
  } finally {
    db.close()
  }
}

const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0

export function validSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>
  return typeof item.id === 'string' && item.id.length > 0 &&
    typeof item.activity === 'string' && cleanActivity(item.activity).length > 0 &&
    finite(item.startedAt) && finite(item.endedAt) && (item.endedAt as number) >= (item.startedAt as number) &&
    (item.endedAt as number) - (item.startedAt as number) <= 31 * 86_400_000 &&
    ['short', 'balanced', 'flow', 'custom'].includes(String(item.mode)) &&
    finite(item.focusMs) && finite(item.pausedMs) && finite(item.breakMs) && finite(item.pauseCount) && Number.isInteger(item.pauseCount) &&
    (item.awayMs === undefined || finite(item.awayMs)) &&
    (item.focusMs as number) + (item.pausedMs as number) + (item.breakMs as number) + Number(item.awayMs ?? 0) <= (item.endedAt as number) - (item.startedAt as number) + 1000 &&
    ['completed', 'ended early'].includes(String(item.status)) &&
    (item.rating === undefined || (Number.isInteger(item.rating) && Number(item.rating) >= 1 && Number(item.rating) <= 5)) &&
    (item.segments === undefined || (Array.isArray(item.segments) && item.segments.every((segment: unknown) => {
      if (!segment || typeof segment !== 'object') return false
      const part = segment as Record<string, unknown>
      return finite(part.start) && finite(part.end) && (part.end as number) >= (part.start as number) &&
        (part.start as number) >= (item.startedAt as number) && (part.end as number) <= (item.endedAt as number) &&
        ['focus', 'pause', 'break'].includes(String(part.kind))
    })))
}

export async function loadSessions(): Promise<Session[]> {
  const records = await transaction<unknown[]>('sessions', 'readonly', store => store.getAll())
  return records.filter(validSession).sort((a, b) => b.startedAt - a.startedAt)
}

export async function saveSession(session: Session): Promise<void> {
  if (!validSession(session)) throw new Error('Invalid session')
  await transaction('sessions', 'readwrite', store => store.put(session))
}

export async function deleteSession(id: string): Promise<void> {
  await transaction('sessions', 'readwrite', store => store.delete(id))
}

export async function loadSettings(): Promise<Settings> {
  const stored = await transaction<Partial<Settings> | undefined>('kv', 'readonly', store => store.get('settings'))
  const merged = { ...defaultSettings, ...stored }
  return {
    soundEnabled: Boolean(merged.soundEnabled),
    notificationsEnabled: Boolean(merged.notificationsEnabled),
    volume: Number.isFinite(merged.volume) ? Math.min(1, Math.max(0, merged.volume)) : defaultSettings.volume,
    flowReminderMinutes: clampMinutes(merged.flowReminderMinutes, 0, 240),
    longFocusReminderMinutes: clampMinutes(merged.longFocusReminderMinutes, 0, 480),
    customFocusMinutes: clampMinutes(merged.customFocusMinutes, 1, 240),
    customBreakMinutes: clampMinutes(merged.customBreakMinutes, 1, 90),
  }
}

function clampMinutes(value: number, min: number, max: number): number {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : min
}

export async function saveSettings(settings: Settings): Promise<void> {
  await transaction('kv', 'readwrite', store => store.put(settings, 'settings'))
}

export async function loadLive(): Promise<LiveSession | null> {
  const value = await transaction<LiveSession | undefined>('kv', 'readonly', store => store.get('live'))
  if (!value || typeof value.id !== 'string' || !['focusing', 'paused', 'break'].includes(value.phase) ||
      !finite(value.startedAt) || !finite(value.phaseStartedAt) || !finite(value.lastSeenAt) ||
      typeof value.activity !== 'string' || !cleanActivity(value.activity) ||
      !finite(value.focusMs) || !finite(value.pausedMs) || !finite(value.breakMs) ||
      !finite(value.focusTargetMs) || !finite(value.breakTargetMs) ||
      !Array.isArray(value.segments) || value.phaseStartedAt < value.startedAt ||
      value.segments.some(segment => !finite(segment.start) || !finite(segment.end) || segment.end < segment.start ||
        segment.start < value.startedAt || segment.end > value.phaseStartedAt || !['focus', 'pause', 'break'].includes(segment.kind))) return null
  return { ...value, awayMs: finite(value.awayMs) ? value.awayMs : 0 }
}

let liveQueue: Promise<unknown> = Promise.resolve()
export async function saveLive(live: LiveSession | null): Promise<void> {
  const write = () => live
    ? transaction('kv', 'readwrite', store => store.put(live, 'live'))
    : transaction('kv', 'readwrite', store => store.delete('live'))
  liveQueue = liveQueue.then(write, write)
  await liveQueue
}

export async function exportBackup(sessions: Session[]): Promise<void> {
  const payload = JSON.stringify({ format: 'presto-backup', version: 1, exportedAt: new Date().toISOString(), sessions }, null, 2)
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' }))
  link.download = `presto-backup-${new Date().toISOString().slice(0, 10)}.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

export async function importBackup(file: File, existing: Session[]): Promise<{ sessions: Session[], added: number }> {
  const parsed: unknown = JSON.parse(await file.text())
  if (!parsed || typeof parsed !== 'object') throw new Error('This is not a Presto backup.')
  const data = parsed as Record<string, unknown>
  if (data.format !== 'presto-backup' || data.version !== 1 || !Array.isArray(data.sessions)) throw new Error('This is not a supported Presto backup.')
  if (!data.sessions.every(validSession)) throw new Error('The backup contains invalid session records.')
  const known = new Set(existing.map(item => item.id))
  let added = 0
  for (const item of data.sessions as Session[]) {
    if (known.has(item.id)) continue
    await saveSession(item)
    known.add(item.id)
    added++
  }
  return { sessions: await loadSessions(), added }
}
