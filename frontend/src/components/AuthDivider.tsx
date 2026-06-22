import React from "react";

interface AuthDividerProps {
  /** Text rendered in the middle of the rule. Defaults to "or". */
  label?: string;
}

/**
 * Horizontal rule with a centered label, used to separate the email form
 * from the Google OAuth button on the auth pages.
 */
export const AuthDivider: React.FC<AuthDividerProps> = ({ label = "or" }) => {
  return (
    <div className="flex items-center justify-between gap-4">
      <hr className="w-full border-theme" />
      <span className="text-[10px] text-theme-muted uppercase tracking-wider whitespace-nowrap">
        {label}
      </span>
      <hr className="w-full border-theme" />
    </div>
  );
};
