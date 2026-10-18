import { useNavigate } from "react-router-dom";

/**
 * رأس الصفحات الداخلية: زر رجوع + عنوان + إجراء اختياري.
 * التطبيق المثبّت على الهاتف لا يملك زر رجوع من المتصفح،
 * فبدون هذا الزر يعلق المستخدم داخل الصفحة.
 *
 * back: الصفحة التي نرجع إليها إن فُتحت هذه الصفحة مباشرة من رابط
 */
export default function PageHeader({ title, back = "/", action }) {
    const navigate = useNavigate();

    // إن جاء المستخدم من صفحة داخل التطبيق نرجع خطوة، وإلا نذهب للصفحة الأم
    const goBack = () => {
        if (window.history.state?.idx > 0) navigate(-1);
        else navigate(back);
    };

    return (
        <div className="page-header">
            <button type="button" className="icon-btn" onClick={goBack} aria-label="رجوع">
                {/* سهم لليمين: الرجوع في الواجهة العربية */}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                </svg>
            </button>
            {title && <h1>{title}</h1>}
            {action && <div className="page-header-action">{action}</div>}
        </div>
    );
}
