// Service Worker — نسخة أساسية تجعل التطبيق قابلاً للتثبيت
const CACHE = "dawai-v1";
const SHELL = ["/", "/icon-192.png", "/icon-512.png", "/manifest.json"];

self.addEventListener("install", (e) => {
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
    self.skipWaiting();
});

self.addEventListener("activate", (e) => {
    e.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener("fetch", (e) => {
    const url = new URL(e.request.url);

    // طلبات الـ API لا تُخزَّن أبداً — بيانات طبية يجب أن تكون حيّة
    if (url.pathname.startsWith("/api") || url.port === "5000") return;
    if (e.request.method !== "GET") return;

    e.respondWith(
        fetch(e.request)
            .then((res) => {
                const copy = res.clone();
                caches.open(CACHE).then((c) => c.put(e.request, copy));
                return res;
            })
            .catch(() => caches.match(e.request))
    );
});
self.addEventListener("push", (event) => {
    let data = { title: "دوائي", body: "لديك تذكير" };
    try { data = event.data.json(); } catch (e) { }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            dir: "rtl",
            lang: "ar",
            tag: "dose-reminder",
            requireInteraction: true,
            data: { url: data.url || "/" },
        })
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const target = event.notification.data?.url || "/";

    event.waitUntil(
        self.clients.matchAll({ type: "window", includeUncontrolled: true })
            .then((list) => {
                for (const c of list) {
                    if ("focus" in c) { c.navigate(target); return c.focus(); }
                }
                return self.clients.openWindow(target);
            })
    );
});