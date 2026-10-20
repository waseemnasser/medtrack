import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import AuthLayout from "../components/AuthLayout";
import PasswordInput from "../components/PasswordInput";
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
    <AuthLayout tagline="حساب واحد يكفي العائلة كلها">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2 className="auth-title">إنشاء حساب</h2>
        <p className="auth-sub">دقيقة واحدة، ثم أضف أول فرد من العائلة</p>

        <label htmlFor="name">الاسم</label>
        <input
          id="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />

        <label htmlFor="email">البريد الإلكتروني</label>
        <input
          id="email"
          type="email"
          dir="ltr"
          autoComplete="email"
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label htmlFor="password">كلمة المرور</label>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          placeholder="8 أحرف على الأقل"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          minLength={8}
          required
        />

        {/* يُطبَّق فوراً حتى يرى المستخدم الفرق قبل أن يقرّر */}
        <label className="auth-check">
          <input
            type="checkbox"
            checked={easy}
            onChange={(e) => {
              setEasyMode(e.target.checked);
              setEasy(e.target.checked);
            }}
          />
          <span>
            الوضع المريح: نص أكبر وأزرار أوسع
            <small>يمكنك تغييره لاحقاً من صفحة الحساب</small>
          </span>
        </label>

        {error && <div className="error">{error}</div>}

        <button type="submit" className="auth-cta" disabled={loading}>
          {loading ? "جارٍ الإنشاء..." : "إنشاء حساب"}
        </button>

        <p className="auth-switch">
          عندك حساب؟ <Link to="/login">سجّل دخولك</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
