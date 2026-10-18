/**
 * حلقة اليوم — رمز التطبيق البصري
 * ثلاث علامات على الحلقة: شمس مشرقة (الصباح)، شمس (الظهر)، هلال (المساء)
 * وهي نفسها فترات الجرعات. وفي المركز ثلاثة أفراد من أعمار مختلفة.
 */
export default function DayRing({ size = 330 }) {
  return (
    <svg
      viewBox="0 0 360 360"
      width={size}
      height={size}
      role="img"
      aria-label="حلقة اليوم بفتراتها الثلاث وفي مركزها ثلاثة أفراد من العائلة"
      className="day-ring"
    >
      {/* الحلقات */}
      <circle cx="180" cy="180" r="148" fill="none" stroke="var(--cream)" strokeOpacity=".10" strokeWidth="1.5" />
      <circle cx="180" cy="180" r="112" fill="none" stroke="var(--cream)" strokeOpacity=".14" strokeWidth="20" />
      <circle
        cx="180" cy="180" r="112" fill="none"
        stroke="var(--accent)" strokeWidth="20" strokeLinecap="round"
        strokeDasharray="186 518" transform="rotate(-128 180 180)"
      />

      {/* علامات الفترات الثلاث */}
      <circle cx="83" cy="236" r="15" fill="var(--accent)" />
      <circle cx="180" cy="68" r="15" fill="var(--cream)" />
      <path d="M283 230 a15 15 0 1 1 -11 -14 a12 12 0 0 0 11 14 Z" fill="var(--mint)" />

      {/* العائلة */}
      <circle cx="148" cy="172" r="14" fill="var(--cream)" />
      <path d="M129 210 a19 19 0 0 1 38 0 Z" fill="var(--cream)" />
      <circle cx="182" cy="162" r="16" fill="var(--accent)" />
      <path d="M160 204 a22 22 0 0 1 44 0 Z" fill="var(--accent)" />
      <circle cx="214" cy="178" r="11" fill="var(--mint)" />
      <path d="M199 210 a15 15 0 0 1 30 0 Z" fill="var(--mint)" />
    </svg>
  );
}
