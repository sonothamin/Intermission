import React from "react";
import { Link } from "react-router-dom";
import { Film, Globe, Mail, Heart } from "lucide-react";

const PRODUCT = [
  { label: "Features", to: "/#features" },
  { label: "How it works", to: "/#how" },
  { label: "Dashboard", to: "/dashboard" },
  { label: "Sign in", to: "/login" },
];

const RESOURCES = [
  { label: "Privacy policy", to: "/docs/privacy-policy" },
  { label: "Terms of service", to: "/docs/terms-of-service" },
  { label: "TMDB", to: "https://www.themoviedb.org/", external: true },
];

const PRODUCT_GRID = [
  { label: "Search", to: "/search" },
  { label: "Library", to: "/library" },
  { label: "Watchlist", to: "/watchlist" },
];

/**
 * Footer for the public marketing site and doc pages.
 * Three columns: brand + tagline, product links, legal/resources.
 * Subtle gradient divider to keep it feeling like part of the hero
 * without competing with the content above.
 */
export const MarketingFooter: React.FC = () => {
  const year = new Date().getFullYear();
  return (
    <footer
      className="relative mt-24"
      style={{
        background:
          "linear-gradient(to top, var(--bg-secondary) 0%, transparent 100%)",
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-px h-px"
        style={{
          background:
            "linear-gradient(to right, transparent, rgba(16,185,129,0.5), transparent)",
        }}
      />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-4 lg:gap-8 lg:px-8">
        <div className="space-y-4">
          <Link to="/" className="inline-flex items-center gap-2.5">
            <span
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl"
              style={{
                background:
                  "linear-gradient(135deg, #10b981 0%, #059669 60%, #065f46 100%)",
                boxShadow:
                  "0 8px 24px -8px rgba(16,185,129,0.5), inset 0 0 0 1px rgba(255,255,255,0.08)",
              }}
            >
              <Film className="h-5 w-5 text-white" />
            </span>
            <span className="text-lg font-bold tracking-tight text-theme-primary">
              Intermission
            </span>
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-theme-secondary">
            A focused place to track every film and series you watch, with
            analytics that help you rediscover your taste.
          </p>
          <div className="flex items-center gap-2">
            <a
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-theme text-theme-secondary transition-all hover:-translate-y-0.5 hover:border-[#10b981] hover:text-[#10b981]"
              aria-label="Website"
            >
              <Globe className="h-4 w-4" />
            </a>
            <a
              href="mailto:hello@intermission.app"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-theme text-theme-secondary transition-all hover:-translate-y-0.5 hover:border-[#10b981] hover:text-[#10b981]"
              aria-label="Email us"
            >
              <Mail className="h-4 w-4" />
            </a>
          </div>
        </div>

        <FooterColumn title="Product" links={PRODUCT} />
        <FooterColumn title="In the app" links={PRODUCT_GRID} />
        <FooterColumn title="Resources" links={RESOURCES} />
      </div>

      <div
        className="border-t border-theme"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-theme-muted sm:flex-row sm:px-6 lg:px-8">
          <p>© {year} Intermission. All rights reserved.</p>
          <p className="inline-flex items-center gap-1.5">
            Built with <Heart className="h-3.5 w-3.5 text-rose-400" /> for people
            who love stories.
          </p>
        </div>
      </div>
    </footer>
  );
};

const FooterColumn: React.FC<{
  title: string;
  links: { label: string; to: string; external?: boolean }[];
}> = ({ title, links }) => (
  <div>
    <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-theme-muted">
      {title}
    </h3>
    <ul className="space-y-2.5">
      {links.map((l) => (
        <li key={l.label}>
          {l.external ? (
            <a
              href={l.to}
              target="_blank"
              rel="noreferrer noopener"
              className="text-sm text-theme-secondary transition-colors hover:text-[#10b981]"
            >
              {l.label}
            </a>
          ) : (
            <Link
              to={l.to}
              className="text-sm text-theme-secondary transition-colors hover:text-[#10b981]"
            >
              {l.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  </div>
);
