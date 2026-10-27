import { formatDate, daysText, dosesText } from "../utils/format";
import "./CourseProgress.css";

/*
  تقدّم الكورس (course.js في الخادم): خانة لكل يوم، مثل علبة الأسبوع —
  ممتلئة إن أُخذت جرعات اليوم كلها، نصفها إن أُخذ بعضها، حمراء إن فاتت.
  وتحتها جملة واحدة بحسب الحالة: كم بقي، آخر يوم، في خطر، اكتمل، أُوقف.
  الكورس الأطول من شهر يُعرض شريطاً متصلاً بدل الخانات.
*/

function cellState(d, today, stoppedOn) {
    if (stoppedOn && d.date > stoppedOn) return "skip";
    if (d.planned && d.taken >= d.planned) return "full";
    if (d.date === today && d.taken < d.due) return d.taken ? "part" : "miss";
    if (d.date >= today) return d.date === today ? "today" : "future";
    if (!d.taken) return d.planned ? "miss" : "future";
    return "part";
}

function Note({ course: c, startDate, forDoctor }) {
    switch (c.status) {
        case "upcoming":
            return <p className="course-note">يبدأ {formatDate(startDate)}</p>;
        case "completed":
            return <p className="course-note done">اكتمل الكورس — أُخذت {c.taken} من {c.planned} جرعة</p>;
        case "stopped_early":
            return (
                <p className="course-note stopped">
                    أُوقف في اليوم {c.day} من {c.total_days}
                    {c.stop_reason_label && ` · ${c.stop_reason_label}`}
                    {c.remaining > 0 && ` · تُركت ${dosesText(c.remaining)}`}
                </p>
            );
        default:
            if (c.at_risk) {
                return (
                    <p className="course-note risk">
                        فاتت آخر جرعتين — {c.final_day ? "اليوم آخر يوم، " : `باقي ${daysText(c.days_left)}، `}
                        {forDoctor ? "لم تُسجَّل جرعات منذ ذلك" : "أكمل الكورس حتى نهايته"}
                    </p>
                );
            }
            if (c.final_day) return <p className="course-note last">{forDoctor ? "اليوم آخر يوم في الكورس" : "اليوم آخر يوم — أكمل جرعاته كلها"}</p>;
            return <p className="course-note">باقي {daysText(c.days_left)} بعد اليوم</p>;
    }
}

// forDoctor: صفحة الطبيب — الحقائق فقط، بلا توجيه للمريض
export default function CourseProgress({ course: c, startDate, forDoctor = false }) {
    if (!c) return null;
    const today = new Date().toLocaleDateString("en-CA"); // «YYYY-MM-DD» بالتوقيت المحلي

    return (
        <div className={`course course-${c.status}${c.at_risk ? " at-risk" : ""}`}>
            <div className="course-head">
                <span className="course-label">
                    كورس {daysText(c.total_days)}
                    {c.status === "active" && <> · اليوم {c.day}</>}
                </span>
                <span className="course-count">{c.taken} من {c.planned} جرعة</span>
            </div>

            {c.days ? (
                <div className="course-strip" role="img"
                    aria-label={`أُخذت ${c.taken} من ${c.planned} جرعة في ${c.total_days} يوماً`}>
                    {c.days.map((d) => (
                        <span key={d.date} className={`course-cell ${cellState(d, today, c.stopped_on)}`}
                            title={formatDate(d.date)} />
                    ))}
                </div>
            ) : (
                <div className="course-bar" role="img" aria-label={`${c.percent}٪ من جرعات الكورس`}>
                    <i style={{ width: `${c.percent}%` }} />
                </div>
            )}

            <Note course={c} startDate={startDate} forDoctor={forDoctor} />
        </div>
    );
}
