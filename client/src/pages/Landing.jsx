import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Mark from "../components/Mark";
import ThemeToggle from "../components/ThemeToggle";
import "./Landing.css";

/*
  الصفحة التعريفية — أول ما يراه الزائر قبل التسجيل.
  الفكرة المحورية: «علبة الأسبوع». علبة الأدوية الأسبوعية التي يعرفها
  الجميع، بخاناتها الملوّنة حسب الفترة، تمتلئ جرعة بعد جرعة. وبعدها
  صفحة بأسلوب المجلات: عناوين كبيرة، أرقام، وخطوط فاصلة.
*/

const loggedIn = () => Boolean(localStorage.getItem("token"));
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// أيام الأسبوع تبدأ بالسبت، و«اليوم» هو العمود الرابع في العرض
const DAYS = ["س", "ح", "ن", "ث", "ر", "خ", "ج"];
const TODAY = 3;
const PERIODS = [
    { key: "morning", label: "صباح" },
    { key: "noon", label: "ظهر" },
    { key: "evening", label: "مساء" },
];

// أبرز المزايا في كبسولات — كل كبسولة بلون فترة، بالتناوب
const HIGHLIGHTS = [
    "تذكير بكل جرعة",
    "ملف لكل شخص",
    "تنبيه الحساسية",
    "قبل أن ينفد الدواء",
    "مواعيد الطبيب",
    "مشاركة برابط مؤقّت",
    "الوضع المريح",
    "على الهاتف والحاسوب",
];

const FEATURES = [
    ["الجرعة التالية أولاً", "تفتح التطبيق فترى ما يجب أخذه الآن ولمن. لمسة واحدة وتُسجَّل."],
    ["تذكير والتطبيق مغلق", "إشعار على الهاتف في موعد كل جرعة، وتنبيه هادئ إن تأخّرت."],
    ["ملف لكل شخص", "أدويته ومواعيده وأمراضه المزمنة وحساسيته، في صفحة واحدة واضحة."],
    ["تنبيه الحساسية", "إن أضفت دواءً يتعارض مع حساسية مسجّلة، يتوقف طمّني ويسألك قبل الحفظ."],
    ["قبل أن ينفد الدواء", "تقدير لتاريخ نفاد كل علبة، وتذكير صباحي لتجدّدها في وقتها."],
    ["مواعيد الطبيب", "تذكير مساء اليوم السابق، وآخر قبل الموعد بساعتين."],
];

// يوم كامل مع طمّني — كل بطاقة شيء يحدث فعلاً في التطبيق
const DAY = [
    { time: "8:00", suffix: "ص", period: "morning", title: "حان وقت جرعة الصباح", text: "ميتفورمين 500 ملغ — سارة", tag: "سُجّلت بلمسة" },
    { time: "10:00", suffix: "ص", period: "morning", title: "ميتفورمين ينفد خلال ٣ أيام", text: "تذكير التجديد اليومي", tag: "جدّدت العلبة" },
    { time: "1:20", suffix: "م", period: "noon", title: "تأخّرت جرعة الظهر", text: "أموكسيسيلين 250 ملغ — خالد", tag: "تنبيه هادئ" },
    { time: "8:00", suffix: "م", period: "evening", title: "موعد طبيب القلب غداً", text: "الساعة 10:00 صباحاً — خالد", tag: "قبل يوم" },
];

const FAQ = [
    ["هل يقترح طمّني جرعات أو أدوية؟", "لا. طمّني أداة تنظيمية فقط: تسجّل ما وصفه الطبيب وتذكّرك به. لا يشخّص ولا يقترح جرعات ولا بدائل."],
    ["هل تصلني التذكيرات والتطبيق مغلق؟", "نعم، بعد تفعيل الإشعارات من صفحة الحساب. على الآيفون يجب تثبيت طمّني على الشاشة الرئيسية أولاً."],
    ["هل يحتاج الطبيب حساباً ليرى الملف؟", "لا. ترسل له رابطاً مؤقّتاً أو رمز QR، فيرى الملف للقراءة فقط، والرابط ينتهي وحده."],
    ["من يرى بياناتي؟", "أنت فقط. لا يُشارَك شيء إلا برابط تنشئه بنفسك، والأدوية المعلّمة «خاصة» لا تظهر فيه أبداً."],
];

export default function Landing() {
    const root = useRef(null);
    const isIn = loggedIn();

    // العناصر تظهر بهدوء حين تصل إليها أثناء التمرير
    useEffect(() => {
        const items = root.current.querySelectorAll("[data-reveal]");
        if (reducedMotion() || !("IntersectionObserver" in window)) {
            items.forEach((el) => el.classList.add("in"));
            return;
        }
        const io = new IntersectionObserver(
            (entries) => entries.forEach((e) => {
                if (e.isIntersecting) {
                    e.target.classList.add("in");
                    io.unobserve(e.target);
                }
            }),
            { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
        );
        items.forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, []);

    const start = isIn ? "/" : "/register";
    const startLabel = isIn ? "افتح التطبيق" : "ابدأ الآن";

    return (
        <div className="landing" ref={root}>
            {/* ---------- الشريط العلوي ---------- */}
            <header className="ld-nav">
                <div className="ld-wrap ld-nav-inner">
                    <Link to="/welcome" className="ld-brand">
                        <Mark size={28} />
                        طمّني
                    </Link>
                    <nav className="ld-links" aria-label="أقسام الصفحة">
                        <a href="#features">المزايا</a>
                        <a href="#day">يوم مع طمّني</a>
                        <a href="#doctor">مع الطبيب</a>
                        <a href="#faq">أسئلة</a>
                    </nav>
                    <div className="ld-nav-cta">
                        <ThemeToggle />
                        {!isIn && <Link to="/login" className="ld-btn ghost sm">دخول</Link>}
                        <Link to={start} className="ld-btn primary sm">{isIn ? "افتح التطبيق" : "ابدأ"}</Link>
                    </div>
                </div>
            </header>

            <main>
                {/* ---------- البطل ---------- */}
                <section className="ld-hero">
                    <div className="ld-wrap ld-hero-grid">
                        <div className="ld-hero-text">
                            <p className="ld-eyebrow" data-reveal>
                                <span className="ld-dot" aria-hidden="true" />
                                الأدوية والمواعيد في مكان واحد
                            </p>
                            <h1 className="ld-title" data-reveal>
                                كل جرعة
                                <br />
                                <em>في وقتها.</em>
                            </h1>
                            <p className="ld-lead" data-reveal>
                                طمّني ينظّم أدويتك وأدوية من تتابع علاجهم، يذكّرك بكل جرعة وكل موعد،
                                ويشارك الملف مع الطبيب برابط ينتهي وحده.
                            </p>
                            <div className="ld-cta-row" data-reveal>
                                <Link to={start} className="ld-btn primary lg">
                                    {startLabel}
                                    <Arrow />
                                </Link>
                                <a href="#day" className="ld-btn outline lg">شاهد يوماً معه</a>
                            </div>
                            <dl className="ld-facts" data-reveal>
                                <div><dt>٣</dt><dd>فترات ملوّنة في اليوم</dd></div>
                                <div><dt>٢</dt><dd>تذكيران لكل موعد طبيب</dd></div>
                                <div><dt>٣</dt><dd>مدد لرابط الطبيب، ثم ينتهي</dd></div>
                            </dl>
                        </div>

                        <div className="ld-hero-visual" data-reveal aria-hidden="true">
                            <WeekBox />
                        </div>
                    </div>
                </section>

                {/* ---------- كبسولات المزايا ---------- */}
                <div className="ld-pills">
                    <ul className="ld-wrap">
                        {HIGHLIGHTS.map((t, i) => (
                            <li key={t} data-reveal style={{ "--d": `${i * 50}ms` }}>
                                <span className={`ld-cap ${PERIODS[i % 3].key}`} aria-hidden="true" />
                                {t}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* ---------- المزايا: قائمة مرقّمة ---------- */}
                <section className="ld-section" id="features">
                    <div className="ld-wrap ld-split">
                        <div className="ld-split-head" data-reveal>
                            <p className="ld-kicker">المزايا</p>
                            <h2>ستة أشياء يفعلها عنك، كل يوم.</h2>
                            <p>بلا إعدادات معقّدة ولا قوائم طويلة. ما تحتاجه فقط، في المكان الذي تتوقعه.</p>
                        </div>
                        <ol className="ld-numbered">
                            {FEATURES.map(([t, d], i) => (
                                <li key={t} data-reveal>
                                    <span className="ld-num">{String(i + 1).padStart(2, "0")}</span>
                                    <div>
                                        <h3>{t}</h3>
                                        <p>{d}</p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* ---------- يوم مع طمّني ---------- */}
                <section className="ld-section ld-day" id="day">
                    <div className="ld-wrap">
                        <div className="ld-head" data-reveal>
                            <p className="ld-kicker">يوم مع طمّني</p>
                            <h2>من الصباح حتى المساء، يتذكّر هو.</h2>
                        </div>
                        <ol className="ld-timeline">
                            {DAY.map((d, i) => (
                                <li key={d.title} className={d.period} data-reveal style={{ "--d": `${i * 110}ms` }}>
                                    <span className="ld-time">{d.time} <small>{d.suffix}</small></span>
                                    <span className="ld-node" aria-hidden="true" />
                                    <div className="ld-notif">
                                        <Mark size={26} />
                                        <div>
                                            <b>{d.title}</b>
                                            <small>{d.text}</small>
                                        </div>
                                    </div>
                                    <span className="ld-tag">{d.tag}</span>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* ---------- الوضع المريح ---------- */}
                <section className="ld-section">
                    <div className="ld-wrap ld-easy">
                        <div data-reveal>
                            <p className="ld-kicker">الوضع المريح</p>
                            <h2>بالحجم الذي يناسب عينيك.</h2>
                            <p className="ld-easy-text">
                                مفتاح واحد في الإعدادات يكبّر النص والأزرار ويقوّي التباين، لمن يجد الخط صغيراً
                                أو يده غير ثابتة. يُحفظ على الجهاز نفسه، فلكل هاتف حجمه.
                            </p>
                        </div>
                        <EasyDemo />
                    </div>
                </section>

                {/* ---------- مع الطبيب ---------- */}
                <section className="ld-section ld-doctor-sec" id="doctor">
                    <div className="ld-wrap ld-doctor">
                        <div data-reveal>
                            <p className="ld-kicker">مع الطبيب</p>
                            <h2>الملف عند الطبيب، لساعات فقط.</h2>
                            <ul className="ld-list">
                                <li><Check /> رابط مؤقّت ورمز QR يمسحه الطبيب بكاميرا هاتفه</li>
                                <li><Check /> بلا حساب ولا تطبيق، وللقراءة فقط</li>
                                <li><Check /> الحساسية أولاً وبالأحمر، ثم الأدوية والمواعيد</li>
                                <li><Check /> ينتهي بعد يوم أو ثلاثة أيام أو أسبوع</li>
                            </ul>
                        </div>

                        <div className="ld-ticket" data-reveal aria-hidden="true">
                            <div className="ld-ticket-main">
                                <small>ملف المريض</small>
                                <b className="ld-ticket-name">خالد</b>
                                <div className="ld-ticket-allergy">
                                    <small>حساسية</small>
                                    <b>بنسلين</b>
                                </div>
                                <div className="ld-ticket-row"><i className="morning" />ميتفورمين 500 ملغ<span>8:00 ص</span></div>
                                <div className="ld-ticket-row"><i className="evening" />أتورفاستاتين 20 ملغ<span>8:00 م</span></div>
                            </div>
                            <div className="ld-ticket-stub">
                                <QrArt />
                                <span>صالح ٢٤ ساعة</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ---------- المبادئ ---------- */}
                <section className="ld-section">
                    <div className="ld-wrap">
                        <div className="ld-principles">
                            {[
                                ["أداة تنظيمية، لا طبيب", "لا تشخيص ولا توصيات ولا اقتراح جرعات. القرار دائماً للطبيب والصيدلاني."],
                                ["بياناتك عندك", "لا يرى أحد ملفاتك إلا برابط مؤقّت تنشئه أنت، وينتهي من تلقاء نفسه."],
                                ["لون له معنى", "الأصفر صباح، والمشمشي ظهر، والبنفسجي مساء. اللون يقول «متى» فقط."],
                            ].map(([t, d], i) => (
                                <div key={t} data-reveal style={{ "--d": `${i * 100}ms` }}>
                                    <h3>{t}</h3>
                                    <p>{d}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ---------- أسئلة ---------- */}
                <section className="ld-section" id="faq">
                    <div className="ld-wrap ld-split">
                        <div className="ld-split-head" data-reveal>
                            <p className="ld-kicker">أسئلة</p>
                            <h2>قبل أن تبدأ.</h2>
                        </div>
                        <div className="ld-faq">
                            {FAQ.map(([q, a]) => (
                                <details key={q} data-reveal>
                                    <summary>{q}<span className="ld-plus" aria-hidden="true" /></summary>
                                    <p>{a}</p>
                                </details>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ---------- الدعوة الأخيرة ---------- */}
                <section className="ld-final">
                    <div className="ld-wrap">
                        <div className="ld-final-band" data-reveal>
                            <h2>طمّن بالك على كل جرعة.</h2>
                            <p>دقيقة لإنشاء الحساب، وبعدها طمّني يتذكّر عنك.</p>
                            <Link to={start} className="ld-btn light lg">
                                {isIn ? "افتح التطبيق" : "أنشئ حسابك الآن"}
                                <Arrow />
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="ld-footer">
                <div className="ld-wrap ld-footer-inner">
                    <div>
                        <span className="ld-brand"><Mark size={24} /> طمّني</span>
                        <p>أداة تنظيمية لمتابعة الأدوية والمواعيد. لا تقدّم تشخيصاً ولا توصيات علاجية، ولا تغني عن استشارة الطبيب أو الصيدلاني.</p>
                    </div>
                    <div className="ld-team">
                        <small>مشروع تخرج — الجامعة الدولية الخاصة للعلوم والتكنولوجيا</small>
                        <b>وسيم نصر · دارين النجم · بيسان أبو شهلا</b>
                    </div>
                </div>
            </footer>
        </div>
    );
}

/* ================= مكوّنات الصفحة ================= */

// علبة الأسبوع: الأيام الماضية ممتلئة، و«اليوم» يمتلئ أمامك — يصل إشعار
// جرعة الظهر، يُضغط «تم الأخذ»، فتُغلق الخانة. ثم تعود الحلقة من جديد.
function WeekBox() {
    const [reduced] = useState(reducedMotion);
    const [step, setStep] = useState(() => (reduced ? 3 : 0)); // 0 هدوء، 1 إشعار، 2 ضغط، 3 سُجّلت

    useEffect(() => {
        if (reduced) return;
        const durations = [1400, 2200, 500, 2600];
        let timer;
        const run = (s) => {
            timer = setTimeout(() => {
                const next = (s + 1) % 4;
                setStep(next);
                run(next);
            }, durations[s]);
        };
        run(0);
        return () => clearTimeout(timer);
    }, [reduced]);

    const done = (day, p) => day < TODAY || (day === TODAY && (p === 0 || (p === 1 && step === 3)));

    return (
        <div className="wk">
            <div className="wk-head">
                <span className="ld-brand-sm"><Mark size={18} /> هذا الأسبوع</span>
                <span className="wk-count">{step === 3 ? "١١" : "١٠"} من ٢١ جرعة</span>
            </div>
            <div className="wk-grid">
                <span />
                {DAYS.map((d, i) => (
                    <span key={d} className={`wk-day${i === TODAY ? " today" : ""}`}>
                        {i === TODAY && <em>اليوم</em>}
                        {d}
                    </span>
                ))}
                {PERIODS.map((p, pi) => (
                    <div className="wk-row" key={p.key}>
                        <span className={`wk-label ${p.key}`}>{p.label}</span>
                        {DAYS.map((d, di) => {
                            const on = done(di, pi);
                            const live = di === TODAY && pi === 1;
                            return (
                                <span
                                    key={d}
                                    className={`wk-cell ${p.key}${on ? " on" : ""}${di === TODAY ? " today" : ""}${live && step === 3 ? " pop" : ""}`}
                                >
                                    {on && <Check />}
                                </span>
                            );
                        })}
                    </div>
                ))}
            </div>

            <div className={`wk-notif${step === 1 || step === 2 ? " show" : ""}`}>
                <Mark size={30} />
                <div>
                    <b>حان وقت جرعة الظهر</b>
                    <small>أموكسيسيلين 250 ملغ — خالد</small>
                </div>
                <span className={`wk-btn${step === 2 ? " pressing" : ""}`}>تم الأخذ</span>
            </div>
            <div className={`wk-toast${step === 3 ? " show" : ""}`}><Check /> سُجّلت الجرعة</div>
        </div>
    );
}

// بطاقة الجرعة بالحجمين — الزائر يجرّب المفتاح بنفسه
function EasyDemo() {
    const [big, setBig] = useState(false);
    return (
        <div className="ez" data-reveal>
            <button
                type="button"
                role="switch"
                aria-checked={big}
                className="ez-switch"
                onClick={() => setBig(!big)}
            >
                <span>جرّب الوضع المريح</span>
                <span className="ez-track" aria-hidden="true" />
            </button>
            <div className={`ez-card${big ? " big" : ""}`} aria-hidden="true">
                <div className="ez-top">
                    <span>الجرعة التالية</span>
                    <span className="ez-chip">المساء</span>
                </div>
                <div className="ez-time">8:00 <small>م</small></div>
                <div className="ez-name">أتورفاستاتين 20 ملغ</div>
                <div className="ez-who">ليلى</div>
                <span className="ez-btn">تم الأخذ</span>
            </div>
        </div>
    );
}

// رمز QR زخرفي — شكل ثابت لا يحمل أي رابط
function QrArt() {
    const cells = [];
    for (let y = 0; y < 21; y++) {
        for (let x = 0; x < 21; x++) {
            const inFinder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
            if (inFinder) continue;
            if ((x * 7 + y * 13 + x * y) % 5 < 2) cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
        }
    }
    const finder = (x, y) => (
        <g key={`f${x}${y}`}>
            <rect x={x} y={y} width="7" height="7" rx="1.5" className="qr-ring" />
            <rect x={x + 2} y={y + 2} width="3" height="3" rx=".6" />
        </g>
    );
    return (
        <svg viewBox="-1 -1 23 23" className="qr-art">
            {cells}
            {finder(0, 0)}{finder(14, 0)}{finder(0, 14)}
        </svg>
    );
}

function Check() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ic">
            <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
    );
}

function Arrow() {
    // سهم لليسار: «إلى الأمام» في الواجهة العربية
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="ic">
            <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
    );
}
