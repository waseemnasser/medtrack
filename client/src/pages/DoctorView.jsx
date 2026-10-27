import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api";
import Mark from "../components/Mark";
import { periodOf, formatTime, formatDate, calcAge, initial } from "../utils/format";
import AdherenceReport from "../components/AdherenceReport";
import CourseProgress from "../components/CourseProgress";
import "./DoctorView.css";

const DAYS = { 1: "الأحد", 2: "الإثنين", 3: "الثلاثاء", 4: "الأربعاء", 5: "الخميس", 6: "الجمعة", 7: "السبت" };

function daysLabel(d) {
    if (!d) return "";
    return d.length === 7 ? "كل يوم" : d.split("").map((x) => DAYS[x]).join("، ");
}

// «2026-10-28 11:00:00» ← «الثلاثاء ٢٨ تشرين الأول · 11:00 ص»
function fmtDateTime(v, withWeekday = true) {
    if (!v) return "";
    const [d, t] = String(v).replace("T", " ").split(" ");
    return t ? `${formatDate(d, withWeekday)} · ${formatTime(t.slice(0, 5))}` : formatDate(d, withWeekday);
}

// الصفحة الوحيدة التي يراها شخص من خارج التطبيق — بلا تسجيل دخول
const SEVERITY = { severe: "شديدة", mild: "خفيفة" };

export default function DoctorView() {
    const { token } = useParams();
    const [data, setData] = useState(null);
    const [error, setError] = useState(null); // { expired, message }
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/share/${token}`)
            .then((res) => setData(res.data))
            .catch((err) =>
                setError({
                    expired: err.response?.status === 410,
                    message: err.response?.data?.error || "تعذّر فتح الرابط",
                })
            )
            .finally(() => setLoading(false));
    }, [token]);

    if (loading) {
        return (
            <div className="doc-page">
                <DocBrand />
                <p className="doc-loading">جارٍ فتح ملف المريض...</p>
            </div>
        );
    }

    // رابط منتهٍ أو خاطئ: نشرح للطبيب ما يفعله بدل رسالة خطأ جافة
    if (error) {
        return (
            <div className="doc-page">
                <DocBrand />
                <div className="doc-state">
                    <span className="doc-state-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="9" />
                            <path d="M12 7v5l3 2" />
                        </svg>
                    </span>
                    <h1>{error.expired ? "انتهت صلاحية هذا الرابط" : "لا يمكن فتح هذا الرابط"}</h1>
                    <p>
                        {error.expired
                            ? "روابط المشاركة مؤقّتة لحماية خصوصية المريض. اطلب منه إنشاء رابط جديد من تطبيق نبض."
                            : `${error.message}. تأكّد من الرابط أو اطلب من المريض إرساله مجدداً.`}
                    </p>
                </div>
            </div>
        );
    }

    const m = data.member;
    const years = calcAge(m.birth_date);
    const logs = data.self_reported_confirmations.slice(0, 20);

    return (
        <div className="doc-page">
            <header className="doc-top">
                <DocBrand />
                <div className="doc-top-end">
                    {data.expires_at && (
                        <span className="chip neutral">صالح حتى {fmtDateTime(data.expires_at, false)}</span>
                    )}
                    <button type="button" className="doc-print" onClick={() => window.print()}>
                        طباعة
                    </button>
                </div>
            </header>

            {/* ---------- المريض ---------- */}
            <section className="doc-patient">
                <span className="avatar lg" aria-hidden="true">{initial(m.name)}</span>
                <div>
                    <p className="doc-eyebrow kicker">ملف المريض</p>
                    <h1>{m.name}</h1>
                    <p className="doc-meta">
                        {years !== null ? `${years} سنة` : "العمر غير مسجّل"}
                        {m.birth_date && ` · مواليد ${formatDate(m.birth_date, false)} ${String(m.birth_date).slice(0, 4)}`}
                    </p>
                </div>
            </section>

            {/* الحساسية أولاً: أهم معلومة للطبيب قبل أن يصف أي دواء */}
            <div className="doc-facts">
                <div className={`doc-fact${m.allergies ? " warn" : ""}`}>
                    <span className="doc-fact-key">الحساسية من أدوية</span>
                    {data.allergies?.length ? (
                        // كل بند بشدّته ونوع التفاعل، والشديد أولاً
                        <ul className="doc-allergies">
                            {[...data.allergies]
                                .sort((x, y) => (y.severity === "severe") - (x.severity === "severe"))
                                .map((a) => (
                                    <li key={a.label}>
                                        <b>{a.label}</b>
                                        {a.latin && <bdi dir="ltr" className="doc-latin">{a.latin}</bdi>}
                                        {a.severity !== "unknown" && (
                                            <span className={`doc-sev ${a.severity}`}>{SEVERITY[a.severity]}</span>
                                        )}
                                        {a.reaction && <span className="doc-reaction">التفاعل: {a.reaction}</span>}
                                    </li>
                                ))}
                        </ul>
                    ) : (
                        <span className="doc-fact-value">{m.allergies || "لا توجد حساسية مسجّلة"}</span>
                    )}
                </div>
                <div className="doc-fact">
                    <span className="doc-fact-key">الأمراض المزمنة</span>
                    <span className="doc-fact-value">{m.chronic_conditions || "لا توجد أمراض مزمنة مسجّلة"}</span>
                </div>
            </div>

            {/* ---------- الأدوية ---------- */}
            <h2 className="doc-section">
                الأدوية الحالية <span className="doc-count">{data.medications.length}</span>
            </h2>
            {data.medications.length === 0 ? (
                <div className="doc-empty">لا توجد أدوية مسجّلة.</div>
            ) : (
                <div className="doc-list">
                    {data.medications.map((med) => (
                        <article className="doc-med" key={med.id}>
                            <div className="doc-med-head">
                                <h3>
                                    {med.name}
                                    {med.strength && <span className="doc-strength"> {med.strength}</span>}
                                </h3>
                                {med.form && <span className="chip neutral">{med.form}</span>}
                            </div>
                            {med.active_ingredient && (
                                <p className="doc-line"><span>المادة الفعّالة</span>{med.active_ingredient}</p>
                            )}
                            {med.instructions && (
                                <p className="doc-line"><span>التعليمات</span>{med.instructions}</p>
                            )}
                            {med.start_date && (
                                <p className="doc-line">
                                    <span>منذ</span>
                                    {formatDate(med.start_date, false)} {String(med.start_date).slice(0, 4)}
                                    {med.end_date && ` — حتى ${formatDate(med.end_date, false)}`}
                                </p>
                            )}
                            {med.schedules?.length > 0 && (
                                <div className="schedules">
                                    {med.schedules
                                        .slice()
                                        .sort((a, b) => a.time_of_day.localeCompare(b.time_of_day))
                                        .map((s, i) => (
                                            <span className={`chip ${periodOf(s.time_of_day).key}`} key={i}>
                                                {formatTime(s.time_of_day)} · {daysLabel(s.days_of_week)}
                                            </span>
                                        ))}
                                </div>
                            )}
                            {/* كورس محدد المدة: أين وصل، وكم جرعة أُخذت */}
                            <CourseProgress course={med.course} startDate={med.start_date} forDoctor />
                        </article>
                    ))}
                </div>
            )}

            {/* كورسات أُوقفت قبل نهايتها آخر ٣٠ يوماً — مع اليوم والسبب */}
            {data.stopped_courses?.length > 0 && (
                <>
                    <h2 className="doc-section">
                        كورسات أُوقفت قبل نهايتها <span className="doc-count">{data.stopped_courses.length}</span>
                    </h2>
                    <div className="doc-list">
                        {data.stopped_courses.map((med) => (
                            <article className="doc-med doc-stopped" key={med.id}>
                                <div className="doc-med-head">
                                    <h3>
                                        {med.name}
                                        {med.strength && <span className="doc-strength"> {med.strength}</span>}
                                    </h3>
                                    <span className="chip danger">أُوقف {formatDate(med.course.stopped_on, false)}</span>
                                </div>
                                <CourseProgress course={med.course} forDoctor />
                            </article>
                        ))}
                    </div>
                </>
            )}

            {/* ---------- المواعيد ---------- */}
            {/* الالتزام آخر ٣٠ يوماً: هل يأخذ المريض أدويته فعلاً؟ */}
            {data.adherence?.scheduled > 0 && (
                <div className="doc-adherence">
                    <AdherenceReport data={data.adherence} kicker="الالتزام بالجرعات — آخر ٣٠ يوماً" />
                    <p className="doc-hint">محسوب من تأكيدات المستخدم نفسه في التطبيق، لا من سجل طبي.</p>
                </div>
            )}

            <h2 className="doc-section">
                المواعيد القادمة <span className="doc-count">{data.upcoming_appointments.length}</span>
            </h2>
            {data.upcoming_appointments.length === 0 ? (
                <div className="doc-empty">لا توجد مواعيد قادمة.</div>
            ) : (
                <div className="doc-list">
                    {data.upcoming_appointments.map((a) => (
                        <article className="doc-appt" key={a.id}>
                            <h3>{a.title}</h3>
                            <p className="doc-appt-time">{fmtDateTime(a.scheduled_at)}</p>
                            {(a.doctor_name || a.location) && (
                                <p className="doc-meta">{[a.doctor_name, a.location].filter(Boolean).join(" · ")}</p>
                            )}
                        </article>
                    ))}
                </div>
            )}

            {/* ---------- سجل التأكيد ---------- */}
            <h2 className="doc-section">سجل تأكيد الجرعات</h2>
            <p className="doc-hint">آخر {logs.length} جرعة أكّد المستخدم أخذها بنفسه من التطبيق.</p>
            {logs.length === 0 ? (
                <div className="doc-empty">لا توجد تأكيدات مسجّلة.</div>
            ) : (
                <div className="doc-table-wrap">
                    <table className="doc-table">
                        <thead>
                            <tr>
                                <th>الدواء</th>
                                <th>الموعد المحدد</th>
                                <th>الحالة</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map((l) => (
                                <tr key={l.id}>
                                    <td>{l.medication_name}</td>
                                    <td>{fmtDateTime(l.scheduled_at)}</td>
                                    <td>
                                        {l.status === "taken"
                                            ? <span className="chip">مؤكّدة</span>
                                            : <span className="chip neutral">{l.status}</span>}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {/* نقطة أخلاقية جاءت من مقابلة الصيدلاني — لا تُحذف ولا تُصغَّر */}
            <p className="doc-disclaimer">{data.note}</p>

            <footer className="doc-footer">
                عُرض عبر <Link to="/welcome">نبض</Link> — أداة تنظيمية لمتابعة أدوية العائلة، لا تقدّم تشخيصاً ولا توصيات علاجية.
            </footer>
        </div>
    );
}

function DocBrand() {
    return (
        <span className="doc-brand">
            <Mark size={28} />
            نبض
        </span>
    );
}
