// اختيار المظهر: «auto» يتبع إعداد الجهاز، أو «light» / «dark» يدوياً.
// الاختيار يُحفظ في localStorage ويُطبَّق كـ data-theme على <html>،
// والسطر نفسه في index.html يطبّقه قبل ظهور الصفحة حتى لا تومض بيضاء.

const KEY = "theme";
const REVEAL_MS = 550;
const FADE_MS = 400;

export function getTheme() {
    try {
        return localStorage.getItem(KEY) || "auto";
    } catch {
        return "auto";
    }
}

/**
 * يغيّر المظهر بحركة: دائرة تنتشر من الزر الذي ضُغط حتى تغطي الشاشة.
 *
 * origin: { x, y } موضع الضغطة — من هنا تبدأ الدائرة
 * update: دالة تُنفَّذ مع التغيير (تحديث حالة الأزرار في React)
 */
export function setTheme(theme, { origin, update } = {}) {
    try {
        if (theme === "auto") localStorage.removeItem(KEY);
        else localStorage.setItem(KEY, theme);
    } catch {
        // التخزين محظور (تصفّح خاص) — نطبّق الاختيار لهذه الجلسة فقط
    }

    const change = () => {
        applyTheme(theme);
        update?.();
    };

    // من طلب تقليل الحركة: تغيير فوري بلا أي حركة
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        change();
        return;
    }

    // متصفح لا يدعم View Transitions: تلاشٍ هادئ للألوان بدل القفزة
    if (!document.startViewTransition) {
        const root = document.documentElement;
        root.classList.add("theme-fading");
        change();
        setTimeout(() => root.classList.remove("theme-fading"), FADE_MS);
        return;
    }

    // الدائرة: من موضع الضغطة (أو منتصف الشاشة) إلى أبعد زاوية
    const x = origin?.x ?? window.innerWidth / 2;
    const y = origin?.y ?? window.innerHeight / 2;
    const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(change);
    transition.ready.then(() => {
        document.documentElement.animate(
            {
                clipPath: [
                    `circle(0px at ${x}px ${y}px)`,
                    `circle(${radius}px at ${x}px ${y}px)`,
                ],
            },
            {
                duration: REVEAL_MS,
                easing: "cubic-bezier(.4, 0, .2, 1)",
                pseudoElement: "::view-transition-new(root)",
            }
        );
    });
}

export function applyTheme(theme) {
    const root = document.documentElement;
    if (theme === "light" || theme === "dark") root.dataset.theme = theme;
    else delete root.dataset.theme;
}
