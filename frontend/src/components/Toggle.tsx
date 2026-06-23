import React from "react";

interface ToggleProps {
  id?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: React.ReactNode;
  description?: React.ReactNode;
  /**
   * Renders the label to the right of the switch (default) or as a row above
   * with the switch on the right when `inline` is false.
   */
  inline?: boolean;
}

/**
 * Accessible boolean toggle. Behaves like a switch — keyboard reachable,
 * ARIA-checked, and clickable on the whole label, not just the pill.
 */
export const Toggle: React.FC<ToggleProps> = ({
  id,
  checked,
  onChange,
  disabled,
  label,
  description,
  inline = true,
}) => {
  const switchEl = (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]/60 ${
        checked
          ? "bg-[#10b981] border-[#10b981]"
          : "bg-theme-tertiary border-theme"
      } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        aria-hidden
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );

  if (inline && (label || description)) {
    return (
      <label
        htmlFor={id}
        className={`flex items-center gap-3 ${
          disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        }`}
      >
        {switchEl}
        {(label || description) && (
          <span className="flex flex-col">
            {label && (
              <span className="text-sm font-medium text-theme-primary">{label}</span>
            )}
            {description && (
              <span className="text-xs text-theme-secondary mt-0.5">{description}</span>
            )}
          </span>
        )}
      </label>
    );
  }

  return (
    <div className="flex items-start justify-between gap-4">
      {(label || description) && (
        <div className="flex-1">
          {label && (
            <label
              htmlFor={id}
              className="text-sm font-medium text-theme-primary block cursor-pointer"
            >
              {label}
            </label>
          )}
          {description && (
            <p className="text-xs text-theme-secondary mt-0.5">{description}</p>
          )}
        </div>
      )}
      {switchEl}
    </div>
  );
};
