import type { ReactNode } from "react";

export interface MediaDetailItem {
  /** Label rendered in the `<dt>`. */
  label: string;
  /** Value rendered in the `<dd>`. */
  value: ReactNode;
  /**
   * When true, the row stacks the label above the value and the value
   * is allowed to wrap (used for multi-line content like production
   * companies or network lists).
   */
  fullWidth?: boolean;
}

interface MediaDetailsListProps {
  items: MediaDetailItem[];
}

/**
 * Definition-list style details card. Items with a falsy `value` are
 * skipped, so callers can simply pass everything they know about and
 * only the relevant rows show up.
 */
export const MediaDetailsList: React.FC<MediaDetailsListProps> = ({ items }) => {
  const visible = items.filter((item) => item.value !== null && item.value !== undefined && item.value !== "");
  if (visible.length === 0) return null;

  return (
    <section className="dense-card space-y-3">
      <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider">
        Details
      </h2>
      <dl className="space-y-2 text-sm">
        {visible.map((item) =>
          item.fullWidth ? (
            <div key={item.label}>
              <dt className="text-theme-muted mb-1">{item.label}</dt>
              <dd className="text-theme-secondary">{item.value}</dd>
            </div>
          ) : (
            <div key={item.label} className="flex justify-between gap-4">
              <dt className="text-theme-muted">{item.label}</dt>
              <dd className="text-theme-secondary text-right">{item.value}</dd>
            </div>
          ),
        )}
      </dl>
    </section>
  );
};
