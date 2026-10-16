import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api";
import "./Auth.css";

export default function Register() {
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            const res = await api.post("/auth/register", { name, email, password });
            localStorage.setItem("token", res.data.token);
            navigate("/");
        } catch (err) {
            setError(err.response?.data?.error || "حدث خطأ، حاول مرة أخرى");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <form className="auth-card" onSubmit={handleSubmit}>
                <h1>دوائي</h1>
                <p className="sub">إنشاء حساب جديد</p>

                <label>الاسم</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required />

                <label>البريد الإلكتروني</label>
                <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                />

                <label>كلمة المرور</label>
                <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={8}
                    required
                />

                {error && <div className="error">{error}</div>}

                <button type="submit" disabled={loading}>
                    {loading ? "جارٍ الإنشاء..." : "إنشاء حساب"}
                </button>

                <p className="switch">
                    عندك حساب؟ <Link to="/login">سجّل الدخول</Link>
                </p>
            </form>
        </div>
    );
}