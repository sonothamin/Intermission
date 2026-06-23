import React from "react";
import { ErrorPage } from "../../components/ErrorPage";

/**
 * 404 — the URL doesn't resolve to anything in the router.
 *
 * Quote: "The greatest trick the Devil ever pulled was convincing the world
 *        he didn't exist." — Verbal Kint in The Usual Suspects (1995).
 *
 * It captures the essence of 404: something isn't there, and the only one
 * who knows it is you.
 */
export const NotFound: React.FC = () => (
  <ErrorPage
    code={404}
    title="This scene was cut from the final reel."
    description="The page you're looking for has wandered off set. The URL might be mistyped, the link could be stale, or the scene was never shot. Try the dashboard, or search for what you were after."
    quote="The greatest trick the Devil ever pulled was convincing the world he didn't exist."
    attribution="The Usual Suspects (1995) · Verbal Kint"
    accent="emerald"
  />
);
