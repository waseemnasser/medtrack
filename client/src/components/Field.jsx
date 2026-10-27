// حقل نموذج بأسلوب نماذج النموذج الأولي: عنوان فوق الحقل، وتلميح خافت تحته
export default function Field({ label, htmlFor, hint, required, children, className = "" }) {
    return (
        <div className={className}>
            {label && (
                <label htmlFor={htmlFor} className="block text-sm font-semibold text-forest-800 mb-1.5">
                    {label}{required && <span className="text-red-500"> *</span>}
                </label>
            )}
            {children}
            {hint && <p className="text-xs text-forest-700/60 mt-1.5 leading-relaxed">{hint}</p>}
        </div>
    );
}

// رسالة خطأ تحت النموذج
export function FormError({ children }) {
    if (!children) return null;
    return (
        <div role="alert" className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 text-red-700 dark:text-red-300 px-4 py-3 text-sm">
            {children}
        </div>
    );
}
