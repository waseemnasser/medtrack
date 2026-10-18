import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api";
import Skeleton from "../components/Skeleton";
import { calcAge, initial } from "../utils/format";
import "./Members.css";

export default function Members() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const navigate = useNavigate();

    // يجلب الأفراد من السيرفر عند فتح الصفحة
    useEffect(() => {
        const loadMembers = async () => {
            try {
                const res = await api.get("/members");
                setMembers(res.data);
            } catch {
                setError("تعذّر تحميل أفراد العائلة. تأكّد من الاتصال وحاول مجدداً.");
            } finally {
                setLoading(false);
            }
        };

        loadMembers();
    }, []);

    if (loading) return <Skeleton rows={3} />;

    return (
        <div className="page">
            <div className="page-head">
                <div>
                    <h1>العائلة</h1>
                    <p className="sub">الأشخاص الذين تتابع أدويتهم ومواعيدهم</p>
                </div>
                <button className="btn-primary" onClick={() => navigate("/members/new")}>
                    إضافة فرد
                </button>
            </div>

            {error && <div className="error">{error}</div>}

            {members.length === 0 && !error ? (
                <div className="empty">
                    لم تُضف أي فرد بعد.
                    <br />
                    <Link to="/members/new">أضف أول فرد من العائلة</Link>
                </div>
            ) : (
                <div className="member-list">
                    {/* البطاقة كلها رابط واحد إلى ملف الفرد.
                        التعديل والحذف داخل الملف، بعيداً عن نقرة خاطئة. */}
                    {members.map((m) => {
                        const age = calcAge(m.birth_date);
                        return (
                            <Link to={`/members/${m.id}`} className="member-item" key={m.id}>
                                <span className="avatar" aria-hidden="true">{initial(m.name)}</span>
                                <span className="member-text">
                                    <span className="member-name">{m.name}</span>
                                    <span className="member-meta">
                                        {[age !== null && `${age} سنة`, m.chronic_conditions]
                                            .filter(Boolean)
                                            .join(" · ") || "لا توجد تفاصيل بعد"}
                                    </span>
                                    {m.allergies && (
                                        <span className="chip danger">حساسية: {m.allergies}</span>
                                    )}
                                </span>
                                <svg className="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <path d="M15 5l-7 7 7 7" />
                                </svg>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
