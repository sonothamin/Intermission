import React from "react";
import { ErrorPage } from "../../components/ErrorPage";

/**
 * 401 — the user is not signed in (or their session expired).
 *
 * Quote: "Mama always said life was like a box of chocolates. You never know
 *        what you're gonna get." — Forrest Gump (1994).
 *
 * We don't know the user yet — we just know they showed up unannounced.
 */
export const Unauthorized: React.FC = () => (
  <ErrorPage
    code={401}
    title="You can't handle the truth!"
    description="We need to know who's watching before we can roll the tape. Sign in to continue, or create an account in under a minute."
    quote="Mama always said life was like a box of chocolates. You never know what you're gonna get."
    attribution="Forrest Gump (1994) · Forrest Gump"
    accent="blue"
    primaryHref="/login"
    primaryLabel="Sign in"
  />
);
