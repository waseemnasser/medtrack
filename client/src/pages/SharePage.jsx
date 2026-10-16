import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api";
import "./Share.css";

export default function SharePage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [member, setMember] = useState(null);
    const [link, setLink] = useState(null);
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("/members")
            .then((res) => setMember(res.data.find((m) => String(m.id) === String(id))))
            .catch(() => setError("تعذّر تحميل بيانات الفرد"));
    }, [id]);

    const createLink = async () => {
        setCreating(true);
        setError("");
        try {
            const res = await api.post(`/share/${id}`, { hours: 24 });
            setLink(res.data);
        } catch (err) {
            setError(err.response?.data?.error || "تعذّر إنشاء الرابط، حاول مجدداً");
        } finally {
            setCreating(false);
        }
    };

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(link.url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            alert("تعذّر النسخ، انسخ الرابط يدوياً");
        }
    };

    const expiryText = (value) => {
        const d = new Date(String(value).replace(" ", "T"));
        const hour = d.getHours();
        const suffix = hour < 12 ? "ص" : "م";
        const h12 = hour % 12 === 0 ? 12 : hour % 12;
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} الساعة ${h12}:${mm} ${suffix}`;
    };

    return (
        <div className="page">
            <h1>مشاركة الملف مع الطبيب</h1>
            {member && <p className="sub">{member.name}</p>}

            <div className="form-card">
                <p className="share-intro">
                    أنشئ رابطاً مؤقتاً يعرض أدوية ومواعيد هذا الفرد.
                    الرابط ينتهي تلقائياً بعد 24 ساعة.
                </p>
                <p className="share-note">
                    الأدوية المعلّمة كـ«خاصة» لن تظهر في هذا الرابط.
                </p>

                {error && <div className="error">{error}</div>}

                {!link ? (
                    <button className="btn-primary" onClick={createLink} disabled={creating}>
                        {creating ? "جارٍ الإنشاء..." : "إنشاء رابط"}
                    </button>
                ) : (
                    <div className="share-result">
                        <img src={link.qr_data_url} alt="رمز الوصول" className="qr" />
                        <p className="qr-caption">امسح الرمز بكاميرا الهاتف</p>

                        <div className="link-box">{link.url}</div>

                        <button className="btn-primary" onClick={copy}>
                            {copied ? "تم نسخ الرابط ✓" : "نسخ الرابط"}
                        </button>

                        <p className="muted small expiry">
                            ينتهي الرابط في {expiryText(link.expires_at)}
                        </p>
                    </div>
                )}

                <div className="form-actions">
                    <button type="button" onClick={() => navigate(`/members/${id}`)}>
                        رجوع
                    </button>
                </div>
            </div>
        </div>
    );
}