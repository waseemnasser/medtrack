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

// إشعار تجريبي — مفيد جداً أثناء التطوير والعرض
router.post("/test", async (req, res) => {
    await sendToUser(req.userId, {
        title: "تجربة الإشعارات",
        body: "الإشعارات تعمل بنجاح ✓",
        url: "/",
    });
    res.json({ ok: true });
});

module.exports = router;