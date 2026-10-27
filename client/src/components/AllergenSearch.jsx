import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import api from "../api";

const TYPE_LABEL = { class: "عائلة أدوية", ingredient: "مادة فعّالة", brand: "اسم تجاري" };
const TYPE_TONE = {
    class: "badge-info",
    ingredient: "badge-success",
    brand: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    note: "badge-warning",
};

/**
 * بحث في عائلات الأدوية والمواد الفعّالة والأسماء التجارية.
 * الاسم التجاري يُختار كمواده الفعّالة: «BRUFEN» ← IBUPROFEN.
 *
 * types: ما نبحث فيه — نموذج الدواء لا يحتاج العائلات
 * onPick(item): item.type = class | ingredient | brand | note
 * allowNote: يسمح بإضافة النص كما هو إن لم نجده (لن يُفحص تلقائياً)
 */
export default function AllergenSearch({ id, types = ["class", "ingredient", "brand"], placeholder, onPick, allowNote = false }) {
    const [q, setQ] = useState("");
    const [results, setResults] = useState({ q: "", items: [] });
    const [open, setOpen] = useState(false);
    const timer = useRef(null);
    const typesKey = types.join(",");

    const query = q.trim();
    useEffect(() => {
        clearTimeout(timer.current);
        if (query.length < 2) return;
        timer.current = setTimeout(async () => {
            try {
                const { data } = await api.get("/catalog/allergens", { params: { q: query, types: typesKey } });
                setResults({ q: query, items: data });
            } catch {
                setResults({ q: query, items: [] });
            }
        }, 250);
        return () => clearTimeout(timer.current);
    }, [query, typesKey]);

    // النتائج تخص النص الحالي فقط
    const items = results.q === query ? results.items : [];
    const showList = open && query.length >= 2 && (items.length > 0 || allowNote);

    const pick = (item) => {
        onPick(item);
        setQ("");
        setOpen(false);
    };

    const option = "w-full text-right px-4 py-3 hover:bg-sage-50 dark:hover:bg-forest-800/60 flex flex-col items-start gap-1 transition-colors";

    return (
        <div className="relative">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-sage-400 pointer-events-none" />
            <input
                id={id}
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                // تأخير بسيط حتى تصل ضغطة النتيجة قبل إغلاق القائمة
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder={placeholder}
                autoComplete="off"
                className="input-field !pr-11"
            />
            {showList && (
                <ul className="absolute z-30 inset-x-0 mt-2 card !shadow-xl max-h-80 overflow-y-auto scrollbar-thin divide-y divide-sage-100 dark:divide-forest-800/60">
                    {items.map((r) => (
                        <li key={`${r.type}-${r.id || r.brand_name}`}>
                            <button type="button" className={option} onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}>
                                <span className={`badge ${TYPE_TONE[r.type]}`}>{TYPE_LABEL[r.type]}</span>
                                <strong className="text-forest-950">{r.name_ar || r.name || r.brand_name}</strong>
                                <small className="text-xs text-forest-700/60" dir="ltr">
                                    {r.type === "brand"
                                        ? `${r.brand_name} ← ${r.ingredients.map((i) => i.name).join(" + ")}`
                                        : r.name}
                                </small>
                            </button>
                        </li>
                    ))}
                    {allowNote && (
                        <li>
                            <button type="button" className={option} onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pick({ type: "note", note: query })}>
                                <span className={`badge ${TYPE_TONE.note}`}>نص فقط</span>
                                <strong className="text-forest-950">أضف «{query}» كما هو</strong>
                                <small className="text-xs text-forest-700/60">لم نجده؟ يُحفظ ويظهر للطبيب، لكن لا يُفحص تلقائياً</small>
                            </button>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
