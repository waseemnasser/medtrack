// مطابقة أسماء الأدوية بين العربية والإنجليزية.
// الكتالوغ بالإنجليزية فقط («PARACETAMOL»)، والمستخدم يكتب «باراسيتامول».
// الحل: نختصر الاسمين إلى «هيكل الأصوات» — الحروف الساكنة فقط، وكل
// حرفين ينطقان متقاربين يصيران حرفاً واحداً (ب/P، ف/V، ك/C/Q...):
//   باراسيتامول → brstml      PARACETAMOL → brstml
// تُستخدم في: البحث بالعربية، وفحص الحساسية عند إضافة دواء.

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
        "SELECT id, brand_name, active_ingredient, strength, form FROM medicines_catalog"
    )).rows;
    catalog = rows.map((r) => ({
        row: r,
        brand: words(r.brand_name).map(latinSkeleton),
        ingredient: words(r.active_ingredient).map(latinSkeleton),
    }));
    return catalog;
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

/**
 * allergies: نص الحساسية كما كتبه المستخدم («بنسلين، سلفا»)
 * med: { name, active_ingredient }
 * يُرجع: [{ allergy: «بنسلين», matched: «AMOXICILLIN» }]
 */
function findAllergyConflicts(allergies, med) {
    if (!allergies) return [];
    const terms = String(allergies).split(/[،,;؛\n]|\sو(?=\S)|\sand\s/i).map((t) => t.trim()).filter((t) => t.length >= 3);
    const haystack = `${med.name || ""} ${med.active_ingredient || ""}`.toUpperCase();
    const medWords = words(haystack);
    const medSkeletons = medWords.map(latinSkeleton);

    const conflicts = [];
    for (const term of terms) {
        const family = FAMILIES.find((f) => f.names.some((n) => normAr(n) === normAr(term)));
        let matched = null;

        if (family) {
            const part = family.parts.find((p) => haystack.includes(p));
            if (part) matched = medWords.find((w) => w.includes(part)) || part;
        }
        if (!matched && !hasArabic(term)) {
            matched = medWords.find((w) => w.includes(term.toUpperCase())) || null;
        }
        if (!matched) {
            // بالصوت: «أموكسيسيلين» في الحساسية ↔ AMOXICILLIN في الدواء
            const sk = skeleton(term.replace(/\s+/g, ""));
            if (sk.length >= 4) {
                const i = medSkeletons.findIndex((s) => s.startsWith(sk) || sk.startsWith(s) && s.length >= 4);
                if (i >= 0) matched = medWords[i];
            }
        }
        if (matched) conflicts.push({ allergy: term, matched });
    }
    return conflicts;
}

module.exports = { searchArabic, findAllergyConflicts, skeleton, hasArabic };
