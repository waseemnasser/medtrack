// نسخة التطوير: إشعارات فقط، بلا أي تخزين مؤقت
// التخزين المؤقت يُفعَّل عند النشر النهائي فقط

// عنوان الخادم يأتي من رابط التسجيل (main.jsx: sw.js?api=...) — الـ service
// worker لا يقرأ متغيّرات Vite. احتياطاً: الخادم المحلي.
const API = new URL(self.location.href).searchParams.get("api") || "http://localhost:5000/api";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// كل نوافذ التطبيق المفتوحة
const windows = () => self.clients.matchAll({ type: "window", includeUncontrolled: true });
const tell = (msg) => windows().then((list) => list.forEach((c) => c.postMessage(msg)));

self.addEventListener("push", (event) => {
    let data = { title: "نبض", body: "لديك تذكير" };
    try { data = event.data.json(); } catch { /* رسالة بلا JSON — نعرض النص الافتراضي */ }

    event.waitUntil(Promise.all([
        // التطبيق مفتوح؟ نخبره فيرنّ الجرس ويتحدّث العدد فوراً
        tell({ type: "notification", id: data.id, kind: data.kind }),
        self.registration.showNotification(data.title, {
            body: data.body,
            // مسارات نسبية إلى مكان sw.js — تعمل على الجذر وعلى /medtrack/
            icon: "icon-192.png",
            badge: "icon-192.png",
            dir: "rtl",
            lang: "ar",
            requireInteraction: true,
            // تذكير الجرعة: زر «تم الأخذ» (كروم وإيدج؛ فايرفوكس وسفاري لا تعرض الأزرار)
            actions: data.actions || [],
            data: { url: data.url || "/", id: data.id, token: data.action_token },
        }),
    ]));
});

// زر «تم الأخذ»: يؤكّد الجرعة دون فتح التطبيق
async function confirmFromNotification(n) {
    try {
        const res = await fetch(`${API}/doses/confirm-action`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: n.data.token, notification_id: n.data.id }),
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error || "");
        }
        // التطبيق مفتوح؟ تتحدّث صفحة «اليوم» والجرس فوراً
        await tell({ type: "dose-confirmed" });
    } catch (err) {
        // لا نصمت: من ضغط الزر يظن أن الجرعة سُجّلت
        await self.registration.showNotification("لم تُسجَّل الجرعة", {
            // TypeError = لا اتصال (نصّه إنجليزي من المتصفح)، وإلا فرسالة الخادم العربية
            body: (!(err instanceof TypeError) && err.message) || "تعذّر الاتصال بالخادم. افتح التطبيق وأكّد الجرعة من هناك.",
            icon: "icon-192.png",
            badge: "icon-192.png",
            dir: "rtl",
            lang: "ar",
            data: { url: "/" },
        });
    }
}

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    if (event.action === "taken" && event.notification.data?.token) {
        event.waitUntil(confirmFromNotification(event.notification));
        return;
    }
    // «/members/3» ← نسبةً إلى نطاق التطبيق، لا إلى جذر النطاق
    const path = (event.notification.data?.url || "/").replace(/^\//, "");
    const url = new URL(path, self.registration.scope);
    // رقم الإشعار في الرابط: التطبيق يعلّمه «مقروءاً» عند الفتح (NotificationBell)
    if (event.notification.data?.id) url.searchParams.set("n", event.notification.data.id);
    const target = url.href;
    event.waitUntil(
        windows().then((list) => {
            for (const c of list) {
                if ("focus" in c) { c.navigate(target); return c.focus(); }
            }
            return self.clients.openWindow(target);
        })
    );
});
