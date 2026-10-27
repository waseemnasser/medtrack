import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import Skeleton from "../components/Skeleton";
import { useFeedback } from "../feedback/context";
import { Calendar, Plus, Clock, Stethoscope, MapPin, Edit2, Trash2, CheckCircle } from "lucide-react";

const DAY_MS = 86400000;

function parseDT(value) {
    // الخادم يرجع "2026-10-28 11:00:00" بعد تعطيل تحويل المنطقة الزمنية
    return new Date(String(value).replace(" ", "T"));
}

function formatDT(value) {
    const d = parseDT(value);
    const hour = d.getHours();
    const suffix = hour < 12 ? "ص" : "م";
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} · ${h12}:${mm} ${suffix}`;
}

function relativeLabel(value) {
    const target = parseDT(value);
    const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const diffDays = Math.round((startOfDay(target) - startOfDay(new Date())) / DAY_MS);
    if (diffDays === 0) return "اليوم";
    if (diffDays === 1) return "غداً";
    if (diffDays > 1) return `بعد ${diffDays} أيام`;
    return null;
}

export default function Appointments() {
    const [appts, setAppts] = useState([]);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [filter, setFilter] = useState("upcoming");
    const navigate = useNavigate();
    const { confirm, toast } = useFeedback();

    useEffect(() => {
        const load = async () => {
            try {
                const [aRes, mRes] = await Promise.all([
                    api.get("/appointments"),
                    api.get("/members"),
                ]);
                setAppts(aRes.data);
                setMembers(mRes.data);
            } catch {
                setError("تعذّر تحميل المواعيد. حاول مجدداً.");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, []);

    const memberName = (id) =>
        members.find((m) => m.id === id)?.name || "";

    const remove = async (a) => {
        const ok = await confirm({
            title: "حذف الموعد؟",
            message: `سيُحذف موعد «${a.title}» نهائياً.`,
            confirmLabel: "حذف",
            danger: true,
        });
        if (!ok) return;
        try {
            await api.delete(`/appointments/${a.id}`);
            setAppts((prev) => prev.filter((x) => x.id !== a.id));
            toast("حُذف الموعد");
        } catch {
            toast("تعذّر الحذف، حاول مجدداً", "error");
        }
    };

    if (loading) return <Skeleton rows={3} />;

    const now = new Date();
    const upcoming = appts
        .filter((a) => parseDT(a.scheduled_at) >= now)
        .sort((a, b) => parseDT(a.scheduled_at) - parseDT(b.scheduled_at));
    const past = appts
        .filter((a) => parseDT(a.scheduled_at) < now)
        .sort((a, b) => parseDT(b.scheduled_at) - parseDT(a.scheduled_at));
    const shown = filter === "past" ? past : filter === "all" ? [...upcoming, ...past] : upcoming;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-extrabold text-forest-950">المواعيد</h1>
                    <p className="text-forest-700/60 mt-1">مواعيد الأطباء والتحاليل لكل العائلة</p>
                </div>
                <Link to="/appointments/new" className="btn-primary flex items-center gap-2 flex-shrink-0">
                    <Plus className="w-5 h-5" /> موعد جديد
                </Link>
            </div>

            <div className="flex gap-2" role="tablist">
                {FILTERS.map((f) => (
                    <button key={f.key} role="tab" aria-selected={filter === f.key} onClick={() => setFilter(f.key)}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${filter === f.key
                            ? "bg-forest-600 text-white shadow-lg shadow-forest-600/30"
                            : "bg-white text-forest-700 border border-sage-200 hover:border-forest-300"}`}>
                        {f.label}
                    </button>
                ))}
            </div>

            {error && <div className="card p-4 !border-red-200 bg-red-50 text-red-700">{error}</div>}

            {shown.length === 0 ? (
                <div className="card p-12 text-center">
                    <div className="w-20 h-20 bg-sage-100 dark:bg-forest-800/60 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Calendar className="w-10 h-10 text-sage-400 dark:text-forest-600" />
                    </div>
                    <h3 className="text-lg font-bold text-forest-950">
                        {filter === "past" ? "لا توجد مواعيد سابقة" : "لا توجد مواعيد قادمة"}
                    </h3>
                    <p className="text-forest-700/60 mt-1">أضف موعد طبيب أو تحليل، ونذكّرك به في وقته.</p>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 gap-4">
                    {shown.map((a) => (
                        <ApptCard key={a.id} a={a} past={parseDT(a.scheduled_at) < now}
                            memberName={memberName(a.member_id)}
                            onEdit={() => navigate(`/appointments/${a.id}/edit`)}
                            onDelete={() => remove(a)} />
                    ))}
                </div>
            )}
        </div>
    );
}

const FILTERS = [
    { key: "upcoming", label: "القادمة" },
    { key: "past", label: "السابقة" },
    { key: "all", label: "الكل" },
];

// ورقة التقويم على جانب البطاقة: اليوم بخط كبير والشهر فوقه
function ApptCard({ a, past, memberName, onEdit, onDelete }) {
    const d = parseDT(a.scheduled_at);
    const rel = !past && relativeLabel(a.scheduled_at);
    return (
        <div className={`card card-hover p-5 ${past ? "opacity-70" : ""}`}>
            <div className="flex items-start gap-4">
                <div className={`flex flex-col items-center justify-center rounded-xl w-14 h-14 flex-shrink-0 ${past
                    ? "bg-sage-100 dark:bg-forest-800/60 text-forest-700"
                    : "bg-forest-600 text-white"}`} aria-hidden="true">
                    <span className="text-[10px] font-medium">{d.toLocaleDateString("ar-SY", { month: "short" })}</span>
                    <span className="text-xl font-extrabold leading-none">{d.getDate()}</span>
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        {rel && <span className="badge badge-info">{rel}</span>}
                        {past && <span className="badge badge-success"><CheckCircle className="w-3 h-3" /> مضى</span>}
                    </div>
                    <h3 className="font-bold text-forest-950 truncate">{a.title}</h3>
                    {memberName && (
                        <Link to={`/members/${a.member_id}?tab=appts`} className="text-sm text-forest-700/60 hover:text-forest-600">{memberName}</Link>
                    )}
                </div>
            </div>

            <div className="mt-4 space-y-1.5 text-sm">
                <div className="flex items-center gap-2 text-forest-700">
                    <Clock className="w-4 h-4 text-sage-400" /> {formatDT(a.scheduled_at)}
                </div>
                {a.doctor_name && (
                    <div className="flex items-center gap-2 text-forest-700">
                        <Stethoscope className="w-4 h-4 text-sage-400" /> {a.doctor_name}
                    </div>
                )}
                {a.location && (
                    <div className="flex items-center gap-2 text-forest-700">
                        <MapPin className="w-4 h-4 text-sage-400" /> {a.location}
                    </div>
                )}
                {a.notes && <p className="text-forest-700/70 bg-sage-50 dark:bg-forest-800/40 rounded-lg p-2 mt-2">{a.notes}</p>}
            </div>

            <div className="flex gap-2 pt-3 mt-4 border-t border-sage-100 dark:border-forest-800/60">
                <button onClick={onEdit} className="flex-1 text-sm text-forest-700 hover:bg-mint-50 dark:hover:bg-forest-800/60 py-2 rounded-lg flex items-center justify-center gap-1.5">
                    <Edit2 className="w-4 h-4" /> تعديل
                </button>
                <button onClick={onDelete} className="flex-1 text-sm text-red-500 hover:bg-red-50 py-2 rounded-lg flex items-center justify-center gap-1.5">
                    <Trash2 className="w-4 h-4" /> حذف
                </button>
            </div>
        </div>
    );
}
