const jwt = require("jsonwebtoken");
const pool = require("../db");

// مدة الجلسة: توكن قصير (يوم) يتجدّد وحده ما دام التطبيق مستعملاً، حتى ٧ أيام
// من تسجيل الدخول ثم دخول جديد. التوكن محفوظ في localStorage (الواجهة على
// github.io والخادم على onrender.com، فكوكي httpOnly يصير «طرف ثالث» يحجبه
// سفاري) — لذلك نقصّر عمره: توكن تسرّب ولم يُستعمل يموت خلال يوم.
const TOKEN_SECONDS = 24 * 60 * 60;
const RENEW_AFTER_SECONDS = 12 * 60 * 60;   // نصف العمر: لا تجديد مع كل طلب
const SESSION_MAX_SECONDS = 7 * 24 * 60 * 60;
const SESSION_HEADER = "X-Session-Token";   // الواجهة (api.js) تحفظ التوكن الجديد منه

// التوكن يحمل:
//   pv  إصدار كلمة المرور — تغييرها أو استعادتها يرفعه، فتسقط كل الجلسات الأقدم
//   at  وقت تسجيل الدخول — التجديد لا يمدّ الجلسة بعد ٧ أيام منه
function signSession(user, loginAt = Math.floor(Date.now() / 1000)) {
    const left = loginAt + SESSION_MAX_SECONDS - Math.floor(Date.now() / 1000);
    return jwt.sign(
        { id: user.id, pv: user.password_version || 0, at: loginAt },
        process.env.JWT_SECRET,
        { expiresIn: Math.max(1, Math.min(TOKEN_SECONDS, left)) }
    );
}

async function auth(req, res, next) {
    const header = req.headers.authorization;
    if (!header) return res.status(401).json({ error: "غير مصرح" });

    let decoded;
    try {
        decoded = jwt.verify(header.split(" ")[1], process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({ error: "الجلسة منتهية، سجل دخول من جديد" });
    }

    let user;
    try {
        const r = await pool.query("SELECT id, password_version FROM users WHERE id = $1", [decoded.id]);
        user = r.rows[0];
        // توكنات ما قبل هذه الميزة بلا pv — تُعامل كإصدار 0 فلا يخرج أحد فجأة
        if (!user || (decoded.pv || 0) !== user.password_version)
            return res.status(401).json({ error: "تغيّرت كلمة المرور، سجّل دخولك من جديد" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

    // تجديد صامت: مضى نصف عمر التوكن والجلسة لم تبلغ ٧ أيام ← توكن جديد في الترويسة.
    // توكنات قديمة بلا at: وقت إصدارها هو بداية الجلسة.
    const now = Math.floor(Date.now() / 1000);
    const loginAt = decoded.at || decoded.iat;
    if (now - decoded.iat >= RENEW_AFTER_SECONDS && now - loginAt < SESSION_MAX_SECONDS - 60) {
        res.set(SESSION_HEADER, signSession(user, loginAt));
    }

    req.userId = decoded.id;
    next();
}

module.exports = auth;
module.exports.signSession = signSession;
module.exports.SESSION_HEADER = SESSION_HEADER;
