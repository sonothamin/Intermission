import React from "react";

const LAST_UPDATED = "June 21, 2026";

/**
 * Privacy policy content. Renders inside <DocsLayout /> via React Router's
 * nested `<Outlet />`. Uses the `prose-doc` class for typographic rhythm.
 */
const PrivacyPolicy: React.FC = () => {
  return (
    <div className="prose-doc">
      <h1>Privacy policy</h1>
      <p className="text-sm text-theme-muted">Last updated · {LAST_UPDATED}</p>

      <p>
        Intermission is a personal film and series tracker. This policy
        explains what data we collect, why we collect it, and the choices
        you have. We've kept the wording plain on purpose — there should be
        nothing hidden in the footnotes.
      </p>

      <h2 id="information">1. Information we collect</h2>
      <p>We collect only what we need to run the service:</p>
      <ul>
        <li>
          <strong>Account data.</strong> Your email address, display name,
          avatar URL (if you sign in with Google), and the hashed password
          you set if you sign up with email.
        </li>
        <li>
          <strong>Library data.</strong> The titles you mark as watched or
          add to your watchlist, your ratings, notes, and watched dates.
        </li>
        <li>
          <strong>Usage data.</strong> Aggregate counts of requests and
          errors, used to keep the service fast and reliable. We never sell
          this data.
        </li>
      </ul>

      <h2 id="usage">2. How we use your information</h2>
      <p>We use the data above to:</p>
      <ul>
        <li>Sign you in and keep your library in sync across devices.</li>
        <li>
          Generate the analytics, charts, and "Continue watching" views
          inside the app.
        </li>
        <li>
          Look up titles and artwork through our search provider
          (TMDB — see "Third parties" below).
        </li>
        <li>
          Detect abuse, debug failures, and protect the service against
          spam or scraping.
        </li>
      </ul>
      <p>
        We will never use your library data for advertising, and we will
        never sell or rent your information to third parties.
      </p>

      <h2 id="third-parties">3. Third-party services</h2>
      <p>
        A small number of trusted services process data on our behalf. Each
        is contractually required to protect it:
      </p>
      <ul>
        <li>
          <strong>Supabase</strong> — auth, database, and edge functions.
        </li>
        <li>
          <strong>TMDB</strong> — title metadata and artwork for search and
          detail views. When you search or open a title, we send the query
          to TMDB; TMDB's own privacy policy applies to that request.
        </li>
        <li>
          <strong>Vercel</strong> — hosts the front end and edge logs.
        </li>
      </ul>

      <h2 id="cookies">4. Cookies and local storage</h2>
      <p>
        We use first-party cookies and <code>localStorage</code> only for
        your session, theme preference, and to remember which titles you've
        already seen. No third-party advertising cookies are set, ever.
      </p>

      <h2 id="rights">5. Your rights</h2>
      <p>You can at any time:</p>
      <ul>
        <li>Export your library (Settings → Export).</li>
        <li>Update your account details (Settings → Profile).</li>
        <li>
          Delete your account and all associated data by emailing
          <a href="mailto:privacy@intermission.app"> privacy@intermission.app</a>
          {" "}from the address you signed up with. Deletions complete within
          14 days.
        </li>
      </ul>

      <h2 id="security">6. How we protect your data</h2>
      <p>
        All traffic is served over HTTPS. Access to the production database
        is limited to a small number of maintainers via short-lived
        credentials. Passwords are hashed using a modern algorithm; we
        never store them in plain text.
      </p>

      <h2 id="children">7. Children</h2>
      <p>
        Intermission is not directed at children under 13, and we do not
        knowingly collect data from them. If you believe a child has
        created an account, contact us and we'll remove it.
      </p>

      <h2 id="changes">8. Changes to this policy</h2>
      <p>
        If we make material changes, we'll bump the date at the top and
        surface a banner inside the app. Minor edits (typos, clarifications)
        may happen silently.
      </p>

      <h2 id="contact">9. Contact</h2>
      <p>
        Questions, complaints, or data requests — email
        <a href="mailto:privacy@intermission.app"> privacy@intermission.app</a>.
        We aim to reply within five business days.
      </p>
    </div>
  );
};

export default PrivacyPolicy;