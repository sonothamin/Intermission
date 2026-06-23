import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useRouteError } from "react-router-dom";
import {
  Film,
  Home,
  ArrowLeft,
  Search as SearchIcon,
  RefreshCcw,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";

/**
 * Canonical shape for a status-keyed error page.
 * Each `pages/errors/<Code>.tsx` thin wrapper passes one of these.
 */
export interface ErrorPageProps {
  /** HTTP status code shown as the giant headline (e.g. 404). */
  code: number;
  /** Short, scannable headline for the page. */
  title: string;
  /** One or two sentences of plain-language context. */
  description: string;
  /** A famous movie quote that frames the error with personality. */
  quote: string;
  /** Attribution for the quote (movie, year, character). */
  attribution: string;
  /** Accent hue for the status pill + glow. Defaults to emerald. */
  accent?: "emerald" | "amber" | "red" | "blue" | "violet";
  /** Optional override of the primary CTA destination. */
  primaryHref?: string;
  /** Label for the primary CTA. Defaults to "Back to dashboard". */
  primaryLabel?: string;
}

/** Status pill + glow colour palettes, themed for each error family. */
const ACCENTS: Record<NonNullable<ErrorPageProps["accent"]>, {
  pillBg: string;
  pillText: string;
  pillBorder: string;
  glow: string;
  ring: string;
  codeGradient: string;
}> = {
  emerald: {
    pillBg: "rgba(16, 185, 129, 0.10)",
    pillText: "#34d399",
    pillBorder: "rgba(16, 185, 129, 0.30)",
    glow: "rgba(16, 185, 129, 0.30)",
    ring: "rgba(16, 185, 129, 0.45)",
    codeGradient: "linear-gradient(120deg, #34d399 0%, #10b981 50%, #059669 100%)",
  },
  amber: {
    pillBg: "rgba(245, 158, 11, 0.10)",
    pillText: "#fbbf24",
    pillBorder: "rgba(245, 158, 11, 0.30)",
    glow: "rgba(245, 158, 11, 0.25)",
    ring: "rgba(245, 158, 11, 0.45)",
    codeGradient: "linear-gradient(120deg, #fde68a 0%, #f59e0b 50%, #b45309 100%)",
  },
  red: {
    pillBg: "rgba(239, 68, 68, 0.10)",
    pillText: "#fca5a5",
    pillBorder: "rgba(239, 68, 68, 0.30)",
    glow: "rgba(239, 68, 68, 0.30)",
    ring: "rgba(239, 68, 68, 0.45)",
    codeGradient: "linear-gradient(120deg, #fecaca 0%, #ef4444 50%, #991b1b 100%)",
  },
  blue: {
    pillBg: "rgba(59, 130, 246, 0.10)",
    pillText: "#93c5fd",
    pillBorder: "rgba(59, 130, 246, 0.30)",
    glow: "rgba(59, 130, 246, 0.25)",
    ring: "rgba(59, 130, 246, 0.45)",
    codeGradient: "linear-gradient(120deg, #bfdbfe 0%, #3b82f6 50%, #1d4ed8 100%)",
  },
  violet: {
    pillBg: "rgba(168, 85, 247, 0.10)",
    pillText: "#d8b4fe",
    pillBorder: "rgba(168, 85, 247, 0.30)",
    glow: "rgba(168, 85, 247, 0.30)",
    ring: "rgba(168, 85, 247, 0.45)",
    codeGradient: "linear-gradient(120deg, #e9d5ff 0%, #a855f7 50%, #6b21a8 100%)",
  },
};

/**
 * Shared layout for all status-keyed error pages.
 *
 * Design intent:
 * - Full-bleed dark backdrop with a faint film-strip grid so the page
 *   still feels like the rest of the app even though there's no shell.
 * - Big translucent status code with a per-status gradient and a
 *   pulsing halo, so the failure is unmistakable.
 * - A single, famous movie quote framed as a "pull-quote" card to
 *   give each error a distinct voice and a tiny bit of joy.
 * - Theme-aware: respects the existing CSS variables for dark/light.
 * - Accessible: one H1, role="status" on the live region, a skip link,
 *   focus-visible rings, and reduced-motion guards.
 */
export const ErrorPage: React.FC<ErrorPageProps> = (props) => {
  const {
    code,
    title,
    description,
    quote,
    attribution,
    // Default CTA lands on the public marketing site so signed-out visitors
    // don't get bounced through /login. Each status can override.
    primaryHref = "/",
    primaryLabel = "Back home",
  } = props;
  // Default the accent here so downstream children see a narrowed,
  // non-undefined value.
  const accent: NonNullable<ErrorPageProps["accent"]> = props.accent ?? "emerald";
  const navigate = useNavigate();
  const palette = ACCENTS[accent];

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex flex-col"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16,185,129,0.15), transparent 60%), var(--bg-primary)",
        color: "var(--text-primary)",
      }}
      role="status"
      aria-live="polite"
    >
      {/* Skip link for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
        style={{ background: "var(--accent-primary)" }}
      >
        Skip to content
      </a>

      {/* Ambient background grid + blurred blobs (reuse existing utilities) */}
      <div className="pointer-events-none absolute inset-0 hero-grid opacity-60" />
      <div
        className="pointer-events-none absolute -top-32 -left-32 w-[28rem] h-[28rem] rounded-full hero-blob"
        style={{ background: palette.glow, opacity: 0.35 }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-32 w-[32rem] h-[32rem] rounded-full hero-blob"
        style={{
          background: palette.glow,
          opacity: 0.25,
          animationDelay: "-6s",
        }}
      />

      {/* Top bar: brand + theme indicator (read-only on this surface) */}
      <header className="relative z-10 flex items-center justify-between px-4 sm:px-8 py-5">
        <Link
          to="/"
          className="flex items-center gap-2.5 group"
          aria-label="Intermission home"
        >
          <span
            className="p-1.5 rounded-lg border shell-glass"
            aria-hidden="true"
          >
            <Film className="w-5 h-5 text-[#10b981] transition-transform duration-300 group-hover:rotate-12" />
          </span>
          <span className="font-bold text-lg tracking-tight">Intermission</span>
        </Link>
        <span
          className="hidden sm:inline-flex items-center gap-2 text-xs font-medium tracking-widest uppercase"
          style={{ color: "var(--text-muted)" }}
        >
          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          Status {code}
        </span>
      </header>

      {/* Main content */}
      <main
        id="main"
        className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12"
      >
        <div className="w-full max-w-3xl">
          <ErrorCard
            code={code}
            title={title}
            description={description}
            quote={quote}
            attribution={attribution}
            palette={palette}
            accent={accent}
            primaryHref={primaryHref}
            primaryLabel={primaryLabel}
            onBack={() => navigate(-1)}
          />
        </div>
      </main>

      {/* Footer line */}
      <footer
        className="relative z-10 px-4 sm:px-8 py-5 text-center text-xs"
        style={{ color: "var(--text-muted)" }}
      >
        <p>
          Lights, camera… a 404. Need help?{" "}
          <Link
            to="/docs/privacy-policy"
            className="underline underline-offset-2 hover:no-underline"
            style={{ color: "var(--accent-primary)" }}
          >
            Visit the docs
          </Link>
          .
        </p>
      </footer>
    </div>
  );
};

interface ErrorCardProps extends Omit<ErrorPageProps, "accent" | "primaryHref" | "primaryLabel"> {
  palette: (typeof ACCENTS)[keyof typeof ACCENTS];
  accent: NonNullable<ErrorPageProps["accent"]>;
  primaryHref: string;
  primaryLabel: string;
  onBack: () => void;
}

const ErrorCard: React.FC<ErrorCardProps> = ({
  code,
  title,
  description,
  quote,
  attribution,
  palette,
  accent,
  primaryHref,
  primaryLabel,
  onBack,
}) => {
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, []);

  // Build a tiny "request id" string the user can quote to support. This is
  // intentionally client-generated; it gives the user something concrete to
  // share without exposing any server internals.
  const requestId = React.useMemo(() => {
    const seed = `${code}-${Date.now().toString(36)}`;
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return `req_${(h >>> 0).toString(16).padStart(8, "0")}`;
  }, [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(
        `Intermission ${code} — ${title}\nReference: ${requestId}\n${window.location.href}`,
      );
      setCopied(true);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard may be unavailable — silently ignore */
    }
  };

  const handleReload = () => {
    window.location.reload();
  };

  return (
    <article
      className="relative shell-glass rounded-2xl border overflow-hidden fade-in-up"
      style={{
        background:
          "linear-gradient(to bottom, var(--bg-secondary), color-mix(in srgb, var(--bg-secondary) 92%, transparent))",
      }}
    >
      {/* Top status bar */}
      <div
        className="flex items-center justify-between px-5 sm:px-8 py-3 text-xs"
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          color: "var(--text-muted)",
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-semibold uppercase tracking-wider text-[10px]"
            style={{
              background: palette.pillBg,
              color: palette.pillText,
              border: `1px solid ${palette.pillBorder}`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: palette.pillText }}
              aria-hidden="true"
            />
            {accentLabel(accent)}
          </span>
          <span className="hidden sm:inline">HTTP {code}</span>
        </div>
        <span className="font-mono tracking-wider" aria-label="Request reference">
          {requestId}
        </span>
      </div>

      <div className="px-5 sm:px-10 py-8 sm:py-12 text-center">
        {/* Giant status code with a pulsing halo */}
        <div className="relative inline-block">
          <div
            className="absolute inset-0 -m-6 rounded-full pulse-ring"
            style={{ background: palette.ring, opacity: 0.5 }}
            aria-hidden="true"
          />
          <h1
            className="relative font-extrabold tracking-tighter leading-none select-none"
            style={{
              fontSize: "clamp(5rem, 16vw, 9rem)",
              backgroundImage: palette.codeGradient,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
              textShadow: "0 0 40px rgba(0,0,0,0)",
            }}
            aria-label={`Error ${code}`}
          >
            {code}
          </h1>
        </div>

        <h2
          className="mt-4 text-2xl sm:text-3xl font-bold tracking-tight"
          style={{ color: "var(--text-primary)" }}
        >
          {title}
        </h2>
        <p
          className="mt-3 text-sm sm:text-base max-w-xl mx-auto leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          {description}
        </p>

        {/* Pull-quote card */}
        <figure
          className="mt-8 mx-auto max-w-xl rounded-xl border p-5 sm:p-6 text-left"
          style={{
            background: "var(--bg-tertiary)",
            borderColor: "var(--border-subtle)",
          }}
        >
          <span
            className="block text-4xl leading-none mb-2 select-none"
            style={{ color: palette.pillText }}
            aria-hidden="true"
          >
            &ldquo;
          </span>
          <blockquote
            className="text-base sm:text-lg font-medium italic leading-relaxed"
            style={{ color: "var(--text-primary)" }}
          >
            {quote}
          </blockquote>
          <figcaption
            className="mt-3 text-xs font-semibold uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            — {attribution}
          </figcaption>
        </figure>

        {/* CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to={primaryHref}
            className="btn-primary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            {primaryLabel}
          </Link>
          <Link
            to="/dashboard/search"
            className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <SearchIcon className="w-4 h-4" aria-hidden="true" />
            Search
          </Link>
          <button
            type="button"
            onClick={onBack}
            className="btn-secondary inline-flex items-center gap-2 px-5 py-2.5 text-sm"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Go back
          </button>
        </div>

        {/* Secondary actions: reload + copy reference */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
          <button
            type="button"
            onClick={handleReload}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors"
            style={{
              color: "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--text-primary)";
              e.currentTarget.style.borderColor = "var(--border-focus)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text-muted)";
              e.currentTarget.style.borderColor = "var(--border-subtle)";
            }}
          >
            <RefreshCcw className="w-3.5 h-3.5" aria-hidden="true" />
            Retry
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 transition-colors"
            style={{
              color: copied ? "var(--accent-primary)" : "var(--text-muted)",
              border: "1px solid var(--border-subtle)",
            }}
            onMouseEnter={(e) => {
              if (!copied) {
                e.currentTarget.style.color = "var(--text-primary)";
                e.currentTarget.style.borderColor = "var(--border-focus)";
              }
            }}
            onMouseLeave={(e) => {
              if (!copied) {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.borderColor = "var(--border-subtle)";
              }
            }}
            aria-live="polite"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            )}
            {copied ? "Copied" : "Copy reference"}
          </button>
        </div>
      </div>
    </article>
  );
};

/** Human-readable label for each status family. */
function accentLabel(accent: NonNullable<ErrorPageProps["accent"]>): string {
  switch (accent) {
    case "emerald":
      return "Client";
    case "amber":
      return "Request";
    case "red":
      return "Server";
    case "blue":
      return "Auth";
    case "violet":
      return "Gateway";
  }
}

/**
 * Generic catch-all used by the React Router `*` route. Surfaces a real
 * error message (if any) so the user understands why they landed here.
 */
export const GenericErrorPage: React.FC = () => {
  // useRouteError returns `unknown`; narrow defensively.
  const err = useRouteError() as
    | { status?: number; statusText?: string; message?: string }
    | undefined;

  const status =
    typeof err?.status === "number" && err.status >= 400 && err.status < 600
      ? err.status
      : 404;
  const title =
    err?.statusText ||
    (status === 404
      ? "This scene was cut from the final reel."
      : "Something broke the fourth wall.");
  const description =
    err?.message ||
    "The page you tried to open doesn't exist, or the server tripped over its own cables. Try heading back to a known good take.";

  return (
    <ErrorPage
      code={status}
      title={title}
      description={description}
      quote="I'll be back."
      attribution="The Terminator (1984) · The Terminator"
      accent={status >= 500 ? "red" : "emerald"}
    />
  );
};
