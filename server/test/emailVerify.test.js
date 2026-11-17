// رمز تأكيد البريد عند التسجيل. تشغيلها: npm test
// الرسائل لا تُرسل: نلتقطها لنقرأ الرمز منها. تُنشئ مستخدماً مؤقتاً وتحذفه.

const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const mailer = require("../mailer");
const sent = [];
mailer.sendMail = async (m) => { sent.push(m); };   // قبل تحميل emailVerify.js
const pool = require("../db");
const migrate = require("../migrate");
const { issueCode, verifyCode, MAX_ATTEMPTS } = require("../emailVerify");

const lastCode = () => sent.at(-1).text.match(/\b(\d{6})\b/)[1];
const wrong = (code) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

describe("email verification code", () => {
    let user;

    before(async () => {
        await migrate();
        user = (await pool.query(
            "INSERT INTO users (name, email, password_hash) VALUES ('تحقق', $1, 'x') RETURNING id, name, email",
            [`verify-${Date.now()}@medtrack.test`]
        )).rows[0];
    });

    after(async () => {
        await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
        await pool.end();
    });

    test("a new account starts unverified", async () => {
        const r = await pool.query("SELECT email_verified_at FROM users WHERE id = $1", [user.id]);
        assert.equal(r.rows[0].email_verified_at, null);
    });

    test("the code is mailed, and only its hash is stored", async () => {
        assert.deepEqual(await issueCode(user, { force: true }), { sent: true });
        const code = lastCode();
        assert.match(code, /^\d{6}$/);
        const row = (await pool.query("SELECT code_hash FROM email_codes WHERE user_id = $1", [user.id])).rows[0];
        assert.notEqual(row.code_hash, code);
        assert.ok(!row.code_hash.includes(code));
    });

    test("a second code within a minute is not sent", async () => {
        const r = await issueCode(user);
        assert.equal(r.sent, false);
        assert.ok(r.wait > 0 && r.wait <= 60);
    });

    test("a wrong code says how many tries are left", async () => {
        const r = await verifyCode(user.email, wrong(lastCode()));
        assert.match(r.error, /غير صحيح/);
        assert.equal(r.user, undefined);
    });

    test("too many wrong codes kill the code", async () => {
        for (let i = 1; i < MAX_ATTEMPTS - 1; i++) await verifyCode(user.email, wrong(lastCode()));
        const r = await verifyCode(user.email, wrong(lastCode()));
        assert.equal(r.expired, true);
        // حتى الرمز الصحيح لم يعد يعمل
        assert.equal((await verifyCode(user.email, lastCode())).expired, true);
    });

    test("an expired code is refused", async () => {
        await issueCode(user, { force: true });
        await pool.query("UPDATE email_codes SET expires_at = now() - interval '1 minute' WHERE user_id = $1", [user.id]);
        assert.equal((await verifyCode(user.email, lastCode())).expired, true);
    });

    test("the right code (any email case) verifies the account", async () => {
        await issueCode(user, { force: true });
        const r = await verifyCode(user.email.toUpperCase(), ` ${lastCode()} `);
        assert.equal(r.user?.id, user.id);
        const row = (await pool.query("SELECT email_verified_at FROM users WHERE id = $1", [user.id])).rows[0];
        assert.ok(row.email_verified_at);
        const left = await pool.query("SELECT 1 FROM email_codes WHERE user_id = $1", [user.id]);
        assert.equal(left.rows.length, 0);
    });
});
