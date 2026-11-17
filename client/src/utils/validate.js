// قواعد التواريخ والأرقام في النماذج — نسخة الواجهة من server/validate.js،
// لتظهر الرسالة قبل الحفظ. الخادم يفحص الشيء نفسه ويبقى الحَكَم الأخير.

const DAY_MS = 24 * 60 * 60 * 1000;

// الأرقام العربية-الهندية (٠-٩) والفاصلة العربية ← لاتينية
export function latinDigits(s) {
    return String(s ?? "")
        .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
        .replace(/٫/g, ".");
}

// «YYYY-MM-DD» تاريخ حقيقي ← رقم أيام، وإلا null
function dayNumber(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? "").slice(0, 10));
    if (!m) return null;
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    const t = Date.UTC(y, mo - 1, d);
    const back = new Date(t);
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
    return Math.round(t / DAY_MS);
}

const todayNumber = (now = new Date()) => Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
const isoOf = (n) => new Date(n * DAY_MS).toISOString().slice(0, 10);

// حدود حقول التاريخ (min/max) — تمنع اختيار سنة مثل 2126 من التقويم نفسه
export function dateLimits(now = new Date()) {
    const today = todayNumber(now);
    const pad = (n) => String(n).padStart(2, "0");
    const local = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return {
        today: isoOf(today),
        birthMin: isoOf(today - Math.round(120 * 365.25)),
        startMin: isoOf(today - Math.round(30 * 365.25)),
        startMax: isoOf(today + 366),
        apptMin: local(now),
        apptMax: local(new Date(now.getTime() + 2 * 366 * DAY_MS)),
    };
}

export function birthDateError(value, now = new Date()) {
    if (!value) return null;
    const d = dayNumber(value);
    if (d === null) return "تاريخ الميلاد غير صحيح";
    const today = todayNumber(now);
    if (d > today) return "تاريخ الميلاد لا يكون في المستقبل";
    if (today - d > Math.round(120 * 365.25)) return "تاريخ الميلاد أقدم من 120 سنة — تأكّد من السنة";
    return null;
}

export function startDateError(value, { birthDate, now = new Date() } = {}) {
    const d = dayNumber(value);
    if (d === null) return "تاريخ البدء غير صحيح";
    const today = todayNumber(now);
    if (d > today + 366) return "تاريخ البدء بعيد جداً — أكثر من سنة من اليوم";
    if (today - d > Math.round(30 * 365.25)) return "تاريخ البدء أقدم من 30 سنة — تأكّد من السنة";
    const born = dayNumber(birthDate);
    if (born !== null && d < born) return "تاريخ البدء قبل تاريخ ميلاد الشخص";
    return null;
}

export function appointmentTimeError(value, { now = new Date(), allowPast = false } = {}) {
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/.exec(String(value ?? ""));
    if (!m || dayNumber(m[1]) === null || +m[2] > 23 || +m[3] > 59) return "تاريخ الموعد أو ساعته غير صحيحة";
    const [y, mo, d] = m[1].split("-").map(Number);
    const t = new Date(y, mo - 1, d, +m[2], +m[3]);
    if (!allowPast && t.getTime() < now.getTime() - 60 * 1000) return "الموعد في الماضي — اختر تاريخاً وساعة قادمين";
    if (t.getTime() - now.getTime() > 2 * 366 * DAY_MS) return "الموعد أبعد من سنتين — تأكّد من السنة";
    return null;
}

export function unitsPerDoseError(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(latinDigits(value));
    if (!Number.isFinite(n) || n <= 0) return "الجرعة لازم تكون أكثر من صفر (مثلاً 1 أو نصف حبة 0.5)";
    if (n > 50) return "الجرعة أكبر من 50 وحدة — تأكّد من الرقم";
    return null;
}

export function unitsTotalError(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(latinDigits(value));
    if (!Number.isInteger(n) || n < 1) return "عدد الوحدات في العلبة لازم يكون عدداً صحيحاً من 1 فأكثر";
    if (n > 10000) return "عدد الوحدات في العلبة أكبر من 10000 — تأكّد من الرقم";
    return null;
}

// مثال لاتيني داخل جملة عربية: يُعزل اتجاهياً (LRI…PDI) فلا يُقرأ «mg 500»
const LTR = (s) => `⁦${s}⁩`;
const STRENGTH = /^\d+(?:[.,]\d+)?\s*(?:[%‰]|[A-Za-zµμ؀-ۿ])/;
export function strengthError(value, { fromCatalog = false } = {}) {
    const s = latinDigits(value).trim();
    if (fromCatalog) return s.length > 60 ? "العيار طويل جداً" : null;
    if (!s) return `اكتب العيار: رقم ووحدة، مثل ${LTR("500 mg")} أو 5 ملغ`;
    if (!STRENGTH.test(s)) return `العيار رقم ثم وحدة، مثل ${LTR("500 mg")} أو 5 ملغ أو ${LTR("250 mg/5 ml")}`;
    if (s.length > 40) return "العيار طويل جداً";
    return null;
}
