import { X } from "lucide-react";
import AllergenSearch from "./AllergenSearch";

const SEVERITIES = [
    { value: "unknown", label: "غير معروفة", on: "bg-forest-600 text-white border-forest-600" },
    { value: "mild", label: "خفيفة", on: "bg-amber-500 text-white border-amber-500" },
    { value: "severe", label: "شديدة", on: "bg-red-500 text-white border-red-500" },
];

const KIND_LABEL = { class: "عائلة كاملة", ingredient: "مادة فعّالة", note: "نص — لا يُفحص" };

// مفتاح ثابت لكل بند: لا نكرّر المادة نفسها مرتين
const keyOf = (a) => (a.ingredient_id ? `i${a.ingredient_id}` : a.class_id ? `c${a.class_id}` : `n${a.note}`);

/** بند من نتيجة البحث ← بنود حساسية (الاسم التجاري يصير مواده) */
function toItems(pick) {
    if (pick.type === "class") return [{ kind: "class", class_id: pick.id, label: pick.name_ar, sub: pick.name }];
    if (pick.type === "ingredient") return [{ kind: "ingredient", ingredient_id: pick.id, label: pick.name_ar || pick.name, sub: pick.name }];
    if (pick.type === "brand") {
        return pick.ingredients.map((i) => ({
            kind: "ingredient", ingredient_id: i.id, label: i.name_ar || i.name,
            sub: `${i.name} — من ${pick.brand_name}`,
        }));
    }
    return [{ kind: "note", note: pick.note, label: pick.note }];
}

/**
 * قائمة حساسية الفرد: بحث للإضافة، وتحت كل بند شدّته ونوع التفاعل.
 * كل بند يشير إلى مادة أو عائلة، فيُفحص بدقة مع كل دواء.
 */
export default function AllergyEditor({ items, onChange }) {
    const add = (pick) => {
        const existing = new Set(items.map(keyOf));
        const fresh = toItems(pick)
            .filter((it) => !existing.has(keyOf(it)))
            .map((it) => ({ severity: "unknown", reaction: "", ...it }));
        if (fresh.length) onChange([...items, ...fresh]);
    };
    const update = (i, patch) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
    const remove = (i) => onChange(items.filter((_, idx) => idx !== i));

    return (
        <div className="space-y-3">
            <AllergenSearch
                id="allergies"
                onPick={add}
                allowNote
                placeholder="ابحث: بنسلين، بروفين..."
            />

            {items.length > 0 && (
                <ul className="space-y-2">
                    {items.map((a, i) => (
                        <li key={keyOf(a)}
                            className={`rounded-xl p-4 border ${a.kind === "note"
                                ? "border-dashed border-amber-300 bg-amber-50"
                                : "border-red-200 dark:border-red-900/50 bg-red-50"}`}>
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <strong className="text-forest-950">{a.label}</strong>
                                    <small className="block text-xs text-forest-700/60 mt-0.5">
                                        {KIND_LABEL[a.kind]}
                                        {a.sub && <> · <bdi dir="ltr">{a.sub}</bdi></>}
                                    </small>
                                </div>
                                <button type="button" onClick={() => remove(i)} aria-label={`حذف ${a.label}`}
                                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-100 flex-shrink-0">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="flex flex-col sm:flex-row gap-2 mt-3">
                                <div className="flex gap-1" role="radiogroup" aria-label={`شدّة حساسية ${a.label}`}>
                                    {SEVERITIES.map((s) => (
                                        <button
                                            type="button"
                                            key={s.value}
                                            role="radio"
                                            aria-checked={a.severity === s.value}
                                            onClick={() => update(i, { severity: s.value })}
                                            className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap ${a.severity === s.value
                                                ? s.on
                                                : "bg-white text-forest-700 border-sage-200 hover:border-forest-300"}`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                                <input
                                    value={a.reaction}
                                    onChange={(e) => update(i, { reaction: e.target.value })}
                                    placeholder="التفاعل: طفح، تورّم، ضيق تنفّس..."
                                    aria-label={`نوع التفاعل مع ${a.label}`}
                                    maxLength={120}
                                    className="input-field !py-2 text-sm"
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
