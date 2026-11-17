import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import api from "../api";
import AuthLayout from "../components/AuthLayout";
import PasswordPair from "../components/PasswordPair";
import { passwordPairError } from "../utils/password";
import { FormError } from "../components/Field";

// الرابط من بريد الاستعادة: /reset-password?token=...
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const invalid = passwordPairError(password, confirm);
    if (invalid) return setError(invalid);
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      // كل الجلسات القديمة خرجت، وهذا الجهاز أيضاً: دخول بالكلمة الجديدة
      localStorage.removeItem("token");
      navigate("/login", { replace: true, state: { notice: "تغيّرت كلمة المرور. سجّل دخولك بالكلمة الجديدة." } });
    } catch (err) {
      setError(!err.response
        ? "تعذّر الوصول إلى الخادم. تأكّد من الاتصال وحاول مجدداً."
        : err.response.data?.error || "تعذّر تغيير كلمة المرور.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <AuthLayout headline="الرابط ناقص" lead="افتح الرابط كما وصلك في البريد، أو اطلب رابطاً جديداً.">
        <Link to="/forgot-password" className="btn-primary w-full flex items-center justify-center gap-2">
          اطلب رابطاً جديداً <ArrowLeft className="w-5 h-5" />
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout headline="كلمة مرور جديدة" lead="اكتبها مرتين. بعد الحفظ تخرج كل الأجهزة، وتدخل بالكلمة الجديدة.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <PasswordPair password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm}
          label="كلمة المرور الجديدة" />

        <FormError>{error}</FormError>
        {error.includes("منتهٍ") && (
          <Link to="/forgot-password" className="block text-sm text-forest-600 font-semibold hover:underline">
            اطلب رابطاً جديداً
          </Link>
        )}

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50" disabled={loading}>
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="جارٍ الحفظ" />
          ) : (
            <>حفظ كلمة المرور <ArrowLeft className="w-5 h-5" /></>
          )}
        </button>
      </form>
    </AuthLayout>
  );
}
