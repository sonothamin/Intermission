import React, { useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/api";
import type { GoogleCredentialResponse } from "../types/google";

const GSI_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const DEFAULT_CLIENT_ID =
  "548204407906-ts3f82guhnq92tdaklrglpnc8fg5k31r.apps.googleusercontent.com";

/**
 * Produce a cryptographically random URL-safe string. Uses Web Crypto when
 * available (modern browsers, secure contexts) and falls back to
 * Math.random for the rare case it isn't.
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * SHA-256 of the input, returned as a lowercase hex string. Falls back to
 * a non-hashed passthrough if SubtleCrypto is unavailable so we never
 * silently produce a mismatched nonce.
 */
async function sha256Hex(input: string): Promise<string> {
  if (typeof crypto !== "undefined" && crypto.subtle) {
    const buf = new TextEncoder().encode(input);
    const digest = await crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  // SubtleCrypto missing (insecure context) — Google will still hash whatever
  // we pass, but the comparison may fail. Better to surface the regression
  // than to silently degrade.
  throw new Error("SubtleCrypto is not available; cannot hash nonce.");
}

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

  // Holds the *raw* nonce currently in flight. We send the SHA-256 hash to
  // Google (matching their documented contract) and the raw value to
  // Supabase, which re-hashes the raw input before comparing. Keeping the
  // raw value here means the credential callback — which Google may invoke
  // asynchronously after the user closes a popup or completes One Tap —
  // reads the exact same value the init effect hashed.
  const pendingNonceRef = useRef<string | null>(null);

  const handleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      onLoadingRef.current?.(true);
      onErrorRef.current?.(null);

      // Defensive: if we minted a nonce for this flow, only proceed when
      // the credential's nonce claim actually matches. This guards against
      // a stale credential from a previous init (e.g. user reloaded the
      // page between rendering and clicking).
      const payload = decodeJwtPayload(response.credential);
      const credentialNonce =
        typeof payload?.nonce === "string" && payload.nonce.length > 0
          ? payload.nonce
          : undefined;
      const expectedRaw = pendingNonceRef.current ?? undefined;

      if (expectedRaw && credentialNonce !== expectedRaw) {
        onErrorRef.current?.("Sign-in nonce mismatch. Please try again.");
        onLoadingRef.current?.(false);
        return;
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
        ...(expectedRaw ? { nonce: expectedRaw } : {}),
      });

      if (error) {
        onErrorRef.current?.(error.message);
        onLoadingRef.current?.(false);
        return;
      }

      // Consume the nonce so the next One Tap prompt (if any) mints a fresh
      // one and doesn't accidentally match this completed flow.
      pendingNonceRef.current = null;

      navigate("/");
    },
    [navigate],
  );

  useEffect(() => {
    if (!clientId || disabled || !buttonRef.current) return;

    let cancelled = false;
    const container = buttonRef.current;

    // 1. Generate a fresh raw nonce for this init cycle.
    const rawNonce = generateNonce();
    pendingNonceRef.current = rawNonce;

    // 2. SHA-256 the raw nonce and send the *hash* to Google. Google
    //    embeds the hash it receives into the ID token's `nonce` claim.
    //    Supabase will re-hash the raw nonce we pass to signInWithIdToken
    //    and compare against that claim, so both sides must derive from
    //    the same input.
    let hashedNonce: string;
    try {
      // sha256Hex is async; we block init on it. This is a single microtask
      // hop, so user-visible delay is negligible.
      // We can't `await` inside useEffect, so we chain.
      sha256Hex(rawNonce)
        .then((hash) => {
          if (cancelled) return;
          hashedNonce = hash;
          return loadGsiScript();
        })
        .then(() => {
          if (
            cancelled ||
            !window.google?.accounts?.id ||
            !buttonRef.current ||
            !hashedNonce
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
            nonce: hashedNonce,
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
    } catch (err) {
      onErrorRef.current?.(
        err instanceof Error ? err.message : "Failed to initialize Google Sign-In",
      );
    }

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
