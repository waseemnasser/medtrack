// التأكيد الصوتي (pages/VoiceLog.jsx): التعرّف على الكلام من المتصفح نفسه
// (Web Speech API)، ثم فهم الجملة هنا: هل هي تأكيد؟ ولأي دواء؟

const Recognition = typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

// كروم وإيدج وسفاري تدعمه، وفايرفوكس لا
export const voiceSupported = () => Boolean(Recognition);

/**
 * يستمع لجملة واحدة بالعربية.
 * onText(text, final): النص أثناء الكلام، ثم النص النهائي
 * onResult(alternatives): كل ما فهمه المتصفح، الأرجح أولاً
 * onError(code): no-speech | not-allowed | network | ...
 * يُرجع دالة إيقاف.
 */
export function listen({ onText, onResult, onError, onEnd }) {
    const rec = new Recognition();
    rec.lang = "ar-SA";
    rec.interimResults = true;
    rec.maxAlternatives = 3;
    rec.continuous = false;
    let done = false;

    rec.onresult = (e) => {
        const res = e.results[e.results.length - 1];
        onText?.(res[0].transcript, res.isFinal);
        if (res.isFinal && !done) {
            done = true;
            onResult?.([...res].map((alt) => alt.transcript));
        }
    };
    rec.onerror = (e) => {
        done = true;
        onError?.(e.error);
    };
    rec.onend = () => {
        if (!done) onError?.("no-speech");
        onEnd?.();
    };
    rec.start();
    return () => rec.abort();
}

// توحيد الكتابة: بلا تشكيل، والهمزات والتاء المربوطة والألف المقصورة بصورة واحدة
export function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[ً-ْـ]/g, "")
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .replace(/\s+/g, " ")
        .trim();
}

// «ما أخذت»، «لم آخذ»، «لسا ما شربته» — نفي، لا تأكيد
const NEGATIONS = ["ما اخذت", "ما خذيت", "ما شربت", "لم اخذ", "لم اتناول", "ما تناولت", "لسا", "لسه", "بعد ما", "مو ", "مش "];
// «أخذت الدواء»، «شربت الحبة»، «تناولته»، أو جواب قصير «تم» / «نعم»
const CONFIRMS = ["اخذت", "خذيت", "اخدت", "شربت", "بلعت", "تناولت", "اخذناه", "اعطيته", "اعطيتها"];
const SHORT_YES = ["تم", "نعم", "اي", "ايوه", "اكيد", "خلصت"];

/** هل الجملة تأكيد لأخذ الدواء؟ */
export function isConfirmation(text) {
    const t = ` ${normalize(text)} `;
    if (NEGATIONS.some((n) => t.includes(` ${n}`))) return false;
    if (CONFIRMS.some((c) => t.includes(c))) return true;
    const words = t.trim().split(" ");
    return words.length <= 3 && words.some((w) => SHORT_YES.includes(w));
}

/**
 * الجرعة التي يقصدها المتكلم من بين جرعات الفرد المستحقة الآن.
 * إن ذكر اسم الدواء نختاره، وإلا فأقدم جرعة مستحقة (المتأخرة أولاً).
 */
export function pickDose(text, dueDoses) {
    if (!dueDoses.length) return null;
    const t = normalize(text);
    const named = dueDoses.find((d) => {
        const names = [d.medication_name, d.medication_name_ar].filter(Boolean).map(normalize);
        return names.some((n) => n && (t.includes(n) || t.includes(n.split(" ")[0])));
    });
    return named || dueDoses[0];
}
