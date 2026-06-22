import React from "react";
import { Tooltip, TooltipProps } from "recharts";
import {
  chartCursorFill,
  chartTooltipItemStyle,
  chartTooltipStyle,
} from "../lib/chartTheme";

/**
 * Recharts `<Tooltip>` pre-configured with the dashboard's tooltip styling.
 *
 * Defaults match the seven call sites in `Dashboard.tsx`. Pass `showCursor={true}`
 * for charts that highlight the hovered bar (e.g. Rating Distribution).
 */
export const ChartTooltip: React.FC<Omit<TooltipProps<any, any>, "contentStyle" | "itemStyle" | "cursor"> & { showCursor?: boolean }> = ({
  showCursor = false,
  ...rest
}) => (
  <Tooltip
    {...rest}
    contentStyle={chartTooltipStyle}
    itemStyle={chartTooltipItemStyle}
    cursor={showCursor ? { fill: chartCursorFill } : false}
  />
);