import { useState, useEffect, useRef } from "react";
import api from "../api";
import "./AllergenSearch.css";

const TYPE_LABEL = { class: "عائلة أدوية", ingredient: "مادة فعّالة", brand: "اسم تجاري" };

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

    return (
        <div className="allergen-search">
            <input
                id={id}
                value={q}
                onChange={(e) => { setQ(e.target.value); setOpen(true); }}
                onFocus={() => setOpen(true)}
                // تأخير بسيط حتى تصل ضغطة النتيجة قبل إغلاق القائمة
                onBlur={() => setTimeout(() => setOpen(false), 150)}
                placeholder={placeholder}
                autoComplete="off"
            />
            {showList && (
                <ul className="allergen-results">
                    {items.map((r) => (
                        <li key={`${r.type}-${r.id || r.brand_name}`}>
                            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)}>
                                <span className={`allergen-type ${r.type}`}>{TYPE_LABEL[r.type]}</span>
                                <strong>{r.name_ar || r.name || r.brand_name}</strong>
                                <small dir="ltr">
                                    {r.type === "brand"
                                        ? `${r.brand_name} ← ${r.ingredients.map((i) => i.name).join(" + ")}`
                                        : r.name}
                                </small>
                            </button>
                        </li>
                    ))}
                    {allowNote && (
                        <li>
                            <button type="button" className="as-note" onMouseDown={(e) => e.preventDefault()}
                                onClick={() => pick({ type: "note", note: query })}>
                                <span className="allergen-type note">نص فقط</span>
                                <strong>أضف «{query}» كما هو</strong>
                                <small>لم نجده؟ يُحفظ ويظهر للطبيب، لكن لا يُفحص تلقائياً</small>
                            </button>
                        </li>
                    )}
                </ul>
            )}
        </div>
    );
}
