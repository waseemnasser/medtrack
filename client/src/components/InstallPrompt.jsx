import { useState, useEffect } from "react";
import "./InstallPrompt.css";

function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}
function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
        window.navigator.standalone === true;
}

export default function InstallPrompt() {
    const [deferred, setDeferred] = useState(null);
    // آيفون لا يرسل حدث التثبيت، فنعرف من البداية أننا سنعرض الإرشاد النصي
    const [showIOS] = useState(() => isIOS() && !isStandalone());
    const [hidden, setHidden] = useState(
        localStorage.getItem("installDismissed") === "1"
    );

    useEffect(() => {
        if (isStandalone()) return;

        const onPrompt = (e) => {
            e.preventDefault();
            setDeferred(e);
        };
        window.addEventListener("beforeinstallprompt", onPrompt);


        return () => window.removeEventListener("beforeinstallprompt", onPrompt);
    }, []);

    const dismiss = () => {
        localStorage.setItem("installDismissed", "1");
        setHidden(true);
    };

    const install = async () => {
        if (!deferred) return;
        deferred.prompt();
        await deferred.userChoice;
        setDeferred(null);
    };

    if (hidden || isStandalone()) return null;
    if (!deferred && !showIOS) return null;

    return (
        <div className="install-bar">
            {deferred ? (
                <>
                    <span>ثبّت «دوائي» على شاشتك ليصلك التذكير بالجرعات</span>
                    <div className="install-actions">
                        <button className="install-yes" onClick={install}>تثبيت</button>
                        <button className="install-no" onClick={dismiss}>لاحقاً</button>
                    </div>
                </>
            ) : (
                <>
                    <span>
                        لتثبيت التطبيق: اضغط زر المشاركة في سفاري ثم «إضافة إلى الشاشة الرئيسية»
                    </span>
                    <div className="install-actions">
                        <button className="install-no" onClick={dismiss}>حسناً</button>
                    </div>
                </>
            )}
        </div>
    );
}