// فحص الحساسية — مقارنة أرقام لا أسماء
// ----------------------------------------------------------------
// حساسية الفرد صفوف منظّمة (member_allergies): كل صف يشير إلى مادة فعّالة
// أو عائلة أدوية. والدواء مربوط بموادّه (catalog_ingredients أو
// medication_ingredients). الفحص إذن تقاطع مجموعات — لا تخمين ولا إملاء.
//
// مستويات التعارض، من الأخطر:
//   direct  — الدواء يحتوي المادة نفسها
//   class   — الحساسية من العائلة كلها، والدواء منها
//   family  — الحساسية من مادة، والدواء من عائلتها (تحسّس متصالب)
//   cross   — عائلتان مختلفتان بينهما تحسّس متصالب معروف (خطر أقل)
//
// ما لا يمكن فحصه يُقال صراحة: حساسية مكتوبة نصاً لم نجدها، أو دواء
// بلا مواد معروفة. الصمت هنا أخطر من التنبيه.

const { ingredientsByExactName, normName } = require("./ingredients");
const { CLASSES } = require("./drugClasses");

const SEVERITIES = ["mild", "severe", "unknown"];
const LEVEL_RANK = { direct: 0, class: 1, family: 2, cross: 3 };

const TABLES = [
    `CREATE TABLE IF NOT EXISTS member_allergies (
        id SERIAL PRIMARY KEY,
        member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
        ingredient_id INTEGER REFERENCES ingredients(id),
        class_id INTEGER REFERENCES drug_classes(id),
        note TEXT,
        reaction TEXT,
        severity TEXT NOT NULL DEFAULT 'unknown' CHECK (severity IN ('mild', 'severe', 'unknown')),
        created_at TIMESTAMP NOT NULL DEFAULT now(),
        CHECK (ingredient_id IS NOT NULL OR class_id IS NOT NULL OR note IS NOT NULL)
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS member_allergies_ingredient ON member_allergies (member_id, ingredient_id) WHERE ingredient_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS member_allergies_class ON member_allergies (member_id, class_id) WHERE class_id IS NOT NULL`,
    // كل «الطبيب يعلم — أضفه»: من أكّد، ومتى، وعلى أي تعارض
    `CREATE TABLE IF NOT EXISTS allergy_overrides (
        id SERIAL PRIMARY KEY,
        medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL,
        conflicts JSONB NOT NULL,
        confirmed_at TIMESTAMP NOT NULL DEFAULT now()
    )`,
];

async function setupAllergyTables(pool) {
    for (const sql of TABLES) await pool.query(sql);
    await migrateTextAllergies(pool);
}

// ---------- حساسية الفرد ----------

const ALLERGY_SELECT = `
    SELECT a.id, a.ingredient_id, a.class_id, a.note, a.reaction, a.severity,
           i.name AS ingredient_name, i.name_ar AS ingredient_name_ar,
           c.code AS class_code, c.name AS class_name, c.name_ar AS class_name_ar
    FROM member_allergies a
    LEFT JOIN ingredients i ON i.id = a.ingredient_id
    LEFT JOIN drug_classes c ON c.id = a.class_id`;

// النص الذي يُعرض للبند: «البنسلينات»، «IBUPROFEN»، أو النص كما كُتب
const allergyLabel = (a) =>
    a.class_name_ar || (a.ingredient_name ? (a.ingredient_name_ar || a.ingredient_name) : a.note);

async function listAllergies(pool, memberId) {
    const { rows } = await pool.query(`${ALLERGY_SELECT} WHERE a.member_id = $1 ORDER BY a.id`, [memberId]);
    return rows.map((a) => ({
        ...a,
        kind: a.class_id ? "class" : a.ingredient_id ? "ingredient" : "note",
        label: allergyLabel(a),
        checked: Boolean(a.class_id || a.ingredient_id),
    }));
}

// members.allergies يبقى ملخّصاً نصياً للعرض (القوائم، صفحة الطبيب)
async function refreshSummary(client, memberId) {
    const list = await listAllergies(client, memberId);
    const text = list.map((a) => a.label).join("، ") || null;
    await client.query("UPDATE members SET allergies = $1 WHERE id = $2", [text, memberId]);
}

/**
 * يستبدل حساسية الفرد كلها بالقائمة الجديدة.
 * items: [{ ingredient_id? , class_id?, note?, reaction?, severity? }]
 */
async function replaceAllergies(pool, memberId, items) {
    const clean = [];
    const seen = new Set();
    for (const it of Array.isArray(items) ? items : []) {
        const ingredient = Number(it.ingredient_id) || null;
        const cls = ingredient ? null : Number(it.class_id) || null;
        const note = ingredient || cls ? null : String(it.note || "").trim().slice(0, 120) || null;
        if (!ingredient && !cls && !note) continue;
        const key = ingredient ? `i${ingredient}` : cls ? `c${cls}` : `n${normName(note)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        clean.push({
            ingredient, cls, note,
            reaction: String(it.reaction || "").trim().slice(0, 120) || null,
            severity: SEVERITIES.includes(it.severity) ? it.severity : "unknown",
        });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query("DELETE FROM member_allergies WHERE member_id = $1", [memberId]);
        for (const a of clean) {
            await client.query(
                `INSERT INTO member_allergies (member_id, ingredient_id, class_id, note, reaction, severity)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [memberId, a.ingredient, a.cls, a.note, a.reaction, a.severity]
            );
        }
        await refreshSummary(client, memberId);
        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

// ---------- مواد الدواء ----------

/** مواد دواء قبل حفظه: من الكتالوغ إن اختير منه، وإلا ما اختاره المستخدم */
async function ingredientsForDraft(pool, { catalog_id, ingredient_ids }) {
    if (Number(catalog_id)) {
        const { rows } = await pool.query(
            "SELECT ingredient_id FROM catalog_ingredients WHERE catalog_id = $1", [Number(catalog_id)]
        );
        return rows.map((r) => r.ingredient_id);
    }
    const ids = (Array.isArray(ingredient_ids) ? ingredient_ids : String(ingredient_ids || "").split(","))
        .map(Number).filter(Boolean);
    if (!ids.length) return [];
    const { rows } = await pool.query("SELECT id FROM ingredients WHERE id = ANY($1::int[])", [ids]);
    return rows.map((r) => r.id);
}

async function saveMedicationIngredients(client, medicationId, ingredientIds) {
    await client.query("DELETE FROM medication_ingredients WHERE medication_id = $1", [medicationId]);
    if (!ingredientIds.length) return;
    await client.query(
        `INSERT INTO medication_ingredients (medication_id, ingredient_id)
         SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
        [medicationId, ingredientIds]
    );
}

// ---------- الفحص ----------

/**
 * يفحص مجموعة مواد مقابل حساسية فرد.
 * يُرجع { conflicts: [...], unchecked: [حساسية مكتوبة نصاً لم تُفحص] }
 */
async function checkIngredients(pool, memberId, ingredientIds) {
    const allergies = await listAllergies(pool, memberId);
    const unchecked = allergies.filter((a) => !a.checked).map((a) => a.label);
    if (!ingredientIds.length || !allergies.some((a) => a.checked)) return { conflicts: [], unchecked };

    const { rows } = await pool.query(
        `WITH med AS (
            SELECT i.id, i.name, i.name_ar FROM ingredients i WHERE i.id = ANY($2::int[])
        ),
        med_class AS (
            SELECT ic.ingredient_id, ic.class_id FROM ingredient_classes ic WHERE ic.ingredient_id = ANY($2::int[])
        ),
        allergy AS (
            SELECT * FROM member_allergies WHERE member_id = $1 AND (ingredient_id IS NOT NULL OR class_id IS NOT NULL)
        ),
        -- عائلات كل بند حساسية: العائلة نفسها، أو عائلات المادة
        allergy_class AS (
            SELECT a.id AS allergy_id, a.class_id FROM allergy a WHERE a.class_id IS NOT NULL
            UNION
            SELECT a.id, ic.class_id FROM allergy a JOIN ingredient_classes ic ON ic.ingredient_id = a.ingredient_id
        )
        SELECT 'direct' AS level, a.id AS allergy_id, m.id AS ingredient_id, NULL::int AS class_id, NULL AS note
        FROM allergy a JOIN med m ON m.id = a.ingredient_id
        UNION ALL
        SELECT 'class', a.id, mc.ingredient_id, a.class_id, NULL
        FROM allergy a JOIN med_class mc ON mc.class_id = a.class_id
        UNION ALL
        SELECT 'family', a.id, mc.ingredient_id, mc.class_id, NULL
        FROM allergy a
        JOIN ingredient_classes ac ON ac.ingredient_id = a.ingredient_id
        JOIN med_class mc ON mc.class_id = ac.class_id AND mc.ingredient_id <> a.ingredient_id
        UNION ALL
        SELECT 'cross', ac.allergy_id, mc.ingredient_id, x.to_class, x.note_ar
        FROM allergy_class ac
        JOIN class_cross_reactions x ON x.from_class = ac.class_id
        JOIN med_class mc ON mc.class_id = x.to_class`,
        [memberId, ingredientIds]
    );

    const byId = new Map(allergies.map((a) => [a.id, a]));
    const ingredientNames = new Map((await pool.query(
        "SELECT id, name, name_ar FROM ingredients WHERE id = ANY($1::int[])", [ingredientIds]
    )).rows.map((r) => [r.id, r]));
    const classNames = new Map((await pool.query("SELECT id, name_ar FROM drug_classes")).rows.map((r) => [r.id, r.name_ar]));

    // تعارض واحد لكل (بند حساسية، مادة) — الأخطر فقط
    const best = new Map();
    for (const r of rows) {
        const key = `${r.allergy_id}:${r.ingredient_id}`;
        const prev = best.get(key);
        if (!prev || LEVEL_RANK[r.level] < LEVEL_RANK[prev.level]) best.set(key, r);
    }

    const conflicts = [...best.values()]
        .map((r) => {
            const a = byId.get(r.allergy_id);
            const ing = ingredientNames.get(r.ingredient_id);
            return {
                level: r.level,
                allergy_id: a.id,
                allergy: a.label,
                severity: a.severity,
                reaction: a.reaction,
                ingredient: ing.name,
                ingredient_ar: ing.name_ar,
                class_name: r.class_id ? classNames.get(r.class_id) : null,
                note: r.note,
            };
        })
        .sort((x, y) => LEVEL_RANK[x.level] - LEVEL_RANK[y.level] || (y.severity === "severe") - (x.severity === "severe"));

    return { conflicts, unchecked };
}

/** جملة عربية واحدة لكل تعارض — للتحذير والحوار */
function describeConflict(c, memberName) {
    const ing = c.ingredient_ar ? `${c.ingredient_ar} (${c.ingredient})` : c.ingredient;
    const sev = c.severity === "severe" ? " شديدة" : "";
    switch (c.level) {
        case "direct":
            return `عند ${memberName} حساسية${sev} من ${c.allergy}، وهذا الدواء يحتوي عليه.`;
        case "class":
            return `عند ${memberName} حساسية${sev} من ${c.allergy}، وهذا الدواء يحتوي ${ing} منها.`;
        case "family":
            return `عند ${memberName} حساسية${sev} من ${c.allergy}، وهذا الدواء يحتوي ${ing} من العائلة نفسها (${c.class_name}).`;
        default:
            return `عند ${memberName} حساسية من ${c.allergy}، وهذا الدواء يحتوي ${ing}: ${c.note}.`;
    }
}

/** كل أدوية الفرد النشطة مقابل حساسيته — للفحص في الاتجاه المعاكس */
async function memberConflicts(pool, memberId, memberName) {
    const meds = (await pool.query(
        `SELECT m.id, m.name, COALESCE(array_agg(mi.ingredient_id) FILTER (WHERE mi.ingredient_id IS NOT NULL), '{}') AS ingredients
         FROM medications m LEFT JOIN medication_ingredients mi ON mi.medication_id = m.id
         WHERE m.member_id = $1 AND m.is_active IS NOT FALSE
         GROUP BY m.id ORDER BY m.id`,
        [memberId]
    )).rows;

    const result = { medications: [], unknown_ingredients: [] };
    for (const m of meds) {
        if (!m.ingredients.length) {
            result.unknown_ingredients.push({ id: m.id, name: m.name });
            continue;
        }
        const { conflicts } = await checkIngredients(pool, memberId, m.ingredients);
        if (conflicts.length) {
            result.medications.push({
                id: m.id,
                name: m.name,
                conflicts: conflicts.map((c) => ({ ...c, message: describeConflict(c, memberName) })),
            });
        }
    }
    return result;
}

// ---------- البحث عن مسبّب حساسية أو مادة ----------

const AR_NORM_SQL = (col) => `translate(${col}, 'أإآىة', 'ااايه')`;
const normAr = (s) => s.replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/[ً-ْ]/g, "");
const escapeLike = (s) => s.replace(/[\\%_]/g, (c) => "\\" + c);
const isArabic = (s) => /[؀-ۿ]/.test(s);

/**
 * يبحث في العائلات والمواد والأسماء التجارية معاً.
 * types: أي من «class»، «ingredient»، «brand»
 */
async function searchAllergens(pool, query, types = ["class", "ingredient", "brand"]) {
    const q = String(query || "").trim();
    if (q.length < 2) return [];
    const arabic = isArabic(q);
    const term = escapeLike(arabic ? normAr(q) : q.toUpperCase());
    const out = [];

    if (types.includes("class")) {
        const nq = arabic ? normAr(q) : q.toLowerCase();
        for (const c of CLASSES) {
            const hay = [c.name_ar, c.name, ...c.aliases].map((s) => (isArabic(s) ? normAr(s) : s.toLowerCase()));
            if (hay.some((h) => h.includes(nq) || (nq.length >= 3 && nq.includes(h)))) {
                const row = (await pool.query("SELECT id FROM drug_classes WHERE code = $1", [c.code])).rows[0];
                if (row) out.push({ type: "class", id: row.id, name: c.name, name_ar: c.name_ar });
            }
        }
    }

    if (types.includes("ingredient")) {
        const { rows } = await pool.query(
            arabic
                ? `SELECT id, name, name_ar FROM ingredients
                   WHERE ${AR_NORM_SQL("name_ar")} LIKE $1 || '%' ORDER BY length(name) LIMIT 8`
                : `SELECT id, name, name_ar FROM ingredients
                   WHERE name LIKE $1 || '%' OR name LIKE '% ' || $1 || '%' ORDER BY (name LIKE $1 || '%') DESC, length(name) LIMIT 8`,
            [term]
        );
        out.push(...rows.map((r) => ({ type: "ingredient", ...r })));
        // بالعربية بلا اسم عربي مسجّل: بالصوت («أموكسيسيلين» ← AMOXICILLIN)
        if (arabic && rows.length < 3) {
            const { skeleton } = require("./drugmatch");
            const sk = skeleton(q.replace(/\s+/g, ""));
            if (sk.length >= 4) {
                const all = (await pool.query("SELECT id, name, name_ar FROM ingredients")).rows;
                const seen = new Set(rows.map((r) => r.id));
                for (const r of all) {
                    if (seen.has(r.id)) continue;
                    const s = skeleton(r.name.split(" ")[0]);
                    if (s.startsWith(sk) || (sk.startsWith(s) && s.length >= 5)) out.push({ type: "ingredient", ...r });
                    if (out.filter((x) => x.type === "ingredient").length >= 8) break;
                }
            }
        }
    }

    if (types.includes("brand")) {
        const { rows } = await pool.query(
            `SELECT c.brand_name, MIN(c.name_ar) AS name_ar,
                    json_agg(DISTINCT jsonb_build_object('id', i.id, 'name', i.name, 'name_ar', i.name_ar)) AS ingredients
             FROM medicines_catalog c
             JOIN catalog_ingredients ci ON ci.catalog_id = c.id
             JOIN ingredients i ON i.id = ci.ingredient_id
             WHERE ${arabic ? `${AR_NORM_SQL("c.name_ar")} LIKE $1 || '%'` : "upper(c.brand_name) LIKE $1 || '%'"}
             GROUP BY c.brand_name ORDER BY length(c.brand_name) LIMIT 6`,
            [term]
        );
        out.push(...rows.map((r) => ({ type: "brand", ...r })));
    }
    return out;
}

// ---------- ترحيل الحساسية النصية القديمة ----------

// members.allergies كان نصاً حراً («بنسلين، ASITAMOL»). نحوّله مرة واحدة
// بتطابق تام فقط: عائلة، أو مادة، أو اسم تجاري. ما لا يُعرف يبقى «نصاً غير مفحوص»
// يراه المستخدم ويصحّحه — لا نخمّن في أمر يخص السلامة.
async function migrateTextAllergies(pool) {
    const members = (await pool.query(
        `SELECT id, allergies FROM members m
         WHERE allergies IS NOT NULL AND trim(allergies) <> ''
           AND NOT EXISTS (SELECT 1 FROM member_allergies a WHERE a.member_id = m.id)`
    )).rows;

    for (const m of members) {
        const items = [];
        const terms = m.allergies.split(/[،,;؛\n]|\sو(?=\S)|\sand\s/i).map((t) => t.trim()).filter((t) => t.length >= 2);
        for (const term of terms) {
            const n = normAr(term).toLowerCase();
            const cls = CLASSES.find((c) => [c.name_ar, c.name, ...c.aliases]
                .some((a) => (isArabic(a) ? normAr(a) : a.toLowerCase()) === n || normAr(a).replace(/^ال/, "") === n.replace(/^ال/, "")));
            if (cls) {
                const row = (await pool.query("SELECT id FROM drug_classes WHERE code = $1", [cls.code])).rows[0];
                if (row) { items.push({ class_id: row.id }); continue; }
            }
            const ids = await ingredientsByExactName(pool, term);
            if (ids.length) ids.forEach((id) => items.push({ ingredient_id: id }));
            else items.push({ note: term });
        }
        if (items.length) await replaceAllergies(pool, m.id, items);
    }
}

module.exports = {
    setupAllergyTables, listAllergies, replaceAllergies,
    ingredientsForDraft, saveMedicationIngredients,
    checkIngredients, describeConflict, memberConflicts, searchAllergens,
};
