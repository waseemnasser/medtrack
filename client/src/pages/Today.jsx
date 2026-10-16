import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import useDoseAlarm from "../useDoseAlarm";
import { playBeep } from "../beep";
import PushToggle from "../components/PushToggle";

// تقسيم الجرعات حسب الفترة
function periodOf(timeOfDay) {
    const hour = parseInt(timeOfDay.slice(0, 2), 10);
    if (hour < 12) return "الصباح";
    if (hour < 17) return "الظهر";
    return "المساء";
}

function formatTime(timeOfDay) {
    const [h, m] = timeOfDay.split(":");
    const hour = parseInt(h, 10);
    const suffix = hour < 12 ? "ص" : "م";
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}:${m} ${suffix}`;
}

export default function Today() {
    const [date, setDate] = useState("");
    const [doses, setDoses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(null); // schedule_id الجاري تأكيده
    const navigate = useNavigate();
    const [alarm, setAlarm] = useState(null);

    useEffect(() => {
        load();
    }, []);

    const load = async () => {
        try {
            const res = await api.get("/doses/today");
            setDate(res.data.date);
            setDoses(res.data.doses);
        } catch (err) {
            setError("تعذّر تحميل جرعات اليوم. تأكّد من الاتصال وحاول مجدداً.");
        } finally {
            setLoading(false);
        }
    };

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
                        ? { ...d, status: "taken", confirmed_at: new Date().toISOString() }
                        : d
                )
            );
        } catch (err) {
            alert("تعذّر تسجيل الجرعة، حاول مجدداً");
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

    if (loading) return <div className="page"><p>جارٍ التحميل...</p></div>;

    const takenCount = doses.filter((d) => d.status === "taken").length;
    const periods = ["الصباح", "الظهر", "المساء"];

    return (
        <div className="page">
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
                    <h1>جرعات اليوم</h1>
                    {doses.length > 0 && (
                        <p className="sub">
                            تم تأكيد {takenCount} من أصل {doses.length} جرعات
                        </p>
                    )}
                </div>
            </div>
            <PushToggle />


            {error && <div className="error">{error}</div>}

            {doses.length === 0 && !error ? (
                <div className="empty">لا توجد جرعات اليوم.</div>
            ) : (
                periods.map((period) => {
                    const list = doses.filter((d) => periodOf(d.time_of_day) === period);
                    if (list.length === 0) return null;
                    return (
                        <section key={period} className="period">
                            <h2 className="period-title">{period}</h2>
                            <div className="cards">
                                {list.map((d) => {
                                    const taken = d.status === "taken";
                                    const late = isLate(d);
                                    return (
                                        <div
                                            className={`dose-card${taken ? " taken" : ""}${late ? " late" : ""}`}
                                            key={d.schedule_id}
                                        >
                                            <div className="dose-info">
                                                <div className="dose-top">
                                                    <span className="dose-time">{formatTime(d.time_of_day)}</span>
                                                    {late && <span className="badge-late">متأخرة</span>}
                                                </div>
                                                <h3>
                                                    {d.medication_name}
                                                    {d.strength && <span className="muted"> — {d.strength}</span>}
                                                </h3>
                                                <p className="muted">{d.member_name}</p>
                                                {d.instructions && (
                                                    <p className="muted small">{d.instructions}</p>
                                                )}
                                            </div>

                                            {taken ? (
                                                <span className="done">تم ✓</span>
                                            ) : (
                                                <button
                                                    className="btn-primary"
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
                })
            )}
        </div>
    );
}