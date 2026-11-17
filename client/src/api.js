import axios from "axios";

// عنوان الخادم: محلياً localhost، ويمكن تغييره عند النشر بمتغيّر VITE_API_URL
// (يُمرَّر أيضاً إلى sw.js في main.jsx لزر «تم الأخذ» في الإشعار)
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

const api = axios.create({
    baseURL: API_URL,
});

// يرفق التوكن تلقائياً مع كل طلب
api.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// الجلسة لم تعد صالحة (انتهت، أو تغيّرت كلمة المرور من جهاز آخر): بدل أخطاء في
// كل صفحة، نعود إلى الدخول برسالة واضحة. فقط لطلبات أُرسل معها توكن.
api.interceptors.response.use(
    (res) => res,
    (err) => {
        if (err.response?.status === 401 && err.config?.headers?.Authorization && localStorage.getItem("token")) {
            localStorage.removeItem("token");
            window.location.replace(`${import.meta.env.BASE_URL}login?expired=1`);
        }
        return Promise.reject(err);
    }
);

export default api;