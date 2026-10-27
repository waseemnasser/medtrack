/**
 * علامة «نبض» — خط نبض يمرّ داخل كبسولة دواء.
 * نصف الكبسولة أفتح قليلاً، مثل الكبسولة الحقيقية بلونين.
 * الشكل نفسه في public/favicon.svg وأيقونات التطبيق.
 * الإطار مقصوص على الكبسولة، فعرضها أكبر من size بقليل وارتفاعها أقل.
 */
export default function Mark({ size = 120, color = "var(--primary)", lineColor = "var(--bg)" }) {
  const width = Math.round(size * 1.4);
  return (
    <svg width={width} height={Math.round(width * 64 / 116)} viewBox="2 28 116 64" role="img" aria-label="نبض">
      <rect x="4" y="30" width="112" height="60" rx="30" fill={color} />
      <path d="M60 30 h26 a30 30 0 0 1 0 60 h-26 Z" fill="#fff" fillOpacity="0.14" />
      <path
        d="M17 60 H40 L48 47 L58 75 L68 40 L76 60 H103"
        fill="none"
        stroke={lineColor}
        strokeWidth="7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
