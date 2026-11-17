const express = require("express");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const pool = require("../db");
const auth = require("../middleware/auth");
const { signSession } = require("../middleware/auth");
const { sendMail } = require("../mailer");

const router = express.Router();

const MIN_PASSWORD = 8;
const RESET_MINUTES = 30;
const tooShort = (p) => typeof p !== "string" || p.length < MIN_PASSWORD;
const SHORT_MSG = "كلمة المرور لازم تكون 8 أحرف على الأقل";
// رمز الاستعادة لا يُحفظ كما هو: من يقرأ القاعدة لا يستطيع استعماله
const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

router.post("/register", async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
        return res.status(400).json({ error: "كل الحقول مطلوبة" });
    if (tooShort(password))
        return res.status(400).json({ error: SHORT_MSG });

    try {
        const exists = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
        if (exists.rows.length)
            return res.status(400).json({ error: "هذا البريد مسجل مسبقاً" });

        const hash = await bcrypt.hash(password, 10);
        const result = await pool.query(
            "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, password_version",
            [name, email, hash]
        );

        const user = result.rows[0];
        res.status(201).json({ token: signSession(user), user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
        if (!result.rows.length)
            return res.status(400).json({ error: "البريد أو كلمة المرور غير صحيحة" });

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password_hash);
        if (!match)
            return res.status(400).json({ error: "البريد أو كلمة المرور غير صحيحة" });

        res.json({ token: signSession(user), user: { id: user.id, name: user.name, email: user.email } });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// الحساب الحالي — الاسم في زاوية التطبيق
router.get("/me", auth, async (req, res) => {
    try {
        const r = await pool.query("SELECT id, name, email FROM users WHERE id = $1", [req.userId]);
        if (!r.rows.length) return res.status(404).json({ error: "الحساب غير موجود" });
        res.json(r.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// كلمة مرور جديدة: تُحفظ، ويرتفع الإصدار فتخرج الجلسات الأخرى، وتُلغى روابط
// الاستعادة المعلّقة. يُرجع المستخدم ليصنع منه توكن هذا الجهاز.
async function setPassword(client, userId, password) {
    const hash = await bcrypt.hash(password, 10);
    const r = await client.query(
        `UPDATE users SET password_hash = $2, password_version = password_version + 1
          WHERE id = $1 RETURNING id, password_version`,
        [userId, hash]
    );
    await client.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
    return r.rows[0];
}

// تغيير كلمة المرور من صفحة الحساب: القديمة أولاً
router.post("/change-password", auth, async (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password)
        return res.status(400).json({ error: "كل الحقول مطلوبة" });
    if (tooShort(new_password))
        return res.status(400).json({ error: SHORT_MSG });
    if (new_password === current_password)
        return res.status(400).json({ error: "كلمة المرور الجديدة هي نفسها الحالية" });

    try {
        const r = await pool.query("SELECT password_hash FROM users WHERE id = $1", [req.userId]);
        if (!r.rows.length) return res.status(404).json({ error: "الحساب غير موجود" });
        if (!(await bcrypt.compare(current_password, r.rows[0].password_hash)))
            return res.status(400).json({ error: "كلمة المرور الحالية غير صحيحة" });

        const user = await setPassword(pool, req.userId, new_password);
        // هذا الجهاز يبقى داخلاً بتوكن جديد، والأجهزة الأخرى تخرج
        res.json({ token: signSession(user) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// «نسيت كلمة المرور»: الرد نفسه دائماً، سواء كان البريد مسجلاً أم لا —
// لا نكشف لأحد أي البُرُد عندنا حسابات. والبريد يُرسل في الخلفية، فلا
// يكشف زمن الرد شيئاً أيضاً.
router.post("/forgot-password", async (req, res) => {
    const email = String(req.body.email || "").trim();
    if (!email) return res.status(400).json({ error: "اكتب بريدك الإلكتروني" });

    res.json({ ok: true });

    try {
        const u = await pool.query(
            "SELECT id, name, email FROM users WHERE LOWER(email) = LOWER($1) ORDER BY id LIMIT 1",
            [email]
        );
        if (!u.rows.length) return;
        const user = u.rows[0];

        const token = crypto.randomBytes(32).toString("base64url");
        // رابط واحد صالح في كل وقت: طلب جديد يلغي ما قبله
        await pool.query("DELETE FROM password_resets WHERE user_id = $1", [user.id]);
        await pool.query(
            `INSERT INTO password_resets (user_id, token_hash, expires_at)
             VALUES ($1, $2, now() + make_interval(mins => $3))`,
            [user.id, sha256(token), RESET_MINUTES]
        );

        const base = (process.env.PUBLIC_URL || "http://localhost:5173").replace(/\/$/, "");
        const link = `${base}/reset-password?token=${token}`;
        await sendMail({
            to: user.email,
            subject: "استعادة كلمة المرور — نبض",
            text: `مرحباً ${user.name}،\n\nلتعيين كلمة مرور جديدة افتح هذا الرابط خلال ${RESET_MINUTES} دقيقة:\n${link}\n\nإن لم تطلب ذلك فتجاهل هذه الرسالة، وكلمة مرورك لن تتغيّر.`,
            html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;line-height:1.8;color:#0b3b37">
<p>مرحباً ${escapeHtml(user.name)}،</p>
<p>لتعيين كلمة مرور جديدة لحسابك في نبض اضغط الزر خلال ${RESET_MINUTES} دقيقة:</p>
<p><a href="${link}" style="display:inline-block;background:#0F766E;color:#fff;text-decoration:none;padding:10px 22px;border-radius:10px;font-weight:bold">تعيين كلمة مرور جديدة</a></p>
<p style="font-size:13px;color:#557">أو انسخ الرابط: <span dir="ltr">${link}</span></p>
<p style="font-size:13px;color:#557">إن لم تطلب ذلك فتجاهل هذه الرسالة، وكلمة مرورك لن تتغيّر.</p>
</div>`,
        });
    } catch (err) {
        console.error("[auth] forgot-password:", err.message);
    }
});

// الرابط من البريد: كلمة مرور جديدة، مرة واحدة، قبل انتهاء الرابط
router.post("/reset-password", async (req, res) => {
    const { token, new_password } = req.body;
    if (!token) return res.status(400).json({ error: "الرابط ناقص. اطلب رابطاً جديداً." });
    if (tooShort(new_password)) return res.status(400).json({ error: SHORT_MSG });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        // FOR UPDATE: ضغطتان متزامنتان على الرابط نفسه لا تستعملانه مرتين
        const r = await client.query(
            `SELECT id, user_id FROM password_resets
              WHERE token_hash = $1 AND expires_at > now()
              FOR UPDATE`,
            [sha256(token)]
        );
        if (!r.rows.length) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "الرابط منتهٍ أو استُعمل من قبل. اطلب رابطاً جديداً." });
        }
        await setPassword(client, r.rows[0].user_id, new_password);
        await client.query("COMMIT");
        res.json({ ok: true });
    } catch (err) {
        await client.query("ROLLBACK").catch(() => { });
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

module.exports = router;
