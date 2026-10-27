import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import PageHeader from "../components/PageHeader";
import AllergenSearch from "../components/AllergenSearch";
import Field, { FormError } from "../components/Field";
import { useFeedback } from "../feedback/context";
import { formatDate, periodOf } from "../utils/format";
import { Pill, Activity, Clock, Package, Lock, Save, Plus, Trash2, X, Search, AlertTriangle } from "lucide-react";

const DAY_LABELS = [
    { n: "1", label: "ح" }, { n: "2", label: "ن" }, { n: "3", label: "ث" },
    { n: "4", label: "ر" }, { n: "5", label: "خ" }, { n: "6", label: "ج" },
    { n: "7", label: "س" },
];

// تاريخ اليوم بصيغة حقل التاريخ «2026-10-18»
const todayISO = () => new Date().toISOString().slice(0, 10);

// حساب التواريخ بالأيام، بلا أثر للتوقيت الصيفي
const dayNum = (iso) => Date.UTC(...iso.split("-").map((n, i) => Number(n) - (i === 1 ? 1 : 0))) / 86400000;
const addDays = (iso, n) => new Date((dayNum(iso) + n) * 86400000).toISOString().slice(0, 10);

// مدد شائعة للكورس — المضادات الحيوية غالباً ٥ أو ٧ أو ١٠ أيام
const COURSE_PRESETS = [3, 5, 7, 10, 14];

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
        // الكورس: عدد أيام محدد، ومنه تاريخ الانتهاء. فارغ = دواء مستمر
        course_days: "",
        units_total: "",
        units_per_dose: "1",
        is_private: false,
    });

    // مستمر أم كورس — اختيار صريح، لأن إيقاف الكورس قبل نهايته
    // أكثر مشكلة يراها الصيادلة (course.js في الخادم)
    const [isCourse, setIsCourse] = useState(false);
    const courseDays = Number(form.course_days);

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
                    course_days: m.end_date && m.start_date
                        ? String(dayNum(String(m.end_date).slice(0, 10)) - dayNum(String(m.start_date).slice(0, 10)) + 1)
                        : "",
                    units_total: m.units_total ?? "",
                    units_per_dose: m.units_per_dose ?? "1",
                    is_private: Boolean(m.is_private),
                });
                setIsCourse(Boolean(m.end_date));
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
        if (isCourse && !(Number.isInteger(courseDays) && courseDays >= 1 && courseDays <= 365))
            return setError("أدخل عدد أيام الكورس (من ١ إلى ٣٦٥)");
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
                end_date: isCourse ? addDays(form.start_date, courseDays - 1) : null,
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

    const sectionTitle = "text-lg font-bold text-forest-950 flex items-center gap-2";
    const chip = (on) => `px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${on
        ? "bg-forest-600 text-white border-forest-600"
        : "bg-white text-forest-700 border-sage-200 hover:border-forest-300"}`;

    return (
        <div className="max-w-3xl">
            <PageHeader title={isEdit ? "تعديل الدواء" : "إضافة دواء"} subtitle={member?.name} back={parent} />

            {member?.allergies && (
                <div className="card p-4 mb-6 !border-red-200 dark:!border-red-900/60 bg-red-50 flex items-start gap-3" role="note">
                    <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-forest-950"><strong>حساسية {member.name}:</strong> {member.allergies}</p>
                </div>
            )}

            <form className="space-y-6" onSubmit={submit}>
                {/* ── بيانات الدواء ── */}
                <section className="card p-6 space-y-4">
                    <h2 className={sectionTitle}><Pill className="w-5 h-5 text-forest-600" /> بيانات الدواء</h2>

                    <Field label="اسم الدواء" htmlFor="med-name" required
                        hint={searching ? "جارٍ البحث..." : "ابحث بالعربية أو الإنجليزية. لم تجده؟ اكتب اسمه كما هو وتابع."}>
                        <div className="relative">
                            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-sage-400 pointer-events-none" />
                            <input
                                id="med-name"
                                name="name"
                                value={form.name}
                                onChange={onNameChange}
                                placeholder="مثال: باراسيتامول"
                                autoComplete="off"
                                className="input-field !pr-11"
                            />
                            {showResults && (
                                <ul className="absolute z-30 inset-x-0 mt-2 card !shadow-xl max-h-80 overflow-y-auto scrollbar-thin divide-y divide-sage-100 dark:divide-forest-800/60">
                                    {results.map((r) => (
                                        <li key={r.id}>
                                            <button type="button" onClick={() => pickFromCatalog(r)}
                                                className="w-full text-right px-4 py-3 hover:bg-sage-50 dark:hover:bg-forest-800/60 flex flex-col items-start gap-0.5 transition-colors">
                                                <strong className="text-forest-950">
                                                    {r.name_ar || r.brand_name}
                                                    {r.name_ar && <bdi dir="ltr" className="ms-2 text-sm font-medium text-forest-700/60">{r.brand_name}</bdi>}
                                                </strong>
                                                <span className="text-xs text-forest-700/60" dir="ltr">{r.active_ingredient} {r.strength && `— ${r.strength}`}</span>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </Field>

                    {check?.conflicts?.length > 0 && (
                        <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 p-4 text-forest-950" role="alert">
                            <p className="font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" /> تحذير حساسية
                            </p>
                            <ul className="space-y-1.5 mt-2">
                                {check.conflicts.map((c) => (
                                    <li key={`${c.allergy_id}-${c.ingredient}`}
                                        className={`ps-3 border-s-[3px] text-sm leading-relaxed ${c.level === "cross" ? "border-amber-400" : "border-red-500"}`}>
                                        <span className="font-bold me-1.5">{LEVEL_LABEL[c.level]}:</span>
                                        {c.message}
                                        {c.reaction && <> التفاعل المسجّل: {c.reaction}.</>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {fromCatalog ? (
                        <Field label="المادة الفعّالة" htmlFor="ingredient" hint="من الكتالوغ — تُفحص مع الحساسية تلقائياً">
                            <input id="ingredient" value={form.active_ingredient} readOnly dir="ltr"
                                className="input-field bg-sage-50 dark:bg-forest-800/40 text-right" />
                        </Field>
                    ) : (
                        <Field label="المادة الفعّالة" htmlFor="ingredient-search"
                            hint={<>
                                {check?.needs_ingredients
                                    ? `مطلوبة: بدونها لا يمكن فحص الدواء مع حساسية ${member?.name || "الفرد"}.`
                                    : "لم تجد الدواء في الكتالوغ؟ اختر مادته الفعّالة ليُفحص مع الحساسية."}
                                {!ingredients.length && form.active_ingredient && ` (المكتوب سابقاً: ${form.active_ingredient})`}
                            </>}>
                            <AllergenSearch
                                id="ingredient-search"
                                types={["ingredient", "brand"]}
                                onPick={addIngredients}
                                placeholder="المادة أو اسم العلبة"
                            />
                            {ingredients.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {ingredients.map((i) => (
                                        <span key={i.id} className="badge badge-success !pe-1.5">
                                            {i.name_ar || i.name}
                                            <button type="button" onClick={() => removeIngredient(i.id)} aria-label={`إزالة ${i.name}`}
                                                className="p-0.5 rounded-full hover:bg-forest-200/60">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </Field>
                    )}
                    {check?.unchecked?.length > 0 && (
                        <p className="text-xs text-amber-700 dark:text-amber-300">
                            حساسية مكتوبة نصاً لا تُفحص تلقائياً: {check.unchecked.join("، ")}. راجعها بنفسك.
                        </p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="العيار" htmlFor="strength">
                            <input id="strength" name="strength" value={form.strength} onChange={change} placeholder="مثال: 5 ملغ" className="input-field" />
                        </Field>
                        <Field label="الشكل" htmlFor="form">
                            <select id="form" name="form" value={form.form} onChange={change} className="input-field">
                                {FORMS.map((f) => <option key={f} value={f}>{f}</option>)}
                            </select>
                        </Field>
                        <Field label="تعليمات الاستخدام" htmlFor="instructions">
                            <input id="instructions" name="instructions" value={form.instructions} onChange={change} placeholder="مثال: بعد الفطور" className="input-field" />
                        </Field>
                        <Field label="تاريخ البدء" htmlFor="start_date">
                            <input id="start_date" type="date" name="start_date" value={form.start_date} onChange={change} className="input-field" />
                        </Field>
                    </div>
                </section>

                {/* ── المدة ── */}
                <section className="card p-6 space-y-4">
                    <h2 className={sectionTitle}><Activity className="w-5 h-5 text-blue-500" /> مدة الاستخدام</h2>
                    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="مدة الاستخدام">
                        {[
                            { on: !isCourse, set: false, title: "مستمر", sub: "دواء مزمن أو بلا مدة محددة" },
                            { on: isCourse, set: true, title: "كورس بمدة محددة", sub: "مضاد حيوي مثلاً" },
                        ].map((o) => (
                            <button key={o.title} type="button" role="radio" aria-checked={o.on} onClick={() => setIsCourse(o.set)}
                                className={`rounded-xl border-2 p-4 text-right transition-all ${o.on
                                    ? "border-forest-500 bg-mint-50"
                                    : "border-sage-200 hover:border-forest-300"}`}>
                                <span className="block font-bold text-forest-950">{o.title}</span>
                                <span className="block text-xs text-forest-700/60 mt-0.5">{o.sub}</span>
                            </button>
                        ))}
                    </div>

                    {isCourse ? (
                        <Field label="عدد أيام الكورس" htmlFor="course_days"
                            hint={<>
                                {courseDays >= 1 && form.start_date
                                    ? `آخر يوم: ${formatDate(addDays(form.start_date, courseDays - 1))}. `
                                    : "كما كتبها الطبيب على الوصفة. "}
                                يتابع نبض التقدّم يوماً بيوم، وينبّه إن تُركت الجرعات قبل نهاية الكورس.
                            </>}>
                            <div className="flex flex-wrap gap-2">
                                {COURSE_PRESETS.map((n) => (
                                    <button type="button" key={n} className={chip(courseDays === n)}
                                        onClick={() => setForm((f) => ({ ...f, course_days: String(n) }))}>
                                        {n}
                                    </button>
                                ))}
                                <input id="course_days" name="course_days" type="number" inputMode="numeric"
                                    min="1" max="365" value={form.course_days} onChange={change} placeholder="أيام"
                                    className="input-field !w-24 !py-2" />
                            </div>
                        </Field>
                    ) : (
                        <p className="text-sm text-forest-700/60">يستمر حتى توقفه من ملف الفرد.</p>
                    )}
                </section>

                {/* ── مواعيد الجرعات ── */}
                <section className="card p-6 space-y-4">
                    <h2 className={sectionTitle}><Clock className="w-5 h-5 text-purple-500" /> مواعيد الجرعات</h2>

                    {times.map((t, i) => (
                        <div className="bg-sage-50 dark:bg-forest-800/40 rounded-xl p-4 space-y-3" key={i}>
                            <div className="flex items-center gap-3">
                                <input
                                    type="time"
                                    value={t.time_of_day.slice(0, 5)}
                                    onChange={(e) => setTimeValue(i, e.target.value)}
                                    aria-label={`وقت الجرعة ${i + 1}`}
                                    className="input-field !w-40 !py-2 font-bold text-lg"
                                />
                                <span className={`badge ${periodOf(t.time_of_day).chip}`}>{periodOf(t.time_of_day).label}</span>
                                {times.length > 1 && (
                                    <button type="button" onClick={() => removeTime(i)} aria-label="حذف هذا الموعد"
                                        className="ms-auto p-2 text-red-500 hover:bg-red-50 rounded-lg">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                )}
                            </div>
                            <div className="flex gap-1.5" role="group" aria-label="أيام الأسبوع">
                                {DAY_LABELS.map((d) => (
                                    <button
                                        type="button"
                                        key={d.n}
                                        aria-pressed={t.days_of_week.includes(d.n)}
                                        onClick={() => toggleDay(i, d.n)}
                                        className={`w-10 h-10 rounded-xl text-sm font-bold border transition-all ${t.days_of_week.includes(d.n)
                                            ? "bg-forest-600 text-white border-forest-600"
                                            : "bg-white text-forest-700 border-sage-200 hover:border-forest-300"}`}
                                    >
                                        {d.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}

                    <button type="button" onClick={addTime}
                        className="w-full border-2 border-dashed border-sage-300 rounded-xl py-3 text-sm font-semibold text-forest-600 hover:border-forest-400 hover:bg-mint-50 flex items-center justify-center gap-2 transition-colors">
                        <Plus className="w-4 h-4" /> إضافة موعد جرعة
                    </button>
                </section>

                {/* ── الكمية ── */}
                <section className="card p-6 space-y-4">
                    <h2 className={sectionTitle}><Package className="w-5 h-5 text-amber-500" /> الكمية المتوفرة</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Field label="عدد الوحدات في العلبة" htmlFor="units_total">
                            <input id="units_total" type="number" name="units_total" value={form.units_total} onChange={change} min="0" className="input-field" />
                        </Field>
                        <Field label="عدد الوحدات في الجرعة الواحدة" htmlFor="units_per_dose" hint="نستخدمها لتنبيهك قبل نفاد الدواء">
                            <input id="units_per_dose" type="number" name="units_per_dose" value={form.units_per_dose} onChange={change} min="0" step="0.5" className="input-field" />
                        </Field>
                    </div>

                    <label className="flex items-center gap-3 bg-sage-50 dark:bg-forest-800/40 rounded-xl p-4 cursor-pointer">
                        <input type="checkbox" name="is_private" checked={form.is_private} onChange={change}
                            className="w-5 h-5 rounded accent-forest-600" />
                        <Lock className="w-4 h-4 text-forest-700/60" />
                        <span className="text-sm font-medium text-forest-950">دواء خاص — لا يظهر عند المشاركة مع الطبيب</span>
                    </label>
                </section>

                <FormError>{error}</FormError>

                <div className="flex gap-3">
                    <button type="submit" className="btn-primary flex items-center gap-2" disabled={saving}>
                        <Save className="w-5 h-5" /> {saving ? "جارٍ الحفظ..." : "حفظ"}
                    </button>
                    <button type="button" className="btn-secondary" onClick={() => navigate(parent)}>
                        إلغاء
                    </button>
                </div>
            </form>
        </div>
    );
}
