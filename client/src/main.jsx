import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { API_URL } from './api'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // BASE_URL: «/» محلياً، «/medtrack/» على GitHub Pages
    const base = import.meta.env.BASE_URL;
    // ?api=: الـ service worker يحتاج عنوان الخادم لزر «تم الأخذ» في الإشعار
    navigator.serviceWorker.register(`${base}sw.js?api=${encodeURIComponent(API_URL)}`, { scope: base }).catch(() => { });
  });
}
