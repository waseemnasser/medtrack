import { useState, useEffect } from "react";
import { Outlet, NavLink, Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, Users, Calendar, Settings, LogOut, Menu, Accessibility, Moon, Sun, Siren, Mic } from "lucide-react";
import api from "../api";
import InstallPrompt from "./InstallPrompt";
import NotificationBell from "./NotificationBell";
import Logo from "./Logo";
import { setTheme } from "../utils/theme";
import { getEasyMode, setEasyMode } from "../utils/easyMode";
import { logout } from "../utils/session";
import { initial } from "../utils/format";

// أقسام التطبيق — كل صفحة أخرى تتفرّع من أحدها.
// الأيقونات والألوان من نموذج bolt (AppLayout.tsx)
const NAV = [
    { to: "/", label: "اليوم", icon: LayoutDashboard, color: "text-forest-600" },
    { to: "/members", label: "العائلة", icon: Users, color: "text-blue-500" },
    { to: "/appointments", label: "المواعيد", icon: Calendar, color: "text-purple-500" },
    { to: "/emergency", label: "بطاقة الطوارئ", icon: Siren, color: "text-red-500" },
    { to: "/voice", label: "التأكيد الصوتي", icon: Mic, color: "text-rose-500" },
    { to: "/account", label: "الحساب", icon: Settings, color: "text-sage-400" },
];

// الحاسوب (١٠٢٤ فأكثر) أم الهاتف — الجرس يُعرض مرة واحدة في مكانه المناسب
function useDesktop() {
    const query = "(min-width: 1024px)";
    const [desktop, setDesktop] = useState(() => window.matchMedia(query).matches);
    useEffect(() => {
        const mq = window.matchMedia(query);
        const on = () => setDesktop(mq.matches);
        mq.addEventListener("change", on);
        return () => mq.removeEventListener("change", on);
    }, []);
    return desktop;
}

// مفتاح تشغيل/إيقاف بأسلوب الشريط الجانبي
function Switch({ on, onClick, label }) {
    return (
        <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick}
            className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-forest-600" : "bg-sage-400/40"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : ""}`} />
        </button>
    );
}

export default function Layout() {
    const navigate = useNavigate();
    const [me, setMe] = useState(null);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [easy, setEasy] = useState(getEasyMode);
    const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
    const desktop = useDesktop();

    useEffect(() => {
        api.get("/auth/me").then((r) => setMe(r.data)).catch(() => {});
    }, []);


    const toggleEasy = () => {
        setEasyMode(!easy);
        setEasy(!easy);
    };

    // الشريط الجانبي يبدّل بين فاتح وداكن؛ «تلقائي» يبقى من صفحة الحساب
    const toggleDark = (e) => {
        const next = dark ? "light" : "dark";
        setTheme(next, { origin: { x: e.clientX, y: e.clientY }, update: () => setDark(next === "dark") });
    };

    // إن غيّر المستخدم المظهر من صفحة الحساب، يتبعه المفتاح هنا
    useEffect(() => {
        const sync = () => setDark(document.documentElement.classList.contains("dark"));
        const observer = new MutationObserver(sync);
        observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
        return () => observer.disconnect();
    }, []);

    const sidebar = (
        <div className="flex flex-col h-full">
            <Link to="/" className="px-6 py-6 flex items-center gap-2.5 border-b border-white/10">
                <Logo size={40} variant="light" />
                <div>
                    <span className="text-lg font-extrabold text-white">نبض</span>
                    <span className="block text-[10px] text-forest-300">Nabd</span>
                </div>
            </Link>

            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin" aria-label="التنقل الرئيسي">
                {NAV.map((item) => (
                    <NavLink key={item.to} to={item.to} end={item.to === "/"}
                        className={({ isActive }) => `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${isActive
                            ? "bg-forest-600 text-white shadow-lg shadow-forest-600/30"
                            : "text-forest-200/70 hover:bg-white/5 hover:text-white"} ${easy ? "text-base py-3.5" : ""}`}>
                        {({ isActive }) => (
                            <>
                                <item.icon className={`${isActive ? "text-white" : item.color} ${easy ? "w-6 h-6" : "w-5 h-5"}`} strokeWidth={2} />
                                <span className={`font-medium ${easy ? "text-base" : "text-sm"}`}>{item.label}</span>
                            </>
                        )}
                    </NavLink>
                ))}
            </nav>

            <div className="px-3 py-3 border-t border-white/10">
                <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5">
                    <div className="flex items-center gap-2">
                        <Accessibility className="w-5 h-5 text-forest-300" />
                        <span className="text-sm font-medium text-forest-200">الوضع المريح</span>
                    </div>
                    <Switch on={easy} onClick={toggleEasy} label="الوضع المريح" />
                </div>

                <div className="flex items-center justify-between bg-white/5 rounded-xl px-3 py-2.5 mt-2">
                    <div className="flex items-center gap-2">
                        {dark ? <Moon className="w-5 h-5 text-forest-300" /> : <Sun className="w-5 h-5 text-forest-300" />}
                        <span className="text-sm font-medium text-forest-200">{dark ? "الوضع الداكن" : "فاتح"}</span>
                    </div>
                    <Switch on={dark} onClick={toggleDark} label="الوضع الداكن" />
                </div>

                <div className="mt-3 flex items-center justify-between">
                    <Link to="/account" className="flex items-center gap-2 min-w-0" title={me?.email}>
                        <div className="w-8 h-8 bg-forest-600 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-bold text-white">{initial(me?.name || "")}</span>
                        </div>
                        <span className="text-sm text-forest-200 truncate">{me?.name || ""}</span>
                    </Link>
                    <button onClick={() => logout(navigate)} title="تسجيل الخروج" aria-label="تسجيل الخروج"
                        className="p-2 text-forest-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
                        <LogOut className="w-5 h-5 rtl-flip" />
                    </button>
                </div>
                <p className="mt-3 text-[11px] leading-relaxed text-forest-300/60">
                    أداة تنظيمية فقط — لا تغني عن استشارة الطبيب أو الصيدلاني.
                </p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-sage-50 dark:bg-[#0a1f1e] flex transition-colors duration-300">
            {/* الحاسوب: شريط جانبي ثابت على اليمين */}
            <aside className="hidden lg:block w-64 bg-forest-950 fixed inset-y-0 right-0 z-40">
                {sidebar}
            </aside>

            {/* الهاتف: القائمة تنزلق من اليمين */}
            {mobileOpen && (
                <div className="fixed inset-0 z-50 lg:hidden">
                    <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
                    <aside className="absolute inset-y-0 right-0 w-64 bg-forest-950 animate-slide-left"
                        onClick={(e) => e.target.closest("a") && setMobileOpen(false)}>
                        {sidebar}
                    </aside>
                </div>
            )}

            {/* الهاتف: شريط علوي زجاجي */}
            <div className="lg:hidden fixed top-0 left-0 right-0 z-30 glass border-b border-sage-200/50 dark:border-forest-800/50 px-4 h-14 flex items-center justify-between">
                <button onClick={() => setMobileOpen(true)} aria-label="القائمة"
                    className="p-2 text-forest-900 rounded-lg hover:bg-mint-50">
                    <Menu className="w-6 h-6" />
                </button>
                <Link to="/" className="flex items-center gap-2">
                    <Logo size={32} />
                    <span className="font-extrabold text-forest-950">نبض</span>
                </Link>
                {!desktop && <NotificationBell />}
            </div>

            <main className="flex-1 min-w-0 pt-14 lg:pt-0 lg:mr-64">
                <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
                    {/* الحاسوب: الجرس في زاوية المحتوى */}
                    {desktop && (
                        <div className="flex justify-end -mb-2">
                            <NotificationBell />
                        </div>
                    )}
                    <InstallPrompt />
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
