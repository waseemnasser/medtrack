const webpush = require("web-push");
const cron = require("node-cron");
const pool = require("./db");

webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:admin@example.com",
    process.env.VAPID_PUBLIC,
    process.env.VAPID_PRIVATE
);

// إرسال إشعار لكل أجهزة مستخدم معيّن
async function sendToUser(userId, payload) {
    const subs = await pool.query(
        "SELECT * FROM push_subscriptions WHERE user_id = $1",
        [userId]
    );

    for (const s of subs.rows) {
        const subscription = {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
        };
        try {
            await webpush.sendNotification(subscription, JSON.stringify(payload));
        } catch (err) {
            // 410/404 تعني أن الاشتراك لم يعد صالحاً — نحذفه
            if (err.statusCode === 410 || err.statusCode === 404) {
                await pool.query("DELETE FROM push_subscriptions WHERE id = $1", [s.id]);
            } else {
                console.error("push error:", err.statusCode, err.body);
            }
        }
    }
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

    console.log("[push] المجدول يعمل — فحص كل دقيقة");
}

module.exports = { sendToUser, startScheduler };