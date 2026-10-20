const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");
const { estimateSupply, findRefills, todayStr } = require("../supply");
const {
    ingredientsForDraft, saveMedicationIngredients, checkIngredients,
    describeConflict, listAllergies,
} = require("../allergy");
const { ingredientsByExactName } = require("../ingredients");

const router = express.Router();
router.use(auth);

// التأكد إن الفرد يتبع للمستخدم الحالي
async function ownsMember(memberId, userId) {
    const r = await pool.query(
        "SELECT id FROM members WHERE id = $1 AND user_id = $2",
        [memberId, userId]
    );
    return r.rows.length > 0;
}

// ---------- فحص الحساسية ----------
// مواد الدواء ← تقاطعها مع حساسية الفرد (allergy.js). لا أسماء ولا تخمين.

async function memberName(memberId) {
    const r = await pool.query("SELECT name FROM members WHERE id = $1", [memberId]);
    return r.rows[0]?.name || "";
}

/**
 * يُرجع { ingredientIds, conflicts, unchecked, needsIngredients }
 * needsIngredients: للفرد حساسية قابلة للفحص، لكن مواد الدواء غير معروفة
 */
async function allergyGate(memberId, draft) {
    let ingredientIds = await ingredientsForDraft(pool, draft);
    // دواء كُتب يدوياً بلا اختيار مواد: تطابق تام مع الاسم فقط («ميتفورمين»)
    if (!ingredientIds.length && !Number(draft.catalog_id) && draft.name) {
        ingredientIds = await ingredientsByExactName(pool, draft.name);
    }
    const name = await memberName(memberId);
    const { conflicts, unchecked } = await checkIngredients(pool, memberId, ingredientIds);
    const allergies = await listAllergies(pool, memberId);
    return {
        ingredientIds,
        conflicts: conflicts.map((c) => ({ ...c, message: describeConflict(c, name) })),
        unchecked,
        needsIngredients: !ingredientIds.length && allergies.some((a) => a.checked),
        memberName: name,
    };
}

/** رد 409 إن وُجد ما يحتاج تأكيداً صريحاً، وإلا null */
function gateResponse(gate, body) {
    if (gate.needsIngredients && !body.ingredients_unknown_confirmed) {
        return {
            code: "INGREDIENTS_UNKNOWN",
            error: `لا نعرف المادة الفعّالة لهذا الدواء، فلا يمكن فحصه مع حساسية ${gate.memberName}. اختر المادة الفعّالة، أو أكّد الحفظ دون فحص.`,
        };
    }
    if (gate.conflicts.length && !body.allergy_confirmed) {
        return { code: "ALLERGY", error: gate.conflicts[0].message, conflicts: gate.conflicts };
    }
    return null;
}

// كل تأكيد رغم التعارض يُسجَّل: من، ومتى، وعلى ماذا
async function recordOverride(client, medicationId, userId, gate) {
    if (!gate.conflicts.length && !gate.needsIngredients) return;
    await client.query(
        "INSERT INTO allergy_overrides (medication_id, user_id, conflicts) VALUES ($1, $2, $3)",
        [medicationId, userId, JSON.stringify({ conflicts: gate.conflicts, ingredients_unknown: gate.needsIngredients })]
    );
}

// نص المادة الفعّالة للعرض، من المواد المختارة إن لم يُكتب
async function ingredientText(text, ingredientIds) {
    if (text && String(text).trim()) return text;
    if (!ingredientIds.length) return null;
    const r = await pool.query("SELECT name FROM ingredients WHERE id = ANY($1::int[]) ORDER BY name", [ingredientIds]);
    return r.rows.map((x) => x.name).join("+") || null;
}

// فحص مسبق أثناء الكتابة في نموذج الدواء — لا يحفظ شيئاً
router.get("/allergy-check", async (req, res) => {
    const { member_id, name, catalog_id, ingredient_ids } = req.query;
    if (!member_id || !(await ownsMember(member_id, req.userId)))
        return res.status(403).json({ error: "غير مصرح" });
    try {
        const gate = await allergyGate(member_id, { name, catalog_id, ingredient_ids });
        res.json({
            conflict: gate.conflicts.length > 0,
            conflicts: gate.conflicts,
            error: gate.conflicts[0]?.message || null,
            unchecked: gate.unchecked,
            needs_ingredients: gate.needsIngredients,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// أدوية فرد معين مع أوقات جرعاته
router.get("/member/:memberId", async (req, res) => {
    if (!(await ownsMember(req.params.memberId, req.userId)))
        return res.status(403).json({ error: "غير مصرح" });

    const meds = await pool.query(
        "SELECT * FROM medications WHERE member_id = $1 ORDER BY id",
        [req.params.memberId]
    );

    for (const med of meds.rows) {
        const times = await pool.query(
            "SELECT id, time_of_day, days_of_week FROM dose_schedules WHERE medication_id = $1 ORDER BY time_of_day",
            [med.id]
        );
        med.schedules = times.rows;
        med.ingredients = (await pool.query(
            `SELECT i.id, i.name, i.name_ar FROM medication_ingredients mi
             JOIN ingredients i ON i.id = mi.ingredient_id WHERE mi.medication_id = $1 ORDER BY i.name`,
            [med.id]
        )).rows;
    }

    res.json(meds.rows);
});

// إضافة دواء مع أوقاته
router.post("/", async (req, res) => {
    const {
        member_id, catalog_id, name, active_ingredient, strength, form,
        instructions, start_date, end_date, units_total, units_per_dose,
        is_private, times, ingredient_ids,
    } = req.body;

    if (!member_id || !name || !start_date)
        return res.status(400).json({ error: "اسم الدواء وتاريخ البدء والفرد مطلوبين" });

    if (!(await ownsMember(member_id, req.userId)))
        return res.status(403).json({ error: "غير مصرح" });

    // حساسية معروفة أو مواد مجهولة: لا يُحفظ إلا بتأكيد صريح، ويُسجَّل التأكيد
    const gate = await allergyGate(member_id, { name, catalog_id, ingredient_ids });
    const blocked = gateResponse(gate, req.body);
    if (blocked) return res.status(409).json(blocked);
    const ingredientLabel = await ingredientText(active_ingredient, gate.ingredientIds);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const med = await client.query(
            `INSERT INTO medications
       (member_id, catalog_id, name, active_ingredient, strength, form, instructions,
        start_date, end_date, units_total, units_per_dose, is_private)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
            [member_id, catalog_id || null, name, ingredientLabel, strength || null,
                form || null, instructions || null, start_date, end_date || null,
                units_total || null, units_per_dose || 1, is_private || false]
        );

        const medication = med.rows[0];
        medication.schedules = [];
        await saveMedicationIngredients(client, medication.id, gate.ingredientIds);
        await recordOverride(client, medication.id, req.userId, gate);

        if (Array.isArray(times)) {
            for (const t of times) {
                const s = await client.query(
                    `INSERT INTO dose_schedules (medication_id, time_of_day, days_of_week)
           VALUES ($1,$2,$3) RETURNING id, time_of_day, days_of_week`,
                    [medication.id, t.time_of_day, t.days_of_week || "1234567"]
                );
                medication.schedules.push(s.rows[0]);
            }
        }

        await client.query("COMMIT");
        res.status(201).json(medication);
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// تعديل دواء مع أوقاته — الأوقات القديمة تُستبدل كلها بالجديدة.
// سجل الجرعات مربوط بالدواء لا بالموعد، فلا يضيع شيء من السجل.
router.put("/:id", async (req, res) => {
    const {
        catalog_id, name, active_ingredient, strength, form,
        instructions, start_date, end_date, units_total, units_per_dose,
        is_private, times, ingredient_ids,
    } = req.body;

    if (!name || !start_date)
        return res.status(400).json({ error: "اسم الدواء وتاريخ البدء مطلوبين" });

    const owner = await pool.query(
        `SELECT m.member_id FROM medications m JOIN members mem ON mem.id = m.member_id
       WHERE m.id = $1 AND mem.user_id = $2`,
        [req.params.id, req.userId]
    );
    if (!owner.rows.length) return res.status(404).json({ error: "الدواء غير موجود" });

    const gate = await allergyGate(owner.rows[0].member_id, { name, catalog_id, ingredient_ids });
    const blocked = gateResponse(gate, req.body);
    if (blocked) return res.status(409).json(blocked);
    const ingredientLabel = await ingredientText(active_ingredient, gate.ingredientIds);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        const med = await client.query(
            `UPDATE medications SET
         catalog_id = $1, name = $2, active_ingredient = $3, strength = $4, form = $5,
         instructions = $6, start_date = $7, end_date = $8, units_total = $9,
         units_per_dose = $10, is_private = $11
       WHERE id = $12 AND member_id IN (SELECT id FROM members WHERE user_id = $13)
       RETURNING *`,
            [catalog_id || null, name, ingredientLabel, strength || null,
                form || null, instructions || null, start_date, end_date || null,
                units_total || null, units_per_dose || 1, is_private || false,
                req.params.id, req.userId]
        );

        if (!med.rows.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "الدواء غير موجود" });
        }

        const medication = med.rows[0];
        medication.schedules = [];
        await saveMedicationIngredients(client, medication.id, gate.ingredientIds);
        await recordOverride(client, medication.id, req.userId, gate);

        if (Array.isArray(times)) {
            await client.query("DELETE FROM dose_schedules WHERE medication_id = $1", [medication.id]);
            for (const t of times) {
                const s = await client.query(
                    `INSERT INTO dose_schedules (medication_id, time_of_day, days_of_week)
           VALUES ($1,$2,$3) RETURNING id, time_of_day, days_of_week`,
                    [medication.id, t.time_of_day, t.days_of_week || "1234567"]
                );
                medication.schedules.push(s.rows[0]);
            }
        }

        await client.query("COMMIT");
        res.json(medication);
    } catch (err) {
        await client.query("ROLLBACK");
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// إيقاف دواء بدل حذفه
router.patch("/:id/stop", async (req, res) => {
    const r = await pool.query(
        `UPDATE medications SET is_active = FALSE, end_date = COALESCE(end_date, CURRENT_DATE)
     WHERE id = $1 AND member_id IN (SELECT id FROM members WHERE user_id = $2)
     RETURNING *`,
        [req.params.id, req.userId]
    );
    if (!r.rows.length) return res.status(404).json({ error: "الدواء غير موجود" });
    res.json(r.rows[0]);
});
// الأدوية التي تنفد قريباً لكل أفراد المستخدم — لقائمة صفحة اليوم
router.get("/refills", async (req, res) => {
    try {
        const list = await findRefills(req.userId);
        res.json(list.map(({ user_id, ...rest }) => rest));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// دواء واحد مع مواعيده — بشرط أن يتبع للمستخدم الحالي
async function ownedMedication(id, userId) {
    const med = await pool.query(
        `SELECT m.* FROM medications m
       JOIN members mem ON mem.id = m.member_id
       WHERE m.id = $1 AND mem.user_id = $2`,
        [id, userId]
    );
    if (!med.rows.length) return null;
    const sched = await pool.query(
        "SELECT days_of_week FROM dose_schedules WHERE medication_id = $1",
        [id]
    );
    return { medication: med.rows[0], schedules: sched.rows };
}

// متى يخلص الدواء
router.get("/:id/supply", async (req, res) => {
    try {
        const found = await ownedMedication(req.params.id, req.userId);
        if (!found) return res.status(404).json({ error: "الدواء غير موجود" });
        res.json(estimateSupply(found.medication, found.schedules));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// «جدّدت العلبة»: ما تبقّى تقديرياً + العلبة الجديدة، والعدّ يبدأ من اليوم
router.post("/:id/refill", async (req, res) => {
    const units = Number(req.body.units);
    if (!Number.isFinite(units) || units <= 0 || units > 10000)
        return res.status(400).json({ error: "أدخل عدد الوحدات في العلبة الجديدة" });

    try {
        const found = await ownedMedication(req.params.id, req.userId);
        if (!found) return res.status(404).json({ error: "الدواء غير موجود" });

        const before = estimateSupply(found.medication, found.schedules);
        const left = before.known ? before.remaining_estimate : 0;

        const updated = await pool.query(
            `UPDATE medications SET units_total = $1, supply_since = $2
       WHERE id = $3 RETURNING *`,
            [Math.round(left + units), todayStr(), req.params.id]
        );
        res.json(estimateSupply(updated.rows[0], found.schedules));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
module.exports = router;