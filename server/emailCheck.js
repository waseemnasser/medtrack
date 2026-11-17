// فحص البريد عند إنشاء الحساب.
//
// لا نقبل «النطاقات المشهورة فقط»: ذلك يرفض بريد الجامعة والعمل وiCloud وغيرها.
// بدلاً منه ثلاثة فحوص ترفض البريد الوهمي أو المكتوب خطأً ولا ترفض أحداً حقيقياً:
//   ١. خطأ كتابة في نطاق مشهور (gmial.com) ← نرفض ونقترح الصحيح
//   ٢. بريد مؤقت يُرمى بعد دقائق (mailinator…) ← نرفض
//   ٣. نطاق لا يستقبل بريداً أصلاً (لا سجل MX ولا عنوان) ← نرفض
const dns = require("dns").promises;

// نطاقات حقيقية معروفة: لا تُعامل كأخطاء كتابة لبعضها (mail.com ليس خطأً لـ gmail.com)
const KNOWN = [
    "gmail.com", "googlemail.com",
    "hotmail.com", "hotmail.fr", "hotmail.co.uk", "outlook.com", "outlook.sa", "live.com", "msn.com",
    "yahoo.com", "yahoo.fr", "yahoo.co.uk", "ymail.com", "aol.com",
    "icloud.com", "me.com", "mac.com",
    "proton.me", "protonmail.com", "yandex.com", "yandex.ru", "mail.ru",
    "mail.com", "email.com", "gmx.com", "gmx.de", "zoho.com",
];
// ما نقترحه عند خطأ الكتابة: الأشيع فقط
const POPULAR = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com"];

// خدمات البريد المؤقت الأشهر — قائمة قصيرة مقصودة، لا تدّعي الشمول
const DISPOSABLE = new Set([
    "mailinator.com", "guerrillamail.com", "guerrillamail.net", "sharklasers.com", "grr.la",
    "10minutemail.com", "10minutemail.net", "temp-mail.org", "tempmail.com", "tempmail.net",
    "temp-mail.io", "throwawaymail.com", "yopmail.com", "yopmail.net", "trashmail.com",
    "getnada.com", "nada.email", "dispostable.com", "maildrop.cc", "mailnesia.com",
    "fakeinbox.com", "mintemail.com", "mohmal.com", "emailondeck.com", "tempinbox.com",
    "spamgourmet.com", "mytemp.email", "burnermail.io", "moakt.com", "tmail.ws",
]);

// صيغة عملية: جزء قبل @ بلا مسافات، ونطاق فيه نقطة وامتداد من حرفين فأكثر
const FORMAT = /^[^\s@]+@([a-z0-9-]+\.)+[a-z]{2,}$/;

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

// عدد التعديلات بين كلمتين، وتبديل حرفين متجاورين تعديل واحد (gmial ← gmail)
function distance(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
            if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
                d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
        }
    }
    return d[a.length][b.length];
}

// أخطاء كتابة «com» — غيرها (fr، de، co.uk، com.sa) امتداد حقيقي لا نلمسه
const COM_TYPOS = new Set(["con", "cpm", "cm", "co", "om", "comm", "vom", "xom", "cim", "cmo", "ocm", "coom"]);

// gmial.com أو gmail.con ← gmail.com. null إن لم يكن خطأً واضحاً في نطاق مشهور.
// الاسم والامتداد يُقارنان منفصلين، فلا تُعدّ outlook.de أو email.com أخطاء.
function suggestDomain(domain) {
    if (KNOWN.includes(domain)) return null;
    const dot = domain.indexOf(".");
    const name = domain.slice(0, dot);
    const tld = domain.slice(dot + 1);
    const tldOk = tld === "com" || COM_TYPOS.has(tld);
    if (!tldOk) return null;

    let best = null;
    for (const p of POPULAR) {
        const pName = p.slice(0, p.indexOf("."));
        // الأسماء القصيرة (gmail) تعديل واحد فقط، والأطول (hotmail) حتى اثنين
        const limit = pName.length <= 5 ? 1 : 2;
        const d = distance(name, pName);
        if (d <= limit && (d > 0 || tld !== "com") && (!best || d < best.d)) best = { p, d };
    }
    return best ? best.p : null;
}

// هل يستقبل النطاق بريداً؟ MX أولاً، وإلا عنوان مباشر (القاعدة في RFC 5321).
// عطل في الشبكة لا يرفض أحداً: نرفض فقط حين يقول DNS بوضوح «لا يوجد».
const GONE = new Set(["ENOTFOUND", "ENODATA", "ENONAME", "NXDOMAIN"]);
async function receivesMail(domain, timeoutMs = 5000) {
    const timeout = new Promise((resolve) => setTimeout(() => resolve("unknown"), timeoutMs));
    const lookup = (async () => {
        try {
            const mx = await dns.resolveMx(domain);
            // «Null MX» (نقطة فارغة) = النطاق يعلن أنه لا يستقبل بريداً
            if (mx.some((r) => r.exchange && r.exchange !== ".")) return "yes";
            if (mx.length) return "no";
        } catch (err) {
            if (!GONE.has(err.code)) return "unknown";
        }
        try {
            await dns.lookup(domain);
            return "yes";
        } catch (err) {
            return GONE.has(err.code) ? "no" : "unknown";
        }
    })();
    return Promise.race([lookup, timeout]);
}

/**
 * يُرجع null إن كان البريد مقبولاً، أو { error, suggestion? }.
 * allowTypo: المستخدم أكّد أن بريده صحيح كما كتبه — الاقتراح تنبيه لا منع.
 * resolver: لاختبار الفحص بلا شبكة.
 */
async function checkEmail(raw, { resolver = receivesMail, allowTypo = false } = {}) {
    const email = normalizeEmail(raw);
    if (!FORMAT.test(email)) return { error: "اكتب بريداً إلكترونياً صحيحاً، مثل name@gmail.com" };

    const [local, domain] = email.split("@");
    const typo = allowTypo ? null : suggestDomain(domain);
    if (typo) return { error: `هل تقصد ${local}@${typo}؟ يبدو أن في اسم النطاق خطأ كتابة.`, suggestion: `${local}@${typo}` };

    if (DISPOSABLE.has(domain)) return { error: "لا نقبل البريد المؤقت. استعمل بريدك الدائم، فعليه يصلك رابط استعادة كلمة المرور." };

    if ((await resolver(domain)) === "no") return { error: `النطاق ${domain} لا يستقبل بريداً. تأكّد من كتابة بريدك.` };

    return null;
}

module.exports = { checkEmail, normalizeEmail, suggestDomain, receivesMail };
