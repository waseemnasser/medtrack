import { useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";

/**
 * رأس الصفحات الداخلية: زر رجوع + عنوان + إجراء اختياري.
 * التطبيق المثبّت على الهاتف لا يملك زر رجوع من المتصفح،
 * فبدون هذا الزر يعلق المستخدم داخل الصفحة.
 *
 * back: الصفحة التي نرجع إليها إن فُتحت هذه الصفحة مباشرة من رابط
 * subtitle: سطر خافت تحت العنوان
 */
export default function PageHeader({ title, subtitle, back = "/", action }) {
    const navigate = useNavigate();

    // إن جاء المستخدم من صفحة داخل التطبيق نرجع خطوة، وإلا نذهب للصفحة الأم
    const goBack = () => {
        if (window.history.state?.idx > 0) navigate(-1);
        else navigate(back);
    };

    return (
        <div className="flex items-center gap-3 mb-6">
            <button type="button" onClick={goBack} aria-label="رجوع"
                className="w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-xl bg-white border border-sage-200 text-forest-700 hover:border-forest-400 transition-colors">
                {/* سهم لليمين: الرجوع في الواجهة العربية */}
                <ArrowRight className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
                {title && <h1 className="text-2xl lg:text-3xl font-extrabold text-forest-950 truncate">{title}</h1>}
                {subtitle && <p className="text-forest-700/60 mt-0.5">{subtitle}</p>}
            </div>
            {action && <div className="flex-shrink-0">{action}</div>}
        </div>
    );
}
