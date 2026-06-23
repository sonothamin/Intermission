import React from "react";
import { ErrorPage } from "../../components/ErrorPage";

/**
 * 503 — service unavailable (maintenance, overload).
 *
 * Quote: "After a while, you learn to ignore the names people call you and
 *        just trust who you are." — Hiccup, How to Train Your Dragon (2010).
 *
 * A short, calm "we're briefly away" line — perfect for a 503.
 */
export const ServiceUnavailable: React.FC = () => (
  <ErrorPage
    code={503}
    title="We'll be right back after these messages."
    description="Intermission is briefly offline for scheduled maintenance, or under unusually heavy traffic. Please try again in a minute — your data is safe and sound."
    quote="After a while, you learn to ignore the names people call you and just trust who you are."
    attribution="How to Train Your Dragon (2010) · Hiccup"
    accent="violet"
  />
);
