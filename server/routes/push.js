const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");
const { sendToUser } = require("../push");

const router = express.Router();

// المفتاح العام — عام ولا يحتاج تسجيل دخول
router.get("/key", (req, res) => {
    res.json({ key: process.env.VAPID_PUBLIC });
});

router.use(auth);

// تسجيل جهاز جديد
router.post("/subscribe", async (req, res) => {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth)
        return res.status(400).json({ error: "بيانات الاشتراك ناقصة" });

    try {
        await pool.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id = EXCLUDED.user_id,
             p256dh  = EXCLUDED.p256dh,
             auth    = EXCLUDED.auth`,
            [req.userId, endpoint, keys.p256dh, keys.auth]
        );
        res.status(201).json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// إلغاء ربط جهاز بالحساب — عند تسجيل الخروج
router.post("/unsubscribe", async (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ error: "الجهاز غير محدد" });
    try {
        await pool.query(
            "DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2",
            [endpoint, req.userId]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// إشعار تجريبي — مفيد جداً أثناء التطوير والعرض
router.post("/test", async (req, res) => {
    try {
        const subs = await pool.query(
            "SELECT COUNT(*)::int AS n FROM push_subscriptions WHERE user_id = $1",
            [req.userId]
        );
        if (subs.rows[0].n === 0)
            return res.status(400).json({ error: "لا يوجد جهاز مربوط بهذا الحساب — اضغط «تفعيل» من جديد" });

        const { sent } = await sendToUser(req.userId, {
            title: "تجربة الإشعارات",
            body: "الإشعارات تعمل بنجاح ✓",
            url: "/",
        }, "test");
        if (sent === 0)
            return res.status(502).json({ error: "لم يصل الإشعار إلى أي جهاز — أعد تفعيل الإشعارات على هذا الجهاز" });

        res.json({ ok: true, devices: sent });
    } catch (err) {
        console.error("[push] test:", err.message);
        res.status(500).json({ error: "خطأ في الخادم أثناء إرسال الإشعار" });
    }
});

module.exports = router;