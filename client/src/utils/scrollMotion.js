import { ScrollTrigger } from "gsap/ScrollTrigger";
import { gsap, useGSAP, MOTION_OK } from "./motion";

gsap.registerPlugin(ScrollTrigger);

// نقطة البدء المشتركة: حين يصل أعلى العنصر إلى ٨٥٪ من ارتفاع الشاشة
export const START = "top 85%";

export { gsap, useGSAP, ScrollTrigger, MOTION_OK };
