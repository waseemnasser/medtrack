import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import useDoseAlarm from "../useDoseAlarm";
import { playBeep } from "../beep";
import PushToggle from "../components/PushToggle";
import Skeleton from "../components/Skeleton";
import { useFeedback } from "../feedback/context";
import { PERIODS, periodOf, timeParts, formatTime, formatDate } from "../utils/format";
import "./Today.css";

function CheckIcon() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
    );
}

export default function Today() {
    const [date, setDate] = useState("");
    const [doses, setDoses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(null); // schedule_id الجاري تأكيده
    const [alarm, setAlarm] = useState(null);
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
    }, []);


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
        if (document.hidden) document.title = "⏰ حان وقت الجرعة — دوائي";
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

    return (
        <div className="page page-wide">
            {alarm && (
                <div className="alarm-bar">
                    <div className="alarm-text">
                        حان وقت جرعة <strong>{alarm.medication_name}</strong> لـ{" "}
                        <strong>{alarm.member_name}</strong>
                    </div>
                    <div className="alarm-actions">
                        <button
                            className="alarm-confirm"
                            onClick={() => { confirm(alarm); setAlarm(null); document.title = "دوائي"; }}
                        >
                            تم الأخذ
                        </button>
                        <button
                            className="alarm-close"
                            onClick={() => { setAlarm(null); document.title = "دوائي"; }}
                        >
                            إغلاق
                        </button>
                    </div>
                </div>
            )}
            <div className="page-head">
                <div>
                    <p className="today-date">{formatDate(date)}</p>
                    <h1>جرعات اليوم</h1>
                </div>
            </div>

            {/* على الحاسوب: الجرعة التالية ثابتة على اليمين، والقائمة على اليسار */}
            <div className="today-grid">
                <aside className="today-side">
                    {error && <div className="error">{error}</div>}

                    {doses.length === 0 && !error ? (
                        <div className="empty">
                            لا توجد جرعات اليوم.
                            <br />
                            <Link to="/members">أضف دواءً من ملف أحد أفراد العائلة</Link>
                        </div>
                    ) : doses.length > 0 && (
                        <>
                            {next ? (
                                <NextDose
                                    key={next.schedule_id}
                                    dose={next}
                                    late={isLate(next)}
                                    saving={saving === next.schedule_id}
                                    onConfirm={() => confirm(next)}
                                />
                            ) : (
                                <section className="next-dose all-done">
                                    <span className="all-done-icon"><CheckIcon /></span>
                                    <div>
                                        <h3>أُخذت كل جرعات اليوم</h3>
                                        <p>اطمئن، لا شيء متبقٍّ لليوم.</p>
                                    </div>
                                </section>
                            )}

                            <div className="day-progress">
                                <div
                                    className="day-progress-bar"
                                    role="img"
                                    aria-label={`تم تأكيد ${takenCount} من أصل ${doses.length} جرعات`}
                                >
                                    {sorted.map((d) => (
                                        <span
                                            key={d.schedule_id}
                                            className={
                                                d.status === "taken"
                                                    ? `seg ${periodOf(d.time_of_day).key}${d.justTaken ? " just" : ""}`
                                                    : "seg"
                                            }
                                        />
                                    ))}
                                </div>
                                <span className="day-progress-label">{takenCount} من {doses.length}</span>
                            </div>
                        </>
                    )}

                    <PushToggle hideWhenOn />
                </aside>

                <div className="today-main">
                    {PERIODS.map((period) => {
                        const list = rest.filter((d) => periodOf(d.time_of_day).key === period.key);
                        if (list.length === 0) return null;
                        return (
                            <section key={period.key} className="period">
                                <h2 className="period-title">
                                    <span className={`period-swatch ${period.key}`} aria-hidden="true" />
                                    {period.label}
                                </h2>
                                <div className="dose-list">
                                    {list.map((d, i) => {
                                        const taken = d.status === "taken";
                                        const late = isLate(d);
                                        return (
                                            <div
                                                className={`dose-row${taken ? " taken" : ""}${late ? " late" : ""}`}
                                                key={d.schedule_id}
                                                style={{ "--i": i }}
                                            >
                                                <span className={`dose-marker ${period.key}`} aria-hidden="true" />
                                                <div className="dose-info">
                                                    <h3>
                                                        {d.medication_name}
                                                        {d.strength && <span className="dose-strength"> {d.strength}</span>}
                                                        {late && <span className="badge-late">متأخرة</span>}
                                                    </h3>
                                                    <p className="muted">
                                                        <span className="dose-time">{formatTime(d.time_of_day)}</span>
                                                        {" · "}
                                                        <Link to={`/members/${d.member_id}`} className="member-link">{d.member_name}</Link>
                                                        {d.instructions && ` · ${d.instructions}`}
                                                    </p>
                                                </div>

                                                {taken ? (
                                                    <span className={`done ${period.key}${d.justTaken ? " just" : ""}`} role="img" aria-label="تم الأخذ">
                                                        <CheckIcon />
                                                    </span>
                                                ) : (
                                                    <button
                                                        className={late ? "btn-primary" : "btn-outline"}
                                                        onClick={() => confirm(d)}
                                                        disabled={saving === d.schedule_id}
                                                    >
                                                        {saving === d.schedule_id ? "..." : "تم الأخذ"}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

// بطاقة الجرعة التالية — أول ما تراه العين عند فتح التطبيق
function NextDose({ dose, late, saving, onConfirm }) {
    const period = periodOf(dose.time_of_day);
    const { clock, suffix } = timeParts(dose.time_of_day);
    return (
        <section className={`next-dose${late ? " late" : ""}`} aria-label="الجرعة التالية">
            <div className="next-top">
                <span className="next-label">الجرعة التالية</span>
                {late ? (
                    <span className="next-chip late">متأخرة</span>
                ) : (
                    <span className={`next-chip ${period.key}`}>{period.label}</span>
                )}
            </div>
            <div className="next-body">
                <div className="next-info">
                    <div className="next-time">
                        {clock} <small>{suffix}</small>
                    </div>
                    <h3>
                        {dose.medication_name}
                        {dose.strength && <span className="dose-strength"> {dose.strength}</span>}
                    </h3>
                    <p>
                        <Link to={`/members/${dose.member_id}`} className="member-link">{dose.member_name}</Link>
                        {dose.instructions && ` · ${dose.instructions}`}
                    </p>
                </div>
                <button className="next-confirm" onClick={onConfirm} disabled={saving}>
                    {saving ? "..." : "تم الأخذ"}
                </button>
            </div>
        </section>
    );
}
