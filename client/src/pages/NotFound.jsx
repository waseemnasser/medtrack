import { Link } from "react-router-dom";

// رابط قديم أو مكتوب خطأ — نرشد المستخدم بدل صفحة بيضاء
export default function NotFound() {
    return (
        <div className="page">
            <div className="empty">
                <strong>هذه الصفحة غير موجودة</strong>
                <br />
                ربما تغيّر الرابط أو حُذف ما كان فيه.
                <br />
                <Link to="/">العودة إلى جرعات اليوم</Link>
            </div>
        </div>
    );
}
