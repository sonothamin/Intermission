import { ExternalLinks } from "./ExternalLinks";

interface MediaLinksProps {
  externalIds?: import("../lib/api").TmdbExternalIds | null;
  homepage?: string | null;
}

/** External-links card. Renders nothing when there are no links to show. */
export const MediaLinks: React.FC<MediaLinksProps> = ({ externalIds, homepage }) => {
  if (!externalIds && !homepage) return null;
  return (
    <section className="dense-card">
      <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
        Links
      </h2>
      <ExternalLinks
        externalIds={externalIds}
        homepage={homepage}
        className="flex-col items-stretch gap-2 [&>a]:justify-start"
      />
    </section>
  );
};
