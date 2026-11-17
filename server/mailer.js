// إرسال البريد (رابط استعادة كلمة المرور).
//
// عبر واجهة Brevo على HTTPS لا عبر SMTP: Render المجاني يمنع منافذ SMTP
// (25 و465 و587) منذ أيلول 2025. المتغيّرات: BREVO_API_KEY، وMAIL_FROM
// (بريد مُتحقَّق منه في Brevo). بلا مفتاح — محلياً — تُطبع الرسالة في
// نافذة الخادم بدل إرسالها، فيمكن تجربة الاستعادة بلا حساب بريد.

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

// الرابط يُطبع في السجل محلياً فقط: على خادم منشور سجلّه ليس مكاناً لرابط سري
const isLocal = () => !process.env.PUBLIC_URL || /localhost|127\.0\.0\.1/.test(process.env.PUBLIC_URL);

async function sendMail({ to, subject, html, text }) {
    const key = process.env.BREVO_API_KEY;
    if (!key) {
        if (isLocal()) console.log(`[mail] لا يوجد BREVO_API_KEY — الرسالة هنا بدل البريد\nإلى: ${to}\n${subject}\n${text}\n`);
        else console.error("[mail] BREVO_API_KEY غير مضبوط — لم تُرسل رسالة الاستعادة");
        return;
    }
    const res = await fetch(BREVO_URL, {
        method: "POST",
        headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
        body: JSON.stringify({
            sender: { name: "نبض", email: process.env.MAIL_FROM },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            textContent: text,
        }),
        signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error(`Brevo ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

module.exports = { sendMail };
