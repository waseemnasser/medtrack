// فحص البريد عند إنشاء الحساب — بلا شبكة: نطاق «لا يستقبل بريداً» يُحاكى. تشغيلها: npm test
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const { checkEmail, suggestDomain, normalizeEmail } = require("../emailCheck");

// كل النطاقات تستقبل بريداً إلا ما في القائمة
const fakeDns = (dead = []) => async (domain) => (dead.includes(domain) ? "no" : "yes");

describe("email check at sign-up", () => {
    test("normal providers, university and work emails pass", async () => {
        for (const e of ["sara@gmail.com", "k@hotmail.com", "a.b@outlook.sa", "x@icloud.com",
            "w@proton.me", "student@iust.edu.sy", "dr@clinic.co.uk", "m@hotmail.fr", "z@email.com", "q@mail.com"]) {
            assert.equal(await checkEmail(e, { resolver: fakeDns() }), null, e);
        }
    });

    test("capitals and spaces are normalised", () => {
        assert.equal(normalizeEmail("  Sara@Gmail.COM "), "sara@gmail.com");
    });

    test("bad format is refused", async () => {
        for (const e of ["sara", "sara@", "sara@gmail", "sa ra@gmail.com", "@gmail.com"]) {
            assert.ok((await checkEmail(e, { resolver: fakeDns() }))?.error, e);
        }
    });

    test("typos in popular domains get a suggestion", async () => {
        const cases = {
            "gmial.com": "gmail.com", "gmal.com": "gmail.com", "gmail.con": "gmail.com", "gmail.co": "gmail.com",
            "hotmial.com": "hotmail.com", "hotmal.com": "hotmail.com", "hotmail.cm": "hotmail.com",
            "yaho.com": "yahoo.com", "outlok.com": "outlook.com", "iclod.com": "icloud.com",
        };
        for (const [typo, right] of Object.entries(cases)) {
            assert.equal(suggestDomain(typo), right, typo);
            const r = await checkEmail(`sara@${typo}`, { resolver: fakeDns() });
            assert.equal(r?.suggestion, `sara@${right}`, typo);
        }
    });

    test("real look-alike domains are not called typos", () => {
        for (const d of ["mail.com", "email.com", "ymail.com", "outlook.de", "hotmail.fr", "yahoo.com.sa", "gmx.com"]) {
            assert.equal(suggestDomain(d), null, d);
        }
    });

    test("the user can keep a flagged address as typed", async () => {
        assert.equal(await checkEmail("sara@gmial.com", { resolver: fakeDns(), allowTypo: true }), null);
    });

    test("disposable inboxes are refused", async () => {
        assert.ok((await checkEmail("x@mailinator.com", { resolver: fakeDns() }))?.error);
        assert.ok((await checkEmail("x@yopmail.com", { resolver: fakeDns() }))?.error);
    });

    test("a domain that receives no mail is refused, a network problem is not", async () => {
        assert.match((await checkEmail("x@asdfghjk.com", { resolver: fakeDns(["asdfghjk.com"]) })).error, /لا يستقبل/);
        assert.equal(await checkEmail("x@slow-dns.com", { resolver: async () => "unknown" }), null);
    });
});
