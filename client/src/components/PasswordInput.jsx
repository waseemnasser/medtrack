import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/**
 * حقل كلمة مرور مع زر «إظهار».
 * المستخدم الكبير في السن يخطئ في الكتابة كثيراً،
 * ورؤية ما كتبه أسهل من إعادة المحاولة مرات.
 */
export default function PasswordInput({ id, className = "input-field", ...props }) {
    const [show, setShow] = useState(false);

    return (
        <div className="relative">
            <input id={id} type={show ? "text" : "password"} className={`${className} !pl-12`} {...props} />
            <button
                type="button"
                className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-lg text-forest-700/60 hover:text-forest-700 hover:bg-sage-50"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                aria-pressed={show}
            >
                {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
        </div>
    );
}
