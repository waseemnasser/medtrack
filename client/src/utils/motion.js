import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";

// مكان واحد لتسجيل إضافات GSAP. ScrollTrigger يُسجَّل في utils/scrollMotion.js
// وحده، لأن الصفحة التعريفية وحدها تحتاجه، فلا يدخل حزمة التطبيق.
gsap.registerPlugin(useGSAP, DrawSVGPlugin);

// من فعّل «تقليل الحركة» في جهازه يرى كل شيء في مكانه فوراً.
// داخل useGSAP نستعمل gsap.matchMedia مع هذا الشرط، فيتبع الإعداد حتى لو تغيّر والصفحة مفتوحة.
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";

export { gsap, useGSAP };
