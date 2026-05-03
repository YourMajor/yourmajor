'use client'

import { useEffect, useState, useTransition } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  subscribePush,
  unsubscribePush,
  updatePushPreferences,
} from '@/app/(main)/profile/actions'

type Props = {
  vapidPublicKey: string | null
  initialPrefs: { notifyChatMessages: boolean; notifyAdminAnnouncements: boolean }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const buffer = new ArrayBuffer(raw.length)
  const view = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i)
  return view
}

export function PushNotificationManager({ vapidPublicKey, initialPrefs }: Props) {
  const [supported, setSupported] = useState(false)
  const [iosNotInstalled, setIosNotInstalled] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [chatOn, setChatOn] = useState(initialPrefs.notifyChatMessages)
  const [adminOn, setAdminOn] = useState(initialPrefs.notifyAdminAnnouncements)
  const [busy, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const ok = 'serviceWorker' in navigator && 'PushManager' in window

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      ('standalone' in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true)

    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream

    // Hydration-only flags: detected environment, set once after mount.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSupported(ok)
    setIosNotInstalled(ios && !standalone)
    /* eslint-enable react-hooks/set-state-in-effect */

    if (!ok) return
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {})
  }, [])

  const handleSubscribe = () => {
    setError(null)
    if (!vapidPublicKey) {
      setError('Push notifications are not configured on the server yet.')
      return
    }
    startTransition(async () => {
      try {
        const perm = await Notification.requestPermission()
        if (perm !== 'granted') {
          setError('Notification permission was not granted.')
          return
        }
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
        })
        const json = sub.toJSON()
        const endpoint = json.endpoint
        const p256dh = json.keys?.p256dh
        const auth = json.keys?.auth
        if (!endpoint || !p256dh || !auth) {
          setError('Push subscription is missing required fields.')
          await sub.unsubscribe().catch(() => {})
          return
        }
        const result = await subscribePush({
          endpoint,
          p256dh,
          auth,
          userAgent: navigator.userAgent,
        })
        if (!result.ok) {
          setError(result.error ?? 'Failed to save subscription.')
          await sub.unsubscribe().catch(() => {})
          return
        }
        setSubscribed(true)
      } catch (err) {
        console.error(err)
        setError('Could not subscribe to push notifications.')
      }
    })
  }

  const handleUnsubscribe = () => {
    setError(null)
    startTransition(async () => {
      try {
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await unsubscribePush(sub.endpoint)
          await sub.unsubscribe()
        }
        setSubscribed(false)
      } catch (err) {
        console.error(err)
        setError('Could not unsubscribe.')
      }
    })
  }

  const togglePref = (key: 'chat' | 'admin', value: boolean) => {
    if (key === 'chat') setChatOn(value)
    else setAdminOn(value)
    startTransition(async () => {
      const result = await updatePushPreferences({
        notifyChatMessages: key === 'chat' ? value : chatOn,
        notifyAdminAnnouncements: key === 'admin' ? value : adminOn,
      })
      if (!result.ok) {
        setError(result.error ?? 'Could not update preferences.')
        if (key === 'chat') setChatOn(!value)
        else setAdminOn(!value)
      }
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Bell className="w-4 h-4" /> Notifications
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!supported && (
          <p className="text-xs text-muted-foreground">
            This browser does not support push notifications.
          </p>
        )}

        {supported && iosNotInstalled && (
          <p className="text-xs text-muted-foreground">
            On iPhone, push notifications work only after you install the app to your home screen
            (Share → Add to Home Screen). Open YourMajor from the home screen and return here to
            subscribe.
          </p>
        )}

        {supported && !iosNotInstalled && (
          subscribed ? (
            <Button onClick={handleUnsubscribe} disabled={busy} variant="outline" className="w-full">
              <BellOff className="w-4 h-4 mr-2" /> Disable on this device
            </Button>
          ) : (
            <Button onClick={handleSubscribe} disabled={busy} className="w-full">
              <Bell className="w-4 h-4 mr-2" /> Enable push notifications
            </Button>
          )
        )}

        <Separator />

        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Notify me about
          </p>
          <div className="flex items-center justify-between">
            <span className="text-sm">Chat messages</span>
            <Switch
              checked={chatOn}
              disabled={busy || !subscribed}
              onCheckedChange={(v) => togglePref('chat', v)}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Admin announcements</span>
            <Switch
              checked={adminOn}
              disabled={busy || !subscribed}
              onCheckedChange={(v) => togglePref('admin', v)}
            />
          </div>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
      </CardContent>
    </Card>
  )
}
