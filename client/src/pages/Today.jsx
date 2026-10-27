import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Pill, Calendar, AlertTriangle, Activity, Plus, ChevronLeft, Check, CheckCircle2, BellRing, X, Siren, Mic, TrendingUp } from "lucide-react";
import api from "../api";
import useDoseAlarm from "../useDoseAlarm";
import { playBeep } from "../beep";
import PushToggle from "../components/PushToggle";
import Skeleton from "../components/Skeleton";
import { useFeedback } from "../feedback/context";
import { PERIODS, periodOf, timeParts, formatTime, formatDate, daysText as courseDaysText } from "../utils/format";

export default function Today() {
    const [date, setDate] = useState("");
    const [doses, setDoses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(null); // schedule_id الجاري تأكيده
    const [alarm, setAlarm] = useState(null);
    const [refills, setRefills] = useState([]); // أدوية تنفد خلال ٣ أيام
    const [appts, setAppts] = useState([]);     // مواعيد اليوم والغد
    const [courses, setCourses] = useState([]); // كورسات جارية ومكتملة حديثاً
    const { toast } = useFeedback();

    useEffect(() => {
        const load = async () => {
            try {
                const res = await api.get("/doses/today");
                setDate(res.data.date);
                setDoses(res.data.doses);
            } catch {
                setError("تعذّر تحميل جرعات اليوم. تأكّد من الاتصال وحاول مجدداً.");
            } finally {
                setLoading(false);
            }
        };

        load();

        // قائمة «تنفد قريباً» — لا تؤخّر الصفحة ولا تُظهر خطأ إن فشلت
        api.get("/medications/refills")
            .then((res) => setRefills(res.data))
            .catch(() => {});

        loadCourses();

        // مواعيد اليوم والغد — تذكير هادئ بجانب الجرعات
        api.get("/appointments?upcoming=true")
            .then((res) => setAppts(res.data.filter((a) => dayOffset(a.scheduled_at) <= 1)))
            .catch(() => {});
    }, []);


    // الكورسات — تُعاد بعد كل تأكيد، فيختفي تنبيه «فاتت جرعتان» فور الأخذ
    function loadCourses() {
        api.get("/medications/courses")
            .then((res) => setCourses(res.data))
            .catch(() => {});
    }

    const confirm = async (dose) => {
        setSaving(dose.schedule_id);
        try {
            await api.post("/doses/confirm", {
                medication_id: dose.medication_id,
                scheduled_at: `${date} ${dose.time_of_day}`,
            });
            // تحديث محلي فوري بدل إعادة تحميل الصفحة
            setDoses((prev) =>
                prev.map((d) =>
                    d.schedule_id === dose.schedule_id
                        ? { ...d, status: "taken", confirmed_at: new Date().toISOString(), justTaken: true }
                        : d
                )
            );
            if (dose.course) loadCourses();
        } catch {
            toast("تعذّر تسجيل الجرعة، حاول مجدداً", "error");
        } finally {
            setSaving(null);
        }
    };
    // يُستدعى عند حلول موعد جرعة غير مؤكّدة
    const handleAlarm = (dose) => {
        playBeep();
        setAlarm(dose);
        if (document.hidden) document.title = "⏰ حان وقت الجرعة — نبض";
    };

    useDoseAlarm(date, doses, handleAlarm);
    // هل فات وقت الجرعة ولم تُؤكَّد؟
    const isLate = (dose) => {
        if (dose.status === "taken") return false;
        const now = new Date();
        const doseTime = new Date(`${date}T${dose.time_of_day}`);
        return now > doseTime;
    };

    if (loading) return <Skeleton variant="today" rows={3} />;

    const sorted = [...doses].sort((a, b) => a.time_of_day.localeCompare(b.time_of_day));
    const takenCount = doses.filter((d) => d.status === "taken").length;

    // الجرعة التالية: أول جرعة لم تُؤكَّد بعد — تُعرض وحدها في الأعلى
    const next = sorted.find((d) => d.status !== "taken");
    const rest = sorted.filter((d) => d !== next);

    // أرقام حقيقية من بيانات الصفحة نفسها، لا إحصاءات مصطنعة
    const stats = [
        { label: "جرعات أُخذت اليوم", value: `${takenCount} من ${doses.length}`, icon: Pill, color: "bg-forest-100 text-forest-600" },
        { label: "مواعيد اليوم وغداً", value: appts.length, icon: Calendar, color: "bg-purple-100 text-purple-600" },
        { label: "كورسات جارية", value: courses.filter((c) => c.status !== "completed").length, icon: Activity, color: "bg-blue-100 text-blue-600" },
        { label: "تنفد قريباً", value: refills.length, icon: AlertTriangle, color: "bg-amber-100 text-amber-600" },
    ];

    const closeAlarm = () => { setAlarm(null); document.title = "نبض"; };

    return (
        <div className="space-y-6">
            {alarm && (
                <div role="alert" className="fixed top-16 lg:top-6 inset-x-4 lg:right-72 lg:left-8 z-40 gradient-forest text-white rounded-2xl shadow-2xl shadow-forest-950/30 p-4 flex flex-wrap items-center gap-3 animate-fade-down">
                    <BellRing className="w-6 h-6 text-forest-200 flex-shrink-0" />
                    <p className="flex-1 min-w-[10rem]">
                        حان وقت جرعة <strong><bdi>{alarm.medication_name}</bdi></strong> لـ <strong>{alarm.member_name}</strong>
                    </p>
                    <button onClick={() => { confirm(alarm); closeAlarm(); }}
                        className="bg-[#fff] text-[#0F766E] font-bold px-5 py-2 rounded-xl hover:bg-forest-50 transition-colors">
                        تم الأخذ
                    </button>
                    <button onClick={closeAlarm} aria-label="إغلاق" className="p-2 rounded-lg hover:bg-white/10">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-extrabold text-forest-950">جرعات اليوم</h1>
                    <p className="text-forest-700/60 mt-1">{formatDate(date)}</p>
                </div>
                <div className="flex gap-2">
                    <Link to="/members/new" className="btn-secondary flex items-center gap-2">
                        <Plus className="w-4 h-4" /> فرد جديد
                    </Link>
                    <Link to="/appointments/new" className="btn-primary flex items-center gap-2">
                        <Plus className="w-4 h-4" /> موعد جديد
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {stats.map((stat) => (
                    <div key={stat.label} className="card p-5">
                        <div className={`w-12 h-12 ${stat.color} rounded-xl flex items-center justify-center mb-3`}>
                            <stat.icon className="w-6 h-6" />
                        </div>
                        <p className="text-3xl font-extrabold text-forest-950">{stat.value}</p>
                        <p className="text-sm text-forest-700/60">{stat.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* الجرعات */}
                <div className="lg:col-span-2 space-y-6">
                    {error && <div className="card p-4 !border-red-200 bg-red-50 text-red-700">{error}</div>}

                    {doses.length > 0 && (next ? (
                        <NextDose
                            key={next.schedule_id}
                            dose={next}
                            late={isLate(next)}
                            saving={saving === next.schedule_id}
                            onConfirm={() => confirm(next)}
                        />
                    ) : (
                        <div className="card p-6 flex items-center gap-4 gradient-mint">
                            <div className="w-14 h-14 bg-forest-600 rounded-full flex items-center justify-center flex-shrink-0 shadow-lg shadow-forest-600/30">
                                <Check className="w-7 h-7 text-white" strokeWidth={3} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-forest-950">أُخذت كل جرعات اليوم</h3>
                                <p className="text-forest-700/70">اطمئن، لا شيء متبقٍّ لليوم.</p>
                            </div>
                        </div>
                    ))}

                    <div className="card p-6">
                        <div className="flex items-center justify-between mb-5 gap-3">
                            <h2 className="text-lg font-bold text-forest-950 flex items-center gap-2">
                                <Pill className="w-5 h-5 text-forest-600" />
                                جدول اليوم
                            </h2>
                            {doses.length > 0 && (
                                <span className="text-sm font-semibold text-forest-700">{takenCount} من {doses.length}</span>
                            )}
                        </div>

                        {doses.length > 0 && (
                            <div className="flex gap-1 mb-6" role="img" aria-label={`تم تأكيد ${takenCount} من أصل ${doses.length} جرعات`}>
                                {sorted.map((d) => (
                                    <span key={d.schedule_id}
                                        className={`h-2 flex-1 rounded-full transition-colors duration-500 ${d.status === "taken" ? periodOf(d.time_of_day).bar : "bg-sage-100 dark:bg-forest-800/60"}`} />
                                ))}
                            </div>
                        )}

                        {doses.length === 0 && !error ? (
                            <div className="text-center py-10">
                                <div className="w-16 h-16 bg-sage-100 dark:bg-forest-800/60 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Pill className="w-8 h-8 text-sage-400 dark:text-forest-600" />
                                </div>
                                <p className="text-forest-700/60">لا توجد جرعات اليوم.</p>
                                <Link to="/members" className="btn-secondary inline-block mt-4">أضف دواءً من ملف أحد أفراد العائلة</Link>
                            </div>
                        ) : rest.length === 0 && doses.length > 0 ? (
                            <p className="text-sm text-forest-700/60 text-center py-4">لا جرعات أخرى اليوم.</p>
                        ) : (
                            <div className="space-y-6">
                                {PERIODS.map((period) => {
                                    const list = rest.filter((d) => periodOf(d.time_of_day).key === period.key);
                                    if (list.length === 0) return null;
                                    return (
                                        <section key={period.key}>
                                            <h3 className="flex items-center gap-2 text-sm font-bold text-forest-800 mb-3">
                                                <span className={`w-2.5 h-2.5 rounded-full ${period.dot}`} aria-hidden="true" />
                                                {period.label}
                                            </h3>
                                            <div className="space-y-3">
                                                {list.map((d) => (
                                                    <DoseRow key={d.schedule_id} dose={d} period={period}
                                                        late={isLate(d)} saving={saving === d.schedule_id}
                                                        onConfirm={() => confirm(d)} />
                                                ))}
                                            </div>
                                        </section>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* الجانب: المواعيد والكورسات وما ينفد */}
                <div className="space-y-6">
                    <SoonAppointments items={appts} />
                    <QuickActions />
                    {courses.length > 0 && <CourseList items={courses} />}
                    {refills.length > 0 && <RefillList items={refills} />}
                    <PushToggle hideWhenOn />
                </div>
            </div>
        </div>
    );
}

// سطر جرعة: الوقت أولاً وبخط كبير — أول ما تبحث عنه العين
function DoseRow({ dose: d, period, late, saving, onConfirm }) {
    const taken = d.status === "taken";
    const { clock, suffix } = timeParts(d.time_of_day);
    return (
        <div className={`flex items-center gap-4 rounded-xl p-4 transition-colors ${late
            ? "bg-red-50 ring-1 ring-red-200 dark:ring-red-900/50"
            : "bg-sage-50 dark:bg-forest-800/40 hover:bg-mint-50 dark:hover:bg-forest-800/60"}`}>
            <div className="w-12 text-center flex-shrink-0">
                <p className={`text-lg font-extrabold leading-none ${taken ? "text-forest-700/60" : "text-forest-950"}`}>{clock}</p>
                <p className="text-xs text-forest-700/60 mt-1">{suffix}</p>
            </div>
            <span className={`w-1 self-stretch rounded-full ${period.dot}`} aria-hidden="true" />
            <div className="flex-1 min-w-0">
                <p className={`font-semibold break-words ${taken ? "text-forest-700/60 line-through decoration-forest-300" : "text-forest-950"}`}>
                    {/* الاسم والعيار في عزل واحد: الأسماء اللاتينية لا تنقلب في الواجهة العربية */}
                    <bdi>
                        {d.medication_name}
                        {d.strength && <span className="font-normal text-forest-700/60"> {d.strength}</span>}
                    </bdi>
                </p>
                <div className="text-sm text-forest-700/60 flex flex-wrap items-center gap-x-1.5 gap-y-1 mt-0.5">
                    <Link to={`/members/${d.member_id}`} className="hover:text-forest-600 font-medium">{d.member_name}</Link>
                    {d.instructions && <span>· {d.instructions}</span>}
                    {late && <span className="badge badge-danger">متأخرة</span>}
                    <CourseDay course={d.course} />
                </div>
            </div>
            {taken ? (
                <CheckCircle2 className="w-8 h-8 text-forest-600 flex-shrink-0 animate-scale-in" role="img" aria-label="تم الأخذ" />
            ) : (
                <button onClick={onConfirm} disabled={saving}
                    className={`${late ? "btn-primary" : "btn-secondary"} !px-4 !py-2 text-sm flex-shrink-0`}>
                    {saving ? "..." : "تم الأخذ"}
                </button>
            )}
        </div>
    );
}

// بطاقة الجرعة التالية — أول ما تراه العين عند فتح التطبيق
function NextDose({ dose, late, saving, onConfirm }) {
    const period = periodOf(dose.time_of_day);
    const { clock, suffix } = timeParts(dose.time_of_day);
    return (
        <section aria-label="الجرعة التالية"
            className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-xl animate-fade-up ${late
                ? "bg-gradient-to-l from-red-600 to-red-500 shadow-red-500/30"
                : "gradient-forest shadow-forest-900/20"}`}>
            <div className="absolute -top-16 -left-16 w-48 h-48 bg-white/10 rounded-full blur-2xl" aria-hidden="true" />
            <div className="relative flex items-center justify-between gap-3 mb-4">
                <span className="text-sm font-semibold text-white/80">الجرعة التالية</span>
                <span className="badge bg-white/15 text-white">{late ? "متأخرة" : period.label}</span>
            </div>
            <div className="relative flex flex-wrap items-end justify-between gap-4">
                <div className="min-w-0">
                    <p className="text-5xl font-extrabold leading-none">
                        {clock} <span className="text-xl font-bold text-white/80">{suffix}</span>
                    </p>
                    <h3 className="text-xl font-bold mt-3">
                        <bdi>
                            {dose.medication_name}
                            {dose.strength && <span className="font-normal text-white/80"> {dose.strength}</span>}
                        </bdi>
                    </h3>
                    <div className="text-white/80 mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1">
                        <Link to={`/members/${dose.member_id}`} className="font-semibold text-white hover:underline">{dose.member_name}</Link>
                        {dose.instructions && <span>· {dose.instructions}</span>}
                        <CourseDay course={dose.course} onDark />
                    </div>
                </div>
                <button onClick={onConfirm} disabled={saving}
                    className="bg-[#fff] text-[#0F766E] font-bold text-lg px-8 py-3.5 rounded-xl shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-70">
                    {saving ? "..." : "تم الأخذ"}
                </button>
            </div>
        </section>
    );
}

// إجراءات سريعة — بطاقة «Quick Actions» في لوحة النموذج
const ACTIONS = [
    { to: "/emergency", label: "الطوارئ والمشاركة مع الطبيب", icon: Siren, color: "text-red-500 bg-red-50" },
    { to: "/voice", label: "التأكيد الصوتي", icon: Mic, color: "text-rose-500 bg-rose-50" },
    { to: "/appointments/new", label: "موعد جديد", icon: Calendar, color: "text-purple-500 bg-purple-100" },
    { to: "/members", label: "الالتزام بالجرعات", icon: TrendingUp, color: "text-indigo-500 bg-indigo-50" },
];

function QuickActions() {
    return (
        <SideCard icon={TrendingUp} iconColor="text-forest-600" title="إجراءات سريعة">
            <div className="space-y-1">
                {ACTIONS.map((a) => (
                    <Link key={a.to} to={a.to}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-sage-50 dark:hover:bg-forest-800/40 transition-colors">
                        <span className={`w-10 h-10 ${a.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                            <a.icon className="w-5 h-5" />
                        </span>
                        <span className="font-medium text-forest-950">{a.label}</span>
                        <ChevronLeft className="w-4 h-4 text-sage-400 mr-auto" />
                    </Link>
                ))}
            </div>
        </SideCard>
    );
}

// «يكفي يومين» / «نفد تقريباً»
function daysText(n) {
    if (n <= 0) return "نفد تقريباً";
    if (n === 1) return "يكفي يوماً واحداً";
    if (n === 2) return "يكفي يومين";
    return `يكفي ${n} أيام`;
}

// يوم الكورس بجانب الجرعة: «يوم ٤ من ٧» أو «آخر يوم»
function CourseDay({ course, onDark = false }) {
    if (!course) return null;
    const tone = onDark ? "bg-white/15 text-white" : course.final_day ? "badge-warning" : "badge-info";
    return (
        <span className={`badge ${tone}`}>
            {course.final_day ? "آخر يوم في الكورس" : `يوم ${course.day} من ${course.total_days}`}
        </span>
    );
}

// بطاقة جانبية بعنوان وأيقونة
function SideCard({ icon: Icon, iconColor, title, action, children, className = "" }) {
    return (
        <section className={`card p-6 ${className}`}>
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-forest-950 flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${iconColor}`} />
                    {title}
                </h2>
                {action}
            </div>
            {children}
        </section>
    );
}

const rowLink = "flex items-center gap-3 bg-sage-50 dark:bg-forest-800/40 rounded-xl p-3 hover:bg-mint-50 dark:hover:bg-forest-800/60 transition-colors";

// الكورسات الجارية: في خطر أولاً (فاتت آخر جرعتين)، ثم آخر يوم، ثم الباقي.
// والمكتمل يبقى يومين — إنهاء الكورس يستحق أن يُرى
function CourseList({ items }) {
    const risky = items.some((c) => c.course.at_risk);
    const chipFor = (c) => {
        if (c.status === "completed") return <span className="badge badge-success">اكتمل</span>;
        if (c.at_risk) return <span className="badge badge-danger">فاتت جرعتان</span>;
        if (c.final_day) return <span className="badge badge-warning">آخر يوم</span>;
        return <span className="badge badge-info">باقي {courseDaysText(c.days_left)}</span>;
    };
    return (
        <SideCard icon={Activity} iconColor={risky ? "text-red-500" : "text-blue-500"} title="الكورسات"
            className={risky ? "!border-red-200 dark:!border-red-900/60" : ""}>
            <ul className="space-y-3">
                {items.map(({ medication_id, name, member_id, member_name, course: c }) => (
                    <li key={medication_id}>
                        <Link to={`/members/${member_id}`} className={rowLink}>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-forest-950 text-sm truncate text-right" dir="auto">{name}</p>
                                <p className="text-xs text-forest-700/60">
                                    {member_name} · {c.status === "completed" ? `${c.taken} من ${c.planned} جرعة` : `اليوم ${c.day} من ${c.total_days}`}
                                </p>
                                <div className="h-1.5 bg-sage-100 dark:bg-forest-900/60 rounded-full overflow-hidden mt-2" aria-hidden="true">
                                    <div className={`h-full rounded-full ${c.at_risk ? "bg-red-500" : "bg-forest-500"}`} style={{ width: `${c.percent}%` }} />
                                </div>
                            </div>
                            {chipFor(c)}
                        </Link>
                    </li>
                ))}
            </ul>
        </SideCard>
    );
}

// الأدوية التي تنفد قريباً — كل سطر يفتح ملف صاحبه حيث زر «جدّدت العلبة»
function RefillList({ items }) {
    return (
        <SideCard icon={AlertTriangle} iconColor="text-amber-500" title="تنفد قريباً">
            <ul className="space-y-3">
                {items.map((r) => (
                    <li key={r.medication_id}>
                        <Link to={`/members/${r.member_id}`} className={rowLink}>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-forest-950 text-sm truncate text-right" dir="auto">{r.name}</p>
                                <p className="text-xs text-forest-700/60">{r.member_name}</p>
                            </div>
                            <span className="badge badge-danger">{daysText(r.days_left)}</span>
                        </Link>
                    </li>
                ))}
            </ul>
        </SideCard>
    );
}

// كم يوماً بين اليوم وتاريخ الموعد: ٠ اليوم، ١ غداً
function dayOffset(scheduledAt) {
    const d = new Date(String(scheduledAt).replace(" ", "T"));
    const start = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    return Math.round((start(d) - start(new Date())) / 86400000);
}

// مواعيد اليوم والغد — كل سطر يفتح صفحة المواعيد
function SoonAppointments({ items }) {
    return (
        <SideCard icon={Calendar} iconColor="text-purple-500" title="مواعيد قريبة"
            action={
                <Link to="/appointments" className="text-sm text-forest-600 hover:text-forest-700 font-medium flex items-center gap-1">
                    الكل <ChevronLeft className="w-4 h-4" />
                </Link>
            }>
            {items.length === 0 ? (
                <div className="text-center py-6">
                    <div className="w-14 h-14 bg-sage-100 dark:bg-forest-800/60 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Calendar className="w-7 h-7 text-sage-400 dark:text-forest-600" />
                    </div>
                    <p className="text-forest-700/60 text-sm">لا مواعيد اليوم أو غداً.</p>
                </div>
            ) : (
                <ul className="space-y-3">
                    {items.map((a) => {
                        const time = String(a.scheduled_at).replace("T", " ").split(" ")[1].slice(0, 5);
                        return (
                            <li key={a.id}>
                                <Link to="/appointments" className={rowLink}>
                                    <div className="flex items-center justify-center bg-forest-600 text-white rounded-lg w-12 h-12 flex-shrink-0">
                                        <span className="text-xs font-bold">{dayOffset(a.scheduled_at) === 0 ? "اليوم" : "غداً"}</span>
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-semibold text-forest-950 text-sm truncate">{a.title}</p>
                                        <p className="text-xs text-forest-700/60">
                                            {formatTime(time)} · {a.member_name}{a.location ? ` · ${a.location}` : ""}
                                        </p>
                                    </div>
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            )}
        </SideCard>
    );
}
