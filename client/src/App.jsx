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
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import FeedbackProvider from "./feedback/FeedbackProvider";
import "./styles/variables.css";
import "./styles/base.css";
import "./styles/components.css";

const loggedIn = () => Boolean(localStorage.getItem("token"));

// صفحات تحتاج تسجيل دخول
function Protected({ children }) {
  return loggedIn() ? children : <Navigate to="/login" replace />;
}

// صفحتا الدخول والتسجيل: من سجّل دخوله لا يحتاجهما
function GuestOnly({ children }) {
  return loggedIn() ? <Navigate to="/" replace /> : children;
}

/*
  خريطة التطبيق
  ─────────────
  اليوم         /
  العائلة       /members
    └ ملف الفرد  /members/:id            (الأدوية · المواعيد)
        ├ تعديل الفرد       /members/:id/edit
        ├ إضافة دواء        /members/:id/medications/new
        ├ تعديل دواء        /members/:id/medications/:medId/edit
        └ مشاركة مع الطبيب  /members/:id/share
  المواعيد      /appointments
  الحساب        /account
  صفحة الطبيب  /share/:token   (عامة، بلا تسجيل دخول)
*/
export default function App() {
  return (
    <BrowserRouter>
      <FeedbackProvider>
        <Routes>
          {/* صفحات بلا هيكل */}
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/share/:token" element={<DoctorView />} />

          {/* صفحات داخل الهيكل */}
          <Route element={<Protected><Layout /></Protected>}>
            <Route path="/" element={<Today />} />

            <Route path="/members" element={<Members />} />
            <Route path="/members/new" element={<MemberForm />} />
            <Route path="/members/:id" element={<MemberProfile />} />
            <Route path="/members/:id/edit" element={<MemberForm />} />
            <Route path="/members/:id/medications/new" element={<MedicationForm />} />
            <Route path="/members/:id/medications/:medId/edit" element={<MedicationForm />} />
            <Route path="/members/:id/share" element={<SharePage />} />

            <Route path="/appointments" element={<Appointments />} />
            <Route path="/appointments/new" element={<AppointmentForm />} />
            <Route path="/appointments/:id/edit" element={<AppointmentForm />} />

            <Route path="/account" element={<Account />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </FeedbackProvider>
    </BrowserRouter>
  );
}
