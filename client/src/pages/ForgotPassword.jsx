import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Mail, ArrowLeft, MailCheck } from "lucide-react";
import api from "../api";
import AuthLayout from "../components/AuthLayout";
import Field, { FormError } from "../components/Field";

// «نسيت كلمة المرور»: رابط استعادة على البريد، صالح ٣٠ دقيقة
export default function ForgotPassword() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || "");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch (err) {
      setError(!err.response
        ? "تعذّر الوصول إلى الخادم. تأكّد من الاتصال وحاول مجدداً."
        : err.response.data?.error || "تعذّر إرسال الرابط. حاول مجدداً.");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <AuthLayout headline="تفقّد بريدك" lead="أرسلنا رابط الاستعادة إن كان البريد مسجلاً عندنا.">
        <div className="card p-6 space-y-3 text-forest-800">
          <MailCheck className="w-10 h-10 text-forest-600" />
          {/* الرسالة نفسها لكل بريد: لا نكشف أي البُرُد لها حسابات */}
          <p>
            إن كان <bdi dir="ltr" className="font-semibold">{email}</bdi> مسجلاً في نبض،
            ستصله رسالة فيها رابط لتعيين كلمة مرور جديدة.
          </p>
          <p className="text-sm text-forest-700/70">
            الرابط صالح 30 دقيقة ولمرة واحدة. لم تصل الرسالة؟ تفقّد مجلد الرسائل غير المرغوب فيها،
            أو اطلب رابطاً جديداً بعد دقيقة.
          </p>
          <button type="button" onClick={() => setSent(false)} className="text-sm text-forest-600 font-semibold hover:underline">
            إرسال الرابط مجدداً
          </button>
        </div>
        <p className="text-center text-sm text-forest-700/70 mt-6">
          <Link to="/login" className="text-forest-600 font-semibold hover:underline">العودة إلى تسجيل الدخول</Link>
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout headline="نسيت كلمة المرور؟" lead="اكتب بريدك، ونرسل لك رابطاً لتعيين كلمة مرور جديدة.">
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

        <FormError>{error}</FormError>

        <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50" disabled={loading}>
          {loading ? (
            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" aria-label="جارٍ الإرسال" />
          ) : (
            <>أرسل رابط الاستعادة <ArrowLeft className="w-5 h-5" /></>
          )}
        </button>

        <p className="text-center text-sm text-forest-700/70">
          تذكّرتها؟{" "}
          <Link to="/login" className="text-forest-600 font-semibold hover:underline">سجّل دخولك</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
