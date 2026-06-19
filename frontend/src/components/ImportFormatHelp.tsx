import React, { useEffect, useRef, useState } from "react";
import { HelpCircle, X } from "lucide-react";

export const ImportFormatHelp: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="p-1 rounded-full text-[#52525b] hover:text-[#10b981] hover:bg-[#10b981]/10 transition-colors"
        aria-label="Import format help"
        aria-expanded={open}
      >
        <HelpCircle className="w-4 h-4" />
      </button>

      {open && (
        <div className="absolute left-6 top-0 z-50 w-80 md:w-96 p-4 rounded-lg border border-[#27272a] bg-[#141414] shadow-xl text-left">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-[#ededed]">Accepted import formats</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-0.5 rounded text-[#52525b] hover:text-[#ededed] transition-colors"
              aria-label="Close"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-3 text-xs text-[#a1a1aa] leading-relaxed">
            <div>
              <p className="font-medium text-[#ededed] mb-1">Intermission JSON (.json)</p>
              <p>Your exported backup from Settings → Export Data. Includes <code className="text-[#10b981]">library</code>, <code className="text-[#10b981]">watchlist</code>, and <code className="text-[#10b981]">episode_progress</code>.</p>
            </div>
            <div>
              <p className="font-medium text-[#ededed] mb-1">CSV (.csv)</p>
              <p>Required columns: <code className="text-[#10b981]">type</code>, <code className="text-[#10b981]">tmdb_id</code>. Optional: <code className="text-[#10b981]">status</code>, <code className="text-[#10b981]">rating</code>, <code className="text-[#10b981]">watched_at</code>, <code className="text-[#10b981]">season</code>, <code className="text-[#10b981]">episode</code>.</p>
              <pre className="mt-2 p-2 rounded bg-[#0a0a0a] border border-[#27272a] text-[10px] text-[#52525b] overflow-x-auto">
{`type,tmdb_id,status,rating,watched_at
movie,603,completed,9,2024-06-01
tv,1396,watching,,,1,3`}
              </pre>
            </div>
            <p className="text-[#52525b]">TMDB IDs are required. Rows without a valid TMDB ID are skipped.</p>
          </div>
        </div>
      )}
    </div>
  );
};

