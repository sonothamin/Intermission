import React, { useState, forwardRef } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  /** Optional icon shown on the left side of the input (e.g. <Lock />). */
  leftIcon?: React.ReactNode;
}

/**
 * Standard password input with a show/hide toggle.
 * Matches the styling used across Login, Register, and ResetPassword.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ leftIcon, className = "", ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        {leftIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-theme-muted">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          type={visible ? "text" : "password"}
          {...props}
          className={`${leftIcon ? "pl-10" : "pl-3"} pr-10 ${className}`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-theme-muted hover:text-theme-primary transition-colors focus:outline-none focus-visible:text-theme-primary"
        >
          {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
        </button>
      </div>
    );
  }
);

PasswordInput.displayName = "PasswordInput";
