// تقدّم الكورس: دواء له مدة محددة (مضاد حيوي ٧ أيام مثلاً).
// ----------------------------------------------------------------
// لماذا؟ في استبيان ٢٥ صيدلانياً، أكثر مشكلة تكررت (٢٠ من ٢٥) هي أن
// المريض يوقف الدواء قبل نهاية الكورس — أكثر من نسيان جرعة (١١ من ٢٥).
//
// الكورس = دواء له تاريخ انتهاء مخطّط (end_date). الدواء المستمر بلا
// end_date ليس كورساً. الإيقاف الفعلي في stopped_on، فلا يختلط
// «انتهى الكورس» بـ«أُوقف قبل نهايته».
//
// المخطّط من جدول المواعيد بين البدء والنهاية، يوماً بيوم، والمأخوذ من
// dose_logs — نفس طريقة تقرير الالتزام (adherence.js).
//
// «في خطر»: آخر جرعتين مستحقتين لم تُؤخذا والكورس لم ينتهِ — هكذا
// يبدو التوقف الصامت قبل أن يصير توقفاً.

const { todayStr } = require("./supply");

const GRACE = "1 hour";
const RISK_MISSED = 2;
// شريط الأيام يُرسل للكورسات حتى شهر؛ الأطول يُعرض شريطاً متصلاً
const MAX_STRIP_DAYS = 31;

// أسباب الإيقاف المسموحة — تظهر للطبيب في صفحة المشاركة
const STOP_REASONS = {
    doctor: "بقرار الطبيب",
    side_effects: "أعراض جانبية",
    felt_better: "شعر بتحسّن",
    other: "سبب آخر",
};

// «YYYY-MM-DD» ← أيام منذ ١٩٧٠، بلا أثر للتوقيت الصيفي
function dayNumber(date) {
    const [y, m, d] = date.split("-").map(Number);
    return Date.UTC(y, m - 1, d) / 86400000;
}

// الفرق بالأيام بين تاريخين «YYYY-MM-DD»
function daysBetween(from, to) {
    return dayNumber(to) - dayNumber(from);
}

/**
 * يحسب حالة كورس واحد من صف الدواء وجرعاته المخطّطة.
 * doses: [{ day, past, taken }] مرتّبة حسب الموعد
 * today: «YYYY-MM-DD» — يُمرَّر في الاختبارات
 */
function summarize(med, doses, today = todayStr()) {
    const start = med.start_date;
    const end = med.end_date;
    const stopped = med.stopped_on || null;
    const totalDays = daysBetween(start, end) + 1;

    // اليوم الذي وصل إليه: يتوقف عند الإيقاف أو عند النهاية
    const reached = stopped && stopped < today ? stopped : today;
    const day = Math.min(Math.max(daysBetween(start, reached) + 1, 0), totalDays);

    const planned = doses.length;
    const taken = doses.filter((d) => d.taken).length;
    const due = doses.filter((d) => d.past || d.taken).length;

    let status;
    if (stopped && stopped < end) status = "stopped_early";
    else if (stopped || today > end) status = "completed";
    else if (today < start) status = "upcoming";
    else status = "active";

    // آخر جرعات مرّ وقتها: كلها فائتة؟
    const lastPast = doses.filter((d) => d.past).slice(-RISK_MISSED);
    const atRisk = status === "active"
        && lastPast.length === RISK_MISSED
        && lastPast.every((d) => !d.taken);

    // يوماً بيوم: كم جرعة مخطّطة، وكم أُخذ، وكم مرّ وقته
    let days = null;
    if (totalDays <= MAX_STRIP_DAYS) {
        const map = new Map();
        for (let i = 0; i < totalDays; i++) {
            const date = new Date((dayNumber(start) + i) * 86400000).toISOString().slice(0, 10);
            map.set(date, { date, planned: 0, taken: 0, due: 0 });
        }
        for (const d of doses) {
            const cell = map.get(d.day);
            if (!cell) continue;
            cell.planned++;
            if (d.taken) cell.taken++;
            if (d.past || d.taken) cell.due++;
        }
        days = [...map.values()];
    }

    return {
        status,
        total_days: totalDays,
        day,
        days_left: status === "active" || status === "upcoming" ? daysBetween(today, end) : 0,
        final_day: status === "active" && today === end,
        // منذ متى انتهى الكورس — صفحة اليوم تُبقي المكتمل يومين
        days_since_end: status === "completed" ? daysBetween(stopped && stopped < today ? stopped : end, today) : null,
        planned,
        taken,
        due,
        missed: due - taken,
        // الجرعات التي لم يصل وقتها بعد — أو تُركت بالإيقاف المبكر
        remaining: planned - due,
        percent: planned ? Math.round((taken / planned) * 100) : 0,
        at_risk: atRisk,
        stopped_on: stopped,
        stop_reason: med.stop_reason || null,
        stop_reason_label: STOP_REASONS[med.stop_reason] || null,
        days,
    };
}

/**
 * كورسات مع تقدّمها. فلتر واحد على الأقل:
 * { medicationIds, memberId, userId, includePrivate }
 * يُرجع Map: medication_id ← { ...بيانات الدواء, course }
 */
async function courses(pool, { medicationIds = null, memberId = null, userId = null, includePrivate = true } = {}) {
    const meds = await pool.query(
        `SELECT m.id, m.name, m.strength, m.member_id, mem.name AS member_name, mem.user_id,
                m.start_date, m.end_date, m.stopped_on, m.stop_reason, m.is_active
         FROM medications m
         JOIN members mem ON mem.id = m.member_id
         WHERE m.end_date IS NOT NULL AND m.end_date >= m.start_date
           -- دواء أُوقف قبل وجود stopped_on: لا نعرف متى، فلا نحسبه كورساً
           AND (COALESCE(m.is_active, TRUE) = TRUE OR m.stopped_on IS NOT NULL)
           AND ($1::int[] IS NULL OR m.id = ANY($1::int[]))
           AND ($2::int IS NULL OR m.member_id = $2)
           AND ($3::int IS NULL OR mem.user_id = $3)
           AND ($4 OR COALESCE(m.is_private, FALSE) = FALSE)`,
        [medicationIds, memberId, userId, includePrivate]
    );
    const result = new Map();
    if (!meds.rows.length) return result;

    const ids = meds.rows.map((m) => m.id);
    const { rows } = await pool.query(
        `WITH due AS (
            SELECT m.id AS medication_id, (day::date + ds.time_of_day) AS scheduled_at
            FROM medications m
            JOIN dose_schedules ds ON ds.medication_id = m.id
            -- الكورس المخطّط كاملاً حتى لو أُوقف — لنعرف كم جرعة تُركت
            CROSS JOIN LATERAL generate_series(m.start_date, m.end_date, interval '1 day') AS day
            WHERE m.id = ANY($1::int[])
              -- days_of_week: «1» الأحد ... «7» السبت
              AND ds.days_of_week LIKE '%' || (EXTRACT(DOW FROM day)::int + 1) || '%'
        )
        SELECT due.medication_id,
               (due.scheduled_at <= now() - interval '${GRACE}') AS past,
               COALESCE(dl.status = 'taken', FALSE) AS taken,
               to_char(due.scheduled_at, 'YYYY-MM-DD') AS day
        FROM due
        LEFT JOIN dose_logs dl ON dl.medication_id = due.medication_id AND dl.scheduled_at = due.scheduled_at
        ORDER BY due.medication_id, due.scheduled_at`,
        [ids]
    );

    const byMed = new Map(ids.map((id) => [id, []]));
    for (const r of rows) byMed.get(r.medication_id).push(r);

    for (const m of meds.rows) {
        // بعد يوم الإيقاف: الجرعات «مخطّطة» لكنها لم تعد مستحقة
        const doses = byMed.get(m.id).map((d) => (
            m.stopped_on && d.day > m.stopped_on ? { ...d, past: false } : d
        ));
        result.set(m.id, {
            medication_id: m.id,
            name: m.name,
            strength: m.strength,
            member_id: m.member_id,
            member_name: m.member_name,
            user_id: m.user_id,
            course: summarize(m, doses),
        });
    }
    return result;
}

module.exports = { courses, summarize, daysBetween, STOP_REASONS };
