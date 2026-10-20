// تحويل بنود الحساسية بين شكل الخادم (member_allergies) وشكل المحرّر

/** بند محفوظ من الخادم ← شكل المحرّر */
export function fromServer(a) {
    return {
        kind: a.kind,
        ingredient_id: a.ingredient_id,
        class_id: a.class_id,
        note: a.note,
        label: a.label,
        sub: a.kind === "class" ? a.class_name : a.kind === "ingredient" ? a.ingredient_name : null,
        severity: a.severity,
        reaction: a.reaction || "",
    };
}

/** للحفظ: PUT /members/:id/allergies */
export function toPayload(items) {
    return items.map(({ ingredient_id, class_id, note, severity, reaction }) => ({ ingredient_id, class_id, note, severity, reaction }));
}
