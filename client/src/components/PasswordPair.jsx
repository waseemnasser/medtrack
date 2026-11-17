import PasswordInput from "./PasswordInput";
import Field from "./Field";
import { MIN_PASSWORD } from "../utils/password";

/**
 * كلمة مرور جديدة مرتين — في إنشاء الحساب، والاستعادة، وتغييرها من الحساب.
 * التنبيه يظهر تحت الحقل الثاني ما إن يختلف عن الأول، لا بعد الضغط على «حفظ».
 */
export default function PasswordPair({ password, confirm, onPassword, onConfirm, label = "كلمة المرور", idPrefix = "new" }) {
    const mismatch = confirm.length > 0 && password !== confirm;
    return (
        <>
            <Field label={label} htmlFor={`${idPrefix}-password`}>
                <PasswordInput
                    id={`${idPrefix}-password`}
                    autoComplete="new-password"
                    placeholder="8 أحرف على الأقل"
                    value={password}
                    onChange={(e) => onPassword(e.target.value)}
                    minLength={MIN_PASSWORD}
                    required
                />
            </Field>
            <Field label="أعد كتابة كلمة المرور" htmlFor={`${idPrefix}-confirm`}>
                <PasswordInput
                    id={`${idPrefix}-confirm`}
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => onConfirm(e.target.value)}
                    aria-invalid={mismatch}
                    aria-describedby={mismatch ? `${idPrefix}-mismatch` : undefined}
                    required
                />
                {mismatch && (
                    <p id={`${idPrefix}-mismatch`} className="text-xs text-red-600 dark:text-red-400 mt-1.5">
                        كلمتا المرور غير متطابقتين
                    </p>
                )}
            </Field>
        </>
    );
}
