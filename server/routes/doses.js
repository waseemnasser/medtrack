const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");
const { courses } = require("../course");
const { confirmDose, verifyDoseAction } = require("../doseConfirm");

const router = express.Router();

// زر «تم الأخذ» في الإشعار نفسه (sw.js). بلا توكن دخول: توكن الإجراء الموقّع
// في التذكير يكفي، ولا يؤكّد إلا تلك الجرعة. قبل router.use(auth) عمداً.
router.post("/confirm-action", async (req, res) => {
    let action;
    try {
        action = verifyDoseAction(req.body.token);
    } catch {
        return res.status(401).json({ error: "انتهت صلاحية التذكير، افتح التطبيق لتأكيد الجرعة" });
    }
    try {
        const { userId, medicationId, scheduledAt } = action;
        const log = await confirmDose(userId, medicationId, scheduledAt, { keepConfirmed: true });
        if (!log) return res.status(404).json({ error: "الدواء لم يعد موجوداً" });
        // إشعار الجرعة نفسه يُعلَّم مقروءاً في الجرس — أُنجز ما فيه
        const nid = Number(req.body.notification_id);
        if (Number.isInteger(nid)) {
            await pool.query(
                "UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL",
                [nid, userId]
            );
        }
        res.json(log);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.use(auth);

// جرعات اليوم لكل أفراد العائلة
router.get("/today", async (req, res) => {
    // اليوم بتوقيت الخادم (TZ) مثل المجدول في push.js — toISOString بتوقيت UTC
    // كان يُرجع «أمس» بين منتصف الليل والثالثة فجراً بتوقيت دمشق
    const now = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    const date = req.query.date || `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const dayOfWeek = String(new Date(`${date}T00:00`).getDay() + 1); // 1 = الأحد

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
         dl.confirmed_at
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
    if (!medication_id || !scheduled_at)
        return res.status(400).json({ error: "البيانات ناقصة" });

    try {
        const log = await confirmDose(req.userId, medication_id, scheduled_at);
        if (!log) return res.status(403).json({ error: "غير مصرح" });
        res.json(log);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;