import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import PageHeader from "../components/PageHeader";
import "./Members.css";

export default function MemberForm() {
    const { id } = useParams();          // موجود عند التعديل، غير موجود عند الإضافة
    const isEdit = Boolean(id);
    const navigate = useNavigate();
    const parent = isEdit ? `/members/${id}` : "/members";

    const [form, setForm] = useState({
        name: "",
        birth_date: "",
        chronic_conditions: "",
        allergies: "",
    });
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
                    allergies: m.allergies || "",
                });
            }
        });
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
            if (isEdit) {
                await api.put(`/members/${id}`, form);
                navigate(parent, { replace: true });
            } else {
                // بعد الإضافة نفتح ملف الفرد مباشرة: الخطوة التالية غالباً إضافة دواء
                const res = await api.post("/members", form);
                navigate(`/members/${res.data.id}`, { replace: true });
            }
        } catch (err) {
            setError(err.response?.data?.error || "تعذّر الحفظ، حاول مجدداً");
        } finally {
            setSaving(false);
        }
    };

    const remove = async () => {
        const ok = window.confirm(
            `سيتم حذف ${form.name} وكل أدويته ومواعيده نهائياً. هل أنت متأكد؟`
        );
        if (!ok) return;
        setDeleting(true);
        try {
            await api.delete(`/members/${id}`);
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
                    placeholder="مثال: أبي، والدتي، أحمد"
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
                <input
                    id="allergies"
                    name="allergies"
                    value={form.allergies}
                    onChange={change}
                    placeholder="مثال: بنسلين"
                />
                <span className="hint">تظهر للطبيب بالأحمر عند المشاركة</span>

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
