const { Pool, types } = require("pg");
require("dotenv").config();

// خلي حقول DATE ترجع نص كما هي بدون تحويل توقيت
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1114, (value) => value);   // TIMESTAMP WITHOUT TIME ZONE

// على الإنترنت: رابط قاعدة البيانات كاملاً في DATABASE_URL (Supabase وأمثاله).
// محلياً: قاعدة medtrack على هذا الجهاز كما كانت
function config() {
    const raw = process.env.DATABASE_URL;
    if (!raw) {
        return {
            user: "postgres",
            password: process.env.DB_PASSWORD,
            host: "localhost",
            port: 5432,
            database: "medtrack",
        };
    }
    const url = new URL(raw);
    const local = ["localhost", "127.0.0.1"].includes(url.hostname);
    // sslmode في الرابط يفرض التحقق من شهادة لا تقبلها مكتبة pg عند Supabase —
    // نحذفه ونطلب اتصالاً مشفّراً بأنفسنا
    url.searchParams.delete("sslmode");
    return {
        connectionString: url.toString(),
        ssl: local ? false : { rejectUnauthorized: false },
    };
}

const pool = new Pool(config());

// خوادم الاستضافة تعمل بتوقيت غرينتش، والجرعات والمواعيد محفوظة بالتوقيت المحلي.
// TZ (مثلاً Asia/Damascus) يضبط ساعة Node وساعة قاعدة البيانات معاً،
// وإلا وصلت التذكيرات متأخرة أو مبكرة بفارق التوقيت
if (process.env.TZ) {
    pool.on("connect", (client) => {
        client.query("SELECT set_config('TimeZone', $1, false)", [process.env.TZ]).catch(() => { });
    });
}

module.exports = pool;
