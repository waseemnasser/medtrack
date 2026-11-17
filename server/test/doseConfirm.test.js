// زر «تم الأخذ» في الإشعار — توكن الإجراء وتأكيد الجرعة. تشغيلها: npm test
// تُنشئ مستخدمَين مؤقتين وتحذفهما في النهاية.

const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const migrate = require("../migrate");
const { signDoseAction, verifyDoseAction, confirmDose, undoDose } = require("../doseConfirm");

describe("dose action token", () => {
    const action = { userId: 7, medicationId: 42, scheduledAt: "2026-11-17 08:00:00" };

    test("round-trips the user, medication and dose time", () => {
        assert.deepEqual(verifyDoseAction(signDoseAction(action)), action);
    });

    test("a login token is not accepted as an action token", () => {
        const login = jwt.sign({ id: 7 }, process.env.JWT_SECRET, { expiresIn: "7d" });
        assert.throws(() => verifyDoseAction(login));
    });

    test("an action token is not accepted as a login token", () => {
        assert.throws(() => jwt.verify(signDoseAction(action), process.env.JWT_SECRET));
    });

    test("a tampered or expired token is rejected", () => {
        const token = signDoseAction(action);
        assert.throws(() => verifyDoseAction(token.slice(0, -2) + "xx"));
        const expired = jwt.sign(
            { purpose: "dose-confirm", uid: 7, mid: 42, at: action.scheduledAt, exp: Math.floor(Date.now() / 1000) - 10 },
            `${process.env.JWT_SECRET}:dose-confirm`
        );
        assert.throws(() => verifyDoseAction(expired));
        assert.throws(() => verifyDoseAction(undefined));
    });
});

describe("confirming a dose", () => {
    let owner, stranger, medId;
    const at = "2026-11-17 08:00:00";

    before(async () => {
        await migrate();
        const mk = async (tag) => (await pool.query(
            "INSERT INTO users (name, email, password_hash) VALUES ($1, $2, 'x') RETURNING id",
            [tag, `${tag}-${Date.now()}@medtrack.test`]
        )).rows[0].id;
        owner = await mk("dose-action-owner");
        stranger = await mk("dose-action-stranger");
        const m = await pool.query("INSERT INTO members (user_id, name) VALUES ($1, 'اختبار') RETURNING id", [owner]);
        medId = (await pool.query(
            "INSERT INTO medications (member_id, name, start_date) VALUES ($1, 'PANADOL', CURRENT_DATE) RETURNING id",
            [m.rows[0].id]
        )).rows[0].id;
    });

    after(async () => {
        await pool.query("DELETE FROM members WHERE user_id = ANY($1)", [[owner, stranger]]);
        await pool.query("DELETE FROM users WHERE id = ANY($1)", [[owner, stranger]]);
        await pool.end();
    });

    test("another user's medication is refused", async () => {
        assert.equal(await confirmDose(stranger, medId, at), null);
        const n = await pool.query("SELECT COUNT(*)::int AS n FROM dose_logs WHERE medication_id = $1", [medId]);
        assert.equal(n.rows[0].n, 0);
    });

    test("the first confirmation creates one taken log", async () => {
        const log = await confirmDose(owner, medId, at, { keepConfirmed: true });
        assert.equal(log.status, "taken");
        assert.ok(log.confirmed_at);
    });

    test("pressing the notification again keeps the first time and adds no row", async () => {
        const first = (await pool.query("SELECT confirmed_at FROM dose_logs WHERE medication_id = $1", [medId])).rows[0];
        await new Promise((r) => setTimeout(r, 20));
        const again = await confirmDose(owner, medId, at, { keepConfirmed: true });
        assert.equal(String(again.confirmed_at), String(first.confirmed_at));
        const n = await pool.query("SELECT COUNT(*)::int AS n FROM dose_logs WHERE medication_id = $1", [medId]);
        assert.equal(n.rows[0].n, 1);
    });

    const count = async () => (await pool.query(
        "SELECT COUNT(*)::int AS n FROM dose_logs WHERE medication_id = $1", [medId])).rows[0].n;

    test("undo: another user cannot undo the dose", async () => {
        assert.equal(await undoDose(stranger, medId, at), false);
        assert.equal(await count(), 1);
    });

    test("undo right after confirming removes the log", async () => {
        assert.equal(await undoDose(owner, medId, at), true);
        assert.equal(await count(), 0);
        assert.equal(await undoDose(owner, medId, at), false);
    });

    test("undo is refused once the window has passed", async () => {
        await confirmDose(owner, medId, at);
        await pool.query("UPDATE dose_logs SET confirmed_at = now() - interval '20 minutes' WHERE medication_id = $1", [medId]);
        assert.equal(await undoDose(owner, medId, at), false);
        assert.equal(await count(), 1);
    });
});
