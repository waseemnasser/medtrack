// اختبارات فحص الحساسية وتقرير الالتزام وتقدّم الكورس — تشغيلها: npm test (من مجلد server)
// ----------------------------------------------------------------
// أزواج معروفة (حساسية ← دواء ← النتيجة المتوقعة) تُفحص على قاعدة
// البيانات الحقيقية والكتالوغ الحقيقي. أي تعديل يكسر حالة منها يظهر هنا
// قبل أن يصل إلى المستخدم. تُنشئ مستخدماً مؤقتاً وتحذفه في النهاية.

const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../db");
const migrate = require("../migrate");
const { canonical, parseIngredients } = require("../ingredients");
const { replaceAllergies, checkIngredients, memberConflicts } = require("../allergy");
const { adherence } = require("../adherence");
const { courses } = require("../course");

// ---------- توحيد أسماء المواد (بلا قاعدة بيانات) ----------

describe("canonical ingredient names", () => {
    const cases = [
        ["R.TAB. TRAMADOL HCL", "TRAMADOL"],
        ["DICLOFENAC SODIUM", "DICLOFENAC"],
        ["DICLOFENAC POTASSIUM", "DICLOFENAC"],
        ["G.CAP. IBUPROFEN", "IBUPROFEN"],
        ["V.C.BAG PARACETAMOL", "PARACETAMOL"],
        ["CALCIUM CARBONATE", "CALCIUM CARBONATE"],   // المعدن هو المادة: لا يُحذف شيء
        ["ZINC SULPHATE", "ZINC SULFATE"],
        ["PANTOPRAZOL", "PANTOPRAZOLE"],
        ["IBUPROFEN ARGINATE SALT", "IBUPROFEN"],
        ["CEFUROXIME AXETIL", "CEFUROXIME"],
        ["=20.000 I.U", null],
        ["R.TAB", null],
    ];
    for (const [raw, expected] of cases) {
        test(`${raw} → ${expected}`, () => assert.equal(canonical(raw), expected));
    }

    test("combinations split into ingredients", () => {
        assert.deepEqual(parseIngredients("AMLODIPINE+ATORVASTATIN"), ["AMLODIPINE", "ATORVASTATIN"]);
        assert.deepEqual(parseIngredients("OLANZAPINE+ FLUOXETINE"), ["OLANZAPINE", "FLUOXETINE"]);
        assert.deepEqual(parseIngredients("VIT.A+D3+C"), ["VITAMIN A", "VITAMIN D3", "ASCORBIC ACID"]);
        assert.deepEqual(parseIngredients("PARACETAMOL+DICLOFENAC-K"), ["PARACETAMOL", "DICLOFENAC"]);
    });
});

// ---------- الفحص على البيانات الحقيقية ----------

let userId, memberId;
const ing = {};      // اسم المادة ← رقمها
const cls = {};      // رمز العائلة ← رقمها

const ids = (...names) => names.map((n) => {
    assert.ok(ing[n], `المادة ${n} غير موجودة في الكتالوغ`);
    return ing[n];
});

async function catalogIngredients(brand) {
    const { rows } = await pool.query(
        `SELECT ci.ingredient_id FROM medicines_catalog c JOIN catalog_ingredients ci ON ci.catalog_id = c.id
         WHERE c.brand_name = $1 AND c.id = (SELECT min(id) FROM medicines_catalog WHERE brand_name = $1)`,
        [brand]
    );
    assert.ok(rows.length, `الاسم التجاري ${brand} غير موجود في الكتالوغ`);
    return rows.map((r) => r.ingredient_id);
}

/** يضبط حساسية الفرد، ثم يفحص الدواء، ويُرجع أخطر مستوى أو null */
async function levelFor(allergies, medIngredientIds) {
    await replaceAllergies(pool, memberId, allergies);
    const { conflicts } = await checkIngredients(pool, memberId, medIngredientIds);
    return conflicts[0]?.level || null;
}

describe("allergy check against the real catalog", () => {
    before(async () => {
        await migrate();
        const u = await pool.query(
            "INSERT INTO users (name, email, password_hash) VALUES ('allergy-test', $1, 'x') RETURNING id",
            [`allergy-test-${Date.now()}@medtrack.test`]
        );
        userId = u.rows[0].id;
        const m = await pool.query("INSERT INTO members (user_id, name) VALUES ($1, 'اختبار') RETURNING id", [userId]);
        memberId = m.rows[0].id;
        for (const r of (await pool.query("SELECT id, name FROM ingredients")).rows) ing[r.name] = r.id;
        for (const r of (await pool.query("SELECT id, code FROM drug_classes")).rows) cls[r.code] = r.id;
    });

    after(async () => {
        await pool.query("DELETE FROM members WHERE user_id = $1", [userId]);
        await pool.query("DELETE FROM users WHERE id = $1", [userId]);
        await pool.end();
    });

    // [الوصف، الحساسية، مواد الدواء (دالة)، المستوى المتوقع]
    const CASES = [
        ["same ingredient from another company", () => [{ ingredient_id: ing.PARACETAMOL }], () => catalogIngredients("ACETALGIN"), "direct"],
        ["ingredient inside a combination", () => [{ ingredient_id: ing.PARACETAMOL }], () => ids("PARACETAMOL", "CAFFEINE"), "direct"],
        ["salt form is the same drug", () => [{ ingredient_id: ing.DICLOFENAC }], () => catalogIngredients("BALTAREN"), "direct"],
        ["penicillin class → AUGMENTIN", () => [{ class_id: cls.J01C }], () => catalogIngredients("AUGMENTIN"), "class"],
        ["NSAID class → aspirin", () => [{ class_id: cls.M01A }], () => ids("ACETYLSALICYLIC ACID"), "class"],
        ["quinolone class → ciprofloxacin", () => [{ class_id: cls.J01M }], () => ids("CIPROFLOXACIN"), "class"],
        ["ibuprofen → diclofenac (same family)", () => [{ ingredient_id: ing.IBUPROFEN }], () => ids("DICLOFENAC"), "family"],
        ["amoxicillin → ampicillin (same family)", () => [{ ingredient_id: ing.AMOXICILLIN }], () => ids("AMPICILLIN", "CLOXACILLIN"), "family"],
        ["penicillins → cefuroxime (cross-reaction)", () => [{ class_id: cls.J01C }], () => ids("CEFUROXIME"), "cross"],
        ["ceftriaxone → amoxicillin (cross-reaction)", () => [{ ingredient_id: ing.CEFTRIAXONE }], () => ids("AMOXICILLIN"), "cross"],
        ["penicillins → penicillamine (cross-reaction, per its label)", () => [{ class_id: cls.J01C }], () => catalogIngredients("PENICILLAMINE"), "cross"],
        ["amoxicillin → penicillamine (via the penicillin family)", () => [{ ingredient_id: ing.AMOXICILLIN }], () => ids("PENICILLAMINE"), "cross"],
        // يجب ألا تُنبّه:
        ["ibuprofen ↛ penicillamine", () => [{ ingredient_id: ing.IBUPROFEN }], () => ids("PENICILLAMINE"), null],
        ["paracetamol ↛ caffeine alone", () => [{ ingredient_id: ing.PARACETAMOL }], () => ids("CAFFEINE"), null],
        ["ibuprofen ↛ paracetamol", () => [{ ingredient_id: ing.IBUPROFEN }], () => ids("PARACETAMOL"), null],
        ["text note is never matched", () => [{ note: "باراسيتامول" }], () => ids("PARACETAMOL"), null],
    ];

    for (const [name, allergies, med, expected] of CASES) {
        test(name, async () => assert.equal(await levelFor(allergies(), await med()), expected));
    }

    test("text notes are reported as unchecked", async () => {
        await replaceAllergies(pool, memberId, [{ note: "غبار" }, { ingredient_id: ing.IBUPROFEN }]);
        const { unchecked } = await checkIngredients(pool, memberId, ids("PARACETAMOL"));
        assert.deepEqual(unchecked, ["غبار"]);
    });

    // ---------- تقرير الالتزام ----------
    // دواء مرة يومياً ٨:٠٠، من ثلاثة أيام حتى أمس: ٣ جرعات مستحقة كلها في الماضي
    test("adherence counts due, taken and on-time doses", async () => {
        const med = await pool.query(
            `INSERT INTO medications (member_id, name, start_date, end_date)
             VALUES ($1, 'اختبار الالتزام', CURRENT_DATE - 3, CURRENT_DATE - 1) RETURNING id`,
            [memberId]
        );
        const id = med.rows[0].id;
        await pool.query("INSERT INTO dose_schedules (medication_id, time_of_day, days_of_week) VALUES ($1, '08:00', '1234567')", [id]);
        // قبل ثلاثة أيام: في وقتها. قبل يومين: متأخرة ثلاث ساعات. أمس: لم تُؤخذ
        await pool.query(
            `INSERT INTO dose_logs (medication_id, scheduled_at, confirmed_at, status) VALUES
             ($1, (CURRENT_DATE - 3) + time '08:00', (CURRENT_DATE - 3) + time '08:10', 'taken'),
             ($1, (CURRENT_DATE - 2) + time '08:00', (CURRENT_DATE - 2) + time '11:00', 'taken')`,
            [id]
        );
        const r = await adherence(pool, memberId, 7);
        const m = r.medications.find((x) => x.id === id);
        assert.deepEqual([m.scheduled, m.taken, m.percent], [3, 2, 67]);
        assert.equal(r.on_time, 1);
        // أيام خارج فترة الدواء لا جرعات فيها؛ الشريط يضم كل أيام الفترة
        assert.equal(r.daily.length, 7);
        await pool.query("DELETE FROM medications WHERE id = $1", [id]);
    });

    test("private medicines are left out for the doctor", async () => {
        const med = await pool.query(
            `INSERT INTO medications (member_id, name, start_date, end_date, is_private)
             VALUES ($1, 'دواء خاص', CURRENT_DATE - 2, CURRENT_DATE - 1, TRUE) RETURNING id`,
            [memberId]
        );
        await pool.query("INSERT INTO dose_schedules (medication_id, time_of_day, days_of_week) VALUES ($1, '08:00', '1234567')", [med.rows[0].id]);
        const owner = await adherence(pool, memberId, 7);
        const doctor = await adherence(pool, memberId, 7, { includePrivate: false });
        assert.ok(owner.medications.some((x) => x.id === med.rows[0].id));
        assert.ok(!doctor.medications.some((x) => x.id === med.rows[0].id));
        await pool.query("DELETE FROM medications WHERE id = $1", [med.rows[0].id]);
    });

    test("an allergy added later flags medicines already taken", async () => {
        const med = await pool.query(
            "INSERT INTO medications (member_id, name, start_date) VALUES ($1, 'BRUFEN', CURRENT_DATE) RETURNING id",
            [memberId]
        );
        await pool.query("INSERT INTO medication_ingredients (medication_id, ingredient_id) VALUES ($1, $2)", [med.rows[0].id, ing.IBUPROFEN]);
        await replaceAllergies(pool, memberId, [{ class_id: cls.M01A, severity: "severe" }]);
        const result = await memberConflicts(pool, memberId, "اختبار");
        assert.equal(result.medications.length, 1);
        assert.equal(result.medications[0].conflicts[0].level, "class");
    });

    // ---------- تقدّم الكورس ----------
    // كل كورس هنا: جرعة يومياً ٨:٠٠. الأيام نسبةً إلى اليوم (٠ = اليوم)،
    // والفحوص لا تعتمد على ساعة التشغيل: جرعة اليوم قد تكون مرّت أو لا

    /** كورس من start إلى end، مع جرعات مأخوذة في الأيام taken */
    async function course(start, end, taken = [], extra = "") {
        const med = await pool.query(
            `INSERT INTO medications (member_id, name, start_date, end_date)
             VALUES ($1, 'كورس اختبار', CURRENT_DATE + $2::int, ${end === null ? "NULL" : "CURRENT_DATE + $3::int"})
             RETURNING id`,
            end === null ? [memberId, start] : [memberId, start, end]
        );
        const id = med.rows[0].id;
        await pool.query("INSERT INTO dose_schedules (medication_id, time_of_day, days_of_week) VALUES ($1, '08:00', '1234567')", [id]);
        for (const d of taken) {
            await pool.query(
                `INSERT INTO dose_logs (medication_id, scheduled_at, confirmed_at, status)
                 VALUES ($1, (CURRENT_DATE + $2::int) + time '08:00', (CURRENT_DATE + $2::int) + time '08:05', 'taken')`,
                [id, d]
            );
        }
        if (extra) await pool.query(`UPDATE medications SET ${extra} WHERE id = $1`, [id]);
        return id;
    }

    const progressOf = async (id) => (await courses(pool, { medicationIds: [id] })).get(id)?.course;
    const drop = (id) => pool.query("DELETE FROM medications WHERE id = $1", [id]);

    test("a course shows its day, planned and taken doses", async () => {
        const id = await course(-2, 4, [-2, -1]);       // ٧ أيام، اليوم الثالث
        const c = await progressOf(id);
        assert.deepEqual(
            [c.status, c.day, c.total_days, c.planned, c.taken, c.days_left, c.at_risk],
            ["active", 3, 7, 7, 2, 4, false]
        );
        await drop(id);
    });

    test("two missed doses in a row put the course at risk", async () => {
        const id = await course(-3, 3, [-3]);           // أمس وما قبله فاتتا
        assert.equal((await progressOf(id)).at_risk, true);
        await drop(id);
    });

    test("the last day of a course is flagged", async () => {
        const id = await course(-4, 0, [-4, -3, -2, -1]);
        const c = await progressOf(id);
        assert.deepEqual([c.final_day, c.days_left, c.day, c.total_days], [true, 0, 5, 5]);
        await drop(id);
    });

    test("stopping before the end is recorded as stopped early", async () => {
        // ٨ أيام؛ أُوقف أمس (اليوم الرابع) لأنه شعر بتحسّن
        const id = await course(-4, 3, [-4, -3, -2],
            "is_active = FALSE, stopped_on = CURRENT_DATE - 1, stop_reason = 'felt_better'");
        const c = await progressOf(id);
        assert.deepEqual(
            [c.status, c.day, c.planned, c.taken, c.due, c.missed, c.remaining, c.at_risk],
            ["stopped_early", 4, 8, 3, 4, 1, 4, false]
        );
        assert.equal(c.stop_reason_label, "شعر بتحسّن");
        await drop(id);
    });

    test("a finished course is completed", async () => {
        const id = await course(-7, -1, [-7, -6, -5, -4, -3, -2, -1]);
        const c = await progressOf(id);
        assert.deepEqual([c.status, c.percent, c.days_since_end, c.days_left], ["completed", 100, 1, 0]);
        await drop(id);
    });

    test("an ongoing medicine is not a course", async () => {
        const id = await course(-3, null);
        assert.equal(await progressOf(id), undefined);
        await drop(id);
    });

    test("adherence stops counting on the day a medicine was stopped", async () => {
        // مستمر من خمسة أيام، أُوقف قبل ثلاثة: ٣ جرعات مستحقة فقط
        const id = await course(-5, null, [], "is_active = FALSE, stopped_on = CURRENT_DATE - 3");
        const r = await adherence(pool, memberId, 7);
        assert.equal(r.medications.find((x) => x.id === id).scheduled, 3);
        await drop(id);
    });
});
