import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import api from "../api";
import NotificationBell from "./NotificationBell";
import { initial } from "../utils/format";

/**
 * زاوية التطبيق: اسم الحساب (رابط إلى صفحة الحساب) وجرس الإشعارات.
 * الحاسوب المشترك بين أفراد العائلة: الاسم يقول من المسجّل الآن.
 */
export default function AccountCorner() {
    const [me, setMe] = useState(null);

    useEffect(() => {
        api.get("/auth/me").then((r) => setMe(r.data)).catch(() => {});
    }, []);

    return (
        // الاسم أولاً ثم الجرس: في الواجهة العربية يصير الجرس في الزاوية تماماً
        <div className="account-corner">
            {me && (
                <Link to="/account" className="account-chip" title={me.email}>
                    <span className="account-avatar" aria-hidden="true">{initial(me.name)}</span>
                    <span className="account-name">{me.name}</span>
                </Link>
            )}
            <NotificationBell />
        </div>
    );
}
