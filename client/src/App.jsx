import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Today from "./pages/Today";
import Members from "./pages/Members";
import MemberForm from "./pages/MemberForm";
import Appointments from "./pages/Appointments";
import MemberProfile from "./pages/MemberProfile";
import MedicationForm from "./pages/MedicationForm";
import "./App.css";

function Protected({ children }) {
  const token = localStorage.getItem("token");
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* صفحات بلا هيكل */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* صفحات داخل الهيكل */}
        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/" element={<Today />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/new" element={<MemberForm />} />
          <Route path="/members/:id" element={<MemberProfile />} />
          <Route path="/members/:id/edit" element={<MemberForm />} />
          <Route path="/members/:id/medications/new" element={<MedicationForm />} />
          <Route path="/appointments" element={<Appointments />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}