import React from "react";

const LAST_UPDATED = "June 21, 2026";

/**
 * Terms of service content. Renders inside <DocsLayout /> via React Router's
 * nested `<Outlet />`.
 */
const TermsOfService: React.FC = () => {
  return (
    <div className="prose-doc">
      <h1>Terms of service</h1>
      <p className="text-sm text-theme-muted">Last updated · {LAST_UPDATED}</p>

      <p>
        These terms cover your use of Intermission (the "Service"). By
        creating an account or using the Service, you agree to them. If you
        don't agree, please don't use the Service.
      </p>

      <h2 id="acceptance">1. Acceptance of terms</h2>
      <p>
        You accept these terms when you sign up, sign in, or otherwise use
        the Service. If you're accepting on behalf of an organization, you
        represent that you have authority to bind it.
      </p>

      <h2 id="accounts">2. Your account</h2>
      <ul>
        <li>
          You're responsible for your credentials and for activity under
          your account. Use a strong, unique password.
        </li>
        <li>
          Provide accurate information when signing up. Impersonating other
          people or services is not allowed.
        </li>
        <li>
          You're responsible for keeping your email address current so we
          can reach you about security or policy notices.
        </li>
      </ul>

      <h2 id="use">3. Acceptable use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Reverse-engineer, decompile, or otherwise try to extract source code from the Service.</li>
        <li>Interfere with rate limits, scrape bulk data, or attempt to overload the Service.</li>
        <li>Upload malicious content, attempt to access data you don't own, or probe the Service for vulnerabilities without prior written permission.</li>
        <li>Use the Service to violate any applicable law or third-party right.</li>
      </ul>

      <h2 id="availability">4. Service availability</h2>
      <p>
        Intermission is provided as-is. We do our best to keep it fast and
        reliable, but we can't guarantee uninterrupted access. Scheduled
        maintenance and emergency outages may occur; we'll post notices in
        the app when possible.
      </p>

      <h2 id="content">5. Your content</h2>
      <p>
        Your library — ratings, notes, dates, custom lists — belongs to you.
        You grant us a limited license to store and display it so the
        Service can function. You can export or delete it at any time
        (see our <a href="/docs/privacy-policy">Privacy policy</a>).
      </p>
      <p>
        Title metadata and artwork are sourced from TMDB; that content is
        provided "as-is" and TMDB's terms apply to its use.
      </p>

      <h2 id="termination">6. Termination</h2>
      <p>
        You may stop using the Service at any time and delete your account
        from Settings. We may suspend or terminate accounts that violate
        these terms or that pose a security risk. Where reasonable, we'll
        warn you first.
      </p>

      <h2 id="changes">7. Changes to the terms</h2>
      <p>
        If we make material changes, we'll bump the date at the top and
        notify signed-in users. Continued use after the effective date
        constitutes acceptance.
      </p>

      <h2 id="disclaimers">8. Disclaimers</h2>
      <p>
        The Service is provided "as is" and "as available" without
        warranties of any kind, express or implied, including but not
        limited to warranties of merchantability, fitness for a particular
        purpose, and non-infringement. We don't warrant that the Service
        will be error-free or that defects will be corrected.
      </p>

      <h2 id="liability">9. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, Intermission and its
        maintainers will not be liable for any indirect, incidental,
        special, consequential, or punitive damages arising out of or
        related to your use of the Service. Our aggregate liability for
        any claim will not exceed the greater of USD 50 or the amount you
        paid us in the twelve months preceding the claim (which is
        presently zero for free accounts).
      </p>

      <h2 id="governing-law">10. Governing law</h2>
      <p>
        These terms are governed by the laws of the jurisdiction in which
        the maintainers are based, without regard to its conflict-of-laws
        principles. Any dispute will be resolved in the courts of that
        jurisdiction.
      </p>

      <h2 id="contact">11. Contact</h2>
      <p>
        Questions about these terms? Email
        <a href="mailto:legal@intermission.app"> legal@intermission.app</a>.
      </p>
    </div>
  );
};

export default TermsOfService;