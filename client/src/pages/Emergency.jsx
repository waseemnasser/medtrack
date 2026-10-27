import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
    Siren, AlertTriangle, Droplet, Heart, Phone, Pill, Clock, QrCode, ShieldAlert, HeartPulse,
    Mic, Edit2, Plus, FileText, Copy, CheckCircle, Send, Link as LinkIcon, Lock,
} from "lucide-react";
import api from "../api";
import Skeleton from "../components/Skeleton";
import { calcAge, initial, formatDate, formatTime } from "../utils/format";

/*
  بطاقة الطوارئ — تصميم EmergencySOS.tsx في نموذج bolt.
  ما يحتاجه المسعف أو الطبيب في لحظة: فصيلة الدم، الحساسية، الأمراض
  المزمنة، الأدوية الحالية، آخر جرعة، وأرقام يُتّصل بها بلمسة.
  رمز QR حقيقي: رابط مشاركة مؤقّت بالملف الكامل، للقراءة فقط — وهو نفسه
  ما يُرسل للطبيب، فلا صفحة مشاركة منفصلة: يوم أو ٣ أيام أو أسبوع.
*/

// مدة صلاحية الرابط — الخادم يقبل أي عدد ساعات
const DURATIONS = [
    { hours: 24, num: "١", unit: "يوم" },
    { hours: 72, num: "٣", unit: "أيام" },
    { hours: 168, num: "٧", unit: "أيام" },
];

const SEVERITY = { severe: "شديدة", mild: "خفيفة" };
const GENDER = { male: "ذكر", female: "أنثى" };

// «أمس 8:05 م» أو «الثلاثاء ٢٧ تشرين الأول · 8:05 م»
function when(value) {
    const s = String(value).replace("T", " ");
    const [d, t] = s.split(" ");
    return `${formatDate(d)} · ${formatTime(t.slice(0, 5))}`;
}

// الأمراض المزمنة نص حرّ: «ضغط، سكري» ← شارتان
const splitList = (text) => String(text || "").split(/[،,]/).map((x) => x.trim()).filter(Boolean);

export default function Emergency() {
    const [params, setParams] = useSearchParams();
    const [members, setMembers] = useState(null);
    const [card, setCard] = useState(null);
    const [qr, setQr] = useState(null);       // { memberId, url, qr_data_url, expires_at }
    const [making, setMaking] = useState(false);
    const [hours, setHours] = useState(24);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");

    // ?member= من رابط قديم لفرد محذوف؟ نرجع إلى أول فرد بدل صفحة فارغة
    const wanted = params.get("member");
    const selectedId = members?.some((x) => String(x.id) === wanted) ? wanted : members?.[0] && String(members[0].id);

    useEffect(() => {
        api.get("/members")
            .then((r) => setMembers(r.data))
            .catch(() => setError("تعذّر تحميل أفراد العائلة"));
    }, []);

    useEffect(() => {
        if (!selectedId) return;
        let alive = true;
        api.get(`/members/${selectedId}/emergency`)
            .then((r) => alive && setCard(r.data))
            .catch(() => alive && setError("تعذّر تحميل بطاقة الطوارئ"));
        return () => { alive = false; };
    }, [selectedId]);

    // يُنشأ عند الطلب فقط: كل رمز رابط مشاركة جديد
    const makeQr = async () => {
        setMaking(true);
        try {
            const r = await api.post(`/share/${selectedId}`, { hours });
            setQr({ memberId: selectedId, ...r.data });
        } catch {
            setError("تعذّر إنشاء رمز QR، حاول مجدداً");
        } finally {
            setMaking(false);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(qr.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            setError("تعذّر النسخ، انسخ الرابط يدوياً");
        }
    };

    // إرسال عبر تطبيقات الهاتف (واتساب، رسائل...) إن كان المتصفح يدعمها
    const canSend = typeof navigator !== "undefined" && Boolean(navigator.share);
    const send = () => navigator.share({
        title: "ملف طبي — نبض",
        text: "رابط مؤقّت للقراءة فقط: الحساسية والأدوية وأرقام الطوارئ",
        url: qr.url,
    }).catch(() => { /* ألغى المستخدم الإرسال */ });

    if (!members && !error) return <Skeleton variant="profile" rows={3} />;

    if (members?.length === 0) {
        return (
            <div className="card p-12 text-center">
                <Siren className="w-12 h-12 text-sage-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-forest-950">لا يوجد أفراد بعد</h3>
                <p className="text-forest-700/60 mt-1">أضف أفراد العائلة لتظهر بطاقة طوارئ لكل منهم.</p>
                <Link to="/members/new" className="btn-primary inline-flex items-center gap-2 mt-4"><Plus className="w-5 h-5" /> إضافة فرد</Link>
            </div>
        );
    }

    const ready = card && String(card.member.id) === String(selectedId);
    const m = ready ? card.member : null;
    const age = m ? calcAge(m.birth_date) : null;
    const memberQr = qr && qr.memberId === selectedId ? qr : null;

    return (
        <div className="space-y-6">
            {/* العنوان بإنذار نابض */}
            <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center relative flex-shrink-0">
                    <Siren className="w-7 h-7 text-white" />
                    <span className="absolute inset-0 rounded-xl bg-red-500 animate-pulse-ring" aria-hidden="true" />
                </div>
                <div>
                    <h1 className="text-2xl lg:text-3xl font-extrabold text-forest-950">بطاقة الطوارئ الطبية</h1>
                    <p className="text-red-500 font-medium text-sm">للمسعف أو الطبيب في حالة طارئة</p>
                </div>
            </div>

            {/* اختيار الفرد */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin" role="tablist" aria-label="الفرد">
                {members?.map((x) => {
                    const on = String(x.id) === String(selectedId);
                    return (
                        <button key={x.id} role="tab" aria-selected={on}
                            onClick={() => setParams({ member: x.id }, { replace: true })}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl flex-shrink-0 transition-all ${on
                                ? "bg-forest-600 text-white shadow-lg shadow-forest-600/30"
                                : "bg-white text-forest-700 border border-sage-200 hover:border-forest-300"}`}>
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${on ? "bg-white/20" : "bg-mint-100"}`}>
                                {initial(x.name)}
                            </span>
                            <span className="font-medium text-sm whitespace-nowrap">{x.name}</span>
                        </button>
                    );
                })}
            </div>

            {error && <div className="card p-4 !border-red-200 bg-red-50 text-red-700">{error}</div>}

            {!ready ? (
                <div className="card h-96 animate-pulse" aria-busy="true" />
            ) : (
                <>
                    {/* البطاقة */}
                    <div className="relative">
                        <div className="absolute inset-0 bg-red-500/5 blur-3xl" aria-hidden="true" />
                        <article className="relative card overflow-hidden !border-2 !border-red-200 dark:!border-red-900/60">
                            <div className="gradient-forest px-6 py-5 text-white">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <ShieldAlert className="w-6 h-6 text-red-400" />
                                        <span className="text-sm font-bold tracking-wide">بطاقة طوارئ طبية</span>
                                    </div>
                                    <div className="w-8 h-8 bg-white/15 rounded-lg flex items-center justify-center">
                                        <HeartPulse className="w-5 h-5 text-white" strokeWidth={2.5} />
                                    </div>
                                </div>
                                <h2 className="text-2xl font-extrabold mt-3">{m.name}</h2>
                                <p className="text-white/70 text-sm mt-0.5">
                                    {[age !== null && `${age} سنة`, GENDER[m.gender], m.birth_date && `مواليد ${String(m.birth_date).slice(0, 4)}`]
                                        .filter(Boolean).join(" · ") || "العمر غير مسجّل"}
                                </p>
                            </div>

                            <div className="p-6">
                                {/* فصيلة الدم ورمز QR */}
                                <div className="flex items-center gap-4 sm:gap-6 mb-6 pb-6 border-b border-sage-200">
                                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-red-50 border-2 border-red-200 dark:border-red-900/60 rounded-2xl flex items-center justify-center flex-shrink-0">
                                        <Droplet className="w-8 h-8 sm:w-10 sm:h-10 text-red-500" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-bold text-red-500">فصيلة الدم</p>
                                        {m.blood_type ? (
                                            <p className="text-4xl sm:text-5xl font-extrabold text-red-600 leading-none" dir="ltr">{m.blood_type}</p>
                                        ) : (
                                            <Link to={`/members/${m.id}/edit`} className="text-sm font-semibold text-forest-600 hover:underline">غير مسجّلة — أضفها</Link>
                                        )}
                                    </div>
                                    <div className="mr-auto text-center">
                                        {memberQr ? (
                                            <div className="w-24 h-24 bg-[#fff] border-2 border-forest-200 rounded-2xl p-1">
                                                <img src={memberQr.qr_data_url} alt="رمز QR لملف الفرد الكامل" className="w-full h-full" />
                                            </div>
                                        ) : (
                                            <button type="button" onClick={makeQr} disabled={making}
                                                className="w-24 h-24 bg-[#fff] border-2 border-dashed border-forest-300 rounded-2xl flex flex-col items-center justify-center gap-1 hover:border-forest-500 transition-colors">
                                                <QrCode className="w-10 h-10 text-[#042F2E]" />
                                                <span className="text-[10px] font-semibold text-[#0F766E]">{making ? "..." : "إنشاء رمز"}</span>
                                            </button>
                                        )}
                                        <p className="text-[10px] text-forest-700/60 mt-1">امسح للملف الكامل</p>
                                    </div>
                                </div>

                                {/* الحساسية */}
                                <Block icon={AlertTriangle} tone="red" title="الحساسية">
                                    {card.allergies.length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {card.allergies.map((a) => (
                                                <span key={a.id} className="bg-red-100 text-red-700 dark:text-red-300 px-4 py-2 rounded-xl font-bold text-sm">
                                                    {a.label}
                                                    {a.severity !== "unknown" && <span className="font-medium"> · {SEVERITY[a.severity]}</span>}
                                                    {a.reaction && <span className="block text-xs font-medium opacity-80">{a.reaction}</span>}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-forest-700/60 text-sm">لا توجد حساسية مسجّلة</p>
                                    )}
                                </Block>

                                {/* الأمراض المزمنة */}
                                <Block icon={Heart} tone="forest" title="الأمراض المزمنة">
                                    {splitList(m.chronic_conditions).length > 0 ? (
                                        <div className="flex flex-wrap gap-2">
                                            {splitList(m.chronic_conditions).map((d) => (
                                                <span key={d} className="bg-amber-100 text-amber-700 dark:text-amber-300 px-4 py-2 rounded-xl font-bold text-sm">{d}</span>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-forest-700/60 text-sm">لا توجد أمراض مزمنة مسجّلة</p>
                                    )}
                                </Block>

                                {/* آخر جرعة */}
                                <Block icon={Clock} tone="forest" title="آخر دواء أُخذ">
                                    {card.last_dose ? (
                                        <div className="bg-sage-50 dark:bg-forest-800/40 rounded-xl p-3 flex items-center gap-3">
                                            <Pill className="w-5 h-5 text-forest-600 flex-shrink-0" />
                                            <div className="min-w-0">
                                                <p className="font-semibold text-forest-950"><bdi>{card.last_dose.name} {card.last_dose.strength}</bdi></p>
                                                <p className="text-sm text-forest-700/60">
                                                    {when(card.last_dose.confirmed_at)}
                                                    {card.last_dose.method === "voice" && (
                                                        <span className="text-forest-600 font-medium inline-flex items-center gap-1"> · <Mic className="w-3.5 h-3.5" /> تأكيد صوتي</span>
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <p className="text-forest-700/60 text-sm">لا توجد جرعات مؤكَّدة بعد</p>
                                    )}
                                </Block>

                                {/* الأدوية الحالية */}
                                <Block icon={Pill} tone="forest" title={`الأدوية الحالية (${card.medications.length})`}>
                                    {card.medications.length > 0 ? (
                                        <div className="space-y-1.5">
                                            {card.medications.map((med) => (
                                                <div key={med.id} className="flex items-center gap-3 bg-sage-50 dark:bg-forest-800/40 rounded-lg px-3 py-2">
                                                    <Pill className="w-4 h-4 text-forest-600 flex-shrink-0" />
                                                    <span className="text-sm font-medium text-forest-950 min-w-0 break-words"><bdi>{med.name} {med.strength}</bdi></span>
                                                    <span className="text-xs text-forest-700/60 mr-auto flex-shrink-0">
                                                        {med.times.map((t) => formatTime(t)).join("، ")}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-forest-700/60 text-sm">لا توجد أدوية حالية</p>
                                    )}
                                </Block>

                                {/* جهات الطوارئ */}
                                <Block icon={Phone} tone="red" title="جهات الطوارئ — اضغط للاتصال" last>
                                    {card.contacts.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {card.contacts.map((c) => (
                                                <a key={c.id} href={`tel:${c.phone}`}
                                                    className="flex items-center gap-3 bg-red-50 border border-red-200 dark:border-red-900/60 rounded-xl p-4 hover:bg-red-100 transition-colors group">
                                                    <span className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                                                        <Phone className="w-6 h-6 text-white" />
                                                    </span>
                                                    <span className="min-w-0">
                                                        <span className="block font-bold text-forest-950">{c.name}</span>
                                                        <span className="block text-sm text-forest-700/60">
                                                            {c.relation && `${c.relation} · `}<bdi dir="ltr">{c.phone}</bdi>
                                                        </span>
                                                    </span>
                                                </a>
                                            ))}
                                        </div>
                                    ) : (
                                        <Link to={`/members/${m.id}/edit`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-forest-600 hover:underline">
                                            <Plus className="w-4 h-4" /> أضف رقماً يُتّصل به في الطوارئ
                                        </Link>
                                    )}
                                </Block>

                                {m.emergency_notes && (
                                    <div className="mt-5 pt-5 border-t border-sage-200">
                                        <h3 className="text-sm font-bold text-forest-700 flex items-center gap-2 mb-2">
                                            <FileText className="w-4 h-4" /> ملاحظات للمسعف
                                        </h3>
                                        <p className="text-sm text-forest-800 bg-sage-50 dark:bg-forest-800/40 rounded-xl p-3">{m.emergency_notes}</p>
                                    </div>
                                )}
                            </div>
                        </article>
                    </div>

                    <div className="flex justify-end">
                        <Link to={`/members/${m.id}/edit`} className="btn-secondary flex items-center gap-2">
                            <Edit2 className="w-4 h-4" /> تعديل بيانات البطاقة
                        </Link>
                    </div>

                    {/* المشاركة: رمز QR للمسعف، والرابط نفسه للطبيب */}
                    <section className="card p-6">
                        <h2 className="text-lg font-bold text-forest-950 flex items-center gap-2 mb-1">
                            <QrCode className="w-5 h-5 text-forest-600" /> المشاركة مع المسعف أو الطبيب
                        </h2>
                        <p className="text-sm text-forest-700/60 mb-5">
                            رمز QR ورابط يفتحان الملف الكامل على أي هاتف بلا حساب: كل ما في هذه البطاقة،
                            مع الالتزام وتقدّم الكورسات والمواعيد. للقراءة فقط، وينتهي وحده.
                        </p>

                        {memberQr ? (
                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-6 items-center">
                                <div className="min-w-0 space-y-4">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="badge badge-success"><CheckCircle className="w-3 h-3" /> الرابط جاهز</span>
                                        <span className="badge badge-info"><Clock className="w-3 h-3" /> صالح حتى {when(memberQr.expires_at)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 bg-sage-50 dark:bg-forest-800/40 rounded-xl p-3">
                                        <LinkIcon className="w-4 h-4 text-sage-400 flex-shrink-0" />
                                        <span className="text-xs text-forest-700 truncate flex-1 font-mono" dir="ltr">{memberQr.url}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <button type="button" className="btn-primary flex items-center gap-2" onClick={copy}>
                                            {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                            {copied ? "تم نسخ الرابط" : "نسخ الرابط"}
                                        </button>
                                        {canSend && (
                                            <button type="button" className="btn-secondary flex items-center gap-2" onClick={send}>
                                                <Send className="w-5 h-5" /> إرسال…
                                            </button>
                                        )}
                                    </div>
                                    <button type="button" className="text-sm font-medium text-forest-600 hover:text-forest-700" onClick={() => setQr(null)}>
                                        إنشاء رابط بمدة أخرى
                                    </button>
                                </div>
                                <div className="text-center">
                                    <div className="w-44 h-44 mx-auto bg-[#fff] border-4 border-forest-200 rounded-3xl p-2 shadow-lg">
                                        <img src={memberQr.qr_data_url} alt="رمز QR لملف الفرد الكامل" className="w-full h-full" />
                                    </div>
                                    <p className="text-xs text-forest-700/60 mt-2">يُمسح بكاميرا أي هاتف</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                <p className="text-sm font-semibold text-forest-800 mb-2">مدة صلاحية الرابط</p>
                                <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="مدة صلاحية الرابط">
                                    {DURATIONS.map((d) => (
                                        <button key={d.hours} type="button" role="radio" aria-checked={hours === d.hours}
                                            onClick={() => setHours(d.hours)}
                                            className={`rounded-xl border-2 py-3 transition-all ${hours === d.hours
                                                ? "border-forest-500 bg-mint-50"
                                                : "border-sage-200 hover:border-forest-300"}`}>
                                            <span className="block text-2xl font-extrabold text-forest-950">{d.num}</span>
                                            <span className="block text-sm text-forest-700/60">{d.unit}</span>
                                        </button>
                                    ))}
                                </div>
                                <p className="text-xs text-forest-700/60 mt-3 flex items-center gap-1.5">
                                    <Lock className="w-3.5 h-3.5 flex-shrink-0" />
                                    الأدوية المعلّمة «خاصة» لا تظهر في الرابط.
                                </p>
                                <button type="button" onClick={makeQr} disabled={making} className="btn-primary w-full flex items-center justify-center gap-2 mt-4">
                                    <QrCode className="w-5 h-5" /> {making ? "جارٍ الإنشاء..." : "إنشاء رمز QR ورابط"}
                                </button>
                            </>
                        )}
                    </section>
                </>
            )}
        </div>
    );
}

// قسم داخل البطاقة: عنوان بأيقونة ولون (أحمر للخطر، أخضر للمعلومة)
function Block({ icon: Icon, tone, title, last = false, children }) {
    const red = tone === "red";
    return (
        <div className={last ? "" : "mb-5"}>
            <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${red ? "text-red-500" : "text-forest-600"}`} />
                <h3 className={`text-sm font-bold ${red ? "text-red-600" : "text-forest-700"}`}>{title}</h3>
            </div>
            {children}
        </div>
    );
}
