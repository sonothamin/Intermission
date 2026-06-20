import React, { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/api";
import type { GoogleCredentialResponse } from "../types/google";

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const DEFAULT_CLIENT_ID =
  "548204407906-ts3f82guhnq92tdaklrglpnc8fg5k31r.apps.googleusercontent.com";

let gsiScriptPromise: Promise<void> | null = null;

function loadGsiScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
}

/**
 * Decode a base64url-encoded JWT segment without throwing on malformed input.
 * Returns null on any failure so callers can fall back gracefully.
 */
function decodeJwtPayload(
  credential: string,
): Record<string, unknown> | null {
  try {
    const parts = credential.split(".");
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

interface GoogleSignInProps {
  mode?: "signin" | "signup";
  disabled?: boolean;
  autoSelect?: boolean;
  promptOneTap?: boolean;
  onError?: (message: string | null) => void;
  onLoading?: (loading: boolean) => void;
}

export const GoogleSignIn: React.FC<GoogleSignInProps> = ({
  mode = "signin",
  disabled = false,
  autoSelect = true,
  promptOneTap = false,
  onError,
  onLoading,
}) => {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLDivElement>(null);
  const clientId =
    import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;

  // Stable refs to the latest callbacks so the init effect can run exactly
  // once per (mode, clientId, autoSelect, promptOneTap, disabled) tuple
  // without being re-entered on every parent render — which would cause GSI
  // to be re-initialized and emit a fresh internal nonce, producing a
  // "Nonces mismatch" error from Supabase.
  const onErrorRef = useRef(onError);
  const onLoadingRef = useRef(onLoading);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    onLoadingRef.current = onLoading;
  }, [onLoading]);

  const handleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      onLoadingRef.current?.(true);
      onErrorRef.current?.(null);

      // Read the nonce from the JWT payload. If Google embedded one (One Tap
      // does; the button flow does not), forward the *raw* nonce to
      // signInWithIdToken — Supabase hashes it itself before comparing
      // against the hash in the ID token, so the input must be byte-identical
      // to whatever GSI hashed originally. Reading it from the credential
      // itself guarantees that.
      const payload = decodeJwtPayload(response.credential);
      const rawNonce =
        typeof payload?.nonce === "string" && payload.nonce.length > 0
          ? payload.nonce
          : undefined;

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
        ...(rawNonce ? { nonce: rawNonce } : {}),
      });

      if (error) {
        onErrorRef.current?.(error.message);
        onLoadingRef.current?.(false);
        return;
      }

      navigate("/");
    },
    [navigate],
  );

  useEffect(() => {
    if (!clientId || disabled || !buttonRef.current) return;

    let cancelled = false;
    const container = buttonRef.current;

    loadGsiScript()
      .then(() => {
        if (
          cancelled ||
          !window.google?.accounts?.id ||
          !buttonRef.current
        ) {
          return;
        }

        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: handleCredential,
          context: mode,
          ux_mode: "popup",
          auto_select: autoSelect,
          itp_support: true,
        });

        container.innerHTML = "";

        const render = () => {
          if (cancelled || !buttonRef.current) return;
          const width = Math.floor(container.getBoundingClientRect().width);
          if (width < 200) {
            requestAnimationFrame(render);
            return;
          }
          window.google!.accounts.id.renderButton(container, {
            type: "standard",
            shape: "pill",
            theme: "filled_blue",
            text: mode === "signup" ? "signup_with" : "signin_with",
            size: "large",
            logo_alignment: "left",
            width,
          });
        };

        render();

        if (promptOneTap) {
          window.google.accounts.id.prompt();
        }
      })
      .catch((err: Error) => {
        if (!cancelled) onErrorRef.current?.(err.message);
      });

    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel();
    };
  }, [autoSelect, clientId, disabled, handleCredential, mode, promptOneTap]);

  if (!clientId) {
    return (
      <p className="text-sm text-theme-muted text-center">
        Google Sign-In is not configured.
      </p>
    );
  }

  return (
    <div
      ref={buttonRef}
      className={`w-full min-h-[44px] flex justify-center [&_iframe]:bg-transparent ${disabled ? "pointer-events-none opacity-50" : ""}`}
      aria-label={mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
    />
  );
};
