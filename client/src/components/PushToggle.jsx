import { useState, useEffect } from "react";
import { pushSupported, pushPermission, enablePush, syncPush, sendTestPush } from "../push";
import { Bell, BellOff } from "lucide-react";

// رسالة الخادم إن وُجدت، وإلا رسالة عامة — لا نخفي سبب الفشل عن المستخدم
const reason = (err, fallback) => {
    if (err.code === "ECONNABORTED") return "الخادم لم يردّ في الوقت المحدد. تأكّد من الاتصال ثم أعد المحاولة.";
    if (err.code === "ERR_NETWORK") return "تعذّر الوصول إلى الخادم. تأكّد أنه يعمل.";
    return err.response?.data?.error || err.message || fallback;
};

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
        <div className="card p-5">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-forest-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    {state === "blocked"
                        ? <BellOff className="w-5 h-5 text-red-500" />
                        : <Bell className="w-5 h-5 text-forest-600" />}
                </div>
                <div className="flex-1 min-w-0">
                    {state === "on" && (
                        <>
                            <p className="font-semibold text-forest-950">الإشعارات مفعّلة على هذا الجهاز</p>
                            <button onClick={test} disabled={busy} className="btn-secondary !px-4 !py-2 text-sm mt-3">
                                {busy ? "جارٍ الإرسال..." : "إرسال إشعار تجريبي"}
                            </button>
                        </>
                    )}
                    {(state === "idle" || state === "checking") && (
                        <>
                            <p className="font-semibold text-forest-950">فعّل الإشعارات</p>
                            <p className="text-sm text-forest-700/60 mt-0.5">ليصلك التذكير حتى والتطبيق مغلق.</p>
                            <button onClick={turnOn} disabled={busy || state === "checking"} className="btn-primary !px-4 !py-2 text-sm mt-3">
                                {busy ? "جارٍ التفعيل..." : "تفعيل"}
                            </button>
                        </>
                    )}
                    {state === "blocked" && (
                        <p className="text-sm text-forest-800">
                            الإشعارات محظورة لهذا الموقع. فعّلها من إعدادات المتصفح (رمز القفل بجانب الرابط) ثم حدّث الصفحة.
                        </p>
                    )}
                    {msg && <p className="text-sm text-forest-700/80 mt-2" role="status">{msg}</p>}
                </div>
            </div>
        </div>
    );
}
