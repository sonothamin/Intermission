import { Loader2 } from "lucide-react";

/** Centered spinner used by media detail pages while fetching. */
export const MediaLoadingState: React.FC = () => (
  <div className="flex items-center justify-center h-64">
    <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
  </div>
);
