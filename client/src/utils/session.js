import { disablePushForThisDevice } from "../push";

// تسجيل الخروج — من صفحة الحساب ومن الشريط الجانبي.
// هذا الجهاز لا يستقبل تذكيرات هذا الحساب بعد الخروج —
// مهم إن كان الحاسوب مشتركاً بين أفراد العائلة
export async function logout(navigate) {
    try {
        await disablePushForThisDevice();
    } catch {
        // الخادم لا يستجيب؟ نكمل الخروج على أي حال
    }
    localStorage.removeItem("token");
    navigate("/login", { replace: true });
}
