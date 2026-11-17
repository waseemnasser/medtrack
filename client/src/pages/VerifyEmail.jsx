import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, MailCheck } from "lucide-react";
import api from "../api";
import AuthLayout from "../components/AuthLayout";
import Field, { FormError } from "../components/Field";
import { clearSetup } from "../utils/setup";

const RESEND_SECONDS = 60; // مثل الخادم (emailVerify.js)

// تأكيد البريد: رمز من 6 أرقام وصل بعد إنشاء الحساب (أو بعد دخول حساب لم يُؤكَّد)
// /verify-email?email=… — البريد في الرابط حتى لا يضيع إن حُدّثت الصفحة
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const email = params.get("email") || "";
  // من صفحة التسجيل: الحساب جديد، فالخطوة التالية إضافة أول فرد
  const fresh = Boolean(location.state?.fresh);

  const [code, setCode] = useState("");
  const [error, setError] = useState(location.state?.mailFailed
    ? "تعذّر إرسال الرمز الآن. اضغط «أرسل الرمز مجدداً» بعد قليل." : "");
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wait, setWait] = useState(RESEND_SECONDS); // الرمز أُرسل للتو
  const [resent, setResent] = useState(false);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) return setError("الرمز 6 أرقام.");
    setError("");
    setLoading(true);
    try {
      const res = await api.post("/auth/verify-email", { email, code });
      localStorage.setItem("token", res.data.token);
      clearSetup();
      navigate(fresh ? "/members/new" : "/", { replace: true });
    } catch (err) {
      setExpired(Boolean(err.response?.data?.expired));
      setError(!err.response
        ? "تعذّر الوصول إلى الخادم. تأكّد من الاتصال وحاول مجدداً."
        : err.response.data?.error || "تعذّر التأكيد. حاول مجدداً.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    setExpired(false);
    setCode("");
    try {
      await api.post("/auth/resend-code", { email });
      setResent(true);
      setWait(RESEND_SECONDS);
    } catch (err) {
      setError(err.response?.data?.error || "تعذّر إرسال الرمز. حاول بعد قليل.");
    }
  };

  if (!email) {
    return (
      <AuthLayout headline="تأكيد البريد" lead="افتح هذه الصفحة من إنشاء الحساب أو تسجيل الدخول.">
        <Link to="/login" className="btn-primary w-full flex items-center justify-center gap-2">
          تسجيل الدخول <ArrowLeft className="w-5 h-5" />
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout headline="أكّد بريدك" lead="خطوة أخيرة قبل الدخول.">
      <form className="space-y-4" onSubmit={submit}>
        <div className="card p-4 flex items-start gap-3 text-forest-800">
          <MailCheck className="w-6 h-6 text-forest-600 flex-shrink-0" />
          <p className="text-sm">
            أرسلنا رمزاً من 6 أرقام إلى <bdi dir="ltr" className="font-semibold">{email}</bdi>.
            صالح 15 دقيقة. لم يصل؟ تفقّد مجلد الرسائل غير المرغوب فيها.
          </p>
        </div>

        <Field label="رمز التأكيد" htmlFor="code">
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={6}
            placeholder="••••••"
            value={code}
            // أرقام عربية-هندية (٠-٩) من لوحة المفاتيح العربية تتحوّل إلى لاتينية
            onChange={(e) => setCode(e.target.value
              .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
              .replace(/\D/g, "").slice(0, 6))}
            required
            autoFocus
            className="input-field text-center text-2xl font-bold tracking-[0.5em]"
          />
        </Field>

        <FormError>{error}</FormError>

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50"
          disabled={loading || code.length !== 6 || expired}>
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="جارٍ التأكيد" />
          ) : (
            <>تأكيد <ArrowLeft className="w-5 h-5" /></>
          )}
        </button>

        <div className="text-center text-sm text-forest-700/70 space-y-2">
          {resent && wait > 0 && <p role="status">أرسلنا رمزاً جديداً.</p>}
          {wait > 0 ? (
            <p>يمكنك طلب رمز جديد بعد <span className="font-semibold tabular-nums">{wait}</span> ثانية</p>
          ) : (
            <button type="button" onClick={resend} className="text-forest-600 font-semibold hover:underline">
              أرسل الرمز مجدداً
            </button>
          )}
          <p>
            البريد خطأ؟{" "}
            <Link to="/register" className="text-forest-600 font-semibold hover:underline">أنشئ الحساب من جديد</Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
