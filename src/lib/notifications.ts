export function notificationsAvailable(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && 'Notification' in window
}

export async function showSystemNotification(title: string, body: string, tag: string): Promise<void> {
  if (!notificationsAvailable() || Notification.permission !== 'granted') return

  const icon = new URL(`${import.meta.env.BASE_URL}icon-192.png`, document.baseURI).href
  const options: NotificationOptions = { body, icon, tag }

  try {
    const registration = 'serviceWorker' in navigator
      ? await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)
      : undefined
    if (registration?.active) {
      await registration.showNotification(title, options)
      return
    }
    new Notification(title, options)
  } catch {
    // Mobile browsers need the service worker; an unavailable alert must not interrupt the timer.
  }
}
