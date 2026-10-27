import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import {
    Pill, Calendar, Share2, Edit2, PauseCircle, RefreshCw, AlertTriangle, Heart, Clock,
    MapPin, Stethoscope, Lock, CheckCircle, HelpCircle, Plus,
} from "lucide-react";
import api from "../api";
import PageHeader from "../components/PageHeader";
import Skeleton from "../components/Skeleton";
import AdherenceReport from "../components/AdherenceReport";
import CourseProgress from "../components/CourseProgress";
import ConflictList from "../components/ConflictList";
import { useFeedback } from "../feedback/context";
import { periodOf, formatTime, formatDate, calcAge, initial, daysText } from "../utils/format";

const DAYS = { 1: "الأحد", 2: "الإثنين", 3: "الثلاثاء", 4: "الأربعاء", 5: "الخميس", 6: "الجمعة", 7: "السبت" };

function daysLabel(daysOfWeek) {
    if (!daysOfWeek) return "";
    if (daysOfWeek.length === 7) return "كل يوم";
    return daysOfWeek.split("").map((d) => DAYS[d]).join("، ");
}

function formatDateTime(iso) {
    if (!iso) return "";
    const s = String(iso).replace("T", " ");
    const [date, time] = s.split(" ");
    return `${formatDate(date)} · ${formatTime(time.slice(0, 5))}`;
}

// شارة تقدير نفاد الدواء — من /medications/:id/supply
function SupplyChip({ supply }) {
    if (!supply?.known) return null;
    if (supply.days_left === 0) return <span className="badge badge-danger">نفد تقريباً — جدّد العلبة</span>;
    if (supply.needs_refill_soon)
        return <span className="badge badge-danger">ينفد خلال {supply.days_left} أيام</span>;
    return <span className="badge badge-success">يكفي حتى {formatDate(supply.depletion_date, false)} تقريباً</span>;
}

// أزرار أسفل البطاقة، بأسلوب بطاقات الأدوية في النموذج
const cardAction = "flex-1 text-sm text-forest-700 hover:bg-mint-50 dark:hover:bg-forest-800/60 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors";

export default function MemberProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { confirm, toast } = useFeedback();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get("tab") === "appts" ? "appts" : "meds";

    const [member, setMember] = useState(null);
    const [meds, setMeds] = useState([]);
    const [supply, setSupply] = useState({}); // medication_id → تقدير النفاد
    const [refilling, setRefilling] = useState(null); // الدواء المفتوح نموذج تجديده
    const [stopping, setStopping] = useState(null);   // كورس جارٍ مفتوح تحذير إيقافه
    const [appts, setAppts] = useState([]);
    // الفحص المعاكس: أدوية حالية تتعارض مع الحساسية، وأدوية موادها غير معروفة
    const [allergyCheck, setAllergyCheck] = useState({ medications: [], unknown_ingredients: [] });
    const [checkedAllergies, setCheckedAllergies] = useState(false);
    const [adherence, setAdherence] = useState(null);
    const [adherenceDays, setAdherenceDays] = useState(7);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const loadSupply = async (activeMeds) => {
            const entries = await Promise.all(
                activeMeds.map((m) =>
                    api.get(`/medications/${m.id}/supply`)
                        .then((r) => [m.id, r.data])
                        .catch(() => [m.id, null])
                )
            );
            setSupply(Object.fromEntries(entries));
        };

        const load = async () => {
            try {
                const [mRes, medRes, apRes, alRes] = await Promise.all([
                    api.get("/members"),
                    api.get(`/medications/member/${id}`),
                    api.get(`/appointments?member_id=${id}`),
                    api.get(`/members/${id}/allergies`),
                ]);
                setAllergyCheck(alRes.data.conflicts);
                setCheckedAllergies(alRes.data.allergies.some((a) => a.checked));
                setMember(mRes.data.find((x) => String(x.id) === String(id)) || null);
                setMeds(medRes.data);
                setAppts(apRes.data);
                loadSupply(medRes.data.filter((m) => m.is_active !== false));
            } catch {
                setError("تعذّر تحميل بيانات الفرد. حاول مجدداً.");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [id]);

    // تقرير الالتزام: يُعاد عند تغيير الفترة (٧ / ٣٠ يوماً)
    useEffect(() => {
        api.get(`/members/${id}/adherence`, { params: { days: adherenceDays } })
            .then((r) => setAdherence(r.data))
            .catch(() => setAdherence(null));
    }, [id, adherenceDays]);


    const setTab = (t) => setSearchParams(t === "appts" ? { tab: "appts" } : {}, { replace: true });

    // كورس لم ينتهِ: تحذير داخل البطاقة مع سؤال «لماذا؟» بدل التأكيد العادي —
    // التوقف قبل نهاية الكورس أكثر مشكلة يراها الصيادلة
    const askStop = async (med) => {
        if (med.course?.status === "active") return setStopping(med.id);
        const ok = await confirm({
            title: `إيقاف ${med.name}؟`,
            message: "ستتوقف تذكيرات هذا الدواء، ويبقى في السجل ضمن «أدوية متوقفة».",
            confirmLabel: "إيقاف الدواء",
            danger: true,
        });
        if (ok) stopMedication(med);
    };

    const stopMedication = async (med, reason = null) => {
        try {
            const res = await api.patch(`/medications/${med.id}/stop`, { reason });
            setStopping(null);
            setMeds((prev) => prev.map((m) => (m.id === med.id ? { ...m, ...res.data } : m)));
            // دواء متوقّف لا يُفحص: يخرج من تنبيه الحساسية
            setAllergyCheck((c) => ({
                medications: c.medications.filter((m) => m.id !== med.id),
                unknown_ingredients: c.unknown_ingredients.filter((m) => m.id !== med.id),
            }));
            toast(`أُوقف ${med.name}`);
        } catch {
            toast("تعذّر إيقاف الدواء، حاول مجدداً", "error");
        }
    };

    if (loading) return <Skeleton variant="profile" rows={2} />;
    if (error) return <div><PageHeader back="/members" /><div className="card p-4 !border-red-200 bg-red-50 text-red-700">{error}</div></div>;
    if (!member) {
        return (
            <div>
                <PageHeader back="/members" />
                <EmptyState icon={HelpCircle} title="هذا الفرد غير موجود">
                    <Link to="/members" className="btn-secondary inline-block mt-4">العودة إلى العائلة</Link>
                </EmptyState>
            </div>
        );
    }

    // الكورس الذي انتهت مدته يخرج من «الحالية» إلى «كورسات مكتملة»
    const finished = (m) => m.course?.status === "completed";
    const active = meds.filter((m) => m.is_active !== false && !finished(m));
    const completed = meds.filter((m) => m.is_active !== false && finished(m));
    const stopped = meds.filter((m) => m.is_active === false);
    const age = calcAge(member.birth_date);

    const now = new Date();
    const parseDT = (v) => new Date(String(v).replace(" ", "T"));
    const upcomingAppts = appts
        .filter((a) => parseDT(a.scheduled_at) >= now)
        .sort((a, b) => parseDT(a.scheduled_at) - parseDT(b.scheduled_at));
    const pastAppts = appts
        .filter((a) => parseDT(a.scheduled_at) < now)
        .sort((a, b) => parseDT(b.scheduled_at) - parseDT(a.scheduled_at));

    const facts = [
        { label: "العمر", value: age !== null ? `${age} سنة` : "غير محدّد", icon: Calendar, color: "text-blue-500 bg-blue-50" },
        { label: "أدوية نشطة", value: active.length, icon: Pill, color: "text-forest-600 bg-forest-100" },
        { label: "مواعيد قادمة", value: upcomingAppts.length, icon: Clock, color: "text-purple-500 bg-purple-100" },
    ];

    return (
        <div className="space-y-6">
            <PageHeader
                back="/members"
                action={
                    <Link to={`/members/${id}/edit`} className="btn-secondary !px-4 !py-2 text-sm flex items-center gap-1.5">
                        <Edit2 className="w-4 h-4" /> تعديل
                    </Link>
                }
            />

            {/* ترويسة الفرد: من يخصّه هذا الملف وحقائقه الأساسية */}
            <header className="card p-6">
                <div className="flex items-start gap-4 mb-5">
                    <div className="w-16 h-16 gradient-forest rounded-2xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                        {initial(member.name)}
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm text-forest-700/60">ملف شخصي</p>
                        <h1 className="text-2xl lg:text-3xl font-extrabold text-forest-950 truncate">{member.name}</h1>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                            {member.chronic_conditions ? (
                                <span className="badge badge-warning"><Heart className="w-3 h-3" /> {member.chronic_conditions}</span>
                            ) : (
                                <span className="text-sm text-forest-700/60">لا توجد أمراض مزمنة مسجّلة</span>
                            )}
                            {member.allergies && (
                                <span className="badge badge-danger"><AlertTriangle className="w-3 h-3" /> حساسية: {member.allergies}</span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                    {facts.map((f) => (
                        <div key={f.label} className="bg-sage-50 dark:bg-forest-800/40 rounded-xl p-3 sm:p-4">
                            <div className={`w-9 h-9 ${f.color} rounded-lg flex items-center justify-center mb-2`}>
                                <f.icon className="w-5 h-5" />
                            </div>
                            <p className="text-xs text-forest-700/60">{f.label}</p>
                            <p className="font-bold text-forest-950">{f.value}</p>
                        </div>
                    ))}
                </div>
            </header>

            {/* أدوية حالية تتعارض مع الحساسية — تظهر حتى لو أُضيفت الحساسية بعد الدواء */}
            {allergyCheck.medications.length > 0 && (
                <div className="card p-5 !border-red-200 dark:!border-red-900/60 bg-red-50" role="alert">
                    <p className="font-bold text-red-700 dark:text-red-300 flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-5 h-5" /> تعارض مع الحساسية
                    </p>
                    {allergyCheck.medications.map((m) => (
                        <div key={m.id} className="mb-3 text-forest-950">
                            <Link to={`/members/${id}/medications/${m.id}/edit`} className="font-semibold underline decoration-red-300 hover:text-red-700">{m.name}</Link>
                            <ConflictList conflicts={m.conflicts} />
                        </div>
                    ))}
                    <p className="text-sm text-forest-700/70">إن كان الطبيب يعلم بهذا، فلا شيء عليك. وإلا فراجعه قبل الجرعة التالية.</p>
                </div>
            )}
            {checkedAllergies && allergyCheck.unknown_ingredients.length > 0 && (
                <div className="card p-4 bg-amber-50 !border-amber-200 dark:!border-amber-900/60 text-sm text-forest-800" role="note">
                    لا يمكن فحص هذه الأدوية مع الحساسية لأن مادتها الفعّالة غير معروفة:{" "}
                    {allergyCheck.unknown_ingredients.map((m, i) => (
                        <span key={m.id}>
                            {i > 0 && "، "}
                            <Link to={`/members/${id}/medications/${m.id}/edit`} className="font-semibold underline">{m.name}</Link>
                        </span>
                    ))}
                    . افتح الدواء واختر مادته.
                </div>
            )}

            {/* الإجراءات السريعة: كل ما يخصّ هذا الفرد يبدأ من هنا */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Link to={`/members/${id}/medications/new`} className="btn-primary flex items-center justify-center gap-2">
                    <Plus className="w-5 h-5" /> إضافة دواء
                </Link>
                <Link to={`/appointments/new?member_id=${id}`} className="btn-secondary flex items-center justify-center gap-2">
                    <Calendar className="w-5 h-5 text-purple-500" /> إضافة موعد
                </Link>
                <Link to={`/members/${id}/share`} className="btn-secondary flex items-center justify-center gap-2">
                    <Share2 className="w-5 h-5 text-teal-500" /> مشاركة مع الطبيب
                </Link>
            </div>

            {/* الالتزام بالجرعات — نسبة وشريط يومي وكل دواء */}
            {adherence && active.length > 0 && (
                <AdherenceReport data={adherence} onDays={setAdherenceDays} />
            )}

            <div className="flex bg-white dark:bg-forest-900/50 border border-sage-200 dark:border-forest-700/50 rounded-xl p-1 w-full sm:w-fit" role="tablist">
                {[
                    { key: "meds", label: "الأدوية", count: active.length },
                    { key: "appts", label: "المواعيد", count: upcomingAppts.length },
                ].map((t) => (
                    <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
                        className={`flex-1 sm:flex-none px-5 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${tab === t.key
                            ? "bg-forest-600 text-white shadow-md shadow-forest-600/30"
                            : "text-forest-700 hover:bg-sage-50"}`}>
                        {t.label}
                        <span className={`text-xs px-1.5 rounded-full ${tab === t.key ? "bg-white/20" : "bg-sage-100 dark:bg-forest-800/60"}`}>{t.count}</span>
                    </button>
                ))}
            </div>

            {tab === "meds" && (
                <>
                    {active.length === 0 ? (
                        <EmptyState icon={Pill} title="لا توجد أدوية مضافة لهذا الفرد">
                            <Link to={`/members/${id}/medications/new`} className="btn-primary inline-flex items-center gap-2 mt-4">
                                <Plus className="w-5 h-5" /> أضف أول دواء
                            </Link>
                        </EmptyState>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {active.map((m) => (
                                <div className="card p-5 flex flex-col" key={m.id}>
                                    <div className="flex items-start justify-between gap-3 mb-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="w-12 h-12 bg-forest-100 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <Pill className="w-6 h-6 text-forest-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-forest-950 break-words"><bdi>{m.name}</bdi></h3>
                                                {(m.strength || m.form) && (
                                                    <p className="text-sm text-forest-700/60">{[m.strength, m.form].filter(Boolean).map((x, i) => <span key={i}>{i > 0 && " — "}<bdi>{x}</bdi></span>)}</p>
                                                )}
                                            </div>
                                        </div>
                                        {m.is_private
                                            ? <span className="badge badge-info flex-shrink-0"><Lock className="w-3 h-3" /> دواء خاص</span>
                                            : <span className="badge badge-success flex-shrink-0"><CheckCircle className="w-3 h-3" /> نشط</span>}
                                    </div>

                                    {(m.active_ingredient || m.instructions) && (
                                        <div className="space-y-1 mb-3 text-sm">
                                            {m.active_ingredient && <p className="text-forest-700/60">{m.active_ingredient}</p>}
                                            {m.instructions && <p className="text-forest-800">{m.instructions}</p>}
                                        </div>
                                    )}

                                    {m.schedules?.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 mb-1">
                                            {m.schedules.map((s) => (
                                                <span className={`badge ${periodOf(s.time_of_day).chip}`} key={s.id}>
                                                    <Clock className="w-3 h-3" />
                                                    {formatTime(s.time_of_day)} · {daysLabel(s.days_of_week)}
                                                </span>
                                            ))}
                                        </div>
                                    )}

                                    {supply[m.id]?.known && (
                                        <div className="mt-2"><SupplyChip supply={supply[m.id]} /></div>
                                    )}

                                    <CourseProgress course={m.course} startDate={m.start_date} />

                                    {stopping === m.id && (
                                        <StopCourse
                                            med={m}
                                            onKeep={() => setStopping(null)}
                                            onStop={(reason) => stopMedication(m, reason)}
                                        />
                                    )}

                                    {refilling === m.id && (
                                        <RefillForm
                                            med={m}
                                            onCancel={() => setRefilling(null)}
                                            onDone={(next) => {
                                                setSupply((s) => ({ ...s, [m.id]: next }));
                                                setRefilling(null);
                                                toast(`سُجّلت العلبة الجديدة — تكفي ${next.days_left} يوماً تقريباً`);
                                            }}
                                        />
                                    )}

                                    {/* الأزرار في أسفل البطاقة مهما قصر محتواها */}
                                    <div className="flex-1 min-h-4" />
                                    <div className="flex gap-2 pt-3 border-t border-sage-100 dark:border-forest-800/60">
                                        {m.units_total > 0 && refilling !== m.id && (
                                            <button onClick={() => setRefilling(m.id)}
                                                className={supply[m.id]?.needs_refill_soon
                                                    ? "flex-1 text-sm font-semibold text-white bg-forest-600 hover:bg-forest-700 py-2 rounded-lg flex items-center justify-center gap-1.5"
                                                    : cardAction}>
                                                <RefreshCw className="w-4 h-4" /> جدّدت العلبة
                                            </button>
                                        )}
                                        <button onClick={() => navigate(`/members/${id}/medications/${m.id}/edit`)} className={cardAction}>
                                            <Edit2 className="w-4 h-4" /> تعديل
                                        </button>
                                        {stopping !== m.id && (
                                            <button onClick={() => askStop(m)}
                                                className="flex-1 text-sm text-red-500 hover:bg-red-50 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                                                <PauseCircle className="w-4 h-4" /> إيقاف
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {completed.length > 0 && (
                        <>
                            <SectionTitle>كورسات مكتملة</SectionTitle>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {completed.map((m) => (
                                    <div className="card p-5 opacity-80" key={m.id}>
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="font-bold text-forest-950">{m.name}</h3>
                                            <span className="badge badge-success">اكتمل</span>
                                        </div>
                                        {m.strength && <p className="text-sm text-forest-700/60">{m.strength}</p>}
                                        <CourseProgress course={m.course} startDate={m.start_date} />
                                    </div>
                                ))}
                            </div>
                        </>
                    )}

                    {stopped.length > 0 && (
                        <>
                            <SectionTitle>أدوية متوقفة</SectionTitle>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {stopped.map((m) => (
                                    <div className="card p-5 opacity-60" key={m.id}>
                                        <div className="flex items-center justify-between gap-2">
                                            <h3 className="font-bold text-forest-950">{m.name}</h3>
                                            <span className={`badge ${m.course?.status === "stopped_early" ? "badge-danger" : "badge-warning"}`}>
                                                {m.course?.status === "stopped_early" ? "أُوقف قبل نهاية الكورس" : "متوقّف"}
                                            </span>
                                        </div>
                                        {m.strength && <p className="text-sm text-forest-700/60">{m.strength}</p>}
                                        {m.course?.status === "stopped_early" && (
                                            <CourseProgress course={m.course} startDate={m.start_date} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            {tab === "appts" && (
                <>
                    {upcomingAppts.length === 0 ? (
                        <EmptyState icon={Calendar} title="لا توجد مواعيد قادمة لهذا الفرد">
                            <Link to={`/appointments/new?member_id=${id}`} className="btn-primary inline-flex items-center gap-2 mt-4">
                                <Plus className="w-5 h-5" /> أضف موعداً
                            </Link>
                        </EmptyState>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {upcomingAppts.map((a) => (
                                <ApptCard a={a} key={a.id} onEdit={() => navigate(`/appointments/${a.id}/edit?member_id=${id}`)} />
                            ))}
                        </div>
                    )}

                    {pastAppts.length > 0 && (
                        <>
                            <SectionTitle>مواعيد سابقة</SectionTitle>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pastAppts.map((a) => <ApptCard a={a} dim key={a.id} />)}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function SectionTitle({ children }) {
    return <h2 className="text-lg font-bold text-forest-950 pt-2">{children}</h2>;
}

function EmptyState({ icon: Icon, title, children }) {
    return (
        <div className="card p-12 text-center">
            <div className="w-20 h-20 bg-sage-100 dark:bg-forest-800/60 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon className="w-10 h-10 text-sage-400 dark:text-forest-600" />
            </div>
            <h3 className="text-lg font-bold text-forest-950">{title}</h3>
            {children}
        </div>
    );
}

function ApptCard({ a, dim, onEdit }) {
    return (
        <div className={`card p-5 ${dim ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-6 h-6 text-purple-600" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                    <h3 className="font-bold text-forest-950">{a.title}</h3>
                    <p className="text-sm font-medium text-forest-700">{formatDateTime(a.scheduled_at)}</p>
                    {a.doctor_name && <p className="text-sm text-forest-700/60 flex items-center gap-1.5"><Stethoscope className="w-3.5 h-3.5" /> {a.doctor_name}</p>}
                    {a.location && <p className="text-sm text-forest-700/60 flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" /> {a.location}</p>}
                    {a.notes && <p className="text-sm text-forest-700/70 bg-sage-50 dark:bg-forest-800/40 rounded-lg p-2 mt-2">{a.notes}</p>}
                </div>
            </div>
            {onEdit && (
                <div className="flex pt-3 mt-4 border-t border-sage-100 dark:border-forest-800/60">
                    <button onClick={onEdit} className={cardAction}><Edit2 className="w-4 h-4" /> تعديل</button>
                </div>
            )}
        </div>
    );
}

// أسباب الإيقاف — نفس المفاتيح في الخادم (course.js)، وتظهر للطبيب
const STOP_REASONS = [
    { key: "doctor", label: "بقرار الطبيب" },
    { key: "side_effects", label: "أعراض جانبية" },
    { key: "felt_better", label: "شعر بتحسّن" },
    { key: "other", label: "سبب آخر" },
];

// إيقاف كورس قبل نهايته: ما بقي منه، وسؤال «لماذا؟». الزر الأبرز «أكمل الكورس»،
// والإيقاف ممكن دائماً — القرار للطبيب، والتطبيق يذكّر فقط
function StopCourse({ med, onKeep, onStop }) {
    const c = med.course;
    const [reason, setReason] = useState("");
    const [saving, setSaving] = useState(false);

    return (
        <div className="mt-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 p-4" role="group" aria-label={`إيقاف ${med.name}`}>
            <p className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" /> الكورس لم ينتهِ بعد
            </p>
            <p className="text-sm text-forest-800 mt-1">
                اليوم {c.day} من {c.total_days}
                {c.days_left > 0 ? ` — باقي ${daysText(c.days_left)} بعد اليوم` : " — اليوم آخر يوم"}.
                {" "}إيقاف الكورس قبل نهايته يكون بقرار من الطبيب أو الصيدلاني.
            </p>
            <p className="text-sm font-semibold text-forest-800 mt-3 mb-2">لماذا يُوقف؟</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="سبب الإيقاف">
                {STOP_REASONS.map((r) => (
                    <button key={r.key} type="button" role="radio" aria-checked={reason === r.key}
                        onClick={() => setReason(r.key)}
                        className={`px-3 py-1.5 rounded-xl text-sm font-semibold border transition-all ${reason === r.key
                            ? "bg-forest-600 text-white border-forest-600"
                            : "bg-white text-forest-700 border-sage-200 hover:border-forest-300"}`}>
                        {r.label}
                    </button>
                ))}
            </div>
            {reason === "felt_better" && (
                <p className="text-sm text-amber-800 dark:text-amber-300 font-medium mt-3">التحسّن لا يعني أن العلاج اكتمل. راجع الطبيب أو الصيدلاني قبل الإيقاف.</p>
            )}
            <div className="flex flex-wrap gap-2 mt-4">
                <button type="button" className="btn-primary !px-4 !py-2 text-sm" onClick={onKeep}>أكمل الكورس</button>
                <button type="button" className="btn-danger !px-4 !py-2 text-sm disabled:opacity-50 disabled:hover:translate-y-0" disabled={!reason || saving}
                    onClick={() => { setSaving(true); onStop(reason); }}>
                    {saving ? "..." : "إيقاف رغم ذلك"}
                </button>
            </div>
        </div>
    );
}

// «جدّدت العلبة»: عدد الوحدات في العلبة الجديدة، فيبدأ العدّ من اليوم
function RefillForm({ med, onCancel, onDone }) {
    // أول تجديد؟ غالباً العلبة الجديدة بحجم الأولى
    const [units, setUnits] = useState(med.supply_since ? "" : String(med.units_total || ""));
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const submit = async (e) => {
        e.preventDefault();
        if (!(Number(units) > 0)) return setError("أدخل عدد الوحدات في العلبة الجديدة");
        setSaving(true);
        setError("");
        try {
            const res = await api.post(`/medications/${med.id}/refill`, { units: Number(units) });
            onDone(res.data);
        } catch (err) {
            setError(err.response?.data?.error || "تعذّر الحفظ، حاول مجدداً");
            setSaving(false);
        }
    };

    return (
        <form className="mt-3 rounded-xl bg-sage-50 dark:bg-forest-800/40 p-4" onSubmit={submit}>
            <label htmlFor={`refill-${med.id}`} className="block text-sm font-semibold text-forest-800 mb-1.5">كم وحدة في العلبة الجديدة؟</label>
            <div className="flex gap-2">
                <input
                    id={`refill-${med.id}`}
                    type="number"
                    inputMode="numeric"
                    min="1"
                    value={units}
                    onChange={(e) => setUnits(e.target.value)}
                    className="input-field !py-2"
                    autoFocus
                />
                <button type="submit" className="btn-primary !px-4 !py-2 text-sm" disabled={saving}>
                    {saving ? "..." : "حفظ"}
                </button>
                <button type="button" className="btn-secondary !px-4 !py-2 text-sm" onClick={onCancel}>إلغاء</button>
            </div>
            <p className="text-xs text-forest-700/60 mt-2">يُضاف إلى ما تبقّى من العلبة الحالية، ويبدأ العدّ من اليوم.</p>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </form>
    );
}
