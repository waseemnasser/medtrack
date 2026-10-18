/**
 * هيكل تحميل بشكل الصفحة القادمة — بدل نص «جارٍ التحميل...».
 * يرى المستخدم فوراً أين سيظهر كل شيء، فيبدو الانتظار أقصر.
 *
 * variant: "today" | "list" | "profile"
 */
export default function Skeleton({ variant = "list", rows = 4 }) {
    return (
        <div className="page" aria-busy="true" aria-label="جارٍ التحميل">
            <div className="sk sk-title" />
            <div className="sk sk-sub" />

            {variant === "today" && (
                <>
                    <div className="sk sk-hero" />
                    <div className="sk sk-bar" />
                </>
            )}

            {variant === "profile" && (
                <>
                    <div className="sk sk-profile" />
                    <div className="sk-actions">
                        <div className="sk sk-action" />
                        <div className="sk sk-action" />
                        <div className="sk sk-action" />
                    </div>
                    <div className="sk sk-tabs" />
                </>
            )}

            <div className="sk-rows">
                {Array.from({ length: rows }, (_, i) => (
                    <div className="sk-row" key={i}>
                        <div className="sk sk-avatar" />
                        <div className="sk-lines">
                            <div className="sk sk-line" />
                            <div className="sk sk-line short" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
