// تقرير الالتزام بالجرعات: كم جرعة كانت مستحقة، وكم أُكّد أخذها.
// ----------------------------------------------------------------
// المستحق يُحسب من جدول المواعيد (dose_schedules) بين تاريخ بدء الدواء
// وتاريخ إيقافه، يوماً بيوم وحسب أيام الأسبوع. المأخوذ من dose_logs.
//
// جرعة موعدها خلال الساعة الأخيرة لا تُحسب «فائتة» بعد — ما زال وقتها.
// «في وقتها» = أُكّدت خلال ساعة من موعدها (أو قبله).
//
// حدّ معروف: تعديل أوقات دواء يستبدل جدوله، فيُحسب الماضي بالأوقات الجديدة.

const GRACE = "1 hour";

/**
 * memberId: الفرد
 * days: طول الفترة (آخر N يوماً، واليوم منها)
 * includePrivate: صفحة الطبيب لا تحسب الأدوية الخاصة
 */
async function adherence(pool, memberId, days = 30, { includePrivate = true } = {}) {
    const n = Math.min(Math.max(Number(days) || 30, 1), 90);

    const { rows } = await pool.query(
        `WITH due AS (
            SELECT m.id AS medication_id, m.name, day::date AS day,
                   (day::date + ds.time_of_day) AS scheduled_at
            FROM medications m
            JOIN dose_schedules ds ON ds.medication_id = m.id
            CROSS JOIN LATERAL generate_series(
                GREATEST(CURRENT_DATE - ($2::int - 1), m.start_date),
                -- حتى اليوم، أو نهاية الكورس، أو يوم الإيقاف — أيّها أسبق
                LEAST(CURRENT_DATE, COALESCE(m.end_date, CURRENT_DATE), COALESCE(m.stopped_on, CURRENT_DATE)),
                interval '1 day'
            ) AS day
            WHERE m.member_id = $1
              AND ($3 OR COALESCE(m.is_private, FALSE) = FALSE)
              -- days_of_week: «1» الأحد ... «7» السبت، مثل صفحة اليوم
              AND ds.days_of_week LIKE '%' || (EXTRACT(DOW FROM day)::int + 1) || '%'
        )
        SELECT due.medication_id, due.name, to_char(due.day, 'YYYY-MM-DD') AS day,
               (dl.status = 'taken') AS taken,
               (dl.status = 'taken' AND dl.confirmed_at <= due.scheduled_at + interval '${GRACE}') AS on_time
        FROM due
        LEFT JOIN dose_logs dl ON dl.medication_id = due.medication_id AND dl.scheduled_at = due.scheduled_at
        WHERE due.scheduled_at <= now() - interval '${GRACE}' OR dl.status = 'taken'
        ORDER BY due.day`,
        [memberId, n, includePrivate]
    );

    const pct = (taken, scheduled) => (scheduled ? Math.round((taken / scheduled) * 100) : null);
    const total = { scheduled: 0, taken: 0, on_time: 0 };
    const meds = new Map();
    const daily = new Map();

    // كل أيام الفترة، حتى التي بلا جرعات — الشريط اليومي يحتاجها كلها
    for (let i = n - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        daily.set(key, { date: key, scheduled: 0, taken: 0 });
    }

    for (const r of rows) {
        total.scheduled++;
        if (r.taken) total.taken++;
        if (r.on_time) total.on_time++;

        if (!meds.has(r.medication_id)) meds.set(r.medication_id, { id: r.medication_id, name: r.name, scheduled: 0, taken: 0 });
        const m = meds.get(r.medication_id);
        m.scheduled++;
        if (r.taken) m.taken++;

        const day = daily.get(r.day);
        if (day) {
            day.scheduled++;
            if (r.taken) day.taken++;
        }
    }

    return {
        days: n,
        scheduled: total.scheduled,
        taken: total.taken,
        on_time: total.on_time,
        missed: total.scheduled - total.taken,
        percent: pct(total.taken, total.scheduled),
        medications: [...meds.values()]
            .map((m) => ({ ...m, percent: pct(m.taken, m.scheduled) }))
            .sort((a, b) => a.percent - b.percent),
        daily: [...daily.values()],
    };
}

module.exports = { adherence };
