/**
 * ملاحظة الخصوصية أسفل نموذج الدخول.
 * تظهر قبل أن يسجّل المستخدم: تطبيق طبي يطلب ثقة،
 * والثقة تُبنى من الشاشة الأولى لا من صفحة الشروط.
 */
export default function ShieldNote() {
  return (
    <div className="auth-privacy">
      <svg
        width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="var(--sand-icon)" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      >
        <path d="M12 3 4 6.5v5c0 4.3 3.2 8.3 8 9.5 4.8-1.2 8-5.2 8-9.5v-5L12 3Z" />
      </svg>
      <p>
        بياناتك الطبية تبقى في حسابك، ولا تُشارَك إلا برابط مؤقّت
        تنشئه أنت وينتهي بعد 24 ساعة.
      </p>
    </div>
  );
}
