import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, User, ArrowLeft } from "lucide-react";
import api from "../api";
import AuthLayout from "../components/AuthLayout";
import PasswordInput from "../components/PasswordInput";
import Field, { FormError } from "../components/Field";
import { getEasyMode, setEasyMode } from "../utils/easyMode";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [easy, setEasy] = useState(getEasyMode);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/register", { name, email, password });
      localStorage.setItem("token", res.data.token);
      // حساب جديد بلا أفراد بعد: الخطوة الأولى إضافة فرد
      navigate("/members/new", { replace: true });
    } catch (err) {
      setError(!err.response
        ? "تعذّر الوصول إلى الخادم. نسخة العرض على الإنترنت تعرض الصفحة التعريفية فقط."
        : err.response.data?.error || "تعذّر إنشاء الحساب. جرّب بريداً آخر.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout headline="إنشاء حساب" lead="دقيقة واحدة، ثم أضف أول شخص تتابع أدويته.">
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Field label="الاسم" htmlFor="name">
          <div className="relative">
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-sage-400 pointer-events-none" />
            <input
              id="name"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input-field !pr-11"
            />
          </div>
        </Field>

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
            autoComplete="new-password"
            placeholder="8 أحرف على الأقل"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </Field>

        {/* يُطبَّق فوراً حتى يرى المستخدم الفرق قبل أن يقرّر */}
        <label className="flex items-start gap-3 bg-white dark:bg-forest-900/50 border border-sage-200 dark:border-forest-700/50 rounded-xl p-4 cursor-pointer">
          <input
            type="checkbox"
            checked={easy}
            onChange={(e) => {
              setEasyMode(e.target.checked);
              setEasy(e.target.checked);
            }}
            className="w-5 h-5 mt-0.5 rounded accent-forest-600"
          />
          <span>
            <span className="block font-semibold text-forest-950">الوضع المريح: نص أكبر وأزرار أوسع</span>
            <small className="block text-xs text-forest-700/60 mt-0.5">يمكنك تغييره لاحقاً من صفحة الحساب</small>
          </span>
        </label>

        <FormError>{error}</FormError>

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50" disabled={loading}>
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="جارٍ الإنشاء" />
          ) : (
            <>إنشاء حساب <ArrowLeft className="w-5 h-5" /></>
          )}
        </button>

        <p className="text-center text-sm text-forest-700/70">
          عندك حساب؟{" "}
          <Link to="/login" className="text-forest-600 font-semibold hover:underline">سجّل دخولك</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
