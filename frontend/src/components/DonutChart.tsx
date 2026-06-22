import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { ChartTooltip } from "./ChartTooltip";

/** Default chart colors — exported so the host can match other charts. */
export const DONUT_COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#14b8a6", "#6366f1",
];

interface DonutChartProps<T> {
  /** Source data; only the top 5 entries are shown. */
  data: T[];
  /** Slice value accessor (e.g. `d => d.count`). */
  dataKey: keyof T | ((d: T) => number);
  /** Slice label accessor — drives both the tooltip name and the top-center overlay. */
  nameKey: keyof T | ((d: T) => string);
  /** Top-center overlay shown when there is data; pass `null` to hide it. */
  centerLabel?: string | null;
  /** Width of the truncated center label, defaults to w-20. */
  centerLabelWidthClass?: string;
}

/**
 * Donut chart used by Dashboard's Top Genres, Top Languages, and Top Regions panels.
 *
 * Renders a 5-slice donut with the project's tooltip styling and an optional
 * top-center overlay (e.g. "Top EN") driven by the first data entry.
 */
export function DonutChart<T>({
  data,
  dataKey,
  nameKey,
  centerLabel,
  centerLabelWidthClass = "w-20",
}: DonutChartProps<T>) {
  const top = data.slice(0, 5);
  const slice = top.map((_entry, index) => (
    <Cell key={`cell-${index}`} fill={DONUT_COLORS[index % DONUT_COLORS.length]} />
  ));

  return (
    <div className="flex-1 min-h-0 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={top as any[]}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey={dataKey as any}
            nameKey={nameKey as any}
            stroke="none"
          >
            {slice}
          </Pie>
          <ChartTooltip />
        </PieChart>
      </ResponsiveContainer>
      {centerLabel && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
          <span className="text-xs text-theme-secondary block mb-0.5">Top</span>
          <span className={`font-bold text-sm text-theme-primary block truncate ${centerLabelWidthClass}`}>
            {centerLabel}
          </span>
        </div>
      )}
    </div>
  );
}