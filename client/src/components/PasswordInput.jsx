import { useState } from "react";

/**
 * حقل كلمة مرور مع زر «إظهار».
 * المستخدم الكبير في السن يخطئ في الكتابة كثيراً،
 * ورؤية ما كتبه أسهل من إعادة المحاولة مرات.
 */
export default function PasswordInput({ id, ...props }) {
    const [show, setShow] = useState(false);

    return (
        <div className="password-wrap">
            <input id={id} type={show ? "text" : "password"} {...props} />
            <button
                type="button"
                className="password-toggle"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                aria-pressed={show}
            >
                {show ? "إخفاء" : "إظهار"}
            </button>
        </div>
    );
}
