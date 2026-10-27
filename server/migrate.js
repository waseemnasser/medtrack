const pool = require("./db");
const { ensureArabicNames } = require("./catalogData");
const { syncIngredients } = require("./ingredients");
const { syncDrugClasses } = require("./drugClasses");
const { setupAllergyTables } = require("./allergy");

// تعديلات صغيرة على قاعدة البيانات تُطبَّق تلقائياً عند تشغيل الخادم.
// كل سطر آمن للتكرار (IF NOT EXISTS)، فلا يحتاج أحد من الفريق
// أن يشغّل SQL يدوياً بعد سحب التحديثات.
const MIGRATIONS = [
    // تاريخ بدء العلبة الحالية — يتغيّر عند «جدّدت العلبة»
    "ALTER TABLE medications ADD COLUMN IF NOT EXISTS supply_since DATE",
    // هل أُرسل تذكير الموعد؟ في القاعدة لا في الذاكرة، فإعادة تشغيل الخادم لا تكرّره
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminded_day_before BOOLEAN NOT NULL DEFAULT FALSE",
    "ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminded_soon BOOLEAN NOT NULL DEFAULT FALSE",
    // الاسم العربي في الكتالوغ — نقل صوتي للبحث فقط، يُملأ من ملف الكتالوغ أدناه
    "ALTER TABLE medicines_catalog ADD COLUMN IF NOT EXISTS name_ar TEXT",
    // سجل الإشعارات — نافذة الجرس (routes/notifications.js)
    `CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        kind TEXT NOT NULL DEFAULT 'other',
        title TEXT NOT NULL,
        body TEXT,
        url TEXT NOT NULL DEFAULT '/',
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        read_at TIMESTAMP
    )`,
    "CREATE INDEX IF NOT EXISTS notifications_user_time ON notifications (user_id, created_at DESC)",
    // الكورس (course.js): end_date = النهاية المخطّطة، وهذان = متى أُوقف فعلاً ولماذا
    "ALTER TABLE medications ADD COLUMN IF NOT EXISTS stopped_on DATE",
    "ALTER TABLE medications ADD COLUMN IF NOT EXISTS stop_reason TEXT",
    // بطاقة الطوارئ (routes/members.js): فصيلة الدم والجنس وملاحظة للمسعف
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS blood_type TEXT",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS gender TEXT",
    "ALTER TABLE members ADD COLUMN IF NOT EXISTS emergency_notes TEXT",
    `CREATE TABLE IF NOT EXISTS emergency_contacts (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        relation TEXT,
        position INTEGER NOT NULL DEFAULT 0
    )`,
    "CREATE INDEX IF NOT EXISTS emergency_contacts_member ON emergency_contacts (member_id, position)",
    // كيف أُكّدت الجرعة: لمسة زر أو أمر صوتي (صفحة التأكيد الصوتي)
    "ALTER TABLE dose_logs ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'tap'",
];

async function migrate() {
    for (const sql of MIGRATIONS) await pool.query(sql);
    await ensureArabicNames(pool);
    // المواد الفعّالة كجداول — أساس فحص الحساسية (ingredients.js)
    await syncIngredients(pool);
    await syncDrugClasses(pool);
    // حساسية الأفراد كصفوف منظّمة، وترحيل النص القديم (allergy.js)
    await setupAllergyTables(pool);
}

module.exports = migrate;
