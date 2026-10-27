const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");
const { courses } = require("../course");

const router = express.Router();
router.use(auth);

// جرعات اليوم لكل أفراد العائلة
router.get("/today", async (req, res) => {
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const dayOfWeek = String(new Date(date).getDay() + 1); // 1 = الأحد

    try {
        const result = await pool.query(
            `SELECT
         ds.id AS schedule_id,
         ds.time_of_day,
         m.id AS medication_id,
         m.name AS medication_name,
         cat.name_ar AS medication_name_ar,
         m.strength,
         m.instructions,
         m.units_per_dose,
         mem.id AS member_id,
         mem.name AS member_name,
         dl.id AS log_id,
         dl.status,
         dl.confirmed_at,
         dl.method
       FROM dose_schedules ds
       JOIN medications m ON m.id = ds.medication_id
       JOIN members mem ON mem.id = m.member_id
       LEFT JOIN medicines_catalog cat ON cat.id = m.catalog_id
       LEFT JOIN dose_logs dl
         ON dl.medication_id = m.id
        AND dl.scheduled_at = ($1::date + ds.time_of_day)
       WHERE mem.user_id = $2
         AND m.is_active = TRUE
         AND m.start_date <= $1::date
         AND (m.end_date IS NULL OR m.end_date >= $1::date)
         AND ds.days_of_week LIKE '%' || $3 || '%'
       ORDER BY ds.time_of_day, mem.name`,
            [date, req.userId, dayOfWeek]
        );

        // يوم الكورس على كل جرعة: «اليوم ٤ من ٧»، و«آخر يوم»
        const ids = [...new Set(result.rows.map((d) => d.medication_id))];
        const progress = ids.length ? await courses(pool, { medicationIds: ids }) : new Map();
        for (const d of result.rows) {
            const c = progress.get(d.medication_id)?.course;
            d.course = c ? { day: c.day, total_days: c.total_days, final_day: c.final_day } : null;
        }

        res.json({ date, doses: result.rows });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// تأكيد أخذ جرعة
router.post("/confirm", async (req, res) => {
    const { medication_id, scheduled_at } = req.body;
    // «voice» من صفحة التأكيد الصوتي، وكل ما عداه لمسة زر
    const method = req.body.method === "voice" ? "voice" : "tap";
    if (!medication_id || !scheduled_at)
        return res.status(400).json({ error: "البيانات ناقصة" });

    try {
        const owns = await pool.query(
            `SELECT m.id FROM medications m
       JOIN members mem ON mem.id = m.member_id
       WHERE m.id = $1 AND mem.user_id = $2`,
            [medication_id, req.userId]
        );
        if (!owns.rows.length) return res.status(403).json({ error: "غير مصرح" });

        const existing = await pool.query(
            "SELECT id FROM dose_logs WHERE medication_id = $1 AND scheduled_at = $2",
            [medication_id, scheduled_at]
        );

        let result;
        if (existing.rows.length) {
            result = await pool.query(
                "UPDATE dose_logs SET confirmed_at = NOW(), status = 'taken', method = $2 WHERE id = $1 RETURNING *",
                [existing.rows[0].id, method]
            );
        } else {
            result = await pool.query(
                `INSERT INTO dose_logs (medication_id, scheduled_at, confirmed_at, status, method)
         VALUES ($1, $2, NOW(), 'taken', $3) RETURNING *`,
                [medication_id, scheduled_at, method]
            );
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// آخر الجرعات المؤكَّدة لفرد واحد، وكيف أُكّدت (صوت أو لمسة)
router.get("/recent", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT dl.id, dl.scheduled_at, dl.confirmed_at, dl.method,
                    m.name AS medication_name, m.strength
               FROM dose_logs dl
               JOIN medications m ON m.id = dl.medication_id
               JOIN members mem ON mem.id = m.member_id
              WHERE mem.id = $1 AND mem.user_id = $2
                AND dl.status = 'taken' AND dl.confirmed_at IS NOT NULL
              ORDER BY dl.confirmed_at DESC
              LIMIT 10`,
            [req.query.member_id, req.userId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;