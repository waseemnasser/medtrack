import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import api from "../api";
import { formatDate, formatTime } from "../utils/format";
import "./NotificationBell.css";

// لون أيقونة كل نوع: الجرعة فيروزية، الموعد بنفسجي، النفاد مشمشي، الكورس أحمر هادئ
const KINDS = {
    dose: { label: "جرعة", icon: <><rect x="3" y="8" width="18" height="8" rx="4" /><path d="M12 8v8" /></> },
    appointment: { label: "موعد", icon: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></> },
    refill: { label: "نفاد", icon: <><path d="M7 3h10v4H7z" /><path d="M6 7h12v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1z" /><path d="M10 13h4M12 11v4" /></> },
    course: { label: "كورس", icon: <><rect x="3.5" y="9" width="17" height="7" rx="3.5" /><path d="M12 9v7" /><path d="M7 4.5h10" /></> },
    test: { label: "تجربة", icon: <><path d="M5 12.5l4.5 4.5L19 7.5" /></> },
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
        <div className="bell-wrap" ref={wrap}>
            <button
                type="button"
                className={`bell${ringing ? " ringing" : ""}${open ? " open" : ""}`}
                onClick={toggle}
                aria-label={label}
                aria-expanded={open}
                aria-haspopup="dialog"
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6.5 2 6.5H4S6 14 6 9z" />
                    <path d="M10 19.5a2.2 2.2 0 0 0 4 0" />
                </svg>
                {unread > 0 && <span className="bell-count" aria-hidden="true">{unread > 9 ? "+9" : unread}</span>}
            </button>

            {open && (
                <div className="bell-panel" role="dialog" aria-label="الإشعارات">
                    <div className="bell-head">
                        <h2>الإشعارات</h2>
                        {unread > 0 && (
                            <button type="button" className="bell-readall" onClick={readAll}>
                                تحديد الكل كمقروء
                            </button>
                        )}
                    </div>

                    {items === null ? (
                        <p className="bell-loading">جارٍ التحميل...</p>
                    ) : items.length === 0 ? (
                        <div className="empty bell-empty">
                            لا إشعارات بعد.
                            <br />
                            <small>تذكيرات الجرعات والمواعيد تظهر هنا.</small>
                        </div>
                    ) : (
                        <div className="bell-list">
                            {groups.map((g) => (
                                <section key={g.key}>
                                    <h3 className="bell-day">{dayLabel(g.key)}</h3>
                                    <ul>
                                        {g.items.map((n) => {
                                            const kind = KINDS[n.kind] || KINDS.test;
                                            const d = parseDT(n.created_at);
                                            return (
                                                <li key={n.id}>
                                                    <button
                                                        type="button"
                                                        className={`bell-item${n.read_at ? "" : " unread"}`}
                                                        onClick={() => openItem(n)}
                                                    >
                                                        <span className={`bell-icon ${n.kind}`} aria-hidden="true">
                                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{kind.icon}</svg>
                                                        </span>
                                                        <span className="bell-text">
                                                            <b>{n.title}</b>
                                                            {n.body && <span>{n.body}</span>}
                                                        </span>
                                                        <time className="bell-time" dateTime={d.toISOString()}>
                                                            {formatTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}
                                                        </time>
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
