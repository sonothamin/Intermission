import React from "react";
import { AlertCircle } from "lucide-react";

interface AuthErrorAlertProps {
  /** Error message to display. When null/empty, the component renders nothing. */
  message: string | null | undefined;
}

/**
 * Inline error banner used across the auth pages. Returns `null` when no
 * message is present so callers can drop it in unconditionally.
 */
export const AuthErrorAlert: React.FC<AuthErrorAlertProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-2.5 text-red-400 text-sm">
      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <p>{message}</p>
    </div>
  );
};
