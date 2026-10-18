// تقدير نفاد الدواء — دالة واحدة يستخدمها الرابط /supply،
// وقائمة «تنفد قريباً»، والتذكير اليومي في المجدول.

const pool = require("./db");

// كم يوماً متبقياً حتى نعتبر الدواء «ينفد قريباً»
const REFILL_DAYS = 3;

// اليوم بتوقيت الجهاز بصيغة «2026-10-18»
function todayStr(now = new Date()) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * medication: صف من جدول medications
 * schedules:  [{ days_of_week }] مواعيد الدواء
 *
 * الحساب: الاستهلاك اليومي = (كل موعد × أيامه في الأسبوع × وحدات الجرعة) ÷ ٧
 * والعدّ يبدأ من آخر علبة (supply_since)، أو من تاريخ البدء إن لم تُجدَّد بعد.
 */
function estimateSupply(medication, schedules, today = todayStr()) {
    if (!medication.units_total) return { known: false, message: "عدد الحبات غير مسجل" };
    if (!schedules.length) return { known: false, message: "لا توجد مواعيد مسجلة" };

    const perDose = Number(medication.units_per_dose) || 1;
    let weekly = 0;
    for (const s of schedules) weekly += (s.days_of_week || "1234567").length * perDose;
    const perDay = weekly / 7;

    const since = String(medication.supply_since || medication.start_date).slice(0, 10);
    const daysPassed = Math.max(0, Math.round((new Date(today) - new Date(since)) / 86400000));

    const consumed = daysPassed * perDay;
    const remaining = Math.max(0, medication.units_total - consumed);
    const daysLeft = perDay > 0 ? Math.floor(remaining / perDay) : null;

    const depletion = new Date(today);
    depletion.setDate(depletion.getDate() + (daysLeft || 0));

    return {
        known: true,
        units_total: medication.units_total,
        per_day: Number(perDay.toFixed(2)),
        consumed_estimate: Math.round(consumed),
        remaining_estimate: Math.round(remaining),
        days_left: daysLeft,
        depletion_date: depletion.toISOString().slice(0, 10),
        needs_refill_soon: daysLeft !== null && daysLeft <= REFILL_DAYS,
    };
}

/**
 * الأدوية الفعّالة التي تنفد خلال REFILL_DAYS أيام أو أقل.
 * userId: لمستخدم واحد (قائمة صفحة اليوم)، أو null لكل المستخدمين (التذكير اليومي)
 */
async function findRefills(userId = null) {
    const today = todayStr();
    const meds = await pool.query(
        `SELECT m.*, mem.name AS member_name, mem.user_id,
                COALESCE(json_agg(json_build_object('days_of_week', ds.days_of_week))
                         FILTER (WHERE ds.id IS NOT NULL), '[]') AS schedules
         FROM medications m
         JOIN members mem ON mem.id = m.member_id
         LEFT JOIN dose_schedules ds ON ds.medication_id = m.id
         WHERE COALESCE(m.is_active, TRUE) = TRUE
           AND m.units_total IS NOT NULL
           AND m.start_date <= $1::date
           AND (m.end_date IS NULL OR m.end_date >= $1::date)
           AND ($2::int IS NULL OR mem.user_id = $2)
         GROUP BY m.id, mem.name, mem.user_id`,
        [today, userId]
    );

    const result = [];
    for (const m of meds.rows) {
        const supply = estimateSupply(m, m.schedules, today);
        if (!supply.known || !supply.needs_refill_soon) continue;
        result.push({
            medication_id: m.id,
            name: m.name,
            strength: m.strength,
            member_id: m.member_id,
            member_name: m.member_name,
            user_id: m.user_id,
            days_left: supply.days_left,
            remaining_estimate: supply.remaining_estimate,
        });
    }
    return result.sort((a, b) => a.days_left - b.days_left);
}

module.exports = { estimateSupply, findRefills, todayStr, REFILL_DAYS };
