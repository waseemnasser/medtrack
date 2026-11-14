// أدوية ناقصة من الكتالوغ الأصلي، وتصحيحات لبعض صفوفه.
// ----------------------------------------------------------------
// تُطبَّق عند تشغيل الخادم (migrate.js)، فتصل إلى القاعدة المستضافة
// وإلى أي تثبيت جديد دون استيراد يدوي. آمنة للتكرار: الصف يُضاف مرة
// واحدة (يُعرف باسمه وعياره وشكله)، والتصحيح يُعاد كتابته بالقيمة نفسها.
//
// الأسماء هنا عامة (اسم المادة) لا تجارية، حتى لا ننسب منتجاً لشركة.
// لإضافة دواء: سطر جديد في EXTRAS، ثم ارفع INGREDIENTS_VERSION في
// ingredients.js ليُعاد ربط الكتالوغ بالمواد الفعّالة (أساس فحص الحساسية).

// [الاسم، المادة الفعّالة كما يكتبها الكتالوغ، العيار، الشكل، الاسم العربي]
const EXTRAS = [
    // فيتامين د3 وحده (كوليكالسيفيرول): كان موجوداً فقط مع الكالسيوم
    ["VITAMIN D3", "VITAMIN D3", "1000 IU/TAB.", "أقراص", "فيتامين د3"],
    ["VITAMIN D3", "VITAMIN D3", "5000 IU/CAP.", "محافظ", "فيتامين د3"],
    ["VITAMIN D3", "VITAMIN D3", "10000 IU/CAP.", "محافظ", "فيتامين د3"],
    ["VITAMIN D3", "VITAMIN D3", "50000 IU/CAP.", "محافظ", "فيتامين د3"],
    ["VITAMIN D3", "VITAMIN D3", "400 IU/DROP", "قطرة", "فيتامين د3"],
    ["VITAMIN D3", "VITAMIN D3", "200000 IU/AMP.", "حبابات", "فيتامين د3"],
];

// تصحيحات صفوف المصدر: { id: { عمود: [القيمة الخاطئة، الصحيحة] } }.
// لا نكتب إلا إن كانت القيمة ما تزال الخاطئة، فلا نمحو تعديلاً لاحقاً.
const FIXES = {
    487: { name_ar: ["فيتامين ك أزيا", "فيتامين سي أزيا"] },            // VITAMIN C ASIA — «ك» تعني فيتامين K
    488: { name_ar: ["فيتامين ك أولتراميديكا", "فيتامين سي أولتراميديكا"] },
    6068: { form: ["كريم", "قطرة"] },                                   // VALPROVITAL DROP 200 MG/ML
};

async function applyCatalogExtras(pool) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        // الكتالوغ استُورد بأرقام صريحة، فقد يكون العدّاد متأخراً عنها
        await client.query(
            "SELECT setval(pg_get_serial_sequence('medicines_catalog', 'id'), GREATEST((SELECT MAX(id) FROM medicines_catalog), 1))"
        );
        for (const [brand, ingredient, strength, form, nameAr] of EXTRAS) {
            await client.query(
                `INSERT INTO medicines_catalog (brand_name, active_ingredient, strength, form, name_ar, source)
                 SELECT $1::text, $2::text, $3::text, $4::text, $5::text, 'added'
                 WHERE NOT EXISTS (
                     SELECT 1 FROM medicines_catalog
                     WHERE brand_name = $1::text AND strength = $3::text AND form = $4::text
                 )`,
                [brand, ingredient, strength, form, nameAr]
            );
        }
        for (const [id, cols] of Object.entries(FIXES)) {
            for (const [col, [wrong, right]] of Object.entries(cols)) {
                // col من القائمة أعلاه فقط، لا من المستخدم
                await client.query(
                    `UPDATE medicines_catalog SET ${col} = $1 WHERE id = $2 AND ${col} = $3`,
                    [right, Number(id), wrong]
                );
            }
        }
        await client.query("COMMIT");
    } catch (err) {
        await client.query("ROLLBACK");
        throw err;
    } finally {
        client.release();
    }
}

module.exports = { applyCatalogExtras, EXTRAS };
