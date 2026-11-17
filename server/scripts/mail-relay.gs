/**
 * نبض — مُرسِل البريد عبر Gmail (Google Apps Script)
 * ----------------------------------------------------
 * يُلصق في script.google.com ويُنشر «تطبيق ويب». الخادم (server/mailer.js) يرسل
 * إليه رمز تأكيد التسجيل ورابط الاستعادة، فيرسلها من حساب Gmail صاحب السكربت.
 * الخطوات كاملة في DEPLOY.md («2b. Email»).
 *
 * SECRET: نفس قيمة MAIL_RELAY_SECRET على Render. من لا يعرفه لا يرسل شيئاً.
 */
const SECRET = "ضع-هنا-نفس-قيمة-MAIL_RELAY_SECRET";

function doPost(e) {
  try {
    const m = JSON.parse(e.postData.contents);
    if (!m || m.secret !== SECRET) return reply({ ok: false, error: "unauthorized" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(m.to || ""))) return reply({ ok: false, error: "bad recipient" });

    MailApp.sendEmail({
      to: m.to,
      subject: String(m.subject || "").slice(0, 200),
      body: String(m.text || ""),
      htmlBody: String(m.html || ""),
      name: String(m.name || "نبض"),
    });
    return reply({ ok: true, left: MailApp.getRemainingDailyQuota() });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message || err) });
  }
}

// لتجربة السكربت من المحرّر: اختر testSend ثم «تشغيل» — تصلك رسالة على بريدك،
// ويطلب Google الإذن بالإرسال مرة واحدة
function testSend() {
  MailApp.sendEmail(Session.getActiveUser().getEmail(), "نبض — تجربة", "السكربت يعمل.");
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
