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
function startScheduler() {
    cron.schedule("* * * * *", async () => {
        try {
            const due = await pool.query(
                `SELECT ds.id AS schedule_id, ds.time_of_day,
                m.name AS medication_name, m.strength,
                mem.name AS member_name, mem.user_id
         FROM dose_schedules ds
         JOIN medications m  ON m.id  = ds.medication_id
         JOIN members mem    ON mem.id = m.member_id
         LEFT JOIN dose_logs dl
                ON dl.medication_id = m.id
               AND dl.scheduled_at = (CURRENT_DATE + ds.time_of_day)
         WHERE COALESCE(m.is_active, TRUE) = TRUE
           AND m.start_date <= CURRENT_DATE
           AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
           AND ds.days_of_week LIKE '%' || (EXTRACT(DOW FROM CURRENT_DATE) + 1)::text || '%'
           AND date_trunc('minute', ds.time_of_day) = date_trunc('minute', LOCALTIME)
           AND dl.id IS NULL`
            );

            for (const d of due.rows) {
                await sendToUser(d.user_id, {
                    title: "حان وقت الجرعة",
                    body: `${d.medication_name}${d.strength ? " " + d.strength : ""} — ${d.member_name}`,
                    url: "/",
                });
            }

            if (due.rows.length) {
                console.log(`[push] أُرسل ${due.rows.length} تذكير`);
            }
        } catch (err) {
            console.error("[push] scheduler:", err.message);
        }
    });

    console.log("[push] المجدول يعمل — فحص كل دقيقة");
}

module.exports = { sendToUser, startScheduler };