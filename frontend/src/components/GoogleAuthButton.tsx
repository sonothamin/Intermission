import React, { useState } from "react";
import { supabase } from "../lib/api";
import { GoogleButton } from "./GoogleButton";

interface GoogleAuthButtonProps {
  /** Called with the OAuth error when sign-in fails (so the page can surface it). */
  onError?: (message: string) => void;
  /** Optional override for the button label. */
  label?: string;
  disabled?: boolean;
}

/**
 * Thin wrapper around {@link GoogleButton} that triggers the Supabase
 * `signInWithOAuth` flow with `redirectTo: window.location.origin`. The
 * parent page receives any error message via `onError` and is responsible
 * for toggling its own loading state.
 */
export const GoogleAuthButton: React.FC<GoogleAuthButtonProps> = ({
  onError,
  label = "Continue with Google",
  disabled = false,
}) => {
  const [pending, setPending] = useState(false);

  const isDisabled = disabled || pending;

  return (
    <GoogleButton
      label={label}
      disabled={isDisabled}
      onClick={async () => {
        setPending(true);
        // Send post-OAuth return straight to the dashboard so users who sign
        // in / sign up via Google don't get bounced back to the landing page.
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/dashboard` },
        });
        if (oauthError) {
          onError?.(oauthError.message);
          setPending(false);
        }
        // On success, the browser navigates away, so we don't need to
        // reset `pending` here.
      }}
    />
  );
};
