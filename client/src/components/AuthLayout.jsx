import { Link } from "react-router-dom";
import { ArrowRight, Bell, Users, Share2 } from "lucide-react";
import Logo from "./Logo";
import ThemeToggle from "./ThemeToggle";

// ما يقدّمه التطبيق — بدل أرقام النموذج الأولي المصطنعة، مزايا حقيقية
const POINTS = [
    { icon: Bell, title: "تذكير بكل جرعة", text: "إشعار في موعد كل جرعة، حتى والتطبيق مغلق." },
    { icon: Users, title: "ملف لكل شخص", text: "أدويته ومواعيده وحساسيته في صفحة واحدة." },
    { icon: Share2, title: "مشاركة مؤقّتة مع الطبيب", text: "رابط يراه الطبيب للقراءة فقط، وينتهي وحده." },
];

/**
 * هيكل صفحتي الدخول وإنشاء الحساب، كصفحة الدخول في النموذج الأولي:
 * النموذج على جانب، ولوحة بتدرّج الغابة على الجانب الآخر (الحاسوب فقط).
 *
 * kicker: سطر صغير فوق العنوان
 * headline: العنوان
 * lead: سطر شرح تحته
 */
export default function AuthLayout({ kicker, headline, lead, children }) {
    return (
        <div className="min-h-screen flex">
            <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-sage-50 dark:bg-[#0B1F1E]">
                <div className="w-full max-w-md">
                    {/* بلا هذا الرابط يعلق الزائر في صفحة الدخول: لا رجوع للصفحة التعريفية */}
                    <div className="flex items-center justify-between mb-8">
                        <Link to="/welcome" className="flex items-center gap-2 text-forest-700 hover:text-forest-600 transition-colors">
                            <ArrowRight className="w-5 h-5" />
                            <span className="font-medium">الرئيسية</span>
                        </Link>
                        <ThemeToggle />
                    </div>

                    <Link to="/welcome" className="flex items-center gap-2.5 mb-8" aria-label="نبض — الصفحة الرئيسية">
                        <Logo size={48} />
                        <div>
                            <span className="text-2xl font-extrabold text-forest-950">نبض</span>
                            <span className="block text-xs text-forest-600">Nabd</span>
                        </div>
                    </Link>

                    {kicker && <p className="text-sm font-semibold text-forest-600 mb-1">{kicker}</p>}
                    <h1 className="text-3xl font-extrabold text-forest-950">{headline}</h1>
                    {lead && <p className="mt-2 text-forest-700/70">{lead}</p>}

                    <div className="mt-8">{children}</div>

                    <p className="mt-8 text-xs text-center text-forest-700/60">
                        بياناتك تبقى عندك. تُشارَك فقط برابط مؤقّت تنشئه أنت.
                    </p>
                </div>
            </div>

            <div className="hidden lg:flex flex-1 gradient-forest items-center justify-center p-12 relative overflow-hidden">
                <div className="absolute top-20 right-20 w-72 h-72 bg-white/5 rounded-full blur-3xl" aria-hidden="true" />
                <div className="absolute bottom-20 left-20 w-96 h-96 bg-white/5 rounded-full blur-3xl" aria-hidden="true" />
                <div className="relative max-w-md">
                    <div className="flex justify-center mb-8">
                        <Logo size={80} variant="light" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white text-balance text-center">
                        أدوية العائلة، في مكان واحد
                    </h2>
                    <p className="mt-4 text-lg text-white/70 text-center">
                        الجرعات والمواعيد والحساسية، ومشاركة آمنة مع الطبيب.
                    </p>
                    <ul className="mt-10 space-y-3">
                        {POINTS.map(({ icon: Icon, title, text }) => (
                            <li key={title} className="flex items-start gap-3 bg-white/10 backdrop-blur rounded-2xl p-4">
                                <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center flex-shrink-0">
                                    <Icon className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <p className="font-bold text-white">{title}</p>
                                    <p className="text-sm text-white/70">{text}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
