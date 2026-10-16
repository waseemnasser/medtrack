import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import "./DoctorView.css";

const DAYS = { 1: "الأحد", 2: "الإثنين", 3: "الثلاثاء", 4: "الأربعاء", 5: "الخميس", 6: "الجمعة", 7: "السبت" };

function daysLabel(d) {
    if (!d) return "";
    return d.length === 7 ? "كل يوم" : d.split("").map((x) => DAYS[x]).join("، ");
}

function fmtTime(t) {
    if (!t) return "";
    const [h, m] = String(t).split(":");
    const hour = parseInt(h, 10);
    const suffix = hour < 12 ? "ص" : "م";
    const h12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${h12}:${m} ${suffix}`;
}

function fmtDateTime(v) {
    if (!v) return "";
    const s = String(v).replace("T", " ");
    const [d, t] = s.split(" ");
    return `${d} · ${fmtTime(t?.slice(0, 5))}`;
}

function age(birthDate) {
    if (!birthDate) return null;
    const b = new Date(birthDate);
    const t = new Date();
    let a = t.getFullYear() - b.getFullYear();
    const m = t.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
    return a;
}

export default function DoctorView() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/share/${token}`)
            .then((res) => setData(res.data))
            .catch((err) =>
                setError(err.response?.data?.error || "تعذّر فتح الرابط")
            )
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) return <div className="doc-page"><p>جارٍ التحميل...</p></div>;

    if (error)
        return (
            <div className="doc-page">
                <div className="doc-card">
                    <div className="error">{error}</div>
                </div>
            </div>
        );

    const m = data.member;
    const years = age(m.birth_date);

    return (
        <div className="doc-page">
            <header className="doc-head">
                <span className="brand">دوائي</span>
                <span className="doc-label">ملف المريض</span>
            </header>

            <div className="doc-card">
                <h1>{m.name}</h1>
                {years !== null && <p className="muted">{years} سنة</p>}

                {m.chronic_conditions && (
                    <div className="doc-field">
                        <span className="doc-key">الأمراض المزمنة</span>
                        <span>{m.chronic_conditions}</span>
                    </div>
                )}
                {m.allergies && (
                    <div className="doc-field warn">
                        <span className="doc-key">الحساسية</span>
                        <span>{m.allergies}</span>
                    </div>
                )}
            </div>

            <h2 className="doc-section">الأدوية الحالية</h2>
            {data.medications.length === 0 ? (
                <div className="doc-card muted">لا توجد أدوية مسجّلة.</div>
            ) : (
                data.medications.map((med) => (
                    <div className="doc-card" key={med.id}>
                        <h3>
                            {med.name}
                            {med.strength && <span className="muted"> — {med.strength}</span>}
                        </h3>
                        {med.active_ingredient && <p className="muted small">{med.active_ingredient}</p>}
                        {med.form && <p className="muted small">{med.form}</p>}
                        {med.instructions && <p className="muted small">{med.instructions}</p>}
                        {med.schedules?.length > 0 && (
                            <div className="schedules">
                                {med.schedules.map((s, i) => (
                                    <span className="chip" key={i}>
                                        {fmtTime(s.time_of_day)} · {daysLabel(s.days_of_week)}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                ))
            )}

            <h2 className="doc-section">المواعيد القادمة</h2>
            {data.upcoming_appointments.length === 0 ? (
                <div className="doc-card muted">لا توجد مواعيد قادمة.</div>
            ) : (
                data.upcoming_appointments.map((a) => (
                    <div className="doc-card" key={a.id}>
                        <h3>{a.title}</h3>
                        <p className="muted">{fmtDateTime(a.scheduled_at)}</p>
                        {a.doctor_name && <p className="muted small">{a.doctor_name}</p>}
                        {a.location && <p className="muted small">{a.location}</p>}
                    </div>
                ))
            )}

            <h2 className="doc-section">سجل تأكيد ذاتي من المستخدم</h2>
            {data.self_reported_confirmations.length === 0 ? (
                <div className="doc-card muted">لا توجد تأكيدات مسجّلة.</div>
            ) : (
                <div className="doc-card">
                    <table className="doc-table">
                        <thead>
                            <tr>
                                <th>الدواء</th>
                                <th>الموعد</th>
                                <th>الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.self_reported_confirmations.slice(0, 20).map((l) => (
                                <tr key={l.id}>
                                    <td>{l.medication_name}</td>
                                    <td>{fmtDateTime(l.scheduled_at)}</td>
                                    <td>{l.status === "taken" ? "مؤكّدة" : l.status}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className="doc-disclaimer">{data.note}</p>
        </div>
    );
}