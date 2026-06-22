import React from "react";

interface FormFieldProps {
  /** Visible label rendered above the input. */
  label: string;
  /** Icon shown inside the input on the left (e.g. `<Mail />`). */
  leftIcon?: React.ReactNode;
  /** Additional classes to merge onto the underlying <input>. */
  className?: string;
  /** Container classes (e.g. for grid layout). */
  containerClassName?: string;
  labelClassName?: string;
  disabled?: boolean;
}

type FormFieldInputProps = FormFieldProps &
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "disabled">;

/**
 * Labeled text input with an optional left icon, used by the auth pages.
 * Renders the same `dense-card`-friendly chrome (small label, 36px icon
 * gutter, green focus ring) that the Login and Register pages previously
 * inlined.
 *
 * For fields that need a custom control (e.g. {@link PasswordInput} with
 * its own show/hide toggle), use {@link FieldLabel} for the label row and
 * drop the control in directly.
 */
export const FormField: React.FC<FormFieldInputProps> = ({
  label,
  leftIcon,
  className = "",
  containerClassName = "space-y-1",
  labelClassName = "block text-xs font-medium text-theme-secondary",
  disabled,
  ...inputProps
}) => {
  const hasIcon = Boolean(leftIcon);

  return (
    <div className={containerClassName}>
      <label className={labelClassName}>{label}</label>
      <div className="relative">
        {hasIcon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-theme-muted">
            {leftIcon}
          </div>
        )}
        <input
          {...inputProps}
          disabled={disabled}
          className={`w-full ${hasIcon ? "pl-9" : "pl-3"} pr-3 py-2 text-sm bg-theme-secondary border-theme focus:border-[#10b981] text-theme-primary ${className}`}
        />
      </div>
    </div>
  );
};

/**
 * Label + optional right-aligned action (e.g. a "Forgot password?" link),
 * matching the style used by {@link FormField} so they can be mixed on
 * the same form without visual drift.
 */
export const FieldLabel: React.FC<{
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ children, action, className = "block text-xs font-medium text-theme-secondary" }) => {
  if (!action) {
    return <label className={className}>{children}</label>;
  }
  return (
    <div className="flex justify-between items-center">
      <label className={className}>{children}</label>
      {action}
    </div>
  );
};
