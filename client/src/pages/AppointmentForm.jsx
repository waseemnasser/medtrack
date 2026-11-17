import { useState, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import api from "../api";
import PageHeader from "../components/PageHeader";
import Field, { FormError } from "../components/Field";
import { useFeedback } from "../feedback/context";
import { Save } from "lucide-react";
import { appointmentTimeError, dateLimits } from "../utils/validate";
import { useUnsavedChanges } from "../utils/unsaved";

export default function AppointmentForm() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const { toast } = useFeedback();
    // فُتح النموذج من ملف فرد؟ نختاره مسبقاً ونرجع إلى ملفه بعد الحفظ
    const [searchParams] = useSearchParams();
    const fromMember = searchParams.get("member_id");
    const parent = fromMember ? `/members/${fromMember}?tab=appts` : "/appointments";

    const [members, setMembers] = useState([]);
    const [form, setForm] = useState({
        member_id: "",
        title: "",
        doctor_name: "",
        location: "",
        scheduled_at: "",
        notes: "",
    });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    // وقت الموعد عند فتحه للتعديل: موعد مضى يُعدَّل (ملاحظة، مكان) ما دام وقته لم يتغيّر
    const [originalAt, setOriginalAt] = useState("");
    const limits = dateLimits();
    // بعد التحميل: الفرد المختار مسبقاً وبيانات الموعد ليست «تعديلاً»
    const [loaded, setLoaded] = useState(false);
    const { allowLeave } = useUnsavedChanges(JSON.stringify(form), loaded);

    useEffect(() => {
        const init = async () => {
            try {
                const mRes = await api.get("/members");
                setMembers(mRes.data);

                if (isEdit) {
                    const aRes = await api.get("/appointments");
                    const a = aRes.data.find((x) => String(x.id) === String(id));
                    if (a) {
                        setOriginalAt(String(a.scheduled_at).replace(" ", "T").slice(0, 16));
                        setForm({
                            member_id: a.member_id || "",
                            title: a.title || "",
                            doctor_name: a.doctor_name || "",
                            location: a.location || "",
                            // تحويل "2026-10-28 11:00:00" إلى صيغة حقل datetime-local
                            scheduled_at: String(a.scheduled_at).replace(" ", "T").slice(0, 16),
                            notes: a.notes || "",
                        });
                    }
                } else if (fromMember) {
                    setForm((f) => ({ ...f, member_id: fromMember }));
                } else if (mRes.data.length > 0) {
                    setForm((f) => ({ ...f, member_id: mRes.data[0].id }));
                }
            } catch {
                setError("تعذّر تحميل البيانات");
            }
            setLoaded(true);
        };

        init();
    }, [id, isEdit, fromMember]);


    const change = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.member_id) return setError("اختر الفرد");
        if (!form.title.trim()) return setError("الرجاء إدخال عنوان الموعد");
        if (!form.scheduled_at) return setError("الرجاء تحديد التاريخ والساعة");
        const badTime = appointmentTimeError(form.scheduled_at, { allowPast: isEdit && form.scheduled_at === originalAt });
        if (badTime) return setError(badTime);

        const payload = {
            member_id: Number(form.member_id),
            title: form.title.trim(),
            doctor_name: form.doctor_name || null,
            location: form.location || null,
            // إعادة الصيغة إلى ما يتوقعه الخادم
            scheduled_at: form.scheduled_at.replace("T", " ") + ":00",
            notes: form.notes || null,
        };

        setSaving(true);
        try {
            if (isEdit) await api.put(`/appointments/${id}`, payload);
            else await api.post("/appointments", payload);
            toast(isEdit ? "حُفظ الموعد" : "أُضيف الموعد");
            allowLeave();
            navigate(parent, { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || "تعذّر الحفظ، حاول مجدداً");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl">
            <PageHeader title={isEdit ? "تعديل موعد" : "موعد جديد"} back={parent} />

            {/* noValidate: رسائلنا العربية (utils/validate.js) بدل فقاعة المتصفح بلغته؛ min/max تبقى لتقويم الاختيار */}
            <form className="card p-6 space-y-4" onSubmit={submit} noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="الفرد" htmlFor="member_id" required>
                        <select id="member_id" name="member_id" value={form.member_id} onChange={change} className="input-field">
                            <option value="">— اختر —</option>
                            {members.map((m) => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </Field>

                    <Field label="عنوان الموعد" htmlFor="title" required>
                        <input id="title" name="title" value={form.title} onChange={change}
                            placeholder="مثال: مراجعة طبيب القلب" className="input-field" />
                    </Field>
                </div>

                <Field label="التاريخ والساعة" htmlFor="scheduled_at" required
                    hint="يصلك تذكير مساء اليوم السابق، وتذكير آخر قبل الموعد بساعتين.">
                    <input id="scheduled_at" type="datetime-local" name="scheduled_at" value={form.scheduled_at}
                        onChange={change} max={limits.apptMax}
                        min={isEdit && originalAt && originalAt < limits.apptMin ? originalAt : limits.apptMin}
                        className="input-field" />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="اسم الطبيب" htmlFor="doctor_name">
                        <input id="doctor_name" name="doctor_name" value={form.doctor_name} onChange={change} className="input-field" />
                    </Field>
                    <Field label="المكان" htmlFor="location">
                        <input id="location" name="location" value={form.location} onChange={change} className="input-field" />
                    </Field>
                </div>

                <Field label="ملاحظات" htmlFor="notes">
                    <textarea id="notes" name="notes" value={form.notes} onChange={change} rows={3}
                        placeholder="مثال: أخذ آخر تحليل معي" className="input-field" />
                </Field>

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
