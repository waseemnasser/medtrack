// عائلات الأدوية المهمّة في الحساسية
// ----------------------------------------------------------------
// كل عائلة تذكر موادها بالاسم صراحةً (من جدول ingredients) — لا أنماط
// في الأسماء. نمط «PENICILLIN» كان يلتقط PENICILLAMINE وهو دواء آخر تماماً.
// التجميع حسب تصنيف منظمة الصحة العالمية ATC.
//
// من عنده حساسية من مادة في عائلة، يُنبَّه لباقي موادها أيضاً
// (التحسّس المتصالب داخل العائلة). والتحسّس بين عائلتين مختلفتين
// في CROSS_REACTIONS أدناه، بتنبيه أخف.
//
// إضافة مادة أو عائلة: عدّلي القائمة وأعيدي تشغيل الخادم — تُزامَن تلقائياً.
// أداة تنظيمية: هذه القوائم تنبيه، لا تغني عن الطبيب والصيدلاني.

const CLASSES = [
    {
        code: "J01C", name: "Penicillins", name_ar: "البنسلينات",
        aliases: ["بنسلين", "البنسلين", "penicillin", "penicillins"],
        members: ["AMOXICILLIN", "AMPICILLIN", "CLOXACILLIN", "FLUCLOXACILLIN", "SULTAMICILLIN"],
    },
    {
        code: "J01D", name: "Cephalosporins", name_ar: "السيفالوسبورينات",
        aliases: ["سيفالوسبورين", "cephalosporin", "cephalosporins"],
        members: ["CEFACLOR", "CEFADROXIL", "CEFDINIR", "CEFDITOREN", "CEFIXIME", "CEFPODOXIME",
            "CEFPROZIL", "CEFTRIAXONE", "CEFUROXIME", "CEPHRADINE"],
    },
    {
        code: "J01E", name: "Sulfonamides", name_ar: "السلفوناميدات (السلفا)",
        aliases: ["سلفا", "السلفا", "sulfa", "sulfonamide"],
        members: ["SULFASALAZINE"],
    },
    {
        code: "J01FA", name: "Macrolides", name_ar: "الماكروليدات",
        aliases: ["ماكروليد", "macrolide"],
        members: ["AZITHROMYCIN", "CLARITHROMYCIN", "ERYTHROMYCIN", "ROXITHROMYCIN", "SPIRAMYCIN"],
    },
    {
        code: "J01FF", name: "Lincosamides", name_ar: "اللينكوزاميدات",
        aliases: ["lincosamide"],
        members: ["CLINDAMYCIN", "LINCOMYCIN"],
    },
    {
        code: "J01M", name: "Quinolones", name_ar: "الكينولونات",
        aliases: ["كينولون", "quinolone", "fluoroquinolone"],
        members: ["BESIFLOXACIN", "CIPROFLOXACIN", "GATIFLOXACIN", "GEMIFLOXACIN", "LEVOFLOXACIN",
            "MOXIFLOXACIN", "NORFLOXACIN", "OFLOXACIN", "PEFLOXACIN", "SPARFLOXACIN",
            "NALIDIXIC ACID", "PIPEMIDIC ACID"],
    },
    {
        code: "J01AA", name: "Tetracyclines", name_ar: "التتراسيكلينات",
        aliases: ["تتراسيكلين", "tetracycline"],
        members: ["DOXYCYCLINE", "MINOCYCLINE"],
    },
    {
        code: "J01G", name: "Aminoglycosides", name_ar: "الأمينوغليكوزيدات",
        aliases: ["aminoglycoside"],
        members: ["AMIKACIN", "GENTAMICIN", "TOBRAMYCIN", "NEOMYCIN", "FRAMYCETIN"],
    },
    {
        code: "P01AB", name: "Nitroimidazoles", name_ar: "النيتروإيميدازولات",
        aliases: ["nitroimidazole"],
        members: ["METRONIDAZOLE", "TINIDAZOLE", "ORNIDAZOLE", "SECNIDAZOLE"],
    },
    {
        code: "M01A", name: "NSAIDs", name_ar: "مضادات الالتهاب غير الستيروئيدية",
        aliases: ["مضادات الالتهاب", "nsaid", "nsaids"],
        members: ["ACECLOFENAC", "ACEMETACINE", "ACETYLSALICYLIC ACID", "BROMFENAC", "CELECOXIB",
            "DEXIBUPROFEN", "DICLOFENAC", "ETODOLAC", "ETORICOXIB", "FLURBIPROFEN", "IBUPROFEN",
            "INDOMETHACIN", "KETOPROFEN", "KETOROLAC", "LORNOXICAM", "MEFENAMIC ACID", "MELOXICAM",
            "NABUMETONE", "NAPROXEN", "NIMESULIDE", "PIROXICAM", "SULINDAC", "TENOXICAM",
            "TIAPROFENIC ACID"],
    },
    {
        code: "N02BA", name: "Salicylates", name_ar: "الساليسيلات (الأسبرين)",
        aliases: ["أسبرين", "اسبرين", "aspirin", "salicylate"],
        members: ["ACETYLSALICYLIC ACID", "BISMUTH SUBSALICYLATE"],
    },
    {
        code: "N02A", name: "Opioids", name_ar: "الأفيونات",
        aliases: ["أفيون", "مورفين", "كودئين", "opioid", "opioids", "morphine", "codeine"],
        members: ["OXYCODONE", "TRAMADOL", "TAPENTADOL"],
    },
    {
        code: "C09A", name: "ACE inhibitors", name_ar: "مثبطات الإنزيم المحوّل للأنجيوتنسين",
        aliases: ["ace", "ace inhibitor", "بريل"],
        members: ["BENAZEPRIL", "CAPTOPRIL", "ENALAPRIL", "FOSINOPRIL", "IMIDAPRIL", "LISINOPRIL",
            "PERINDOPRIL", "RAMIPRIL"],
    },
    {
        code: "N03-AROM", name: "Aromatic anticonvulsants", name_ar: "مضادات الصرع العطرية",
        aliases: ["anticonvulsant"],
        members: ["CARBAMAZEPINE", "OXCARBAZEPINE", "PHENYTOIN", "PHENOBARBITAL", "LAMOTRIGINE"],
    },
    {
        code: "N01BA", name: "Ester local anesthetics", name_ar: "المخدّرات الموضعية (إسترات)",
        aliases: ["بنزوكائين", "بروكائين", "ester anesthetic"],
        members: ["BENZOCAINE", "PROCAINE", "PROPARACAINE"],
    },
    {
        code: "N01BB", name: "Amide local anesthetics", name_ar: "المخدّرات الموضعية (أميدات)",
        aliases: ["ليدوكائين", "amide anesthetic"],
        members: ["LIDOCAINE"],
    },
    {
        code: "D01-AZOLE", name: "Azole antifungals", name_ar: "مضادات الفطور الآزولية",
        aliases: ["azole"],
        members: ["CLOTRIMAZOLE", "FLUCONAZOLE", "ISOCONAZOLE", "ITRACONAZOLE", "KETOCONAZOLE"],
    },
    {
        code: "A10A", name: "Insulins", name_ar: "الإنسولين",
        aliases: ["انسولين", "insulin"],
        members: ["INSULIN", "INSULIN ASPART", "INSULIN GLARGINE"],
    },
];

// تحسّس متصالب بين عائلتين — خطره أقل من داخل العائلة، فالتنبيه أخف
const CROSS_REACTIONS = [
    { from: "J01C", to: "J01D", note_ar: "تحسّس متصالب منخفض بين البنسلينات والسيفالوسبورينات" },
    { from: "J01D", to: "J01C", note_ar: "تحسّس متصالب منخفض بين السيفالوسبورينات والبنسلينات" },
];

const TABLES = [
    `CREATE TABLE IF NOT EXISTS drug_classes (
        id SERIAL PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        aliases TEXT[] NOT NULL DEFAULT '{}'
    )`,
    `CREATE TABLE IF NOT EXISTS ingredient_classes (
        ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
        class_id INTEGER NOT NULL REFERENCES drug_classes(id) ON DELETE CASCADE,
        PRIMARY KEY (ingredient_id, class_id)
    )`,
    `CREATE TABLE IF NOT EXISTS class_cross_reactions (
        from_class INTEGER NOT NULL REFERENCES drug_classes(id) ON DELETE CASCADE,
        to_class INTEGER NOT NULL REFERENCES drug_classes(id) ON DELETE CASCADE,
        note_ar TEXT NOT NULL,
        PRIMARY KEY (from_class, to_class)
    )`,
];

/** يزامن العائلات مع الجداول. أرقام العائلات ثابتة (تُحدَّث بالرمز). */
async function syncDrugClasses(pool) {
    for (const sql of TABLES) await pool.query(sql);

    const known = new Set((await pool.query("SELECT name FROM ingredients")).rows.map((r) => r.name));
    const missing = CLASSES.flatMap((c) => c.members.filter((m) => !known.has(m)).map((m) => `${c.code}:${m}`));
    // مادة في القائمة غير موجودة في الكتالوغ = خطأ إملائي في القائمة. ننبّه ولا نتوقف.
    if (missing.length) console.warn("[classes] مواد غير موجودة في الكتالوغ:", missing.join(", "));

    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        for (const c of CLASSES) {
            const { rows } = await client.query(
                `INSERT INTO drug_classes (code, name, name_ar, aliases) VALUES ($1, $2, $3, $4)
                 ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, name_ar = EXCLUDED.name_ar, aliases = EXCLUDED.aliases
                 RETURNING id`,
                [c.code, c.name, c.name_ar, c.aliases]
            );
            const classId = rows[0].id;
            await client.query("DELETE FROM ingredient_classes WHERE class_id = $1", [classId]);
            await client.query(
                `INSERT INTO ingredient_classes (ingredient_id, class_id)
                 SELECT id, $1 FROM ingredients WHERE name = ANY($2::text[])`,
                [classId, c.members]
            );
        }
        await client.query("DELETE FROM class_cross_reactions");
        for (const x of CROSS_REACTIONS) {
            await client.query(
                `INSERT INTO class_cross_reactions (from_class, to_class, note_ar)
                 SELECT f.id, t.id, $3 FROM drug_classes f, drug_classes t WHERE f.code = $1 AND t.code = $2`,
                [x.from, x.to, x.note_ar]
            );
        }
        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { syncDrugClasses, CLASSES, CROSS_REACTIONS };
