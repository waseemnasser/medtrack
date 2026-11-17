// قواعد التواريخ والأرقام في النماذج — بلا قاعدة بيانات. تشغيلها: npm test
const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const v = require("../validate");

// «اليوم» ثابت في الاختبار: ١٧ تشرين الثاني ٢٠٢٦، الساعة ١٢:٠٠
const NOW = new Date(2026, 10, 17, 12, 0, 0);
const ok = (x) => assert.equal(x, null);
const bad = (x) => assert.equal(typeof x, "string");

describe("dates", () => {
    test("birth date: optional, real, not in the future, not over 120 years", () => {
        ok(v.birthDateError("", NOW));
        ok(v.birthDateError("1990-05-20", NOW));
        ok(v.birthDateError("2026-11-17", NOW));     // مولود اليوم
        bad(v.birthDateError("2026-11-18", NOW));    // غداً
        bad(v.birthDateError("2126-01-01", NOW));    // السنة الخطأ من السؤال
        bad(v.birthDateError("1890-01-01", NOW));
        bad(v.birthDateError("2001-02-29", NOW));    // ليست سنة كبيسة
        bad(v.birthDateError("17/11/2000", NOW));
    });

    test("medicine start: not before birth, within 30 years back and 1 year ahead", () => {
        ok(v.startDateError("2026-11-17", { now: NOW }));
        ok(v.startDateError("2015-03-01", { now: NOW }));
        ok(v.startDateError("2027-06-01", { now: NOW }));
        bad(v.startDateError("2028-01-01", { now: NOW }));
        bad(v.startDateError("2126-11-17", { now: NOW }));
        bad(v.startDateError("1990-01-01", { now: NOW }));
        bad(v.startDateError("2010-01-01", { now: NOW, birthDate: "2012-04-04" }));
        ok(v.startDateError("2013-01-01", { now: NOW, birthDate: "2012-04-04" }));
        bad(v.startDateError("2026-02-30", { now: NOW }));
    });

    test("course end: on or after the start, at most 365 days", () => {
        ok(v.endDateError(null, "2026-11-17"));
        ok(v.endDateError("2026-11-17", "2026-11-17"));   // كورس يوم واحد
        ok(v.endDateError("2026-11-23", "2026-11-17"));
        bad(v.endDateError("2026-11-16", "2026-11-17"));
        ok(v.endDateError("2027-11-16", "2026-11-17"));   // ٣٦٥ يوماً بالضبط
        bad(v.endDateError("2027-11-17", "2026-11-17"));
        bad(v.endDateError("2126-11-17", "2026-11-17"));
    });

    test("appointment: not in the past, within two years, real time", () => {
        ok(v.appointmentTimeError("2026-11-18T09:30", { now: NOW }));
        ok(v.appointmentTimeError("2026-11-17 12:00", { now: NOW }));
        bad(v.appointmentTimeError("2026-11-17T11:00", { now: NOW }));
        ok(v.appointmentTimeError("2026-11-17T11:00", { now: NOW, allowPast: true }));   // تعديل موعد مضى دون تغيير وقته
        bad(v.appointmentTimeError("2029-01-01T10:00", { now: NOW }));
        bad(v.appointmentTimeError("2126-11-18T10:00", { now: NOW }));
        bad(v.appointmentTimeError("2026-11-18T25:00", { now: NOW }));
        bad(v.appointmentTimeError("tomorrow", { now: NOW }));
    });
});

describe("numbers", () => {
    test("dose: more than zero, halves allowed, at most 50", () => {
        ok(v.unitsPerDoseError(1));
        ok(v.unitsPerDoseError("0.5"));
        ok(v.unitsPerDoseError("٢"));
        ok(v.unitsPerDoseError(""));                 // الافتراضي ١
        bad(v.unitsPerDoseError(0));
        bad(v.unitsPerDoseError("0"));
        bad(v.unitsPerDoseError(-1));
        bad(v.unitsPerDoseError(51));
        bad(v.unitsPerDoseError("abc"));
    });

    test("box: optional whole number 1 to 10000", () => {
        ok(v.unitsTotalError(""));
        ok(v.unitsTotalError(30));
        ok(v.unitsTotalError("٢٠"));
        bad(v.unitsTotalError(0));
        bad(v.unitsTotalError(2.5));
        bad(v.unitsTotalError(10001));
    });

    test("hand-typed strength needs a number and a unit", () => {
        for (const s of ["100 mg", "100mg", "5 ملغ", "250 mg/5 ml", "1000 IU", "0.5%", "٥٠٠ ملغ", "2,5 mg"]) ok(v.strengthError(s));
        for (const s of ["", "100", "  42  ", "mg", "ملغ 100", "abc"]) bad(v.strengthError(s));
    });

    test("catalog strengths are kept as they are", () => {
        ok(v.strengthError("IU/TAB.", { fromCatalog: true }));
        ok(v.strengthError("", { fromCatalog: true }));
    });

    test("dose times: real HH:MM and weekdays 1 to 7", () => {
        ok(v.timesError([{ time_of_day: "08:00", days_of_week: "1234567" }, { time_of_day: "20:30:00", days_of_week: "135" }]));
        bad(v.timesError([]));
        bad(v.timesError([{ time_of_day: "24:00" }]));
        bad(v.timesError([{ time_of_day: "08:00", days_of_week: "" }]));
        bad(v.timesError([{ time_of_day: "08:00", days_of_week: "189" }]));
        bad(v.timesError([{ time_of_day: "08:00", days_of_week: "11" }]));
    });
});
