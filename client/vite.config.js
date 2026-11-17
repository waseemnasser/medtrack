import { createHash } from 'node:crypto'
import process from 'node:process'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// سياسة أمان المحتوى (CSP) — في البناء فقط.
// تمنع المتصفح من تشغيل أي سكربت ليس من ملفات التطبيق نفسه، فلو تسلّل نص
// خبيث إلى الصفحة (XSS) لا يعمل، ولا يقرأ توكن الدخول من localStorage.
// GitHub Pages لا يسمح بترويسات، فتُكتب وسم <meta> في index.html.
// ليست في التطوير: خادم Vite يحقن سكربتات مضمَّنة (التحديث الفوري).
function contentSecurityPolicy(apiUrl) {
  const api = new URL(apiUrl).origin
  return {
    name: 'nabd-csp',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // السكربت المضمَّن الوحيد (المظهر قبل الرسم) يُسمح به ببصمته فقط:
        // أي تعديل عليه بلا إعادة بناء، أو أي سكربت مضمَّن آخر، يُحجب
        const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
          .map(([, body]) => `'sha256-${createHash('sha256').update(body).digest('base64')}'`)
        const policy = [
          "default-src 'self'",
          `script-src 'self' ${hashes.join(' ')}`.trim(),
          // style-src يسمح بالمضمَّن: React وGSAP يكتبان style، وخطره أقل بكثير من السكربت
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
          "font-src 'self' https://fonts.gstatic.com",
          // data: لصورة رمز QR في بطاقة الطوارئ
          "img-src 'self' data: blob:",
          `connect-src 'self' ${api}`,
          "worker-src 'self'",
          "manifest-src 'self'",
          "object-src 'none'",
          "base-uri 'self'",
          "form-action 'self'",
          ...(api.startsWith('https:') ? ['upgrade-insecure-requests'] : []),
        ].join('; ')
        // أول ما في <head> بعد charset: السياسة لا تحمي ما قبلها
        return html.replace(
          /<meta charset="UTF-8" \/>/i,
          (m) => `${m}\n    <meta http-equiv="Content-Security-Policy" content="${policy}">`
        )
      },
    },
  }
}

// https://vite.dev/config/
// المسار الأساسي «/» محلياً. للنشر على GitHub Pages: npm run build:pages
// (يبني بمسار /medtrack/ عبر --base).
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  return {
    plugins: [react(), contentSecurityPolicy(env.VITE_API_URL || 'http://localhost:5000/api')],
  }
})
