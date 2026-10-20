import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import Mark from "../components/Mark";
import ThemeToggle from "../components/ThemeToggle";
import "./Landing.css";

/*
  الصفحة التعريفية — أول ما يراه الزائر قبل التسجيل.
  الفكرة المحورية: «قرص اليوم». طمّني عن الوقت، فالبطل قرص ٢٤ ساعة
  بأقواس الفترات الثلاث، وفوقه هاتف يعرض شاشة «اليوم» وهي تعمل فعلاً.
*/

const loggedIn = () => Boolean(localStorage.getItem("token"));
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// جرعات العرض التوضيحي في الهاتف — أمثلة لا بيانات حقيقية
const DEMO = [
    { time: "8:00", suffix: "ص", name: "ميتفورمين", strength: "500 ملغ", member: "سارة", period: "morning", label: "الصباح" },
    { time: "1:00", suffix: "م", name: "أموكسيسيلين", strength: "250 ملغ", member: "خالد", period: "noon", label: "الظهر" },
    { time: "8:00", suffix: "م", name: "أتورفاستاتين", strength: "20 ملغ", member: "ليلى", period: "evening", label: "المساء" },
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
            { threshold: 0.18, rootMargin: "0px 0px -40px 0px" }
        );
        items.forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, []);

    return (
        <div className="landing" ref={root}>
            {/* ---------- الشريط العلوي ---------- */}
            <header className="ld-nav">
                <div className="ld-wrap ld-nav-inner">
                    <Link to="/welcome" className="ld-brand">
                        <Mark size={30} />
                        طمّني
                    </Link>
                    <nav className="ld-links" aria-label="أقسام الصفحة">
                        <a href="#features">المزايا</a>
                        <a href="#how">كيف يعمل</a>
                        <a href="#doctor">مع الطبيب</a>
                        <a href="#principles">مبادئنا</a>
                    </nav>
                    <div className="ld-nav-cta">
                        <ThemeToggle />
                        {isIn ? (
                            <Link to="/" className="ld-btn primary sm">افتح التطبيق</Link>
                        ) : (
                            <>
                                <Link to="/login" className="ld-btn ghost sm">دخول</Link>
                                <Link to="/register" className="ld-btn primary sm">ابدأ الآن</Link>
                            </>
                        )}
                    </div>
                </div>
            </header>

            <main>
                {/* ---------- البطل ---------- */}
                <section className="ld-hero">
                    <div className="ld-wrap ld-hero-grid">
                        <div className="ld-hero-text">
                            <p className="ld-eyebrow" data-reveal>
                                <span className="ld-eyebrow-dots" aria-hidden="true">
                                    <i className="morning" /><i className="noon" /><i className="evening" />
                                </span>
                                الأدوية والمواعيد في مكان واحد
                            </p>
                            <h1 className="ld-title" data-reveal>
                                كل جرعة بوقتها،
                                <br />
                                وبالك <span className="ld-mark">مرتاح</span>.
                            </h1>
                            <p className="ld-lead" data-reveal>
                                طمّني يجمع أدويتك وأدوية من تتابع علاجهم ومواعيدهم في مكان واحد،
                                يذكّرك بكل جرعة في وقتها، ويشارك الملف مع الطبيب برابط مؤقّت.
                            </p>
                            <div className="ld-cta-row" data-reveal>
                                <Link to={isIn ? "/" : "/register"} className="ld-btn primary lg">
                                    {isIn ? "افتح التطبيق" : "ابدأ الآن"}
                                    <Arrow />
                                </Link>
                                <a href="#how" className="ld-btn outline lg">شاهد كيف يعمل</a>
                            </div>
                            <ul className="ld-trust" data-reveal>
                                <li><Check /> بالعربية بالكامل</li>
                                <li><Check /> على الهاتف والحاسوب</li>
                                <li><Check /> يُثبَّت كتطبيق</li>
                            </ul>
                        </div>

                        <div className="ld-hero-visual" aria-hidden="true">
                            <DayDial />
                            <span className="ld-capsule c1" />
                            <span className="ld-capsule c2" />
                            <span className="ld-capsule c3" />
                            <span className="ld-capsule c4" />
                            <PhoneDemo />
                        </div>
                    </div>
                </section>

                {/* ---------- الفكرة في سطر ---------- */}
                <section className="ld-statement">
                    <div className="ld-wrap">
                        <p data-reveal>
                            دواء للضغط صباحاً، وآخر للسكري مساءً، ومضاد حيوي كل ثماني ساعات —
                            والجدول كله في رأسك.
                            <strong> طمّني يحمله عنك: كل جرعة، لكل شخص، في وقتها.</strong>
                        </p>
                    </div>
                </section>

                {/* ---------- المزايا ---------- */}
                <section className="ld-section" id="features">
                    <div className="ld-wrap">
                        <SectionHead
                            kicker="المزايا"
                            title="كل ما تحتاجه، ولا شيء زائد"
                            text="لمن يتابع أدويته أو أدوية غيره يومياً، وغالباً على عجل."
                        />

                        <div className="ld-bento">
                            <article className="ld-tile t-next" data-reveal>
                                <div className="ld-tile-ui">
                                    <div className="mini-next">
                                        <div className="mini-next-top">
                                            <span>الجرعة التالية</span>
                                            <span className="mini-chip evening">المساء</span>
                                        </div>
                                        <div className="mini-next-time">8:00 <small>م</small></div>
                                        <div className="mini-next-name">أتورفاستاتين 20 ملغ</div>
                                        <div className="mini-next-btn">تم الأخذ</div>
                                    </div>
                                </div>
                                <h3>الجرعة التالية أولاً</h3>
                                <p>تفتح التطبيق فترى فوراً ما يجب أخذه الآن، ولمن. لمسة واحدة وتُسجَّل.</p>
                            </article>

                            <article className="ld-tile t-family" data-reveal>
                                <div className="ld-tile-ui">
                                    <div className="mini-family">
                                        {[["س", "سارة", "٣ أدوية"], ["خ", "خالد", "دواءان"], ["ل", "ليلى", "دواء واحد"]].map(([i, n, c]) => (
                                            <div className="mini-member" key={n}>
                                                <span className="mini-avatar">{i}</span>
                                                <span><b>{n}</b><small>{c}</small></span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <h3>ملف لكل شخص</h3>
                                <p>أدويته ومواعيده وأمراضه المزمنة وحساسيته، في ملف واحد واضح.</p>
                            </article>

                            <article className="ld-tile t-supply" data-reveal>
                                <div className="ld-tile-ui center">
                                    <span className="mini-pill danger">ينفد خلال ٣ أيام</span>
                                    <span className="mini-pill neutral">يكفي حتى ٢٨ تشرين الثاني</span>
                                </div>
                                <h3>قبل أن ينفد الدواء</h3>
                                <p>حساب تقديري لتاريخ نفاد كل علبة، فتجدّدها في وقتها.</p>
                            </article>

                            <article className="ld-tile t-notify" data-reveal>
                                <div className="ld-tile-ui center">
                                    <div className="mini-notif">
                                        <Mark size={30} />
                                        <span><b>حان وقت الجرعة</b><small>أموكسيسيلين — خالد</small></span>
                                    </div>
                                </div>
                                <h3>تذكير حتى والتطبيق مغلق</h3>
                                <p>إشعار على الهاتف في موعد كل جرعة، مع تنبيه هادئ إن تأخّرت.</p>
                            </article>

                            <article className="ld-tile t-private" data-reveal>
                                <div className="ld-tile-ui center">
                                    <span className="mini-lock"><Lock /></span>
                                    <span className="mini-pill private">دواء خاص</span>
                                </div>
                                <h3>خصوصية لكل دواء</h3>
                                <p>علّم أي دواء «خاصاً» فلا يظهر أبداً عند المشاركة مع الطبيب.</p>
                            </article>
                        </div>
                    </div>
                </section>

                {/* ---------- كيف يعمل ---------- */}
                <section className="ld-section ld-how" id="how">
                    <div className="ld-wrap">
                        <SectionHead kicker="كيف يعمل" title="ثلاث خطوات، ثم يتذكّر عنك" />
                        <ol className="ld-steps">
                            {[
                                ["morning", "أضف من تتابع علاجهم", "نفسك أو أي شخص تهتم به: الاسم وتاريخ الميلاد، والأمراض المزمنة والحساسية إن وُجدت."],
                                ["noon", "أضف أدويتهم وأوقاتها", "ابحث في كتالوغ الأدوية، واختر ساعات الجرعات وأيامها."],
                                ["evening", "أكّد كل جرعة بلمسة", "يصلك التذكير في وقته، وتسجّل الجرعة فيمتلئ يومك."],
                            ].map(([p, t, d], i) => (
                                <li className="ld-step" key={p} data-reveal style={{ "--d": `${i * 120}ms` }}>
                                    <span className={`ld-step-num ${p}`}>{["١", "٢", "٣"][i]}</span>
                                    <h3>{t}</h3>
                                    <p>{d}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* ---------- مع الطبيب ---------- */}
                <section className="ld-section" id="doctor">
                    <div className="ld-wrap ld-doctor">
                        <div className="ld-doctor-text" data-reveal>
                            <SectionHead
                                kicker="مع الطبيب"
                                title="الملف عند الطبيب، لساعات فقط"
                                align="start"
                            />
                            <ul className="ld-list">
                                <li><Check /> رابط مؤقّت ورمز QR يمسحه الطبيب بكاميرا هاتفه</li>
                                <li><Check /> بلا حساب ولا تطبيق — ولا يمكن تعديل أي شيء من خلاله</li>
                                <li><Check /> الحساسية أولاً وبالأحمر، ثم الأدوية والمواعيد</li>
                                <li><Check /> ينتهي تلقائياً بعد يوم أو ثلاثة أيام أو أسبوع</li>
                            </ul>
                        </div>

                        <div className="ld-doctor-visual" data-reveal aria-hidden="true">
                            <div className="doc-mock">
                                <div className="doc-mock-head">
                                    <span className="mini-avatar lg">خ</span>
                                    <span><small>ملف المريض</small><b>خالد</b><small>٥٨ سنة</small></span>
                                </div>
                                <div className="doc-mock-allergy">
                                    <small>الحساسية من أدوية</small>
                                    <b>بنسلين</b>
                                </div>
                                <div className="doc-mock-row"><i className="morning" />ميتفورمين 500 ملغ<span>8:00 ص</span></div>
                                <div className="doc-mock-row"><i className="evening" />أتورفاستاتين 20 ملغ<span>8:00 م</span></div>
                            </div>
                            <div className="qr-mock">
                                <QrArt />
                                <span>صالح ٢٤ ساعة</span>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ---------- المبادئ ---------- */}
                <section className="ld-principles" id="principles">
                    <div className="ld-wrap">
                        <SectionHead kicker="مبادئنا" title="أداة تنظيمية، لا طبيب" invert />
                        <div className="ld-principle-grid">
                            {[
                                ["لا تشخيص ولا توصيات", "طمّني لا يقترح جرعات ولا بدائل ولا يشخّص. القرار دائماً للطبيب والصيدلاني."],
                                ["بياناتك عندك", "لا يرى أحد ملفاتك إلا برابط مؤقّت تنشئه أنت، وينتهي من تلقاء نفسه."],
                                ["وضع مريح لمن يحتاجه", "بلمسة من الإعدادات: نص أكبر وأزرار أوسع وتباين أعلى. والحركة تتوقف لمن يطلب ذلك."],
                                ["لون له معنى", "الأصفر صباح، والمشمشي ظهر، والبنفسجي مساء. اللون في طمّني يقول «متى» فقط."],
                            ].map(([t, d], i) => (
                                <div className="ld-principle" key={t} data-reveal style={{ "--d": `${i * 90}ms` }}>
                                    <h3>{t}</h3>
                                    <p>{d}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ---------- الفريق ---------- */}
                <section className="ld-section ld-team">
                    <div className="ld-wrap">
                        <SectionHead
                            kicker="الفريق"
                            title="صُنع بعناية"
                            text="مشروع تخرج — الجامعة الدولية الخاصة للعلوم والتكنولوجيا"
                        />
                        <div className="ld-team-row">
                            {[["و", "وسيم نصر", "morning"], ["د", "دارين النجم", "noon"], ["ب", "بيسان أبو شهلا", "evening"]].map(([i, n, p], k) => (
                                <div className="ld-person" key={n} data-reveal style={{ "--d": `${k * 110}ms` }}>
                                    <span className={`ld-person-avatar ${p}`}>{i}</span>
                                    <b>{n}</b>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ---------- الدعوة الأخيرة ---------- */}
                <section className="ld-final">
                    <div className="ld-wrap">
                        <div className="ld-final-band" data-reveal>
                            <Mark size={64} color="var(--on-primary)" tickColor="var(--primary)" />
                            <h2>طمّن بالك على كل جرعة</h2>
                            <p>دقيقة لإنشاء الحساب، وبعدها طمّني يتذكّر عنك.</p>
                            <Link to={isIn ? "/" : "/register"} className="ld-btn light lg">
                                {isIn ? "افتح التطبيق" : "أنشئ حسابك الآن"}
                                <Arrow />
                            </Link>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="ld-footer">
                <div className="ld-wrap ld-footer-inner">
                    <span className="ld-brand"><Mark size={24} /> طمّني</span>
                    <p>أداة تنظيمية لمتابعة الأدوية والمواعيد. لا تقدّم تشخيصاً ولا توصيات علاجية، ولا تغني عن استشارة الطبيب أو الصيدلاني.</p>
                    <p className="ld-copy">© ٢٠٢٦ طمّني — مشروع تخرج</p>
                </div>
            </footer>
        </div>
    );
}

/* ================= مكوّنات الصفحة ================= */

function SectionHead({ kicker, title, text, align = "center", invert = false }) {
    return (
        <div className={`ld-head ${align}${invert ? " invert" : ""}`} data-reveal>
            <p className="ld-kicker">{kicker}</p>
            <h2>{title}</h2>
            {text && <p className="ld-head-text">{text}</p>}
        </div>
    );
}

// قرص اليوم: ٢٤ ساعة، منتصف الليل في الأعلى، وأقواس الفترات بألوانها
function DayDial() {
    const C = 300;
    const point = (r, hour) => {
        const a = ((hour / 24) * 360 - 90) * (Math.PI / 180);
        return [C + r * Math.cos(a), C + r * Math.sin(a)];
    };
    const arc = (r, from, to) => {
        const [x1, y1] = point(r, from);
        const [x2, y2] = point(r, to);
        const large = (to - from) / 24 > 0.5 ? 1 : 0;
        return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
    };
    return (
        <svg className="ld-dial" viewBox="0 0 600 600">
            <circle cx={C} cy={C} r="270" className="dial-track" />
            <circle cx={C} cy={C} r="200" className="dial-inner" />
            {Array.from({ length: 24 }, (_, h) => {
                const [x1, y1] = point(h % 6 === 0 ? 236 : 246, h);
                const [x2, y2] = point(256, h);
                return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} className={h % 6 === 0 ? "dial-tick major" : "dial-tick"} />;
            })}
            <path d={arc(270, 6.3, 11.7)} className="dial-arc morning" />
            <path d={arc(270, 12.3, 16.7)} className="dial-arc noon" />
            <path d={arc(270, 17.3, 23.2)} className="dial-arc evening" />
            <g className="dial-sun">
                <circle cx={C} cy={C - 270} r="16" />
            </g>
        </svg>
    );
}

// الهاتف: شاشة «اليوم» تعمل وحدها — تُضغط الجرعة، تمتلئ القطعة، تأتي التالية
function PhoneDemo() {
    const [reduced] = useState(reducedMotion);
    const [step, setStep] = useState(() => (reduced ? 1 : 0)); // عدد الجرعات المؤكَّدة
    const [pressing, setPressing] = useState(false);

    useEffect(() => {
        if (reduced) return;
        let timer;
        const run = (s) => {
            timer = setTimeout(() => {
                setPressing(true);
                timer = setTimeout(() => {
                    setPressing(false);
                    const next = s + 1;
                    setStep(next);
                    if (next >= DEMO.length) {
                        timer = setTimeout(() => { setStep(0); run(0); }, 2800);
                    } else {
                        run(next);
                    }
                }, 380);
            }, 2000);
        };
        run(0);
        return () => clearTimeout(timer);
    }, [reduced]);

    const current = DEMO[step];

    return (
        <div className="phone">
            <div className="phone-screen">
                <div className="phone-notch" />
                <div className="ph-top">
                    <span className="ph-brand"><Mark size={16} /> طمّني</span>
                </div>
                <div className="ph-date">السبت ١٨ تشرين الأول</div>
                <div className="ph-title">جرعات اليوم</div>

                {current ? (
                    <div className="ph-next" key={step}>
                        <div className="ph-next-top">
                            <span>الجرعة التالية</span>
                            <span className={`ph-chip ${current.period}`}>{current.label}</span>
                        </div>
                        <div className="ph-next-body">
                            <div>
                                <div className="ph-time">{current.time} <small>{current.suffix}</small></div>
                                <div className="ph-name">{current.name} <span>{current.strength}</span></div>
                                <div className="ph-member">{current.member}</div>
                            </div>
                            <span className={`ph-btn${pressing ? " pressing" : ""}`}>تم الأخذ</span>
                        </div>
                    </div>
                ) : (
                    <div className="ph-next done" key="done">
                        <span className="ph-done-icon"><Check /></span>
                        <div>
                            <div className="ph-name">أُخذت كل جرعات اليوم</div>
                            <div className="ph-member">اطمئن، لا شيء متبقٍّ</div>
                        </div>
                    </div>
                )}

                <div className="ph-progress">
                    {DEMO.map((d, i) => (
                        <span key={i} className={i < step ? `ph-seg ${d.period} on` : "ph-seg"} />
                    ))}
                    <small>{["٠", "١", "٢", "٣"][step]} من ٣</small>
                </div>

                <div className="ph-rows">
                    {DEMO.map((d, i) => (
                        <div className={`ph-row${i < step ? " taken" : ""}`} key={i}>
                            <span className={`ph-marker ${d.period}`} />
                            <div className="ph-row-text">
                                <b>{d.name}</b>
                                <small>{d.time} {d.suffix} · {d.member}</small>
                            </div>
                            {i < step
                                ? <span className={`ph-check ${d.period}`}><Check /></span>
                                : <span className="ph-outline">تم الأخذ</span>}
                        </div>
                    ))}
                </div>

                {/* شريط التبويبات — كما في التطبيق الحقيقي */}
                <div className="ph-tabbar">
                    {PHONE_TABS.map((icon, i) => (
                        <span key={i} className={i === 0 ? "on" : ""}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{icon}</svg>
                        </span>
                    ))}
                </div>

                {step > 0 && step <= DEMO.length && (
                    <div className="ph-toast" key={`t${step}`}><Check /> سُجّلت الجرعة</div>
                )}
            </div>
        </div>
    );
}

// أيقونات شريط تبويبات الهاتف: اليوم، العائلة، المواعيد، الحساب
const PHONE_TABS = [
    <><rect x="3" y="8" width="18" height="8" rx="4" /><path d="M12 8v8" /></>,
    <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" /></>,
    <><rect x="3.5" y="5" width="17" height="15" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" /></>,
    <><circle cx="12" cy="8" r="4" /><path d="M4 20.5c1.2-4 4.3-6 8-6s6.8 2 8 6" /></>,
];

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

function Lock() {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
            <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
        </svg>
    );
}
