import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams, Link } from "react-router-dom";
import api from "../api";
import PageHeader from "../components/PageHeader";
import { periodOf, formatTime, formatDate, calcAge, initial } from "../utils/format";
import "./MemberProfile.css";

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
    if (supply.days_left === 0) return <span className="chip danger">نفد تقريباً — جدّد العلبة</span>;
    if (supply.needs_refill_soon)
        return <span className="chip danger">ينفد خلال {supply.days_left} أيام</span>;
    return <span className="chip neutral">يكفي حتى {formatDate(supply.depletion_date, false)} تقريباً</span>;
}

// أيقونات الإجراءات السريعة
const ICONS = {
    med: <><rect x="3" y="8" width="18" height="8" rx="4" /><path d="M12 8v8" /></>,
    appt: <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
    share: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" /></>,
};

export default function MemberProfile() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const tab = searchParams.get("tab") === "appts" ? "appts" : "meds";

    const [member, setMember] = useState(null);
    const [meds, setMeds] = useState([]);
    const [supply, setSupply] = useState({}); // medication_id → تقدير النفاد
    const [appts, setAppts] = useState([]);
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
                const [mRes, medRes, apRes] = await Promise.all([
                    api.get("/members"),
                    api.get(`/medications/member/${id}`),
                    api.get(`/appointments?member_id=${id}`),
                ]);
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


    // تقدير النفاد لكل دواء فعّال — لا يمنع عرض الصفحة إن فشل

    const setTab = (t) => setSearchParams(t === "appts" ? { tab: "appts" } : {}, { replace: true });

    const stopMedication = async (med) => {
        const ok = window.confirm(
            `سيتوقف تذكيرك بدواء ${med.name}، وسيبقى في السجل الطبي. متابعة؟`
        );
        if (!ok) return;
        try {
            await api.patch(`/medications/${med.id}/stop`);
            setMeds((prev) => prev.map((m) => (m.id === med.id ? { ...m, is_active: false } : m)));
        } catch {
            alert("تعذّر إيقاف الدواء، حاول مجدداً");
        }
    };

    if (loading) return <div className="page"><p>جارٍ التحميل...</p></div>;
    if (error) return <div className="page"><PageHeader back="/members" /><div className="error">{error}</div></div>;
    if (!member) {
        return (
            <div className="page">
                <PageHeader back="/members" />
                <div className="empty">هذا الفرد غير موجود. <br /><Link to="/members">العودة إلى العائلة</Link></div>
            </div>
        );
    }

    const active = meds.filter((m) => m.is_active !== false);
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

    return (
        <div className="page">
            <PageHeader
                back="/members"
                action={
                    <button className="header-link" onClick={() => navigate(`/members/${id}/edit`)}>
                        تعديل
                    </button>
                }
            />

            {/* ترويسة الفرد: تذكّر المستخدم أنه داخل ملف شخص بعينه */}
            <div className="profile-head">
                <span className="avatar lg" aria-hidden="true">{initial(member.name)}</span>
                <div className="profile-info">
                    <h1>{member.name}</h1>
                    <p className="muted">
                        {[age !== null && `${age} سنة`, member.chronic_conditions]
                            .filter(Boolean)
                            .join(" · ") || "لا توجد أمراض مزمنة مسجّلة"}
                    </p>
                    {member.allergies && (
                        <span className="allergy">حساسية: {member.allergies}</span>
                    )}
                </div>
            </div>

            {/* الإجراءات السريعة: كل ما يخصّ هذا الفرد يبدأ من هنا */}
            <div className="quick-actions">
                <Link to={`/members/${id}/medications/new`} className="quick-action primary">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS.med}</svg>
                    إضافة دواء
                </Link>
                <Link to={`/appointments/new?member_id=${id}`} className="quick-action">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS.appt}</svg>
                    إضافة موعد
                </Link>
                <Link to={`/members/${id}/share`} className="quick-action">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONS.share}</svg>
                    مشاركة مع الطبيب
                </Link>
            </div>

            <div className="tabs" role="tablist">
                <button role="tab" aria-selected={tab === "meds"} className={tab === "meds" ? "active" : ""} onClick={() => setTab("meds")}>
                    الأدوية <span className="tab-count">{active.length}</span>
                </button>
                <button role="tab" aria-selected={tab === "appts"} className={tab === "appts" ? "active" : ""} onClick={() => setTab("appts")}>
                    المواعيد <span className="tab-count">{upcomingAppts.length}</span>
                </button>
            </div>

            {tab === "meds" && (
                <>
                    {active.length === 0 ? (
                        <div className="empty">
                            لا توجد أدوية مضافة لهذا الفرد.
                            <br />
                            <Link to={`/members/${id}/medications/new`}>أضف أول دواء</Link>
                        </div>
                    ) : (
                        <div className="cards">
                            {active.map((m) => (
                                <div className="card" key={m.id}>
                                    <div className="card-body no-click">
                                        <div className="med-title">
                                            <h2>{m.name}</h2>
                                            {m.is_private && <span className="badge-private">دواء خاص</span>}
                                        </div>
                                        {(m.strength || m.form) && (
                                            <p className="muted">{[m.strength, m.form].filter(Boolean).join(" — ")}</p>
                                        )}
                                        {m.active_ingredient && <p className="muted small">{m.active_ingredient}</p>}
                                        {m.instructions && <p className="muted small">{m.instructions}</p>}

                                        {m.schedules?.length > 0 && (
                                            <div className="schedules">
                                                {m.schedules.map((s) => (
                                                    <span className={`chip ${periodOf(s.time_of_day).key}`} key={s.id}>
                                                        {formatTime(s.time_of_day)} · {daysLabel(s.days_of_week)}
                                                    </span>
                                                ))}
                                            </div>
                                        )}

                                        {supply[m.id]?.known && (
                                            <div className="supply-line">
                                                <SupplyChip supply={supply[m.id]} />
                                            </div>
                                        )}
                                    </div>
                                    <div className="card-actions">
                                        <button onClick={() => navigate(`/members/${id}/medications/${m.id}/edit`)}>
                                            تعديل
                                        </button>
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
                                            <div className="med-title">
                                                <h2>{m.name}</h2>
                                                <span className="chip neutral">متوقّف</span>
                                            </div>
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
                <>
                    {upcomingAppts.length === 0 ? (
                        <div className="empty">
                            لا توجد مواعيد قادمة لهذا الفرد.
                            <br />
                            <Link to={`/appointments/new?member_id=${id}`}>أضف موعداً</Link>
                        </div>
                    ) : (
                        <div className="cards">
                            {upcomingAppts.map((a) => (
                                <ApptCard a={a} key={a.id} onEdit={() => navigate(`/appointments/${a.id}/edit?member_id=${id}`)} />
                            ))}
                        </div>
                    )}

                    {pastAppts.length > 0 && (
                        <>
                            <h3 className="section-title">مواعيد سابقة</h3>
                            <div className="cards">
                                {pastAppts.map((a) => <ApptCard a={a} dim key={a.id} />)}
                            </div>
                        </>
                    )}
                </>
            )}
        </div>
    );
}

function ApptCard({ a, dim, onEdit }) {
    return (
        <div className={`card${dim ? " dim" : ""}`}>
            <div className="card-body no-click">
                <h2>{a.title}</h2>
                <p className="muted">{formatDateTime(a.scheduled_at)}</p>
                {a.doctor_name && <p className="muted small">{a.doctor_name}</p>}
                {a.location && <p className="muted small">{a.location}</p>}
                {a.notes && <p className="muted small">{a.notes}</p>}
            </div>
            {onEdit && (
                <div className="card-actions">
                    <button onClick={onEdit}>تعديل</button>
                </div>
            )}
        </div>
    );
}
