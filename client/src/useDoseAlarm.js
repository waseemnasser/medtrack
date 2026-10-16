import { useEffect, useRef } from "react";

// ينبّه عند حلول وقت أي جرعة غير مؤكّدة
export default function useDoseAlarm(date, doses, onAlarm) {
    const alerted = useRef(new Set()); // الجرعات التي نُبّه عنها

    useEffect(() => {
        if (!date || doses.length === 0) return;

        const check = () => {
            const now = new Date();
            doses.forEach((d) => {
                if (d.status === "taken") return;
                if (alerted.current.has(d.schedule_id)) return;

                const doseTime = new Date(`${date}T${d.time_of_day}`);
                const diffMinutes = (now - doseTime) / 60000;

                // ننبّه إذا حان الوقت ولم يمضِ أكثر من 30 دقيقة
                if (diffMinutes >= 0 && diffMinutes <= 30) {
                    alerted.current.add(d.schedule_id);
                    onAlarm(d);
                }
            });
        };

        check();                                   // فحص فوري عند فتح الصفحة
        const timer = setInterval(check, 30000);   // ثم كل 30 ثانية
        return () => clearInterval(timer);
    }, [date, doses, onAlarm]);
}