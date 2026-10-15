const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

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
    const { name, birth_date, chronic_conditions, allergies } = req.body;
    if (!name) return res.status(400).json({ error: "الاسم مطلوب" });

    const result = await pool.query(
        `INSERT INTO members (user_id, name, birth_date, chronic_conditions, allergies)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [req.userId, name, birth_date || null, chronic_conditions || null, allergies || null]
    );
    res.status(201).json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
    const { name, birth_date, chronic_conditions, allergies } = req.body;
    const result = await pool.query(
        `UPDATE members SET name = $1, birth_date = $2, chronic_conditions = $3, allergies = $4
     WHERE id = $5 AND user_id = $6 RETURNING *`,
        [name, birth_date || null, chronic_conditions || null, allergies || null, req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "الفرد غير موجود" });
    res.json(result.rows[0]);
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