// نسخة التطوير: إشعارات فقط، بلا أي تخزين مؤقت
// التخزين المؤقت يُفعَّل عند النشر النهائي فقط

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
    let data = { title: "طمّني", body: "لديك تذكير" };
    try { data = event.data.json(); } catch { /* رسالة بلا JSON — نعرض النص الافتراضي */ }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            // مسارات نسبية إلى مكان sw.js — تعمل على الجذر وعلى /medtrack/
            icon: "icon-192.png",
            badge: "icon-192.png",
            dir: "rtl",
            lang: "ar",
            requireInteraction: true,
            data: { url: data.url || "/" },
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    // «/members/3» ← نسبةً إلى نطاق التطبيق، لا إلى جذر النطاق
    const path = (event.notification.data?.url || "/").replace(/^\//, "");
    const target = new URL(path, self.registration.scope).href;
    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
            for (const c of list) {
                if ("focus" in c) { c.navigate(target); return c.focus(); }
            }
            return self.clients.openWindow(target);
        })
    );
});