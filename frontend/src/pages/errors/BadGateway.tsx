import React from "react";
import { ErrorPage } from "../../components/ErrorPage";

/**
 * 502 — bad gateway, usually an upstream service is down.
 *
 * Quote: "Roads? Where we're going, we don't need roads."
 *        — Doc Brown in Back to the Future (1985).
 *
 * The gateway can't reach the destination — Doc Brown vibes apply.
 */
export const BadGateway: React.FC = () => (
  <ErrorPage
    code={502}
    title="Roads? Where we're going, we don't need roads."
    description="Our gateway just lost contact with an upstream service. The projectionist is rebooting the projector — please refresh in a moment."
    quote="Roads? Where we're going, we don't need roads."
    attribution="Back to the Future (1985) · Doc Brown"
    accent="violet"
  />
);
