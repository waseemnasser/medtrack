/**
 * هيكل تحميل بشكل الصفحة القادمة — بدل نص «جارٍ التحميل...».
 * يرى المستخدم فوراً أين سيظهر كل شيء، فيبدو الانتظار أقصر.
 *
 * variant: "today" | "list" | "profile"
 */
const block = "bg-sage-100 dark:bg-forest-800/50 animate-pulse rounded-xl";

export default function Skeleton({ variant = "list", rows = 4 }) {
    return (
        <div className="space-y-6" aria-busy="true" aria-label="جارٍ التحميل">
            <div className="space-y-2">
                <div className={`${block} h-8 w-48`} />
                <div className={`${block} h-4 w-32`} />
            </div>

            {variant === "today" && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[0, 1, 2, 3].map((i) => <div key={i} className={`${block} h-32 rounded-2xl`} />)}
                </div>
            )}

            {variant === "profile" && <div className={`${block} h-36 rounded-2xl`} />}

            <div className="card p-6 space-y-3">
                {Array.from({ length: rows }, (_, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <div className={`${block} w-12 h-12 flex-shrink-0`} />
                        <div className="flex-1 space-y-2">
                            <div className={`${block} h-4 w-2/3`} />
                            <div className={`${block} h-3 w-1/3`} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
