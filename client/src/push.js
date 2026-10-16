import api from "./api";

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
    return "serviceWorker" in navigator && "PushManager" in window;
}

export async function enablePush() {
    if (!pushSupported()) throw new Error("المتصفح لا يدعم الإشعارات");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") throw new Error("لم يُسمح بالإشعارات");

    const reg = await navigator.serviceWorker.ready;
    const { data } = await api.get("/push/key");

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
        sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(data.key),
        });
    }

    await api.post("/push/subscribe", sub.toJSON());
    return true;
}

export async function sendTestPush() {
    await api.post("/push/test");
}