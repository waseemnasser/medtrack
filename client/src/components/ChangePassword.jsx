import { useState } from "react";
import { KeyRound } from "lucide-react";
import api from "../api";
import PasswordInput from "./PasswordInput";
import PasswordPair from "./PasswordPair";
import { passwordPairError } from "../utils/password";
import Field, { FormError } from "./Field";
import { useFeedback } from "../feedback/context";

// تغيير كلمة المرور من صفحة الحساب: الحالية، ثم الجديدة مرتين.
// بعد الحفظ يبقى هذا الجهاز داخلاً (توكن جديد) وتخرج الأجهزة الأخرى.
export default function ChangePassword() {
    const { toast } = useFeedback();
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState("");
    const [password, setPassword] = useState("");
    const [confirm, setConfirm] = useState("");
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    const reset = () => {
        setOpen(false);
        setCurrent(""); setPassword(""); setConfirm(""); setError("");
    };

    const submit = async (e) => {
        e.preventDefault();
        const invalid = passwordPairError(password, confirm);
        if (invalid) return setError(invalid);
        if (password === current) return setError("كلمة المرور الجديدة هي نفسها الحالية");
        setError("");
        setSaving(true);
        try {
            const res = await api.post("/auth/change-password", { current_password: current, new_password: password });
            localStorage.setItem("token", res.data.token);
            reset();
            toast("تغيّرت كلمة المرور، وخرجت الأجهزة الأخرى");
        } catch (err) {
            setError(!err.response
                ? "تعذّر الوصول إلى الخادم. حاول مجدداً."
                : err.response.data?.error || "تعذّر تغيير كلمة المرور.");
        } finally {
            setSaving(false);
        }
    };

    if (!open) {
        return (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <p className="flex-1 text-forest-800">
                    غيّرها متى شئت. تحتاج كلمة المرور الحالية، وبعد التغيير تخرج كل الأجهزة الأخرى.
                </p>
                <button type="button" onClick={() => setOpen(true)} className="btn-secondary flex items-center justify-center gap-2 flex-shrink-0">
                    <KeyRound className="w-5 h-5" /> تغيير كلمة المرور
                </button>
            </div>
        );
    }

    return (
        <form className="space-y-4" onSubmit={submit}>
            <Field label="كلمة المرور الحالية" htmlFor="current-password">
                <PasswordInput
                    id="current-password"
                    autoComplete="current-password"
                    value={current}
                    onChange={(e) => setCurrent(e.target.value)}
                    required
                />
            </Field>

            <PasswordPair password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm}
                label="كلمة المرور الجديدة" idPrefix="account-new" />

            <FormError>{error}</FormError>

            <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={reset} className="btn-secondary">إلغاء</button>
                <button type="submit" disabled={saving} className="btn-primary flex items-center justify-center gap-2 disabled:opacity-50">
                    {saving
                        ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="جارٍ الحفظ" />
                        : "حفظ كلمة المرور"}
                </button>
            </div>
        </form>
    );
}
