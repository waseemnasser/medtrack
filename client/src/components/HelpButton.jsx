import { useRef } from "react";
import { HelpCircle, X, LayoutDashboard, Users, Calendar, Siren, Settings } from "lucide-react";

// «كيف يعمل نبض؟» — زر ؟ في الشريط العلوي، متاح من كل صفحة
const STEPS = [
    "أضف نفسك أو شخصاً تتابع أدويته.",
    "أضف دواءه وساعات أخذه.",
    "فعّل التذكير، واضغط «تم الأخذ» بعد كل جرعة.",
];

const TABS = [
    { icon: LayoutDashboard, name: "اليوم", text: "جرعات اليوم لكل من تتابعهم، والجرعة التالية في الأعلى." },
    { icon: Users, name: "العائلة", text: "ملف لكل شخص: أدويته وحساسيته ومواعيده وأرقام طوارئه، وتقرير التزامه." },
    { icon: Calendar, name: "المواعيد", text: "مواعيد الأطباء والتحاليل، مع تذكير مساء اليوم السابق وقبلها بساعتين." },
    { icon: Siren, name: "بطاقة الطوارئ", text: "ما يحتاجه المسعف في لمحة، ورابط مؤقت للطبيب للقراءة فقط." },
    { icon: Settings, name: "الحساب", text: "الإشعارات والمظهر والوضع المريح وكلمة المرور." },
];

export default function HelpButton() {
    const ref = useRef(null);
    const close = () => ref.current?.close();

    return (
        <>
            <button type="button" onClick={() => ref.current?.showModal()} aria-label="كيف يعمل نبض؟" title="كيف يعمل نبض؟"
                className="p-2 text-forest-700 dark:text-forest-300 rounded-lg hover:bg-mint-50 dark:hover:bg-forest-800/50 transition-colors">
                <HelpCircle className="w-6 h-6" />
            </button>

            <dialog ref={ref} aria-labelledby="help-title"
                className="card p-0 w-[min(32rem,calc(100vw-2rem))] max-h-[calc(100vh-2rem)] !shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
                onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
                <div className="p-6">
                    <div className="flex items-start justify-between gap-3">
                        <h2 id="help-title" className="text-xl font-extrabold text-forest-950">كيف يعمل نبض؟</h2>
                        <button type="button" onClick={close} aria-label="إغلاق" className="p-1.5 -m-1.5 rounded-lg text-forest-700 hover:bg-sage-100 dark:hover:bg-forest-800/60">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <p className="text-sm text-forest-700/80 mt-1 leading-relaxed">
                        ينظّم أدويتك وأدوية من تتابع علاجهم، ويذكّرك بكل جرعة وموعد.
                    </p>

                    <ol className="mt-5 space-y-3">
                        {STEPS.map((s, i) => (
                            <li key={s} className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-forest-600 text-white font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                                <span className="text-forest-950 font-medium">{s}</span>
                            </li>
                        ))}
                    </ol>

                    <h3 className="text-sm font-bold text-forest-800 mt-6 mb-3">أقسام التطبيق</h3>
                    <ul className="space-y-3">
                        {TABS.map((t) => (
                            <li key={t.name} className="flex gap-3">
                                <t.icon className="w-5 h-5 text-forest-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
                                <p className="text-sm text-forest-700/80 leading-relaxed">
                                    <strong className="text-forest-950">{t.name}:</strong> {t.text}
                                </p>
                            </li>
                        ))}
                    </ul>

                    <p className="text-xs text-forest-700/60 mt-6 leading-relaxed">
                        نبض أداة تنظيمية فقط: لا يشخّص ولا يقترح جرعات. استشر الطبيب أو الصيدلاني دائماً.
                    </p>
                    <button type="button" onClick={close} className="btn-primary w-full mt-5">فهمت</button>
                </div>
            </dialog>
        </>
    );
}
