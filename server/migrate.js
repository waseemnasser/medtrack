const pool = require("./db");

// تعديلات صغيرة على قاعدة البيانات تُطبَّق تلقائياً عند تشغيل الخادم.
// كل سطر آمن للتكرار (IF NOT EXISTS)، فلا يحتاج أحد من الفريق
// أن يشغّل SQL يدوياً بعد سحب التحديثات.
const MIGRATIONS = [
    // تاريخ بدء العلبة الحالية — يتغيّر عند «جدّدت العلبة»
    "ALTER TABLE medications ADD COLUMN IF NOT EXISTS supply_since DATE",
];

async function migrate() {
    for (const sql of MIGRATIONS) await pool.query(sql);
}

module.exports = migrate;
