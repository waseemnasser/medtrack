import { useState } from "react";
import { Link } from "react-router-dom";
import {
    Menu, X, Accessibility, ArrowLeft, ShieldCheck, Clock, HeartPulse, Pill, Package, Calendar,
    QrCode, Users, Bell, AlertTriangle, Activity, TrendingUp, Check, ChevronDown, Stethoscope,
} from "lucide-react";
import Logo from "../components/Logo";
import ThemeToggle from "../components/ThemeToggle";
import Reveal from "../components/Reveal";
import { useScrollReveal, useCountUp } from "../hooks/useScrollReveal";
import { getEasyMode, setEasyMode } from "../utils/easyMode";

/*
  الصفحة التعريفية — بنية نموذج bolt وتصميمه كما هما (LandingPage.tsx):
  شريط علوي، بطل بهاتف طافٍ، بطاقات الخدمات، شريط الأرقام، ثلاثة أقسام
  عرض، دعوة أخيرة، تذييل. المحتوى وحده تغيّر: كل ميزة مذكورة موجودة فعلاً
  في التطبيق، والأرقام من استبيان الصيادلة لا أرقام مستخدمين مصطنعة.
*/

const loggedIn = () => Boolean(localStorage.getItem("token"));

export default function Landing() {
    const isIn = loggedIn();
    const start = isIn ? "/" : "/register";

    return (
        <div className="min-h-screen bg-sage-50 dark:bg-[#0a1f1e] transition-colors duration-300">
            <LandingNavbar isIn={isIn} start={start} />
            <main>
                <Hero isIn={isIn} start={start} />
                <Services />
                <StatsSection />
                <FeatureShowcase start={start} isIn={isIn} />
                <Faq />
                <LandingCTA isIn={isIn} start={start} />
            </main>
            <LandingFooter />
        </div>
    );
}

/* ================= الشريط العلوي ================= */

const NAV_LINKS = [
    { label: "المزايا", target: "features" },
    { label: "الوضع المريح", target: "easy" },
    { label: "مع الطبيب", target: "doctor" },
    { label: "أسئلة", target: "faq" },
];

function EasySwitch() {
    const [easy, setEasy] = useState(getEasyMode);
    const toggle = () => {
        setEasyMode(!easy);
        setEasy(!easy);
    };
    return (
        <button type="button" role="switch" aria-checked={easy} aria-label="الوضع المريح" onClick={toggle}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${easy ? "bg-forest-600" : "bg-sage-300"}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${easy ? "translate-x-5" : ""}`} />
        </button>
    );
}

function LandingNavbar({ isIn, start }) {
    const [menuOpen, setMenuOpen] = useState(false);

    const scrollTo = (id) => {
        setMenuOpen(false);
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    return (
        <header className="sticky top-0 z-50 glass border-b border-sage-200/50 animate-fade-down">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16 lg:h-20">
                    <Link to="/welcome" className="flex items-center gap-2.5">
                        <Logo size={44} />
                        <div>
                            <span className="text-xl lg:text-2xl font-extrabold text-forest-950 leading-none">نبض</span>
                            <span className="block text-[10px] text-forest-600 font-medium leading-none mt-0.5">Nabd</span>
                        </div>
                    </Link>

                    <nav className="hidden lg:flex items-center gap-1" aria-label="أقسام الصفحة">
                        {NAV_LINKS.map((link) => (
                            <button key={link.target} onClick={() => scrollTo(link.target)}
                                className="px-4 py-2 text-forest-800 font-medium hover:text-forest-600 hover:bg-mint-50 rounded-lg transition-all">
                                {link.label}
                            </button>
                        ))}
                    </nav>

                    <div className="hidden lg:flex items-center gap-3">
                        <ThemeToggle />
                        <div className="flex items-center gap-2 bg-mint-50 dark:bg-forest-900/60 border border-mint-200 dark:border-forest-800 rounded-full px-4 py-2">
                            <Accessibility className="w-5 h-5 text-forest-700" />
                            <span className="text-sm font-semibold text-forest-800">الوضع المريح</span>
                            <EasySwitch />
                        </div>
                        {!isIn && <Link to="/login" className="btn-secondary">تسجيل الدخول</Link>}
                        <Link to={start} className="btn-primary flex items-center gap-2">
                            {isIn ? "افتح التطبيق" : "ابدأ الآن"}
                        </Link>
                    </div>

                    <div className="flex items-center gap-2 lg:hidden">
                        <ThemeToggle />
                        <button onClick={() => setMenuOpen(!menuOpen)} aria-label="القائمة" aria-expanded={menuOpen}
                            className="p-2 text-forest-900 rounded-lg hover:bg-mint-50 dark:hover:bg-forest-900/60">
                            {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                        </button>
                    </div>
                </div>
            </div>

            {menuOpen && (
                <div className="lg:hidden border-t border-sage-200/50 bg-white animate-fade-down">
                    <div className="px-4 py-4 space-y-2">
                        {NAV_LINKS.map((link) => (
                            <button key={link.target} onClick={() => scrollTo(link.target)}
                                className="block w-full text-start px-4 py-3 text-forest-800 font-medium hover:bg-mint-50 rounded-lg">
                                {link.label}
                            </button>
                        ))}
                        {!isIn && <Link to="/login" className="block w-full btn-secondary text-center">تسجيل الدخول</Link>}
                        <Link to={start} className="block w-full btn-primary text-center">{isIn ? "افتح التطبيق" : "ابدأ الآن"}</Link>
                        <div className="flex items-center justify-between bg-mint-50 border border-mint-200 dark:border-forest-800 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2">
                                <Accessibility className="w-5 h-5 text-forest-700" />
                                <span className="text-sm font-semibold text-forest-800">الوضع المريح</span>
                            </div>
                            <EasySwitch />
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

/* ================= البطل ================= */

function FloatCard({ className, icon: Icon, iconBox, label, value }) {
    return (
        <div className={`absolute z-0 hidden sm:block ${className}`}>
            <div className="card p-4 shadow-xl shadow-forest-900/10 w-max">
                <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${iconBox} rounded-lg flex items-center justify-center flex-shrink-0`}>
                        <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-forest-600 dark:text-forest-400 font-medium">{label}</p>
                        <p className="text-sm font-bold text-forest-950 dark:text-forest-50 whitespace-nowrap">{value}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function Hero({ isIn, start }) {
    return (
        <section className="relative overflow-hidden gradient-mint pt-12 pb-20 lg:pt-20 lg:pb-32">
            <div className="absolute inset-0 bg-hero-glow" aria-hidden="true" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-forest-50/40 to-forest-100/30 dark:from-transparent dark:via-forest-950/30 dark:to-forest-975/50" aria-hidden="true" />
            <div className="absolute top-20 right-10 w-72 h-72 bg-forest-400/10 rounded-full blur-3xl" aria-hidden="true" />
            <div className="absolute bottom-10 left-10 w-96 h-96 bg-mint-300/20 rounded-full blur-3xl dark:bg-forest-500/10" aria-hidden="true" />

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
                    <div className="text-center lg:text-start">
                        <Reveal animation="fade-down" className="inline-flex">
                            <div className="inline-flex items-center gap-2 bg-white/80 dark:bg-forest-900/80 border border-forest-200 dark:border-forest-700 rounded-full px-4 py-2 mb-6">
                                <span className="relative flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forest-500 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-forest-600" />
                                </span>
                                <span className="text-sm font-semibold text-forest-800 dark:text-forest-100">الأدوية والمواعيد في مكان واحد</span>
                            </div>
                        </Reveal>

                        <Reveal animation="fade-up" delay={100}>
                            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-forest-950 dark:text-forest-50 leading-[1.15] text-balance">
                                كل جرعة
                                <span className="block text-forest-600 dark:text-forest-400 mt-2">في وقتها</span>
                            </h1>
                        </Reveal>

                        <Reveal animation="fade-up" delay={250}>
                            <p className="mt-6 text-lg text-forest-800/70 dark:text-forest-200/70 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                                نبض ينظّم أدويتك وأدوية من تتابع علاجهم، يذكّرك بكل جرعة وكل موعد،
                                ويشارك الملف مع الطبيب برابط ينتهي وحده.
                            </p>
                        </Reveal>

                        <Reveal animation="fade-up" delay={400}>
                            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                                <Link to={start} className="btn-primary flex items-center justify-center gap-2">
                                    {isIn ? "افتح التطبيق" : "ابدأ مجاناً"}
                                    <ArrowLeft className="w-5 h-5" />
                                </Link>
                                {!isIn && <Link to="/login" className="btn-secondary text-center">تسجيل الدخول</Link>}
                            </div>
                        </Reveal>

                        <Reveal animation="fade-up" delay={550}>
                            <div className="mt-10 flex flex-wrap gap-6 justify-center lg:justify-start">
                                {[
                                    { icon: ShieldCheck, label: "بياناتك تبقى عندك" },
                                    { icon: Clock, label: "تذكير والتطبيق مغلق" },
                                    { icon: HeartPulse, label: "لا يشخّص ولا يقترح جرعات" },
                                ].map((item) => (
                                    <div key={item.label} className="flex items-center gap-2 text-sm text-forest-700/80 dark:text-forest-300">
                                        <item.icon className="w-4 h-4 text-forest-600" />
                                        <span className="font-medium">{item.label}</span>
                                    </div>
                                ))}
                            </div>
                        </Reveal>
                    </div>

                    {/* هاتف طافٍ يعرض شاشة «اليوم» مصغّرة، وحوله ثلاث بطاقات */}
                    <Reveal animation="scale-in" delay={300} className="relative flex justify-center items-center">
                        <div aria-hidden="true" className="contents">
                            <FloatCard className="-left-2 top-8 animate-float-slow" icon={Pill}
                                iconBox="bg-mint-100 dark:bg-forest-800/60 text-forest-600 dark:text-forest-400"
                                label="الجرعة التالية" value="ميتفورمين 2:00 م" />
                            <FloatCard className="-right-2 top-1/3 animate-float" icon={Package}
                                iconBox="bg-amber-50 text-amber-500" label="تنفد قريباً" value="يكفي يومين" />
                            <FloatCard className="-right-4 bottom-12 animate-float-slow" icon={Calendar}
                                iconBox="bg-blue-50 text-blue-500" label="موعد" value="د. أحمد — غداً" />

                            <div className="relative z-10 w-[280px] h-[560px] bg-forest-950 rounded-[3rem] p-3 shadow-2xl shadow-forest-900/40 animate-float">
                                <div className="absolute top-3 left-1/2 -translate-x-1/2 w-32 h-6 bg-forest-950 rounded-b-2xl z-20" />
                                <div className="w-full h-full gradient-mint rounded-[2.5rem] overflow-hidden relative">
                                    <div className="flex justify-between items-center px-6 pt-6 pb-2 text-xs font-semibold text-forest-900 dark:text-forest-100" dir="ltr">
                                        <span>9:41</span>
                                        <span className="w-3 h-3 rounded-sm border border-forest-700 dark:border-forest-600" />
                                    </div>

                                    <div className="px-5 pt-2">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <p className="text-xs text-forest-600">صباح الخير،</p>
                                                <p className="text-lg font-bold text-forest-950">سارة</p>
                                            </div>
                                            <Logo size={40} />
                                        </div>

                                        <div className="card p-4 shadow-sm mb-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-semibold text-forest-700 dark:text-forest-300">جرعات اليوم</span>
                                                <span className="badge badge-success">2 من 3</span>
                                            </div>
                                            <div className="space-y-2">
                                                {[
                                                    { name: "ميتفورمين", time: "8:00 ص", taken: true },
                                                    { name: "أملوديبين", time: "1:00 م", taken: true },
                                                    { name: "أتورفاستاتين", time: "8:00 م", taken: false },
                                                ].map((med) => (
                                                    <div key={med.name} className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${med.taken ? "bg-forest-600" : "bg-sage-300"}`} />
                                                        <span className="text-xs font-medium text-forest-900 dark:text-forest-100">{med.name}</span>
                                                        <span className="text-xs text-forest-600 dark:text-forest-400 ms-auto">{med.time}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="card p-3 text-center">
                                                <Calendar className="w-5 h-5 text-purple-500 mx-auto mb-1" />
                                                <p className="text-xs font-semibold text-forest-800 dark:text-forest-200">المواعيد</p>
                                            </div>
                                            <div className="card p-3 text-center">
                                                <QrCode className="w-5 h-5 text-forest-600 mx-auto mb-1" />
                                                <p className="text-xs font-semibold text-forest-800 dark:text-forest-200">للطبيب</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-24 h-1.5 bg-forest-950/30 rounded-full" />
                                </div>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0" aria-hidden="true">
                <svg viewBox="0 0 1440 80" className="w-full h-12 lg:h-20" preserveAspectRatio="none">
                    <path d="M0,40 C320,80 640,0 960,30 C1280,60 1440,40 1440,40 L1440,80 L0,80 Z" className="fill-sage-50 dark:fill-[#0a1f1e]" />
                </svg>
            </div>
        </section>
    );
}

/* ================= الخدمات ================= */

const SERVICES = [
    { icon: Bell, title: "تذكير بكل جرعة", desc: "إشعار على الهاتف في موعد كل جرعة حتى والتطبيق مغلق، وتأكيدها بلمسة واحدة.", color: "bg-forest-100 text-forest-700" },
    { icon: Users, title: "ملف لكل شخص", desc: "أدويته ومواعيده وأمراضه المزمنة وحساسيته في صفحة واحدة واضحة.", color: "bg-mint-100 text-forest-600" },
    { icon: AlertTriangle, title: "تنبيه الحساسية", desc: "إن أضفت دواءً مادته أو عائلته تتعارض مع حساسية مسجّلة، يتوقف نبض ويسألك قبل الحفظ.", color: "bg-red-100 text-red-600" },
    { icon: Package, title: "قبل أن ينفد الدواء", desc: "تقدير لتاريخ نفاد كل علبة، وتذكير صباحي لتجدّدها في وقتها.", color: "bg-amber-100 text-amber-600" },
    { icon: Activity, title: "الكورس حتى آخر يوم", desc: "متابعة المضاد الحيوي يوماً بيوم، وتنبيه إن فاتت جرعتان قبل نهاية الكورس.", color: "bg-blue-100 text-blue-600" },
    { icon: Calendar, title: "مواعيد الطبيب", desc: "تذكير مساء اليوم السابق، وآخر قبل الموعد بساعتين.", color: "bg-purple-100 text-purple-600" },
    { icon: QrCode, title: "مشاركة مع الطبيب", desc: "رابط مؤقّت ورمز QR يفتحه الطبيب بلا حساب، للقراءة فقط.", color: "bg-teal-100 text-teal-600" },
    { icon: TrendingUp, title: "تقرير الالتزام", desc: "نسبة الجرعات المأخوذة آخر ٧ أو ٣٠ يوماً، لكل دواء ولكل يوم.", color: "bg-indigo-100 text-indigo-600" },
];

function Services() {
    return (
        <section id="features" className="py-20 lg:py-28 bg-sage-50 scroll-mt-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <Reveal className="text-center max-w-3xl mx-auto mb-16">
                    <span className="badge badge-success mb-4">المزايا</span>
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-forest-950 text-balance">
                        كل ما تحتاجه لمتابعة الأدوية
                    </h2>
                    <p className="mt-4 text-lg text-forest-700/70">
                        بلا إعدادات معقّدة ولا قوائم طويلة. ما تحتاجه فقط، في المكان الذي تتوقعه.
                    </p>
                </Reveal>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {SERVICES.map((service, i) => (
                        <Reveal key={service.title} animation="fade-up" delay={i * 80}>
                            <div className="card card-hover p-6 h-full group">
                                <div className={`w-14 h-14 ${service.color} rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 group-hover:rotate-3`}>
                                    <service.icon className="w-7 h-7" strokeWidth={2} />
                                </div>
                                <h3 className="text-lg font-bold text-forest-950 mb-2">{service.title}</h3>
                                <p className="text-sm text-forest-700/70 leading-relaxed">{service.desc}</p>
                            </div>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ================= الأرقام ================= */

// من استبيان ٢٥ صيدلانياً أجراه فريق المشروع، ومن التطبيق نفسه
const STATS = [
    { value: 20, suffix: "/25", label: "صيدلانياً: المرضى يوقفون الكورس قبل نهايته", icon: Activity },
    { value: 11, suffix: "/25", label: "صيدلانياً: المرضى ينسون الجرعات", icon: Clock },
    { value: 19, suffix: "", label: "عائلة دوائية يفحصها تنبيه الحساسية", icon: ShieldCheck },
    { value: 2, suffix: "", label: "تذكيران لكل موعد طبيب", icon: Calendar },
];

function StatCounter({ value, label, suffix, icon: Icon }) {
    const { ref, visible } = useScrollReveal({ threshold: 0.3 });
    const count = useCountUp(value, 2200, visible);
    return (
        <div ref={ref} className="text-center">
            <div className="w-14 h-14 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon className="w-7 h-7 text-white" strokeWidth={2} />
            </div>
            <div className="text-4xl lg:text-5xl font-extrabold text-white tracking-tight" dir="ltr">
                {count}{suffix}
            </div>
            <p className="mt-2 text-sm lg:text-base text-white/70 font-medium">{label}</p>
        </div>
    );
}

function StatsSection() {
    return (
        <section className="py-20 lg:py-28 gradient-forest relative overflow-hidden">
            <div className="absolute inset-0 opacity-10" aria-hidden="true">
                <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 50%, white 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
            </div>

            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <Reveal className="text-center max-w-2xl mx-auto mb-14">
                    <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white text-balance">
                        لماذا بنينا نبض
                    </h2>
                    <p className="mt-4 text-lg text-white/70">
                        سألنا ٢٥ صيدلانياً: ما أكثر ما يخطئ فيه المرضى مع أدويتهم؟
                    </p>
                </Reveal>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                    {STATS.map((stat, i) => (
                        <Reveal key={stat.label} animation="scale-in" delay={i * 150}>
                            <StatCounter {...stat} />
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ================= أقسام العرض ================= */

function Bullets({ items, icon: Icon, box, color }) {
    return (
        <ul className="mt-6 space-y-3">
            {items.map((item) => (
                <li key={item} className="flex items-start gap-3">
                    <div className={`w-6 h-6 ${box} rounded-full flex items-center justify-center flex-shrink-0 mt-0.5`}>
                        <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </div>
                    <span className="text-forest-800 dark:text-forest-200">{item}</span>
                </li>
            ))}
        </ul>
    );
}

function FeatureShowcase({ start, isIn }) {
    return (
        <>
            {/* الوضع المريح */}
            <section id="easy" className="py-20 lg:py-28 bg-white dark:bg-[#0B1F1E] scroll-mt-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <Reveal animation="fade-up">
                            <span className="badge badge-warning mb-4">الوضع المريح</span>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-forest-950 text-balance">
                                بالحجم الذي يناسب عينيك
                            </h2>
                            <p className="mt-4 text-lg text-forest-700/70 leading-relaxed">
                                مفتاح واحد يكبّر النص والأزرار، لمن يجد الخط صغيراً أو يده غير ثابتة.
                                يُحفظ على الجهاز نفسه، فلكل هاتف حجمه.
                            </p>
                            <Bullets icon={Accessibility} box="bg-mint-100 dark:bg-forest-800/60" color="text-forest-600 dark:text-forest-300" items={[
                                "نص أكبر وأزرار أوسع في كل الصفحات",
                                "الجرعة التالية أولاً، وزر «تم الأخذ» كبير",
                                "يُفعَّل عند إنشاء الحساب أو من الشريط الجانبي",
                                "يُحفظ على هذا الجهاز فقط",
                            ]} />
                            <Link to={start} className="btn-primary mt-8 inline-flex items-center gap-2">
                                <Accessibility className="w-5 h-5" />
                                {isIn ? "افتح التطبيق" : "جرّب الوضع المريح"}
                            </Link>
                        </Reveal>

                        <Reveal animation="scale-in" delay={200}>
                            <div className="card p-8 gradient-mint border-2 border-forest-200 dark:border-forest-700" aria-hidden="true">
                                <div className="text-center mb-6">
                                    <div className="inline-flex items-center gap-2 bg-forest-600 text-white px-4 py-2 rounded-full text-sm font-bold">
                                        <Accessibility className="w-4 h-4" />
                                        الوضع المريح: مفعّل
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div className="bg-white dark:bg-forest-900/60 rounded-2xl p-6 text-center border-2 border-forest-300 dark:border-forest-600">
                                        <p className="text-2xl font-extrabold text-forest-950 dark:text-forest-50">ميتفورمين 500 ملغ</p>
                                        <p className="text-lg text-forest-700 dark:text-forest-300 mt-1">2:00 م — حبة واحدة</p>
                                        <div className="btn-elderly mt-4 w-full">تم الأخذ</div>
                                    </div>
                                    <div className="bg-white dark:bg-forest-900/60 rounded-2xl p-6 text-center border-2 border-forest-300 dark:border-forest-600">
                                        <p className="text-2xl font-extrabold text-forest-950 dark:text-forest-50">الموعد التالي</p>
                                        <p className="text-lg text-forest-700 dark:text-forest-300 mt-1">غداً 10:00 ص</p>
                                        <div className="btn-secondary mt-4 w-full !text-lg !py-4">عرض التفاصيل</div>
                                    </div>
                                </div>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* مع الطبيب — مكان بطاقة الطوارئ في النموذج */}
            <section id="doctor" className="py-20 lg:py-28 bg-sage-50 dark:bg-[#0B1F1E] scroll-mt-20">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <Reveal animation="scale-in" delay={200} className="order-2 lg:order-1">
                            <div className="card p-8 shadow-2xl shadow-forest-500/10" aria-hidden="true">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-14 h-14 bg-forest-600 rounded-2xl flex items-center justify-center relative">
                                        <Stethoscope className="w-7 h-7 text-white" />
                                        <span className="absolute inset-0 rounded-2xl bg-forest-600 animate-pulse-ring" />
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-extrabold text-forest-950">ملف المريض — خالد</h3>
                                        <p className="text-sm text-forest-600">للقراءة فقط · صالح ٢٤ ساعة</p>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {[
                                        { k: "الحساسية", v: "بنسلين — شديدة", tone: "text-red-600" },
                                        { k: "الأمراض المزمنة", v: "سكري، ارتفاع ضغط" },
                                        { k: "ميتفورمين 500 ملغ", v: "8:00 ص · كل يوم" },
                                        { k: "أتورفاستاتين 20 ملغ", v: "8:00 م · كل يوم" },
                                        { k: "الالتزام آخر ٣٠ يوماً", v: "94%", tone: "text-forest-600" },
                                    ].map((row) => (
                                        <div key={row.k} className="flex justify-between items-center gap-3 bg-sage-50 dark:bg-forest-800/40 rounded-xl px-4 py-3">
                                            <span className="text-sm font-medium text-forest-700 dark:text-forest-300">{row.k}</span>
                                            <span className={`text-sm font-bold ${row.tone || "text-forest-950 dark:text-forest-50"}`}>{row.v}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-5 flex justify-center">
                                    <div className="w-24 h-24 bg-white dark:bg-forest-900/60 border-2 border-forest-300 dark:border-forest-600 rounded-2xl flex items-center justify-center">
                                        <QrCode className="w-16 h-16 text-forest-950 dark:text-forest-50" />
                                    </div>
                                </div>
                            </div>
                        </Reveal>

                        <Reveal animation="fade-up" className="order-1 lg:order-2">
                            <span className="badge badge-info mb-4">مع الطبيب</span>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-forest-950 text-balance">
                                الملف عند الطبيب، لساعات فقط
                            </h2>
                            <p className="mt-4 text-lg text-forest-700/70 leading-relaxed">
                                في العيادة أو الصيدلية، أرِ الطبيب رمز QR فيرى الأدوية والحساسية والالتزام،
                                ثم ينتهي الرابط وحده.
                            </p>
                            <Bullets icon={Check} box="bg-mint-100 dark:bg-forest-800/60" color="text-forest-600 dark:text-forest-300" items={[
                                "رابط مؤقّت ورمز QR يمسحه الطبيب بكاميرا هاتفه",
                                "بلا حساب ولا تطبيق، وللقراءة فقط",
                                "الحساسية أولاً وبالأحمر، ثم الأدوية والمواعيد",
                                "ينتهي بعد يوم أو ثلاثة أيام أو أسبوع",
                            ]} />
                        </Reveal>
                    </div>
                </div>
            </section>

            {/* الكورس — مكان التأكيد الصوتي في النموذج */}
            <section className="py-20 lg:py-28 bg-white dark:bg-[#0B1F1E]">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid lg:grid-cols-2 gap-12 items-center">
                        <Reveal animation="fade-up">
                            <span className="badge badge-info mb-4">الكورس</span>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-forest-950 text-balance">
                                المضاد الحيوي حتى آخر يوم
                            </h2>
                            <p className="mt-4 text-lg text-forest-700/70 leading-relaxed">
                                أكثر ما يراه الصيادلة: يتحسّن المريض فيترك الكورس. نبض يُظهر أين وصل،
                                وينبّه قبل أن تضيع الجرعات.
                            </p>
                            <Bullets icon={Activity} box="bg-blue-100" color="text-blue-500" items={[
                                "«يوم ٤ من ٧» بجانب كل جرعة",
                                "تنبيه إن فاتت آخر جرعتين",
                                "سؤال «لماذا؟» قبل إيقاف كورس لم ينتهِ",
                                "الطبيب يرى التقدّم وسبب الإيقاف",
                            ]} />
                        </Reveal>

                        <Reveal animation="scale-in" delay={200}>
                            <div className="card p-8 gradient-mint border-2 border-forest-200 dark:border-forest-700" aria-hidden="true">
                                <div className="flex items-center justify-between mb-5">
                                    <div>
                                        <p className="text-xl font-bold text-forest-950 dark:text-forest-50">أموكسيسيلين 500 ملغ</p>
                                        <p className="text-sm text-forest-600 dark:text-forest-400">كورس ٧ أيام · اليوم ٥</p>
                                    </div>
                                    <span className="badge badge-info">باقي يومان</span>
                                </div>
                                <div className="grid grid-cols-7 gap-2">
                                    {["full", "full", "full", "part", "today", "future", "future"].map((s, i) => (
                                        <div key={i} className={`h-12 rounded-xl ${{
                                            full: "bg-forest-500",
                                            part: "bg-gradient-to-t from-forest-500 from-50% to-sage-200 to-50%",
                                            today: "bg-white dark:bg-forest-900/60 ring-2 ring-forest-500 animate-pulse",
                                            future: "bg-white/70 dark:bg-forest-900/40",
                                        }[s]}`} />
                                    ))}
                                </div>
                                <div className="mt-5 flex items-center justify-between text-sm">
                                    <span className="font-semibold text-forest-800 dark:text-forest-200">11 من 21 جرعة</span>
                                    <span className="text-forest-600 dark:text-forest-400">آخر يوم: الأحد</span>
                                </div>
                                <p className="mt-4 text-sm font-semibold text-forest-700 dark:text-forest-300 bg-white/70 dark:bg-forest-900/40 rounded-xl px-4 py-3">
                                    أكمل الكورس حتى نهايته، حتى لو تحسّنت.
                                </p>
                            </div>
                        </Reveal>
                    </div>
                </div>
            </section>
        </>
    );
}

/* ================= أسئلة ================= */

const FAQ = [
    ["هل يقترح نبض جرعات أو أدوية؟", "لا. نبض أداة تنظيمية فقط: تسجّل ما وصفه الطبيب وتذكّرك به. لا يشخّص ولا يقترح جرعات ولا بدائل."],
    ["هل تصلني التذكيرات والتطبيق مغلق؟", "نعم، بعد تفعيل الإشعارات من صفحة الحساب. على الآيفون يجب تثبيت نبض على الشاشة الرئيسية أولاً."],
    ["هل يحتاج الطبيب حساباً ليرى الملف؟", "لا. ترسل له رابطاً مؤقّتاً أو رمز QR، فيرى الملف للقراءة فقط، والرابط ينتهي وحده."],
    ["من يرى بياناتي؟", "أنت فقط. لا يُشارَك شيء إلا برابط تنشئه بنفسك، والأدوية المعلّمة «خاصة» لا تظهر فيه أبداً."],
];

function Faq() {
    return (
        <section id="faq" className="py-20 lg:py-28 bg-sage-50 scroll-mt-20">
            <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
                <Reveal className="text-center mb-12">
                    <span className="badge badge-success mb-4">أسئلة</span>
                    <h2 className="text-3xl sm:text-4xl font-extrabold text-forest-950">قبل أن تبدأ</h2>
                </Reveal>
                <div className="space-y-3">
                    {FAQ.map(([q, a], i) => (
                        <Reveal key={q} delay={i * 80}>
                            <details className="card group">
                                <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none font-bold text-forest-950">
                                    {q}
                                    <ChevronDown className="w-5 h-5 text-forest-600 flex-shrink-0 transition-transform group-open:rotate-180" />
                                </summary>
                                <p className="px-5 pb-5 -mt-1 text-forest-700/70 leading-relaxed">{a}</p>
                            </details>
                        </Reveal>
                    ))}
                </div>
            </div>
        </section>
    );
}

/* ================= الدعوة الأخيرة والتذييل ================= */

function LandingCTA({ isIn, start }) {
    return (
        <section className="pb-20 lg:pb-28 bg-sage-50">
            <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                <Reveal animation="scale-in">
                    <div className="gradient-forest rounded-3xl p-10 lg:p-16 text-center relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" aria-hidden="true" />
                        <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl" aria-hidden="true" />
                        <div className="relative">
                            <div className="w-16 h-16 bg-white/15 backdrop-blur rounded-2xl flex items-center justify-center mx-auto mb-6">
                                <HeartPulse className="w-9 h-9 text-white" />
                            </div>
                            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white text-balance">
                                جرعة بجرعة، يوماً بيوم
                            </h2>
                            <p className="mt-4 text-lg text-white/70 max-w-2xl mx-auto">
                                دقيقة لإنشاء الحساب، وبعدها يتذكّر نبض عنك. مجاني بالكامل.
                            </p>
                            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                                <Link to={start}
                                    className="bg-white text-forest-950 hover:bg-mint-50 font-semibold px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5 shadow-lg flex items-center justify-center gap-2">
                                    {isIn ? "افتح التطبيق" : "أنشئ حسابك الآن"}
                                    <ArrowLeft className="w-5 h-5" />
                                </Link>
                                {!isIn && (
                                    <Link to="/login"
                                        className="bg-white/10 hover:bg-white/20 text-white font-semibold px-8 py-4 rounded-xl border border-white/20 transition-all">
                                        تسجيل الدخول
                                    </Link>
                                )}
                            </div>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

function LandingFooter() {
    const cols = [
        { title: "التطبيق", links: [["المزايا", "#features"], ["الوضع المريح", "#easy"], ["مع الطبيب", "#doctor"], ["أسئلة", "#faq"]] },
        { title: "الحساب", links: [["إنشاء حساب", "/register"], ["تسجيل الدخول", "/login"]] },
    ];
    return (
        <footer className="bg-forest-950 text-white/70 pt-16 pb-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                    <div className="col-span-2">
                        <div className="flex items-center gap-2.5 mb-4">
                            <Logo size={40} variant="light" />
                            <div>
                                <span className="text-xl font-extrabold text-white">نبض</span>
                                <span className="block text-[10px] text-forest-300">Nabd</span>
                            </div>
                        </div>
                        <p className="text-sm leading-relaxed max-w-md">
                            أداة تنظيمية لمتابعة الأدوية والمواعيد. لا تقدّم تشخيصاً ولا توصيات علاجية،
                            ولا تغني عن استشارة الطبيب أو الصيدلاني.
                        </p>
                    </div>

                    {cols.map((col) => (
                        <div key={col.title}>
                            <h4 className="text-sm font-bold text-white mb-4">{col.title}</h4>
                            <ul className="space-y-2">
                                {col.links.map(([label, href]) => (
                                    <li key={label}>
                                        {href.startsWith("#")
                                            ? <a href={href} className="text-sm hover:text-forest-300 transition-colors">{label}</a>
                                            : <Link to={href} className="text-sm hover:text-forest-300 transition-colors">{label}</Link>}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-center sm:text-start">
                    <p className="text-sm">وسيم نصر · دارين النجم · بيسان أبو شهلا</p>
                    <p className="text-xs text-forest-300">مشروع تخرج — الجامعة الدولية الخاصة للعلوم والتكنولوجيا · 2026</p>
                </div>
            </div>
        </footer>
    );
}
