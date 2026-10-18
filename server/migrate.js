const pool = require("./db");

// تعديلات صغيرة على قاعدة البيانات تُطبَّق تلقائياً عند تشغيل الخادم.
// كل سطر آمن للتكرار (IF NOT EXISTS)، فلا يحتاج أحد من الفريق
// أن يشغّل SQL يدوياً بعد سحب التحديثات.
const MIGRATIONS = [
    // تاريخ بدء العلبة الحالية — يتغيّر عند «جدّدت العلبة»
    "ALTER TABLE medications ADD COLUMN IF NOT EXISTS supply_since DATE",
    // هل أُرسل تذكير الموعد؟ في القاعدة لا في الذاكرة، فإعادة تشغيل الخادم لا تكرّره
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminded_day_before BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminded_soon BOOLEAN NOT NULL DEFAULT FALSE",
];

async function migrate() {
    for (const sql of MIGRATIONS) await pool.query(sql);
}

module.exports = migrate;
