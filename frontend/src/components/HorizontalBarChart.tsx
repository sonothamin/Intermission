import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { chartAxisStroke, chartGridStroke } from "../lib/chartTheme";
import { ChartTooltip } from "./ChartTooltip";

interface HorizontalBarChartProps<T> {
  /** Source data (full list; the chart lays it out top-to-bottom). */
  data: T[];
  /** Y-axis category accessor (e.g. `"code"` for ISO codes). */
  categoryKey: keyof T;
  /** Bar value accessor (e.g. `"minutes"`). */
  valueKey: keyof T;
  /** Bar fill color, defaults to the emerald accent. */
  color?: string;
}

/**
 * Vertical-layout bar chart (bars run left-to-right, categories on the Y axis).
 *
 * Used by Dashboard's Minutes Watched by Language and Minutes Watched by Region
 * panels — both share the same grid, axis, and tooltip styling.
 */
export function HorizontalBarChart<T>({
  data,
  categoryKey,
  valueKey,
  color = "#10b981",
}: HorizontalBarChartProps<T>) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data as any[]} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={chartGridStroke} />
        <XAxis type="number" stroke={chartAxisStroke} />
        <YAxis dataKey={categoryKey as string} type="category" stroke={chartAxisStroke} width={80} />
        <ChartTooltip />
        <Bar dataKey={valueKey as string} fill={color} />
      </BarChart>
    </ResponsiveContainer>
  );
}
