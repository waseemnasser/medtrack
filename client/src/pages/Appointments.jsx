import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./Appointments.css";

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
    const navigate = useNavigate();

    useEffect(() => { load(); }, []);

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

    const memberName = (id) =>
        members.find((m) => m.id === id)?.name || "";

    const remove = async (a) => {
        if (!window.confirm(`سيتم حذف موعد «${a.title}». هل أنت متأكد؟`)) return;
        try {
            await api.delete(`/appointments/${a.id}`);
            setAppts((prev) => prev.filter((x) => x.id !== a.id));
        } catch {
            alert("تعذّر الحذف، حاول مجدداً");
        }
    };

    if (loading) return <div className="page"><p>جارٍ التحميل...</p></div>;

    const now = new Date();
    const upcoming = appts
        .filter((a) => parseDT(a.scheduled_at) >= now)
        .sort((a, b) => parseDT(a.scheduled_at) - parseDT(b.scheduled_at));
    const past = appts
        .filter((a) => parseDT(a.scheduled_at) < now)
        .sort((a, b) => parseDT(b.scheduled_at) - parseDT(a.scheduled_at));

    const Card = ({ a, dim }) => (
        <div className={`card${dim ? " dim" : ""}`} key={a.id}>
            <div className="card-body no-click">
                <div className="med-title">
                    <h2>{a.title}</h2>
                    {!dim && relativeLabel(a.scheduled_at) && (
                        <span className="chip">{relativeLabel(a.scheduled_at)}</span>
                    )}
                </div>
                <p className="muted">{formatDT(a.scheduled_at)}</p>
                {memberName(a.member_id) && (
                    <p className="muted small">{memberName(a.member_id)}</p>
                )}
                {a.doctor_name && <p className="muted small">{a.doctor_name}</p>}
                {a.location && <p className="muted small">{a.location}</p>}
                {a.notes && <p className="muted small">{a.notes}</p>}
            </div>
            <div className="card-actions">
                <button onClick={() => navigate(`/appointments/${a.id}/edit`)}>تعديل</button>
                <button className="danger" onClick={() => remove(a)}>حذف</button>
            </div>
        </div>
    );

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1>المواعيد الطبية</h1>
                </div>
                <button className="btn-primary" onClick={() => navigate("/appointments/new")}>
                    إضافة موعد
                </button>
            </div>

            {error && <div className="error">{error}</div>}

            <h3 className="section-title">المواعيد القادمة</h3>
            {upcoming.length === 0 ? (
                <div className="empty">لا توجد مواعيد قادمة.</div>
            ) : (
                <div className="cards">{upcoming.map((a) => <Card a={a} key={a.id} />)}</div>
            )}

            {past.length > 0 && (
                <>
                    <h3 className="section-title">مواعيد سابقة</h3>
                    <div className="cards">{past.map((a) => <Card a={a} dim key={a.id} />)}</div>
                </>
            )}
        </div>
    );
}