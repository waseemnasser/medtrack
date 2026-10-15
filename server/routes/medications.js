const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

// التأكد إن الفرد يتبع للمستخدم الحالي
async function ownsMember(memberId, userId) {
    const r = await pool.query(
        "SELECT id FROM members WHERE id = $1 AND user_id = $2",
        [memberId, userId]
    );
    return r.rows.length > 0;
}

// أدوية فرد معين مع أوقات جرعاته
router.get("/member/:memberId", async (req, res) => {
    if (!(await ownsMember(req.params.memberId, req.userId)))
        return res.status(403).json({ error: "غير مصرح" });

    const meds = await pool.query(
        "SELECT * FROM medications WHERE member_id = $1 AND is_active = TRUE ORDER BY id",
        [req.params.memberId]
    );

    for (const med of meds.rows) {
        const times = await pool.query(
            "SELECT id, time_of_day, days_of_week FROM dose_schedules WHERE medication_id = $1 ORDER BY time_of_day",
            [med.id]
        );
        med.schedules = times.rows;
    }

    res.json(meds.rows);
});

// إضافة دواء مع أوقاته
router.post("/", async (req, res) => {
    const {
        member_id, catalog_id, name, active_ingredient, strength, form,
        instructions, start_date, end_date, units_total, units_per_dose,
        is_private, times,
    } = req.body;

    if (!member_id || !name || !start_date)
        return res.status(400).json({ error: "اسم الدواء وتاريخ البدء والفرد مطلوبين" });

    if (!(await ownsMember(member_id, req.userId)))
        return res.status(403).json({ error: "غير مصرح" });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const med = await client.query(
            `INSERT INTO medications
       (member_id, catalog_id, name, active_ingredient, strength, form, instructions,
        start_date, end_date, units_total, units_per_dose, is_private)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
            [member_id, catalog_id || null, name, active_ingredient || null, strength || null,
                form || null, instructions || null, start_date, end_date || null,
                units_total || null, units_per_dose || 1, is_private || false]
        );

        const medication = med.rows[0];
        medication.schedules = [];

        if (Array.isArray(times)) {
            for (const t of times) {
                const s = await client.query(
                    `INSERT INTO dose_schedules (medication_id, time_of_day, days_of_week)
           VALUES ($1,$2,$3) RETURNING id, time_of_day, days_of_week`,
                    [medication.id, t.time_of_day, t.days_of_week || "1234567"]
                );
                medication.schedules.push(s.rows[0]);
            }
        }

        await client.query("COMMIT");
        res.status(201).json(medication);
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// إيقاف دواء بدل حذفه
router.patch("/:id/stop", async (req, res) => {
    const r = await pool.query(
        `UPDATE medications SET is_active = FALSE, end_date = COALESCE(end_date, CURRENT_DATE)
     WHERE id = $1 AND member_id IN (SELECT id FROM members WHERE user_id = $2)
     RETURNING *`,
        [req.params.id, req.userId]
    );
    if (!r.rows.length) return res.status(404).json({ error: "الدواء غير موجود" });
    res.json(r.rows[0]);
});
// متى يخلص الدواء
router.get("/:id/supply", async (req, res) => {
    try {
        const med = await pool.query(
            `SELECT m.* FROM medications m
       JOIN members mem ON mem.id = m.member_id
       WHERE m.id = $1 AND mem.user_id = $2`,
            [req.params.id, req.userId]
        );
        if (!med.rows.length) return res.status(404).json({ error: "الدواء غير موجود" });

        const medication = med.rows[0];
        if (!medication.units_total)
            return res.json({ known: false, message: "عدد الحبات غير مسجل" });

        const sched = await pool.query(
            "SELECT days_of_week FROM dose_schedules WHERE medication_id = $1",
            [req.params.id]
        );
        if (!sched.rows.length)
            return res.json({ known: false, message: "لا توجد مواعيد مسجلة" });

        // استهلاك الأسبوع: كل موعد × عدد أيامه × كمية الجرعة
        const perDose = Number(medication.units_per_dose) || 1;
        let weekly = 0;
        for (const s of sched.rows) weekly += (s.days_of_week || "1234567").length * perDose;
        const perDay = weekly / 7;

        const start = new Date(medication.start_date);
        const today = new Date(new Date().toISOString().slice(0, 10));
        const daysPassed = Math.max(0, Math.round((today - start) / 86400000));

        const consumed = daysPassed * perDay;
        const remaining = Math.max(0, medication.units_total - consumed);
        const daysLeft = perDay > 0 ? Math.floor(remaining / perDay) : null;

        const depletionDate = new Date(today);
        depletionDate.setDate(depletionDate.getDate() + (daysLeft || 0));

        res.json({
            known: true,
            units_total: medication.units_total,
            per_day: Number(perDay.toFixed(2)),
            consumed_estimate: Math.round(consumed),
            remaining_estimate: Math.round(remaining),
            days_left: daysLeft,
            depletion_date: depletionDate.toISOString().slice(0, 10),
            needs_refill_soon: daysLeft !== null && daysLeft <= 4,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;