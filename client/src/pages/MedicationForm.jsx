import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import PageHeader from "../components/PageHeader";
import { useFeedback } from "../feedback/context";
import "./MedicationForm.css";

const DAY_LABELS = [
    { n: "1", label: "ح" }, { n: "2", label: "ن" }, { n: "3", label: "ث" },
    { n: "4", label: "ر" }, { n: "5", label: "خ" }, { n: "6", label: "ج" },
    { n: "7", label: "س" },
];

// تاريخ اليوم بصيغة حقل التاريخ «2026-10-18»
const todayISO = () => new Date().toISOString().slice(0, 10);

const FORMS = ["أقراص", "أقراص ملبسة", "محافظ", "شراب", "معلق", "محلول للحقن", "تحاميل", "قطرة", "مرهم", "كريم", "بخاخ"];

export default function MedicationForm() {
    const { id: memberId, medId } = useParams();   // medId موجود عند التعديل فقط
    const isEdit = Boolean(medId);
    const navigate = useNavigate();
    const parent = `/members/${memberId}`;
    const { toast } = useFeedback();

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
        setResults([]);
    };

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
                active_ingredient: form.active_ingredient || null,
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
            if (isEdit) await api.put(`/medications/${medId}`, payload);
            else await api.post("/medications", payload);
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

            <form className="form-card" onSubmit={submit}>
                {/* ── بيانات الدواء ── */}
                <h3 className="form-section">بيانات الدواء</h3>

                <label>اسم الدواء</label>
                <div className="search-wrap">
                    <input
                        name="name"
                        value={form.name}
                        onChange={onNameChange}
                        placeholder="ابدأ بالكتابة للبحث..."
                        autoComplete="off"
                    />
                    {showResults && (
                        <ul className="search-results">
                            {results.map((r) => (
                                <li key={r.id} onClick={() => pickFromCatalog(r)}>
                                    <strong>{r.brand_name}</strong>
                                    <span>{r.active_ingredient} {r.strength && `— ${r.strength}`}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <span className="hint">
                    {searching ? "جارٍ البحث..." : "لم تجد الدواء؟ اكتب اسمه كما هو وتابع."}
                </span>

                <label>المادة الفعّالة</label>
                <input name="active_ingredient" value={form.active_ingredient} onChange={change} />

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