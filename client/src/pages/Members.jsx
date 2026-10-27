import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Users, Plus, AlertTriangle, Heart, Calendar, ChevronLeft } from "lucide-react";
import api from "../api";
import Skeleton from "../components/Skeleton";
import { calcAge, initial } from "../utils/format";

export default function Members() {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // يجلب الأفراد من السيرفر عند فتح الصفحة
    useEffect(() => {
        const loadMembers = async () => {
            try {
                const res = await api.get("/members");
                setMembers(res.data);
            } catch {
                setError("تعذّر تحميل أفراد العائلة. تأكّد من الاتصال وحاول مجدداً.");
            } finally {
                setLoading(false);
            }
        };

        loadMembers();
    }, []);

    if (loading) return <Skeleton rows={3} />;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl lg:text-3xl font-extrabold text-forest-950">العائلة</h1>
                    <p className="text-forest-700/60 mt-1">الأشخاص الذين تتابع أدويتهم ومواعيدهم</p>
                </div>
                <Link to="/members/new" className="btn-primary flex items-center gap-2 flex-shrink-0">
                    <Plus className="w-5 h-5" /> إضافة فرد
                </Link>
            </div>

            {error && <div className="card p-4 !border-red-200 bg-red-50 text-red-700">{error}</div>}

            {members.length === 0 && !error ? (
                <div className="card p-12 text-center">
                    <div className="w-20 h-20 bg-sage-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-10 h-10 text-sage-400" />
                    </div>
                    <h3 className="text-lg font-bold text-forest-950">لم تُضف أي فرد بعد</h3>
                    <p className="text-forest-700/60 mt-1">ابدأ بنفسك أو بأحد من تتابع أدويته.</p>
                    <Link to="/members/new" className="btn-primary mt-4 inline-flex items-center gap-2">
                        <Plus className="w-5 h-5" /> أضف أول فرد
                    </Link>
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* البطاقة كلها رابط واحد إلى ملف الفرد.
                        التعديل والحذف داخل الملف، بعيداً عن نقرة خاطئة. */}
                    {members.map((m) => {
                        const age = calcAge(m.birth_date);
                        return (
                            <Link to={`/members/${m.id}`} key={m.id} className="card card-hover p-5 block group">
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 gradient-forest rounded-2xl flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
                                        {initial(m.name)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-forest-950 truncate">{m.name}</h3>
                                        <p className="text-sm text-forest-700/60 flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {age !== null ? `${age} سنة` : "العمر غير محدّد"}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                            {m.chronic_conditions && (
                                                <span className="badge badge-warning max-w-full">
                                                    <Heart className="w-3 h-3 flex-shrink-0" />
                                                    <span className="truncate">{m.chronic_conditions}</span>
                                                </span>
                                            )}
                                            {m.allergies && (
                                                <span className="badge badge-danger max-w-full">
                                                    <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                                                    <span className="truncate">حساسية: {m.allergies}</span>
                                                </span>
                                            )}
                                            {!m.chronic_conditions && !m.allergies && (
                                                <span className="text-xs text-forest-700/60">لا توجد تفاصيل بعد</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-4 pt-4 border-t border-sage-100 dark:border-forest-800/60 text-sm font-medium text-forest-600">
                                    فتح الملف
                                    <ChevronLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                                </div>
                            </Link>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
