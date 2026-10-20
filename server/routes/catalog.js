const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");
const { searchArabic, hasArabic, explainAllergies } = require("../drugmatch");

const router = express.Router();
router.use(auth);

// توحيد أشكال الحروف العربية: «أسبرين» و«اسبرين» كلمة واحدة
// (أ إ آ ← ا، ى ← ي، ة ← ه) — نفس التحويل في SQL وفي normAr
const AR_NORM = "translate(name_ar, 'أإآىة', 'ااايه')";
const normAr = (s) => s.replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[ً-ْ]/g, ""); // التشكيل
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => "\\" + c);

router.get("/search", async (req, res) => {
    const q = (req.query.q || "").trim();
    if (q.length < 2) return res.json([]);

    try {
        if (hasArabic(q)) {
            // ١. الاسم العربي في الكتالوغ: من بداية الاسم أولاً، ثم من بداية أي كلمة فيه
            const term = escapeLike(normAr(q));
            const byName = (await pool.query(
                `SELECT id, brand_name, name_ar, active_ingredient, strength, form
                 FROM medicines_catalog
                 WHERE ${AR_NORM} LIKE $1 || '%' OR ${AR_NORM} LIKE '% ' || $1 || '%'
                 ORDER BY (${AR_NORM} LIKE $1 || '%') DESC, length(brand_name), brand_name
                 LIMIT 15`,
                [term]
            )).rows;
            if (byName.length >= 15) return res.json(byName);

            // ٢. بالصوت للمادة الفعّالة وما فات الاسمَ العربي («باراسيتامول» ← PARACETAMOL)
            const seen = new Set(byName.map((r) => r.id));
            const bySound = (await searchArabic(q)).filter((r) => !seen.has(r.id));
            return res.json([...byName, ...bySound].slice(0, 15));
        }

        const result = await pool.query(
            `SELECT id, brand_name, name_ar, active_ingredient, strength, form
             FROM medicines_catalog
             WHERE brand_name ILIKE $1 OR active_ingredient ILIKE $1
             ORDER BY brand_name LIMIT 15`,
            [escapeLike(q) + "%"]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// نموذج الفرد: كيف سيُفهم كل بند في خانة الحساسية؟
// «ASITAMOL» ← اسم تجاري مادته PARACETAMOL، «غبار» ← غير موجود في الكتالوغ
router.get("/allergy-explain", async (req, res) => {
    try {
        res.json(await explainAllergies(String(req.query.text || "").slice(0, 500)));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;