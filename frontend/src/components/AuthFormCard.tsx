import React from "react";

interface AuthFormCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

/**
 * Shared chrome for the Login / Register / ForgotPassword / ResetPassword
 * cards. Renders the title + subtitle header and the consistent border,
 * background, padding, and shadow used across every auth page so the
 * individual pages can focus on their form fields.
 */
export const AuthFormCard: React.FC<AuthFormCardProps> = ({
  title,
  subtitle,
  children,
}) => {
  return (
    <div className="dense-card p-6 sm:p-7 border border-theme bg-theme-secondary/50 backdrop-blur-md rounded-2xl shadow-xl space-y-4">
      <div className="space-y-1 text-center lg:text-left">
        <h2 className="text-2xl font-bold text-theme-primary">{title}</h2>
        {subtitle && (
          <p className="text-xs text-theme-secondary">{subtitle}</p>
        )}
      </div>
      {children}
    </div>
  );
};
