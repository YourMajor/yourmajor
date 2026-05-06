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

// When the browser/push service rotates or expires the subscription,
// transparently resubscribe and notify the server so the user keeps
// receiving notifications without having to re-enable manually.
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const oldEndpoint = (event.oldSubscription && event.oldSubscription.endpoint) || null
      try {
        const res = await fetch('/api/push/vapid-public-key')
        if (!res.ok) return
        const vapidKey = (await res.text()).trim()
        if (!vapidKey) return

        const padding = '='.repeat((4 - (vapidKey.length % 4)) % 4)
        const b64 = (vapidKey + padding).replace(/-/g, '+').replace(/_/g, '/')
        const raw = atob(b64)
        const appServerKey = new Uint8Array(raw.length)
        for (let i = 0; i < raw.length; i++) appServerKey[i] = raw.charCodeAt(i)

        const newSub = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey,
        })
        const json = newSub.toJSON()
        if (!oldEndpoint || !json.endpoint || !json.keys || !json.keys.p256dh || !json.keys.auth) return

        await fetch('/api/push/resubscribe', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldEndpoint,
            endpoint: json.endpoint,
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          }),
        })
      } catch (err) {
        // Best-effort: client-side reconciliation will retry on next app open.
        console.error('[sw] pushsubscriptionchange resubscribe failed', err)
      }
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
