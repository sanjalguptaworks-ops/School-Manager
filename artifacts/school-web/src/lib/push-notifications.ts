const BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && !!VAPID_PUBLIC_KEY;
}

function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), "=");
  const base64 = padded.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const array = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) array[i] = raw.charCodeAt(i);
  return array;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  try {
    return await navigator.serviceWorker.register(`${basePath}/sw.js`);
  } catch {
    return null;
  }
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isPushSupported()) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY as string) as BufferSource,
  });

  const json = subscription.toJSON();
  const res = await fetch(`${BASE_URL}/api/push-subscriptions`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      p256dhKey: json.keys?.p256dh,
      authKey: json.keys?.auth,
    }),
  });
  return res.ok;
}
