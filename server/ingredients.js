// المواد الفعّالة كبيانات منظّمة، لا كنص.
// ----------------------------------------------------------------
// عمود active_ingredient في الكتالوغ نص حرّ: «TRAMADOL HCL»، «R.TAB. IBUPROFEN»،
// «AMLODIPINE+ATORVASTATIN». هنا نحوّله مرة واحدة إلى جدولين:
//   ingredients          — كل مادة فعّالة مرة واحدة باسمها الموحّد
//   catalog_ingredients  — أي مادة في أي دواء من الكتالوغ
// فيصير فحص الحساسية مقارنة أرقام، لا تخميناً بالأسماء.
//
// الحساسية من الدواء نفسه لا من الملح المرافق له: «DICLOFENAC SODIUM»
// و«DICLOFENAC POTASSIUM» كلاهما DICLOFENAC.

// غيّري هذا الرقم عند تعديل أي قاعدة أدناه — الخادم يعيد البناء عند التشغيل
const INGREDIENTS_VERSION = 1;

// كلمات الشكل الصيدلاني التي التصقت بأول اسم المادة في المصدر
const FORM_PREFIX = /^(G\.CAP\.?|GEL\.CAP\.|R\.TAB\.?|R\.CTD|V\.C\.BAG|P\.VIAL|I\.M\.INJ\.|DROP|OF[\d.]+ML\.)\s*/;

// الأملاح والصيغ المرافقة — تُحذف من آخر الاسم
const SALTS = new Set([
    "HCL", "HYDROCHLORIDE", "HBR", "HYDROBROMIDE", "SODIUM", "MONOSODIUM", "DISODIUM",
    "POTASSIUM", "DIPOTASSIUM", "CALCIUM", "MAGNESIUM", "MALEATE", "BESYLATE", "BESILATE",
    "MESYLATE", "MESILATE", "ACETATE", "ACETONIDE", "SULFATE", "METHYLSULFATE", "CITRATE",
    "TARTRATE", "FUMARATE", "SUCCINATE", "PHOSPHATE", "MALATE", "PAMOATE", "PROPIONATE",
    "DIPROPIONATE", "VALERATE", "FUROATE", "CHLORIDE", "BROMIDE", "ISETHIONATE", "ARGININE",
    "ARGINATE", "SALT", "AXETIL", "DIPIVOXIL", "MOFETIL", "PPM",
]);

// إن كانت الكلمة الأولى معدناً فهو المادة نفسها: «CALCIUM CARBONATE»، «ZINC SULFATE»
const CATIONS = new Set(["SODIUM", "POTASSIUM", "CALCIUM", "MAGNESIUM", "ZINC", "IRON", "FERROUS", "LITHIUM", "BISMUTH", "ALUMINIUM"]);

// أخطاء إملائية وأسماء بديلة لنفس المادة
const ALIASES = {
    "PANTOPRAZOL": "PANTOPRAZOLE",
    "TINIDAZOL": "TINIDAZOLE",
    "LETROZOL": "LETROZOLE",
    "AGOMELATIN": "AGOMELATINE",
    "ALFUZOCIN": "ALFUZOSIN",
    "MELATONINE": "MELATONIN",
    "MECOBALAMINE": "MECOBALAMIN",
    "SEVELAMIR": "SEVELAMER",
    "GLIMPERIDE": "GLIMEPIRIDE",
    "ACETYL CYSTEINE": "ACETYLCYSTEINE",
    "DICLOFENAC-K": "DICLOFENAC",
    "MG-LACTATE": "MAGNESIUM",
    "PIROXICAM-B-CYCLODEXTRIN": "PIROXICAM",
    "CHOLINE FENOFIBRATE": "FENOFIBRATE",
    "PHYTOMENADIONE VITAMIN K1": "PHYTOMENADIONE",
    "COBAMAMIDE COENZYME B12": "COBAMAMIDE",
    "ACEFYLLINE PIPERAZINE": "ACEFYLLINE",
    "SODIUM VALPROATE": "VALPROIC ACID",
    "DIVALPROEX": "VALPROIC ACID",
    "INSULIN HUMAN": "INSULIN",
    "PURIFIED WATER": "WATER",
    "WATER INJECTION": "WATER",
    "D3": "VITAMIN D3",
    "C": "ASCORBIC ACID",
    "E": "VITAMIN E",
};

// صفوف لا تحمل اسم مادة في المصدر («R.TAB»، «BILAYER»...) — صُحّحت يدوياً من اسمها التجاري
const ROW_FIXES = {
    1: ["ERGOCALCIFEROL"],                       // NEW ERGOVIT VITAMIN D2 ERGOCALCIFEROL
    782: ["GUAIFENESIN"],                        // GUAIFENESIN 30+600 ER — المادة الثانية غير مذكورة في المصدر
    783: ["DEXTROMETHORPHAN", "GUAIFENESIN"],    // HBR+GUAIFENESIN
    854: ["IBUPROFEN", "FAMOTIDINE"],            // IBUPROFEN+FAMOTIDINE ASIAPROFEN
    2326: ["BISACODYL"],                         // BISACODYL OSHAR
    5524: ["METFORMIN", "DAPAGLIFLOZIN"],        // GLIFOLONG
    5525: ["METFORMIN", "DAPAGLIFLOZIN"],
    5526: ["METFORMIN", "DAPAGLIFLOZIN"],
    5527: ["METFORMIN", "DAPAGLIFLOZIN"],
    5528: ["METFORMIN", "DAPAGLIFLOZIN"],
    5529: ["METFORMIN", "DAPAGLIFLOZIN"],
    5530: ["METFORMIN", "DAPAGLIFLOZIN"],
    5531: ["DOXYLAMINE", "VITAMIN B6"],          // ALMADOXINE
};

/** اسم مادة واحد ← اسمه الموحّد: «R.TAB. TRAMADOL HCL» ← «TRAMADOL» */
function canonical(raw) {
    let s = String(raw || "").toUpperCase().trim()
        .replace(FORM_PREFIX, "")
        .replace(/SULPH/g, "SULF")
        .replace(/\bVIT\.\s*/g, "VITAMIN ")
        .replace(/\s+/g, " ")
        .trim();
    if (!s || /^[^A-Z]/.test(s)) return null;
    if (ALIASES[s]) return ALIASES[s];

    const words = s.split(" ");
    while (words.length > 1 && SALTS.has(words[words.length - 1]) && !CATIONS.has(words[0])) words.pop();
    s = words.join(" ");
    return ALIASES[s] || s;
}

/** نص المادة كما في الكتالوغ ← قائمة أسماء موحّدة */
function parseIngredients(text) {
    const out = [];
    for (const part of String(text || "").split("+")) {
        const name = canonical(part);
        if (name && name.length >= 2 && !out.includes(name)) out.push(name);
    }
    return out;
}

// اسم المادة بالعربية من الكتالوغ نفسه: الدواء الذي يحمل اسم مادته
// («PARACETAMOL ZAIN» ← «باراسيتامول زاين») يعطينا «باراسيتامول».
function arabicNames(rows) {
    const votes = new Map();
    for (const r of rows) {
        if (!r.name_ar) continue;
        const brand = r.brand_name.toUpperCase().replace(/\s+/g, " ").trim();
        const ar = r.name_ar.trim().split(/\s+/);
        for (const name of r.ingredients) {
            if (brand !== name && !brand.startsWith(name + " ")) continue;
            const n = name.split(" ").length;
            if (ar.length < n) continue;
            const guess = ar.slice(0, n).join(" ");
            const m = votes.get(name) || new Map();
            m.set(guess, (m.get(guess) || 0) + 1);
            votes.set(name, m);
        }
    }
    const result = new Map();
    for (const [name, m] of votes) result.set(name, [...m].sort((a, b) => b[1] - a[1])[0][0]);
    return result;
}

const TABLES = [
    `CREATE TABLE IF NOT EXISTS app_meta (key TEXT PRIMARY KEY, value TEXT)`,
    `CREATE TABLE IF NOT EXISTS ingredients (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        name_ar TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS catalog_ingredients (
        catalog_id INTEGER NOT NULL REFERENCES medicines_catalog(id) ON DELETE CASCADE,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        PRIMARY KEY (catalog_id, ingredient_id)
    )`,
    // مواد كل دواء محفوظ: من الكتالوغ، أو يختارها المستخدم لدواء كتبه يدوياً
    `CREATE TABLE IF NOT EXISTS medication_ingredients (
        medication_id INTEGER NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        PRIMARY KEY (medication_id, ingredient_id)
    )`,
    `CREATE INDEX IF NOT EXISTS catalog_ingredients_ingredient ON catalog_ingredients (ingredient_id)`,
];

/**
 * يبني الجداول ويملؤها. آمن للتكرار: لا يعيد البناء إلا إن تغيّر
 * INGREDIENTS_VERSION. أرقام المواد ثابتة (تُحدَّث بالاسم)، لأن
 * حساسية الأفراد تشير إليها.
 */
async function syncIngredients(pool) {
    for (const sql of TABLES) await pool.query(sql);

    const meta = await pool.query("SELECT value FROM app_meta WHERE key = 'ingredients_version'");
    if (meta.rows[0]?.value !== String(INGREDIENTS_VERSION)) {
        await rebuildCatalogIngredients(pool);
    }
    await backfillMedications(pool);
}

async function rebuildCatalogIngredients(pool) {
    const rows = (await pool.query(
        "SELECT id, brand_name, name_ar, active_ingredient FROM medicines_catalog"
    )).rows.map((r) => ({ ...r, ingredients: ROW_FIXES[r.id] || parseIngredients(r.active_ingredient) }));

    const names = [...new Set(rows.flatMap((r) => r.ingredients))];
    const arabic = arabicNames(rows);

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `INSERT INTO ingredients (name, name_ar)
             SELECT n, a FROM unnest($1::text[], $2::text[]) AS t(n, a)
             ON CONFLICT (name) DO UPDATE SET name_ar = COALESCE(EXCLUDED.name_ar, ingredients.name_ar)`,
            [names, names.map((n) => arabic.get(n) || null)]
        );
        const ids = new Map((await client.query("SELECT id, name FROM ingredients")).rows.map((r) => [r.name, r.id]));

        await client.query("DELETE FROM catalog_ingredients");
        const catalogIds = [], ingredientIds = [];
        for (const r of rows) {
            for (const n of r.ingredients) {
                catalogIds.push(r.id);
                ingredientIds.push(ids.get(n));
            }
        }
        await client.query(
            `INSERT INTO catalog_ingredients (catalog_id, ingredient_id)
             SELECT * FROM unnest($1::int[], $2::int[]) ON CONFLICT DO NOTHING`,
            [catalogIds, ingredientIds]
        );
        await client.query(
            `INSERT INTO app_meta (key, value) VALUES ('ingredients_version', $1)
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
            [String(INGREDIENTS_VERSION)]
        );
        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

// الأدوية المحفوظة قبل هذا التحديث: نربطها بموادها مرة واحدة.
// من الكتالوغ إن كانت منه، وإلا من نص المادة الفعّالة الذي كُتب.
async function backfillMedications(pool) {
    await pool.query(
        `INSERT INTO medication_ingredients (medication_id, ingredient_id)
         SELECT m.id, ci.ingredient_id
         FROM medications m JOIN catalog_ingredients ci ON ci.catalog_id = m.catalog_id
         WHERE NOT EXISTS (SELECT 1 FROM medication_ingredients x WHERE x.medication_id = m.id)
         ON CONFLICT DO NOTHING`
    );
    const manual = (await pool.query(
        `SELECT m.id, m.active_ingredient FROM medications m
         WHERE m.active_ingredient IS NOT NULL AND m.active_ingredient <> ''
           AND NOT EXISTS (SELECT 1 FROM medication_ingredients x WHERE x.medication_id = m.id)`
    )).rows;
    for (const m of manual) {
        const names = parseIngredients(m.active_ingredient);
        if (!names.length) continue;
        await pool.query(
            `INSERT INTO medication_ingredients (medication_id, ingredient_id)
             SELECT $1, id FROM ingredients WHERE name = ANY($2::text[])
             ON CONFLICT DO NOTHING`,
            [m.id, names]
        );
    }

    // بلا نص مادة: نجرّب الاسم نفسه، بتطابق تام فقط («ميتفورمين» ← METFORMIN)
    const unnamed = (await pool.query(
        `SELECT m.id, m.name FROM medications m
         WHERE NOT EXISTS (SELECT 1 FROM medication_ingredients x WHERE x.medication_id = m.id)`
    )).rows;
    for (const m of unnamed) {
        const ids = await ingredientsByExactName(pool, m.name);
        for (const id of ids) {
            await pool.query(
                "INSERT INTO medication_ingredients (medication_id, ingredient_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
                [m.id, id]
            );
        }
    }
}

// توحيد الحروف العربية للمقارنة: «أ إ آ» ← «ا»، «ى» ← «ي»، «ة» ← «ه»
const AR_SQL = (col) => `translate(upper(trim(${col})), 'أإآىة', 'ااايه')`;
const normName = (s) => String(s || "").trim().toUpperCase()
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, " ");

/**
 * أرقام المواد لاسم مكتوب، بتطابق تام فقط — لا تخمين:
 * اسم مادة (إنجليزي أو عربي)، ثم اسم تجاري في الكتالوغ (إنجليزي أو عربي).
 */
async function ingredientsByExactName(pool, name) {
    const n = normName(name);
    if (n.length < 3) return [];
    const canon = canonical(n);

    const direct = await pool.query(
        `SELECT id FROM ingredients WHERE name = $1 OR ${AR_SQL("name_ar")} = $2`,
        [canon, n]
    );
    if (direct.rows.length) return direct.rows.map((r) => r.id);

    const byBrand = await pool.query(
        `SELECT DISTINCT ci.ingredient_id AS id
         FROM medicines_catalog c JOIN catalog_ingredients ci ON ci.catalog_id = c.id
         WHERE upper(trim(c.brand_name)) = $1 OR ${AR_SQL("c.name_ar")} = $2`,
        [n, n]
    );
    return byBrand.rows.map((r) => r.id);
}

module.exports = { syncIngredients, parseIngredients, canonical, ingredientsByExactName, normName, INGREDIENTS_VERSION };
