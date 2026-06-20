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

  gsiScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In"));
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
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
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;

  const handleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      onLoading?.(true);
      onError?.(null);

      // Decode the ID token payload to read the nonce (if any). One Tap
      // embeds a nonce in the credential; when it does, Supabase's
      // signInWithIdToken also requires the same nonce or it throws
      // "Passed nonce and nonce in id_token should either both exist or not."
      let nonce: string | undefined;
      try {
        const parts = response.credential.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(
            atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")),
          ) as { nonce?: string };
          if (typeof payload.nonce === "string" && payload.nonce.length > 0) {
            nonce = payload.nonce;
          }
        }
      } catch {
        // Non-JWT or undecodable credential — fall through without a nonce.
      }

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
        ...(nonce ? { nonce } : {}),
      });

      if (error) {
        onError?.(error.message);
        onLoading?.(false);
        return;
      }

      navigate("/");
    },
    [navigate, onError, onLoading],
  );

  useEffect(() => {
    if (!clientId || disabled || !buttonRef.current) return;

    let cancelled = false;
    const container = buttonRef.current;

    loadGsiScript()
      .then(() => {
        if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;

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
        if (!cancelled) onError?.(err.message);
      });

    return () => {
      cancelled = true;
      window.google?.accounts?.id?.cancel();
    };
  }, [autoSelect, clientId, disabled, handleCredential, mode, onError, promptOneTap]);

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
