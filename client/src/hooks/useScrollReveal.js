import { useEffect, useRef, useState } from "react";

// من نموذج bolt (useScrollReveal.ts و useCountUp.ts).
// من يفضّل تقليل الحركة يرى كل شيء فوراً، بلا حركة ولا عدّ.
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// visible يصير true حين يصل التمرير إلى العنصر، مرة واحدة فقط
export function useScrollReveal({ threshold = 0.15, rootMargin = "0px 0px -50px 0px" } = {}) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(() => reducedMotion() || !("IntersectionObserver" in window));

    useEffect(() => {
        const el = ref.current;
        if (!el || visible) return;
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setVisible(true);
                observer.disconnect();
            }
        }, { threshold, rootMargin });
        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold, rootMargin, visible]);

    return { ref, visible };
}

// عدّاد يصعد من صفر إلى الرقم حين يبدأ (start)
export function useCountUp(target, duration, start) {
    const [instant] = useState(reducedMotion);
    const [value, setValue] = useState(0);

    useEffect(() => {
        if (!start || instant) return;
        let frame;
        const t0 = performance.now();
        const tick = (now) => {
            const p = Math.min(1, (now - t0) / duration);
            setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
            if (p < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [target, duration, start, instant]);

    return instant && start ? target : value;
}
