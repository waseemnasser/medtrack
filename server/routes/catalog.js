const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");
const { searchAllergens } = require("../allergy");
const { searchCatalog } = require("../catalogSearch");

const router = express.Router();
router.use(auth);

// البحث بالاسم التجاري أو العربي أو المادة الفعّالة — الترتيب والمرادفات في catalogSearch.js
router.get("/search", async (req, res) => {
    try {
        res.json(await searchCatalog(pool, req.query.q));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// مسبّبات الحساسية والمواد الفعّالة: عائلات، مواد، وأسماء تجارية (← موادها)
// types: «class,ingredient,brand» — نموذج الدواء يطلب المواد والأسماء التجارية فقط
router.get("/allergens", async (req, res) => {
    try {
        const types = String(req.query.types || "class,ingredient,brand").split(",");
        res.json(await searchAllergens(pool, String(req.query.q || "").slice(0, 80), types));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;