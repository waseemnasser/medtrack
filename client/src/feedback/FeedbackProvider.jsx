import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { FeedbackContext } from "./context";
import "./Feedback.css";

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
                    className="confirm-dialog"
                    aria-labelledby="confirm-title"
                    aria-describedby="confirm-message"
                    onCancel={(e) => { e.preventDefault(); close(false); }}
                    onClick={(e) => { if (e.target === e.currentTarget) close(false); }}
                >
                    <div className="confirm-body">
                        <h2 id="confirm-title">{dialog.title}</h2>
                        {dialog.message && <p id="confirm-message">{dialog.message}</p>}
                        <div className="confirm-actions">
                            <button
                                type="button"
                                className={dialog.danger ? "btn-danger-solid" : "btn-primary"}
                                onClick={() => close(true)}
                            >
                                {dialog.confirmLabel}
                            </button>
                            {/* زر الإلغاء يأخذ التركيز أولاً: الضغط على Enter بالخطأ لا يحذف شيئاً */}
                            <button type="button" className="btn-outline" onClick={() => close(false)} autoFocus>
                                {dialog.cancelLabel}
                            </button>
                        </div>
                    </div>
                </dialog>
            )}

            <div className="toast-stack" role="status" aria-live="polite">
                {toasts.map((t) => (
                    <div className={`toast ${t.type}`} key={t.id}>
                        <span className="toast-icon" aria-hidden="true">
                            {t.type === "error" ? "!" : "✓"}
                        </span>
                        {t.message}
                    </div>
                ))}
            </div>
        </FeedbackContext.Provider>
    );
}
