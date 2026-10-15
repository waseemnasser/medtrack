const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");

const router = express.Router();
router.use(auth);

router.get("/search", async (req, res) => {
    const q = (req.query.q || "").trim();
    if (q.length < 2) return res.json([]);

    const result = await pool.query(
        `SELECT id, brand_name, active_ingredient, strength, form
     FROM medicines_catalog
     WHERE brand_name ILIKE $1 OR active_ingredient ILIKE $1
     ORDER BY brand_name LIMIT 15`,
        [q + "%"]
    );
    res.json(result.rows);
});

module.exports = router;