import { Outlet, NavLink, useNavigate } from "react-router-dom";
import InstallPrompt from "./InstallPrompt";

export default function Layout() {
    const navigate = useNavigate();

    const logout = () => {
        localStorage.removeItem("token");
        navigate("/login");
    };

    return (
        <div className="app-shell">
            <header className="top-bar">
                <span className="brand">دوائي</span>
                <button className="logout" onClick={logout}>خروج</button>
            </header>
            <InstallPrompt />
            <main className="app-main">
                <Outlet />
            </main>

            <nav className="bottom-nav">
                <NavLink to="/" end>
                    <span className="nav-icon">💊</span>
                    <span>جرعات اليوم</span>
                </NavLink>
                <NavLink to="/members">
                    <span className="nav-icon">👥</span>
                    <span>أفراد العائلة</span>
                </NavLink>
                <NavLink to="/appointments">
                    <span className="nav-icon">📅</span>
                    <span>المواعيد</span>
                </NavLink>
            </nav>
        </div>
    );
}