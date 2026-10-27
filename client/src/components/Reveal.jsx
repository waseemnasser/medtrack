import { useScrollReveal } from "../hooks/useScrollReveal";

// من نموذج bolt (Reveal.tsx): العنصر يظهر بحركة حين يصل إليه التمرير.
// animation: fade-up | fade-in | fade-down | scale-in | slide-right | slide-left | blur-in
const ANIM = {
    "fade-up": "animate-fade-up",
    "fade-in": "animate-fade-in",
    "fade-down": "animate-fade-down",
    "scale-in": "animate-scale-in",
    "slide-right": "animate-slide-right",
    "slide-left": "animate-slide-left",
    "blur-in": "animate-blur-in",
};

export default function Reveal({ children, className = "", animation = "fade-up", delay = 0, duration = 700, threshold }) {
    const { ref, visible } = useScrollReveal({ threshold });
    return (
        <div
            ref={ref}
            className={`${visible ? ANIM[animation] : "opacity-0"} ${className}`}
            style={{ animationDelay: `${delay}ms`, animationDuration: `${duration}ms`, animationFillMode: "both" }}
        >
            {children}
        </div>
    );
}
