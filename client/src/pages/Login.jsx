import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import AuthLayout from "../components/AuthLayout";
import PasswordInput from "../components/PasswordInput";

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
    <AuthLayout kicker="تسجيل الدخول" headline="أهلاً بعودتك." lead="سجّل دخولك لمتابعة جرعات اليوم.">
      <form className="auth-form" onSubmit={handleSubmit}>

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
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        {error && <div className="error">{error}</div>}

        <button type="submit" className="auth-cta" disabled={loading}>
          {loading ? "جارٍ الدخول..." : "دخول"}
        </button>

        <p className="auth-switch">
          ما عندك حساب؟ <Link to="/register">أنشئ حساباً</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
