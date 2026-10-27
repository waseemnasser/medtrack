import { TrendingUp } from "lucide-react";

// أيام الأسبوع تحت خانات «٧ أيام» — getDay(): 0 = الأحد
const WEEKDAY = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

// لون النسبة: فيروزي جيد، كهرماني متوسط، أحمر ضعيف
const tone = (p) => (p === null ? "none" : p >= 90 ? "good" : p >= 70 ? "fair" : "low");
const TEXT = { good: "text-forest-600", fair: "text-amber-600", low: "text-red-500", none: "text-forest-700/60" };
const BAR = { good: "bg-forest-500", fair: "bg-amber-400", low: "bg-red-500", none: "bg-sage-200" };

// حالة اليوم في الشريط
function dayState(d) {
    if (!d.scheduled) return "empty";
    if (d.taken >= d.scheduled) return "full";
    return d.taken ? "part" : "missed";
}
const DAY = {
    full: "bg-forest-500 text-white",
    part: "bg-amber-300 text-amber-900",
    missed: "bg-red-400 text-white",
    empty: "bg-sage-100 dark:bg-forest-800/60 text-forest-700/60",
};

const dayTitle = (d) => (d.scheduled ? `${d.date}: ${d.taken} من ${d.scheduled}` : `${d.date}: لا جرعات`);

/**
 * تقرير الالتزام بالجرعات (من GET /members/:id/adherence أو صفحة الطبيب).
 * data: { days, scheduled, taken, on_time, percent, medications, daily }
 * onDays: إن وُجد يظهر مفتاح «٧ أيام / ٣٠ يوماً»
 */
export default function AdherenceReport({ data, onDays, kicker = "الالتزام بالجرعات" }) {
    if (!data) return null;
    const empty = data.scheduled === 0;
    const week = data.days <= 7;

    return (
        <section className="card p-6" aria-label={kicker}>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
                <div>
                    <h2 className="text-lg font-bold text-forest-950 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-forest-600" />
                        {kicker}
                    </h2>
                    {empty ? (
                        <p className="text-sm text-forest-700/60 mt-1">لا جرعات مستحقة في هذه الفترة بعد.</p>
                    ) : (
                        <div className="flex flex-wrap items-baseline gap-x-3 mt-2">
                            <p className={`text-4xl font-extrabold ${TEXT[tone(data.percent)]}`}>
                                {data.percent}<span className="text-xl">%</span>
                            </p>
                            <p className="text-sm text-forest-700/60">
                                أُخذت {data.taken} من {data.scheduled} جرعة
                                {data.taken > 0 && ` · ${data.on_time} منها في وقتها`}
                            </p>
                        </div>
                    )}
                </div>
                {onDays && (
                    <div className="flex bg-sage-100 dark:bg-forest-800/60 rounded-xl p-1" role="radiogroup" aria-label="الفترة">
                        {[7, 30].map((n) => (
                            <button key={n} type="button" role="radio" aria-checked={data.days === n}
                                onClick={() => onDays(n)}
                                className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${data.days === n
                                    ? "bg-white dark:bg-forest-600 text-forest-700 dark:text-white shadow-sm"
                                    : "text-forest-700/60 hover:text-forest-700"}`}>
                                {n === 7 ? "٧ أيام" : "٣٠ يوماً"}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {!empty && (
                <>
                    {/* خانة لكل يوم، كخانات علبة الأسبوع */}
                    <div className="grid gap-1" aria-hidden="true"
                        style={{ gridTemplateColumns: week ? "repeat(7, 1fr)" : "repeat(auto-fill, minmax(1.25rem, 1fr))" }}>
                        {data.daily.map((d) => (
                            <span key={d.date} title={dayTitle(d)}
                                className={`flex items-center justify-center text-xs font-bold ${week ? "h-10 rounded-lg" : "h-5 rounded-md"} ${DAY[dayState(d)]}`}>
                                {week && WEEKDAY[new Date(`${d.date}T00:00`).getDay()]}
                            </span>
                        ))}
                    </div>
                    <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-forest-700/60 mt-3" aria-hidden="true">
                        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded bg-forest-500" />كل الجرعات</span>
                        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded bg-amber-300" />بعضها</span>
                        <span className="flex items-center gap-1.5"><i className="w-3 h-3 rounded bg-red-400" />لم تُؤخذ</span>
                    </p>

                    <ul className="space-y-3 mt-5 pt-5 border-t border-sage-100 dark:border-forest-800/60">
                        {data.medications.map((m) => (
                            <li key={m.id} className="flex items-center gap-3">
                                <span className="w-28 sm:w-36 truncate text-sm font-semibold text-forest-950">{m.name}</span>
                                <span className="flex-1 h-2 bg-sage-100 dark:bg-forest-800/60 rounded-full overflow-hidden" aria-hidden="true">
                                    <i className={`block h-full rounded-full ${BAR[tone(m.percent)]}`} style={{ width: `${m.percent ?? 0}%` }} />
                                </span>
                                <span className={`w-20 text-left text-sm font-bold ${TEXT[tone(m.percent)]}`}>
                                    {m.percent}%
                                    <small className="font-normal text-forest-700/60 ms-1">{m.taken}/{m.scheduled}</small>
                                </span>
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </section>
    );
}
