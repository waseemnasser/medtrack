import { useState, useEffect } from "react";
import { pushSupported, pushPermission, enablePush, syncPush, sendTestPush } from "../push";
import "./PushToggle.css";

// رسالة الخادم إن وُجدت، وإلا رسالة عامة — لا نخفي سبب الفشل عن المستخدم
const reason = (err, fallback) => err.response?.data?.error || err.message || fallback;

export default function PushToggle({ hideWhenOn = false }) {
    const [state, setState] = useState(() => (pushPermission() === "denied" ? "blocked" : "checking")); // checking | idle | on | blocked
    const [msg, setMsg] = useState("");
    const [busy, setBusy] = useState(false);

    // عند الفتح: إن كان الجهاز مشتركاً نعيد ربطه بالحساب الحالي في الخادم.
    // بدون ذلك يظهر «مفعّلة» بينما الخادم يرسل التذكيرات لحساب آخر.
    useEffect(() => {
        if (!pushSupported() || pushPermission() === "denied") return;
        let alive = true;
        syncPush()
            .then((on) => alive && setState(on ? "on" : "idle"))
            .catch(() => alive && setState("idle"));
        return () => { alive = false; };
    }, []);

    if (!pushSupported()) return null;
    // في صفحة اليوم نعرض الصندوق فقط لمن لم يفعّل الإشعارات بعد
    if (hideWhenOn && (state === "on" || state === "checking") && !msg) return null;

    const turnOn = async () => {
        setMsg("");
        setBusy(true);
        try {
            await enablePush();
            setState("on");
            setMsg("تم تفعيل الإشعارات على هذا الجهاز");
        } catch (err) {
            setState(pushPermission() === "denied" ? "blocked" : "idle");
            setMsg(reason(err, "تعذّر تفعيل الإشعارات"));
        } finally {
            setBusy(false);
        }
    };

    const test = async () => {
        setMsg("");
        setBusy(true);
        try {
            const res = await sendTestPush();
            setMsg(res.devices > 1
                ? `أُرسل إشعار تجريبي إلى ${res.devices} أجهزة — يظهر خلال ثوانٍ`
                : "أُرسل إشعار تجريبي — يظهر خلال ثوانٍ");
        } catch (err) {
            setMsg(reason(err, "تعذّر الإرسال، تأكّد أن الخادم يعمل"));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="push-box">
            {state === "on" && (
                <>
                    <span>الإشعارات مفعّلة على هذا الجهاز ✓</span>
                    <button onClick={test} disabled={busy}>{busy ? "جارٍ الإرسال..." : "إرسال إشعار تجريبي"}</button>
                </>
            )}
            {(state === "idle" || state === "checking") && (
                <>
                    <span>فعّل الإشعارات ليصلك التذكير حتى والتطبيق مغلق</span>
                    <button className="push-on" onClick={turnOn} disabled={busy || state === "checking"}>
                        {busy ? "جارٍ التفعيل..." : "تفعيل"}
                    </button>
                </>
            )}
            {state === "blocked" && (
                <span>الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (رمز القفل بجانب الرابط) ثم حدّث الصفحة.</span>
            )}
            {msg && <p className="push-msg">{msg}</p>}
        </div>
    );
}
