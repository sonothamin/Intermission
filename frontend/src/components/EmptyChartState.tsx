import React from "react";

interface EmptyChartStateProps {
  /** Message shown when a chart or list has no data. */
  message: string;
}

/**
 * Centered placeholder rendered inside a chart body when there is no data.
 *
 * Used in 8 places across `Dashboard.tsx` (charts and the Recent Activity list).
 * Sized to fill the parent so it sits dead-center via flexbox.
 */
export const EmptyChartState: React.FC<EmptyChartStateProps> = ({ message }) => (
  <div className="h-full flex items-center justify-center text-theme-muted text-sm">
    {message}
  </div>
);