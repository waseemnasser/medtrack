import { useRef } from "react";
import { gsap, useGSAP, MOTION_OK, START } from "../utils/scrollMotion";

// العنصر يظهر بحركة حين يصل إليه التمرير (GSAP + ScrollTrigger، مرة واحدة).
// animation: fade-up | fade-down | fade-in | scale-in | slide-right | slide-left | blur-in
// stagger: محدِّد CSS لعناصر داخلية تظهر بعده واحداً تلو الآخر، مثل "[data-stagger]".
const FROM = {
    "fade-up": { y: 32 },
    "fade-down": { y: -24 },
    "fade-in": {},
    "scale-in": { scale: 0.92, y: 16 },
    "slide-right": { x: -40 },
    "slide-left": { x: 40 },
    "blur-in": { filter: "blur(10px)" },
};

export default function Reveal({ children, className = "", animation = "fade-up", delay = 0, duration = 700, stagger }) {
    const ref = useRef(null);

    useGSAP(() => {
        gsap.matchMedia().add(MOTION_OK, () => {
            const tl = gsap.timeline({
                delay: delay / 1000,
                defaults: { ease: "power3.out" },
                scrollTrigger: { trigger: ref.current, start: START, once: true },
            });
            tl.from(ref.current, { autoAlpha: 0, ...FROM[animation], duration: duration / 1000 });
            if (stagger) {
                tl.from(gsap.utils.toArray(stagger, ref.current), {
                    autoAlpha: 0, y: 14, duration: 0.45, stagger: 0.08,
                }, "-=0.35");
            }
        });
    }, { scope: ref });

    return <div ref={ref} className={className}>{children}</div>;
}
