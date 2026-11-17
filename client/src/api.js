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

export default api;