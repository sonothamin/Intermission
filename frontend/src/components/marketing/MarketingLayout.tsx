import React from "react";
import { Outlet, useLocation } from "react-router-dom";
import { MarketingNav } from "./MarketingNav";
import { MarketingFooter } from "./MarketingFooter";

/**
 * Layout shell for the public marketing site and doc pages.
 *
 * - Centered max-width container, dark-aware gradient background.
 * - On the landing page (`/`) we scroll the page back to the top whenever the
 *   hash changes so anchor links don't land at the bottom of the previous
 *   section.
 */
export const MarketingLayout: React.FC = () => {
  const location = useLocation();

  React.useEffect(() => {
    // For hash links on the landing page, let the browser smooth-scroll.
    if (location.pathname === "/" && location.hash) {
      const id = location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        // Slight delay to let route transition settle.
        requestAnimationFrame(() => {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    } else {
      window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
    }
  }, [location.pathname, location.hash]);

  return (
    <div
      className="relative flex min-h-screen flex-col"
      style={{
        background:
          "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(16,185,129,0.15), transparent 60%), var(--bg-primary)",
        color: "var(--text-primary)",
      }}
    >
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-[#10b981] focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        Skip to content
      </a>
      <MarketingNav />
      <main id="main" className="flex-1">
        <Outlet />
      </main>
      <MarketingFooter />
    </div>
  );
};
