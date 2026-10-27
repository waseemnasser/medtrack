import { Phone, Plus, X } from "lucide-react";

// الخادم يقبل خمس جهات على الأكثر (routes/members.js)
const MAX_CONTACTS = 5;

/**
 * أرقام الطوارئ للفرد: اسم ورقم وصلة القرابة.
 * تظهر على بطاقة الطوارئ أزراراً يُتّصل بها بلمسة.
 */
export default function ContactsEditor({ items, onChange }) {
    const update = (i, patch) => onChange(items.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
    const remove = (i) => onChange(items.filter((_, idx) => idx !== i));
    const add = () => onChange([...items, { name: "", phone: "", relation: "" }]);

    return (
        <div className="space-y-2">
            {items.map((c, i) => (
                <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_8rem_auto] gap-2 bg-sage-50 dark:bg-forest-800/40 rounded-xl p-3">
                    <input value={c.name} onChange={(e) => update(i, { name: e.target.value })}
                        placeholder="الاسم" aria-label={`اسم جهة الطوارئ ${i + 1}`} maxLength={80} className="input-field !py-2" />
                    <input value={c.phone} onChange={(e) => update(i, { phone: e.target.value })}
                        placeholder="رقم الهاتف" aria-label={`رقم هاتف جهة الطوارئ ${i + 1}`} type="tel" inputMode="tel" dir="ltr"
                        maxLength={20} className="input-field !py-2 text-right" />
                    <input value={c.relation} onChange={(e) => update(i, { relation: e.target.value })}
                        placeholder="القرابة" aria-label={`قرابة جهة الطوارئ ${i + 1}`} maxLength={40} className="input-field !py-2" />
                    <button type="button" onClick={() => remove(i)} aria-label={`حذف جهة الطوارئ ${i + 1}`}
                        className="p-2 justify-self-end text-red-500 hover:bg-red-50 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            ))}
            {items.length < MAX_CONTACTS && (
                <button type="button" onClick={add}
                    className="w-full border-2 border-dashed border-sage-300 rounded-xl py-3 text-sm font-semibold text-forest-600 hover:border-forest-400 hover:bg-mint-50 flex items-center justify-center gap-2 transition-colors">
                    {items.length ? <Plus className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
                    إضافة رقم طوارئ
                </button>
            )}
        </div>
    );
}
