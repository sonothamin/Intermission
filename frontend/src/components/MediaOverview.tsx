interface MediaOverviewProps {
  overview?: string | null;
}

/** Overview paragraph wrapped in a dense-card section. Renders nothing when no text. */
export const MediaOverview: React.FC<MediaOverviewProps> = ({ overview }) => {
  if (!overview) return null;
  return (
    <section className="dense-card">
      <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
        Overview
      </h2>
      <p className="text-theme-secondary leading-relaxed">{overview}</p>
    </section>
  );
};
