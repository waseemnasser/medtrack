// قائمة تعارضات الحساسية (من allergy.js في الخادم).
// التحسّس المتصالب بين عائلتين (cross) خطره أقل، فلونه أهدأ
export default function ConflictList({ conflicts }) {
    return (
        <ul className="space-y-1.5 mt-1.5">
            {conflicts.map((c) => (
                <li key={`${c.allergy_id}-${c.ingredient}`}
                    className={`ps-3 border-s-[3px] text-sm leading-relaxed ${c.level === "cross" ? "border-amber-400" : "border-red-500"}`}>
                    {c.message}
                </li>
            ))}
        </ul>
    );
}
