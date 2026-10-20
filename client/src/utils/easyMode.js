// «الوضع المريح»: نص أكبر وأزرار أوسع لمن يحتاج.
// يُحفظ على الجهاز (لا في الحساب): الأب قد يستعمله على هاتفه
// بينما ابنه يدير الحساب نفسه بالحجم العادي على حاسوبه.
// السطر نفسه في index.html يطبّقه قبل ظهور الصفحة حتى لا تقفز الأحجام.

const KEY = "easy";

export function getEasyMode() {
    try {
        return localStorage.getItem(KEY) === "1";
    } catch {
        return false;
    }
}

export function setEasyMode(on) {
    try {
        if (on) localStorage.setItem(KEY, "1");
        else localStorage.removeItem(KEY);
    } catch {
        // التخزين محظور (تصفّح خاص) — نطبّق الاختيار لهذه الجلسة فقط
    }
    applyEasyMode(on);
}

export function applyEasyMode(on) {
    const root = document.documentElement;
    if (on) root.dataset.easy = "";
    else delete root.dataset.easy;
}
