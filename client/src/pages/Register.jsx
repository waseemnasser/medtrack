import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, User, ArrowLeft } from "lucide-react";
import api from "../api";
import AuthLayout from "../components/AuthLayout";
import PasswordPair from "../components/PasswordPair";
import { passwordPairError } from "../utils/password";
import Field, { FormError } from "../components/Field";
import { getEasyMode, setEasyMode } from "../utils/easyMode";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  // اقتراح الخادم لخطأ كتابة في النطاق (gmial.com ← gmail.com)
  const [suggestion, setSuggestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [easy, setEasy] = useState(getEasyMode);
  const navigate = useNavigate();

  // keepEmail: المستخدم أكّد أن بريده صحيح كما كتبه رغم الاقتراح
  const register = async (address, keepEmail = false) => {
    const invalid = passwordPairError(password, confirm);
    if (invalid) return setError(invalid);
    setError("");
    setSuggestion("");
    setLoading(true);
    try {
      const res = await api.post("/auth/register", { name, email: address, password, keep_email: keepEmail });
      localStorage.setItem("token", res.data.token);
      // حساب جديد بلا أفراد بعد: الخطوة الأولى إضافة فرد
      navigate("/members/new", { replace: true });
    } catch (err) {
      setSuggestion(err.response?.data?.suggestion || "");
      setError(!err.response
        ? "تعذّر الوصول إلى الخادم. نسخة العرض على الإنترنت تعرض الصفحة التعريفية فقط."
        : err.response.data?.error || "تعذّر إنشاء الحساب. جرّب بريداً آخر.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    register(email);
  };

  const acceptSuggestion = () => {
    setEmail(suggestion);
    register(suggestion);
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
              onChange={(e) => { setEmail(e.target.value); setSuggestion(""); }}
              required
              className="input-field !pl-11"
            />
          </div>
          {/* خطأ كتابة محتمل في النطاق: نقترح ولا نمنع — قد يكون البريد صحيحاً فعلاً */}
          {suggestion && (
            <div role="alert" className="mt-2 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm">
              <p className="text-forest-900 dark:text-forest-100">
                هل تقصد <bdi dir="ltr" className="font-semibold">{suggestion}</bdi>؟
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <button type="button" onClick={acceptSuggestion} disabled={loading} className="btn-primary !py-1.5 !px-3 text-sm">
                  نعم، استعمله
                </button>
                <button type="button" onClick={() => register(email, true)} disabled={loading} className="btn-secondary !py-1.5 !px-3 text-sm">
                  بريدي صحيح كما كتبته
                </button>
              </div>
            </div>
          )}
        </Field>

        <PasswordPair password={password} confirm={confirm} onPassword={setPassword} onConfirm={setConfirm} />

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

        <FormError>{suggestion ? "" : error}</FormError>

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
