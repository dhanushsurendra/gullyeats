// Order notifications (backend utils/webPush.js): shows the push, and a tap
// opens (or focuses) the order's page. Nothing is cached here.
// Take over open tabs at once, so a tap can move them to the order's page.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  const { title = 'GullyEats', body = '', tag, url = '/' } = event.data ? event.data.json() : {}
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      icon: '/logo.svg',
      badge: '/logo.svg',
      data: { url },
      vibrate: [200, 100, 200],
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      // navigate() only works on tabs this worker controls; otherwise open a new one.
      const tab = tabs.find((t) => new URL(t.url).origin === self.location.origin)
      if (tab) return tab.focus().then((t) => (t || tab).navigate(url)).catch(() => self.clients.openWindow(url))
      return self.clients.openWindow(url)
    }),
  )
})
