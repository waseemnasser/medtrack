import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import PageHeader from "../components/PageHeader";
import { formatDate, formatTime } from "../utils/format";
import "./Share.css";

// مدة صلاحية الرابط — الخادم يقبل أي عدد ساعات
const DURATIONS = [
    { hours: 24, label: "يوم واحد" },
    { hours: 72, label: "٣ أيام" },
    { hours: 168, label: "أسبوع" },
];

export default function SharePage() {
    const { id } = useParams();

    const [member, setMember] = useState(null);
    const [hours, setHours] = useState(24);
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
            const res = await api.post(`/share/${id}`, { hours });
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
            setError("تعذّر النسخ، انسخ الرابط يدوياً من المربع أعلاه");
        }
    };

    // مشاركة عبر تطبيقات الهاتف (واتساب، رسائل...) إن كان المتصفح يدعمها
    const canShare = typeof navigator !== "undefined" && Boolean(navigator.share);
    const share = async () => {
        try {
            await navigator.share({
                title: `ملف ${member?.name || "المريض"} — طمّني`,
                text: "رابط مؤقت لملف الأدوية والمواعيد",
                url: link.url,
            });
        } catch {
            // ألغى المستخدم المشاركة — لا شيء نفعله
        }
    };

    const expiry = (value) => {
        const d = new Date(String(value).replace(" ", "T"));
        const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return `${formatDate(day)} · ${formatTime(time)}`;
    };

    return (
        <div className="page">
            <PageHeader title="مشاركة مع الطبيب" back={`/members/${id}`} />

            {!link ? (
                <>
                    <div className="share-hero">
                        <h2>{member ? `ملف ${member.name}` : "ملف الفرد"}</h2>
                        <p>
                            أنشئ رابطاً مؤقتاً يفتحه الطبيب على هاتفه بلا حساب ولا تطبيق.
                            ينتهي تلقائياً، ولا يمكن تعديل أي شيء من خلاله.
                        </p>
                    </div>

                    <h3 className="section-title">ماذا سيرى الطبيب؟</h3>
                    <ul className="share-list">
                        <li>الأدوية الحالية وأوقات جرعاتها</li>
                        <li>الأمراض المزمنة والحساسية</li>
                        <li>سجل تأكيد الجرعات والمواعيد القادمة</li>
                        <li className="hidden-item">الأدوية المعلّمة «خاصة» لا تظهر أبداً</li>
                    </ul>

                    <h3 className="section-title">مدة صلاحية الرابط</h3>
                    <div className="segmented" role="radiogroup" aria-label="مدة صلاحية الرابط">
                        {DURATIONS.map((d) => (
                            <button
                                key={d.hours}
                                type="button"
                                role="radio"
                                aria-checked={hours === d.hours}
                                className={hours === d.hours ? "on" : ""}
                                onClick={() => setHours(d.hours)}
                            >
                                {d.label}
                            </button>
                        ))}
                    </div>

                    {error && <div className="error">{error}</div>}

                    <button className="btn-primary share-create" onClick={createLink} disabled={creating}>
                        {creating ? "جارٍ الإنشاء..." : "إنشاء الرابط"}
                    </button>
                </>
            ) : (
                <div className="share-result">
                    <div className="qr-frame">
                        <img src={link.qr_data_url} alt="رمز QR لرابط الملف" className="qr" />
                    </div>
                    <p className="qr-caption">اطلب من الطبيب مسح الرمز بكاميرا هاتفه</p>

                    <div className="link-box">{link.url}</div>

                    {error && <div className="error">{error}</div>}

                    <div className="share-actions">
                        <button className="btn-primary" onClick={copy}>
                            {copied ? "تم نسخ الرابط ✓" : "نسخ الرابط"}
                        </button>
                        {canShare && (
                            <button className="btn-outline" onClick={share}>إرسال…</button>
                        )}
                    </div>

                    <p className="expiry">
                        <span className="chip">ينتهي في {expiry(link.expires_at)}</span>
                    </p>

                    <button type="button" className="share-again" onClick={() => setLink(null)}>
                        إنشاء رابط بمدة أخرى
                    </button>
                </div>
            )}
        </div>
    );
}
