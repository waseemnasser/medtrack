// تأكيد البريد برمز من ٦ أرقام عند إنشاء الحساب.
//
// الحساب يُنشأ «غير مؤكَّد» ولا يدخل صاحبه حتى يكتب الرمز الذي وصل بريده —
// هذا وحده يثبت أن البريد له. الرمز: ١٥ دقيقة، ٥ محاولات خاطئة ثم يسقط،
// وإعادة الإرسال بعد دقيقة. القاعدة تحفظ بصمته (sha256) لا الرمز نفسه.
const crypto = require("crypto");
const pool = require("./db");
const { sendMail } = require("./mailer");

const CODE_MINUTES = 15;
const MAX_ATTEMPTS = 5;
const RESEND_SECONDS = 60;

// البصمة مربوطة برقم المستخدم: الرمز نفسه لحسابين لا يعطي البصمة نفسها
const hashCode = (userId, code) => crypto.createHash("sha256").update(`${userId}:${code}`).digest("hex");

/**
 * يرسل رمزاً جديداً، إلا إن أُرسل رمز قبل أقل من دقيقة (force يتجاوز ذلك عند التسجيل).
 * يُرجع { sent: true } أو { sent: false, wait: ثوانٍ }.
 */
async function issueCode(user, { force = false } = {}) {
    if (!force) {
        const last = await pool.query(
            "SELECT EXTRACT(EPOCH FROM (now() - sent_at))::int AS age FROM email_codes WHERE user_id = $1",
            [user.id]
        );
        const age = last.rows[0]?.age;
        if (age !== undefined && age < RESEND_SECONDS) return { sent: false, wait: RESEND_SECONDS - age };
    }

    const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
    await pool.query(
        `INSERT INTO email_codes (user_id, code_hash, expires_at, attempts, sent_at)
         VALUES ($1, $2, now() + make_interval(mins => $3), 0, now())
         ON CONFLICT (user_id) DO UPDATE
           SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at, attempts = 0, sent_at = now()`,
        [user.id, hashCode(user.id, code), CODE_MINUTES]
    );

    await sendMail({
        to: user.email,
        subject: `رمز تأكيد بريدك في نبض: ${code}`,
        text: `مرحباً ${user.name}،\n\nرمز تأكيد بريدك: ${code}\nاكتبه في صفحة التأكيد خلال ${CODE_MINUTES} دقيقة.\n\nإن لم تنشئ حساباً في نبض فتجاهل هذه الرسالة.`,
        html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.8;color:#0b3b37">
<p>مرحباً ${escapeHtml(user.name)}،</p>
<p>رمز تأكيد بريدك في نبض:</p>
<p dir="ltr" style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#0F766E;margin:8px 0">${code}</p>
<p>اكتبه في صفحة التأكيد خلال ${CODE_MINUTES} دقيقة.</p>
<p style="font-size:13px;color:#557">إن لم تنشئ حساباً في نبض فتجاهل هذه الرسالة.</p>
</div>`,
    });
    return { sent: true };
}

/**
 * يفحص الرمز. يُرجع { user } عند النجاح (والحساب صار مؤكَّداً)، أو { error }.
 */
async function verifyCode(email, code) {
    const u = await pool.query(
        "SELECT id, name, email, password_version, email_verified_at FROM users WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1",
        [String(email || "").trim()]
    );
    const user = u.rows[0];
    if (!user) return { error: "الرمز غير صحيح." };
    if (user.email_verified_at) return { user };   // مؤكَّد من قبل (ضغطة ثانية) — ندخله

    const r = await pool.query(
        "SELECT code_hash, attempts, expires_at > now() AS live FROM email_codes WHERE user_id = $1",
        [user.id]
    );
    const row = r.rows[0];
    if (!row || !row.live) return { error: "انتهت صلاحية الرمز. اطلب رمزاً جديداً.", expired: true };

    const given = Buffer.from(hashCode(user.id, String(code || "").trim()));
    const stored = Buffer.from(row.code_hash);
    if (!crypto.timingSafeEqual(given, stored)) {
        const attempts = row.attempts + 1;
        if (attempts >= MAX_ATTEMPTS) {
            await pool.query("DELETE FROM email_codes WHERE user_id = $1", [user.id]);
            return { error: "محاولات خاطئة كثيرة. اطلب رمزاً جديداً.", expired: true };
        }
        await pool.query("UPDATE email_codes SET attempts = $2 WHERE user_id = $1", [user.id, attempts]);
        const left = MAX_ATTEMPTS - attempts;
        const leftText = left === 1 ? "محاولة واحدة" : left === 2 ? "محاولتان" : `${left} محاولات`;
        return { error: `الرمز غير صحيح. ${left === 2 ? "بقيت لك" : "بقيت"} ${leftText}.` };
    }

    await pool.query("UPDATE users SET email_verified_at = now() WHERE id = $1", [user.id]);
    await pool.query("DELETE FROM email_codes WHERE user_id = $1", [user.id]);
    return { user };
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

module.exports = { issueCode, verifyCode, CODE_MINUTES, MAX_ATTEMPTS, RESEND_SECONDS };
