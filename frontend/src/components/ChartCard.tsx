import React from "react";

interface ChartCardProps {
  /** Header content (title + optional right-aligned action or icon). */
  title: React.ReactNode;
  /** Chart or list body rendered inside the flex-1 min-h-0 slot. */
  children: React.ReactNode;
  /** Outer height class, defaults to h-80 to match the existing charts. */
  height?: "h-64" | "h-72" | "h-80" | "h-96";
  /** Extra classes appended to the outer wrapper (e.g. "lg:col-span-2"). */
  className?: string;
}

/**
 * Dense-card column with a title header and a flex chart body.
 *
 * Used by every Dashboard chart panel (Watch Habits, Top Genres, Top Languages,
 * Minutes by Language, Top Regions, Minutes by Region, Rating Distribution)
 * and the Recent Activity list. The body slot has `flex-1 min-h-0` so a
 * `ResponsiveContainer` inside fills the available space.
 */
export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  children,
  height = "h-80",
  className = "",
}) => (
  <div className={`dense-card flex flex-col ${height} ${className}`.trim()}>
    <h3 className="text-sm font-semibold text-theme-primary mb-4">{title}</h3>
    <div className="flex-1 min-h-0">{children}</div>
  </div>
);