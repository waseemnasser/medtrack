// البحث في كتالوغ الأدوية — بالعربية أو اللاتينية.
// ----------------------------------------------------------------
// الترتيب: الاسم التجاري الذي يبدأ بما كُتب، ثم كلمة داخله، ثم المادة
// الفعّالة، ثم كلمة داخلها؛ وبالعربية يأتي قبل ذلك الاسم العربي نفسه،
// وبعده مطابقة الصوت (drugmatch.js). كل اسم تجاري يظهر مرة بكل عياراته،
// وتُعرض ١٠ أسماء على الأكثر، حتى لا تأكل ستة عيارات من صنف واحد القائمة.
// المرادفات: ما يكتبه الناس وليس في الكتالوغ («فيتامين سي» ← ASCORBIC).

const { searchArabic, hasArabic } = require("./drugmatch");

const MAX_BRANDS = 10;
const MAX_ROWS = 40;

// ما يُكتب عادةً ← ما في الكتالوغ (اسم مادة أو كلمة من اسم تجاري)
const SYNONYMS_EN = {
    "acetaminophen": ["paracetamol"], "tylenol": ["paracetamol"],
    "aspirin": ["acetylsalicylic"], "asa": ["acetylsalicylic"],
    "vitamin c": ["ascorbic"], "ascorbic acid": ["ascorbic"],
    "vitamin k": ["phytomenadione", "vit-k", "k-vit"],
    "vitamin b12": ["b12", "mecobalamin", "cobamamide", "cyanocobalamin"], "b12": ["mecobalamin", "cobamamide"],
    "vitamin b1": ["thiamine"], "vitamin b6": ["pyridoxine"], "vitamin b9": ["folic"], "folate": ["folic"],
    "vitamin d": ["vitamin d3", "cholecalciferol"], "cholecalciferol": ["vitamin d3"],
    "iron": ["ferrous"], "co-amoxiclav": ["clavulanic"], "amoxiclav": ["clavulanic"], "clavulanate": ["clavulanic"],
    "insulin": ["insulin"], "salbutamol": ["albuterol"], "albuterol": ["salbutamol"],
};
const SYNONYMS_AR = {
    "حديد": ["iron", "ferrous"], "حمض الفوليك": ["folic"], "فوليك": ["folic"], "فوليك اسيد": ["folic"],
    "فيتامين ب12": ["b12", "mecobalamin", "cobamamide"], "ب12": ["b12", "mecobalamin"],
    "فيتامين ج": ["ascorbic", "vitamin c"], "فيتامين سي": ["ascorbic", "vitamin c"],
    "فيتامين ك": ["phytomenadione", "vit-k", "k-vit"],
    "فيتامين ب6": ["vitamin b6", "pyridoxine"], "فيتامين ب1": ["thiamine"],
    "فيتامين ا": ["vitamin a"], "فيتامين ه": ["vitamin e"], "فيتامين اي": ["vitamin e"], "فيتامين ي": ["vitamin e"],
    "فيتامين د": ["vitamin d3"], "فيتامين د3": ["vitamin d3"],
    "زنك": ["zinc"], "كالسيوم": ["calcium"], "مغنيزيوم": ["magnesium"], "مغنيسيوم": ["magnesium"], "ماغنيزيوم": ["magnesium"],
    "بوتاسيوم": ["potassium"], "اسبرين": ["acetylsalicylic", "aspirin"], "انسولين": ["insulin"],
    "اوميغا": ["omega"], "اوميغا 3": ["omega"],
};

// توحيد أشكال الحروف العربية: «أسبرين» و«اسبرين» كلمة واحدة
// (أ إ آ ← ا، ى ← ي، ة ← ه)، والأرقام الهندية ← عربية — نفس التحويل في SQL
const AR_NORM_SQL = "translate(name_ar, 'أإآىة٠١٢٣٤٥٦٧٨٩', 'ااايه0123456789')";
const normAr = (s) => s.replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[ً-ْ]/g, "").replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
    .replace(/\s+/g, " ").trim();
const normEn = (s) => s.toLowerCase().replace(/\bvit\.?(?!\w)\s*/g, "vitamin ").replace(/\s+/g, " ").trim();
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ترتيب العيارات داخل الاسم الواحد: ٢٥٠ قبل ٥٠٠
const num = (s) => parseFloat(String(s || "").replace(/^[^\d]*/, "")) || 0;

const SELECT = "SELECT id, brand_name, name_ar, active_ingredient, strength, form";

// مطابقة لاتينية: الاسم التجاري ثم المادة، من أول النص ثم من أول أي كلمة
async function matchLatin(pool, terms, tierBase = 0) {
    if (!terms.length) return [];
    const starts = terms.map((t) => "^" + escapeRe(t));
    const words = terms.map((t) => "(^|[^A-Z0-9])" + escapeRe(t));
    const { rows } = await pool.query(
        `${SELECT},
            CASE WHEN brand_name ~* ANY($1) THEN 0
                 WHEN brand_name ~* ANY($2) THEN 1
                 WHEN active_ingredient ~* ANY($1) THEN 2
                 ELSE 3 END AS tier
         FROM medicines_catalog
         WHERE brand_name ~* ANY($2) OR active_ingredient ~* ANY($2)
         ORDER BY tier, length(brand_name), brand_name LIMIT 400`,
        [starts, words]
    );
    return rows.map((r) => ({ ...r, tier: tierBase + r.tier }));
}

// مطابقة عربية: الاسم العربي من أوله ثم من أول أي كلمة فيه
async function matchArabic(pool, term) {
    const like = term.replace(/[\\%_]/g, (c) => "\\" + c);
    const { rows } = await pool.query(
        `${SELECT}, CASE WHEN ${AR_NORM_SQL} LIKE $1 || '%' THEN 0 ELSE 1 END AS tier
         FROM medicines_catalog
         WHERE ${AR_NORM_SQL} LIKE $1 || '%' OR ${AR_NORM_SQL} LIKE '% ' || $1 || '%'
         ORDER BY tier, length(brand_name), brand_name LIMIT 400`,
        [like]
    );
    return rows;
}

// صف واحد لكل (اسم تجاري)، بكل عياراته، بحدّ MAX_BRANDS اسماً وMAX_ROWS صفاً
function groupByBrand(candidates) {
    const seen = new Set();
    const brands = new Map();
    for (const r of candidates) {
        if (seen.has(r.id)) continue;
        seen.add(r.id);
        const key = r.brand_name;
        if (!brands.has(key)) {
            if (brands.size >= MAX_BRANDS) continue;
            brands.set(key, { tier: r.tier, rows: [] });
        }
        brands.get(key).rows.push(r);
    }
    const out = [];
    for (const [, b] of [...brands].sort((a, b) => a[1].tier - b[1].tier)) {
        b.rows.sort((x, y) => num(x.strength) - num(y.strength) || String(x.strength).localeCompare(String(y.strength)));
        out.push(...b.rows);
    }
    return out.slice(0, MAX_ROWS).map(({ tier, ...row }) => row);
}

async function searchCatalog(pool, raw) {
    const q = String(raw || "").replace(/\s+/g, " ").trim();
    if (q.length < 2) return [];

    if (hasArabic(q)) {
        const term = normAr(q);
        const byName = await matchArabic(pool, term);
        const syn = SYNONYMS_AR[term] || SYNONYMS_AR[term.replace(/(\D) (\d)/, "$1$2")] || [];
        const bySyn = await matchLatin(pool, syn, 2);
        const seen = new Set([...byName, ...bySyn].map((r) => r.id));
        const bySound = (await searchArabic(q, 60)).filter((r) => !seen.has(r.id)).map((r) => ({ ...r, tier: 8 }));
        return groupByBrand([...byName, ...bySyn, ...bySound]);
    }

    const term = normEn(q);
    const terms = [q, ...(SYNONYMS_EN[term] || [])];
    return groupByBrand(await matchLatin(pool, terms));
}

module.exports = { searchCatalog, normAr, SYNONYMS_EN, SYNONYMS_AR };
