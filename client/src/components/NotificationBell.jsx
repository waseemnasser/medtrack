import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { Bell, Pill, Calendar, Package, Activity, Check } from "lucide-react";
import { formatDate, formatTime } from "../utils/format";

// لون أيقونة كل نوع: الجرعة فيروزية، الموعد بنفسجي، النفاد كهرماني، الكورس أزرق
const KINDS = {
    dose: { label: "جرعة", icon: Pill, color: "bg-forest-100 text-forest-600" },
    appointment: { label: "موعد", icon: Calendar, color: "bg-purple-100 text-purple-600" },
    refill: { label: "نفاد", icon: Package, color: "bg-amber-100 text-amber-600" },
    course: { label: "كورس", icon: Activity, color: "bg-blue-100 text-blue-600" },
    test: { label: "تجربة", icon: Check, color: "bg-sage-100 text-forest-700" },
};

const POLL_MS = 60000;
const parseDT = (v) => new Date(String(v).replace(" ", "T"));
const pad = (n) => String(n).padStart(2, "0");
const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// «اليوم»، «أمس»، أو التاريخ
function dayLabel(key) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (key === dayKey(today)) return "اليوم";
    if (key === dayKey(yesterday)) return "أمس";
    return formatDate(key);
}

/**
 * الجرس في زاوية التطبيق: عدد غير المقروء، ونافذة بسجل الإشعارات.
 * يرنّ (هزّة قصيرة) حين يصل إشعار والتطبيق مفتوح — يخبره sw.js بذلك.
 */
export default function NotificationBell() {
    const navigate = useNavigate();
    const location = useLocation();
    const [unread, setUnread] = useState(0);
    const [items, setItems] = useState(null); // null = لم يُحمَّل بعد
    const [open, setOpen] = useState(false);
    const [ringing, setRinging] = useState(false);
    const wrap = useRef(null);

    const loadUnread = useCallback(() => {
        api.get("/notifications/unread").then((r) => setUnread(r.data.unread)).catch(() => {});
    }, []);

    const loadList = useCallback(() => {
        api.get("/notifications")
            .then((r) => { setItems(r.data.items); setUnread(r.data.unread); })
            .catch(() => setItems((prev) => prev || []));
    }, []);

    // العدد: عند الفتح، كل دقيقة، وحين يعود المستخدم إلى التطبيق
    useEffect(() => {
        loadUnread();
        const timer = setInterval(loadUnread, POLL_MS);
        const onVisible = () => document.visibilityState === "visible" && loadUnread();
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            clearInterval(timer);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, [loadUnread]);

    // إشعار وصل والتطبيق مفتوح: يرنّ الجرس ويتحدّث كل شيء
    useEffect(() => {
        if (!("serviceWorker" in navigator)) return;
        let stop;
        const onMessage = (e) => {
            if (e.data?.type !== "notification") return;
            setRinging(true);
            clearTimeout(stop);
            stop = setTimeout(() => setRinging(false), 1300);
            loadList();
        };
        navigator.serviceWorker.addEventListener("message", onMessage);
        return () => {
            clearTimeout(stop);
            navigator.serviceWorker.removeEventListener("message", onMessage);
        };
    }, [loadList]);

    // فُتح التطبيق من إشعار النظام (?n=رقم): نعلّمه مقروءاً ونمسح الرقم من الرابط
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const id = params.get("n");
        if (!id) return;
        api.post(`/notifications/${id}/read`).then(loadUnread).catch(() => {});
        params.delete("n");
        const rest = params.toString();
        navigate(`${location.pathname}${rest ? `?${rest}` : ""}`, { replace: true });
    }, [location.pathname, location.search, navigate, loadUnread]);

    // إغلاق بالنقر خارج النافذة أو بزر Escape
    useEffect(() => {
        if (!open) return;
        const onDown = (e) => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false); };
        const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("pointerdown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const toggle = () => {
        if (!open) loadList();
        setOpen(!open);
    };

    const openItem = (n) => {
        if (!n.read_at) {
            api.post(`/notifications/${n.id}/read`).catch(() => {});
            setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read_at: "now" } : x)));
            setUnread((u) => Math.max(0, u - 1));
        }
        setOpen(false);
        navigate(n.url || "/");
    };

    const readAll = () => {
        api.post("/notifications/read-all").catch(() => {});
        setItems((list) => (list || []).map((x) => ({ ...x, read_at: x.read_at || "now" })));
        setUnread(0);
    };

    // تجميع حسب اليوم: «اليوم»، «أمس»، ثم التواريخ
    const groups = [];
    for (const n of items || []) {
        const key = dayKey(parseDT(n.created_at));
        const last = groups[groups.length - 1];
        if (last?.key === key) last.items.push(n);
        else groups.push({ key, items: [n] });
    }

    const label = unread ? `الإشعارات، ${unread} غير مقروء` : "الإشعارات";

    return (
        <div className="relative" ref={wrap}>
            <button
                type="button"
                onClick={toggle}
                aria-label={label}
                aria-expanded={open}
                aria-haspopup="dialog"
                className={`relative w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${open
                    ? "bg-forest-600 text-white"
                    : "text-forest-900 hover:bg-mint-50 dark:hover:bg-forest-800/60"} ${ringing ? "animate-bounce" : ""}`}
            >
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                    <span aria-hidden="true"
                        className="absolute -top-0.5 -left-0.5 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center ring-2 ring-white dark:ring-forest-950">
                        {unread > 9 ? "+9" : unread}
                    </span>
                )}
            </button>

            {open && (
                <div role="dialog" aria-label="الإشعارات"
                    className="absolute left-0 top-12 z-50 w-[22rem] max-w-[calc(100vw-2rem)] card !shadow-2xl overflow-hidden animate-scale-in origin-top-left">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-sage-100 dark:border-forest-800/60">
                        <h2 className="font-bold text-forest-950">الإشعارات</h2>
                        {unread > 0 && (
                            <button type="button" onClick={readAll} className="text-xs font-semibold text-forest-600 hover:text-forest-700">
                                تحديد الكل كمقروء
                            </button>
                        )}
                    </div>

                    {items === null ? (
                        <p className="p-6 text-center text-sm text-forest-700/60">جارٍ التحميل...</p>
                    ) : items.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="w-14 h-14 bg-sage-100 dark:bg-forest-800/60 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Bell className="w-7 h-7 text-sage-400 dark:text-forest-600" />
                            </div>
                            <p className="font-semibold text-forest-950">لا إشعارات بعد</p>
                            <p className="text-sm text-forest-700/60">تذكيرات الجرعات والمواعيد تظهر هنا.</p>
                        </div>
                    ) : (
                        <div className="max-h-[26rem] overflow-y-auto scrollbar-thin p-2">
                            {groups.map((g) => (
                                <section key={g.key}>
                                    <h3 className="px-3 pt-3 pb-1 text-xs font-bold text-forest-700/60">{dayLabel(g.key)}</h3>
                                    <ul>
                                        {g.items.map((n) => {
                                            const kind = KINDS[n.kind] || KINDS.test;
                                            const d = parseDT(n.created_at);
                                            return (
                                                <li key={n.id}>
                                                    <button type="button" onClick={() => openItem(n)}
                                                        className={`w-full flex items-start gap-3 p-3 rounded-xl text-right transition-colors hover:bg-sage-50 dark:hover:bg-forest-800/40 ${n.read_at ? "" : "bg-mint-50"}`}>
                                                        <span className={`w-9 h-9 ${kind.color} rounded-lg flex items-center justify-center flex-shrink-0`} aria-hidden="true">
                                                            <kind.icon className="w-4 h-4" />
                                                        </span>
                                                        <span className="flex-1 min-w-0">
                                                            <b className={`block text-sm text-forest-950 ${n.read_at ? "font-medium" : "font-bold"}`}>{n.title}</b>
                                                            {n.body && <span className="block text-xs text-forest-700/60 mt-0.5">{n.body}</span>}
                                                        </span>
                                                        <span className="flex flex-col items-end gap-1.5 flex-shrink-0">
                                                            <time className="text-[11px] text-forest-700/60" dateTime={d.toISOString()}>
                                                                {formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}
                                                            </time>
                                                            {!n.read_at && <span className="w-2 h-2 rounded-full bg-forest-500" aria-label="غير مقروء" />}
                                                        </span>
                                                    </button>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                </section>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
