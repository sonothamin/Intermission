interface MediaGenresProps {
  genres: string[];
}

/** Genre pill list wrapped in a dense-card section. Renders nothing when empty. */
export const MediaGenres: React.FC<MediaGenresProps> = ({ genres }) => {
  if (genres.length === 0) return null;
  return (
    <section className="dense-card">
      <h2 className="text-sm font-semibold text-theme-primary uppercase tracking-wider mb-3">
        Genres
      </h2>
      <div className="flex flex-wrap gap-2">
        {genres.map((genre) => (
          <span
            key={genre}
            className="px-2.5 py-1 text-xs rounded-md bg-theme-tertiary border border-theme text-theme-secondary"
          >
            {genre}
          </span>
        ))}
      </div>
    </section>
  );
};
