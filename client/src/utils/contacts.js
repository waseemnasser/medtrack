// أرقام الطوارئ (components/ContactsEditor.jsx):
// صف ناقص (اسم بلا رقم أو العكس)؟ يُرجع رسالة الخطأ أو null. الصف الفارغ كلياً يُتجاهل
export function contactsError(items) {
    for (const c of items) {
        const name = c.name.trim();
        const digits = c.phone.replace(/[^\d]/g, "");
        if (!name && !digits) continue;
        if (!name) return "اكتب اسم جهة الطوارئ";
        if (digits.length < 6) return `رقم هاتف ${name} غير صحيح`;
    }
    return null;
}
