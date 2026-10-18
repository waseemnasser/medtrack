import api from "./api";

function urlBase64ToUint8Array(base64String) {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const raw = window.atob(base64);
    return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

// هل اشتراك المتصفح الحالي مبني على نفس مفتاح الخادم؟
// إن تغيّرت مفاتيح VAPID في الخادم يصير الاشتراك القديم بلا فائدة
function sameKey(sub, key) {
    const current = sub.options?.applicationServerKey;
    if (!current) return true; // متصفح لا يكشف المفتاح — نفترض أنه سليم
    const a = new Uint8Array(current);
    return a.length === key.length && a.every((v, i) => v === key[i]);
}

export function pushSupported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// «granted» | «denied» | «default»
export function pushPermission() {
    return pushSupported() ? Notification.permission : "denied";
}

// اشتراك صالح مسجَّل في الخادم باسم المستخدم الحالي
async function ensureSubscription() {
    const reg = await navigator.serviceWorker.ready;
    const { data } = await api.get("/push/key");
    const key = urlBase64ToUint8Array(data.key);

    let sub = await reg.pushManager.getSubscription();
    if (sub && !sameKey(sub, key)) {
        await sub.unsubscribe();
        sub = null;
    }
    if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }

    // يربط هذا الجهاز بالحساب المسجَّل الآن — حتى لو كان مربوطاً بحساب آخر قبل ذلك
    await api.post("/push/subscribe", sub.toJSON());
    return sub;
}

export async function enablePush() {
    if (!pushSupported()) throw new Error("هذا المتصفح لا يدعم الإشعارات");

    const permission = await Notification.requestPermission();
    if (permission === "denied") {
        throw new Error("الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (رمز القفل بجانب الرابط) ثم أعد المحاولة.");
    }
    if (permission !== "granted") throw new Error("لم يُسمح بالإشعارات");

    await ensureSubscription();
    return true;
}

/**
 * يُستدعى عند فتح التطبيق: إن كان الجهاز مشتركاً من قبل نعيد ربطه
 * بالحساب الحالي. يُرجع true إن كانت الإشعارات تعمل على هذا الجهاز.
 */
export async function syncPush() {
    if (!pushSupported() || Notification.permission !== "granted") return false;
    const reg = await navigator.serviceWorker.ready;
    if (!(await reg.pushManager.getSubscription())) return false;
    await ensureSubscription();
    return true;
}

// عند تسجيل الخروج: هذا الجهاز لا يستقبل تذكيرات هذا الحساب بعد الآن
export async function disablePushForThisDevice() {
    if (!pushSupported()) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const sub = await reg?.pushManager.getSubscription();
    if (!sub) return;
    try {
        await api.post("/push/unsubscribe", { endpoint: sub.endpoint });
    } finally {
        await sub.unsubscribe();
    }
}

export async function sendTestPush() {
    const { data } = await api.post("/push/test");
    return data;
}
