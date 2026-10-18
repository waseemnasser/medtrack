const webpush = require("web-push");
const cron = require("node-cron");
const pool = require("./db");
const { findRefills } = require("./supply");

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC,
    process.env.VAPID_PRIVATE
);

// إرسال إشعار لكل أجهزة مستخدم معيّن — يُرجع عدد ما وصل وما فشل
async function sendToUser(userId, payload) {
    const subs = await pool.query(
        "SELECT * FROM push_subscriptions WHERE user_id = $1",
        [userId]
    );

    let sent = 0;
    let failed = 0;
    for (const s of subs.rows) {
        const subscription = {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
        };
        try {
            await webpush.sendNotification(subscription, JSON.stringify(payload));
            sent++;
        } catch (err) {
            failed++;
            // 410/404 تعني أن الاشتراك لم يعد صالحاً — نحذفه
            if (err.statusCode === 410 || err.statusCode === 404) {
                await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [s.id]);
            } else {
                console.error("push error:", err.statusCode, err.body);
            }
        }
    }
    return { sent, failed };
}

// يفحص كل دقيقة: أي جرعة حان وقتها الآن ولم تُؤكَّد
// ذاكرة مؤقتة تمنع تكرار نفس التذكير
const sentToday = new Set();
let sentDay = "";

function startScheduler() {
    cron.schedule("* * * * *", async () => {
        try {
            const now = new Date();
            const pad = (n) => String(n).padStart(2, "0");
            const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
            const nowTime = `${pad(now.getHours())}:${pad(now.getMinutes())}:00`;

            // تنظيف الذاكرة عند تغيّر اليوم
            if (sentDay !== todayStr) { sentToday.clear(); sentDay = todayStr; }

            const dayOfWeek = String(now.getDay() + 1); // 1 = الأحد

            const due = await pool.query(
                `SELECT ds.id AS schedule_id, ds.time_of_day,
                m.id AS medication_id, m.name AS medication_name, m.strength,
                mem.name AS member_name, mem.user_id
         FROM dose_schedules ds
         JOIN medications m  ON m.id  = ds.medication_id
         JOIN members mem    ON mem.id = m.member_id
         LEFT JOIN dose_logs dl
                ON dl.medication_id = m.id
               AND dl.scheduled_at = ($1::date + ds.time_of_day)
         WHERE COALESCE(m.is_active, TRUE) = TRUE
           AND m.start_date <= $1::date
           AND (m.end_date IS NULL OR m.end_date >= $1::date)
           AND ds.days_of_week LIKE '%' || $2 || '%'
           AND ds.time_of_day >  ($3::time - INTERVAL '2 minutes')
           AND ds.time_of_day <= $3::time
           AND dl.id IS NULL`,
                [todayStr, dayOfWeek, nowTime]
            );

            await checkAppointments().catch((err) => console.error("[push] appointments:", err.message));

            for (const d of due.rows) {
                const key = `${d.schedule_id}-${todayStr}`;
                if (sentToday.has(key)) continue;   // أُرسل سابقاً اليوم
                sentToday.add(key);

                console.log(`[push] تذكير: ${d.medication_name} — ${d.member_name} (${d.time_of_day})`);
                await sendToUser(d.user_id, {
                    title: "حان وقت الجرعة",
                    body: `${d.medication_name}${d.strength ? " " + d.strength : ""} — ${d.member_name}`,
                    url: "/",
                });
            }
        } catch (err) {
            console.error("[push] scheduler:", err.message);
        }
    });

    // كل يوم الساعة ١٠ صباحاً: الأدوية التي تنفد خلال ٣ أيام أو أقل.
    // إشعار واحد لكل حساب، مهما كان عدد الأدوية — لا نغرق المستخدم.
    cron.schedule("0 10 * * *", sendRefillReminders);

    console.log("[push] المجدول يعمل — الجرعات والمواعيد كل دقيقة، والأدوية التي تنفد يومياً ١٠:٠٠");
}

// ساعة التذكير بالمواعيد في المساء السابق
const DAY_BEFORE_HOUR = 18;

// «2026-10-28 11:00:00» ← «11:00 ص»
function apptTime(scheduledAt) {
    const [h, m] = String(scheduledAt).replace("T", " ").split(" ")[1].split(":");
    const hour = parseInt(h, 10);
    return `${hour % 12 === 0 ? 12 : hour % 12}:${m} ${hour < 12 ? "ص" : "م"}`;
}

function apptBody(a, withLocation) {
    const extra = [a.doctor_name, withLocation && a.location].filter(Boolean).join(" · ");
    return `${a.title} لـ${a.member_name} — الساعة ${apptTime(a.scheduled_at)}${extra ? " · " + extra : ""}`;
}

/**
 * تذكيران لكل موعد:
 *  - مساء اليوم السابق (من الساعة ٦): «موعد غداً»
 *  - قبل الموعد بساعتين: «موعد بعد قليل» مع المكان
 * نعلّم الموعد قبل الإرسال، حتى لا يتكرر التذكير لو فشل الإرسال أو أُعيد تشغيل الخادم.
 */
async function checkAppointments() {
    const dayBefore = await pool.query(
        `UPDATE appointments a SET reminded_day_before = TRUE
         FROM members mem
         WHERE mem.id = a.member_id
           AND NOT a.reminded_day_before
           AND a.scheduled_at::date = CURRENT_DATE + 1
           AND EXTRACT(HOUR FROM LOCALTIMESTAMP) >= $1
         RETURNING a.*, mem.name AS member_name, mem.user_id`,
        [DAY_BEFORE_HOUR]
    );
    for (const a of dayBefore.rows) {
        console.log(`[push] تذكير موعد الغد: ${a.title} — ${a.member_name}`);
        await sendToUser(a.user_id, { title: "موعد غداً", body: apptBody(a, false), url: "/appointments" });
    }

    const soon = await pool.query(
        `UPDATE appointments a SET reminded_soon = TRUE, reminded_day_before = TRUE
         FROM members mem
         WHERE mem.id = a.member_id
           AND NOT a.reminded_soon
           AND a.scheduled_at > LOCALTIMESTAMP
           AND a.scheduled_at <= LOCALTIMESTAMP + INTERVAL '2 hours'
         RETURNING a.*, mem.name AS member_name, mem.user_id`
    );
    for (const a of soon.rows) {
        console.log(`[push] تذكير موعد قريب: ${a.title} — ${a.member_name}`);
        await sendToUser(a.user_id, { title: "موعد بعد قليل", body: apptBody(a, true), url: "/appointments" });
    }
}

// «ينفد اليوم» / «يكفي يوماً واحداً» / «يكفي ٣ أيام»
function daysText(n) {
    if (n <= 0) return "نفد تقريباً";
    if (n === 1) return "يكفي يوماً واحداً";
    if (n === 2) return "يكفي يومين";
    return `يكفي ${n} أيام`;
}

async function sendRefillReminders() {
    try {
        const refills = await findRefills();
        const byUser = new Map();
        for (const r of refills) {
            if (!byUser.has(r.user_id)) byUser.set(r.user_id, []);
            byUser.get(r.user_id).push(r);
        }

        for (const [userId, list] of byUser) {
            const first = list[0];
            const payload = list.length === 1
                ? {
                    title: "دواء يقترب من النفاد",
                    body: `${first.name} لـ${first.member_name} — ${daysText(first.days_left)}. جدّد العلبة قريباً.`,
                    url: `/members/${first.member_id}`,
                }
                : {
                    title: `${list.length} أدوية تقترب من النفاد`,
                    body: list.slice(0, 3).map((r) => `${r.name} لـ${r.member_name}`).join("، ")
                        + (list.length > 3 ? "، وغيرها" : ""),
                    url: "/",
                };
            console.log(`[push] تنبيه نفاد للمستخدم ${userId}: ${list.length} دواء`);
            await sendToUser(userId, payload);
        }
    } catch (err) {
        console.error("[push] refills:", err.message);
    }
}

module.exports = { sendToUser, startScheduler, sendRefillReminders };