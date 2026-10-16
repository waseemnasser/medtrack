import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Members from "./pages/Members";
import MemberForm from "./pages/MemberForm";
import Today from "./pages/Today";
import "./App.css";

// يمنع فتح الصفحات الداخلية بدون تسجيل دخول
function Protected({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/members" element={<Protected><Members /></Protected>} />
        <Route path="/members/new" element={<Protected><MemberForm /></Protected>} />
        <Route path="/members/:id/edit" element={<Protected><MemberForm /></Protected>} />
        <Route
          path="/"
          element={
            <Protected>
              <Today />
            </Protected>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}