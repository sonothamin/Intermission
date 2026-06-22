import { Link } from "react-router-dom";

interface MediaErrorStateProps {
  /** Error message to display. Falls back to a default when nullish. */
  error?: string | null;
  /** Entity label, e.g. "Movie" or "Show". */
  label: string;
  /** Where the back link should navigate. */
  backTo?: string;
  /** Link text. Defaults to "Back to search". */
  backLabel?: string;
}

/** Error placeholder with a "Back" link, shared by movie and show detail pages. */
export const MediaErrorState: React.FC<MediaErrorStateProps> = ({
  error,
  label,
  backTo = "/search",
  backLabel = "Back to search",
}) => (
  <div className="text-center py-16">
    <p className="text-red-400 mb-4">{error ?? `${label} not found`}</p>
    <Link to={backTo} className="text-[#10b981] hover:underline text-sm">
      {backLabel}
    </Link>
  </div>
);
