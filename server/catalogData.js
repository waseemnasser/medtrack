// بيانات الكتالوغ التي تُبنى تلقائياً عند تشغيل الخادم.
// لا يحتاج أحد من الفريق أن يعيد استيراد الكتالوغ بعد سحب التحديثات.

const fs = require("fs");
const path = require("path");

const CATALOG_FILE = path.join(__dirname, "..", "database", "medicines_catalog.sql");

// الأسماء العربية (name_ar) لقاعدة بيانات استُوردت قبل إضافة العمود:
// نقرأ صفوف الملف إلى جدول مؤقت ونملأ العمود — بالترتيب نفسه أولاً،
// ثم بمطابقة الاسم والمادة والعيار والشكل لما بقي.
async function ensureArabicNames(pool) {
    const missing = await pool.query("SELECT 1 FROM medicines_catalog WHERE name_ar IS NULL LIMIT 1");
    if (!missing.rows.length || !fs.existsSync(CATALOG_FILE)) return;

    const sql = fs.readFileSync(CATALOG_FILE, "utf8");
    const start = sql.indexOf("INSERT INTO medicines_catalog");
    if (start < 0 || !sql.includes("name_ar", start)) return;
    const insert = sql.slice(start, sql.lastIndexOf(";") + 1);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(`CREATE TEMP TABLE catalog_import (
            n SERIAL, brand_name TEXT, name_ar TEXT, active_ingredient TEXT,
            strength TEXT, form TEXT, manufacturer TEXT) ON COMMIT DROP`);
        await client.query(insert.replace("INSERT INTO medicines_catalog", "INSERT INTO catalog_import"));
        await client.query(`UPDATE medicines_catalog m SET name_ar = i.name_ar
            FROM catalog_import i
            WHERE m.name_ar IS NULL AND m.id = i.n AND m.brand_name = i.brand_name`);
        await client.query(`UPDATE medicines_catalog m SET name_ar = i.name_ar
            FROM catalog_import i
            WHERE m.name_ar IS NULL AND m.brand_name = i.brand_name
              AND COALESCE(m.active_ingredient, '') = COALESCE(i.active_ingredient, '')
              AND COALESCE(m.strength, '') = COALESCE(i.strength, '')
              AND COALESCE(m.form, '') = COALESCE(i.form, '')`);
        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { ensureArabicNames };
