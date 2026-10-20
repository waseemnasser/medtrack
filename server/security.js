// حماية الخادم الأساسية: ترويسات أمان، من يُسمح له بالاتصال، وحدّ للمحاولات.
// ----------------------------------------------------------------
// كلها إعدادات معروفة ومجرّبة (helmet، cors، express-rate-limit)،
// مجمّعة هنا حتى تُقرأ وتُشرح في مكان واحد.

const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

// الواجهات المسموح لها باستدعاء الخادم. عند النشر تُضاف عناوينها في .env:
//   CLIENT_ORIGINS=https://example.com,https://www.example.com
const DEFAULT_ORIGINS = [
    "http://localhost:5173",      // npm run dev
    "http://127.0.0.1:5173",
    "http://localhost:4173",      // npm run preview
    "https://waseemnasser.github.io",
];

function allowedOrigins() {
    const extra = (process.env.CLIENT_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
    return new Set([...DEFAULT_ORIGINS, ...extra]);
}

// رسالة عربية بدل نص المكتبة الافتراضي
const tooMany = (message) => (req, res) => res.status(429).json({ error: message });

// تسجيل الدخول وإنشاء الحساب: ١٠ محاولات كل ١٥ دقيقة لكل عنوان.
// يمنع تجربة كلمات المرور واحدة بعد الأخرى.
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: tooMany("محاولات كثيرة. انتظر ربع ساعة ثم حاول من جديد."),
});

// صفحة الطبيب عامة بلا تسجيل دخول: نحدّ تخمين الروابط
const shareLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: tooMany("طلبات كثيرة على هذا الرابط. حاول بعد دقيقة."),
});

// حدّ عام سخيّ لكل الطلبات — يوقف أي سكربت يغرق الخادم
const apiLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: tooMany("طلبات كثيرة. حاول بعد دقيقة."),
});

function applySecurity(app) {
    // خلف خادم وسيط عند النشر (Render وأمثاله): نأخذ عنوان المستخدم الحقيقي
    if (process.env.TRUST_PROXY) app.set("trust proxy", 1);

    // ترويسات أمان قياسية. الخادم يعيد JSON فقط، والواجهة على عنوان آخر،
    // فنسمح بقراءة الردود من عنوان مختلف
    app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

    const origins = allowedOrigins();
    app.use(cors({
        origin(origin, done) {
            // بلا Origin: طلب من الخادم نفسه أو أداة سطر أوامر — مسموح
            if (!origin || origins.has(origin)) return done(null, true);
            return done(null, false);
        },
    }));

    app.use("/api", apiLimiter);
    app.use(["/api/auth/login", "/api/auth/register"], authLimiter);
}

module.exports = { applySecurity, shareLimiter };
