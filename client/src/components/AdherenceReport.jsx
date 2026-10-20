import "./AdherenceReport.css";

// أيام الأسبوع تحت خانات «٧ أيام» — getDay(): 0 = الأحد
const WEEKDAY = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

// لون النسبة: فيروزي جيد، مشمشي متوسط، أحمر ضعيف
const tone = (p) => (p === null ? "none" : p >= 90 ? "good" : p >= 70 ? "fair" : "low");

// حالة اليوم في الشريط
function dayState(d) {
    if (!d.scheduled) return "empty";
    if (d.taken >= d.scheduled) return "full";
    return d.taken ? "part" : "missed";
}

const dayTitle = (d) => (d.scheduled ? `${d.date}: ${d.taken} من ${d.scheduled}` : `${d.date}: لا جرعات`);

/**
 * تقرير الالتزام بالجرعات (من GET /members/:id/adherence أو صفحة الطبيب).
 * data: { days, scheduled, taken, on_time, percent, medications, daily }
 * onDays: إن وُجد يظهر مفتاح «٧ أيام / ٣٠ يوماً»
 */
export default function AdherenceReport({ data, onDays, kicker = "الالتزام بالجرعات" }) {
    if (!data) return null;
    const empty = data.scheduled === 0;

    return (
        <section className="adherence" aria-label={kicker}>
            <div className="adh-head">
                <div>
                    <span className="kicker">{kicker}</span>
                    {empty ? (
                        <p className="adh-sub">لا جرعات مستحقة في هذه الفترة بعد.</p>
                    ) : (
                        <>
                            <p className={`adh-percent ${tone(data.percent)}`}>
                                {data.percent}<small>%</small>
                            </p>
                            <p className="adh-sub">
                                أُخذت {data.taken} من {data.scheduled} جرعة
                                {data.taken > 0 && ` · ${data.on_time} منها في وقتها`}
                            </p>
                        </>
                    )}
                </div>
                {onDays && (
                    <div className="adh-range" role="radiogroup" aria-label="الفترة">
                        {[7, 30].map((n) => (
                            <button
                                key={n}
                                type="button"
                                role="radio"
                                aria-checked={data.days === n}
                                className={data.days === n ? "on" : ""}
                                onClick={() => onDays(n)}
                            >
                                {n === 7 ? "٧ أيام" : "٣٠ يوماً"}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {!empty && (
                <>
                    {/* خانة لكل يوم، كخانات علبة الأسبوع */}
                    <div className={`adh-strip${data.days <= 7 ? " week" : ""}`} aria-hidden="true">
                        {data.daily.map((d) => (
                            <span key={d.date} className={`adh-day ${dayState(d)}`} title={dayTitle(d)}>
                                {data.days <= 7 && <small>{WEEKDAY[new Date(`${d.date}T00:00`).getDay()]}</small>}
                            </span>
                        ))}
                    </div>
                    <p className="adh-legend" aria-hidden="true">
                        <span className="full" />كل الجرعات
                        <span className="part" />بعضها
                        <span className="missed" />لم تُؤخذ
                    </p>

                    <ul className="adh-meds">
                        {data.medications.map((m) => (
                            <li key={m.id}>
                                <span className="adh-med-name">{m.name}</span>
                                <span className="adh-bar" aria-hidden="true">
                                    <i className={tone(m.percent)} style={{ width: `${m.percent ?? 0}%` }} />
                                </span>
                                <span className={`adh-med-pct ${tone(m.percent)}`}>
                                    {m.percent}%
                                    <small>{m.taken}/{m.scheduled}</small>
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </section>
    );
}
