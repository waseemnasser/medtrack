import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import PageHeader from "../components/PageHeader";
import AllergyEditor from "../components/AllergyEditor";
import { fromServer, toPayload } from "../utils/allergies";
import { useFeedback } from "../feedback/context";
import "./Members.css";

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
        <div className="page">
            <PageHeader title={isEdit ? "تعديل بيانات الفرد" : "إضافة فرد جديد"} back={parent} />

            <form className="form-card" onSubmit={submit}>
                <label htmlFor="name">الاسم</label>
                <input
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={change}
                    placeholder="مثال: أحمد، سارة، أنا"
                />

                <label htmlFor="birth_date">تاريخ الميلاد</label>
                <input
                    id="birth_date"
                    type="date"
                    name="birth_date"
                    value={form.birth_date}
                    onChange={change}
                />
                <span className="hint">اختياري — يمكنك إضافته لاحقاً</span>

                <label htmlFor="chronic_conditions">الأمراض المزمنة</label>
                <input
                    id="chronic_conditions"
                    name="chronic_conditions"
                    value={form.chronic_conditions}
                    onChange={change}
                    placeholder="مثال: ضغط، سكري"
                />

                <label htmlFor="allergies">الحساسية من أدوية</label>
                <AllergyEditor items={allergies} onChange={setAllergies} />
                <span className="hint">
                    اختر المادة الفعّالة أو العائلة أو الاسم التجاري من القائمة، فننبّهك لكل دواء
                    يحتويها أياً كانت الشركة. وتظهر للطبيب بالأحمر عند المشاركة.
                </span>

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

            {isEdit && (
                <section className="danger-zone">
                    <h2>حذف الفرد</h2>
                    <p>يحذف الفرد وكل أدويته ومواعيده وسجل جرعاته. لا يمكن التراجع عن ذلك.</p>
                    <button type="button" className="btn-danger" onClick={remove} disabled={deleting}>
                        {deleting ? "جارٍ الحذف..." : "حذف الفرد نهائياً"}
                    </button>
                </section>
            )}
        </div>
    );
}
