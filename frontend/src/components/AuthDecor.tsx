import React from "react";
import { Popcorn, Clapperboard } from "lucide-react";

/**
 * Decorative background for the left branding pane.
 *
 * - Two horizontal film strips (top + bottom) scroll slowly toward the left.
 * - A handful of popcorn, clapperboard, and film-reel icons drift gently.
 * - Everything is low-opacity and pointer-events-none so it never competes
 *   with the centered brand mark.
 */
export const AuthDecor: React.FC = () => {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden pointer-events-none"
    >
      {/* ── Top film strip ─────────────────────────────────────────── */}
      <div className="absolute -left-1/4 -right-1/4 top-6 opacity-[0.08]">
        <div className="film-strip-track flex w-[200%]">
          <FilmStrip />
          <FilmStrip />
        </div>
      </div>

      {/* ── Bottom film strip (offset so it doesn't align with top) ── */}
      <div className="absolute -left-1/4 -right-1/4 bottom-6 opacity-[0.07]">
        <div
          className="film-strip-track flex w-[200%]"
          style={{ animationDirection: "reverse", animationDuration: "55s" }}
        >
          <FilmStrip />
          <FilmStrip />
        </div>
      </div>

      {/* ── Floating popcorn pieces ────────────────────────────────── */}
      <PopcornPiece
        className="absolute top-[18%] left-[14%] w-7 h-7 opacity-[0.12] text-amber-300"
        floatClass="float-slow"
      />
      <PopcornPiece
        className="absolute top-[30%] left-[8%] w-5 h-5 opacity-[0.10] text-amber-200"
        floatClass="float-slower"
      />
      <PopcornPiece
        className="absolute bottom-[24%] left-[18%] w-6 h-6 opacity-[0.12] text-amber-300"
        floatClass="float-slow"
        style={{ animationDelay: "1.5s" }}
      />
      <PopcornPiece
        className="absolute top-[22%] right-[12%] w-6 h-6 opacity-[0.10] text-amber-200"
        floatClass="float-slower"
        style={{ animationDelay: "0.8s" }}
      />
      <PopcornPiece
        className="absolute bottom-[28%] right-[9%] w-7 h-7 opacity-[0.12] text-amber-300"
        floatClass="float-slow"
        style={{ animationDelay: "2.2s" }}
      />

      {/* ── Clapperboards ──────────────────────────────────────────── */}
      <Clapperboard
        className="absolute top-[14%] right-[18%] w-12 h-12 opacity-[0.10] text-theme-primary float-slower"
        style={{ animationDelay: "0.4s" }}
      />
      <Clapperboard
        className="absolute bottom-[18%] right-[22%] w-10 h-10 opacity-[0.08] text-theme-primary float-slow"
        style={{ animationDelay: "1.8s" }}
      />

      {/* ── Film reels ─────────────────────────────────────────────── */}
      <div className="absolute top-[12%] left-[28%] opacity-[0.07] text-theme-primary">
        <FilmReel size={56} />
      </div>
      <div className="absolute bottom-[14%] left-[30%] opacity-[0.06] text-theme-primary">
        <FilmReel size={44} />
      </div>

      {/* ── Subtle vignette to keep center readable ────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.25) 100%)",
        }}
      />
    </div>
  );
};

/** A single repeating segment of a film strip. Two of these tile horizontally. */
const FilmStrip: React.FC = () => (
  <div className="flex w-1/2 shrink-0">
    {/* Black band */}
    <div className="flex-1 bg-theme-primary relative h-12">
      {/* Sprocket holes */}
      <div className="absolute inset-x-0 top-0 h-2 flex justify-around">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={`t-${i}`}
            className="w-3 h-1.5 bg-theme-secondary/60 rounded-sm"
          />
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-2 flex justify-around">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={`b-${i}`}
            className="w-3 h-1.5 bg-theme-secondary/60 rounded-sm"
          />
        ))}
      </div>
      {/* Frame separators */}
      <div className="absolute inset-y-2 left-0 right-0 flex justify-around items-center">
        {Array.from({ length: 9 }).map((_, i) => (
          <span
            key={`f-${i}`}
            className="h-full w-px bg-theme-secondary/40"
          />
        ))}
      </div>
    </div>
  </div>
);

const PopcornPiece: React.FC<{
  className?: string;
  floatClass: string;
  style?: React.CSSProperties;
}> = ({ className = "", floatClass, style }) => (
  <div className={floatClass} style={style}>
    <Popcorn className={className} />
  </div>
);

/** Inline SVG film reel — looks more authentic than the lucide Film icon at scale. */
const FilmReel: React.FC<{ size: number }> = ({ size }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 64 64"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    xmlns="http://www.w3.org/2000/svg"
  >
    <circle cx="32" cy="32" r="28" />
    <circle cx="32" cy="32" r="4" fill="currentColor" />
    <circle cx="32" cy="14" r="4" />
    <circle cx="32" cy="50" r="4" />
    <circle cx="14" cy="32" r="4" />
    <circle cx="50" cy="32" r="4" />
    <circle cx="20" cy="20" r="3" />
    <circle cx="44" cy="20" r="3" />
    <circle cx="20" cy="44" r="3" />
    <circle cx="44" cy="44" r="3" />
  </svg>
);

// (no extra exports)