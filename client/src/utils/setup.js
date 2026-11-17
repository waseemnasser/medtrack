// هل جهّز المستخدم حسابه؟ (فرد واحد على الأقل ودواء واحد)
//
// تحسبه صفحة «اليوم» من الخادم، وتحفظ النتيجة هنا ليعرفها ما خارجها بلا طلب
// إضافي: شريط التثبيت لا يظهر قبلها، ونموذج الدواء يعيد صاحب أول دواء إلى
// «اليوم» ليكمل الخطوة الأخيرة (التذكير). يُمسح عند تسجيل الخروج.
const KEY = "setupDone";
const EVENT = "nabd:setup";

export function isSetupDone() {
    try {
        return localStorage.getItem(KEY) === "1";
    } catch {
        return false;
    }
}

export function markSetupDone() {
    if (isSetupDone()) return;
    try {
        localStorage.setItem(KEY, "1");
    } catch {
        // تخزين محظور — لا شيء يتعطّل، فقط يبقى شريط التثبيت مخفياً
    }
    window.dispatchEvent(new Event(EVENT));
}

// عند الدخول والخروج: قد يكون الحساب التالي على الجهاز حساباً آخر.
// «لاحقاً» على التذكير يبقى — الإشعارات تخص الجهاز
export function clearSetup() {
    try {
        localStorage.removeItem(KEY);
    } catch {
        // لا شيء
    }
}

// يُستدعى عند تغيّر الحالة في الصفحة نفسها
export function onSetupChange(fn) {
    window.addEventListener(EVENT, fn);
    return () => window.removeEventListener(EVENT, fn);
}

// «لاحقاً» على خطوة التذكير — لكل جهاز، لأن الإشعارات لكل جهاز
const PUSH_SKIP_KEY = "pushStepSkipped";

export function isPushStepSkipped() {
    try {
        return localStorage.getItem(PUSH_SKIP_KEY) === "1";
    } catch {
        return false;
    }
}

export function skipPushStep() {
    try {
        localStorage.setItem(PUSH_SKIP_KEY, "1");
    } catch {
        // لا شيء
    }
}
