import React, { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Film, Menu, X, Sparkles } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ThemeSwitcher } from "../ThemeSwitcher";
import { useTheme } from "../../context/ThemeContext";

interface NavItem {
  label: string;
  to: string;
}

const PRIMARY_LINKS: NavItem[] = [
  { label: "Features", to: "/#features" },
  { label: "How it works", to: "/#how" },
  { label: "FAQ", to: "/#faq" },
  { label: "Docs", to: "/docs/privacy-policy" },
];

/**
 * Top navigation used on the public marketing site.
 *
 * - Sticky, frosted-glass header that lifts its background opacity on scroll.
 * - Renders a desktop inline nav, a mobile slide-down sheet, and exposes the
 *   theme switcher + a contextual auth CTA ("Open dashboard" when signed in,
 *   "Sign in" otherwise).
 * - Hash-anchor links (/#features) work on the landing page and gracefully
 *   become in-page scroll triggers when the user is already on `/`.
 */
export const MarketingNav: React.FC = () => {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close the mobile sheet on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname, location.hash]);

  // Click-outside to close the mobile sheet.
  useEffect(() => {
    if (!mobileOpen) return;
    const onDown = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [mobileOpen]);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-colors duration-300 ${
        scrolled ? "shell-glass" : "bg-transparent"
      }`}
      style={
        scrolled
          ? { borderBottomWidth: "1px", borderBottomStyle: "solid" }
          : { borderBottomWidth: "0px" }
      }
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="group flex items-center gap-2.5"
          aria-label="Intermission home"
        >
          <span
            className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl shadow-lg transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105"
            style={{
              background:
                "linear-gradient(135deg, #10b981 0%, #059669 60%, #065f46 100%)",
              boxShadow:
                "0 8px 24px -8px rgba(16,185,129,0.6), inset 0 0 0 1px rgba(255,255,255,0.08)",
            }}
          >
            <Film className="h-5 w-5 text-white" />
            <span
              aria-hidden
              className="absolute -inset-px rounded-xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.15), transparent 60%)",
              }}
            />
          </span>
          <span className="text-lg font-bold tracking-tight text-theme-primary">
            Intermission
          </span>
        </Link>

        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Primary"
        >
          {PRIMARY_LINKS.map((item) => {
            const isHash = item.to.includes("#");
            const isDocs = item.to.startsWith("/docs");
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? "text-[#10b981]"
                      : "text-theme-secondary hover:text-theme-primary"
                  }`
                }
                end={isHash}
              >
                {item.label}
                {isDocs && (
                  <span className="ml-1.5 inline-flex items-center rounded-full border border-theme px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-theme-muted">
                    Docs
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeSwitcher collapsed />
          {user ? (
            <Link
              to="/dashboard"
              className="btn-primary inline-flex items-center gap-2 text-sm"
            >
              <Sparkles className="h-4 w-4" />
              Open dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-md px-3 py-2 text-sm font-medium text-theme-secondary transition-colors hover:text-theme-primary"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="btn-primary inline-flex items-center gap-2 text-sm"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-theme text-theme-primary transition-colors hover:bg-theme-secondary md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
        </button>
      </div>

      {/* Mobile sheet */}
      <div
        ref={sheetRef}
        className={`md:hidden overflow-hidden border-t border-theme transition-all duration-300 ${
          mobileOpen ? "max-h-[480px] opacity-100" : "max-h-0 opacity-0"
        }`}
        style={{ background: "var(--bg-primary)" }}
      >
        <div className="space-y-1 px-4 py-3">
          {PRIMARY_LINKS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-[var(--accent-light)] text-[#10b981]"
                    : "text-theme-secondary hover:bg-theme-secondary hover:text-theme-primary"
                }`
              }
              onClick={() => setMobileOpen(false)}
              end={item.to.includes("#")}
            >
              {item.label}
            </NavLink>
          ))}
        </div>
        <div
          className="px-4 py-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-theme-muted">
            Theme
          </p>
          <div
            className="flex rounded-md p-0.5"
            style={{
              background: "var(--bg-secondary)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            {(
              [
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ] as { value: "light" | "dark" | "system"; label: string }[]
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className="flex-1 rounded py-1.5 text-xs font-medium transition-colors"
                style={{
                  color:
                    theme === value
                      ? "var(--accent-primary)"
                      : "var(--text-secondary)",
                  background:
                    theme === value ? "var(--accent-light)" : "transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div
          className="space-y-2 px-4 py-3"
          style={{ borderTop: "1px solid var(--border-subtle)" }}
        >
          {user ? (
            <Link
              to="/dashboard"
              className="btn-primary flex w-full items-center justify-center gap-2 text-sm"
            >
              <Sparkles className="h-4 w-4" />
              Open dashboard
            </Link>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className="rounded-md border border-theme bg-theme-secondary px-3 py-2.5 text-center text-sm font-medium text-theme-primary transition-colors hover:bg-theme-tertiary"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="btn-primary inline-flex items-center justify-center px-3 py-2.5 text-sm"
              >
                Get started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
