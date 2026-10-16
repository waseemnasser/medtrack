import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import "./Members.css";

// يحسب العمر من تاريخ الميلاد
function calcAge(birthDate) {
    if (!birthDate) return null;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

export default function Members() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    // يجلب الأفراد من السيرفر عند فتح الصفحة
    useEffect(() => {
        loadMembers();
    }, []);

    const loadMembers = async () => {
        try {
            const res = await api.get("/members");
            setMembers(res.data);
        } catch (err) {
            setError("تعذّر تحميل أفراد العائلة. تأكّد من الاتصال وحاول مجدداً.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, name) => {
        const ok = window.confirm(
            `سيتم حذف ${name} وكل أدويته ومواعيده. هل أنت متأكد؟`
        );
        if (!ok) return;
        try {
            await api.delete(`/members/${id}`);
            setMembers(members.filter((m) => m.id !== id));
        } catch (err) {
            alert("تعذّر الحذف، حاول مجدداً");
        }
    };

    if (loading) return <div className="page"><p>جارٍ التحميل...</p></div>;

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1>أفراد العائلة</h1>
                    <p className="sub">الأشخاص الذين تتابع أدويتهم ومواعيدهم</p>
                </div>
                <button className="btn-primary" onClick={() => navigate("/members/new")}>
                    إضافة فرد
                </button>
            </div>

            {error && <div className="error">{error}</div>}

            {members.length === 0 && !error ? (
                <div className="empty">
                    لم تُضف أي فرد بعد. اضغط «إضافة فرد» للبدء.
                </div>
            ) : (
                <div className="cards">
                    {members.map((m) => {
                        const age = calcAge(m.birth_date);
                        return (
                            <div className="card" key={m.id}>
                                <div
                                    className="card-body"
                                    onClick={() => navigate(`/members/${m.id}`)}
                                >
                                    <h2>{m.name}</h2>
                                    {age !== null && <p className="muted">{age} سنة</p>}
                                    {m.chronic_conditions && (
                                        <p className="muted">الأمراض المزمنة: {m.chronic_conditions}</p>
                                    )}
                                    {m.allergies && (
                                        <p className="muted">حساسية: {m.allergies}</p>
                                    )}
                                </div>
                                <div className="card-actions">
                                    <button onClick={() => navigate(`/members/${m.id}/edit`)}>
                                        تعديل
                                    </button>
                                    <button
                                        className="danger"
                                        onClick={() => handleDelete(m.id, m.name)}
                                    >
                                        حذف
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}