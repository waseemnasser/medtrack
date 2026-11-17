// قواعد كلمة المرور في الواجهة — الخادم يفحص الطول نفسه (routes/auth.js)
export const MIN_PASSWORD = 8;

// رسالة الخطأ قبل الإرسال، أو null إن كانت الكلمتان صالحتين
export function passwordPairError(password, confirm) {
    if (password.length < MIN_PASSWORD) return "كلمة المرور لازم تكون 8 أحرف على الأقل";
    if (password !== confirm) return "كلمتا المرور غير متطابقتين";
    return null;
}
