// أدوات تنسيق مشتركة بين الصفحات: الأوقات، التواريخ، فترات اليوم

// فترات اليوم — لكل فترة لونها الثابت في variables.css
export const PERIODS = [
    { key: "morning", label: "الصباح" },
    { key: "noon", label: "الظهر" },
    { key: "evening", label: "المساء" },
];

// «08:30:00» ← فترة الصباح
export function periodOf(timeOfDay) {
    const hour = parseInt(timeOfDay.slice(0, 2), 10);
    if (hour < 12) return PERIODS[0];
    if (hour < 17) return PERIODS[1];
    return PERIODS[2];
}

// «20:00:00» ← { clock: "8:00", suffix: "م" }
export function timeParts(timeOfDay) {
    const [h, m] = timeOfDay.split(":");
    const hour = parseInt(h, 10);
    const suffix = hour < 12 ? "ص" : "م";
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return { clock: `${h12}:${m}`, suffix };
}

// «20:00:00» ← «8:00 م»
export function formatTime(timeOfDay) {
    const { clock, suffix } = timeParts(timeOfDay);
    return `${clock} ${suffix}`;
}

// «2026-10-18» ← «السبت ١٨ تشرين الأول»
export function formatDate(date, withWeekday = true) {
    if (!date) return "";
    return new Date(`${String(date).slice(0, 10)}T00:00`).toLocaleDateString("ar-SY", {
        ...(withWeekday && { weekday: "long" }),
        day: "numeric",
        month: "long",
    });
}

// العمر بالسنوات من تاريخ الميلاد
export function calcAge(birthDate) {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

// الحرف الأول من الاسم للصورة الرمزية
export function initial(name) {
    return (name || "?").trim().charAt(0);
}
