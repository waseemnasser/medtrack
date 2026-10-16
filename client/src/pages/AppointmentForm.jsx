import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api";
import "./Appointments.css";

export default function AppointmentForm() {
    const { id } = useParams();
    const isEdit = Boolean(id);
    const navigate = useNavigate();

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

    useEffect(() => { init(); }, [id]);

    const init = async () => {
        try {
            const mRes = await api.get("/members");
            setMembers(mRes.data);

            if (isEdit) {
                const aRes = await api.get("/appointments");
                const a = aRes.data.find((x) => String(x.id) === String(id));
                if (a) {
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
            } else if (mRes.data.length > 0) {
                setForm((f) => ({ ...f, member_id: mRes.data[0].id }));
            }
        } catch {
            setError("تعذّر تحميل البيانات");
        }
    };

    const change = (e) =>
        setForm({ ...form, [e.target.name]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setError("");
        if (!form.member_id) return setError("اختر الفرد");
        if (!form.title.trim()) return setError("الرجاء إدخال عنوان الموعد");
        if (!form.scheduled_at) return setError("الرجاء تحديد التاريخ والساعة");

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
            navigate("/appointments");
        } catch (err) {
            setError(err.response?.data?.error || "تعذّر الحفظ، حاول مجدداً");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="page">
            <h1>{isEdit ? "تعديل موعد" : "إضافة موعد"}</h1>

            <form className="form-card" onSubmit={submit}>
                <label>الفرد</label>
                <select name="member_id" value={form.member_id} onChange={change}>
                    <option value="">— اختر —</option>
                    {members.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                </select>

                <label>عنوان الموعد</label>
                <input
                    name="title"
                    value={form.title}
                    onChange={change}
                    placeholder="مثال: مراجعة طبيب القلب"
                />

                <label>التاريخ والساعة</label>
                <input
                    type="datetime-local"
                    name="scheduled_at"
                    value={form.scheduled_at}
                    onChange={change}
                />

                <label>اسم الطبيب</label>
                <input name="doctor_name" value={form.doctor_name} onChange={change} />

                <label>المكان</label>
                <input name="location" value={form.location} onChange={change} />

                <label>ملاحظات</label>
                <input
                    name="notes"
                    value={form.notes}
                    onChange={change}
                    placeholder="مثال: أخذ آخر تحليل معي"
                />

                {error && <div className="error">{error}</div>}

                <div className="form-actions">
                    <button type="submit" className="btn-primary" disabled={saving}>
                        {saving ? "جارٍ الحفظ..." : "حفظ"}
                    </button>
                    <button type="button" onClick={() => navigate("/appointments")}>
                        إلغاء
                    </button>
                </div>
            </form>
        </div>
    );
}