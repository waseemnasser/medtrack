const express = require("express");
const crypto = require("crypto");
const QRCode = require("qrcode");
const pool = require("../db");
const { listAllergies } = require("../allergy");
const auth = require("../middleware/auth");

const router = express.Router();

/* ========== 1) إنشاء رابط مشاركة — يتطلب تسجيل دخول ========== */
router.post("/:memberId", auth, async (req, res) => {
    try {
        const { memberId } = req.params;
        const hours = Number(req.body.hours) || 24;

        // تأكد أن هذا الفرد يتبع للمستخدم الحالي
        const own = await pool.query(
            "SELECT * FROM members WHERE id = $1 AND user_id = $2",
            [memberId, req.userId]
        );
        if (own.rows.length === 0) {
            return res.status(404).json({ error: "هذا الفرد غير موجود" });
        }

        const token = crypto.randomBytes(16).toString("hex");

        const result = await pool.query(
            `INSERT INTO share_links (member_id, user_id, token, expires_at)
       VALUES ($1, $2, $3, NOW() + ($4 || ' hours')::interval)
       RETURNING token, expires_at`,
            [memberId, req.userId, token, String(hours)]
        );

        const base = process.env.PUBLIC_URL || "http://localhost:5173";
        const url = `${base}/share/${token}`;
        const qr_data_url = await QRCode.toDataURL(url);

        res.status(201).json({
            url,
            expires_at: result.rows[0].expires_at,
            qr_data_url,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "خطأ في إنشاء رابط المشاركة" });
    }
});

/* ========== 2) فتح الرابط — عام، بدون تسجيل دخول ========== */
router.get("/:token", async (req, res) => {
    try {
        const link = await pool.query(
            "SELECT * FROM share_links WHERE token = $1",
            [req.params.token]
        );
        if (link.rows.length === 0) {
            return res.status(404).json({ error: "رابط غير صحيح" });
        }
        if (new Date(link.rows[0].expires_at) < new Date()) {
            return res.status(410).json({ error: "انتهت صلاحية هذا الرابط" });
        }

        const memberId = link.rows[0].member_id;

        const member = await pool.query(
            "SELECT id, name, birth_date, chronic_conditions, allergies FROM members WHERE id = $1",
            [memberId]
        );

        // الأدوية الفعّالة فقط، مع استثناء الأدوية الخاصة
        const meds = await pool.query(
            `SELECT m.id, m.name, m.active_ingredient, m.strength, m.form,
              m.instructions, m.start_date, m.end_date, m.units_per_dose,
              COALESCE(
                json_agg(json_build_object('time_of_day', ds.time_of_day,
                                           'days_of_week', ds.days_of_week))
                FILTER (WHERE ds.id IS NOT NULL), '[]'
              ) AS schedules
       FROM medications m
       LEFT JOIN dose_schedules ds ON ds.medication_id = m.id
       WHERE m.member_id = $1
         AND COALESCE(m.is_private, FALSE) = FALSE
         AND COALESCE(m.is_active, TRUE) = TRUE
       GROUP BY m.id
       ORDER BY m.id DESC`,
            [memberId]
        );

        const appts = await pool.query(
            `SELECT id, title, doctor_name, location, scheduled_at, notes
       FROM appointments
       WHERE member_id = $1 AND scheduled_at >= NOW()
       ORDER BY scheduled_at ASC`,
            [memberId]
        );

        const logs = await pool.query(
            `SELECT dl.id, dl.scheduled_at, dl.confirmed_at, dl.status,
              m.name AS medication_name
       FROM dose_logs dl
       JOIN medications m ON m.id = dl.medication_id
       WHERE m.member_id = $1
         AND COALESCE(m.is_private, FALSE) = FALSE
       ORDER BY dl.scheduled_at DESC
       LIMIT 50`,
            [memberId]
        );

        // الحساسية منظّمة مع شدّتها ونوع التفاعل — أهم ما يقرؤه الطبيب
        const allergies = (await listAllergies(pool, memberId)).map((x) => ({
            label: x.label,
            kind: x.kind,
            latin: x.kind === "class" ? x.class_name : x.kind === "ingredient" ? x.ingredient_name : null,
            severity: x.severity,
            reaction: x.reaction,
        }));

        res.json({
            member: member.rows[0],
            allergies,
            medications: meds.rows,
            upcoming_appointments: appts.rows,
            self_reported_confirmations: logs.rows,
            note: "هذه البيانات مُدخلة من قبل المستخدم نفسه (سجل تأكيد ذاتي) وليست سجلاً طبياً موثقاً.",
            expires_at: link.rows[0].expires_at,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "خطأ في قراءة بيانات المشاركة" });
    }
});

module.exports = router;