import { lazy, Suspense, useEffect, useState } from "react";
import {
  Link,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { useWorkspace } from "../lib/context";
import { request } from "../services/api";
import { Brand, Icon, Reveal } from "../components/ui";
const HeroScene = lazy(() => import("../components/HeroScene"));
function useTitle(title) {
  useEffect(() => {
    document.title = `${title} | Meridian ERP`;
  }, [title]);
}
export function PublicLayout() {
  const { theme, toggleTheme, user } = useWorkspace();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  return (
    <div className="public-site">
      <header className="public-header">
        <Link to="/" aria-label="Meridian home">
          <Brand />
        </Link>
        <nav className={open ? "open" : ""} aria-label="Public navigation">
          <Link to="/#features" onClick={() => setOpen(false)}>
            Why Meridian
          </Link>
          <Link to="/#modules" onClick={() => setOpen(false)}>
            The workspace
          </Link>
          <Link to="/#pricing" onClick={() => setOpen(false)}>
            Pricing
          </Link>
          <Link to="/about" onClick={() => setOpen(false)}>
            Our story
          </Link>
          <Link to="/contact" onClick={() => setOpen(false)}>
            Contact
          </Link>
        </nav>
        <div className="public-actions">
          <button
            className="icon-button"
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            onClick={toggleTheme}
          >
            <Icon name={theme === "dark" ? "Sun" : "Moon"} size={18} />
          </button>
          <Link className="btn primary" to={user ? "/app/dashboard" : "/login"}>
            {user ? "Open workspace" : "Get started"}
            <Icon name="ArrowUpRight" size={16} />
          </Link>
          <button
            className="icon-button mobile-menu"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "X" : "Menu"} />
          </button>
        </div>
      </header>
      <main id="main-content">
        <Outlet />
      </main>
      <footer className="public-footer">
        <div>
          <Link to="/">
            <Brand />
          </Link>
          <p>
            A little more connected.
            <br />A lot more possible.
          </p>
        </div>
        <div>
          <b>Explore</b>
          <Link to="/#features">Features</Link>
          <Link to="/#pricing">Pricing</Link>
          <Link to="/login">Open workspace</Link>
        </div>
        <div>
          <b>Get to know us</b>
          <Link to="/about">Our story</Link>
          <Link to="/contact">Let’s talk</Link>
          <button
            className="footer-link"
            onClick={() => window.dispatchEvent(new Event("open-assistant"))}
          >
            Ask Meridian
          </button>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Meridian. Built with care.</span>
          <span>Original by design. Connected by purpose.</span>
        </div>
      </footer>
    </div>
  );
}
export function Landing() {
  useTitle("Business, in harmony");
  const { user, config, login, toast } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [showScene, setShowScene] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    const timer = setTimeout(() => setShowScene(true), 300);
    return () => clearTimeout(timer);
  }, []);
  useEffect(() => {
    if (location.hash)
      document.getElementById(location.hash.slice(1))?.scrollIntoView({
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [location.hash]);
  const demo = async () => {
    if (user) return navigate("/app/dashboard");
    if (!config.demo) return navigate("/login");
    setBusy(true);
    try {
      await login("admin@meridian.demo", "Demo@Meridian26!");
      navigate("/app/dashboard");
    } catch (e) {
      toast(e.message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <section className="landing-hero">
        <Reveal className="hero-copy">
          <span className="hero-kicker">
            <span className="live-dot" />
            YOUR NEXT CHAPTER STARTS HERE
          </span>
          <h1>
            Good business.
            <br />
            Beautifully
            <br />
            <span>connected.</span>
          </h1>
          <p>
            Bring your people, products, and possibilities together. A
            thoughtful workspace that turns the everyday into forward momentum.
          </p>
          <div className="hero-buttons">
            <button
              className="btn primary large"
              onClick={demo}
              disabled={busy}
            >
              {busy
                ? "Opening your workspace…"
                : config.demo
                  ? "Explore the live demo"
                  : "Open your workspace"}
              <Icon name="ArrowUpRight" size={19} />
            </button>
            <a href="#modules" className="btn large">
              See what’s inside <Icon name="ArrowRight" size={17} />
            </a>
          </div>
          <div className="hero-proof">
            <span className="proof-avatars">
              <i>AM</i>
              <i>SK</i>
              <i>JL</i>
            </span>
            <div>
              <b>One workspace. Room for everyone.</b>
              <small>Sales, inventory, finance, people & more.</small>
            </div>
          </div>
        </Reveal>
        <Reveal className="hero-visual" delay={0.15}>
          <div className="hero-grid" />
          <div className="scene-label">
            <span className="live-dot" />
            THE BIG PICTURE, CONNECTED
          </div>
          <div className="three-container">
            {showScene ? (
              <Suspense fallback={<HeroFallback />}>
                <HeroScene />
              </Suspense>
            ) : (
              <HeroFallback />
            )}
          </div>
          <div className="floating-card float-sales">
            <span className="floating-icon">
              <Icon name="ChartNoAxesCombined" size={21} />
            </span>
            <div>
              <small>EVERY DETAIL, IN SYNC</small>
              <b>Clarity looks good on you.</b>
            </div>
            <Icon name="CheckCircle2" size={19} />
          </div>
          <div className="floating-card float-stock">
            <span className="floating-icon mint">
              <Icon name="Package" size={21} />
            </span>
            <div>
              <b>Everything in its place.</b>
              <small>One connected workspace.</small>
            </div>
          </div>
          <span className="hero-visual-caption">
            LESS FRICTION. MORE FORWARD.
          </span>
        </Reveal>
      </section>
      <div className="benefit-strip">
        <span>Built for the way you work.</span>
        {[
          ["ShieldCheck", "Roles that respect boundaries"],
          ["Layers", "One source of clarity"],
          ["Sparkles", "A helpful AI companion"],
        ].map(([icon, text]) => (
          <span key={text}>
            <Icon name={icon} size={19} />
            {text}
          </span>
        ))}
      </div>
      <section className="public-section" id="features">
        <Reveal className="section-heading">
          <div>
            <div className="eyebrow">LESS BUSYWORK. MORE POSSIBILITY.</div>
            <h2>
              Make room for
              <br />
              what really matters<span>.</span>
            </h2>
          </div>
          <p>
            Good software gets out of your way.
            <br />
            Great software helps you find a better one.
          </p>
        </Reveal>
        <div className="feature-grid">
          {[
            [
              "Layers",
              "Everything talks.",
              "An order updates your stock. A payment updates your books. Your whole business moves as one.",
            ],
            [
              "ChartNoAxesCombined",
              "Clarity comes standard.",
              "Live dashboards and balanced reports help you make your next move with confidence.",
            ],
            [
              "Heart",
              "Thoughtful by nature.",
              "A calm, intuitive workspace. Clear roles, accessible details, and an assistant that’s here to help.",
            ],
          ].map(([icon, title, text], i) => (
            <Reveal key={title} delay={i * 0.07}>
              <article className="feature-card">
                <span className={`feature-icon tone-${i}`}>
                  <Icon name={icon} size={26} />
                </span>
                <span className="feature-index">0{i + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="module-showcase public-section" id="modules">
        <Reveal className="section-heading">
          <div>
            <div className="eyebrow">THE WHOLE BUSINESS. ONE WORKSPACE.</div>
            <h2>
              Every part.
              <br />
              Part of something bigger<span>.</span>
            </h2>
          </div>
          <Link className="btn" to="/login">
            Step inside <Icon name="ArrowUpRight" size={17} />
          </Link>
        </Reveal>
        <div className="showcase-grid">
          {[
            [
              "ShoppingBag",
              "Sales & purchases",
              "From first order to paid invoice. A clear path for every transaction.",
              "01",
            ],
            [
              "Boxes",
              "Products & inventory",
              "Know what you have, what’s moving, and what comes next.",
              "02",
            ],
            [
              "ChartNoAxesCombined",
              "Accounting & reports",
              "Balanced books, useful insights, and exports ready to share.",
              "03",
            ],
            [
              "Users",
              "People & relationships",
              "Your team, customers, and suppliers. Thoughtfully connected.",
              "04",
            ],
            [
              "GraduationCap",
              "School administration",
              "Admissions, classes, guardians, attendance, and fees.",
              "05",
            ],
            [
              "Sparkles",
              "Your AI assistant",
              "Ask questions, find your way, and confirm actions with confidence.",
              "06",
            ],
          ].map(([icon, title, text, n]) => (
            <Reveal key={title}>
              <Link to="/login" className="showcase-card">
                <span className="showcase-number">{n}</span>
                <Icon name={icon} size={27} />
                <h3>{title}</h3>
                <p>{text}</p>
                <span className="showcase-arrow">
                  <Icon name="ArrowUpRight" size={21} />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="public-section pricing-section" id="pricing">
        <Reveal className="section-heading centered">
          <div className="eyebrow">ROOM TO START. SPACE TO GROW.</div>
          <h2>
            A plan for your next chapter<span>.</span>
          </h2>
          <p>
            Illustrative plans for this product preview. Contact us to discuss a
            deployment.
            <br />
            No checkout or billing is enabled.
          </p>
        </Reveal>
        <div className="pricing-grid">
          {[
            [
              "Explore",
              "0",
              "Get a feel for what’s possible.",
              [
                "Live, seeded demo workspace",
                "Every core module",
                "Three demo roles",
                "Local setup included",
              ],
            ],
            [
              "Team",
              "29",
              "Find your rhythm, together.",
              [
                "Everything in Explore",
                "Role-based team access",
                "Sales & purchase workflows",
                "Accounting reports & exports",
              ],
            ],
            [
              "Business",
              "79",
              "Bring the bigger picture together.",
              [
                "Everything in Team",
                "School administration",
                "Gemini assistant integration",
                "Deployment planning",
              ],
            ],
          ].map(([title, price, description, features], i) => (
            <Reveal key={title} delay={i * 0.07}>
              <article className={`pricing-card ${i === 1 ? "featured" : ""}`}>
                {i === 1 && (
                  <span className="pricing-recommend">
                    MADE FOR GROWING TEAMS
                  </span>
                )}
                <h3>{title}</h3>
                <p>{description}</p>
                <div className="price">
                  ${price}
                  <span>{i === 0 ? " / demo" : " / month · preview"}</span>
                </div>
                <Link
                  className={`btn ${i === 1 ? "primary" : ""}`}
                  to={i === 0 ? "/login" : "/contact"}
                >
                  {i === 0 ? "Explore the demo" : "Let’s talk"}
                  <Icon name="ArrowUpRight" size={17} />
                </Link>
                <ul>
                  {features.map((f) => (
                    <li key={f}>
                      <Icon name="Check" size={16} />
                      {f}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="public-section testimonials">
        <Reveal className="section-heading">
          <div>
            <div className="eyebrow">BUILT FOR THE EVERYDAY.</div>
            <h2>
              A workspace with purpose<span>.</span>
            </h2>
          </div>
          <p>
            Three practical promises behind the product.
            <br />
            Clear workflows. Connected records. Thoughtful details.
          </p>
        </Reveal>
        <div className="testimonial-grid">
          {[
            "A calmer way to run the everyday.",
            "More connected. More confident.",
            "Built around the people who use it.",
          ].map((title, i) => (
            <Reveal key={title}>
              <article className="testimonial-card">
                <span className="placeholder-label">
                  OUR PRODUCT PRINCIPLES
                </span>
                <h3>{title}</h3>
                <p>
                  {
                    [
                      "Bring the work into one place, with fewer repetitive steps.",
                      "See the effect of each transaction across inventory and accounts.",
                      "Keep navigation, permissions, and confirmation steps clear.",
                    ][i]
                  }
                </p>
                <div>
                  <span className={`mini-avatar mini-${i}`}>
                    <Icon name="Check" size={14} />
                  </span>
                  <span>
                    <b>Meridian</b>
                    <small>Designed around your workflow</small>
                  </span>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="public-cta">
        <Reveal>
          <div className="eyebrow">A FRESH PERSPECTIVE IS A CLICK AWAY.</div>
          <h2>
            Your business has potential.
            <br />
            Give it a little more space.
          </h2>
          <button className="btn primary large" onClick={demo} disabled={busy}>
            Find your flow <Icon name="ArrowUpRight" size={19} />
          </button>
        </Reveal>
        <span aria-hidden="true">✳</span>
      </section>
    </>
  );
}
function HeroFallback() {
  return (
    <div
      className="hero-fallback"
      role="img"
      aria-label="Connected Meridian workspace illustration"
    >
      <div className="fallback-cube cube-one">
        <Icon name="Package" size={37} />
      </div>
      <div className="fallback-cube cube-two">
        <Icon name="Users" size={35} />
      </div>
      <div className="fallback-cube cube-three">
        <Icon name="ChartNoAxesCombined" size={38} />
      </div>
      <div className="fallback-orbit" />
    </div>
  );
}
export function About() {
  useTitle("Our story");
  return (
    <>
      <section className="story-hero public-section">
        <Reveal>
          <div className="eyebrow">A LITTLE CLARITY CAN CHANGE EVERYTHING.</div>
          <h1>
            Business is human.
            <br />
            Software should be, too<span>.</span>
          </h1>
          <p>
            Meridian began with a simple idea: the tools we use every day should
            make work feel lighter, clearer, and more connected.
          </p>
        </Reveal>
        <div className="story-art" aria-hidden="true">
          <div className="story-symbol">
            <Brand compact />
          </div>
          <span>PEOPLE</span>
          <span>PROGRESS</span>
          <span>POSSIBILITY</span>
        </div>
      </section>
      <section className="public-section story-columns">
        <Reveal>
          <span className="eyebrow">OUR MISSION</span>
          <h2>
            Less friction.
            <br />
            More forward.
          </h2>
        </Reveal>
        <Reveal>
          <p>
            Running a business means holding a lot of moving pieces. Sales,
            suppliers, stock, payroll, and accounts each tell a part of your
            story. Meridian brings those parts together.
          </p>
          <p>
            We believe clarity should be built in. A sale should update
            inventory. A payment should balance the books. And the interface
            should feel like someone thought about the person using it.
          </p>
          <p>
            From a growing studio to a busy school, the goal is the same: a
            little less busywork, and a little more room for the work that
            matters.
          </p>
        </Reveal>
      </section>
      <section className="public-section tech-section">
        <Reveal className="section-heading">
          <div>
            <div className="eyebrow">THOUGHTFUL ON THE INSIDE, TOO.</div>
            <h2>
              Built on solid ground<span>.</span>
            </h2>
          </div>
          <p>
            Familiar technology, carefully connected.
            <br />A foundation you can understand and extend.
          </p>
        </Reveal>
        <div className="tech-grid">
          {[
            ["React & Vite", "Fast, responsive interfaces."],
            ["Express & Node.js", "A clear, validated API."],
            ["Prisma", "MySQL in production. SQLite for demos."],
            [
              "Three.js & Motion",
              "A little delight, with accessibility in mind.",
            ],
            ["Gemini", "Server-side assistance. You stay in control."],
            ["PDFKit", "Reports ready to share."],
          ].map(([title, text]) => (
            <Reveal key={title}>
              <article>
                <Icon name="Layers" size={22} />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>
      <section className="public-section creator-section">
        <div className="creator-photo">
          <Icon name="UserRound" size={68} />
          <span>SHAHYAN360</span>
        </div>
        <Reveal>
          <div className="eyebrow">AN INDEPENDENT PROJECT</div>
          <h2>Shahyan360</h2>
          <p className="creator-title">Creator of Meridian</p>
          <p>
            Meridian brings daily business operations into one connected
            workspace. Explore the project, follow its development, and share
            ideas for what comes next.
          </p>
          <p>
            <a
              className="text-link"
              href="https://github.com/Shahyan360"
              target="_blank"
              rel="noopener noreferrer"
            >
              Find Shahyan360 on GitHub <Icon name="ArrowUpRight" size={15} />
            </a>
          </p>
          <Link className="btn" to="/contact">
            Start a conversation <Icon name="ArrowUpRight" size={17} />
          </Link>
        </Reveal>
      </section>
    </>
  );
}
export function Contact() {
  useTitle("Let’s talk");
  const { toast } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.currentTarget));
    setBusy(true);
    setError("");
    try {
      await request("/contact", { method: "POST", body });
      setSent(true);
      toast("Your message is in the right place. Thank you.");
    } catch (reason) {
      setError(
        reason.fields ? Object.values(reason.fields).join(" ") : reason.message,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="public-section contact-section">
      <Reveal className="contact-copy">
        <div className="eyebrow">GOOD THINGS START WITH A CONVERSATION.</div>
        <h1>
          What’s on
          <br />
          your mind<span>?</span>
        </h1>
        <p>
          A question, an idea, or a big next step.
          <br />
          We’d love to hear about it.
        </p>
        <div className="contact-details">
          <span>
            <Icon name="MessageCircle" size={24} />
          </span>
          <div>
            <b>A real message. A thoughtful reply.</b>
            <p>
              Your note goes straight to the owner’s private inbox, with an
              email notification when delivery is configured.
            </p>
          </div>
        </div>
        <div className="contact-note">
          <Icon name="ShieldCheck" size={18} />
          Your contact details stay in the workspace inbox.
        </div>
      </Reveal>
      <Reveal className="card contact-form-card" delay={0.1}>
        {sent ? (
          <div className="contact-success" role="status">
            <span className="success-icon">
              <Icon name="Check" size={35} />
            </span>
            <h2>
              Message received<span>.</span>
            </h2>
            <p>
              Thanks for reaching out. Your message has been saved to the
              owner’s inbox.
            </p>
            <button className="btn" onClick={() => setSent(false)}>
              Send another message <Icon name="ArrowUpRight" size={16} />
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="record-form">
            <h2>Let’s start here.</h2>
            <p className="muted">
              A few details help us make this a good conversation.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="form-grid">
              <label>
                Your name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Alex Morgan"
                />
              </label>
              <label>
                Email address
                <input
                  name="email"
                  type="email"
                  required
                  maxLength={254}
                  autoComplete="email"
                  placeholder="you@company.com"
                />
              </label>
              <label className="full-width">
                What’s it about?
                <input
                  name="subject"
                  required
                  minLength={2}
                  maxLength={150}
                  placeholder="A new possibility…"
                />
              </label>
              <label className="full-width">
                Your message
                <textarea
                  name="message"
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={6}
                  placeholder="Tell us a little about what you have in mind."
                />
              </label>
              <label className="honeypot" aria-hidden="true">
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
            </div>
            <button className="btn primary large" disabled={busy}>
              {busy ? "Sending your message…" : "Send message"}
              <Icon name="ArrowUpRight" size={18} />
            </button>
            <p className="form-privacy">
              By submitting, you agree to share these details with the workspace
              owner.
            </p>
          </form>
        )}
      </Reveal>
    </section>
  );
}
export function Login() {
  useTitle("Welcome back");
  const { user, config, login } = useWorkspace();
  const navigate = useNavigate();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [visible, setVisible] = useState(false);
  const signIn = async (e, role) => {
    e?.preventDefault();
    setBusy(true);
    setError("");
    try {
      await login(
        role ? `${role}@meridian.demo` : email,
        role ? "Demo@Meridian26!" : password,
      );
      navigate("/app/dashboard");
    } catch (reason) {
      setError(reason.message);
    } finally {
      setBusy(false);
    }
  };
  if (user) return <Navigate to="/app/dashboard" replace />;
  return (
    <section className="login-page">
      <Reveal className="login-story">
        <span className="eyebrow">WELCOME TO A CLEARER WORKDAY.</span>
        <h1>
          A place for
          <br />
          your next
          <br />
          <span>big thing.</span>
        </h1>
        <p>
          Your people, products, and possibilities.
          <br />
          All right where they belong.
        </p>
        <div className="login-art" aria-hidden="true">
          <span />
          <span />
          <span />
          <Icon name="Sparkles" size={50} />
        </div>
      </Reveal>
      <Reveal className="login-form-wrap">
        <div className="login-form">
          <span className="login-icon">
            <Icon name="LockKeyhole" size={25} />
          </span>
          <h2>Good to see you.</h2>
          <p>Sign in and pick up where you left off.</p>
          <form onSubmit={signIn} className="record-form">
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </label>
            <label>
              Password
              <div className="password-input">
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="icon-button"
                  aria-label={visible ? "Hide password" : "Show password"}
                  onClick={() => setVisible(!visible)}
                >
                  <Icon name="Eye" size={17} />
                </button>
              </div>
            </label>
            <button className="btn primary large" disabled={busy}>
              {busy ? "Opening your workspace…" : "Sign in to your workspace"}
              <Icon name="ArrowRight" size={17} />
            </button>
          </form>
          {config.demo && (
            <div className="demo-roles">
              <div className="or-divider">
                <span>OR EXPLORE A DEMO ROLE</span>
              </div>
              <div>
                {["admin", "manager", "employee"].map((role) => (
                  <button
                    disabled={busy}
                    key={role}
                    onClick={(e) => signIn(e, role)}
                  >
                    <Icon
                      name={
                        role === "admin"
                          ? "ShieldCheck"
                          : role === "manager"
                            ? "ContactRound"
                            : "UserRound"
                      }
                      size={20}
                    />
                    <b>{role}</b>
                    <small>
                      {role === "admin"
                        ? "Full workspace"
                        : role === "manager"
                          ? "Operations & finance"
                          : "View operations"}
                    </small>
                  </button>
                ))}
              </div>
              <p>
                Demo password: <code>Demo@Meridian26!</code>
              </p>
            </div>
          )}
          <p className="login-help">
            Need access? Your workspace administrator can help.
            <br />
            <Link to="/contact">
              Get in touch <Icon name="ArrowUpRight" size={12} />
            </Link>
          </p>
        </div>
      </Reveal>
    </section>
  );
}
export function NotFound() {
  useTitle("Page not found");
  return (
    <section className="not-found">
      <span>404</span>
      <h1>
        A little off the map<span>.</span>
      </h1>
      <p>This page doesn’t exist, but there’s plenty to explore.</p>
      <Link className="btn primary" to="/">
        Find your way home <Icon name="ArrowRight" size={17} />
      </Link>
    </section>
  );
}
