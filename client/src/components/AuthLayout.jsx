import Mark from "./Mark";
import "../pages/Auth.css";

// ما يقدّمه التطبيق في ثلاثة أسطر — كل سطر بلون إحدى فترات اليوم
const FEATURES = [
    { key: "morning", text: "تذكير بكل جرعة في وقتها" },
    { key: "noon", text: "ملف مستقل لكل فرد من العائلة" },
    { key: "evening", text: "مشاركة آمنة ومؤقّتة مع الطبيب" },
];

/**
 * هيكل صفحتي الدخول وإنشاء الحساب.
 * على الحاسوب: لوحة الهوية الفيروزية بجانب النموذج.
 * على الهاتف: اللوحة تصير ترويسة أعلى الشاشة والنموذج تحتها.
 */
export default function AuthLayout({ tagline, children }) {
    return (
        <div className="auth-shell">
            <aside className="auth-panel">
                <div className="auth-mark">
                    <div className="auth-ring" />
                    <div className="auth-ring b" />
                    <div className="auth-ring c" />
                    <Mark animated color="var(--on-primary)" tickColor="var(--primary)" />
                </div>

                <h1 className="auth-name auth-rise d1">طمّني</h1>
                <p className="auth-tagline auth-rise d1">{tagline}</p>

                <ul className="auth-features auth-rise d2">
                    {FEATURES.map((f) => (
                        <li key={f.key}>
                            <span className={`auth-dot ${f.key}`} aria-hidden="true" />
                            {f.text}
                        </li>
                    ))}
                </ul>
            </aside>

            <main className="auth-main">
                <div className="auth-col auth-rise d2">
                    {children}
                    <p className="auth-privacy">
                        بيانات أهلك تبقى عندك. تُشارَك فقط برابط مؤقّت تنشئه أنت.
                    </p>
                </div>
            </main>
        </div>
    );
}
