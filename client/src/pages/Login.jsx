import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, ArrowLeft } from "lucide-react";
import api from "../api";
import AuthLayout from "../components/AuthLayout";
import PasswordInput from "../components/PasswordInput";
import Field, { FormError } from "../components/Field";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);
      navigate("/", { replace: true });
    } catch (err) {
      setError(!err.response
        ? "تعذّر الوصول إلى الخادم. نسخة العرض على الإنترنت تعرض الصفحة التعريفية فقط."
        : err.response.data?.error || "تعذّر تسجيل الدخول. تحقّق من البريد وكلمة المرور.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout headline="أهلاً بعودتك" lead="سجّل دخولك لمتابعة جرعات اليوم.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="البريد الإلكتروني" htmlFor="email">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sage-400 pointer-events-none" />
            <input
              id="email"
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field !pl-11"
            />
          </div>
        </Field>

        <Field label="كلمة المرور" htmlFor="password">
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>

        <FormError>{error}</FormError>

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50" disabled={loading}>
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="جارٍ الدخول" />
          ) : (
            <>دخول <ArrowLeft className="w-5 h-5" /></>
          )}
        </button>

        <p className="text-center text-sm text-forest-700/70">
          ما عندك حساب؟{" "}
          <Link to="/register" className="text-forest-600 font-semibold hover:underline">أنشئ حساباً</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
