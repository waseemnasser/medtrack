import AllergenSearch from "./AllergenSearch";

const SEVERITIES = [
    { value: "unknown", label: "غير معروفة" },
    { value: "mild", label: "خفيفة" },
    { value: "severe", label: "شديدة" },
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
        <div className="allergy-editor">
            <AllergenSearch
                id="allergies"
                onPick={add}
                allowNote
                placeholder="ابحث: بنسلين، بروفين، IBUPROFEN..."
            />

            {items.length > 0 && (
                <ul className="allergy-items">
                    {items.map((a, i) => (
                        <li key={keyOf(a)} className={a.kind === "note" ? "unchecked" : ""}>
                            <div className="allergy-item-head">
                                <div>
                                    <strong>{a.label}</strong>
                                    <small>
                                        {KIND_LABEL[a.kind]}
                                        {a.sub && <> · <bdi dir="ltr">{a.sub}</bdi></>}
                                    </small>
                                </div>
                                <button type="button" className="allergy-remove" onClick={() => remove(i)} aria-label={`حذف ${a.label}`}>
                                    حذف
                                </button>
                            </div>
                            <div className="allergy-item-fields">
                                <div className="allergy-severity" role="radiogroup" aria-label={`شدّة حساسية ${a.label}`}>
                                    {SEVERITIES.map((s) => (
                                        <button
                                            type="button"
                                            key={s.value}
                                            role="radio"
                                            aria-checked={a.severity === s.value}
                                            className={`${a.severity === s.value ? "on" : ""} ${s.value}`}
                                            onClick={() => update(i, { severity: s.value })}
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
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
