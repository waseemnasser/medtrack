// نغمة تنبيه قصيرة بدون ملف صوتي خارجي
export function playBeep() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const play = (startTime, freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.frequency.value = freq;
            osc.type = "sine";
            gain.gain.setValueAtTime(0.0001, startTime);
            gain.gain.exponentialRampToValueAtTime(0.3, startTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.35);
            osc.start(startTime);
            osc.stop(startTime + 0.4);
        };
        const t = ctx.currentTime;
        play(t, 880);        // نغمتان متتاليتان
        play(t + 0.45, 1100);
    } catch (e) {
        // بعض المتصفحات تمنع الصوت قبل أول تفاعل من المستخدم — نتجاهل بهدوء
    }
}