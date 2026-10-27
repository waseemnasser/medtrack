import { formatDate, daysText, dosesText } from "../utils/format";

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

const CELL = {
    full: "bg-forest-500",
    part: "bg-gradient-to-t from-forest-500 from-50% to-sage-200 to-50%",
    miss: "bg-red-400",
    today: "bg-sage-100 dark:bg-forest-800/60 ring-2 ring-forest-500",
    future: "bg-sage-100 dark:bg-forest-800/60",
    skip: "border border-dashed border-sage-300",
};

const NOTE_TONE = {
    done: "text-forest-700",
    stopped: "text-red-600 dark:text-red-400",
    risk: "text-red-600 dark:text-red-400 font-semibold",
    last: "text-amber-700 dark:text-amber-300 font-semibold",
    plain: "text-forest-700/70",
};

function Note({ course: c, startDate, forDoctor }) {
    const line = (tone, text) => <p className={`text-sm mt-2 ${NOTE_TONE[tone]}`}>{text}</p>;
    switch (c.status) {
        case "upcoming":
            return line("plain", `يبدأ ${formatDate(startDate)}`);
        case "completed":
            return line("done", `اكتمل الكورس — أُخذت ${c.taken} من ${c.planned} جرعة`);
        case "stopped_early":
            return line("stopped", <>
                أُوقف في اليوم {c.day} من {c.total_days}
                {c.stop_reason_label && ` · ${c.stop_reason_label}`}
                {c.remaining > 0 && ` · تُركت ${dosesText(c.remaining)}`}
            </>);
        default:
            if (c.at_risk) {
                return line("risk", <>
                    فاتت آخر جرعتين — {c.final_day ? "اليوم آخر يوم، " : `باقي ${daysText(c.days_left)}، `}
                    {forDoctor ? "لم تُسجَّل جرعات منذ ذلك" : "أكمل الكورس حتى نهايته"}
                </>);
            }
            if (c.final_day) return line("last", forDoctor ? "اليوم آخر يوم في الكورس" : "اليوم آخر يوم — أكمل جرعاته كلها");
            return line("plain", `باقي ${daysText(c.days_left)} بعد اليوم`);
    }
}

// forDoctor: صفحة الطبيب — الحقائق فقط، بلا توجيه للمريض
export default function CourseProgress({ course: c, startDate, forDoctor = false }) {
    if (!c) return null;
    const today = new Date().toLocaleDateString("en-CA"); // «YYYY-MM-DD» بالتوقيت المحلي

    return (
        <div className={`mt-3 rounded-xl p-3 ${c.at_risk ? "bg-red-50" : "bg-sage-50 dark:bg-forest-800/40"}`}>
            <div className="flex items-center justify-between gap-2 text-sm mb-2">
                <span className="font-semibold text-forest-800">
                    كورس {daysText(c.total_days)}
                    {c.status === "active" && <> · اليوم {c.day}</>}
                </span>
                <span className="text-forest-700/60">{c.taken} من {c.planned} جرعة</span>
            </div>

            {c.days ? (
                <div className="flex flex-wrap gap-1" role="img"
                    aria-label={`أُخذت ${c.taken} من ${c.planned} جرعة في ${c.total_days} يوماً`}>
                    {c.days.map((d) => (
                        <span key={d.date} title={formatDate(d.date)}
                            className={`w-5 h-5 rounded-md ${CELL[cellState(d, today, c.stopped_on)]}`} />
                    ))}
                </div>
            ) : (
                <div className="h-2 bg-sage-100 dark:bg-forest-900/60 rounded-full overflow-hidden" role="img" aria-label={`${c.percent}٪ من جرعات الكورس`}>
                    <div className={`h-full rounded-full ${c.at_risk ? "bg-red-500" : "bg-forest-500"}`} style={{ width: `${c.percent}%` }} />
                </div>
            )}

            <Note course={c} startDate={startDate} forDoctor={forDoctor} />
        </div>
    );
}
