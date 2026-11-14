// تنظيف أسماء الكتالوغ كما وصلت من المصدر.
// ----------------------------------------------------------------
// ملف المصدر كُسرت فيه أسماء طويلة على سطرين («DEXAMETHASO NE»)، وبقيت
// في بعض الصفوف كلمات تغليف («CONTAINER ...»)، وألصق السعر بآخر الاسم
// («IBN AL HAYTHAM12500»)، وكُتب حرف C بالعربية «ك» (فيتامين K!).
// كل قاعدة هنا تُطبَّق فقط حين تؤكدها المادة الفعّالة في الصف نفسه، وتعمل
// عند كل تشغيل؛ الصف المصحّح لا يطابق القاعدة ثانية، فلا يتغيّر مرتين.

const { FORM_PREFIX, canonical } = require("./ingredients");

// كلمات تغليف وسطور ملتصقة في أول الاسم أو آخره — تُحذف
const PACK_PREFIX = /^(CONTAINER|P\.P\.BAG( PORT)?|\+DROPPER|& SPOON|DE OINT\.IN)\s+/;
const PACK_PREFIX_AR = /^(كونتاينير|ب\.ب\.باغ( بورت)?|\+دروبير|& سبون|دي أوينت\.إن)\s+/;
const PACK_SUFFIX = /\s+CONTAINER$/;
const PACK_SUFFIX_AR = /\s+كونتاينير$/;
// سعر ألصق بآخر الاسم بلا مسافة: «SHAHBA12000» (أما «MARINMOL 1000» فعيار)
const GLUED_PRICE = /([A-Z؀-ۿ])\d{4,}$/;
// شرطة يتيمة بقيت من الكسر: «LEVOTHYROXINE -RACHA»
const STRAY_DASH = /\s+-\s*(?=\S)|(?<=\S)\s*-\s+/g;

// ذيول الكلمات المكسورة كما ظهرت في المصدر، وما يقابلها بالعربية
const TAILS = new Set(["E", "L", "M", "N", "NE", "TE"]);
const TAILS_AR = { "إ": "", "ل": "ل", "م": "م", "ن": "ن", "ني": "ن", "تي": "ت" }; // الـE الأخيرة صامتة
const isArTail = (t) => Object.prototype.hasOwnProperty.call(TAILS_AR, t);

// تصحيحات لا تُستنتج آلياً: صفوف اندمج فيها اسمان من المصدر
const EXPLICIT = {
    828: ["BISOPROL-10", "بيزوبرول 10"],
    1784: ["DESLORATADINE IBN ROSHED", "ديسلوراتادين إبن روشيد"],
    1806: ["DEXAMETHASONE AVENZOR", "ديكساميثازون أفينزور"],
    2129: ["DIMENHYDRINATE EMESSA", "ديمينهيدرينات إميسا"],
    3761: ["MULTI MAGNESIUM", "مولتي ماغنيزيوم"],
    4138: ["METOPROLOL XR BIOMED", "ميتوبرولول كسر بيوميد"],
    6448: ["TRAMADOL SALAMA CARE", "ترامادول سالاما كار"],
};

const ingredientWords = (text) =>
    String(text || "").split("+").flatMap((p) => (canonical(p) || "").split(" ")).filter((w) => w.length >= 6);

function sharedPrefix(a, b) { let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++; return i; }
function sharedSuffix(a, b) { let i = 0; while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++; return i; }
const similarity = (word, w) => sharedPrefix(word, w) + sharedSuffix(word, w);

// هل وصلُ الذيل بالكلمة يقرّبها من مادة الصف؟ («HASYTRIPTYLIN»+«E» ~ AMITRIPTYLINE)
// الوصل مقبول إن صار الاسم هو المادة، أو إن زاد شبهه بها (لا «OMEPRAMED»+«L»)،
// أو إن كانت الكلمة هي المادة والذيل E (الإملاء الفرنسي: AZITHROMYCINE)
function joinImproves(head, tail, ingWords) {
    const joined = head + tail;
    return ingWords.some((w) =>
        joined === w
        || (head === w && tail === "E")
        || (similarity(joined, w) >= 6 && similarity(joined, w) > similarity(head, w)));
}

/**
 * يُرجع الاسم اللاتيني والعربي بعد التنظيف. arabicFor: مادة ← اسمها العربي
 * (للصفوف التي لم يبقَ منها إلا ذيل الكلمة: «NE CITY PHARMA»).
 */
function cleanBrand(row, arabicFor = new Map()) {
    if (EXPLICIT[row.id]) {
        const [brand_name, name_ar] = EXPLICIT[row.id];
        return { brand_name, name_ar };
    }
    let brand = String(row.brand_name || "").toUpperCase().replace(/\s+/g, " ").trim();
    let ar = String(row.name_ar || "").replace(/\s+/g, " ").trim();

    brand = brand.replace(PACK_PREFIX, "").replace(PACK_SUFFIX, "").replace(GLUED_PRICE, "$1").replace(STRAY_DASH, " ");
    ar = ar.replace(PACK_PREFIX_AR, "").replace(PACK_SUFFIX_AR, "").replace(GLUED_PRICE, "$1");

    const ingWords = ingredientWords(row.active_ingredient);
    const lat = brand.split(" ");
    const arw = ar.split(" ");

    // ١. كلمة مكسورة على كلمتين: «PHENOBARBITA L ASIA» ← PHENOBARBITAL ASIA
    // («LEVOTHYROXIN E-RACHA»: الذيل ملتصق بشرطة بالكلمة التالية)
    for (let i = 0; i + 1 < lat.length; i++) {
        const head = lat[i];
        const m = /^(E|L|M|N|NE|TE)(?:-(\S+))?$/.exec(lat[i + 1]);
        if (!m || !/^[A-Z]{7,}$/.test(head) || !joinImproves(head, m[1], ingWords)) continue;
        lat.splice(i, 2, head + m[1], ...(m[2] ? [m[2]] : []));
        // بالعربية: الذيل في الموضع نفسه، أو أول ذيل يتيم بعد كلمة طويلة إن لم تتطابق الكلمات
        let j = isArTail(arw[i + 1]) ? i + 1 : arw.findIndex((t, k) => k > 0 && isArTail(t) && arw[k - 1].length >= 5);
        if (j > 0) arw.splice(j - 1, 2, arw[j - 1] + TAILS_AR[arw[j]]);
    }

    // ٢. لم يبقَ من الاسم إلا الذيل: «NE CITY PHARMA» + DEXAMETHASONE ← DEXAMETHASONE CITY PHARMA
    if (TAILS.has(lat[0]) && lat.length > 1) {
        const first = ingWords.find((w) => w.endsWith(lat[0]));
        if (first) {
            lat[0] = first;
            if (isArTail(arw[0])) {
                const arName = arabicFor.get(first);
                if (arName) arw[0] = arName; else arw.shift();
            }
        }
    }

    brand = lat.join(" ");
    ar = arw.join(" ");

    // ٣. حرف C بالعربية «ك» (هذه كاف فيتامين K): «VIT-C» ← «فيت سي»
    const latTok = brand.split(/[\s-]+/), arTok = ar.split(/[\s-]+/);
    if (latTok.length === arTok.length && latTok.some((t, i) => t === "C" && arTok[i] === "ك")) {
        let k = 0;
        ar = ar.replace(/[^\s-]+/g, () => (latTok[k] === "C" && arTok[k] === "ك" ? (k++, "سي") : arTok[k++]));
    }

    return { brand_name: brand, name_ar: ar };
}

// نص المادة الفعّالة للعرض: بلا بادئة شكل («G.CAP »)، و«VIT.» ← «VITAMIN »
function cleanIngredientText(text) {
    return String(text || "").replace(FORM_PREFIX, "").replace(/\bVIT\.\s*/g, "VITAMIN ").replace(/\s+/g, " ").trim();
}

// الاسم العربي لكل مادة من الصفوف التي اسمها التجاري يبدأ باسم مادتها
function buildArabicFor(rows) {
    const votes = new Map();
    for (const r of rows) {
        // الصفوف التي لم يبقَ منها إلا الذيل لا تصلح مصدراً لاسم المادة
        if (r.orig && TAILS.has(String(r.orig).toUpperCase().split(" ")[0])) continue;
        const first = String(r.brand_name || "").toUpperCase().split(" ")[0];
        const ing = ingredientWords(r.active_ingredient)[0];
        const ar = String(r.name_ar || "").split(" ")[0];
        if (!first || !ing || !ar || first !== ing) continue;
        const m = votes.get(ing) || new Map();
        m.set(ar, (m.get(ar) || 0) + 1);
        votes.set(ing, m);
    }
    return new Map([...votes].map(([k, m]) => [k, [...m].sort((a, b) => b[1] - a[1])[0][0]]));
}

async function applyCatalogClean(pool) {
    const rows = (await pool.query("SELECT id, brand_name, name_ar, active_ingredient, strength, form FROM medicines_catalog")).rows;
    // جولتان: الأولى تصلح الكلمات المكسورة، فتصير أسماء المواد بالعربية معروفة
    // للجولة الثانية التي تكمل الصفوف التي لم يبقَ منها إلا الذيل
    const pass1 = rows.map((r) => ({ ...r, ...cleanBrand(r), orig: r.brand_name }));
    const arabicFor = buildArabicFor(pass1);
    const client = await pool.connect();
    let renamed = 0, merged = 0;
    try {
        await client.query("BEGIN");
        for (const r of rows) {
            const c = cleanBrand(r, arabicFor);
            const ing = cleanIngredientText(r.active_ingredient);
            if (c.brand_name === r.brand_name && c.name_ar === r.name_ar && ing === r.active_ingredient) continue;
            await client.query(
                "UPDATE medicines_catalog SET brand_name = $1, name_ar = $2, active_ingredient = $3 WHERE id = $4",
                [c.brand_name, c.name_ar, ing, r.id]
            );
            renamed++;
        }
        // بعد التنظيف تتطابق بعض الصفوف تماماً (العلبة والشريط للدواء نفسه):
        // نُبقي الأقدم ونحوّل إليه أدوية المستخدمين قبل حذف الباقي
        const dupes = (await client.query(
            `SELECT min(id) AS keep, array_agg(id) AS ids FROM medicines_catalog
             GROUP BY brand_name, coalesce(active_ingredient,''), coalesce(strength,''), coalesce(form,'')
             HAVING count(*) > 1`
        )).rows;
        for (const d of dupes) {
            const drop = d.ids.filter((id) => id !== d.keep);
            await client.query("UPDATE medications SET catalog_id = $1 WHERE catalog_id = ANY($2::int[])", [d.keep, drop]);
            await client.query("DELETE FROM medicines_catalog WHERE id = ANY($1::int[])", [drop]);
            merged += drop.length;
        }
        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
    if (renamed || merged) console.log(`[catalog] نُظّف ${renamed} اسماً ودُمج ${merged} صفاً مكرراً`);
    return { renamed, merged };
}

module.exports = { applyCatalogClean, cleanBrand, cleanIngredientText, buildArabicFor };
