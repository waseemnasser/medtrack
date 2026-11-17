// مدة الجلسة: توكن يوم يتجدّد ما دام مستعملاً، حتى ٧ أيام من الدخول. تشغيلها: npm test
const { test, before, after, describe } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const pool = require("../db");
const migrate = require("../migrate");
const auth = require("../middleware/auth");
const { signSession, SESSION_HEADER } = require("../middleware/auth");

const HOUR = 3600;
const DAY = 24 * HOUR;
const now = () => Math.floor(Date.now() / 1000);

// يشغّل الوسيط على توكن ويُرجع { status, renewed, userId }
async function run(token) {
    const headers = {};
    let status = 200;
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = {
        set: (k, v) => { headers[k] = v; },
        status: (s) => { status = s; return { json: () => { } }; },
    };
    let passed = false;
    await auth(req, res, () => { passed = true; });
    return { status: passed ? 200 : status, renewed: headers[SESSION_HEADER], userId: req.userId };
}

// توكن مصنوع بأوقات في الماضي، كما لو صدر قبل ساعات أو أيام
const forged = (user, { iatAgo, atAgo, ttl = DAY, pv = 0 }) => jwt.sign(
    { id: user.id, pv, ...(atAgo === undefined ? {} : { at: now() - atAgo }), iat: now() - iatAgo, exp: now() - iatAgo + ttl },
    process.env.JWT_SECRET
);

describe("login session lifetime", () => {
    let user;

    before(async () => {
        await migrate();
        user = (await pool.query(
            "INSERT INTO users (name, email, password_hash) VALUES ('جلسة', $1, 'x') RETURNING id, password_version",
            [`session-${Date.now()}@medtrack.test`]
        )).rows[0];
    });

    after(async () => {
        await pool.query("DELETE FROM users WHERE id = $1", [user.id]);
        await pool.end();
    });

    test("a new login token lasts one day", () => {
        const p = jwt.decode(signSession(user));
        assert.ok(Math.abs(p.exp - p.iat - DAY) <= 1);
        assert.ok(Math.abs(p.at - now()) <= 1);
    });

    test("a renewed token never outlives 7 days from login", () => {
        const p = jwt.decode(signSession(user, now() - 6.5 * DAY));
        assert.ok(Math.abs(p.exp - (p.at + 7 * DAY)) <= 1, "capped at login + 7 days");
    });

    test("a fresh token is not renewed", async () => {
        const r = await run(signSession(user));
        assert.equal(r.status, 200);
        assert.equal(r.renewed, undefined);
    });

    test("past half its life, a token is renewed and keeps the login time", async () => {
        const r = await run(forged(user, { iatAgo: 13 * HOUR, atAgo: 2 * DAY }));
        assert.equal(r.status, 200);
        const p = jwt.decode(r.renewed);
        assert.equal(p.at, now() - 2 * DAY);
        assert.ok(p.exp - now() > 23 * HOUR);
    });

    test("no renewal after 7 days from login", async () => {
        const r = await run(forged(user, { iatAgo: 13 * HOUR, atAgo: 7 * DAY - 30 }));
        assert.equal(r.status, 200);
        assert.equal(r.renewed, undefined);
    });

    test("old 7-day tokens without a login time still work and renew from their issue time", async () => {
        const r = await run(forged(user, { iatAgo: 2 * DAY, ttl: 7 * DAY }));
        assert.equal(r.status, 200);
        assert.equal(jwt.decode(r.renewed).at, now() - 2 * DAY);
    });

    test("an expired token or a changed password is refused", async () => {
        assert.equal((await run(forged(user, { iatAgo: 2 * DAY, atAgo: 2 * DAY }))).status, 401);
        assert.equal((await run(forged(user, { iatAgo: 0, atAgo: 0, pv: 99 }))).status, 401);
    });
});
