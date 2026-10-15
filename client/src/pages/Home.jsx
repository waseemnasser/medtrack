import { useNavigate } from "react-router-dom";

export default function Home() {
    const navigate = useNavigate();

    const logout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    return (
        <div style={{ padding: 24 }}>
            <h1>تم تسجيل الدخول بنجاح ✅</h1>
            <p>هنا رح تصير صفحة "جرعات اليوم".</p>
            <button onClick={logout}>تسجيل الخروج</button>
        </div>
    );
}