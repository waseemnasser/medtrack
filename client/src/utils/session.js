import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { disablePushForThisDevice } from "../push";
import { useFeedback } from "../feedback/context";
import { clearSetup } from "./setup";

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
    clearSetup();
    navigate("/login", { replace: true });
}

// زر الخروج يسأل أولاً: الخروج بالخطأ يوقف التذكيرات على هذا الجهاز
export function useLogout() {
    const navigate = useNavigate();
    const { confirm } = useFeedback();
    return useCallback(async () => {
        const ok = await confirm({
            title: "تسجيل الخروج؟",
            message: "لن تصل تذكيرات الجرعات إلى هذا الجهاز حتى تسجّل الدخول مجدداً.",
            confirmLabel: "تسجيل الخروج",
            danger: true,
        });
        if (ok) await logout(navigate);
    }, [confirm, navigate]);
}
