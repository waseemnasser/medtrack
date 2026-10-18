import { createContext, useContext } from "react";

export const FeedbackContext = createContext(null);

/**
 * نافذة التأكيد ورسائل التنبيه القصيرة — بديل confirm() و alert().
 *
 *   const { confirm, toast } = useFeedback();
 *   if (!(await confirm({ title, message, confirmLabel, danger: true }))) return;
 *   toast("حُذف الموعد");
 *   toast("تعذّر الحذف، حاول مجدداً", "error");
 */
export function useFeedback() {
    const ctx = useContext(FeedbackContext);
    if (!ctx) throw new Error("useFeedback يجب أن يُستخدم داخل FeedbackProvider");
    return ctx;
}
