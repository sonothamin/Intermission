interface MediaTrailerProps {
  /** YouTube video key (the segment after `?v=`). */
  trailerKey?: string | null;
  title: string;
}

/** YouTube trailer embed wrapped in a dense-card section. Renders nothing when no key. */
export const MediaTrailer: React.FC<MediaTrailerProps> = ({ trailerKey, title }) => {
  if (!trailerKey) return null;
  return (
    <section className="dense-card">
      <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
        Trailer
      </h2>
      <div className="aspect-video rounded-lg overflow-hidden bg-black">
        <iframe
          src={`https://www.youtube.com/embed/${trailerKey}`}
          title={`${title} trailer`}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    </section>
  );
};
