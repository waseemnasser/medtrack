import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, UserPlus, Pill, Bell, ChevronLeft } from "lucide-react";
import { enablePush, pushPermission, pushSupported } from "../push";
import { skipPushStep } from "../utils/setup";

/*
  «لنجهّز نبض في ٣ خطوات» — بدل أرقام الصفر في حساب جديد.

  ① شخص تتابع أدويته (وقد يكون المستخدم نفسه)
  ② دواؤه الأول وساعات أخذه
  ③ التذكير على هذا الجهاز

  كل خطوة تُعلَّم وحدها حين تتم؛ والخطوة الحالية وحدها لها زر.
  pushState: idle | blocked | unsupported (خطوة التذكير لم تتم بعد)
*/
export default function SetupGuide({ hasMember, hasMed, medMemberId, medMemberName, pushState, onPushOn, onSkipPush }) {
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState("");

    const turnOn = async () => {
        setMsg("");
        setBusy(true);
        try {
            await enablePush();
            onPushOn();
        } catch (err) {
            setMsg(err.message || "تعذّر تفعيل التذكير");
        } finally {
            setBusy(false);
        }
    };

    const later = () => {
        skipPushStep();
        onSkipPush();
    };

    const blocked = pushState === "blocked" || pushPermission() === "denied";
    const steps = [
        {
            key: "member",
            icon: UserPlus,
            title: "أضف نفسك أو شخصاً تتابع أدويته",
            text: "لكل شخص ملف: أدويته وحساسيته ومواعيده وبطاقة طوارئه.",
            done: hasMember,
            action: <Link to="/members/new" className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-1.5">إضافة شخص <ChevronLeft className="w-4 h-4" /></Link>,
        },
        {
            key: "med",
            icon: Pill,
            title: medMemberName ? `أضف أول دواء لـ${medMemberName}` : "أضف أول دواء وساعات أخذه",
            text: "اختر الدواء من القائمة وحدّد الساعة، فتظهر جرعاته هنا كل يوم.",
            done: hasMed,
            action: medMemberId && (
                <Link to={`/members/${medMemberId}/medications/new`} className="btn-primary !py-2 !px-4 text-sm inline-flex items-center gap-1.5">
                    إضافة دواء <ChevronLeft className="w-4 h-4" />
                </Link>
            ),
        },
        {
            key: "push",
            icon: Bell,
            title: "فعّل التذكير على هذا الجهاز",
            text: !pushSupported()
                ? "هذا المتصفح لا يدعم الإشعارات. على آيفون: ثبّت نبض على الشاشة الرئيسية من زر المشاركة ثم افتحه من هناك."
                : blocked
                    ? "الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (رمز القفل بجانب الرابط) ثم حدّث الصفحة."
                    : "يصلك إشعار في وقت كل جرعة حتى والتطبيق مغلق.",
            done: false,
            action: (
                <div className="flex flex-wrap gap-2">
                    {pushSupported() && !blocked && (
                        <button type="button" onClick={turnOn} disabled={busy} className="btn-primary !py-2 !px-4 text-sm">
                            {busy ? "جارٍ التفعيل..." : "تفعيل التذكير"}
                        </button>
                    )}
                    <button type="button" onClick={later} className="btn-secondary !py-2 !px-4 text-sm">
                        {pushSupported() && !blocked ? "لاحقاً" : "حسناً"}
                    </button>
                </div>
            ),
        },
    ];
    const current = steps.findIndex((s) => !s.done);
    const doneCount = steps.filter((s) => s.done).length;

    return (
        <section className="card overflow-hidden" aria-labelledby="setup-title">
            <div className="gradient-forest text-white px-6 py-5">
                <div className="flex items-center justify-between gap-3">
                    <h2 id="setup-title" className="text-xl font-extrabold">لنجهّز نبض في ٣ خطوات</h2>
                    <span className="text-sm font-semibold bg-[#fff]/15 rounded-full px-3 py-1 flex-shrink-0">{doneCount} من 3</span>
                </div>
                <p className="text-forest-100/90 text-sm mt-1.5 leading-relaxed">
                    نبض يذكّرك بجرعات من تتابع أدويتهم — وأنت منهم إن كنت تتابع أدويتك.
                </p>
                <div className="flex gap-1.5 mt-4" aria-hidden="true">
                    {steps.map((s) => (
                        <span key={s.key} className={`h-1.5 flex-1 rounded-full ${s.done ? "bg-[#fff]" : "bg-[#fff]/25"}`} />
                    ))}
                </div>
            </div>

            <ol className="divide-y divide-sage-200/70 dark:divide-forest-800/60">
                {steps.map((s, i) => {
                    const active = i === current;
                    return (
                        <li key={s.key} className={`flex gap-4 px-6 py-5 ${active ? "bg-mint-50/60 dark:bg-forest-800/30" : ""}`}
                            aria-current={active ? "step" : undefined}>
                            <span className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold ${s.done
                                ? "bg-forest-600 text-white"
                                : active
                                    ? "bg-forest-100 text-forest-700 ring-2 ring-forest-500"
                                    : "bg-sage-100 text-sage-400 dark:bg-forest-800/60 dark:text-forest-600"}`}>
                                {s.done ? <Check className="w-5 h-5" aria-label="تمّت" /> : <s.icon className="w-5 h-5" aria-hidden="true" />}
                            </span>
                            <div className="min-w-0 flex-1">
                                <h3 className={`font-bold ${s.done ? "text-forest-700/60" : active ? "text-forest-950" : "text-forest-700/60"}`}>
                                    <span className="sr-only">الخطوة {i + 1}: </span>{s.title}
                                </h3>
                                {!s.done && <p className={`text-sm mt-0.5 leading-relaxed ${active ? "text-forest-700/80" : "text-forest-700/50"}`}>{s.text}</p>}
                                {active && s.action && <div className="mt-3">{s.action}</div>}
                                {active && msg && <p className="text-sm text-red-600 mt-2" role="status">{msg}</p>}
                            </div>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
