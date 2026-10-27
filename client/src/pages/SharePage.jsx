import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import PageHeader from "../components/PageHeader";
import { FormError } from "../components/Field";
import { formatDate, formatTime } from "../utils/format";
import {
    ShieldCheck, Eye, Clock, Lock, QrCode, CheckCircle, Link as LinkIcon, Copy, Send,
    Pill, AlertTriangle, History,
} from "lucide-react";

// مدة صلاحية الرابط — الخادم يقبل أي عدد ساعات
// الرقم كبير بخط العرض، والوحدة تحته
const DURATIONS = [
    { hours: 24, num: "١", unit: "يوم" },
    { hours: 72, num: "٣", unit: "أيام" },
    { hours: 168, num: "٧", unit: "أيام" },
];

// ما يراه الطبيب
const SEES = [
    { icon: Pill, color: "bg-forest-100 text-forest-600", title: "الأدوية الحالية", text: "وأوقات جرعاتها، والمادة الفعّالة لكل دواء." },
    { icon: AlertTriangle, color: "bg-red-100 text-red-600", title: "الحساسية والأمراض المزمنة", text: "الحساسية أولاً وبالأحمر، مع شدّتها ونوع التفاعل." },
    { icon: History, color: "bg-purple-100 text-purple-600", title: "سجل الجرعات والمواعيد", text: "آخر الجرعات المؤكَّدة، والمواعيد القادمة." },
];

export default function SharePage() {
    const { id } = useParams();

    const [member, setMember] = useState(null);
    const [hours, setHours] = useState(24);
    const [link, setLink] = useState(null);
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("/members")
            .then((res) => setMember(res.data.find((m) => String(m.id) === String(id))))
            .catch(() => setError("تعذّر تحميل بيانات الفرد"));
    }, [id]);

    const createLink = async () => {
        setCreating(true);
        setError("");
        try {
            const res = await api.post(`/share/${id}`, { hours });
            setLink(res.data);
        } catch (err) {
            setError(err.response?.data?.error || "تعذّر إنشاء الرابط، حاول مجدداً");
        } finally {
            setCreating(false);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError("تعذّر النسخ، انسخ الرابط يدوياً من المربع أعلاه");
        }
    };

    // مشاركة عبر تطبيقات الهاتف (واتساب، رسائل...) إن كان المتصفح يدعمها
    const canShare = typeof navigator !== "undefined" && Boolean(navigator.share);
    const share = async () => {
        try {
            await navigator.share({
                title: `ملف ${member?.name || "المريض"} — نبض`,
                text: "رابط مؤقت لملف الأدوية والمواعيد",
                url: link.url,
            });
        } catch {
            // ألغى المستخدم المشاركة — لا شيء نفعله
        }
    };

    const expiry = (value) => {
        const d = new Date(String(value).replace(" ", "T"));
        const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return `${formatDate(day)} · ${formatTime(time)}`;
    };

    return (
        <div className="max-w-3xl space-y-6">
            <PageHeader title="مشاركة مع الطبيب" subtitle={member ? `ملف ${member.name}` : undefined} back={`/members/${id}`} />

            {/* كيف تعمل المشاركة — بطاقة النموذج الأولي بالنعناعي */}
            <div className="card p-5 !border-forest-200 bg-mint-50">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-forest-600 rounded-xl flex items-center justify-center flex-shrink-0">
                        <ShieldCheck className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="font-bold text-forest-950">رابط مؤقّت للطبيب</h2>
                        <p className="text-sm text-forest-700/70 mt-1">
                            يفتحه الطبيب على هاتفه بلا حساب ولا تطبيق. للقراءة فقط،
                            وينتهي وحده في الموعد الذي تختاره.
                        </p>
                    </div>
                </div>
            </div>

            {!link ? (
                <>
                    <section className="card p-6">
                        <h2 className="text-lg font-bold text-forest-950 flex items-center gap-2 mb-5">
                            <Eye className="w-5 h-5 text-forest-600" /> ماذا سيرى الطبيب؟
                        </h2>
                        <ul className="space-y-3">
                            {SEES.map(({ icon: Icon, color, title, text }) => (
                                <li key={title} className="flex items-start gap-3 bg-sage-50 dark:bg-forest-800/40 rounded-xl p-4">
                                    <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-semibold text-forest-950">{title}</p>
                                        <p className="text-sm text-forest-700/60">{text}</p>
                                    </div>
                                </li>
                            ))}
                            <li className="flex items-start gap-3 rounded-xl p-4 border-2 border-dashed border-sage-200">
                                <div className="w-10 h-10 bg-sage-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Lock className="w-5 h-5 text-forest-700/60" />
                                </div>
                                <div>
                                    <p className="font-semibold text-forest-950">الأدوية الخاصة لا تظهر</p>
                                    <p className="text-sm text-forest-700/60">ما علّمته «خاصاً» يبقى عندك، في الرابط وفي سجل الجرعات.</p>
                                </div>
                            </li>
                        </ul>
                    </section>

                    <section className="card p-6">
                        <h2 className="text-lg font-bold text-forest-950 flex items-center gap-2 mb-5">
                            <Clock className="w-5 h-5 text-purple-500" /> مدة صلاحية الرابط
                        </h2>
                        <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="مدة صلاحية الرابط">
                            {DURATIONS.map((d) => (
                                <button
                                    key={d.hours}
                                    type="button"
                                    role="radio"
                                    aria-checked={hours === d.hours}
                                    onClick={() => setHours(d.hours)}
                                    className={`rounded-xl border-2 py-4 transition-all ${hours === d.hours
                                        ? "border-forest-500 bg-mint-50"
                                        : "border-sage-200 hover:border-forest-300"}`}
                                >
                                    <span className="block text-3xl font-extrabold text-forest-950">{d.num}</span>
                                    <span className="block text-sm text-forest-700/60">{d.unit}</span>
                                </button>
                            ))}
                        </div>

                        <div className="mt-5 space-y-4">
                            <FormError>{error}</FormError>
                            <button className="btn-primary w-full flex items-center justify-center gap-2" onClick={createLink} disabled={creating}>
                                <QrCode className="w-5 h-5" /> {creating ? "جارٍ الإنشاء..." : "إنشاء الرابط"}
                            </button>
                        </div>
                    </section>
                </>
            ) : (
                <section className="card p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-center">
                        <div className="min-w-0 space-y-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="badge badge-success"><CheckCircle className="w-3 h-3" /> الرابط جاهز</span>
                                <span className="badge badge-info"><Clock className="w-3 h-3" /> صالح حتى {expiry(link.expires_at)}</span>
                            </div>

                            <div className="flex items-center gap-2 bg-sage-50 dark:bg-forest-800/40 rounded-xl p-3">
                                <LinkIcon className="w-4 h-4 text-sage-400 flex-shrink-0" />
                                <span className="text-xs text-forest-700 truncate flex-1 font-mono" dir="ltr">{link.url}</span>
                            </div>

                            <FormError>{error}</FormError>

                            <div className="flex flex-wrap gap-2">
                                <button className="btn-primary flex items-center gap-2" onClick={copy}>
                                    {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                    {copied ? "تم نسخ الرابط" : "نسخ الرابط"}
                                </button>
                                {canShare && (
                                    <button className="btn-secondary flex items-center gap-2" onClick={share}>
                                        <Send className="w-5 h-5" /> إرسال…
                                    </button>
                                )}
                            </div>

                            <button type="button" className="text-sm font-medium text-forest-600 hover:text-forest-700" onClick={() => setLink(null)}>
                                إنشاء رابط بمدة أخرى
                            </button>
                        </div>

                        <div className="text-center">
                            <div className="w-44 h-44 mx-auto bg-[#fff] border-2 border-forest-200 rounded-2xl p-2">
                                <img src={link.qr_data_url} alt="رمز QR لرابط الملف" className="w-full h-full" />
                            </div>
                            <p className="text-xs text-forest-700/60 mt-2">يمسحه الطبيب بكاميرا هاتفه</p>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}
