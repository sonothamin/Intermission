import React from "react";

interface ToggleProps {
  /** Whether the switch is in the "on" position. */
  checked: boolean;
  /** Fired with the new value when the user toggles the switch. */
  onChange: (checked: boolean) => void;
  /**
   * Optional visible label. When provided, the toggle renders in a labeled
   * row layout (label on the left, switch on the right) by default.
   * Accepts a string or any ReactNode (e.g. an icon-prefixed label).
   */
  label?: React.ReactNode;
  /** Optional muted description rendered under the label. */
  description?: React.ReactNode;
  /**
   * Layout hint. `false` (default) stacks label/description on the left
   * and aligns the switch to the right — good for settings lists.
   * `true` places the switch directly to the right of the label with
   * no description slot.
   */
  inline?: boolean;
  /** Disable interaction and dim the control. */
  disabled?: boolean;
  /** Show a subtle pending state (e.g. while persisting). */
  loading?: boolean;
  /** Accessible label for the underlying control. */
  ariaLabel?: string;
  /** Optional id so an external <label htmlFor> can target the switch. */
  id?: string;
  /** Extra classes merged onto the outer row. */
  className?: string;
}

/**
 * Accessible boolean switch used by the Settings page. Renders a real
 * <button role="switch" aria-checked> under the hood so keyboard,
 * screen-reader, and form behavior all work out of the box, styled as a
 * small dense pill matching the rest of the form chrome.
 *
 * The track is 32×18 (matches the 36px input height used by FormField
 * when stacked) and the thumb is a 14px circle that slides 14px on
 * activation. The green accent mirrors the `focus:border-[#10b981]`
 * color used by {@link FormField} and {@link CustomSelect}.
 */
export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  description,
  inline = false,
  disabled = false,
  loading = false,
  ariaLabel,
  id,
  className = "",
}) => {
  // While loading, freeze the visual state so the track doesn't flicker
  // between optimistic updates and the server-confirmed value. The control
  // stays disabled until the save settles.
  const isInteractive = !disabled && !loading;

  // The track is a real <button> so it gets focus, keyboard activation
  // (Space/Enter) and aria semantics for free. We avoid rendering a
  // <label htmlFor> wrapper because the surrounding row already
  // functions as a click target.
  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? (typeof label === "string" ? label : undefined)}
      aria-busy={loading || undefined}
      disabled={!isInteractive}
      onClick={() => isInteractive && onChange(!checked)}
      id={id}
      className={[
        "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full",
        "border transition-colors duration-150",
        checked
          ? "bg-[#10b981] border-[#10b981]"
          : "bg-theme-tertiary border-theme",
        // Focus ring mirrors FormField's green focus border
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-[#10b981]/60 focus-visible:ring-offset-1 focus-visible:ring-offset-theme-primary",
        // Disabled / loading
        (!isInteractive) && "opacity-60 cursor-not-allowed",
        isInteractive && "cursor-pointer",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Thumb. `translate-x-3.5` aligns with the 32px track; the visual
          shift matches the 14px thumb width. */}
      <span
        aria-hidden="true"
        className={[
          "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm",
          "transform transition-transform duration-150",
          checked ? "translate-x-3.5" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );

  // Bare switch — caller is rendering their own label.
  if (!label && !description) {
    return track;
  }

  // Inline layout: label sits directly to the left of the switch.
  if (inline) {
    return (
      <label
        className={[
          "inline-flex items-center gap-3 cursor-pointer select-none",
          !isInteractive && "opacity-60 cursor-not-allowed",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {track}
        <span className="text-sm font-medium text-theme-primary">{label}</span>
      </label>
    );
  }

  // Stacked (default) layout: label/description on the left, switch on
  // the right. The whole row is clickable for the common case.
  return (
    <div
      className={[
        "flex items-start justify-between gap-4",
        isInteractive && "cursor-pointer",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={(e) => {
        // Only toggle when the user clicks the row, not the track itself
        // (the track handles its own click). Also ignore clicks on
        // interactive children that should keep their own behavior.
        if (!isInteractive) return;
        if ((e.target as HTMLElement).closest("button, a, input, select, textarea")) return;
        onChange(!checked);
      }}
    >
      <div className="min-w-0">
        <div className="text-sm font-medium text-theme-primary">{label}</div>
        {description && (
          <div className="text-xs text-theme-secondary mt-0.5">{description}</div>
        )}
      </div>
      <div className="flex-shrink-0 pt-0.5">{track}</div>
    </div>
  );
};
