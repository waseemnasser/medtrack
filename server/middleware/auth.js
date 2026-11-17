const jwt = require("jsonwebtoken");
const pool = require("../db");

// توكن الدخول يحمل «إصدار كلمة المرور» (pv). تغيير كلمة المرور أو استعادتها
// يرفع الإصدار، فتسقط كل الجلسات الأقدم على كل الأجهزة — جلسة مسروقة لا
// تبقى صالحة بعد أن يغيّر صاحب الحساب كلمة مروره.
function signSession(user) {
    return jwt.sign(
        { id: user.id, pv: user.password_version || 0 },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
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

    try {
        const r = await pool.query("SELECT password_version FROM users WHERE id = $1", [decoded.id]);
        // توكنات ما قبل هذه الميزة بلا pv — تُعامل كإصدار 0 فلا يخرج أحد فجأة
        if (!r.rows.length || (decoded.pv || 0) !== r.rows[0].password_version)
            return res.status(401).json({ error: "تغيّرت كلمة المرور، سجّل دخولك من جديد" });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }

    req.userId = decoded.id;
    next();
}

module.exports = auth;
module.exports.signSession = signSession;
