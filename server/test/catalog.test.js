// اختبارات تنظيف الكتالوغ والبحث فيه — تشغيلها: npm test (من مجلد server)
// ----------------------------------------------------------------
// قواعد التنظيف تُفحص على صفوف كما وصلت من المصدر فعلاً، والبحث على
// الكتالوغ الحقيقي بعد التنظيف: ما كان يفشل قبل الإصلاح يجب أن ينجح هنا.

const { test, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../db");
const migrate = require("../migrate");
const { cleanBrand, cleanIngredientText } = require("../catalogClean");
const { searchCatalog } = require("../catalogSearch");

describe("catalog name cleaning (no database)", () => {
    const row = (brand_name, name_ar, active_ingredient, id = 0) => ({ id, brand_name, name_ar, active_ingredient });
    const cases = [
        // كلمة مكسورة على سطرين في المصدر
        [row("DEXAMETHASO NE ASIA", "ديكساميثازو ني أزيا", "DEXAMETHASONE"), "DEXAMETHASONE ASIA", "ديكساميثازون أزيا"],
        [row("PHENOBARBITA L HAMA", "فينوباربيتا ل هاما", "PHENOBARBITAL"), "PHENOBARBITAL HAMA", "فينوباربيتال هاما"],
        [row("METRONIDAZOL E BAHRI", "ميترونيدازول إ باهري", "METRONIDAZOLE"), "METRONIDAZOLE BAHRI", "ميترونيدازول باهري"],
        [row("LEVOTHYROXIN E IDM", "ليفوثيروكسين إ إدم", "LEVOTHYROXINE SODIUM"), "LEVOTHYROXINE IDM", "ليفوثيروكسين إدم"],
        [row("DIMENHYDRINA TE OSHAR", "ديمينهيدرينا تي أوشار", "DIMENHYDRINATE"), "DIMENHYDRINATE OSHAR", "ديمينهيدرينات أوشار"],
        [row("HASYTRIPTYLIN E", "هازيتريبتيلين إ", "AMITRIPTYLINE HCL"), "HASYTRIPTYLINE", "هازيتريبتيلين"],
        [row("AZITHROMYCIN E HUMAN", "أزيثروميسين إ هومان", "AZITHROMYCIN"), "AZITHROMYCINE HUMAN", "أزيثروميسين هومان"],
        // أسماء شرعية تشبه الكسر — تبقى كما هي
        [row("NITROBID M", "نيتروبيد م", "ISOSORBIDE DINITRATE"), "NITROBID M", "نيتروبيد م"],
        [row("DRIPMAX M R", "دريبماكس م ر", "DOXAZOSIN"), "DRIPMAX M R", "دريبماكس م ر"],
        [row("ULTRA E", "أولترا إ", "VITAMIN E"), "ULTRA E", "أولترا إ"],
        [row("DICLOFENAC K HUMAN", "ديكلوفيناك ك هومان", "DICLOFENAC POTASSIUM"), "DICLOFENAC K HUMAN", "ديكلوفيناك ك هومان"],
        // تغليف وسعر ملتصق
        [row("CONTAINER METFORMIN KIMI", "كونتاينير ميتفورمين كيمي", "METFORMIN"), "METFORMIN KIMI", "ميتفورمين كيمي"],
        [row("CONTAINER MAXICLOTIDE CONTAINER", "كونتاينير ماكسيكلوتيد كونتاينير", "LINACLOTIDE"), "MAXICLOTIDE", "ماكسيكلوتيد"],
        [row("P.P.BAG PORT METRONIDAZOL E SERDA", "ب.ب.باغ بورت ميترونيدازول إ سيردا", "METRONIDAZOLE"), "METRONIDAZOLE SERDA", "ميترونيدازول سيردا"],
        [row("PREDNISOLONE IBN AL HAYTHAM6500", "بريدنيزولون إبن أل هايثام6500", "PREDNISOLONE"), "PREDNISOLONE IBN AL HAYTHAM", "بريدنيزولون إبن أل هايثام"],
        [row("atrombex", "أترومبيكس", "CISATRACURIUM"), "ATROMBEX", "أترومبيكس"],
        // حرف C كُتب «ك»
        [row("VIT-C", "فيت ك", "ASCORBIC ACID"), "VIT-C", "فيت سي"],
        [row("ONE-C", "أون ك", "ASCORBIC ACID"), "ONE-C", "أون سي"],
        [row("K-VIT AD", "ك فيت أد", "PHYTOMENADIONE"), "K-VIT AD", "ك فيت أد"],
        // صف اندمج فيه اسمان — تصحيح صريح
        [row("+200MG+200MCG THIAMINE+VIT.B6+B12 NEROTRI TRAMADOL SALAMA CARE", "x", "TRAMADOL HCL", 6448), "TRAMADOL SALAMA CARE", "ترامادول سالاما كار"],
    ];
    for (const [input, brand, ar] of cases) {
        test(`${input.brand_name} → ${brand}`, () => {
            const out = cleanBrand(input);
            assert.equal(out.brand_name, brand);
            assert.equal(out.name_ar, ar);
        });
    }

    test("tail-only names take the ingredient back", () => {
        const arabicFor = new Map([["DEXAMETHASONE", "ديكساميثازون"]]);
        const out = cleanBrand(row("NE CITY PHARMA", "ني سيتي فارما", "DEXAMETHASONE"), arabicFor);
        assert.equal(out.brand_name, "DEXAMETHASONE CITY PHARMA");
        assert.equal(out.name_ar, "ديكساميثازون سيتي فارما");
    });

    test("cleaning is idempotent", () => {
        const once = cleanBrand(row("CONTAINER DEXAMETHASO NE ASIA12000", "كونتاينير ديكساميثازو ني أزيا12000", "DEXAMETHASONE"));
        const twice = cleanBrand({ ...once, active_ingredient: "DEXAMETHASONE", id: 0 });
        assert.deepEqual(twice, once);
    });

    test("ingredient text loses its form prefix", () => {
        assert.equal(cleanIngredientText("G.CAP CALCIUM SALTS+VITAMIN D3"), "CALCIUM SALTS+VITAMIN D3");
        assert.equal(cleanIngredientText("I.M.INJ. PHYTOMENADIONE VIT.K1"), "PHYTOMENADIONE VITAMIN K1");
        assert.equal(cleanIngredientText("PARACETAMOL"), "PARACETAMOL");
    });
});

describe("catalog search on the real catalog", () => {
    const brands = (rows) => new Set(rows.map((r) => r.brand_name));
    let ready;
    const setup = () => (ready ??= migrate());

    after(async () => { await pool.end(); });

    test("a word inside the ingredient is found", async () => {
        await setup();
        const rows = await searchCatalog(pool, "clavulanic");
        assert.ok(rows.some((r) => r.brand_name === "AUGMENTIN"), "AUGMENTIN missing");
        assert.ok(rows.some((r) => r.brand_name === "LANTUS") === false);
        assert.ok((await searchCatalog(pool, "glargine")).some((r) => r.brand_name === "LANTUS"));
    });

    test("brand matches come first and no brand floods the list", async () => {
        await setup();
        const rows = await searchCatalog(pool, "paracetamol");
        assert.ok(rows.length <= 40);
        assert.ok(brands(rows).size >= 6, "too few distinct brands");
        assert.ok(rows[0].brand_name.startsWith("PARACETAMOL"), `first was ${rows[0].brand_name}`);
        assert.ok(rows.every((r) => /PARACETAMOL/i.test(r.brand_name + " " + r.active_ingredient)));
        const panadol = await searchCatalog(pool, "panadol");
        assert.equal(panadol[0].brand_name, "PANADOL");
    });

    test("strengths of one brand are sorted numerically", async () => {
        await setup();
        const rows = (await searchCatalog(pool, "metformin kimi")).filter((r) => r.brand_name === "METFORMIN KIMI");
        assert.ok(rows.length >= 2);
        const nums = rows.map((r) => parseFloat(r.strength));
        assert.deepEqual(nums, [...nums].sort((a, b) => a - b));
    });

    test("synonyms: vitamin c, aspirin, acetaminophen", async () => {
        await setup();
        assert.ok(brands(await searchCatalog(pool, "vitamin c")).size >= 5);
        assert.ok((await searchCatalog(pool, "aspirin")).some((r) => /ACETYLSALICYLIC/.test(r.active_ingredient)));
        assert.ok((await searchCatalog(pool, "acetaminophen")).length > 0);
    });

    test("Arabic generic words and Arabic-Indic digits", async () => {
        await setup();
        assert.ok((await searchCatalog(pool, "حديد")).length > 0, "حديد");
        assert.ok((await searchCatalog(pool, "حمض الفوليك")).length > 0, "حمض الفوليك");
        assert.ok((await searchCatalog(pool, "فيتامين ب١٢")).length > 0, "فيتامين ب١٢");
        assert.ok((await searchCatalog(pool, "فيتامين سي")).length >= 5, "فيتامين سي");
        assert.ok((await searchCatalog(pool, "فيتامين ك")).some((r) => /PHYTOMENADIONE/.test(r.active_ingredient)));
        const d = await searchCatalog(pool, "فيتامين د");
        assert.equal(d[0].brand_name, "VITAMIN D3");
    });

    test("Arabic brand names still rank first, sound match still works", async () => {
        await setup();
        assert.equal((await searchCatalog(pool, "بنادول"))[0].brand_name, "PANADOL");
        assert.ok((await searchCatalog(pool, "باراسيتامول")).length > 0);
        assert.ok((await searchCatalog(pool, "ديكساميثازون")).some((r) => /^DEXAMETHASONE /.test(r.brand_name)));
    });

    test("cleaned names are what the catalog serves", async () => {
        await setup();
        const bad = (await pool.query(
            `SELECT count(*)::int c FROM medicines_catalog
             WHERE brand_name ~ '^(CONTAINER |P\\.P\\.BAG|\\+|&)' OR brand_name ~ '[a-z]' OR brand_name ~ '[A-Z]\\d{4,}$'
                OR brand_name ~ '(DEXAMETHASO NE|PHENOBARBITA L|METRONIDAZOL E|LEVOTHYROXIN E)'
                OR (active_ingredient ~ '^(G\\.CAP|R\\.TAB|I\\.M\\.INJ|P\\.VIAL|V\\.C\\.BAG)')`
        )).rows[0].c;
        assert.equal(bad, 0);
        const dupes = (await pool.query(
            `SELECT count(*)::int c FROM (SELECT 1 FROM medicines_catalog GROUP BY brand_name, active_ingredient, strength, form HAVING count(*) > 1) t`
        )).rows[0].c;
        assert.equal(dupes, 0);
    });
});
