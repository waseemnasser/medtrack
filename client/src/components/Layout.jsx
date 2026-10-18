import { Outlet, NavLink, Link } from "react-router-dom";
import InstallPrompt from "./InstallPrompt";
import Mark from "./Mark";
import "./Layout.css";

// تبويبات التطبيق الأربعة — كل صفحة أخرى تتفرّع من أحدها
const TABS = [
    {
        to: "/",
        label: "اليوم",
        icon: (
            <>
                <rect x="3" y="8" width="18" height="8" rx="4" />
                <path d="M12 8v8" />
            </>
        ),
    },
    {
        to: "/members",
        label: "العائلة",
        icon: (
            <>
                <circle cx="9" cy="8" r="3.5" />
                <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
                <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" />
                <path d="M18 14.8c1.8.7 3 2.5 3.5 5.2" />
            </>
        ),
    },
    {
        to: "/appointments",
        label: "المواعيد",
        icon: (
            <>
                <rect x="3.5" y="5" width="17" height="15" rx="3" />
                <path d="M3.5 10h17M8 3v4M16 3v4" />
            </>
        ),
    },
    {
        to: "/account",
        label: "الحساب",
        icon: (
            <>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20.5c1.2-4 4.3-6 8-6s6.8 2 8 6" />
            </>
        ),
    },
];

export default function Layout() {
    return (
        <div className="app-shell">
            <header className="top-bar">
                <Link to="/" className="brand">
                    <Mark size={26} />
                    طمّني
                </Link>
            </header>
            <InstallPrompt />
            <main className="app-main">
                <Outlet />
            </main>

            {/* شريط سفلي على الهاتف، وشريط جانبي على الحاسوب — نفس العنصر */}
            <nav className="bottom-nav" aria-label="التنقل الرئيسي">
                <Link to="/" className="brand nav-brand">
                    <Mark size={30} />
                    طمّني
                </Link>
                {TABS.map((t) => (
                    <NavLink key={t.to} to={t.to} end={t.to === "/"}>
                        <span className="nav-icon">
                            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                {t.icon}
                            </svg>
                        </span>
                        <span>{t.label}</span>
                    </NavLink>
                ))}
                <p className="nav-foot">أداة تنظيمية فقط — لا تغني عن استشارة الطبيب أو الصيدلاني.</p>
            </nav>
        </div>
    );
}
