import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
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
import DoctorView from "./pages/DoctorView";
import Account from "./pages/Account";
import Emergency from "./pages/Emergency";
import VoiceLog from "./pages/VoiceLog";
import NotFound from "./pages/NotFound";
import Landing from "./pages/Landing";
import FeedbackProvider from "./feedback/FeedbackProvider";
import "./styles/app.css";

const loggedIn = () => Boolean(localStorage.getItem("token"));

// صفحات تحتاج تسجيل دخول. الزائر الجديد على الرابط الرئيسي يرى
// الصفحة التعريفية، ومن فتح رابطاً داخلياً يُطلب منه الدخول
function Protected({ children }) {
  const { pathname } = useLocation();
  if (loggedIn()) return children;
  return <Navigate to={pathname === "/" ? "/welcome" : "/login"} replace />;
}

// صفحة المشاركة القديمة: الرابط ورمز QR صارا في بطاقة الطوارئ
function ShareMoved() {
  const { id } = useParams();
  return <Navigate to={`/emergency?member=${id}`} replace />;
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
        └ (/members/:id/share القديمة ← بطاقة الطوارئ: المشاركة صارت فيها)
  المواعيد      /appointments
  الطوارئ       /emergency?member=  (بطاقة الطوارئ)
  الصوت         /voice?member=      (التأكيد الصوتي)
  الحساب        /account
  الصفحة التعريفية /welcome     (عامة)
  صفحة الطبيب  /share/:token   (عامة، بلا تسجيل دخول)
*/
export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "") || "/"}>
      <FeedbackProvider>
        <Routes>
          {/* صفحات بلا هيكل */}
          <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
          <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
          <Route path="/welcome" element={<Landing />} />
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
            <Route path="/members/:id/share" element={<ShareMoved />} />

            <Route path="/appointments" element={<Appointments />} />
            <Route path="/appointments/new" element={<AppointmentForm />} />
            <Route path="/appointments/:id/edit" element={<AppointmentForm />} />

            <Route path="/emergency" element={<Emergency />} />
            <Route path="/voice" element={<VoiceLog />} />

            <Route path="/account" element={<Account />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </FeedbackProvider>
    </BrowserRouter>
  );
}
