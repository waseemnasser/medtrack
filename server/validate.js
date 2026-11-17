// قواعد التواريخ والأرقام في النماذج — الخادم هو الحَكَم الأخير، والواجهة تكرّرها
// (client/src/utils/validate.js) لتظهر الرسالة قبل الحفظ. كل دالة تُرجع
// رسالة الخطأ بالعربية، أو null إن كانت القيمة مقبولة.

const DAY_MS = 24 * 60 * 60 * 1000;

// الأرقام العربية-الهندية (٠-٩) والفاصلة العربية ← لاتينية
function latinDigits(s) {
    return String(s ?? "")
        .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
        .replace(/٫/g, ".");
}

// «YYYY-MM-DD» تاريخ حقيقي (لا ٣١ شباط) ← رقم أيام منذ ١٩٧٠، وإلا null
function dayNumber(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s ?? "").slice(0, 10));
    if (!m) return null;
    const [y, mo, d] = [+m[1], +m[2], +m[3]];
    const t = Date.UTC(y, mo - 1, d);
    const back = new Date(t);
    if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
    return Math.round(t / DAY_MS);
}

// اليوم بتوقيت الخادم (TZ=Asia/Damascus)، كما في المجدول
function todayNumber(now = new Date()) {
    return Math.round(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / DAY_MS);
}

function birthDateError(value, now = new Date()) {
    if (!value) return null;   // اختياري
    const d = dayNumber(value);
    if (d === null) return "تاريخ الميلاد غير صحيح";
    const today = todayNumber(now);
    if (d > today) return "تاريخ الميلاد لا يكون في المستقبل";
    if (today - d > Math.round(120 * 365.25)) return "تاريخ الميلاد أقدم من 120 سنة — تأكّد من السنة";
    return null;
}

// بداية الدواء: ليست قبل ولادة الشخص، ولا أقدم من ٣٠ سنة، ولا أبعد من سنة قادمة
function startDateError(value, { birthDate, now = new Date() } = {}) {
    const d = dayNumber(value);
    if (d === null) return "تاريخ البدء غير صحيح";
    const today = todayNumber(now);
    if (d > today + 366) return "تاريخ البدء بعيد جداً — أكثر من سنة من اليوم";
    if (today - d > Math.round(30 * 365.25)) return "تاريخ البدء أقدم من 30 سنة — تأكّد من السنة";
    const born = dayNumber(birthDate);
    if (born !== null && d < born) return "تاريخ البدء قبل تاريخ ميلاد الشخص";
    return null;
}

// نهاية الكورس: بعد البدء أو يومه، وخلال ٣٦٥ يوماً
function endDateError(end, start) {
    if (!end) return null;     // دواء مستمر بلا نهاية
    const e = dayNumber(end);
    const s = dayNumber(start);
    if (e === null) return "تاريخ نهاية الكورس غير صحيح";
    if (s !== null && e < s) return "نهاية الكورس قبل تاريخ البدء";
    if (s !== null && e - s + 1 > 365) return "الكورس أطول من 365 يوماً";
    return null;
}

// «YYYY-MM-DDTHH:mm» أو بمسافة، وبثوانٍ اختيارية ← Date بالتوقيت المحلي، وإلا null
function parseLocalDateTime(value) {
    const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(String(value ?? "").trim());
    if (!m || dayNumber(m[1]) === null) return null;
    const [h, mi, se] = [+m[2], +m[3], +(m[4] || 0)];
    if (h > 23 || mi > 59 || se > 59) return null;
    const [y, mo, d] = m[1].split("-").map(Number);
    return new Date(y, mo - 1, d, h, mi, se);
}

// موعد الطبيب: ليس في الماضي (عند الإنشاء أو تغيير الوقت)، وخلال سنتين
function appointmentTimeError(value, { now = new Date(), allowPast = false } = {}) {
    const t = parseLocalDateTime(value);
    if (!t) return "تاريخ الموعد أو ساعته غير صحيحة";
    // دقيقة سماح: من يحفظ موعداً «الآن» لا يُرفض لأن الثواني مرّت
    if (!allowPast && t.getTime() < now.getTime() - 60 * 1000) return "الموعد في الماضي — اختر تاريخاً وساعة قادمين";
    if (t.getTime() - now.getTime() > 2 * 366 * DAY_MS) return "الموعد أبعد من سنتين — تأكّد من السنة";
    return null;
}

// الجرعة: أكثر من صفر (نصف حبة مقبول)، وحتى ٥٠ وحدة
function unitsPerDoseError(value) {
    if (value === undefined || value === null || value === "") return null;   // الافتراضي ١
    const n = Number(latinDigits(value));
    if (!Number.isFinite(n) || n <= 0) return "الجرعة لازم تكون أكثر من صفر (مثلاً 1 أو نصف حبة 0.5)";
    if (n > 50) return "الجرعة أكبر من 50 وحدة — تأكّد من الرقم";
    return null;
}

// عدد الوحدات في العلبة: اختياري، وإن كُتب فعدد صحيح من ١ إلى ١٠٠٠٠
function unitsTotalError(value) {
    if (value === undefined || value === null || value === "") return null;
    const n = Number(latinDigits(value));
    if (!Number.isInteger(n) || n < 1) return "عدد الوحدات في العلبة لازم يكون عدداً صحيحاً من 1 فأكثر";
    if (n > 10000) return "عدد الوحدات في العلبة أكبر من 10000 — تأكّد من الرقم";
    return null;
}

// العيار المكتوب يدوياً: رقم ثم وحدة — «100 mg»، «5 ملغ»، «250 mg/5 ml»، «1000 IU»، «0.5%».
// عيار من الكتالوغ يُقبل كما هو (بعضه وحدة فقط بعد التنظيف، مثل «IU/TAB.»).
// مثال لاتيني داخل جملة عربية: يُعزل اتجاهياً (LRI…PDI) فلا يُقرأ «mg 500»
const LTR = (s) => `⁦${s}⁩`;
const STRENGTH = /^\d+(?:[.,]\d+)?\s*(?:[%‰]|[A-Za-zµμ؀-ۿ])/;
function strengthError(value, { fromCatalog = false } = {}) {
    const s = latinDigits(value).trim();
    if (fromCatalog) return s.length > 60 ? "العيار طويل جداً" : null;
    if (!s) return `اكتب العيار: رقم ووحدة، مثل ${LTR("500 mg")} أو 5 ملغ`;
    if (!STRENGTH.test(s)) return `العيار رقم ثم وحدة، مثل ${LTR("500 mg")} أو 5 ملغ أو ${LTR("250 mg/5 ml")}`;
    if (s.length > 40) return "العيار طويل جداً";
    return null;
}

// أوقات الجرعات: «HH:MM» صحيحة، وأيام من ١ إلى ٧ (يوم واحد على الأقل)
function timesError(times) {
    if (!Array.isArray(times) || !times.length) return "أضف موعد جرعة واحداً على الأقل";
    for (const t of times) {
        const m = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(String(t?.time_of_day ?? ""));
        if (!m || +m[1] > 23 || +m[2] > 59) return "وقت الجرعة غير صحيح";
        const days = String(t.days_of_week ?? "1234567");
        if (!/^[1-7]{1,7}$/.test(days) || new Set(days).size !== days.length) return "أيام الجرعة غير صحيحة";
    }
    return null;
}

module.exports = {
    latinDigits, dayNumber, parseLocalDateTime,
    birthDateError, startDateError, endDateError, appointmentTimeError,
    unitsPerDoseError, unitsTotalError, strengthError, timesError,
};
