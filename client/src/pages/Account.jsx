import { useState } from "react";
import { flushSync } from "react-dom";
import { useNavigate, Link } from "react-router-dom";
import { Monitor, Sun, Moon, Accessibility, Bell, ShieldCheck, Info, LogOut, Palette, ChevronLeft } from "lucide-react";
import PushToggle from "../components/PushToggle";
import Logo from "../components/Logo";
import { getTheme, setTheme } from "../utils/theme";
import { getEasyMode, setEasyMode } from "../utils/easyMode";
import { logout } from "../utils/session";

const THEMES = [
    { value: "auto", label: "تلقائي", icon: Monitor },
    { value: "light", label: "فاتح", icon: Sun },
    { value: "dark", label: "داكن", icon: Moon },
];

// بطاقة إعدادات بعنوان وأيقونة، بأسلوب بطاقات النموذج الأولي
function Section({ icon: Icon, color, title, children }) {
    return (
        <section className="card p-6">
            <h2 className="text-lg font-bold text-forest-950 flex items-center gap-2 mb-5">
                <Icon className={`w-5 h-5 ${color}`} /> {title}
            </h2>
            {children}
        </section>
    );
}

export default function Account() {
    const navigate = useNavigate();
    const [theme, setThemeState] = useState(getTheme);
    const [easy, setEasy] = useState(getEasyMode);

    const toggleEasy = () => {
        setEasyMode(!easy);
        setEasy(!easy);
    };

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

    return (
        <div className="max-w-3xl space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-extrabold text-forest-950">الحساب</h1>
                <p className="text-forest-700/60 mt-1">العرض والإشعارات والخصوصية</p>
            </div>

            <Section icon={Palette} color="text-forest-600" title="العرض">
                <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="المظهر">
                    {THEMES.map((t) => (
                        <button
                            key={t.value}
                            type="button"
                            role="radio"
                            aria-checked={theme === t.value}
                            onClick={(e) => chooseTheme(t.value, e)}
                            className={`rounded-xl border-2 py-4 flex flex-col items-center gap-2 transition-all ${theme === t.value
                                ? "border-forest-500 bg-mint-50"
                                : "border-sage-200 hover:border-forest-300"}`}
                        >
                            <t.icon className={`w-6 h-6 ${theme === t.value ? "text-forest-600" : "text-forest-700/60"}`} />
                            <span className="text-sm font-semibold text-forest-950">{t.label}</span>
                        </button>
                    ))}
                </div>
                <p className="text-xs text-forest-700/60 mt-2">«تلقائي» يتبع إعداد هاتفك أو حاسوبك.</p>

                <button type="button" role="switch" aria-checked={easy} onClick={toggleEasy}
                    className="w-full flex items-center gap-3 bg-sage-50 dark:bg-forest-800/40 rounded-xl p-4 mt-4 text-right">
                    <div className="w-10 h-10 bg-forest-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Accessibility className="w-5 h-5 text-forest-600" />
                    </div>
                    <span className="flex-1 min-w-0">
                        <strong className="block text-forest-950">الوضع المريح</strong>
                        <small className="block text-sm text-forest-700/60">نص أكبر وأزرار أوسع. يُحفظ على هذا الجهاز فقط.</small>
                    </span>
                    <span aria-hidden="true" className={`relative w-11 h-6 rounded-full flex-shrink-0 transition-colors ${easy ? "bg-forest-600" : "bg-sage-300"}`}>
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${easy ? "translate-x-5" : ""}`} />
                    </span>
                </button>
            </Section>

            <div>
                <h2 className="text-lg font-bold text-forest-950 flex items-center gap-2 mb-3">
                    <Bell className="w-5 h-5 text-amber-500" /> الإشعارات
                </h2>
                <PushToggle />
            </div>

            <Section icon={ShieldCheck} color="text-teal-500" title="الخصوصية">
                <div className="space-y-2 text-forest-800">
                    <p>
                        بياناتك تبقى عندك. لا يراها أحد إلا برابط مؤقّت تنشئه أنت
                        من ملف الفرد، وينتهي تلقائياً.
                    </p>
                    <p>الأدوية المعلّمة «خاصة» لا تظهر في روابط المشاركة أبداً.</p>
                </div>
            </Section>

            <Section icon={Info} color="text-blue-500" title="عن نبض">
                <div className="flex items-start gap-4">
                    <Logo size={48} />
                    <div className="space-y-2">
                        <strong className="block text-forest-950">نبض — متابعة أدوية العائلة</strong>
                        <p className="text-sm text-forest-700/70">
                            أداة تنظيمية فقط: لا تقدّم تشخيصاً ولا توصيات علاجية،
                            ولا تقترح جرعات أو بدائل. استشر طبيبك أو الصيدلاني دائماً.
                        </p>
                        <p className="text-xs text-forest-700/60">مشروع تخرج — الجامعة الدولية الخاصة للعلوم والتكنولوجيا</p>
                        <Link to="/welcome" className="inline-flex items-center gap-1 text-sm font-medium text-forest-600 hover:text-forest-700">
                            عرض الصفحة التعريفية <ChevronLeft className="w-4 h-4" />
                        </Link>
                    </div>
                </div>
            </Section>

            <button onClick={() => logout(navigate)}
                className="w-full sm:w-auto btn-secondary !text-red-600 !border-red-200 hover:!bg-red-50 flex items-center justify-center gap-2">
                <LogOut className="w-5 h-5 rtl-flip" /> تسجيل الخروج
            </button>
        </div>
    );
}
