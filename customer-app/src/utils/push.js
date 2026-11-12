import { api } from '../constants/api'

/*
 * "Tell me when it's ready": a browser push (public/sw.js) when the vendor
 * serves or cancels the order, so the customer can close the page or lock
 * the phone while they wait. Works in Chrome/Firefox on Android and desktop;
 * on iPhone only from a home-screen app (iOS 16.4+), so iOS tabs never see
 * the button.
 */
export const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const pushPermission = () => (pushSupported() ? Notification.permission : 'unsupported')

// The server's VAPID key, base64url, as the bytes subscribe() wants.
function keyBytes(base64) {
  const raw = atob((base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

/**
 * Subscribes this browser and links it to [orderId]. Asks for permission
 * when it hasn't been given (call it from a tap). Resolves true when the
 * order will notify, false when the customer said no or pushes are off.
 */
export async function enablePush(orderId) {
  if (!pushSupported()) return false
  const permission = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission
  if (permission !== 'granted') return false

  const { publicKey } = await api('/orders/push-key')
  if (!publicKey) return false
  const registration = await navigator.serviceWorker.register('/sw.js')
  await navigator.serviceWorker.ready
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }))
  await api(`/orders/push-subscribe/${orderId}`, { method: 'POST', body: { subscription: subscription.toJSON() } })
  return true
}
