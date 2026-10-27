import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import { Clock, Printer, AlertTriangle, Heart, Pill, PauseCircle, Calendar, History, CheckCircle, Info } from "lucide-react";
import Logo from "../components/Logo";
import { periodOf, formatTime, formatDate, calcAge, initial } from "../utils/format";
import AdherenceReport from "../components/AdherenceReport";
import CourseProgress from "../components/CourseProgress";

const DAYS = { 1: "الأحد", 2: "الإثنين", 3: "الثلاثاء", 4: "الأربعاء", 5: "الخميس", 6: "الجمعة", 7: "السبت" };

function daysLabel(d) {
    if (!d) return "";
    return d.length === 7 ? "كل يوم" : d.split("").map((x) => DAYS[x]).join("، ");
}

// «2026-10-28 11:00:00» ← «الثلاثاء ٢٨ تشرين الأول · 11:00 ص»
function fmtDateTime(v, withWeekday = true) {
    if (!v) return "";
    const [d, t] = String(v).replace("T", " ").split(" ");
    return t ? `${formatDate(d, withWeekday)} · ${formatTime(t.slice(0, 5))}` : formatDate(d, withWeekday);
}

// الصفحة الوحيدة التي يراها شخص من خارج التطبيق — بلا تسجيل دخول
const SEVERITY = { severe: "شديدة", mild: "خفيفة" };

export default function DoctorView() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null); // { expired, message }
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/share/${token}`)
            .then((res) => setData(res.data))
            .catch((err) =>
                setError({
                    expired: err.response?.status === 410,
                    message: err.response?.data?.error || "تعذّر فتح الرابط",
                })
            )
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) {
        return (
            <Page>
                <DocBrand />
                <div className="flex items-center justify-center gap-3 py-24 text-forest-700/60">
                    <span className="w-6 h-6 border-4 border-forest-200 border-t-forest-600 rounded-full animate-spin" aria-hidden="true" />
                    جارٍ فتح ملف المريض...
                </div>
            </Page>
        );
    }

    // رابط منتهٍ أو خاطئ: نشرح للطبيب ما يفعله بدل رسالة خطأ جافة
    if (error) {
        return (
            <Page>
                <DocBrand />
                <div className="card p-12 text-center mt-8">
                    <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Clock className="w-10 h-10 text-amber-600" />
                    </div>
                    <h1 className="text-xl font-bold text-forest-950">
                        {error.expired ? "انتهت صلاحية هذا الرابط" : "لا يمكن فتح هذا الرابط"}
                    </h1>
                    <p className="text-forest-700/70 mt-2 max-w-md mx-auto">
                        {error.expired
                            ? "روابط المشاركة مؤقّتة لحماية خصوصية المريض. اطلب منه إنشاء رابط جديد من تطبيق نبض."
                            : `${error.message}. تأكّد من الرابط أو اطلب من المريض إرساله مجدداً.`}
                    </p>
                </div>
            </Page>
        );
    }

    const m = data.member;
    const years = calcAge(m.birth_date);
    const logs = data.self_reported_confirmations.slice(0, 20);

    return (
        <Page>
            <header className="flex flex-wrap items-center justify-between gap-3">
                <DocBrand />
                <div className="flex items-center gap-2">
                    {data.expires_at && (
                        <span className="badge badge-info"><Clock className="w-3 h-3" /> صالح حتى {fmtDateTime(data.expires_at, false)}</span>
                    )}
                    <button type="button" className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-2 print:hidden" onClick={() => window.print()}>
                        <Printer className="w-4 h-4" /> طباعة
                    </button>
                </div>
            </header>

            {/* ---------- المريض ---------- */}
            <section className="card p-6 flex items-center gap-4">
                <div className="w-16 h-16 gradient-forest rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                    {initial(m.name)}
                </div>
                <div className="min-w-0">
                    <p className="text-sm text-forest-700/60">ملف المريض</p>
                    <h1 className="text-2xl lg:text-3xl font-extrabold text-forest-950">{m.name}</h1>
                    <p className="text-forest-700/70">
                        {years !== null ? `${years} سنة` : "العمر غير مسجّل"}
                        {m.birth_date && ` · مواليد ${formatDate(m.birth_date, false)} ${String(m.birth_date).slice(0, 4)}`}
                    </p>
                </div>
            </section>

            {/* الحساسية أولاً: أهم معلومة للطبيب قبل أن يصف أي دواء */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`card p-5 ${m.allergies ? "!border-red-200 dark:!border-red-900/60 bg-red-50" : ""}`}>
                    <p className={`text-sm font-bold flex items-center gap-2 mb-2 ${m.allergies ? "text-red-700 dark:text-red-300" : "text-forest-800"}`}>
                        <AlertTriangle className="w-4 h-4" /> الحساسية من أدوية
                    </p>
                    {data.allergies?.length ? (
                        // كل بند بشدّته ونوع التفاعل، والشديد أولاً
                        <ul className="space-y-2">
                            {[...data.allergies]
                                .sort((x, y) => (y.severity === "severe") - (x.severity === "severe"))
                                .map((a) => (
                                    <li key={a.label} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-forest-950">
                                        <b>{a.label}</b>
                                        {a.latin && <bdi dir="ltr" className="text-xs text-forest-700/60">{a.latin}</bdi>}
                                        {a.severity !== "unknown" && (
                                            <span className={`badge ${a.severity === "severe" ? "badge-danger" : "badge-warning"}`}>{SEVERITY[a.severity]}</span>
                                        )}
                                        {a.reaction && <span className="text-sm text-forest-700/70">التفاعل: {a.reaction}</span>}
                                    </li>
                                ))}
                        </ul>
                    ) : (
                        <p className="text-forest-950">{m.allergies || "لا توجد حساسية مسجّلة"}</p>
                    )}
                </div>
                <div className="card p-5">
                    <p className="text-sm font-bold text-forest-800 flex items-center gap-2 mb-2">
                        <Heart className="w-4 h-4 text-amber-500" /> الأمراض المزمنة
                    </p>
                    <p className="text-forest-950">{m.chronic_conditions || "لا توجد أمراض مزمنة مسجّلة"}</p>
                </div>
            </div>

            {/* ---------- الأدوية ---------- */}
            <SectionTitle icon={Pill} color="text-forest-600" count={data.medications.length}>الأدوية الحالية</SectionTitle>
            {data.medications.length === 0 ? (
                <Empty>لا توجد أدوية مسجّلة.</Empty>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.medications.map((med) => (
                        <article className="card p-5 break-inside-avoid" key={med.id}>
                            <div className="flex items-start justify-between gap-2 mb-3">
                                <h3 className="font-bold text-forest-950">
                                    {med.name}
                                    {med.strength && <span className="font-normal text-forest-700/60"> {med.strength}</span>}
                                </h3>
                                {med.form && <span className="badge badge-success flex-shrink-0">{med.form}</span>}
                            </div>
                            <dl className="space-y-1.5 text-sm">
                                {med.active_ingredient && <Line label="المادة الفعّالة">{med.active_ingredient}</Line>}
                                {med.instructions && <Line label="التعليمات">{med.instructions}</Line>}
                                {med.start_date && (
                                    <Line label="منذ">
                                        {formatDate(med.start_date, false)} {String(med.start_date).slice(0, 4)}
                                        {med.end_date && ` — حتى ${formatDate(med.end_date, false)}`}
                                    </Line>
                                )}
                            </dl>
                            {med.schedules?.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-3">
                                    {med.schedules
                                        .slice()
                                        .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day))
                                        .map((s, i) => (
                                            <span className={`badge ${periodOf(s.time_of_day).chip}`} key={i}>
                                                {formatTime(s.time_of_day)} · {daysLabel(s.days_of_week)}
                                            </span>
                                        ))}
                                </div>
                            )}
                            {/* كورس محدد المدة: أين وصل، وكم جرعة أُخذت */}
                            <CourseProgress course={med.course} startDate={med.start_date} forDoctor />
                        </article>
                    ))}
                </div>
            )}

            {/* كورسات أُوقفت قبل نهايتها آخر ٣٠ يوماً — مع اليوم والسبب */}
            {data.stopped_courses?.length > 0 && (
                <>
                    <SectionTitle icon={PauseCircle} color="text-red-500" count={data.stopped_courses.length}>كورسات أُوقفت قبل نهايتها</SectionTitle>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {data.stopped_courses.map((med) => (
                            <article className="card p-5 break-inside-avoid" key={med.id}>
                                <div className="flex items-start justify-between gap-2">
                                    <h3 className="font-bold text-forest-950">
                                        {med.name}
                                        {med.strength && <span className="font-normal text-forest-700/60"> {med.strength}</span>}
                                    </h3>
                                    <span className="badge badge-danger flex-shrink-0">أُوقف {formatDate(med.course.stopped_on, false)}</span>
                                </div>
                                <CourseProgress course={med.course} forDoctor />
                            </article>
                        ))}
                    </div>
                </>
            )}

            {/* الالتزام آخر ٣٠ يوماً: هل يأخذ المريض أدويته فعلاً؟ */}
            {data.adherence?.scheduled > 0 && (
                <div>
                    <AdherenceReport data={data.adherence} kicker="الالتزام بالجرعات — آخر ٣٠ يوماً" />
                    <p className="text-xs text-forest-700/60 mt-2">محسوب من تأكيدات المستخدم نفسه في التطبيق، لا من سجل طبي.</p>
                </div>
            )}

            {/* ---------- المواعيد ---------- */}
            <SectionTitle icon={Calendar} color="text-purple-500" count={data.upcoming_appointments.length}>المواعيد القادمة</SectionTitle>
            {data.upcoming_appointments.length === 0 ? (
                <Empty>لا توجد مواعيد قادمة.</Empty>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {data.upcoming_appointments.map((a) => (
                        <article className="card p-5" key={a.id}>
                            <h3 className="font-bold text-forest-950">{a.title}</h3>
                            <p className="text-sm font-medium text-forest-700 mt-1">{fmtDateTime(a.scheduled_at)}</p>
                            {(a.doctor_name || a.location) && (
                                <p className="text-sm text-forest-700/60">{[a.doctor_name, a.location].filter(Boolean).join(" · ")}</p>
                            )}
                        </article>
                    ))}
                </div>
            )}

            {/* ---------- سجل التأكيد ---------- */}
            <div>
                <SectionTitle icon={History} color="text-blue-500">سجل تأكيد الجرعات</SectionTitle>
                <p className="text-sm text-forest-700/60 -mt-2 mb-4">آخر {logs.length} جرعة أكّد المستخدم أخذها بنفسه من التطبيق.</p>
                {logs.length === 0 ? (
                    <Empty>لا توجد تأكيدات مسجّلة.</Empty>
                ) : (
                    <div className="card overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-forest-950 text-white">
                                        <th className="text-right font-semibold px-4 py-3">الدواء</th>
                                        <th className="text-right font-semibold px-4 py-3">الموعد المحدد</th>
                                        <th className="text-right font-semibold px-4 py-3">الحالة</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-sage-100 dark:divide-forest-800/60">
                                    {logs.map((l) => (
                                        <tr key={l.id} className="hover:bg-sage-50 dark:hover:bg-forest-800/40">
                                            <td className="px-4 py-3 font-medium text-forest-950">{l.medication_name}</td>
                                            <td className="px-4 py-3 text-forest-700">{fmtDateTime(l.scheduled_at)}</td>
                                            <td className="px-4 py-3">
                                                {l.status === "taken"
                                                    ? <span className="badge badge-success"><CheckCircle className="w-3 h-3" /> مؤكّدة</span>
                                                    : <span className="badge badge-warning">{l.status}</span>}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* نقطة أخلاقية جاءت من مقابلة الصيدلاني — لا تُحذف ولا تُصغَّر */}
            <div className="card p-5 !border-amber-200 dark:!border-amber-900/60 bg-amber-50 flex items-start gap-3">
                <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <p className="text-forest-950 font-medium">{data.note}</p>
            </div>

            <footer className="text-center text-sm text-forest-700/60 pt-4 border-t border-sage-200">
                عُرض عبر <Link to="/welcome" className="font-semibold text-forest-600 hover:underline">نبض</Link> — أداة تنظيمية لمتابعة أدوية العائلة، لا تقدّم تشخيصاً ولا توصيات علاجية.
            </footer>
        </Page>
    );
}

// الصفحة بلا هيكل التطبيق: الطبيب لا يملك حساباً
function Page({ children }) {
    return (
        <div className="min-h-screen bg-sage-50 dark:bg-[#0B1F1E] print:bg-white">
            <div className="max-w-5xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">{children}</div>
        </div>
    );
}

function SectionTitle({ icon: Icon, color, count, children }) {
    return (
        <h2 className="text-lg font-bold text-forest-950 flex items-center gap-2 pt-2 mb-4">
            <Icon className={`w-5 h-5 ${color}`} />
            {children}
            {count !== undefined && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sage-100 dark:bg-forest-800/60 text-forest-700">{count}</span>
            )}
        </h2>
    );
}

function Line({ label, children }) {
    return (
        <div className="flex gap-2">
            <dt className="text-forest-700/60 flex-shrink-0 w-24">{label}</dt>
            <dd className="text-forest-950 min-w-0">{children}</dd>
        </div>
    );
}

function Empty({ children }) {
    return <div className="card p-6 text-center text-forest-700/60">{children}</div>;
}

function DocBrand() {
    return (
        <span className="flex items-center gap-2.5">
            <Logo size={36} />
            <span className="text-xl font-extrabold text-forest-950">نبض</span>
        </span>
    );
}
