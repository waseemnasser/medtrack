import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";

export default function MemberForm() {
    const { id } = useParams();          // موجود عند التعديل، غير موجود عند الإضافة
    const isEdit = Boolean(id);
    const navigate = useNavigate();

    const [form, setForm] = useState({
        name: "",
        birth_date: "",
        chronic_conditions: "",
        allergies: "",
    });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    // عند التعديل: يجلب بيانات الفرد الحالية
    useEffect(() => {
        if (!isEdit) return;
        api.get("/members").then((res) => {
            const m = res.data.find((x) => String(x.id) === String(id));
            if (m) {
                setForm({
                    name: m.name || "",
                    birth_date: m.birth_date || "",
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
            } else {
                await api.post("/members", form);
            }
            navigate("/members");
        } catch (err) {
            setError(err.response?.data?.error || "تعذّر الحفظ، حاول مجدداً");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page">
            <h1>{isEdit ? "تعديل بيانات الفرد" : "إضافة فرد جديد"}</h1>

            <form className="form-card" onSubmit={submit}>
                <label>الاسم</label>
                <input
                    name="name"
                    value={form.name}
                    onChange={change}
                    placeholder="مثال: أبي، والدتي، أحمد"
                />

                <label>تاريخ الميلاد</label>
                <input
                    type="date"
                    name="birth_date"
                    value={form.birth_date}
                    onChange={change}
                />
                <span className="hint">اختياري — يمكنك إضافته لاحقاً</span>

                <label>الأمراض المزمنة</label>
                <input
                    name="chronic_conditions"
                    value={form.chronic_conditions}
                    onChange={change}
                    placeholder="مثال: ضغط، سكري"
                />

                <label>الحساسية من أدوية</label>
                <input
                    name="allergies"
                    value={form.allergies}
                    onChange={change}
                    placeholder="مثال: بنسلين"
                />

                {error && <div className="error">{error}</div>}

                <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? "جارٍ الحفظ..." : "حفظ"}
                    </button>
                    <button type="button" onClick={() => navigate("/members")}>
                        إلغاء
                    </button>
                </div>
            </form>
        </div>
    );
}