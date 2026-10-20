import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import PageHeader from "../components/PageHeader";
import AllergenSearch from "../components/AllergenSearch";
import { useFeedback } from "../feedback/context";
import "./MedicationForm.css";

const DAY_LABELS = [
    { n: "1", label: "ح" }, { n: "2", label: "ن" }, { n: "3", label: "ث" },
    { n: "4", label: "ر" }, { n: "5", label: "خ" }, { n: "6", label: "ج" },
    { n: "7", label: "س" },
];

// تاريخ اليوم بصيغة حقل التاريخ «2026-10-18»
const todayISO = () => new Date().toISOString().slice(0, 10);

// مستوى التعارض بكلمات بسيطة (allergy.js في الخادم)
const LEVEL_LABEL = {
    direct: "المادة نفسها",
    class: "من العائلة نفسها",
    family: "تحسّس متصالب",
    cross: "تحسّس متصالب منخفض",
};

const FORMS = ["أقراص", "أقراص ملبسة", "محافظ", "شراب", "معلق", "محلول للحقن", "تحاميل", "قطرة", "مرهم", "كريم", "بخاخ"];

export default function MedicationForm() {
    const { id: memberId, medId } = useParams();   // medId موجود عند التعديل فقط
    const isEdit = Boolean(medId);
    const navigate = useNavigate();
    const parent = `/members/${memberId}`;
    const { toast, confirm } = useFeedback();
    const [member, setMember] = useState(null);     // لعرض حساسيته وفحصها
    const [allergyHit, setAllergyHit] = useState(null); // { key, conflicts, unchecked, needs_ingredients }
    const [ingredients, setIngredients] = useState([]); // مواد دواء مكتوب يدوياً: [{ id, name, name_ar }]

    const [form, setForm] = useState({
        catalog_id: null,
        name: "",
        active_ingredient: "",
        strength: "",
        form: "أقراص",
        instructions: "",
        start_date: todayISO(),
        end_date: "",
        units_total: "",
        units_per_dose: "1",
        is_private: false,
    });

    const [times, setTimes] = useState([
        { time_of_day: "08:00", days_of_week: "1234567" },
    ]);

    const [results, setResults] = useState([]);
    // القائمة تظهر فقط أثناء الكتابة، لا بعد اختيار دواء أو مسح الاسم
    const showResults = !form.catalog_id && form.name.trim().length >= 2 && results.length > 0;
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const debounce = useRef(null);
    const allergyTimer = useRef(null);

    useEffect(() => {
        api.get("/members")
            .then((res) => setMember(res.data.find((m) => String(m.id) === String(memberId)) || null))
            .catch(() => {});
    }, [memberId]);

    // دواء من الكتالوغ: موادّه معروفة. مكتوب يدوياً: يختار المستخدم موادّه
    const fromCatalog = Boolean(Number(form.catalog_id));
    const ingredientIds = fromCatalog ? [] : ingredients.map((i) => i.id);

    // فحص الحساسية أثناء الكتابة — تحذير مبكر قبل الضغط على «حفظ»
    const qName = form.name.trim();
    const qCatalog = fromCatalog ? Number(form.catalog_id) : "";
    const qIds = ingredientIds.join(",");
    const checkKey = `${qName}|${qCatalog}|${qIds}`;
    useEffect(() => {
        if (!member?.allergies || qName.length < 2) return;
        clearTimeout(allergyTimer.current);
        allergyTimer.current = setTimeout(async () => {
            try {
                const { data } = await api.get("/medications/allergy-check", {
                    params: { member_id: memberId, name: qName, catalog_id: qCatalog || undefined, ingredient_ids: qIds || undefined },
                });
                setAllergyHit({ key: `${qName}|${qCatalog}|${qIds}`, ...data });
            } catch {
                setAllergyHit(null);
            }
        }, 400);
        return () => clearTimeout(allergyTimer.current);
    }, [qName, qCatalog, qIds, member, memberId]);
    // النتيجة تخص ما فُحص فقط؛ إن تغيّر الاسم أو المواد تختفي حتى يُفحص من جديد
    const check = allergyHit && allergyHit.key === checkKey ? allergyHit : null;

    // عند التعديل: يملأ النموذج ببيانات الدواء الحالية ومواعيده
    useEffect(() => {
        if (!isEdit) return;
        api.get(`/medications/member/${memberId}`)
            .then((res) => {
                const m = res.data.find((x) => String(x.id) === String(medId));
                if (!m) return setError("هذا الدواء غير موجود");
                setForm({
                    // catalog_id يُعامل كأنه مختار مسبقاً حتى لا يبدأ البحث تلقائياً
                    catalog_id: m.catalog_id || "manual",
                    name: m.name || "",
                    active_ingredient: m.active_ingredient || "",
                    strength: m.strength || "",
                    form: m.form || "أقراص",
                    instructions: m.instructions || "",
                    start_date: m.start_date ? String(m.start_date).slice(0, 10) : todayISO(),
                    end_date: m.end_date ? String(m.end_date).slice(0, 10) : "",
                    units_total: m.units_total ?? "",
                    units_per_dose: m.units_per_dose ?? "1",
                    is_private: Boolean(m.is_private),
                });
                if (!m.catalog_id) setIngredients(m.ingredients || []);
                if (m.schedules?.length) {
                    setTimes(m.schedules.map((s) => ({
                        time_of_day: s.time_of_day,
                        days_of_week: s.days_of_week || "1234567",
                    })));
                }
            })
            .catch(() => setError("تعذّر تحميل بيانات الدواء"));
    }, [isEdit, memberId, medId]);

    // بحث في كتالوغ الأدوية مع تأخير بسيط حتى لا نرهق السيرفر
    useEffect(() => {
        // اختار دواءً من القائمة أو الاسم قصير جداً: لا داعي للبحث
        if (form.catalog_id || form.name.trim().length < 2) return;

        clearTimeout(debounce.current);
        debounce.current = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await api.get(`/catalog/search?q=${encodeURIComponent(form.name)}`);
                setResults(res.data);
            } catch {
                setResults([]);
            } finally {
                setSearching(false);
            }
        }, 300);

        return () => clearTimeout(debounce.current);
    }, [form.name, form.catalog_id]);

    const change = (e) => {
        const { name, value, type, checked } = e.target;
        setForm((f) => ({ ...f, [name]: type === "checkbox" ? checked : value }));
    };

    const onNameChange = (e) => {
        setForm((f) => ({ ...f, name: e.target.value, catalog_id: null }));
    };

    const pickFromCatalog = (item) => {
        setForm((f) => ({
            ...f,
            catalog_id: item.id,
            name: item.brand_name || f.name,
            active_ingredient: item.active_ingredient || "",
            strength: item.strength || "",
            form: item.form || f.form,
        }));
        setIngredients([]);
        setResults([]);
    };

    // مادة أو اسم تجاري (← موادّه) لدواء مكتوب يدوياً
    const addIngredients = (pick) => {
        const fresh = pick.type === "brand" ? pick.ingredients : [{ id: pick.id, name: pick.name, name_ar: pick.name_ar }];
        setIngredients((list) => [...list, ...fresh.filter((f) => !list.some((x) => x.id === f.id))]);
    };
    const removeIngredient = (id) => setIngredients((list) => list.filter((x) => x.id !== id));

    const addTime = () =>
        setTimes((t) => [...t, { time_of_day: "20:00", days_of_week: "1234567" }]);

    const removeTime = (i) =>
        setTimes((t) => t.filter((_, idx) => idx !== i));

    const setTimeValue = (i, value) =>
        setTimes((t) => t.map((x, idx) => (idx === i ? { ...x, time_of_day: value } : x)));

    const toggleDay = (i, dayNum) => {
        setTimes((t) =>
            t.map((x, idx) => {
                if (idx !== i) return x;
                const has = x.days_of_week.includes(dayNum);
                const next = has
                    ? x.days_of_week.replace(dayNum, "")
                    : (x.days_of_week + dayNum).split("").sort().join("");
                return { ...x, days_of_week: next };
            })
        );
    };

    const submit = async (e) => {
        e.preventDefault();
        setError("");

        if (!form.name.trim()) return setError("الرجاء إدخال اسم الدواء");
        if (times.length === 0) return setError("أضف موعد جرعة واحداً على الأقل");
        if (times.some((t) => !t.days_of_week))
            return setError("اختر يوماً واحداً على الأقل لكل موعد");

        setSaving(true);
        try {
            const payload = {
                member_id: Number(memberId),
                catalog_id: form.catalog_id === "manual" ? null : form.catalog_id,
                name: form.name.trim(),
                // من الكتالوغ: نصّه كما هو. يدوياً: الخادم يكتبه من المواد المختارة
                active_ingredient: fromCatalog || !ingredients.length ? form.active_ingredient || null : null,
                ingredient_ids: fromCatalog ? undefined : ingredientIds,
                strength: form.strength || null,
                form: form.form || null,
                instructions: form.instructions || null,
                start_date: form.start_date,
                end_date: form.end_date || null,
                units_total: form.units_total ? Number(form.units_total) : null,
                units_per_dose: form.units_per_dose ? Number(form.units_per_dose) : 1,
                is_private: form.is_private,
                times: times.map((t) => ({
                    time_of_day: t.time_of_day.length === 5 ? `${t.time_of_day}:00` : t.time_of_day,
                    days_of_week: t.days_of_week,
                })),
            };
            const save = (extra = {}) => isEdit
                ? api.put(`/medications/${medId}`, { ...payload, ...extra })
                : api.post("/medications", { ...payload, ...extra });

            // الخادم قد يطلب تأكيداً صريحاً (حساسية، أو مواد غير معروفة).
            // كل تأكيد يُسجَّل عنده: من أكّد، ومتى، وعلى ماذا
            const extra = {};
            for (let attempt = 0; ; attempt++) {
                try {
                    await save(extra);
                    break;
                } catch (err) {
                    const code = err.response?.status === 409 && err.response.data?.code;
                    if (!code || attempt > 2) throw err;
                    if (code === "ALLERGY") {
                        const list = err.response.data.conflicts.map((c) => `• ${c.message}`).join("\n");
                        const ok = await confirm({
                            title: "تحذير: حساسية",
                            message: `${list}\n\nلا تضف هذا الدواء إلا إذا وصفه الطبيب وهو يعلم بهذه الحساسية.`,
                            confirmLabel: "الطبيب يعلم — أضفه",
                            cancelLabel: "لا تضفه",
                            danger: true,
                        });
                        if (!ok) return;
                        extra.allergy_confirmed = true;
                    } else if (code === "INGREDIENTS_UNKNOWN") {
                        const ok = await confirm({
                            title: "المادة الفعّالة غير معروفة",
                            message: err.response.data.error,
                            confirmLabel: "احفظه دون فحص",
                            cancelLabel: "سأختار المادة",
                            danger: true,
                        });
                        if (!ok) return;
                        extra.ingredients_unknown_confirmed = true;
                    } else {
                        throw err;
                    }
                }
            }
            toast(isEdit ? "حُفظت تعديلات الدواء" : `أُضيف ${form.name.trim()}`);
            // replace: زر الرجوع بعد الحفظ لا يعيد فتح النموذج
            navigate(parent, { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || "تعذّر الحفظ، حاول مجدداً");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page">
            <PageHeader title={isEdit ? "تعديل الدواء" : "إضافة دواء"} back={parent} />

            {member?.allergies && (
                <div className="allergy-note" role="note">
                    <strong>حساسية {member.name}:</strong> {member.allergies}
                </div>
            )}

            <form className="form-card" onSubmit={submit}>
                {/* ── بيانات الدواء ── */}
                <h3 className="form-section">بيانات الدواء</h3>

                <label>اسم الدواء</label>
                <div className="search-wrap">
                    <input
                        name="name"
                        value={form.name}
                        onChange={onNameChange}
                        placeholder="مثال: باراسيتامول أو PARACETAMOL"
                        autoComplete="off"
                    />
                    {showResults && (
                        <ul className="search-results">
                            {results.map((r) => (
                                <li key={r.id} onClick={() => pickFromCatalog(r)}>
                                    <strong>
                                        {r.name_ar || r.brand_name}
                                        {r.name_ar && <bdi dir="ltr" className="result-latin">{r.brand_name}</bdi>}
                                    </strong>
                                    <span>{r.active_ingredient} {r.strength && `— ${r.strength}`}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <span className="hint">
                    {searching ? "جارٍ البحث..." : "ابحث بالعربية أو الإنجليزية. لم تجده؟ اكتب اسمه كما هو وتابع."}
                </span>
                {check?.conflicts?.length > 0 && (
                    <div className="allergy-warning" role="alert">
                        <strong>تحذير حساسية</strong>
                        <ul className="conflict-list">
                            {check.conflicts.map((c) => (
                                <li key={`${c.allergy_id}-${c.ingredient}`} className={c.level}>
                                    <span className="conflict-level">{LEVEL_LABEL[c.level]}:</span>
                                    {c.message}
                                    {c.reaction && <> التفاعل المسجّل: {c.reaction}.</>}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <label htmlFor="ingredient-search">المادة الفعّالة</label>
                {fromCatalog ? (
                    <>
                        <input value={form.active_ingredient} readOnly dir="ltr" />
                        <span className="hint">من الكتالوغ — تُفحص مع الحساسية تلقائياً</span>
                    </>
                ) : (
                    <>
                        <AllergenSearch
                            id="ingredient-search"
                            types={["ingredient", "brand"]}
                            onPick={addIngredients}
                            placeholder="ابحث عن المادة أو اسم العلبة: IBUPROFEN، بروفين..."
                        />
                        {ingredients.length > 0 && (
                            <div className="ingredient-chips">
                                {ingredients.map((i) => (
                                    <span key={i.id}>
                                        {i.name_ar || i.name}
                                        <button type="button" onClick={() => removeIngredient(i.id)} aria-label={`إزالة ${i.name}`}>×</button>
                                    </span>
                                ))}
                            </div>
                        )}
                        <span className="hint">
                            {check?.needs_ingredients
                                ? `مطلوبة: بدونها لا يمكن فحص الدواء مع حساسية ${member?.name || "الفرد"}.`
                                : "لم تجد الدواء في الكتالوغ؟ اختر مادته الفعّالة ليُفحص مع الحساسية."}
                            {!ingredients.length && form.active_ingredient && ` (المكتوب سابقاً: ${form.active_ingredient})`}
                        </span>
                    </>
                )}
                {check?.unchecked?.length > 0 && (
                    <span className="hint">
                        حساسية مكتوبة نصاً لا تُفحص تلقائياً: {check.unchecked.join("، ")}. راجعها بنفسك.
                    </span>
                )}

                <label>العيار</label>
                <input name="strength" value={form.strength} onChange={change} placeholder="مثال: 5 ملغ" />

                <label>الشكل</label>
                <select name="form" value={form.form} onChange={change}>
                    {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>

                <label>تعليمات الاستخدام</label>
                <input name="instructions" value={form.instructions} onChange={change} placeholder="مثال: بعد الفطور" />

                <label>تاريخ البدء</label>
                <input type="date" name="start_date" value={form.start_date} onChange={change} />

                <label>تاريخ الانتهاء</label>
                <input type="date" name="end_date" value={form.end_date} onChange={change} />
                <span className="hint">اتركه فارغاً إذا كان الدواء مستمراً</span>

                {/* ── مواعيد الجرعات ── */}
                <h3 className="form-section">مواعيد الجرعات</h3>

                {times.map((t, i) => (
                    <div className="time-row" key={i}>
                        <div className="time-top">
                            <input
                                type="time"
                                value={t.time_of_day.slice(0, 5)}
                                onChange={(e) => setTimeValue(i, e.target.value)}
                            />
                            {times.length > 1 && (
                                <button type="button" className="remove-time" onClick={() => removeTime(i)}>
                                    حذف
                                </button>
                            )}
                        </div>
                        <div className="days">
                            {DAY_LABELS.map((d) => (
                                <button
                                    type="button"
                                    key={d.n}
                                    className={t.days_of_week.includes(d.n) ? "day on" : "day"}
                                    onClick={() => toggleDay(i, d.n)}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}

                <button type="button" className="add-time" onClick={addTime}>
                    + إضافة موعد جرعة
                </button>

                {/* ── الكمية ── */}
                <h3 className="form-section">الكمية المتوفرة</h3>

                <label>عدد الوحدات في العلبة</label>
                <input type="number" name="units_total" value={form.units_total} onChange={change} min="0" />

                <label>عدد الوحدات في الجرعة الواحدة</label>
                <input type="number" name="units_per_dose" value={form.units_per_dose} onChange={change} min="0" step="0.5" />
                <span className="hint">نستخدمها لتنبيهك قبل نفاد الدواء</span>

                <label className="checkbox-line">
                    <input type="checkbox" name="is_private" checked={form.is_private} onChange={change} />
                    <span>دواء خاص — لا يظهر عند المشاركة مع الطبيب</span>
                </label>

                {error && <div className="error">{error}</div>}

                <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? "جارٍ الحفظ..." : "حفظ"}
                    </button>
                    <button type="button" onClick={() => navigate(parent)}>
                        إلغاء
                    </button>
                </div>
            </form>
        </div>
    );
}