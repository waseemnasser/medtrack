import { Link } from "react-router-dom";
import { MapPinOff } from "lucide-react";

// رابط قديم أو مكتوب خطأ — نرشد المستخدم بدل صفحة بيضاء
export default function NotFound() {
    return (
        <div className="card p-12 text-center max-w-xl mx-auto mt-8">
            <div className="w-20 h-20 bg-sage-100 dark:bg-forest-800/60 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPinOff className="w-10 h-10 text-sage-400 dark:text-forest-600" />
            </div>
            <h1 className="text-xl font-bold text-forest-950">هذه الصفحة غير موجودة</h1>
            <p className="text-forest-700/60 mt-1">ربما تغيّر الرابط أو حُذف ما كان فيه.</p>
            <Link to="/" className="btn-primary inline-block mt-5">العودة إلى جرعات اليوم</Link>
        </div>
    );
}
