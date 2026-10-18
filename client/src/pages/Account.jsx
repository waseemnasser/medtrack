import { useNavigate } from "react-router-dom";
import PushToggle from "../components/PushToggle";
import Mark from "../components/Mark";
import "./Account.css";

export default function Account() {
    const navigate = useNavigate();

    const logout = () => {
        localStorage.removeItem("token");
        navigate("/login", { replace: true });
    };

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1>الحساب</h1>
                    <p className="sub">الإشعارات والخصوصية وتسجيل الخروج</p>
                </div>
            </div>

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
                </div>
            </div>

            <button className="logout-btn" onClick={logout}>تسجيل الخروج</button>
        </div>
    );
}
