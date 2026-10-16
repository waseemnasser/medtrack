import { useState, useEffect } from "react";
import { pushSupported, enablePush, sendTestPush } from "../push";

export default function PushToggle() {
    const [state, setState] = useState("idle"); // idle | on | error
    const [msg, setMsg] = useState("");

    useEffect(() => {
        if (!pushSupported()) return;
        // نفحص الاشتراك الفعلي، لا الإذن فقط
        navigator.serviceWorker.ready
            .then((reg) => reg.pushManager.getSubscription())
            .then((sub) => setState(sub ? "on" : "idle"))
            .catch(() => setState("idle"));
    }, []);

    if (!pushSupported()) return null;

    const turnOn = async () => {
        setMsg("");
        try {
            await enablePush();
            setState("on");
            setMsg("تم تفعيل الإشعارات");
        } catch (err) {
            setState("error");
            setMsg(err.message);
        }
    };

    const test = async () => {
        try {
            await sendTestPush();
            setMsg("أُرسل إشعار تجريبي");
        } catch {
            setMsg("تعذّر الإرسال");
        }
    };

    return (
        <div className="push-box">
            {state === "on" ? (
                <>
                    <span>الإشعارات مفعّلة على هذا الجهاز ✓</span>
                    <button onClick={test}>إرسال إشعار تجريبي</button>
                </>
            ) : (
                <>
                    <span>فعّل الإشعارات ليصلك التذكير حتى والتطبيق مغلق</span>
                    <button className="push-on" onClick={turnOn}>تفعيل</button>
                </>
            )}
            {msg && <p className="push-msg">{msg}</p>}
        </div>
    );
}