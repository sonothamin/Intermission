import React from "react";
import { LucideIcon } from "lucide-react";

/** Tailwind color key for the icon badge — accepts any theme color. */
type IconColor =
  | "emerald"
  | "blue"
  | "purple"
  | "amber"
  | "red"
  | "rose"
  | "pink"
  | "teal"
  | "indigo";

interface StatCardProps {
  /** Lucide icon component to render inside the colored badge. */
  icon: LucideIcon;
  /** Tailwind color name (without the leading "text-") used for the badge. */
  color: IconColor;
  /** Small label rendered above the value (e.g. "Movies Watched"). */
  label: string;
  /** Headline value rendered large and bold. */
  value: React.ReactNode;
  /** Optional supporting text rendered under the value in muted style. */
  hint?: React.ReactNode;
}

/**
 * Dense-card stat tile used on the Dashboard summary row.
 *
 * Renders a small icon badge, a label, a value, and an optional hint line.
 * The outer chrome is `dense-card flex items-center gap-4` which matches the
 * styling of the rest of the dashboard.
 */
export const StatCard: React.FC<StatCardProps> = ({ icon: Icon, color, label, value, hint }) => (
  <div className="dense-card flex items-center gap-4">
    <div className={`p-3 bg-${color}-500/10 rounded-lg text-${color}-500`}>
      <Icon className="w-6 h-6" />
    </div>
    <div>
      <p className="text-sm font-medium text-theme-secondary">{label}</p>
      <h3 className="text-2xl font-bold">{value}</h3>
      {hint && <p className="text-xs text-theme-muted mt-0.5">{hint}</p>}
    </div>
  </div>
);
