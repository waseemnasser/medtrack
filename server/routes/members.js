const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");
const { listAllergies, replaceAllergies, memberConflicts } = require("../allergy");

const router = express.Router();
router.use(auth);

router.get("/", async (req, res) => {
    const result = await pool.query(
        "SELECT * FROM members WHERE user_id = $1 ORDER BY id",
        [req.userId]
    );
    res.json(result.rows);
});

router.post("/", async (req, res) => {
    const { name, birth_date, chronic_conditions } = req.body;
    if (!name) return res.status(400).json({ error: "الاسم مطلوب" });

    // الحساسية تُحفظ بعدها عبر PUT /:id/allergies — صفوف منظّمة لا نص
    const result = await pool.query(
        `INSERT INTO members (user_id, name, birth_date, chronic_conditions)
     VALUES ($1, $2, $3, $4) RETURNING *`,
        [req.userId, name, birth_date || null, chronic_conditions || null]
    );
    res.status(201).json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
    const { name, birth_date, chronic_conditions } = req.body;
    const result = await pool.query(
        `UPDATE members SET name = $1, birth_date = $2, chronic_conditions = $3
     WHERE id = $4 AND user_id = $5 RETURNING *`,
        [name, birth_date || null, chronic_conditions || null, req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "الفرد غير موجود" });
    res.json(result.rows[0]);
});

// ---------- الحساسية ----------

async function ownedMember(id, userId) {
    const r = await pool.query("SELECT id, name FROM members WHERE id = $1 AND user_id = $2", [id, userId]);
    return r.rows[0] || null;
}

// حساسية الفرد، ومعها تعارضها مع أدويته الحالية (الفحص في الاتجاه المعاكس)
router.get("/:id/allergies", async (req, res) => {
    try {
        const member = await ownedMember(req.params.id, req.userId);
        if (!member) return res.status(404).json({ error: "الفرد غير موجود" });
        res.json({
            allergies: await listAllergies(pool, member.id),
            conflicts: await memberConflicts(pool, member.id, member.name),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// تستبدل القائمة كلها. تُرجع التعارضات مع الأدوية الحالية فوراً:
// حساسية جديدة لدواء يأخذه الفرد أصلاً يجب أن تظهر الآن، لا عند الدواء القادم
router.put("/:id/allergies", async (req, res) => {
    try {
        const member = await ownedMember(req.params.id, req.userId);
        if (!member) return res.status(404).json({ error: "الفرد غير موجود" });
        await replaceAllergies(pool, member.id, req.body.items);
        res.json({
            allergies: await listAllergies(pool, member.id),
            conflicts: await memberConflicts(pool, member.id, member.name),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    const result = await pool.query(
        "DELETE FROM members WHERE id = $1 AND user_id = $2 RETURNING id",
        [req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "الفرد غير موجود" });
    res.json({ ok: true });
});

module.exports = router;