import { Link } from "react-router-dom";
import Mark from "./Mark";
import ThemeToggle from "./ThemeToggle";
import "../pages/Auth.css";

// ما يقدّمه التطبيق، مرقّماً كقائمة المزايا في الصفحة التعريفية
const POINTS = [
    ["تذكير بكل جرعة", "إشعار في موعد كل جرعة، حتى والتطبيق مغلق."],
    ["ملف لكل شخص", "أدويته ومواعيده وحساسيته في صفحة واحدة."],
    ["مشاركة مؤقّتة مع الطبيب", "رابط يراه الطبيب للقراءة فقط، وينتهي وحده."],
];

/**
 * هيكل صفحتي الدخول وإنشاء الحساب، بأسلوب الصفحة التعريفية:
 * عنوان كبير بخط العرض، والنموذج بجانبه.
 * على الحاسوب: المزايا المرقّمة تحت العنوان. على الهاتف: العنوان ثم النموذج.
 *
 * kicker: سطر فيروزي صغير فوق العنوان
 * headline: العنوان الكبير
 * lead: سطر شرح تحته
 */
export default function AuthLayout({ kicker, headline, lead, children }) {
    return (
        <div className="auth-shell">
            {/* بلا هذا الشريط يعلق الزائر في صفحة الدخول: لا رجوع للصفحة التعريفية */}
            <header className="auth-bar">
                <Link to="/welcome" className="auth-brand" aria-label="طمّني — الصفحة الرئيسية">
                    <Mark size={28} />
                    طمّني
                </Link>
                <div className="auth-bar-end">
                    <Link to="/welcome" className="auth-back">الرئيسية</Link>
                    <ThemeToggle />
                </div>
            </header>

            <div className="auth-grid">
                <section className="auth-intro auth-rise">
                    <p className="auth-kicker">{kicker}</p>
                    <h1 className="auth-headline">{headline}</h1>
                    {lead && <p className="auth-lead">{lead}</p>}

                    <ol className="auth-points">
                        {POINTS.map(([title, text], i) => (
                            <li key={title}>
                                <span className="auth-num">{String(i + 1).padStart(2, "0")}</span>
                                <div>
                                    <b>{title}</b>
                                    <span>{text}</span>
                                </div>
                            </li>
                        ))}
                    </ol>
                </section>

                <main className="auth-main auth-rise d2">
                    {children}
                    <p className="auth-privacy">
                        بياناتك تبقى عندك. تُشارَك فقط برابط مؤقّت تنشئه أنت.
                    </p>
                </main>
            </div>
        </div>
    );
}
