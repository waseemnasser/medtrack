import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import PageHeader from "../components/PageHeader";
import AllergyEditor from "../components/AllergyEditor";
import { fromServer, toPayload } from "../utils/allergies";
import Field, { FormError } from "../components/Field";
import { useFeedback } from "../feedback/context";
import { Save, Trash2 } from "lucide-react";

export default function MemberForm() {
    const { id } = useParams();          // موجود عند التعديل، غير موجود عند الإضافة
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const { confirm, toast } = useFeedback();
    const parent = isEdit ? `/members/${id}` : "/members";

    const [form, setForm] = useState({
        name: "",
        birth_date: "",
        chronic_conditions: "",
    });
    // الحساسية بنود منظّمة (مادة أو عائلة)، لا نص — تُحفظ بطلب منفصل
    const [allergies, setAllergies] = useState([]);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // عند التعديل: يجلب بيانات الفرد الحالية
    useEffect(() => {
        if (!isEdit) return;
        api.get("/members").then((res) => {
            const m = res.data.find((x) => String(x.id) === String(id));
            if (m) {
                setForm({
                    name: m.name || "",
                    birth_date: m.birth_date ? String(m.birth_date).slice(0, 10) : "",
                    chronic_conditions: m.chronic_conditions || "",
                });
            }
        });
        api.get(`/members/${id}/allergies`)
            .then((res) => setAllergies(res.data.allergies.map(fromServer)))
            .catch(() => setError("تعذّر تحميل الحساسية"));
    }, [id, isEdit]);

    const change = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.name.trim()) {
            setError("الرجاء إدخال الاسم");
            return;
        }
        setSaving(true);
        try {
            const memberId = isEdit
                ? (await api.put(`/members/${id}`, form), id)
                : (await api.post("/members", form)).data.id;
            const { data } = await api.put(`/members/${memberId}/allergies`, { items: toPayload(allergies) });

            // حساسية جديدة لدواء يأخذه أصلاً: ننبّه الآن، والتفاصيل في ملفه
            if (data.conflicts.medications.length) {
                toast(`تنبيه: دواء حالي لـ${form.name} يتعارض مع الحساسية المسجّلة — التفاصيل في الملف`);
            } else if (isEdit) {
                toast("حُفظت التعديلات");
            }
            // بعد الإضافة نفتح ملف الفرد مباشرة: الخطوة التالية غالباً إضافة دواء
            navigate(`/members/${memberId}`, { replace: true });
        } catch (err) {
            setError(err.response?.data?.error || "تعذّر الحفظ، حاول مجدداً");
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        const ok = await confirm({
            title: `حذف ${form.name}؟`,
            message: "ستُحذف كل أدويته ومواعيده وسجل جرعاته نهائياً. لا يمكن التراجع عن ذلك.",
            confirmLabel: "حذف نهائياً",
            danger: true,
        });
        if (!ok) return;
        setDeleting(true);
        try {
            await api.delete(`/members/${id}`);
            toast(`حُذف ${form.name}`);
            navigate("/members", { replace: true });
        } catch {
            setError("تعذّر الحذف، حاول مجدداً");
            setDeleting(false);
        }
    };


    return (
        <div className="max-w-2xl">
            <PageHeader title={isEdit ? "تعديل بيانات الفرد" : "إضافة فرد جديد"} back={parent} />

            <form className="card p-6 space-y-5" onSubmit={submit}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="الاسم" htmlFor="name" required>
                        <input id="name" name="name" value={form.name} onChange={change}
                            placeholder="مثال: أحمد، سارة، أنا" className="input-field" />
                    </Field>

                    <Field label="تاريخ الميلاد" htmlFor="birth_date" hint="اختياري — يمكنك إضافته لاحقاً">
                        <input id="birth_date" type="date" name="birth_date" value={form.birth_date}
                            onChange={change} className="input-field" />
                    </Field>
                </div>

                <Field label="الأمراض المزمنة" htmlFor="chronic_conditions">
                    <input id="chronic_conditions" name="chronic_conditions" value={form.chronic_conditions}
                        onChange={change} placeholder="مثال: ضغط، سكري" className="input-field" />
                </Field>

                <Field label="الحساسية من أدوية" htmlFor="allergies"
                    hint="اختر المادة الفعّالة أو العائلة أو الاسم التجاري من القائمة، فننبّهك لكل دواء يحتويها أياً كانت الشركة. وتظهر للطبيب بالأحمر عند المشاركة.">
                    <AllergyEditor items={allergies} onChange={setAllergies} />
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

            {isEdit && (
                <section className="card p-6 mt-6 !border-red-200 dark:!border-red-900/60">
                    <h2 className="text-lg font-bold text-red-600 dark:text-red-400">حذف الفرد</h2>
                    <p className="text-sm text-forest-700/70 mt-1 mb-4">يحذف الفرد وكل أدويته ومواعيده وسجل جرعاته. لا يمكن التراجع عن ذلك.</p>
                    <button type="button" className="btn-danger flex items-center gap-2" onClick={remove} disabled={deleting}>
                        <Trash2 className="w-4 h-4" /> {deleting ? "جارٍ الحذف..." : "حذف الفرد نهائياً"}
                    </button>
                </section>
            )}
        </div>
    );
}
