import { useId } from "react";

// شعار نبض — من نموذج bolt (project/src/components/Logo.tsx) كما هو:
// مربع مستدير بتدرّج فيروزي، وفيه خط نبض أبيض ينتهي بنقطة «الدقّة».
// variant="light": تدرّج أفتح للخلفيات الداكنة (الشريط الجانبي).
export default function Logo({ size = 40, variant = "default", className = "" }) {
    const id = useId();
    const gradId = `nabd-grad-${variant}-${id}`;
    const glowId = `nabd-glow-${variant}-${id}`;

    return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg"
            className={className} aria-hidden="true">
            <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    {variant === "light" ? (
                        <>
                            <stop stopColor="#5EEAD4" />
                            <stop offset="1" stopColor="#14B8A6" />
                        </>
                    ) : (
                        <>
                            <stop stopColor="#2DD4BF" />
                            <stop offset="0.5" stopColor="#14B8A6" />
                            <stop offset="1" stopColor="#0D9488" />
                        </>
                    )}
                </linearGradient>
                <filter id={glowId} x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feMerge>
                        <feMergeNode in="blur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            <rect width="48" height="48" rx="14" fill={`url(#${gradId})`} />
            <path d="M8 25 L15 25 L18.5 16 L22 33 L25.5 20 L28 25 L40 25" stroke="white" strokeWidth="2.5"
                strokeLinecap="round" strokeLinejoin="round" filter={`url(#${glowId})`} />
            <circle cx="40" cy="25" r="2.5" fill="white" opacity="0.9" />
        </svg>
    );
}
