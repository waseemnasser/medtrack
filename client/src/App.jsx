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
import AppointmentForm from "./pages/AppointmentForm";
import SharePage from "./pages/SharePage";
import DoctorView from "./pages/DoctorView";
import "./styles/variables.css";
import "./styles/base.css";
import "./styles/components.css";

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
        <Route path="/share/:token" element={<DoctorView />} />

        {/* صفحات داخل الهيكل */}
        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/" element={<Today />} />
          <Route path="/members" element={<Members />} />
          <Route path="/members/new" element={<MemberForm />} />
          <Route path="/members/:id" element={<MemberProfile />} />
          <Route path="/members/:id/edit" element={<MemberForm />} />
          <Route path="/members/:id/medications/new" element={<MedicationForm />} />
          <Route path="/appointments" element={<Appointments />} />
          <Route path="/appointments/new" element={<AppointmentForm />} />
          <Route path="/appointments/:id/edit" element={<AppointmentForm />} />
          <Route path="/members/:id/share" element={<SharePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}