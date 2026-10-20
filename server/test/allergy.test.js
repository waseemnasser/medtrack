// اختبارات فحص الحساسية — تشغيلها: npm test (من مجلد server)
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
});
