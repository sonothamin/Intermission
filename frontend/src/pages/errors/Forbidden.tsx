import React from "react";
import { ErrorPage } from "../../components/ErrorPage";

/**
 * 403 — the user is signed in but isn't allowed to see this resource.
 *
 * Quote: "You shall not pass!" — Gandalf in The Lord of the Rings:
 *        The Fellowship of the Ring (2001).
 *
 * The most literal "denied" line in cinema history.
 */
export const Forbidden: React.FC = () => (
  <ErrorPage
    code={403}
    title="You shall not pass."
    description="You're signed in, but this corner of the cinema is off-limits. If you think this is a mistake, ask the owner of this resource to share it, or head back to your own library."
    quote="You shall not pass!"
    attribution="The Lord of the Rings: The Fellowship of the Ring (2001) · Gandalf"
    accent="amber"
    primaryHref="/dashboard/library"
    primaryLabel="Back to your library"
  />
);
