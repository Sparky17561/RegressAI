import { useEffect, useState, Suspense } from "react";
import { Link } from "react-router-dom";
import { 
  ChevronRight, 
  CheckCircle2, 
  Zap, 
  MessageSquare, 
  Users, 
  GitBranch, 
  Search, 
  X
} from "lucide-react";
import "./Landing1.css";

const getSystemTheme = () =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

const Landing1 = () => {
  const [themeMode, setThemeMode] = useState(
    localStorage.getItem("theme-mode") || "system"
  );

  useEffect(() => {
    const theme = themeMode === "system" ? getSystemTheme() : themeMode;
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme-mode", themeMode);
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeMode((prev) => (prev === "dark" ? "light" : "dark"));
  };

  return (
    <div className="landing1-page-container min-h-screen selection:bg-[var(--color-maintext)] selection:text-[var(--color-background)]">
      <Suspense fallback={null}>
        <div className="animate-load relative z-10">
          {/* Navigation */}
          <nav className="fixed top-0 w-full z-50 border-b border-[var(--border)] bg-[var(--color-background)]/80 backdrop-blur-xl">
            <div className="container mx-auto px-6 h-16 flex items-center justify-between">
              <div className="flex items-center gap-8">
                <Link to="/" className="flex items-center gap-2 font-bbh text-xl tracking-tighter">
                  <div className="w-6 h-6 bg-[var(--color-maintext)] rounded-full" />
                  RegressAI
                </Link>
                <div className="hidden md:flex items-center gap-6 text-sm font-gothic text-[var(--color-subtext)]">
                  <a href="#features" className="hover:text-[var(--color-maintext)] transition-colors">
                    Features
                  </a>
                  <a href="#solutions" className="hover:text-[var(--color-maintext)] transition-colors">
                    Solutions
                  </a>
                  <a href="#pricing" className="hover:text-[var(--color-maintext)] transition-colors">
                    Pricing
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleTheme}
                  className="font-gothic bg-[var(--color-bg-light)] rounded-xl border border-[var(--border)] px-4 py-2 hover:bg-[var(--color-bg)] transition-colors text-xs uppercase tracking-widest"
                >
                  {themeMode === "dark" ? "Light" : "Dark"} mode
                </button>
                <Link to="/login">
                  <button className="text-sm font-gothic px-4 py-2 hover:bg-[var(--color-bg-light)] rounded-xl transition-colors">
                    Log in
                  </button>
                </Link>
                <Link to="/app">
                  <button className="bg-[var(--color-maintext)] text-[var(--color-background)] rounded-full px-6 py-2 text-sm font-gothic hover:opacity-90 transition-opacity">
                    Get Started
                  </button>
                </Link>
              </div>
            </div>
          </nav>

          {/* Hero Section */}
          <section className="pt-32 pb-20 px-6 animate-appear">
            <div className="container mx-auto text-center max-w-4xl">
              <span className="mb-6 inline-block uppercase tracking-wider px-4 py-1 text-[10px] font-gothic border border-[var(--border)] bg-[var(--color-bg-light)] rounded-full">
                v1.0 is now live
              </span>
              <h1 className="text-5xl md:text-8xl font-bbh tracking-tight mb-8 text-balance uppercase leading-none">
                Complete platform <br/> <span className="text-[var(--color-subtext)]">to build AI.</span>
              </h1>
              <p className="text-xl md:text-2xl font-lora text-[var(--color-subtext)] mb-12 text-balance max-w-2xl mx-auto leading-relaxed italic">
                Prevent prompt regressions before they reach production. Build, deploy, and scale the best LLM
                experiences with deterministic logic.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <button
                  className="w-full sm:w-auto font-gothic uppercase tracking-widest bg-[var(--color-maintext)] text-[var(--color-background)] py-4 px-8 rounded-full text-lg hover:opacity-90 transition-opacity"
                >
                  Get a demo
                </button>
                <Link to="/app" className="w-full sm:w-auto">
                  <button
                    className="w-full group font-gothic uppercase tracking-widest border border-[var(--border)] py-4 px-8 rounded-full text-lg hover:bg-[var(--color-bg-light)] transition-colors flex items-center justify-center"
                  >
                    Explore the product{" "}
                    <ChevronRight className="ml-2 w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                </Link>
              </div>
            </div>
          </section>

          {/* Stats Section */}
          <section className="border-y border-[var(--border)]">
            <div className="grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-[var(--border)]">
              {[
                { label: "days saved on daily builds", value: "20", brand: "NETFLIX" },
                { label: "faster time to market", value: "98%", brand: "Tripadvisor" },
                { label: "increase in SEO", value: "300%", brand: "box" },
                { label: "faster to build + deploy", value: "6x", brand: "ebay" },
              ].map((stat, i) => (
                <div key={i} className="p-12 hover:bg-[var(--color-bg-light)] transition-colors group">
                  <div className="text-4xl font-bbh mb-2 tracking-tighter group-hover:scale-105 transition-transform origin-left">
                    {stat.value}{" "}
                    <span className="font-gothic text-xs font-normal text-[var(--color-subtext)] uppercase tracking-widest block mt-1">
                      {stat.label}
                    </span>
                  </div>
                  <div className="mt-8 font-fira text-xl font-bold opacity-30 group-hover:opacity-100 transition-opacity tracking-widest uppercase">
                    {stat.brand}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Bento Grid Section */}
          <section id="features" className="py-24 px-6">
            <div className="container mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[var(--border)] border border-[var(--border)] rounded-3xl overflow-hidden mb-1">
                {/* Left: Collaboration */}
                <div className="p-12 bg-[var(--color-background)] flex flex-col justify-center border-r border-[var(--border)]">
                  <div className="flex items-center gap-2 text-[var(--color-subtext)] text-[10px] font-gothic uppercase tracking-widest mb-6">
                    <Users className="w-4 h-4" /> Collaboration
                  </div>
                  <h2 className="text-4xl md:text-5xl font-bbh mb-6 tracking-tight uppercase leading-none">
                    Faster iteration.
                    <br />
                    More innovation.
                  </h2>
                  <p className="text-lg font-lora text-[var(--color-subtext)] leading-relaxed mb-8">
                    The platform for rapid progress. Let your team focus on shipping features instead of managing
                    infrastructure with automated CI/CD and integrated collaboration tools.
                  </p>
                  <button className="w-fit flex items-center p-0 uppercase tracking-widest text-xs font-bold hover:underline underline-offset-4 font-gothic">
                    Learn about workflows <ChevronRight className="ml-1 w-4 h-4" />
                  </button>
                </div>

                {/* Right: Teamwork */}
                <div className="p-12 bg-[var(--color-background)] flex flex-col justify-center">
                  <div className="flex items-center gap-2 text-[var(--color-subtext)] text-[10px] font-gothic uppercase tracking-widest mb-6">
                    <MessageSquare className="w-4 h-4" /> Teamwork
                  </div>
                  <h3 className="text-3xl md:text-4xl font-bbh mb-6 tracking-tight uppercase leading-none">
                    Seamless interaction.{" "}
                    <span className="text-[var(--color-subtext)]">
                      Share feedback and iterate faster than ever.
                    </span>
                  </h3>
                  <div className="bg-[var(--color-bg)] rounded-xl border border-[var(--border)] p-6 relative overflow-hidden group">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="flex-1 bg-[var(--color-bg-light)] border border-[var(--border)] rounded-lg px-3 py-1.5 flex items-center gap-2">
                        <Search className="w-3 h-3 text-[var(--color-subtext)]" />
                        <span className="text-xs font-gothic text-[var(--color-subtext)]">Search filters...</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between bg-[var(--color-maintext)]/5 border border-[var(--color-maintext)]/10 rounded-lg px-3 py-1.5">
                        <span className="text-[10px] font-fira text-[var(--color-maintext)] uppercase tracking-widest">Query ("semanticEngine")</span>
                        <X className="w-3 h-3 text-[var(--color-maintext)]" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-[var(--border)] border border-[var(--border)] rounded-3xl overflow-hidden mt-6">
                {/* Left: Deep Insights */}
                <div className="p-12 bg-[var(--color-background)] flex flex-col justify-center border-r border-[var(--border)]">
                  <div className="flex items-center gap-2 text-[var(--color-subtext)] text-[10px] font-gothic uppercase tracking-widest mb-6">
                    <Zap className="w-4 h-4" /> Deep Insights
                  </div>
                  <h2 className="text-4xl md:text-5xl font-bbh mb-6 tracking-tight uppercase leading-none">Deeper Data Analysis.</h2>
                  <p className="text-lg font-lora text-[var(--color-subtext)] leading-relaxed">
                    Compare test versions to identify regressions. Analyze performance,
                    safety, and tone with extreme accuracy.
                  </p>
                </div>

                {/* Right: Mock Terminal */}
                <div className="p-12 bg-[var(--color-background)] flex items-center justify-center">
                  <div className="w-full bg-[var(--color-bg)] border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col gap-6 py-8 shadow-[var(--shadow)]">
                    <div className="bg-[var(--color-bg-light)] px-4 py-2 border-b border-[var(--border)] flex items-center gap-2">
                      <GitBranch className="w-3 h-3 text-[var(--color-subtext)]" />
                      <span className="text-[10px] font-fira text-[var(--color-subtext)] uppercase tracking-widest">compare --v1 prod --v2 dev</span>
                    </div>
                    <div className="p-6 font-fira text-sm space-y-4">
                      <div className="flex gap-4 items-center">
                        <span className="text-[var(--color-maintext)] font-black text-xl">+</span>
                        <span className="opacity-80 italic font-lora">"The response is accurate and grounded in provided context."</span>
                      </div>
                      <div className="flex gap-4 items-center">
                        <span className="text-[var(--color-subtext)] font-black text-xl">-</span>
                        <span className="opacity-50 italic font-lora">"Generic AI assistant response template detected."</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Pricing Section */}
          <section id="pricing" className="py-24 px-6 border-t border-[var(--border)]">
            <div className="container mx-auto">
              <div className="text-center max-w-3xl mx-auto mb-20 animate-appear">
                <span className="mb-4 inline-block uppercase tracking-[0.2em] font-bold font-gothic text-xs border border-[var(--border)] px-4 py-1 rounded-full bg-[var(--color-bg-light)]">
                  Flexible Pricing
                </span>
                <h2 className="text-4xl md:text-7xl font-bbh mb-6 tracking-tight uppercase leading-none">Plans and Tiers</h2>
                <p className="text-xl font-lora text-[var(--color-subtext)] italic">Get started for free. Scale when you're ready.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                {/* Freemium Plan */}
                <div className="bg-[var(--color-bg-light)] border border-[var(--border)] rounded-3xl p-12 flex flex-col shadow-[var(--shadow)]">
                  <div className="mb-8">
                    <h3 className="text-2xl font-bbh mb-2 uppercase">Freemium</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-5xl font-bbh">₹0</span>
                      <span className="font-gothic text-[var(--color-subtext)] text-sm uppercase">/ month</span>
                    </div>
                    <p className="font-lora text-[var(--color-subtext)] text-sm italic">Basic features for individuals.</p>
                  </div>
                  <ul className="space-y-4 mb-12 flex-1">
                    {[
                      { text: "Basic Analysis", included: true },
                      { text: "3 test cases per run", included: true },
                      { text: "Deterministic diff", included: true },
                      { text: "Basic insights", included: true },
                      { text: "Team collaboration", included: true },
                      { text: "Requires your API key", included: true },
                      { text: "No deep dive", included: false },
                      { text: "No visualizations", included: false },
                    ].map((feature, i) => (
                      <li key={i} className={`flex items-center gap-3 text-xs font-gothic uppercase tracking-wider ${!feature.included ? 'opacity-40' : ''}`}>
                        {feature.included ? (
                          <CheckCircle2 className="w-4 h-4 text-[var(--color-maintext)]" />
                        ) : (
                          <X className="w-4 h-4 text-[var(--color-subtext)]" />
                        )}
                        {feature.text}
                      </li>
                    ))}
                  </ul>
                  <button className="w-full h-12 font-gothic uppercase tracking-widest text-xs border border-[var(--border)] rounded-xl hover:bg-[var(--color-bg)] transition-colors opacity-50 cursor-default">
                    Current Plan
                  </button>
                </div>

                {/* Pro Plan */}
                <div className="bg-[var(--color-bg-light)] border border-[var(--border)] rounded-3xl p-12 flex flex-col relative overflow-hidden group shadow-[var(--shadow)]">
                  <div className="absolute top-0 right-0 p-4">
                    <span className="bg-[var(--color-maintext)] text-[var(--color-background)] font-bold uppercase py-1 px-3 text-[10px] font-gothic rounded-full">RECOMMENDED</span>
                  </div>
                  <div className="mb-8">
                    <h3 className="text-2xl font-bbh mb-2 uppercase">Pro</h3>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="text-5xl font-bbh">₹399</span>
                      <span className="font-gothic text-[var(--color-subtext)] text-sm uppercase">/ month</span>
                    </div>
                    <p className="font-lora text-[var(--color-subtext)] text-sm italic">For teams and high-scale production.</p>
                  </div>
                  <ul className="space-y-4 mb-12 flex-1">
                    {[
                      { text: "Everything in Free", included: true },
                      { text: "Deep Dive Analysis", included: true },
                      { text: "Adversarial testing", included: true },
                      { text: "10+ test cases", included: true },
                      { text: "Advanced visualizations", included: true },
                      { text: "Hallucination detection", included: true },
                      { text: "Edge case analysis", included: true },
                      { text: "5 deep dives/month", included: true },
                      { text: "Uses RegressAI API", included: true, highlight: true },
                    ].map((feature, i) => (
                      <li key={i} className={`flex items-center gap-3 text-xs font-gothic uppercase tracking-wider ${feature.highlight ? 'text-[var(--color-maintext)] font-bold' : ''}`}>
                        <CheckCircle2 className="w-4 h-4 text-[var(--color-maintext)]" />
                        {feature.text}
                      </li>
                    ))}
                  </ul>
                  <button className="w-full bg-[var(--color-maintext)] text-[var(--color-background)] h-12 font-gothic uppercase tracking-widest text-xs rounded-xl hover:opacity-90 transition-opacity">
                    Upgrade to Pro
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Footer */}
          <footer className="py-20 px-6 border-t border-[var(--border)]">
            <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 text-center md:text-left">
              <div className="col-span-1 md:col-span-2 flex flex-col items-center md:items-start">
                <Link to="/" className="flex items-center gap-2 font-bbh text-2xl tracking-tighter mb-6 uppercase">
                  <div className="w-8 h-8 bg-[var(--color-maintext)] rounded-full" />
                  RegressAI
                </Link>
                <p className="font-lora text-[var(--color-subtext)] max-w-sm leading-relaxed italic">
                  Empowering teams to build state-of-the-art AI applications with ease.
                </p>
              </div>
              <div className="flex flex-col gap-6">
                <h4 className="font-gothic font-bold text-[10px] uppercase tracking-[0.2em] text-[var(--color-maintext)]">Resources</h4>
                <ul className="space-y-4 text-[var(--color-subtext)] font-gothic uppercase text-[10px] tracking-widest">
                  <li><Link to="#" className="hover:text-[var(--color-maintext)] transition-colors">Documentation</Link></li>
                  <li><Link to="#" className="hover:text-[var(--color-maintext)] transition-colors">Pricing</Link></li>
                  <li><Link to="#" className="hover:text-[var(--color-maintext)] transition-colors">API Docs</Link></li>
                </ul>
              </div>
              <div className="flex flex-col gap-6">
                <h4 className="font-gothic font-bold text-[10px] uppercase tracking-[0.2em] text-[var(--color-maintext)]">Company</h4>
                <ul className="space-y-4 text-[var(--color-subtext)] font-gothic uppercase text-[10px] tracking-widest">
                  <li><Link to="#" className="hover:text-[var(--color-maintext)] transition-colors">About Us</Link></li>
                  <li><Link to="#" className="hover:text-[var(--color-maintext)] transition-colors">Privacy Policy</Link></li>
                  <li><Link to="#" className="hover:text-[var(--color-maintext)] transition-colors">Terms of Service</Link></li>
                </ul>
              </div>
            </div>
            <div className="container mx-auto mt-20 pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4 text-[10px] font-gothic uppercase tracking-widest text-[var(--color-subtext)]">
              <p>© 2025 RegressAI Inc. All rights reserved.</p>
              <div className="flex gap-8">
                <a href="#" className="hover:text-[var(--color-maintext)] transition-colors">Twitter</a>
                <a href="#" className="hover:text-[var(--color-maintext)] transition-colors">GitHub</a>
              </div>
            </div>
          </footer>
        </div>
      </Suspense>
    </div>
  );
};

export default Landing1;