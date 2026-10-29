const { Pool, types } = require("pg");
require("dotenv").config();

// خلي حقول DATE ترجع نص كما هي بدون تحويل توقيت
types.setTypeParser(1082, (value) => value);
types.setTypeParser(1114, (value) => value);   // TIMESTAMP WITHOUT TIME ZONE

// كلمة مرور فيها # أو @ أو / تكسر الرابط إن لم تُرمَّز. نرمّزها نحن
// (كل ما بين أول «:» بعد اسم المستخدم وآخر «@»)، ولا نطبع الرابط أبداً لأن فيه كلمة المرور
function parseUrl(raw) {
    const m = raw.trim().match(/^(\w+:\/\/[^:/@]+):(.*)@([^@]+)$/);
    try {
        if (!m) return new URL(raw.trim());
        // كلمة مرور مرمّزة من قبل (%40...) لا نرمّزها مرتين
        let password = m[2];
        try { password = decodeURIComponent(password); } catch { /* فيها % عادية */ }
        return new URL(`${m[1]}:${encodeURIComponent(password)}@${m[3]}`);
    } catch { /* يقع في الرسالة أدناه */ }
    throw new Error("DATABASE_URL غير صالح — تأكّد أنه منسوخ كاملاً بالشكل postgresql://user:password@host:port/db");
}

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
    const url = parseUrl(raw);
    // خطأ شائع: نسخ عنوان مشروع Supabase (https://...supabase.co) بدل رابط قاعدة البيانات
    if (!/^postgres(ql)?:$/.test(url.protocol)) {
        throw new Error("DATABASE_URL يجب أن يبدأ بـ postgresql:// — هذا عنوان موقع وليس رابط قاعدة بيانات (Supabase ← Connect ← Session pooler)");
    }
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
// وإلا وصلت التذكيرات متأخرة أو مبكرة بفارق التوقيت.
// ومسار الجداول public صراحةً: وسيط Supabase يعيد استعمال الاتصالات،
// فإعداد تركه برنامج آخر على الاتصال قد يخفي جداولنا
if (process.env.DATABASE_URL || process.env.TZ) {
    pool.on("connect", (client) => {
        client.query("SELECT set_config('search_path', 'public', false)").catch(() => { });
        if (process.env.TZ) {
            client.query("SELECT set_config('TimeZone', $1, false)", [process.env.TZ]).catch(() => { });
        }
    });
}

module.exports = pool;
