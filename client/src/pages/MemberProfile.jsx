import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "./MemberProfile.css";

const DAYS = { 1: "الأحد", 2: "الإثنين", 3: "الثلاثاء", 4: "الأربعاء", 5: "الخميس", 6: "الجمعة", 7: "السبت" };

function daysLabel(daysOfWeek) {
    if (!daysOfWeek) return "";
    if (daysOfWeek.length === 7) return "كل يوم";
    return daysOfWeek.split("").map((d) => DAYS[d]).join("، ");
}

function formatTime(t) {
    const [h, m] = t.split(":");
    const hour = parseInt(h, 10);
    const suffix = hour < 12 ? "ص" : "م";
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}:${m} ${suffix}`;
}

function formatDateTime(iso) {
    if (!iso) return "";
    const s = String(iso).replace("T", " ");
    const [date, time] = s.split(" ");
    return `${date} — ${formatTime(time.slice(0, 5))}`;
}

export default function MemberProfile() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [member, setMember] = useState(null);
    const [meds, setMeds] = useState([]);
    const [appts, setAppts] = useState([]);
    const [tab, setTab] = useState("meds");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        load();
    }, [id]);

    const load = async () => {
        try {
            const [mRes, medRes, apRes] = await Promise.all([
                api.get("/members"),
                api.get(`/medications/member/${id}`),
                api.get(`/appointments?member_id=${id}`),
            ]);
            setMember(mRes.data.find((x) => String(x.id) === String(id)) || null);
            setMeds(medRes.data);
            setAppts(apRes.data);
        } catch (err) {
            setError("تعذّر تحميل بيانات الفرد. حاول مجدداً.");
        } finally {
            setLoading(false);
        }
    };

    const stopMedication = async (med) => {
        const ok = window.confirm(
            `سيتوقف تذكيرك بدواء ${med.name}، وسيبقى في السجل الطبي. متابعة؟`
        );
        if (!ok) return;
        try {
            await api.patch(`/medications/${med.id}/stop`);
            setMeds((prev) => prev.map((m) => (m.id === med.id ? { ...m, is_active: false } : m)));
        } catch (err) {
            alert("تعذّر إيقاف الدواء، حاول مجدداً");
        }
    };

    if (loading) return <div className="page"><p>جارٍ التحميل...</p></div>;
    if (error) return <div className="page"><div className="error">{error}</div></div>;
    if (!member) return <div className="page"><div className="empty">هذا الفرد غير موجود.</div></div>;

    const active = meds.filter((m) => m.is_active !== false);
    const stopped = meds.filter((m) => m.is_active === false);

    return (
        <div className="page">
            <div className="profile-head">
                <h1>{member.name}</h1>
                {member.chronic_conditions && (
                    <p className="muted">الأمراض المزمنة: {member.chronic_conditions}</p>
                )}
                {member.allergies && (
                    <p className="muted warn">حساسية: {member.allergies}</p>
                )}
            </div>

            <div className="profile-actions">
                <button className="btn-primary" onClick={() => navigate(`/members/${id}/medications/new`)}>
                    إضافة دواء
                </button>
                <button onClick={() => navigate(`/members/${id}/share`)}>مشاركة مع الطبيب</button>
            </div>

            <div className="tabs">
                <button className={tab === "meds" ? "active" : ""} onClick={() => setTab("meds")}>
                    الأدوية
                </button>
                <button className={tab === "appts" ? "active" : ""} onClick={() => setTab("appts")}>
                    المواعيد
                </button>
            </div>

            {tab === "meds" && (
                <>
                    {active.length === 0 ? (
                        <div className="empty">لا توجد أدوية مضافة لهذا الفرد.</div>
                    ) : (
                        <div className="cards">
                            {active.map((m) => (
                                <div className="card" key={m.id}>
                                    <div className="card-body no-click">
                                        <div className="med-title">
                                            <h2>{m.name}</h2>
                                            {m.is_private && <span className="badge-private">دواء خاص</span>}
                                        </div>
                                        {m.strength && <p className="muted">{m.strength} — {m.form}</p>}
                                        {m.active_ingredient && <p className="muted small">{m.active_ingredient}</p>}
                                        {m.instructions && <p className="muted small">{m.instructions}</p>}

                                        {m.schedules?.length > 0 && (
                                            <div className="schedules">
                                                {m.schedules.map((s, i) => (
                                                    <span className="chip" key={i}>
                                                        {formatTime(s.time_of_day)} · {daysLabel(s.days_of_week)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="card-actions">
                                        <button className="danger" onClick={() => stopMedication(m)}>
                                            إيقاف الدواء
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {stopped.length > 0 && (
                        <>
                            <h3 className="section-title">أدوية متوقفة</h3>
                            <div className="cards">
                                {stopped.map((m) => (
                                    <div className="card dim" key={m.id}>
                                        <div className="card-body no-click">
                                            <h2>{m.name}</h2>
                                            {m.strength && <p className="muted">{m.strength}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}

            {tab === "appts" && (
                appts.length === 0 ? (
                    <div className="empty">لا توجد مواعيد لهذا الفرد.</div>
                ) : (
                    <div className="cards">
                        {appts.map((a) => (
                            <div className="card" key={a.id}>
                                <div className="card-body no-click">
                                    <h2>{a.title}</h2>
                                    <p className="muted">{formatDateTime(a.scheduled_at)}</p>
                                    {a.doctor_name && <p className="muted small">{a.doctor_name}</p>}
                                    {a.location && <p className="muted small">{a.location}</p>}
                                    {a.notes && <p className="muted small">{a.notes}</p>}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
}