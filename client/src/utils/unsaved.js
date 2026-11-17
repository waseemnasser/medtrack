import { useEffect, useRef, useState } from "react";
import { useBlocker } from "react-router-dom";
import { useFeedback } from "../feedback/context";

/*
  «تغادر دون حفظ؟» — للنماذج (فرد، دواء، موعد).

  snapshot: نص يمثّل ما في النموذج (JSON.stringify للحقول)
  ready:    true بعد تحميل البيانات — عندها تُحفظ النسخة الأصلية للمقارنة،
            فلا يُعدّ ملء النموذج من الخادم «تعديلاً»

  يسأل عند الرجوع أو الضغط على رابط داخل التطبيق، والمتصفح نفسه يسأل
  عند إغلاق التبويب أو تحديث الصفحة. بعد الحفظ أو الحذف استدعِ allowLeave()
  قبل navigate، فلا يسأل عن تعديلات حُفظت للتو.
*/
export function useUnsavedChanges(snapshot, ready = true) {
    const { confirm } = useFeedback();
    const [baseline, setBaseline] = useState(null);
    // النسخة الأصلية: أول snapshot بعد اكتمال التحميل (يُضبط أثناء العرض، لا في effect)
    if (ready && baseline === null) setBaseline(snapshot);
    const dirty = baseline !== null && snapshot !== baseline;

    const leaving = useRef(false);
    const blocker = useBlocker(({ currentLocation, nextLocation }) =>
        dirty
        && !leaving.current
        && currentLocation.pathname !== nextLocation.pathname
        // تسجيل الخروج سأل المستخدم من قبل — لا نافذة ثانية
        && nextLocation.pathname !== "/login"
    );

    useEffect(() => {
        if (blocker.state !== "blocked") return;
        confirm({
            title: "تغادر دون حفظ؟",
            message: "ستضيع التعديلات التي لم تحفظها في هذه الصفحة.",
            confirmLabel: "غادر دون حفظ",
            cancelLabel: "تابع التعديل",
            danger: true,
        }).then((ok) => (ok ? blocker.proceed() : blocker.reset()));
    }, [blocker, confirm]);

    // إغلاق التبويب أو تحديث الصفحة: نافذة المتصفح نفسه (نصها لا يُخصَّص)
    useEffect(() => {
        if (!dirty) return;
        const onBeforeUnload = (e) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, [dirty]);

    return {
        dirty,
        allowLeave: () => { leaving.current = true; },
    };
}
