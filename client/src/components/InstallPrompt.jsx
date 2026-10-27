import { useState, useEffect } from "react";
import { Download } from "lucide-react";

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
        <div className="card p-4 mb-6 flex flex-wrap items-center gap-3">
            <div className="w-10 h-10 bg-forest-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <Download className="w-5 h-5 text-forest-600" />
            </div>
            <p className="flex-1 min-w-[12rem] text-sm font-medium text-forest-950">
                {deferred
                    ? "ثبّت «نبض» على شاشتك ليصلك التذكير بالجرعات"
                    : "لتثبيت التطبيق: اضغط زر المشاركة في سفاري ثم «إضافة إلى الشاشة الرئيسية»"}
            </p>
            <div className="flex gap-2">
                {deferred && <button className="btn-primary !px-4 !py-2 text-sm" onClick={install}>تثبيت</button>}
                <button className="btn-secondary !px-4 !py-2 text-sm" onClick={dismiss}>{deferred ? "لاحقاً" : "حسناً"}</button>
            </div>
        </div>
    );
}
