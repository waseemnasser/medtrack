import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Mic, Pill, CheckCircle, AlertCircle, Square, History, MicOff, Info, Plus } from "lucide-react";
import api from "../api";
import Skeleton from "../components/Skeleton";
import { useFeedback } from "../feedback/context";
import { initial, formatTime, formatDate } from "../utils/format";
import { voiceSupported, listen, isConfirmation, pickDose } from "../utils/voice";

/*
  التأكيد الصوتي — تصميم VoiceLogging.tsx في نموذج bolt.
  الفرق أن هذا يعمل فعلاً: المتصفح يحوّل الكلام إلى نص بالعربية، ثم نفهم
  الجملة (utils/voice.js): «أخذت الدواء» تأكيد، و«ما أخذته» ليس تأكيداً.
  تُسجَّل الجرعة المستحقة الآن لهذا الفرد (أو الدواء الذي ذكره بالاسم)،
  ومعها أنها أُكّدت بالصوت.
*/

// جرعة «مستحقة» إن حلّ وقتها أو بقيت عليه ساعة على الأكثر
const DUE_AHEAD_MIN = 60;

const ERRORS = {
    "no-speech": "لم أسمع شيئاً. اضغط وتكلّم بعد ظهور «جارٍ الاستماع».",
    "not-allowed": "الميكروفون محظور لهذا الموقع. اسمح به من رمز القفل بجانب الرابط.",
    "audio-capture": "لا يوجد ميكروفون متاح على هذا الجهاز.",
    network: "التعرّف على الصوت يحتاج اتصالاً بالإنترنت.",
};

function when(value) {
    const [d, t] = String(value).replace("T", " ").split(" ");
    return `${formatDate(d, false)} · ${formatTime(t.slice(0, 5))}`;
}

export default function VoiceLog() {
    const [params, setParams] = useSearchParams();
    const [members, setMembers] = useState(null);
    const [date, setDate] = useState("");
    const [doses, setDoses] = useState([]);
    const [logs, setLogs] = useState([]);
    const [state, setState] = useState("idle"); // idle | listening | processing | confirmed | error
    const [heard, setHeard] = useState("");
    const [feedback, setFeedback] = useState("");
    const [levels, setLevels] = useState(() => new Array(20).fill(0));
    // «الآن» يتحدّث كل دقيقة، فتصير الجرعة مستحقة دون إعادة تحميل
    const [now, setNow] = useState(() => Date.now());
    const stopRef = useRef(null);
    const timers = useRef([]);
    const { toast } = useFeedback();

    // ?member= من رابط قديم لفرد محذوف؟ نرجع إلى أول فرد بدل صفحة فارغة
    const wanted = params.get("member");
    const selectedId = members?.some((x) => String(x.id) === wanted) ? wanted : members?.[0] && String(members[0].id);

    useEffect(() => {
        Promise.all([api.get("/members"), api.get("/doses/today")])
            .then(([m, d]) => {
                setMembers(m.data);
                setDate(d.data.date);
                setDoses(d.data.doses);
            })
            .catch(() => setMembers([]));
        const t = timers.current;
        return () => {
            stopRef.current?.();
            t.forEach(clearTimeout);
        };
    }, []);

    useEffect(() => {
        const id = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(id);
    }, []);

    const loadLogs = useCallback(() => {
        if (!selectedId) return;
        api.get("/doses/recent", { params: { member_id: selectedId } })
            .then((r) => setLogs(r.data))
            .catch(() => setLogs([]));
    }, [selectedId]);

    useEffect(loadLogs, [loadLogs]);

    // موجة الصوت أثناء الاستماع — حركة بصرية فقط
    useEffect(() => {
        if (state !== "listening") return;
        const id = setInterval(() => setLevels((prev) => prev.map(() => Math.random() * 0.8 + 0.2)), 100);
        return () => clearInterval(id);
    }, [state]);

    const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

    const memberDoses = doses
        .filter((d) => String(d.member_id) === String(selectedId))
        .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day));
    const pending = memberDoses.filter((d) => d.status !== "taken");
    const due = pending.filter((d) => new Date(`${date}T${d.time_of_day}`).getTime() - now <= DUE_AHEAD_MIN * 60000);
    const member = members?.find((x) => String(x.id) === String(selectedId));

    const confirmDose = async (dose, method) => {
        await api.post("/doses/confirm", {
            medication_id: dose.medication_id,
            scheduled_at: `${date} ${dose.time_of_day}`,
            method,
        });
        setDoses((prev) => prev.map((d) => (d.schedule_id === dose.schedule_id ? { ...d, status: "taken", method } : d)));
        loadLogs();
    };

    // ما قاله المستخدم ← تأكيد جرعة، أو شرح لماذا لم نسجّل شيئاً
    const handle = async (alternatives) => {
        setState("processing");
        const said = alternatives.find(isConfirmation);
        setHeard(said || alternatives[0] || "");
        const fail = (msg) => { setState("error"); setFeedback(msg); };

        if (!said) return fail("لم أفهم تأكيداً. قل مثلاً «أخذت الدواء» أو «أخذت الميتفورمين».");
        if (!due.length) {
            return fail(pending.length
                ? `لا جرعة مستحقة الآن لـ${member?.name}. الجرعة القادمة ${pending[0].medication_name} الساعة ${formatTime(pending[0].time_of_day)}.`
                : `أُخذت كل جرعات اليوم لـ${member?.name}.`);
        }
        const dose = pickDose(said, due);
        try {
            await confirmDose(dose, "voice");
            setState("confirmed");
            setFeedback(`${dose.medication_name}${dose.strength ? ` ${dose.strength}` : ""} — جرعة ${formatTime(dose.time_of_day)} سُجّلت بصوتك.`);
            later(() => { setState("idle"); setFeedback(""); setHeard(""); }, 5000);
        } catch {
            fail("تعذّر تسجيل الجرعة. تأكّد من الاتصال وحاول مجدداً.");
        }
    };

    const start = () => {
        setFeedback("");
        setHeard("");
        setState("listening");
        stopRef.current = listen({
            onText: (text) => setHeard(text),
            onResult: handle,
            onError: (code) => {
                if (code === "aborted") return;
                setState("error");
                setFeedback(ERRORS[code] || "تعذّر التعرّف على الصوت. حاول مجدداً.");
            },
        });
    };

    const stop = () => {
        stopRef.current?.();
        setLevels(new Array(20).fill(0));
        setState("idle");
    };

    const tap = async (dose) => {
        try {
            await confirmDose(dose, "tap");
            toast(`سُجّلت جرعة ${dose.medication_name}`);
        } catch {
            toast("تعذّر تسجيل الجرعة، حاول مجدداً", "error");
        }
    };

    if (!members) return <Skeleton rows={3} />;

    if (members.length === 0) {
        return (
            <div className="card p-12 text-center">
                <Mic className="w-12 h-12 text-sage-400 mx-auto mb-4" />
                <h3 className="text-lg font-bold text-forest-950">لا يوجد أفراد بعد</h3>
                <Link to="/members/new" className="btn-primary inline-flex items-center gap-2 mt-4"><Plus className="w-5 h-5" /> إضافة فرد</Link>
            </div>
        );
    }

    const supported = voiceSupported();
    const busy = state === "listening" || state === "processing";

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl lg:text-3xl font-extrabold text-forest-950">التأكيد الصوتي</h1>
                <p className="text-forest-700/60 mt-1">أكّد الجرعة بجملة واحدة: «أخذت الدواء»</p>
            </div>

            {/* اختيار الفرد */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin" role="tablist" aria-label="الفرد">
                {members.map((x) => {
                    const on = String(x.id) === String(selectedId);
                    return (
                        <button key={x.id} role="tab" aria-selected={on} disabled={busy}
                            onClick={() => { setParams({ member: x.id }, { replace: true }); setState("idle"); setFeedback(""); setHeard(""); }}
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

            {/* الميكروفون */}
            <section className="card p-8 text-center gradient-mint !border-2 !border-forest-200 dark:!border-forest-700">
                <div className="relative inline-block mb-6">
                    {busy && (
                        <>
                            <span className="absolute inset-0 rounded-full bg-forest-600 animate-pulse-ring" aria-hidden="true" />
                            <span className="absolute inset-0 rounded-full bg-forest-500 animate-pulse-ring" style={{ animationDelay: "0.5s" }} aria-hidden="true" />
                        </>
                    )}
                    <button type="button"
                        onClick={state === "listening" ? stop : start}
                        disabled={!supported || state === "processing" || state === "confirmed"}
                        aria-label={state === "listening" ? "إيقاف الاستماع" : "اضغط وتكلّم"}
                        className={`relative w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-xl disabled:cursor-not-allowed ${
                            !supported ? "bg-sage-300 shadow-none"
                                : state === "listening" ? "bg-red-500 shadow-red-500/40 scale-110"
                                    : state === "processing" ? "bg-amber-400 shadow-amber-400/40"
                                        : "bg-forest-600 shadow-forest-600/30 hover:scale-105"}`}>
                        {!supported ? <MicOff className="w-12 h-12 text-white" />
                            : state === "listening" ? <Square className="w-10 h-10 text-white" />
                                : <Mic className="w-12 h-12 text-white" />}
                    </button>
                </div>

                <div className="min-h-[60px]" role="status" aria-live="polite">
                    {!supported ? (
                        <>
                            <h2 className="text-xl font-bold text-forest-950">المتصفح لا يدعم التعرّف على الصوت</h2>
                            <p className="text-forest-700/60 mt-1">افتح نبض في كروم أو إيدج أو سفاري، أو أكّد بالضغط من القائمة أدناه.</p>
                        </>
                    ) : state === "idle" ? (
                        <>
                            <h2 className="text-xl font-bold text-forest-950">اضغط وتكلّم</h2>
                            <p className="text-forest-700/60 mt-1">
                                {due.length
                                    ? `قل «أخذت الدواء» لتأكيد جرعة ${due[0].medication_name} لـ${member?.name}`
                                    : pending.length
                                        ? `لا جرعة مستحقة الآن — القادمة ${formatTime(pending[0].time_of_day)}`
                                        : `أُخذت كل جرعات اليوم لـ${member?.name}`}
                            </p>
                        </>
                    ) : state === "listening" ? (
                        <>
                            <h2 className="text-xl font-bold text-forest-950">جارٍ الاستماع...</h2>
                            <p className="text-forest-700/60 mt-1">تكلّم الآن</p>
                        </>
                    ) : state === "processing" ? (
                        <>
                            <h2 className="text-xl font-bold text-forest-950">جارٍ التسجيل...</h2>
                            <p className="text-forest-700/60 mt-1">فهمنا التأكيد</p>
                        </>
                    ) : state === "confirmed" ? (
                        <>
                            <h2 className="text-xl font-bold text-forest-600 flex items-center justify-center gap-2">
                                <CheckCircle className="w-6 h-6" /> تم التأكيد
                            </h2>
                            <p className="text-forest-700/70 mt-1">{feedback}</p>
                        </>
                    ) : (
                        <>
                            <h2 className="text-xl font-bold text-red-500 flex items-center justify-center gap-2">
                                <AlertCircle className="w-6 h-6" /> لم تُسجَّل جرعة
                            </h2>
                            <p className="text-red-500/80 mt-1">{feedback}</p>
                            <button type="button" onClick={start} className="btn-secondary !px-4 !py-2 text-sm mt-3">حاول مجدداً</button>
                        </>
                    )}
                </div>

                {state === "listening" && (
                    <div className="flex items-center justify-center gap-1 mt-6 h-12" aria-hidden="true">
                        {levels.map((level, i) => (
                            <div key={i} className="w-1.5 bg-forest-600 rounded-full transition-all"
                                style={{ height: `${20 + level * 40}px`, opacity: 0.4 + level * 0.6 }} />
                        ))}
                    </div>
                )}

                {heard && state !== "idle" && (
                    <div className="mt-6">
                        <p className="text-sm text-forest-700/60 mb-1">ما سمعناه:</p>
                        <p className="text-2xl font-bold text-forest-950">«{heard}»</p>
                    </div>
                )}

                {supported && (
                    <p className="text-xs text-forest-700/60 mt-6 flex items-center justify-center gap-1.5">
                        <Info className="w-3.5 h-3.5 flex-shrink-0" />
                        يحوّل المتصفح كلامك إلى نص عبر خدمة التعرّف على الصوت فيه، ولا يحفظ نبض أي تسجيل.
                    </p>
                )}
            </section>

            {/* تأكيد يدوي */}
            <section className="card p-6">
                <h3 className="text-sm font-bold text-forest-800 mb-1">تأكيد يدوي سريع</h3>
                <p className="text-sm text-forest-700/60 mb-4">تفضّل الضغط؟ أكّد جرعات {member?.name} المتبقية اليوم:</p>
                {pending.length === 0 ? (
                    <p className="text-sm text-forest-700/60">لا جرعات متبقية اليوم.</p>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {pending.map((d) => (
                            <button key={d.schedule_id} type="button" onClick={() => tap(d)}
                                className="flex items-center gap-3 bg-sage-50 dark:bg-forest-800/40 hover:bg-mint-50 dark:hover:bg-forest-800/60 rounded-xl p-4 transition-colors text-right">
                                <span className="w-10 h-10 bg-forest-100 rounded-lg flex items-center justify-center flex-shrink-0">
                                    <Pill className="w-5 h-5 text-forest-600" />
                                </span>
                                <span className="flex-1 min-w-0">
                                    <span className="block font-semibold text-forest-950 text-sm break-words"><bdi>{d.medication_name} {d.strength}</bdi></span>
                                    <span className="block text-xs text-forest-700/60">{formatTime(d.time_of_day)}</span>
                                </span>
                                <CheckCircle className="w-5 h-5 text-forest-600 flex-shrink-0" />
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {/* السجل */}
            <section className="card p-6">
                <h3 className="text-lg font-bold text-forest-950 flex items-center gap-2 mb-4">
                    <History className="w-5 h-5 text-forest-600" /> آخر التأكيدات
                </h3>
                {logs.length === 0 ? (
                    <p className="text-sm text-forest-700/60 text-center py-6">لا توجد جرعات مؤكَّدة بعد.</p>
                ) : (
                    <div className="space-y-2">
                        {logs.map((log) => {
                            const voice = log.method === "voice";
                            return (
                                <div key={log.id} className="flex items-center gap-3 bg-sage-50 dark:bg-forest-800/40 rounded-xl p-3">
                                    <span className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${voice ? "bg-forest-100" : "bg-sage-100"}`}>
                                        {voice ? <Mic className="w-5 h-5 text-forest-600" /> : <CheckCircle className="w-5 h-5 text-sage-400" />}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        <span className="block font-semibold text-forest-950 text-sm break-words"><bdi>{log.medication_name} {log.strength}</bdi></span>
                                        <span className="block text-xs text-forest-700/60">{when(log.confirmed_at)}</span>
                                    </span>
                                    {voice
                                        ? <span className="badge badge-success flex-shrink-0"><Mic className="w-3 h-3" /> صوت</span>
                                        : <span className="badge badge-info flex-shrink-0"><CheckCircle className="w-3 h-3" /> ضغط</span>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
