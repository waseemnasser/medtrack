// مطابقة أسماء الأدوية بين العربية والإنجليزية.
// الكتالوغ بالإنجليزية فقط («PARACETAMOL»)، والمستخدم يكتب «باراسيتامول».
// الحل: نختصر الاسمين إلى «هيكل الأصوات» — الحروف الساكنة فقط، وكل
// حرفين ينطقان متقاربين يصيران حرفاً واحداً (ب/P، ف/V، ك/C/Q...):
//   باراسيتامول → brstml      PARACETAMOL → brstml
// تُستخدم في: البحث بالعربية، وفحص الحساسية عند إضافة دواء
// (بالمادة الفعّالة لا بالاسم التجاري — انظر brandIngredients).

const pool = require("./db");

// ---------- هيكل الأصوات ----------

const AR = {
    "ب": "b", "پ": "b", "ت": "t", "ث": "t", "ط": "t", "د": "d", "ض": "d", "ذ": "s", "ظ": "s",
    "ج": "g", "غ": "g", "ق": "k", "ك": "k", "خ": "k", "ر": "r", "ز": "s", "س": "s", "ص": "s",
    "ش": "s", "ف": "f", "ڤ": "f", "ل": "l", "م": "m", "ن": "n",
    // أحرف العلّة والهمزات والهاء: تُحذف كما تُحذف الحروف الصائتة في الإنجليزية
};

function arabicSkeleton(word) {
    let out = "";
    for (const ch of word) out += AR[ch] || "";
    return collapse(out);
}

function latinSkeleton(word) {
    let w = word.toLowerCase().replace(/[^a-z]/g, "");
    w = w
        .replace(/ph/g, "f")
        .replace(/th/g, "t")
        .replace(/(ch|sh)/g, "s")
        .replace(/ck/g, "k")
        .replace(/c(?=[eiy])/g, "s")
        .replace(/x/g, "ks")
        .replace(/[cq]/g, "k")
        .replace(/[pb]/g, "b")
        .replace(/[vf]/g, "f")
        .replace(/[zs]/g, "s")
        .replace(/[jg]/g, "g")
        .replace(/[aeiouyhw]/g, "");
    return collapse(w);
}

// «ll» و«ss» حرف واحد: أموكسيسيلين ↔ AMOXICILLIN
const collapse = (s) => s.replace(/(.)\1+/g, "$1");

const hasArabic = (s) => /[؀-ۿ]/.test(s);

function skeleton(word) {
    return hasArabic(word) ? arabicSkeleton(word) : latinSkeleton(word);
}

// كلمات الاسم (للمطابقة من بداية أي كلمة: «AMOXICILLIN + CLAVULANIC»)
const words = (text) => String(text || "").split(/[^A-Za-z؀-ۿ]+/).filter((w) => w.length >= 3);

// ---------- البحث في الكتالوغ بالعربية ----------

let catalog = null; // يُحمَّل مرة واحدة عند أول بحث عربي — ~٧٠٠٠ صف

async function loadCatalog() {
    if (catalog) return catalog;
    const rows = (await pool.query(
        "SELECT id, brand_name, name_ar, active_ingredient, strength, form FROM medicines_catalog"
    )).rows;
    catalog = rows.map((r) => ({
        row: r,
        brand: words(r.brand_name).map(latinSkeleton),
        ingredient: words(r.active_ingredient).map(latinSkeleton),
    }));
    return catalog;
}

// ---------- من الاسم التجاري إلى المادة الفعّالة ----------
// الدواء نفسه تصنعه شركات كثيرة بأسماء تجارية مختلفة (ASITAMOL و ACETALGIN
// كلاهما PARACETAMOL). لذلك نقارن المواد الفعّالة لا الأسماء.

// «AMLODIPINE+ATORVASTATIN» ← ["AMLODIPINE", "ATORVASTATIN"]
const splitIngredients = (text) => String(text || "")
    .toUpperCase()
    .split(/\s*[+/&،,]\s*|\s+AND\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s.length >= 3);

// كل المواد الفعّالة المفردة في الكتالوغ (~٧٠٠)، مع هيكل أصوات كلمتها الأولى
let ingredientIndex = null;

async function loadIngredients() {
    if (ingredientIndex) return ingredientIndex;
    const names = new Set();
    for (const it of await loadCatalog()) splitIngredients(it.row.active_ingredient).forEach((n) => names.add(n));
    ingredientIndex = [...names].map((name) => ({ name, first: words(name)[0] || name, sk: latinSkeleton(words(name)[0] || name) }));
    return ingredientIndex;
}

// هل الكلمة اسم مادة فعّالة؟ «باراسيتامول» ← PARACETAMOL
// نتحقق من هذا قبل الأسماء التجارية: منتج اسمه «PARACETAMOL + CAFFEINE»
// لا يجعل حساسية الباراسيتامول حساسيةً من الكافيين.
async function ingredientByName(term) {
    const list = await loadIngredients();
    if (hasArabic(term)) {
        const compact = term.replace(/\s+/g, "");
        const sk = arabicSkeleton(compact);
        if (sk.length < 4) return null;
        const spelled = roughLatin(compact);
        const scored = list
            .filter((i) => i.sk === sk)
            .map((i) => ({ i, near: distance(spelled, looseLatin(i.first)) }))
            .sort((a, b) => a.near - b.near || a.i.name.length - b.i.name.length);
        if (!scored.length || scored[0].near > Math.max(2, spelled.length / 3)) return null;
        return scored[0].i.name;
    }
    const T = term.toUpperCase().replace(/\s+/g, " ").trim();
    const exact = list.find((i) => i.name === T) || list.find((i) => i.first === T);
    return exact ? exact.name : null;
}

/**
 * يبحث عن اسم تجاري في الكتالوغ ويُرجع مواده الفعّالة.
 * بالإنجليزية: تطابق تام مع الاسم أو كلمته الأولى («ASIAPROFEN» ← «ASIAPROFEN 400»).
 * بالعربية: نفس هيكل الأصوات للكلمة الأولى، والأقرب كتابةً فقط.
 * يُرجع { brand, ingredients } أو null.
 */
async function brandIngredients(name) {
    const term = String(name || "").trim();
    if (term.length < 3) return null;

    // اسم مادة فعّالة لا اسم تجاري: هي وحدها، بلا شركائها في المنتجات المركّبة
    const asIngredient = await ingredientByName(term);
    if (asIngredient) return { brand: null, ingredients: [asIngredient] };

    const rows = await loadCatalog();
    let hits;

    if (hasArabic(term)) {
        const compact = term.replace(/\s+/g, "");
        const sk = arabicSkeleton(compact);
        if (sk.length < 3) return null;
        const spelled = roughLatin(compact);
        const scored = rows
            .filter((it) => it.brand[0] === sk)
            .map((it) => ({ it, near: distance(spelled, looseLatin(words(it.row.brand_name)[0] || "")) }));
        if (!scored.length) return null;
        const best = Math.min(...scored.map((x) => x.near));
        // كتابة بعيدة جداً عن أي اسم = ليس اسماً تجارياً نعرفه
        if (best > Math.max(2, spelled.length / 3)) return null;
        hits = scored.filter((x) => x.near === best).map((x) => x.it.row);
    } else {
        const T = term.toUpperCase().replace(/\s+/g, " ");
        hits = rows.map((it) => it.row).filter((r) => {
            const b = r.brand_name.toUpperCase().trim();
            return b === T || words(b)[0] === T;
        });
    }
    if (!hits.length) return null;

    const ingredients = [...new Set(hits.flatMap((r) => splitIngredients(r.active_ingredient)))];
    return { brand: hits[0].brand_name, ingredients };
}

// المواد الفعّالة للدواء الذي يُضاف: من الكتالوغ إن اختير منه،
// وإلا مما كتبه المستخدم، وإلا من اسمه التجاري.
async function medIngredients(med) {
    if (med.catalog_id && Number(med.catalog_id)) {
        const rows = await loadCatalog();
        const hit = rows.find((it) => it.row.id === Number(med.catalog_id));
        if (hit) return splitIngredients(hit.row.active_ingredient);
    }
    if (med.active_ingredient && String(med.active_ingredient).trim()) {
        return splitIngredients(med.active_ingredient);
    }
    const byBrand = await brandIngredients(med.name);
    return byBrand ? byBrand.ingredients : [];
}

// كتابة لاتينية تقريبية مع الحروف الصائتة — لترتيب النتائج المتشابهة في الهيكل:
// «أسبرين» ← «asbrin» أقرب إلى ASPIRIN منه إلى SPRANONE
const AR_VOWELS = { "ا": "a", "أ": "a", "إ": "i", "آ": "a", "و": "o", "ي": "i", "ى": "a" };
function roughLatin(word) {
    let out = "";
    for (const ch of word) out += AR_VOWELS[ch] ?? AR[ch] ?? "";
    return out;
}
const looseLatin = (w) => w.toLowerCase().replace(/[^a-z]/g, "")
    .replace(/ph/g, "f").replace(/c(?=[eiy])/g, "s").replace(/[cq]/g, "k").replace(/x/g, "ks")
    .replace(/p/g, "b").replace(/v/g, "f").replace(/z/g, "s").replace(/j/g, "g").replace(/e/g, "i").replace(/u/g, "o")
    .replace(/(.)\1+/g, "$1");

// مسافة التعديل بين كلمتين (Levenshtein)
function distance(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        let prev = row[0];
        row[0] = i;
        for (let j = 1; j <= b.length; j++) {
            const tmp = row[j];
            row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
            prev = tmp;
        }
    }
    return row[b.length];
}

async function searchArabic(query, limit = 15) {
    const compact = query.replace(/\s+/g, "");
    const q = arabicSkeleton(compact);
    if (q.length < 3) return [];
    const spelled = roughLatin(compact);

    const scored = [];
    for (const item of await loadCatalog()) {
        // الاسم التجاري أولاً، ثم المادة الفعّالة
        let tier = -1, word = "";
        const bi = item.brand.findIndex((s) => s.startsWith(q));
        if (bi === 0) { tier = 0; word = words(item.row.brand_name)[0]; }
        else if (bi > 0) { tier = 1; word = words(item.row.brand_name)[bi]; }
        else {
            const ii = item.ingredient.findIndex((s) => s.startsWith(q));
            if (ii >= 0) { tier = 2; word = words(item.row.active_ingredient)[ii]; }
        }
        if (tier < 0) continue;
        // داخل نفس الدرجة: الأقرب كتابةً أولاً
        const near = distance(spelled, looseLatin(word).slice(0, spelled.length + 2));
        scored.push({ tier, near, row: item.row });
    }
    return scored
        .sort((a, b) => a.tier - b.tier || a.near - b.near || a.row.brand_name.length - b.row.brand_name.length)
        .slice(0, limit)
        .map((s) => s.row);
}

// ---------- فحص الحساسية ----------

// عائلات أدوية: من عنده حساسية من «بنسلين» يُنبَّه لـ AMOXICILLIN أيضاً.
// المفاتيح بالعربية والإنجليزية؛ القيم أجزاء تظهر في أسماء المواد الفعّالة.
const FAMILIES = [
    { names: ["بنسلين", "البنسلين", "penicillin", "penicilline"], parts: ["PENICILLIN", "CILLIN", "BENZATHINE"] },
    { names: ["سلفا", "السلفا", "سلفوناميد", "sulfa", "sulpha", "sulfonamide"], parts: ["SULFA", "SULPHA", "COTRIMOXAZOLE", "CO-TRIMOXAZOLE"] },
    { names: ["أسبرين", "اسبرين", "الأسبرين", "aspirin"], parts: ["ASPIRIN", "ACETYLSALICYLIC", "SALICYL"] },
    { names: ["سيفالوسبورين", "سيفالوسبورينات", "cephalosporin", "cephalosporins"], parts: ["CEF", "CEPH"] },
    {
        names: ["مضادات الالتهاب", "مضادات الالتهاب غير الستيروئيدية", "nsaid", "nsaids"],
        parts: ["IBUPROFEN", "DICLOFENAC", "NAPROXEN", "KETOPROFEN", "MEFENAMIC", "INDOMETHACIN",
            "PIROXICAM", "MELOXICAM", "CELECOXIB", "ETORICOXIB", "ASPIRIN", "ACETYLSALICYLIC"],
    },
    { names: ["كودئين", "كودين", "codeine"], parts: ["CODEINE"] },
    { names: ["مورفين", "المورفين", "morphine", "opioid", "opioids", "أفيونات"], parts: ["MORPHINE", "CODEINE", "TRAMADOL", "OXYCODONE", "FENTANYL", "PETHIDINE"] },
    { names: ["ماكروليد", "macrolide", "macrolides"], parts: ["THROMYCIN"] },
    { names: ["كينولون", "quinolone", "quinolones", "fluoroquinolone"], parts: ["FLOXACIN"] },
];

const normAr = (s) => s.trim().toLowerCase()
    .replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");

const allergyTerms = (allergies) => String(allergies || "")
    .split(/[،,;؛\n]|\sو(?=\S)|\sand\s/i)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);

/**
 * allergies: نص الحساسية كما كتبه المستخدم («بنسلين، ASITAMOL»)
 * med: { name, active_ingredient, catalog_id }
 * يُرجع: [{ allergy: «ASITAMOL», via: «PARACETAMOL», matched: «PARACETAMOL» }]
 *   via: المادة الفعّالة للاسم التجاري المكتوب في الحساسية (إن كان اسماً تجارياً)
 */
async function findAllergyConflicts(allergies, med) {
    const terms = allergyTerms(allergies);
    if (!terms.length) return [];

    const ingredients = await medIngredients(med);
    const haystack = `${med.name || ""} ${ingredients.join(" ")}`.toUpperCase();
    const medWords = words(haystack);
    const medSkeletons = medWords.map(latinSkeleton);

    const conflicts = [];
    for (const term of terms) {
        const family = FAMILIES.find((f) => f.names.some((n) => normAr(n) === normAr(term)));
        let matched = null, via = null;

        // ١. عائلة أدوية: «بنسلين» ← كل ما ينتهي بـ CILLIN
        if (family) {
            const part = family.parts.find((p) => haystack.includes(p));
            if (part) matched = medWords.find((w) => w.includes(part)) || part;
        }

        // ٢. اسم تجاري: نقارن مادته الفعّالة بمواد الدواء الجديد
        if (!matched && !family) {
            const brand = await brandIngredients(term);
            if (brand) {
                const shared = brand.ingredients.find((i) => ingredients.includes(i));
                if (shared) {
                    matched = shared;
                    // نذكر المادة الفعّالة فقط إن كتب المستخدم اسماً تجارياً
                    if (brand.brand) via = brand.ingredients.join(" + ");
                }
            }
        }

        // ٣. اسم مادة فعّالة مكتوب مباشرة (بالإنجليزية أو بالعربية بالصوت)
        if (!matched && !hasArabic(term)) {
            matched = medWords.find((w) => w.includes(term.toUpperCase())) || null;
        }
        if (!matched) {
            // «أموكسيسيلين» في الحساسية ↔ AMOXICILLIN في الدواء
            const sk = skeleton(term.replace(/\s+/g, ""));
            if (sk.length >= 4) {
                const i = medSkeletons.findIndex((s) => s.startsWith(sk) || sk.startsWith(s) && s.length >= 4);
                if (i >= 0) matched = medWords[i];
            }
        }
        if (matched) conflicts.push({ allergy: term, via, matched });
    }
    return conflicts;
}

/**
 * لنموذج الفرد: كيف سيُفهم كل بند في الحساسية؟
 * يُرجع [{ term, kind: "family" | "ingredient" | "brand" | "text", ingredients? }]
 */
async function explainAllergies(allergies) {
    const out = [];
    for (const term of allergyTerms(allergies)) {
        if (FAMILIES.some((f) => f.names.some((n) => normAr(n) === normAr(term)))) {
            out.push({ term, kind: "family" });
            continue;
        }
        const brand = await brandIngredients(term);
        if (!brand) out.push({ term, kind: "text" });
        else out.push({ term, kind: brand.brand ? "brand" : "ingredient", ingredients: brand.ingredients });
    }
    return out;
}

module.exports = { searchArabic, findAllergyConflicts, explainAllergies, skeleton, hasArabic };
