const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

// سجل الإشعارات — ما يظهر في نافذة الجرس.
// كل إشعار يرسله الخادم يُحفظ هنا أولاً (push.js)، فيبقى السجل كاملاً
// حتى على جهاز لم تُفعَّل فيه الإشعارات.

const router = express.Router();
router.use(auth);

// آخر ٥٠ إشعاراً وعدد غير المقروء
router.get("/", async (req, res) => {
    try {
        const list = await pool.query(
            `SELECT id, kind, title, body, url, created_at, read_at
             FROM notifications WHERE user_id = $1
             ORDER BY created_at DESC LIMIT 50`,
            [req.userId]
        );
        const unread = await pool.query(
            "SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL",
            [req.userId]
        );
        res.json({ items: list.rows, unread: unread.rows[0].n });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// العدد فقط — يُسأل عنه دورياً، فيبقى خفيفاً
router.get("/unread", async (req, res) => {
    try {
        const r = await pool.query(
            "SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL",
            [req.userId]
        );
        res.json({ unread: r.rows[0].n });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/read-all", async (req, res) => {
    try {
        await pool.query(
            "UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL",
            [req.userId]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post("/:id/read", async (req, res) => {
    try {
        await pool.query(
            "UPDATE notifications SET read_at = COALESCE(read_at, now()) WHERE id = $1 AND user_id = $2",
            [req.params.id, req.userId]
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
