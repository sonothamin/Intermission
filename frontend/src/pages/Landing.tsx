import React, { useState } from "react";
import { Link } from "react-router-dom";
import {
  Film,
  Search,
  Library,
  ListPlus,
  BarChart3,
  Sparkles,
  Check,
  ArrowRight,
  Star,
  Tv,
  PlayCircle,
  Shield,
  Clock,
  TrendingUp,
  Download,
  Eye,
  ChevronDown,
  Heart,
  Zap,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useReveal } from "../lib/useReveal";

/* ─────────────────────────── Data ─────────────────────────── */

interface Feature {
  icon: React.ElementType;
  title: string;
  body: string;
  accent: string;
}

const FEATURES: Feature[] = [
  {
    icon: Search,
    title: "Instant search",
    body: "Pull metadata for millions of films and series from TMDB. Title, year, cast — search the way you think and land on the right page in two clicks.",
    accent: "from-emerald-500/30 to-emerald-500/0",
  },
  {
    icon: Library,
    title: "One library, fully organised",
    body: "Track watching, completed, on hold, dropped and plan-to-watch status. Filter, sort, and slice your library by any dimension you care about.",
    accent: "from-sky-500/30 to-sky-500/0",
  },
  {
    icon: ListPlus,
    title: "Watchlist that doesn't rot",
    body: "Save things to watch later with rich context — why you saved it, when you added it, and a glance at trailers without leaving the app.",
    accent: "from-violet-500/30 to-violet-500/0",
  },
  {
    icon: BarChart3,
    title: "Analytics that mean something",
    body: "See your watch time, top genres, year-by-year trends and rating distributions. Discover what you actually gravitate toward, not just what you've seen.",
    accent: "from-amber-500/30 to-amber-500/0",
  },
  {
    icon: PlayCircle,
    title: "Episode-level progress",
    body: "Mark episodes watched, pick up where you left off on the dashboard, and binge through multi-season shows without losing your place.",
    accent: "from-rose-500/30 to-rose-500/0",
  },
  {
    icon: Download,
    title: "Import from anywhere",
    body: "Bring your Letterboxd, IMDb, or plain CSV export. We map your history, dedupe intelligently, and let you review the diff before committing.",
    accent: "from-teal-500/30 to-teal-500/0",
  },
];

interface Step {
  number: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    number: "01",
    title: "Create your account",
    body: "Sign up with email or one-tap Google. No credit card, no survey — a workspace ready in under 30 seconds.",
  },
  {
    number: "02",
    title: "Add what you watch",
    body: "Search TMDB directly, import an export, or paste an IMDb/Letterboxd link. Status, rating, and notes happen in the same flow.",
  },
  {
    number: "03",
    title: "Watch your taste take shape",
    body: "Your dashboard turns raw activity into a quiet story about the kind of stories you love.",
  },
];

interface Pillar {
  icon: React.ElementType;
  title: string;
  body: string;
}

const PILLARS: Pillar[] = [
  {
    icon: Shield,
    title: "Your data, your account",
    body: "Stored on Supabase with row-level security. Export or delete it whenever you want.",
  },
  {
    icon: Clock,
    title: "Built for everyday use",
    body: "Sub-second search, keyboard-friendly, mobile-first. Logging a title should feel as easy as watching one.",
  },
  {
    icon: Heart,
    title: "Made by fans, not algorithms",
    body: "No engagement traps, no ads, no recommendations shoved at you. Just a clean record of what you've seen.",
  },
];

interface FaqItem {
  q: string;
  a: string;
}

const FAQ: FaqItem[] = [
  {
    q: "Is Intermission free to use?",
    a: "Yes. The full app is free while in beta. We may add optional paid tiers later for power-user features, but the core tracker will always remain free.",
  },
  {
    q: "Where does the movie and TV data come from?",
    a: "All metadata is sourced from The Movie Database (TMDB). Posters, cast, crew, episode lists, and trailers all flow from their public API, which is licensed under CC BY 4.0.",
  },
  {
    q: "Can I import my existing watch history?",
    a: "Absolutely. We accept Letterboxd, IMDb, and generic CSV exports. The importer previews the diff so you can confirm before anything is written.",
  },
  {
    q: "Do you sell or share my data?",
    a: "No. We don't sell, share, or use your viewing data to train models. Read the privacy policy for the full details.",
  },
  {
    q: "Which platforms are supported?",
    a: "Intermission is a responsive web app that works on any modern browser. Mobile, tablet, and desktop layouts are all first-class — there is no native app to install.",
  },
  {
    q: "Can I share my library with friends?",
    a: "Public sharing is on the roadmap. Today, your library is private to your account; we'll surface shareable profiles once the feature is ready.",
  },
];

/* ─────────────────────── Helper components ─────────────────── */

const SectionHeading: React.FC<{
  eyebrow?: string;
  title: React.ReactNode;
  description?: string;
  align?: "left" | "center";
}> = ({ eyebrow, title, description, align = "center" }) => {
  const ref = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`reveal mb-12 max-w-2xl ${align === "center" ? "mx-auto text-center" : ""}`}
    >
      {eyebrow && (
        <div
          className={`mb-3 inline-flex items-center gap-2 rounded-full border border-theme bg-theme-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#10b981]`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[#10b981] pulse-ring" />
          {eyebrow}
        </div>
      )}
      <h2 className="text-3xl font-bold tracking-tight text-theme-primary sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-3 text-base leading-relaxed text-theme-secondary sm:text-lg">
          {description}
        </p>
      )}
    </div>
  );
};

/* ─────────────────────────── Page ─────────────────────────── */

export const Landing: React.FC = () => {
  const { user } = useAuth();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="overflow-hidden">
      {/* ─────────────────── HERO ─────────────────── */}
      <section
        id="hero"
        className="relative isolate"
        aria-label="Introduction"
      >
        {/* Layered background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
        >
          <div className="hero-aurora absolute inset-0 opacity-70" />
          <div className="hero-grid absolute inset-0 opacity-50" />
          <div className="hero-blob absolute -top-32 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-[#10b981]/30" />
          <div
            className="hero-blob absolute -top-20 right-[-6rem] h-[24rem] w-[24rem] rounded-full bg-sky-500/20"
            style={{ animationDelay: "4s" }}
          />
          <div
            className="hero-blob absolute top-40 left-[-4rem] h-[20rem] w-[20rem] rounded-full bg-violet-500/20"
            style={{ animationDelay: "8s" }}
          />
        </div>

        <div className="mx-auto max-w-7xl px-4 pt-20 pb-24 sm:px-6 sm:pt-28 sm:pb-32 lg:px-8 lg:pt-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="fade-in-up inline-flex items-center gap-2 rounded-full border border-theme bg-theme-secondary/60 px-3 py-1.5 text-xs font-medium text-theme-secondary backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[#10b981]" />
              <span>Now in public beta · v0.1</span>
            </div>

            <h1 className="fade-in-up delay-100 mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-theme-primary sm:text-5xl md:text-6xl lg:text-7xl">
              Track every{" "}
              <span className="text-gradient-emerald">film</span> and{" "}
              <span className="text-gradient-aurora">series</span> you watch.
            </h1>

            <p className="fade-in-up delay-200 mx-auto mt-6 max-w-2xl text-base leading-relaxed text-theme-secondary sm:text-lg">
              Intermission is a focused, private tracker for your cinema life.
              Log what you watch, mark episodes, build a watchlist, and let your
              library quietly turn into a portrait of your taste.
            </p>

            <div className="fade-in-up delay-300 mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Link
                to={user ? "/dashboard" : "/register"}
                className="group relative inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-[#10b981] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#10b981]/30 transition-all hover:scale-[1.02] hover:bg-[#059669] sm:w-auto"
              >
                <span className="relative z-10 inline-flex items-center gap-2">
                  {user ? "Open your dashboard" : "Start tracking for free"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </span>
                <span
                  aria-hidden
                  className="absolute inset-0 -z-0 bg-gradient-to-r from-[#10b981] via-[#34d399] to-[#10b981] opacity-0 transition-opacity group-hover:opacity-100"
                />
              </Link>
              <a
                href="#features"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-theme bg-theme-secondary/60 px-6 py-3.5 text-sm font-semibold text-theme-primary backdrop-blur transition-colors hover:border-[#10b981] hover:text-[#10b981] sm:w-auto"
              >
                <Eye className="h-4 w-4" />
                See how it works
              </a>
            </div>

            <div className="fade-in-up delay-400 mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-theme-muted">
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#10b981]" /> No credit card
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#10b981]" /> Free during beta
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-[#10b981]" /> Import from
                Letterboxd, IMDb
              </span>
            </div>
          </div>

          {/* Hero device mock — pure CSS, no images */}
          <HeroMock />
        </div>

        <div className="section-divider" />
      </section>

      {/* ───────────────── STATS BAND ───────────────── */}
      <section className="relative">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div
            className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-theme bg-theme-secondary sm:grid-cols-4"
            ref={useReveal<HTMLDivElement>()}
            data-stagger
          >
            {[
              { value: "1M+", label: "Titles indexed", Icon: Film },
              { value: "0 ads", label: "Ever. No kidding.", Icon: Shield },
              { value: "30s", label: "From signup to first log", Icon: Zap },
              { value: "100%", label: "Your data, exportable", Icon: Download },
            ].map(({ value, label, Icon }) => (
              <div
                key={label}
                className="bg-theme-primary p-6 text-center transition-colors hover:bg-theme-secondary"
              >
                <Icon className="mx-auto mb-2 h-5 w-5 text-[#10b981]" />
                <div className="text-2xl font-bold text-theme-primary sm:text-3xl">
                  {value}
                </div>
                <div className="mt-1 text-xs uppercase tracking-wider text-theme-muted">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── MARQUEE / SOCIAL PROOF ───────────────── */}
      <section
        aria-label="Trusted by"
        className="relative border-y border-theme bg-theme-secondary/40 py-10"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-theme-muted">
            Powered by the data sources film people already trust
          </p>
          <div
            className="relative overflow-hidden"
            style={{
              maskImage:
                "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent, black 10%, black 90%, transparent)",
            }}
          >
            <div className="marquee-track flex w-max items-center gap-12 text-2xl font-bold tracking-tight text-theme-muted">
              {[...Array(2)].flatMap((_, dup) =>
                [
                  { name: "TMDB", Icon: Film },
                  { name: "Supabase", Icon: Shield },
                  { name: "Letterboxd compatible", Icon: Star },
                  { name: "IMDb compatible", Icon: TrendingUp },
                  { name: "CSV imports", Icon: Download },
                  { name: "Episode tracker", Icon: Tv },
                ].map(({ name, Icon }, i) => (
                  <div
                    key={`${dup}-${name}-${i}`}
                    className="flex items-center gap-2 whitespace-nowrap"
                  >
                    <Icon className="h-5 w-5" />
                    <span>{name}</span>
                  </div>
                )),
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── FEATURES ───────────────── */}
      <section
        id="features"
        className="relative scroll-mt-20 py-20 sm:py-28"
        aria-label="Features"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Features"
            title={
              <>
                Everything you need to keep a{" "}
                <span className="text-gradient-emerald">loving record</span> of
                what you watch.
              </>
            }
            description="Built for people who care about the small details — the right status, the right season, the right note. No clutter, no noise."
          />

          <div
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            ref={useReveal<HTMLDivElement>()}
            data-stagger
          >
            {FEATURES.map((f) => (
              <article
                key={f.title}
                className="card-hover group relative overflow-hidden rounded-2xl border border-theme bg-theme-secondary p-6"
              >
                <div
                  aria-hidden
                  className={`pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-br ${f.accent} opacity-50 blur-2xl transition-opacity group-hover:opacity-80`}
                />
                <div
                  className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.04))",
                    border: "1px solid rgba(16,185,129,0.25)",
                    color: "#34d399",
                  }}
                >
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-theme-primary">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-theme-secondary">
                  {f.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── HOW IT WORKS ───────────────── */}
      <section
        id="how"
        className="relative scroll-mt-20 py-20 sm:py-28"
        aria-label="How it works"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="How it works"
            title={
              <>
                Three steps from <span className="text-gradient-emerald">zero</span>{" "}
                to your first log.
              </>
            }
          />

          <ol
            className="grid gap-5 lg:grid-cols-3"
            ref={useReveal<HTMLOListElement>()}
            data-stagger
          >
            {STEPS.map((s) => (
              <li
                key={s.number}
                className="card-hover relative overflow-hidden rounded-2xl border border-theme bg-theme-secondary p-7"
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute -right-6 -bottom-10 h-44 w-44 rounded-full bg-[#10b981]/10 blur-3xl"
                />
                <span className="text-gradient-emerald block text-5xl font-extrabold tracking-tight">
                  {s.number}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-theme-primary">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-theme-secondary">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────────────── ANALYTICS PREVIEW ───────────────── */}
      <section
        className="relative py-20 sm:py-28"
        aria-label="Analytics preview"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div ref={useReveal<HTMLDivElement>()} className="reveal">
              <div
                className="mb-3 inline-flex items-center gap-2 rounded-full border border-theme bg-theme-secondary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#10b981]"
              >
                <BarChart3 className="h-3 w-3" />
                Insights, not vanity metrics
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-theme-primary sm:text-4xl">
                Turn your watch history into a{" "}
                <span className="text-gradient-aurora">quiet portrait</span> of
                your taste.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-theme-secondary">
                Your dashboard surfaces the patterns hiding in plain sight: which
                decades you keep returning to, which genres are over- and
                under-represented, and how your average rating shifts over time.
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {[
                  "Genre & decade breakdowns that update as you log",
                  "Watch-time totals and streak tracking",
                  "Rating distribution that grows into a real bell curve",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <span
                      className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: "rgba(16,185,129,0.12)",
                        color: "#10b981",
                      }}
                    >
                      <Check className="h-3 w-3" />
                    </span>
                    <span className="text-theme-secondary">{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-7">
                <Link
                  to={user ? "/dashboard" : "/register"}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#10b981] transition-colors hover:text-[#34d399]"
                >
                  {user ? "Open your dashboard" : "Build yours in 30 seconds"}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            <div ref={useReveal<HTMLDivElement>()} className="reveal">
              <AnalyticsMock />
            </div>
          </div>
        </div>
      </section>

      {/* ───────────────── PILLARS ───────────────── */}
      <section
        className="relative border-y border-theme bg-theme-secondary/40 py-20 sm:py-28"
        aria-label="Why Intermission"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Principles"
            title={
              <>
                Quiet software, built around{" "}
                <span className="text-gradient-emerald">three promises</span>.
              </>
            }
          />
          <div
            className="grid gap-5 sm:grid-cols-3"
            ref={useReveal<HTMLDivElement>()}
            data-stagger
          >
            {PILLARS.map((p) => (
              <article
                key={p.title}
                className="card-hover rounded-2xl border border-theme bg-theme-primary p-6"
              >
                <div
                  className="inline-flex h-10 w-10 items-center justify-center rounded-lg"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.04))",
                    border: "1px solid rgba(16,185,129,0.25)",
                    color: "#34d399",
                  }}
                >
                  <p.icon className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-theme-primary">
                  {p.title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-theme-secondary">
                  {p.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────────── FAQ ───────────────── */}
      <section
        id="faq"
        className="relative scroll-mt-20 py-20 sm:py-28"
        aria-label="Frequently asked questions"
      >
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="FAQ"
            title="Questions, answered."
            description="If something here doesn't cover it, drop us a note — we read everything."
          />
          <div
            className="divide-y divide-theme overflow-hidden rounded-2xl border border-theme bg-theme-secondary"
            ref={useReveal<HTMLDivElement>()}
          >
            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-theme-tertiary"
                    aria-expanded={open}
                  >
                    <span className="text-sm font-semibold text-theme-primary sm:text-base">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 flex-shrink-0 text-theme-muted transition-transform duration-200 ${
                        open ? "rotate-180 text-[#10b981]" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`grid overflow-hidden transition-all duration-300 ${
                      open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="min-h-0">
                      <p className="px-5 pb-5 text-sm leading-relaxed text-theme-secondary">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ───────────────── CTA ───────────────── */}
      <section className="relative py-20 sm:py-28" aria-label="Get started">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div
            ref={useReveal<HTMLDivElement>()}
            className="reveal relative overflow-hidden rounded-3xl border border-theme p-10 sm:p-14"
            style={{
              background:
                "linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(5,150,105,0.08) 40%, transparent 100%)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-[#10b981]/20 blur-3xl"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-32 -left-10 h-72 w-72 rounded-full bg-sky-500/10 blur-3xl"
            />
            <div className="relative">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-theme bg-theme-secondary/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#10b981] backdrop-blur">
                <Users className="h-3 w-3" />
                Join the beta
              </div>
              <h2 className="text-3xl font-bold tracking-tight text-theme-primary sm:text-4xl">
                Ready to keep a{" "}
                <span className="text-gradient-emerald">better record</span> of
                the stories you love?
              </h2>
              <p className="mt-3 max-w-2xl text-base leading-relaxed text-theme-secondary">
                Spin up an account in seconds. Your library, your watchlist, and
                your analytics — all waiting on the other side of a single click.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={user ? "/dashboard" : "/register"}
                  className="group inline-flex items-center justify-center gap-2 rounded-lg bg-[#10b981] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#10b981]/30 transition-all hover:scale-[1.02] hover:bg-[#059669]"
                >
                  {user ? "Open your dashboard" : "Create a free account"}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                {!user && (
                  <Link
                    to="/login"
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-theme bg-theme-secondary px-6 py-3.5 text-sm font-semibold text-theme-primary transition-colors hover:border-[#10b981] hover:text-[#10b981]"
                  >
                    I already have an account
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

/* ─────────────── Hero device mock (CSS only) ─────────────── */

const HeroMock: React.FC = () => {
  return (
    <div className="fade-in-up delay-500 relative mx-auto mt-16 max-w-5xl">
      <div
        className="relative overflow-hidden rounded-2xl border border-theme shadow-2xl"
        style={{
          background: "var(--bg-secondary)",
          boxShadow:
            "0 30px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04), 0 0 80px -20px rgba(16,185,129,0.35)",
        }}
      >
        {/* Window chrome */}
        <div
          className="flex items-center gap-1.5 border-b border-theme px-4 py-2.5"
          style={{ background: "var(--bg-tertiary)" }}
        >
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
          <div className="mx-auto flex items-center gap-2 rounded-md border border-theme bg-theme-secondary px-3 py-1 text-[10px] text-theme-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            intermission.app/dashboard
          </div>
        </div>

        {/* Mock app */}
        <div className="grid grid-cols-12 gap-0">
          {/* Sidebar */}
          <aside
            className="col-span-3 hidden border-r border-theme p-4 md:block"
            style={{ background: "var(--bg-tertiary)" }}
          >
            <div className="mb-6 flex items-center gap-2">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-md"
                style={{
                  background:
                    "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                }}
              >
                <Film className="h-3.5 w-3.5 text-white" />
              </span>
              <span className="text-sm font-semibold text-theme-primary">
                Intermission
              </span>
            </div>
            <ul className="space-y-1.5 text-xs">
              {[
                { label: "Dashboard", Icon: BarChart3, active: true },
                { label: "Search", Icon: Search },
                { label: "Library", Icon: Library },
                { label: "Watchlist", Icon: ListPlus },
                { label: "Settings", Icon: Shield },
              ].map(({ label, Icon, active }) => (
                <li
                  key={label}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5"
                  style={
                    active
                      ? {
                          background: "rgba(16,185,129,0.12)",
                          color: "#10b981",
                          fontWeight: 500,
                        }
                      : { color: "var(--text-secondary)" }
                  }
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </li>
              ))}
            </ul>
          </aside>

          {/* Main */}
          <div className="col-span-12 p-5 md:col-span-9">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-theme-muted">
                  Welcome back
                </p>
                <p className="text-base font-semibold text-theme-primary">
                  Your week in cinema
                </p>
              </div>
              <span
                className="rounded-full border border-theme bg-theme-tertiary px-2.5 py-1 text-[10px] font-medium text-theme-secondary"
              >
                Last 7 days
              </span>
            </div>

            {/* Stat row */}
            <div className="mb-4 grid grid-cols-3 gap-3">
              {[
                { v: "12", l: "Logged" },
                { v: "4.6★", l: "Avg rating" },
                { v: "26h", l: "Watched" },
              ].map((s) => (
                <div
                  key={s.l}
                  className="rounded-lg border border-theme p-3"
                  style={{ background: "var(--bg-tertiary)" }}
                >
                  <div className="text-lg font-bold text-theme-primary">
                    {s.v}
                  </div>
                  <div className="text-[10px] uppercase tracking-wider text-theme-muted">
                    {s.l}
                  </div>
                </div>
              ))}
            </div>

            {/* Faux chart */}
            <div
              className="rounded-lg border border-theme p-4"
              style={{ background: "var(--bg-tertiary)" }}
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-theme-primary">
                  Watch time
                </span>
                <span className="text-[10px] text-theme-muted">Mon → Sun</span>
              </div>
              <div className="flex h-20 items-end gap-1.5">
                {[40, 65, 30, 80, 55, 90, 70].map((h, i) => (
                  <div
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{
                      height: `${h}%`,
                      background:
                        i === 5
                          ? "linear-gradient(to top, #059669, #34d399)"
                          : "rgba(16,185,129,0.25)",
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Faux recent list */}
            <div className="mt-3 space-y-2">
              {[
                { t: "Dune: Part Two", r: "5.0", s: "Completed" },
                { t: "The Bear · S3", r: "4.5", s: "Watching" },
              ].map((row) => (
                <div
                  key={row.t}
                  className="flex items-center justify-between rounded-md border border-theme px-3 py-2 text-xs"
                  style={{ background: "var(--bg-tertiary)" }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="h-6 w-6 rounded"
                      style={{
                        background:
                          "linear-gradient(135deg, #065f46, #10b981 70%)",
                      }}
                    />
                    <span className="font-medium text-theme-primary">
                      {row.t}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-amber-400">★ {row.r}</span>
                    <span
                      className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                      style={{
                        background: "rgba(16,185,129,0.12)",
                        color: "#10b981",
                      }}
                    >
                      {row.s}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Glow behind */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-10 -bottom-8 h-16 rounded-full bg-[#10b981]/30 blur-2xl"
      />
    </div>
  );
};

/* ─────────────── Analytics preview mock ─────────────── */

const AnalyticsMock: React.FC = () => {
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-theme p-6 shadow-2xl"
      style={{
        background:
          "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)",
        boxShadow: "0 30px 60px -30px rgba(0,0,0,0.5)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#10b981]/20 blur-3xl"
      />
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-theme-primary">
          Top genres
        </p>
        <span className="text-[10px] uppercase tracking-wider text-theme-muted">
          This year
        </span>
      </div>
      <div className="space-y-2.5">
        {[
          { g: "Drama", v: 92 },
          { g: "Sci-Fi", v: 76 },
          { g: "Thriller", v: 58 },
          { g: "Documentary", v: 44 },
          { g: "Animation", v: 36 },
        ].map((row, i) => (
          <div key={row.g}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-theme-primary">{row.g}</span>
              <span className="text-theme-muted">{row.v}%</span>
            </div>
            <div
              className="h-2 overflow-hidden rounded-full"
              style={{ background: "var(--bg-primary)" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.v}%`,
                  background:
                    i === 0
                      ? "linear-gradient(to right, #059669, #34d399)"
                      : "linear-gradient(to right, rgba(16,185,129,0.4), rgba(16,185,129,0.7))",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-theme pt-5 text-center">
        {[
          { v: "184", l: "Titles" },
          { v: "412h", l: "Watched" },
          { v: "4.3★", l: "Average" },
        ].map((s) => (
          <div key={s.l}>
            <div className="text-lg font-bold text-theme-primary">{s.v}</div>
            <div className="text-[10px] uppercase tracking-wider text-theme-muted">
              {s.l}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
