import { useState, useEffect } from "react";
import { flushSync } from "react-dom";
import { Moon, Sun } from "lucide-react";
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
            className={`w-10 h-10 flex items-center justify-center rounded-xl text-forest-900 hover:bg-mint-50 dark:hover:bg-forest-800/60 transition-colors ${className}`}
            onClick={toggle}
            aria-label={toDark ? "تفعيل الوضع الداكن" : "تفعيل الوضع الفاتح"}
            title={toDark ? "الوضع الداكن" : "الوضع الفاتح"}
        >
            {toDark ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
        </button>
    );
}
