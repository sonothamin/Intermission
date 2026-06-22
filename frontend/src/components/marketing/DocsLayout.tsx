import React from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { ArrowLeft, ShieldCheck, ScrollText } from "lucide-react";

/**
 * Layout shell for legal / docs pages.
 *
 * - Sticky in-page sidebar with the two legal anchors (Privacy, Terms).
 * - Top bar with a "back home" link and the doc icon/eyebrow.
 * - Each doc page is responsible only for its prose body — the doc is
 *   titled via the `useDocMeta` helper (see `useDocTitle.tsx`) which sets
 *   the browser tab and the hero header inside the article card.
 */
export const DocsLayout: React.FC = () => {
  const location = useLocation();
  const isPrivacy = location.pathname.startsWith("/docs/privacy-policy");

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
      <Link
        to="/"
        className="mb-8 inline-flex items-center gap-2 text-sm font-medium text-theme-secondary transition-colors hover:text-[#10b981]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back home
      </Link>

      <div className="grid gap-10 lg:grid-cols-[16rem_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div
            className="rounded-2xl border border-theme bg-theme-secondary p-3"
            style={{ boxShadow: "0 12px 30px -20px rgba(0,0,0,0.4)" }}
          >
            <p className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-theme-muted">
              Legal
            </p>
            <nav className="space-y-1" aria-label="Documentation">
              <DocNavLink
                to="/docs/privacy-policy"
                label="Privacy policy"
                Icon={ShieldCheck}
              />
              <DocNavLink
                to="/docs/terms-of-service"
                label="Terms of service"
                Icon={ScrollText}
              />
            </nav>
          </div>

          <p className="mt-5 px-1 text-xs text-theme-muted">
            Questions about these documents? Reach out via the in-app feedback
            channel — we read everything.
          </p>
        </aside>

        <article
          className="relative overflow-hidden rounded-3xl border border-theme bg-theme-secondary p-6 sm:p-10"
          style={{
            background:
              "linear-gradient(180deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%)",
            boxShadow: "0 20px 50px -25px rgba(0,0,0,0.5)",
          }}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#10b981]/10 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -left-32 bottom-0 h-48 w-48 rounded-full bg-sky-500/10 blur-3xl"
          />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-theme bg-theme-tertiary px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#10b981]">
              {isPrivacy ? (
                <ShieldCheck className="h-3 w-3" />
              ) : (
                <ScrollText className="h-3 w-3" />
              )}
              {isPrivacy ? "Privacy" : "Terms"}
            </div>
            {/* Doc pages render their full content (title + body) here. */}
            <DocContent />
          </div>
        </article>
      </div>
    </div>
  );
};

/**
 * Local render-prop outlet wrapper. We import Outlet lazily so the
 * children can decide whether to render the title block or just prose.
 */
import { Outlet } from "react-router-dom";
const DocContent: React.FC = () => <Outlet />;

const DocNavLink: React.FC<{
  to: string;
  label: string;
  Icon: React.ElementType;
}> = ({ to, label, Icon }) => (
  <NavLink
    to={to}
    end
    className={({ isActive }) =>
      `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
        isActive
          ? "bg-[var(--accent-light)] text-[#10b981]"
          : "text-theme-secondary hover:bg-theme-tertiary hover:text-theme-primary"
      }`
    }
  >
    <Icon className="h-4 w-4" />
    {label}
  </NavLink>
);