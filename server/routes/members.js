const express = require("express");
const pool = require("../db");
const auth = require("../middleware/auth");
const { listAllergies, replaceAllergies, memberConflicts } = require("../allergy");
const { adherence } = require("../adherence");

const router = express.Router();
router.use(auth);

router.get("/", async (req, res) => {
    const result = await pool.query(
        "SELECT * FROM members WHERE user_id = $1 ORDER BY id",
        [req.userId]
    );
    res.json(result.rows);
});

// فصائل الدم المقبولة — غير ذلك يُحفظ فارغاً بدل نص عشوائي على بطاقة الطوارئ
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
const GENDERS = ["male", "female"];

// حقول الفرد من جسم الطلب، بعد تنظيفها
function memberFields(body) {
    return [
        body.name,
        body.birth_date || null,
        body.chronic_conditions || null,
        BLOOD_TYPES.includes(body.blood_type) ? body.blood_type : null,
        GENDERS.includes(body.gender) ? body.gender : null,
        body.emergency_notes?.trim() || null,
    ];
}

router.post("/", async (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: "الاسم مطلوب" });

    // الحساسية تُحفظ بعدها عبر PUT /:id/allergies — صفوف منظّمة لا نص
    const result = await pool.query(
        `INSERT INTO members (user_id, name, birth_date, chronic_conditions, blood_type, gender, emergency_notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [req.userId, ...memberFields(req.body)]
    );
    res.status(201).json(result.rows[0]);
});

router.put("/:id", async (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: "الاسم مطلوب" });
    const result = await pool.query(
        `UPDATE members SET name = $1, birth_date = $2, chronic_conditions = $3,
            blood_type = $4, gender = $5, emergency_notes = $6
     WHERE id = $7 AND user_id = $8 RETURNING *`,
        [...memberFields(req.body), req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "الفرد غير موجود" });
    res.json(result.rows[0]);
});

// ---------- الحساسية ----------

async function ownedMember(id, userId) {
    const r = await pool.query("SELECT id, name FROM members WHERE id = $1 AND user_id = $2", [id, userId]);
    return r.rows[0] || null;
}

// حساسية الفرد، ومعها تعارضها مع أدويته الحالية (الفحص في الاتجاه المعاكس)
router.get("/:id/allergies", async (req, res) => {
    try {
        const member = await ownedMember(req.params.id, req.userId);
        if (!member) return res.status(404).json({ error: "الفرد غير موجود" });
        res.json({
            allergies: await listAllergies(pool, member.id),
            conflicts: await memberConflicts(pool, member.id, member.name),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// تستبدل القائمة كلها. تُرجع التعارضات مع الأدوية الحالية فوراً:
// حساسية جديدة لدواء يأخذه الفرد أصلاً يجب أن تظهر الآن، لا عند الدواء القادم
router.put("/:id/allergies", async (req, res) => {
    try {
        const member = await ownedMember(req.params.id, req.userId);
        if (!member) return res.status(404).json({ error: "الفرد غير موجود" });
        await replaceAllergies(pool, member.id, req.body.items);
        res.json({
            allergies: await listAllergies(pool, member.id),
            conflicts: await memberConflicts(pool, member.id, member.name),
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ---------- جهات الطوارئ ----------

async function listContacts(memberId) {
    const r = await pool.query(
        "SELECT id, name, phone, relation FROM emergency_contacts WHERE member_id = $1 ORDER BY position, id",
        [memberId]
    );
    return r.rows;
}

router.get("/:id/contacts", async (req, res) => {
    try {
        const member = await ownedMember(req.params.id, req.userId);
        if (!member) return res.status(404).json({ error: "الفرد غير موجود" });
        res.json(await listContacts(member.id));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// تستبدل القائمة كلها، كالحساسية: النموذج يرسل ما يراه المستخدم
router.put("/:id/contacts", async (req, res) => {
    const items = Array.isArray(req.body.items) ? req.body.items : [];
    const clean = items
        .map((c) => ({
            name: String(c.name || "").trim().slice(0, 80),
            phone: String(c.phone || "").replace(/[^\d+]/g, "").slice(0, 20),
            relation: String(c.relation || "").trim().slice(0, 40) || null,
        }))
        .filter((c) => c.name || c.phone);
    if (clean.some((c) => !c.name || c.phone.replace("+", "").length < 6))
        return res.status(400).json({ error: "لكل جهة طوارئ اسم ورقم هاتف صحيح" });
    if (clean.length > 5) return res.status(400).json({ error: "خمس جهات طوارئ على الأكثر" });

    const client = await pool.connect();
    try {
        const member = await ownedMember(req.params.id, req.userId);
        if (!member) return res.status(404).json({ error: "الفرد غير موجود" });
        await client.query("BEGIN");
        await client.query("DELETE FROM emergency_contacts WHERE member_id = $1", [member.id]);
        for (const [i, c] of clean.entries()) {
            await client.query(
                "INSERT INTO emergency_contacts (member_id, name, phone, relation, position) VALUES ($1, $2, $3, $4, $5)",
                [member.id, c.name, c.phone, c.relation, i]
            );
        }
        await client.query("COMMIT");
        res.json(await listContacts(member.id));
    } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        res.status(500).json({ error: err.message });
    } finally {
        client.release();
    }
});

// ---------- بطاقة الطوارئ ----------

// كل ما يحتاجه المسعف في طلب واحد: فصيلة الدم، الحساسية (الشديدة أولاً)،
// الأمراض المزمنة، الأدوية الحالية، آخر جرعة أُخذت، وأرقام الطوارئ.
// الأدوية الخاصة تظهر هنا: البطاقة يفتحها صاحب الحساب على هاتفه، لا رابط عام
router.get("/:id/emergency", async (req, res) => {
    try {
        const own = await pool.query("SELECT * FROM members WHERE id = $1 AND user_id = $2", [req.params.id, req.userId]);
        const member = own.rows[0];
        if (!member) return res.status(404).json({ error: "الفرد غير موجود" });

        const [allergies, meds, last, contacts] = await Promise.all([
            listAllergies(pool, member.id),
            pool.query(
                `SELECT m.id, m.name, m.strength, m.form,
                        COALESCE(array_agg(to_char(ds.time_of_day, 'HH24:MI') ORDER BY ds.time_of_day)
                                 FILTER (WHERE ds.id IS NOT NULL), '{}') AS times
                   FROM medications m
                   LEFT JOIN dose_schedules ds ON ds.medication_id = m.id
                  WHERE m.member_id = $1 AND m.is_active = TRUE
                    AND (m.end_date IS NULL OR m.end_date >= CURRENT_DATE)
                  GROUP BY m.id ORDER BY m.name`,
                [member.id]
            ),
            pool.query(
                `SELECT m.name, m.strength, dl.confirmed_at, dl.method
                   FROM dose_logs dl JOIN medications m ON m.id = dl.medication_id
                  WHERE m.member_id = $1 AND dl.status = 'taken' AND dl.confirmed_at IS NOT NULL
                  ORDER BY dl.confirmed_at DESC LIMIT 1`,
                [member.id]
            ),
            listContacts(member.id),
        ]);

        res.json({
            member: {
                id: member.id,
                name: member.name,
                birth_date: member.birth_date,
                gender: member.gender,
                blood_type: member.blood_type,
                chronic_conditions: member.chronic_conditions,
                emergency_notes: member.emergency_notes,
            },
            allergies: [...allergies].sort((x, y) => (y.severity === "severe") - (x.severity === "severe")),
            medications: meds.rows,
            last_dose: last.rows[0] || null,
            contacts,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// تقرير الالتزام بالجرعات: آخر ٧ أو ٣٠ يوماً (adherence.js)
router.get("/:id/adherence", async (req, res) => {
    try {
        const member = await ownedMember(req.params.id, req.userId);
        if (!member) return res.status(404).json({ error: "الفرد غير موجود" });
        res.json(await adherence(pool, member.id, req.query.days));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.delete("/:id", async (req, res) => {
    const result = await pool.query(
        "DELETE FROM members WHERE id = $1 AND user_id = $2 RETURNING id",
        [req.params.id, req.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: "الفرد غير موجود" });
    res.json({ ok: true });
});

module.exports = router;