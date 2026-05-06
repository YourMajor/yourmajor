// YourMajor service worker — handles install prompts (required for Chrome
// installability) and incoming Web Push notifications. Intentionally has no
// caching: the app needs network for live data and the App Store version
// supersedes this stopgap.

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Empty fetch handler — required by some installability heuristics; intentionally pass-through.
self.addEventListener('fetch', () => {})

self.addEventListener('push', (event) => {
  let data = { title: 'YourMajor', body: '', url: '/' }
  if (event.data) {
    try {
      data = { ...data, ...event.data.json() }
    } catch {
      data.body = event.data.text()
    }
  }
  event.waitUntil(
    (async () => {
      // If any app tab is currently visible to the user, the in-app
      // NotificationPopup / chat badge already handles delivery — skip the
      // system banner so we don't double-notify. When all tabs are hidden
      // (different tab focused, browser minimized, screen off, app closed),
      // fall through and show the OS notification.
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      const hasVisibleClient = clients.some((c) => c.visibilityState === 'visible')
      if (hasVisibleClient) return

      const options = {
        body: data.body,
        icon: data.icon || '/icons/icon-192x192.png',
        badge: '/icons/icon-192x192.png',
        data: { url: data.url || '/' },
      }
      await self.registration.showNotification(data.title, options)
    })(),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        const targetUrl = new URL(target, self.location.origin)
        for (const client of clientList) {
          try {
            const url = new URL(client.url)
            if (url.origin === targetUrl.origin && url.pathname === targetUrl.pathname && 'focus' in client) {
              return client.focus()
            }
          } catch {}
        }
        if (self.clients.openWindow) return self.clients.openWindow(target)
      }),
  )
})
