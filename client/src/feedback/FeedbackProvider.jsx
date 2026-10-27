import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FeedbackContext } from "./context";
import { AlertTriangle, HelpCircle, CheckCircle2 } from "lucide-react";

const TOAST_MS = 3200;

export default function FeedbackProvider({ children }) {
    const [dialog, setDialog] = useState(null); // { title, message, confirmLabel, cancelLabel, danger }
    const [toasts, setToasts] = useState([]);
    const dialogRef = useRef(null);
    const resolver = useRef(null);
    const nextId = useRef(0);

    // يفتح نافذة التأكيد ويُرجع وعداً بـ true أو false
    const confirm = useCallback((options) => {
        setDialog({ confirmLabel: "تأكيد", cancelLabel: "إلغاء", ...options });
        return new Promise((resolve) => {
            resolver.current = resolve;
        });
    }, []);

    const toast = useCallback((message, type = "success") => {
        const id = ++nextId.current;
        setToasts((t) => [...t, { id, message, type }]);
        setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), TOAST_MS);
    }, []);

    // <dialog> الأصلي: يحبس التركيز داخله ويُغلق بزر Esc ويقرأه قارئ الشاشة
    useEffect(() => {
        const el = dialogRef.current;
        if (dialog && el && !el.open) el.showModal();
    }, [dialog]);

    const close = (answer) => {
        dialogRef.current?.close();
        setDialog(null);
        resolver.current?.(answer);
        resolver.current = null;
    };

    const value = useMemo(() => ({ confirm, toast }), [confirm, toast]);

    return (
        <FeedbackContext.Provider value={value}>
            {children}

            {dialog && (
                <dialog
                    ref={dialogRef}
                    className="card p-0 w-[min(28rem,calc(100vw-2rem))] !shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm"
                    aria-labelledby="confirm-title"
                    aria-describedby="confirm-message"
                    onCancel={(e) => { e.preventDefault(); close(false); }}
                    onClick={(e) => { if (e.target === e.currentTarget) close(false); }}
                >
                    <div className="p-6">
                        <div className="flex items-start gap-3">
                            <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${dialog.danger ? "bg-red-100 text-red-600" : "bg-forest-100 text-forest-600"}`}>
                                {dialog.danger ? <AlertTriangle className="w-5 h-5" /> : <HelpCircle className="w-5 h-5" />}
                            </div>
                            <div className="min-w-0">
                                <h2 id="confirm-title" className="text-lg font-bold text-forest-950">{dialog.title}</h2>
                                {dialog.message && (
                                    <p id="confirm-message" className="text-sm text-forest-700/80 mt-1 whitespace-pre-line leading-relaxed">{dialog.message}</p>
                                )}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-6">
                            <button
                                type="button"
                                className={dialog.danger ? "btn-danger" : "btn-primary"}
                                onClick={() => close(true)}
                            >
                                {dialog.confirmLabel}
                            </button>
                            {/* زر الإلغاء يأخذ التركيز أولاً: الضغط على Enter بالخطأ لا يحذف شيئاً */}
                            <button type="button" className="btn-secondary" onClick={() => close(false)} autoFocus>
                                {dialog.cancelLabel}
                            </button>
                        </div>
                    </div>
                </dialog>
            )}

            <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:left-6 z-[60] flex flex-col gap-2 items-stretch sm:items-start pointer-events-none" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div key={t.id}
                        className={`pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-3 shadow-xl text-sm font-medium animate-fade-up ${t.type === "error"
                            ? "bg-red-600 text-white shadow-red-600/30"
                            : "bg-forest-950 text-white shadow-forest-950/30"}`}>
                        {t.type === "error"
                            ? <AlertTriangle className="w-5 h-5 flex-shrink-0" aria-hidden="true" />
                            : <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-forest-300" aria-hidden="true" />}
                        {t.message}
                    </div>
                ))}
            </div>
        </FeedbackContext.Provider>
    );
}
