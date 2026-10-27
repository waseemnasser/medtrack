import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import PageHeader from "../components/PageHeader";
import { formatDate, formatTime } from "../utils/format";
import "./Share.css";

// مدة صلاحية الرابط — الخادم يقبل أي عدد ساعات
// الرقم كبير بخط العرض، والوحدة تحته
const DURATIONS = [
    { hours: 24, num: "١", unit: "يوم" },
    { hours: 72, num: "٣", unit: "أيام" },
    { hours: 168, num: "٧", unit: "أيام" },
];

// ما يراه الطبيب — قائمة مرقّمة كمزايا الصفحة التعريفية
const SEES = [
    ["الأدوية الحالية", "وأوقات جرعاتها، والمادة الفعّالة لكل دواء."],
    ["الحساسية والأمراض المزمنة", "الحساسية أولاً وبالأحمر، مع شدّتها ونوع التفاعل."],
    ["سجل الجرعات والمواعيد", "آخر الجرعات المؤكَّدة، والمواعيد القادمة."],
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
                title: `ملف ${member?.name || "المريض"} — نبض`,
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
                    {/* بلا صندوق: عنوان كبير وسطر شرح — أسلوب الصفحة التعريفية */}
                    <header className="share-intro">
                        <span className="kicker">{member ? `ملف ${member.name}` : "ملف الفرد"}</span>
                        <h2>رابط مؤقّت للطبيب.</h2>
                        <p>
                            يفتحه الطبيب على هاتفه بلا حساب ولا تطبيق. للقراءة فقط،
                            وينتهي وحده في الموعد الذي تختاره.
                        </p>
                    </header>

                    <h3 className="section-title">ماذا سيرى الطبيب؟</h3>
                    <ol className="share-sees">
                        {SEES.map(([title, text], i) => (
                            <li key={title}>
                                <span className="share-num">{String(i + 1).padStart(2, "0")}</span>
                                <div>
                                    <b>{title}</b>
                                    <span>{text}</span>
                                </div>
                            </li>
                        ))}
                        <li className="hidden-item">
                            <span className="share-num">—</span>
                            <div>
                                <b>الأدوية الخاصة لا تظهر</b>
                                <span>ما علّمته «خاصاً» يبقى عندك، في الرابط وفي سجل الجرعات.</span>
                            </div>
                        </li>
                    </ol>

                    <h3 className="section-title">مدة صلاحية الرابط</h3>
                    <div className="share-durations" role="radiogroup" aria-label="مدة صلاحية الرابط">
                        {DURATIONS.map((d) => (
                            <button
                                key={d.hours}
                                type="button"
                                role="radio"
                                aria-checked={hours === d.hours}
                                className={hours === d.hours ? "on" : ""}
                                onClick={() => setHours(d.hours)}
                            >
                                <b>{d.num}</b>
                                <span>{d.unit}</span>
                            </button>
                        ))}
                    </div>

                    {error && <div className="error">{error}</div>}

                    <button className="btn-primary share-create" onClick={createLink} disabled={creating}>
                        {creating ? "جارٍ الإنشاء..." : "إنشاء الرابط"}
                    </button>
                </>
            ) : (
                /* تذكرة كتذكرة الصفحة التعريفية: الرابط في الجزء الرئيسي،
                   ورمز QR على الكعب المثقّب */
                <div className="share-ticket">
                    <div className="share-ticket-main">
                        <span className="kicker">{member ? `رابط ملف ${member.name}` : "رابط الملف"}</span>
                        <p className="share-expiry">
                            <small>صالح حتى</small>
                            {expiry(link.expires_at)}
                        </p>

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

                        <button type="button" className="share-again" onClick={() => setLink(null)}>
                            إنشاء رابط بمدة أخرى
                        </button>
                    </div>

                    <div className="share-ticket-stub">
                        <img src={link.qr_data_url} alt="رمز QR لرابط الملف" className="qr" />
                        <p className="qr-caption">يمسحه الطبيب بكاميرا هاتفه</p>
                    </div>
                </div>
            )}
        </div>
    );
}
