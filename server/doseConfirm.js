// تأكيد الجرعة — من زر «تم الأخذ» في التطبيق، أو من زر الإشعار نفسه.
//
// زر الإشعار يعمل في الـ service worker، وهو لا يرى توكن الدخول (محفوظ في
// localStorage). لذلك يحمل كل تذكير جرعة «توكن إجراء» خاصاً به: موقّع، صالح
// ٢٤ ساعة، ولا يسمح إلا بتأكيد هذه الجرعة بعينها لهذا المستخدم. ويُوقَّع بمفتاح
// غير مفتاح الدخول، فلا يصلح توكن دخول هنا ولا يصلح توكن الإجراء للدخول.
const jwt = require("jsonwebtoken");
const pool = require("./db");

const PURPOSE = "dose-confirm";
const actionKey = () => `${process.env.JWT_SECRET}:${PURPOSE}`;

function signDoseAction({ userId, medicationId, scheduledAt }) {
    return jwt.sign(
        { purpose: PURPOSE, uid: userId, mid: medicationId, at: scheduledAt },
        actionKey(),
        { expiresIn: "24h" }
    );
}

// يرمي خطأً إن كان التوكن مزوّراً أو منتهياً أو لغرض آخر
function verifyDoseAction(token) {
    const p = jwt.verify(String(token || ""), actionKey());
    if (p.purpose !== PURPOSE) throw new Error("wrong purpose");
    return { userId: p.uid, medicationId: p.mid, scheduledAt: p.at };
}

// يسجّل الجرعة مأخوذة. يُرجع null إن لم يكن الدواء لهذا المستخدم.
// keepConfirmed: إن كانت مؤكَّدة من قبل لا نغيّر وقت تأكيدها — ضغطة متأخرة
// على إشعار قديم لا تجعل جرعة أُخذت في وقتها «متأخرة» في تقرير الالتزام
async function confirmDose(userId, medicationId, scheduledAt, { keepConfirmed = false } = {}) {
    const owns = await pool.query(
        `SELECT m.id FROM medications m
           JOIN members mem ON mem.id = m.member_id
          WHERE m.id = $1 AND mem.user_id = $2`,
        [medicationId, userId]
    );
    if (!owns.rows.length) return null;

    const existing = await pool.query(
        "SELECT * FROM dose_logs WHERE medication_id = $1 AND scheduled_at = $2",
        [medicationId, scheduledAt]
    );
    const row = existing.rows[0];
    if (row && keepConfirmed && row.status === "taken" && row.confirmed_at) return row;

    const result = row
        ? await pool.query(
            "UPDATE dose_logs SET confirmed_at = NOW(), status = 'taken' WHERE id = $1 RETURNING *",
            [row.id]
        )
        : await pool.query(
            `INSERT INTO dose_logs (medication_id, scheduled_at, confirmed_at, status)
             VALUES ($1, $2, NOW(), 'taken') RETURNING *`,
            [medicationId, scheduledAt]
        );
    return result.rows[0];
}

module.exports = { signDoseAction, verifyDoseAction, confirmDose };
