// بيانات العرض التقديمي — حساب تجريبي جاهز بشهر من السجل
// ----------------------------------------------------------------
// التشغيل (من مجلد server):   npm run seed:demo
//
// يحذف الحساب التجريبي إن وُجد ويعيد إنشاءه من الصفر، فكل تشغيل
// يعطي البيانات نفسها. لا يلمس أي حساب آخر.
//
// الدخول بعدها:
//   البريد:        demo@tamenni.test
//   كلمة المرور:   tamenni-demo-2026
//
// الأسماء والأدوية أمثلة للعرض فقط، لا بيانات مرضى حقيقيين.

const bcrypt = require("bcryptjs");
const pool = require("../db");
const migrate = require("../migrate");
const { replaceAllergies } = require("../allergy");

const DEMO = { name: "حساب العرض", email: "demo@tamenni.test", password: "tamenni-demo-2026" };

// مولّد أرقام شبه عشوائية ثابت: كل تشغيل يعطي السجل نفسه
let seed = 20261020;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const pad = (n) => String(n).padStart(2, "0");
const dateStr = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysAgo = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
const at = (day, time) => { const [h, m] = time.split(":").map(Number); const d = new Date(day); d.setHours(h, m, 0, 0); return d; };
const sqlTs = (d) => `${dateStr(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;

// دواء من الكتالوغ الحقيقي: أول اسم تجاري مادته الوحيدة هي المطلوبة (وبالعيار إن ذُكر)
async function catalogRow(ingredient, strengthLike) {
    const { rows } = await pool.query(
        `SELECT c.* FROM medicines_catalog c
         JOIN catalog_ingredients ci ON ci.catalog_id = c.id
         JOIN ingredients i ON i.id = ci.ingredient_id
         WHERE i.name = $1
           AND (SELECT count(*) FROM catalog_ingredients x WHERE x.catalog_id = c.id) = 1
           AND ($2::text IS NULL OR c.strength ILIKE $2)
         ORDER BY c.id LIMIT 1`,
        [ingredient, strengthLike ? `${strengthLike}%` : null]
    );
    if (!rows.length) throw new Error(`لا يوجد في الكتالوغ دواء من ${ingredient} ${strengthLike || ""}`);
    return rows[0];
}

const ingredientId = async (name) => (await pool.query("SELECT id FROM ingredients WHERE name = $1", [name])).rows[0].id;
const classId = async (code) => (await pool.query("SELECT id FROM drug_classes WHERE code = $1", [code])).rows[0].id;

async function addMember(userId, m) {
    const { rows } = await pool.query(
        "INSERT INTO members (user_id, name, birth_date, chronic_conditions) VALUES ($1, $2, $3, $4) RETURNING id",
        [userId, m.name, m.birth_date, m.chronic || null]
    );
    return rows[0].id;
}

/**
 * يضيف دواءً من الكتالوغ مع أوقاته، ثم سجل جرعاته من يوم بدئه حتى الآن.
 * adherence: احتمال أخذ كل جرعة (0.9 = تسع جرعات من عشر)
 */
async function addMedication(memberId, med) {
    const row = await catalogRow(med.ingredient, med.strength);
    const start = daysAgo(med.startedDaysAgo);
    const end = med.courseDays ? daysAgo(med.startedDaysAgo - med.courseDays + 1) : null;

    const { rows } = await pool.query(
        `INSERT INTO medications (member_id, catalog_id, name, active_ingredient, strength, form, instructions,
            start_date, end_date, units_total, units_per_dose, is_private, supply_since)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,$11,$8) RETURNING id`,
        [memberId, row.id, row.brand_name, row.active_ingredient, row.strength, row.form || "أقراص",
            med.instructions || null, dateStr(start), end && dateStr(end), med.units || null, Boolean(med.private)]
    );
    const id = rows[0].id;
    await pool.query(
        "INSERT INTO medication_ingredients (medication_id, ingredient_id) SELECT $1, ingredient_id FROM catalog_ingredients WHERE catalog_id = $2",
        [id, row.id]
    );
    for (const t of med.times) {
        await pool.query("INSERT INTO dose_schedules (medication_id, time_of_day, days_of_week) VALUES ($1, $2, '1234567')", [id, `${t}:00`]);
    }

    // سجل الجرعات: كل جرعة مضى موعدها بساعة، تُؤخذ باحتمال adherence،
    // وتُؤكَّد غالباً خلال دقائق من موعدها وأحياناً متأخرة
    const now = new Date();
    for (let day = new Date(start); day <= now && (!end || day <= end); day.setDate(day.getDate() + 1)) {
        for (const t of med.times) {
            const due = at(day, t);
            if (due > new Date(now.getTime() - 60 * 60 * 1000)) continue;
            if (random() > med.adherence) continue;
            const delay = random() < 0.85 ? Math.floor(random() * 25) : 60 + Math.floor(random() * 120);
            const confirmed = new Date(due.getTime() + delay * 60 * 1000);
            await pool.query(
                "INSERT INTO dose_logs (medication_id, scheduled_at, confirmed_at, status) VALUES ($1, $2, $3, 'taken')",
                [id, sqlTs(due), sqlTs(confirmed)]
            );
        }
    }
    return { id, name: row.brand_name };
}

async function main() {
    await migrate();

    // البدء من الصفر: حذف الحساب التجريبي وكل ما يتبعه
    const old = await pool.query("SELECT id FROM users WHERE email = $1", [DEMO.email]);
    if (old.rows.length) {
        await pool.query("DELETE FROM share_links WHERE member_id IN (SELECT id FROM members WHERE user_id = $1)", [old.rows[0].id]);
        await pool.query("DELETE FROM members WHERE user_id = $1", [old.rows[0].id]);
        await pool.query("DELETE FROM users WHERE id = $1", [old.rows[0].id]);
    }

    const hash = await bcrypt.hash(DEMO.password, 10);
    const userId = (await pool.query(
        "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id",
        [DEMO.name, DEMO.email, hash]
    )).rows[0].id;

    // ---------- الأفراد وحساسيتهم ----------
    const sara = await addMember(userId, { name: "سارة", birth_date: "1990-04-02", chronic: "ربو" });
    const khaled = await addMember(userId, { name: "خالد", birth_date: "1963-09-11", chronic: "ضغط، سكري" });
    const layla = await addMember(userId, { name: "ليلى", birth_date: "2017-06-20" });

    await replaceAllergies(pool, sara, [
        { class_id: await classId("J01C"), severity: "severe", reaction: "تورّم وضيق تنفّس" },
    ]);
    await replaceAllergies(pool, khaled, [
        { ingredient_id: await ingredientId("IBUPROFEN"), severity: "mild", reaction: "طفح جلدي" },
    ]);

    // ---------- الأدوية وشهر من السجل ----------
    await addMedication(khaled, { ingredient: "METFORMIN", strength: "500", times: ["08:00", "20:00"], startedDaysAgo: 40, units: 120, adherence: 0.82, instructions: "بعد الأكل" });
    await addMedication(khaled, { ingredient: "AMLODIPINE", strength: "5", times: ["08:00"], startedDaysAgo: 40, units: 60, adherence: 0.9 });
    // ٣٠ قرصاً بدأت قبل ٢٧ يوماً: تنفد خلال ٣ أيام — تظهر في «يقترب من النفاد»
    await addMedication(khaled, { ingredient: "ATORVASTATIN", strength: "20", times: ["21:00"], startedDaysAgo: 27, units: 30, adherence: 0.78 });

    await addMedication(sara, { ingredient: "MONTELUKAST", strength: "10", times: ["21:00"], startedDaysAgo: 35, units: 60, adherence: 0.95 });
    await addMedication(sara, { ingredient: "ESOMEPRAZOLE", strength: "20", times: ["07:30"], startedDaysAgo: 20, units: 28, adherence: 0.9, instructions: "قبل الفطور بنصف ساعة" });
    // دواء خاص: لا يظهر في صفحة الطبيب ولا في سجلها
    await addMedication(sara, { ingredient: "SERTRALINE", strength: "50", times: ["09:00"], startedDaysAgo: 30, units: 30, adherence: 0.93, private: true });

    // دورة مضاد حيوي لسبعة أيام، بدأت قبل ٤ أيام — مرتين يومياً
    await addMedication(layla, { ingredient: "CEFADROXIL", times: ["08:00", "20:00"], startedDaysAgo: 4, courseDays: 7, adherence: 0.92, instructions: "بعد الأكل" });

    // ---------- المواعيد ----------
    const appts = [
        [khaled, "طبيب القلب", 1, "10:00", "عيادة القلب", "مراجعة الضغط والتحاليل"],
        [sara, "طبيب الصدرية", 6, "17:30", "مركز الصدرية", null],
        [layla, "طبيب الأطفال", 3, "11:00", "عيادة الأطفال", "مراجعة بعد انتهاء المضاد الحيوي"],
        [khaled, "تحليل دم (سكر تراكمي)", -12, "09:00", "المخبر", null],
    ];
    for (const [member, title, inDays, time, location, notes] of appts) {
        await pool.query(
            "INSERT INTO appointments (member_id, title, scheduled_at, location, notes) VALUES ($1, $2, $3, $4, $5)",
            [member, title, sqlTs(at(daysAgo(-inDays), time)), location, notes]
        );
    }

    // ---------- سجل الإشعارات (نافذة الجرس) ----------
    const notes = [
        ["dose", "حان وقت الجرعة", "سيفادروكسيل — ليلى", "/", 0, "08:00", false],
        ["appointment", "موعد غداً", "طبيب القلب لـخالد — الساعة 10:00 ص", "/appointments", 0, "20:00", false],
        ["refill", "دواء يقترب من النفاد", "أتورفاستاتين لـخالد — ينفد خلال ٣ أيام. جدّد العلبة قريباً.", `/members/${khaled}`, 0, "10:00", true],
        ["dose", "حان وقت الجرعة", "مونتيلوكاست — سارة", "/", 1, "21:00", true],
    ];
    for (const [kind, title, body, url, ago, time, read] of notes) {
        const when = at(daysAgo(ago), time);
        if (when > new Date()) continue;
        await pool.query(
            "INSERT INTO notifications (user_id, kind, title, body, url, created_at, read_at) VALUES ($1,$2,$3,$4,$5,$6,$7)",
            [userId, kind, title, body, url, sqlTs(when), read ? sqlTs(when) : null]
        );
    }

    const doses = (await pool.query(
        "SELECT count(*)::int AS n FROM dose_logs dl JOIN medications m ON m.id = dl.medication_id JOIN members mem ON mem.id = m.member_id WHERE mem.user_id = $1",
        [userId]
    )).rows[0].n;
    console.log(`✓ حساب العرض جاهز: ٣ أفراد، ٧ أدوية، ${doses} جرعة مؤكَّدة، ٤ مواعيد.`);
    console.log(`  البريد: ${DEMO.email}`);
    console.log(`  كلمة المرور: ${DEMO.password}`);
}

main()
    .catch((err) => {
        console.error("تعذّر إنشاء بيانات العرض:", err.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());
