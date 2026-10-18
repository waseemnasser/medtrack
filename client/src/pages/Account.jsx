import { useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate, Link } from "react-router-dom";
import PushToggle from "../components/PushToggle";
import Mark from "../components/Mark";
import { getTheme, setTheme } from "../utils/theme";
import { disablePushForThisDevice } from "../push";
import "./Account.css";

const THEMES = [
    { value: "auto", label: "تلقائي" },
    { value: "light", label: "فاتح" },
    { value: "dark", label: "داكن" },
];

export default function Account() {
    const navigate = useNavigate();
    const [theme, setThemeState] = useState(getTheme);

    // الدائرة تنتشر من الزر المضغوط. flushSync يحدّث الزر المختار
    // داخل نفس اللقطة، حتى لا يقفز بعد انتهاء الحركة
    const chooseTheme = (value, e) => {
        if (value === theme) return;
        // بلوحة المفاتيح لا توجد ضغطة فأرة (detail = 0): نبدأ من منتصف الزر
        const box = e.currentTarget.getBoundingClientRect();
        const origin = e.detail === 0
            ? { x: box.left + box.width / 2, y: box.top + box.height / 2 }
            : { x: e.clientX, y: e.clientY };
        setTheme(value, {
            origin,
            update: () => flushSync(() => setThemeState(value)),
        });
    };

    const logout = async () => {
        // هذا الجهاز لا يستقبل تذكيرات هذا الحساب بعد الخروج —
        // مهم إن كان الحاسوب مشتركاً بين أفراد العائلة
        try {
            await disablePushForThisDevice();
        } catch {
            // الخادم لا يستجيب؟ نكمل الخروج على أي حال
        }
        localStorage.removeItem("token");
        navigate("/login", { replace: true });
    };

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1>الحساب</h1>
                    <p className="sub">المظهر والإشعارات والخصوصية</p>
                </div>
            </div>

            <h2 className="section-title">المظهر</h2>
            <div className="segmented" role="radiogroup" aria-label="المظهر">
                {THEMES.map((t) => (
                    <button
                        key={t.value}
                        type="button"
                        role="radio"
                        aria-checked={theme === t.value}
                        className={theme === t.value ? "on" : ""}
                        onClick={(e) => chooseTheme(t.value, e)}
                    >
                        {t.label}
                    </button>
                ))}
            </div>
            <p className="theme-hint">«تلقائي» يتبع إعداد هاتفك أو حاسوبك.</p>

            <h2 className="section-title">الإشعارات</h2>
            <PushToggle />

            <h2 className="section-title">الخصوصية</h2>
            <div className="settings-card">
                <p>
                    بيانات أهلك تبقى عندك. لا يراها أحد إلا برابط مؤقّت تنشئه أنت
                    من ملف الفرد، وينتهي تلقائياً.
                </p>
                <p>
                    الأدوية المعلّمة «خاصة» لا تظهر في روابط المشاركة أبداً.
                </p>
            </div>

            <h2 className="section-title">عن طمّني</h2>
            <div className="settings-card about">
                <Mark size={44} />
                <div>
                    <strong>طمّني — متابعة أدوية العائلة</strong>
                    <p>
                        أداة تنظيمية فقط: لا تقدّم تشخيصاً ولا توصيات علاجية،
                        ولا تقترح جرعات أو بدائل. استشر طبيبك أو الصيدلاني دائماً.
                    </p>
                    <p className="small">مشروع تخرج — الجامعة الدولية الخاصة للعلوم والتكنولوجيا</p>
                    <Link to="/welcome" className="about-link">عرض الصفحة التعريفية ←</Link>
                </div>
            </div>

            <button className="logout-btn" onClick={logout}>تسجيل الخروج</button>
        </div>
    );
}
