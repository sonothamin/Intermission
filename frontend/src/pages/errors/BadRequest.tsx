import React from "react";
import { ErrorPage } from "../../components/ErrorPage";

/**
 * 400 — the request itself was malformed.
 *
 * Quote: "Houston, we have a problem." — Apollo 13 (1995).
 *
 * Apollo 13 is the canonical "we sent something up and it didn't quite
 * work" movie moment.
 */
export const BadRequest: React.FC = () => (
  <ErrorPage
    code={400}
    title="Houston, we have a problem."
    description="The request didn't quite make sense to our servers — some required information was missing or in the wrong shape. Go back, check your input, and try again."
    quote="Houston, we have a problem."
    attribution="Apollo 13 (1995) · Jim Lovell"
    accent="amber"
  />
);
