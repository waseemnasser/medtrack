const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

// مواعيد كل العائلة، أو فرد محدد
router.get("/", async (req, res) => {
    const { member_id, upcoming } = req.query;

    let sql = `SELECT a.*, m.name AS member_name
             FROM appointments a
             JOIN members m ON m.id = a.member_id
             WHERE m.user_id = $1`;
    const params = [req.userId];

    if (member_id) {
        params.push(member_id);
        sql += ` AND a.member_id = $${params.length}`;
    }
    if (upcoming === "true") sql += ` AND a.scheduled_at >= NOW()`;

    sql += ` ORDER BY a.scheduled_at`;

    const result = await pool.query(sql, params);
    res.json(result.rows);
});

router.post("/", async (req, res) => {
    const { member_id, title, doctor_name, location, scheduled_at, notes } = req.body;
    if (!member_id || !title || !scheduled_at)
        return res.status(400).json({ error: "العنوان والتاريخ والفرد مطلوبين" });

    const owns = await pool.query(
        "SELECT id FROM members WHERE id = $1 AND user_id = $2",
        [member_id, req.userId]
    );
    if (!owns.rows.length) return res.status(403).json({ error: "غير مصرح" });

    const result = await pool.query(
        `INSERT INTO appointments (member_id, title, doctor_name, location, scheduled_at, notes)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
        [member_id, title, doctor_name || null, location || null, scheduled_at, notes || null]
    );
    res.status(201).json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
    const { title, doctor_name, location, scheduled_at, notes } = req.body;
    const result = await pool.query(
        // إن تغيّر وقت الموعد نعيد تذكيراته؛ في UPDATE تشير الأعمدة إلى القيم القديمة
        `UPDATE appointments SET title=$1, doctor_name=$2, location=$3, scheduled_at=$4, notes=$5,
            reminded_day_before = CASE WHEN scheduled_at IS DISTINCT FROM $4::timestamp THEN FALSE ELSE reminded_day_before END,
            reminded_soon       = CASE WHEN scheduled_at IS DISTINCT FROM $4::timestamp THEN FALSE ELSE reminded_soon END
     WHERE id=$6 AND member_id IN (SELECT id FROM members WHERE user_id=$7)
     RETURNING *`,
        [title, doctor_name || null, location || null, scheduled_at, notes || null, req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "الموعد غير موجود" });
    res.json(result.rows[0]);
});

router.delete("/:id", async (req, res) => {
    const result = await pool.query(
        `DELETE FROM appointments
     WHERE id=$1 AND member_id IN (SELECT id FROM members WHERE user_id=$2)
     RETURNING id`,
        [req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "الموعد غير موجود" });
    res.json({ ok: true });
});

module.exports = router;