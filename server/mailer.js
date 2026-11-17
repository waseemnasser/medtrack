// إرسال البريد: رمز تأكيد التسجيل ورابط استعادة كلمة المرور.
//
// Render المجاني يمنع منافذ SMTP (25 و465 و587)، فالإرسال عبر HTTPS بطريقة من اثنتين:
//
// ١. Gmail عبر Google Apps Script (مجاني، بلا نطاق خاص) — MAIL_RELAY_URL وMAIL_RELAY_SECRET.
//    سكربت صغير في حساب Google (server/scripts/mail-relay.gs) يستقبل الطلب ويرسل من
//    بريد Gmail نفسه. حدّ Google: نحو 100 رسالة يومياً لحساب مجاني.
// ٢. Brevo — BREVO_API_KEY وMAIL_FROM. يحتاج نطاقاً خاصاً موثَّقاً: Brevo لا يقبل
//    عنوان gmail.com مرسِلاً.
//
// بلا أيّ منهما — محلياً — تُطبع الرسالة في نافذة الخادم بدل إرسالها.

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 20000;

// الرسالة تُطبع في السجل محلياً فقط: على خادم منشور سجلّه ليس مكاناً لرمز أو رابط سري
const isLocal = () => !process.env.PUBLIC_URL || /localhost|127\.0\.0\.1/.test(process.env.PUBLIC_URL);

async function viaAppsScript({ to, subject, html, text }) {
    const res = await fetch(process.env.MAIL_RELAY_URL, {
        method: "POST",
        // text/plain لا JSON: Apps Script يقرأ الجسم كما هو من e.postData.contents
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ secret: process.env.MAIL_RELAY_SECRET, to, subject, html, text, name: "نبض" }),
        // Apps Script يردّ بتحويلة إلى googleusercontent.com فيها النتيجة — نتبعها
        redirect: "follow",
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text();
    let result;
    try { result = JSON.parse(body); } catch { result = null; }
    if (!res.ok || !result?.ok) throw new Error(`Apps Script ${res.status}: ${(result?.error || body).slice(0, 200)}`);
}

async function viaBrevo({ to, subject, html, text }) {
    const res = await fetch(BREVO_URL, {
        method: "POST",
        headers: { "api-key": process.env.BREVO_API_KEY, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
            sender: { name: "نبض", email: process.env.MAIL_FROM },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text,
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

async function sendMail(message) {
    if (process.env.MAIL_RELAY_URL) return viaAppsScript(message);
    if (process.env.BREVO_API_KEY) return viaBrevo(message);
    if (isLocal()) {
        console.log(`[mail] لا توجد طريقة إرسال مضبوطة — الرسالة هنا بدل البريد\nإلى: ${message.to}\n${message.subject}\n${message.text}\n`);
    } else {
        console.error("[mail] لا MAIL_RELAY_URL ولا BREVO_API_KEY — لم تُرسل الرسالة");
    }
}

module.exports = { sendMail };
