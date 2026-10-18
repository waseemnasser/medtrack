import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { getTheme, setTheme } from "../utils/theme";

const systemDark = () => window.matchMedia("(prefers-color-scheme: dark)").matches;

// المظهر الظاهر فعلاً: الاختيار اليدوي، أو إعداد الجهاز إن كان «تلقائي»
const effective = (theme) => (theme === "auto" ? (systemDark() ? "dark" : "light") : theme);

/**
 * زر شمس/قمر يبدّل بين الفاتح والداكن مباشرة،
 * والدائرة تنتشر من الزر نفسه (utils/theme.js).
 */
export default function ThemeToggle({ className = "" }) {
    const [theme, setThemeState] = useState(getTheme);
    const [, setTick] = useState(0);
    const current = effective(theme);

    // في وضع «تلقائي» نتابع تغيّر إعداد الجهاز حتى تبقى الأيقونة صحيحة
    useEffect(() => {
        const mq = window.matchMedia("(prefers-color-scheme: dark)");
        const onChange = () => setTick((t) => t + 1);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);

    const toggle = (e) => {
        const next = current === "dark" ? "light" : "dark";
        const box = e.currentTarget.getBoundingClientRect();
        setTheme(next, {
            origin: { x: box.left + box.width / 2, y: box.top + box.height / 2 },
            update: () => flushSync(() => setThemeState(next)),
        });
    };

    const toDark = current === "light";

    return (
        <button
            type="button"
            className={`theme-toggle ${className}`}
            onClick={toggle}
            aria-label={toDark ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}
            title={toDark ? "الوضع الداكن" : "الوضع الفاتح"}
        >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {toDark ? (
                    // قمر
                    <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
                ) : (
                    // شمس
                    <>
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                    </>
                )}
            </svg>
        </button>
    );
}
