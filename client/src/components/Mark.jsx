/**
 * علامة «طمّني» — فقاعة رسالة وصلت.
 * الحركة كلها في Auth.css، هنا الشكل فقط.
 */
export default function Mark({ size = 120, animated = false, color = "var(--primary)", tickColor = "var(--bg)" }) {
  return (
    <svg
      className={animated ? "auth-bubble" : undefined}
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label="رسالة اطمئنان"
    >
      <path
        d="M14 42 a26 26 0 0 1 26 -26 h40 a26 26 0 0 1 26 26 v22 a26 26 0 0 1 -26 26 h-14 l-20 16 v-16 h-6 a26 26 0 0 1 -26 -26 Z"
        fill={color}
      />
      <path
        className={animated ? "auth-tick" : undefined}
        d="M42 54 L54 67 L79 40"
        fill="none"
        stroke={tickColor}
        strokeWidth={animated ? 8 : 9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}