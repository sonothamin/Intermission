import React from "react";
import { ErrorPage } from "../../components/ErrorPage";

/**
 * 500 — generic server-side failure.
 *
 * Quote: "I'm as mad as hell, and I'm not going to take this anymore!"
 *        — Howard Beale in Network (1976).
 *
 * Network is the most-quoted "system failure" film ever made.
 */
export const ServerError: React.FC = () => (
  <ErrorPage
    code={500}
    title="I'm as mad as hell, and I'm not going to take this anymore."
    description="Something on our end just broke. The team has already been paged — give it a minute, then try again. If it keeps happening, copy the reference code below and send it our way."
    quote="I'm as mad as hell, and I'm not going to take this anymore!"
    attribution="Network (1976) · Howard Beale"
    accent="red"
  />
);
