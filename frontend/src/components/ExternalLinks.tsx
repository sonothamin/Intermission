import React from "react";
import { Link2, Globe } from "lucide-react";
import { TmdbExternalIds } from "../lib/api";

interface ExternalLinksProps {
  externalIds: TmdbExternalIds | null | undefined;
  homepage: string | null | undefined;
  className?: string;
}

interface LinkEntry {
  key: string;
  label: string;
  url: string;
  className: string;
  icon: React.ReactNode;
}

// Simple inline brand icon (text-only) — used in place of unavailable lucide brand icons.
const BrandIcon: React.FC<{ label: string }> = ({ label }) => (
  <span
    aria-hidden="true"
    className="inline-flex items-center justify-center text-[10px] font-bold leading-none w-5 h-5 rounded bg-white/15 ring-1 ring-white/20"
  >
    {label}
  </span>
);

const safeUrl = (u: string): string | null => {
  if (!u) return null;
  try {
    const parsed = new URL(u);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return u;
  } catch {
    /* fall through */
  }
  return null;
};

export const ExternalLinks: React.FC<ExternalLinksProps> = ({
  externalIds,
  homepage,
  className = "",
}) => {
  if (!externalIds && !homepage) return null;

  const imdb = safeUrl(
    externalIds?.imdb_id
      ? `https://www.imdb.com/title/${externalIds.imdb_id}/`
      : ""
  );
  const imdbId = externalIds?.imdb_id?.replace(/^tt/, "") ?? "";
  const rottenTomatoes = imdbId
    ? safeUrl(`https://www.rottentomatoes.com/m/${imdbId}`)
    : null;
  const wikidata = safeUrl(
    externalIds?.wikidata_id
      ? `https://www.wikidata.org/wiki/${externalIds.wikidata_id}`
      : ""
  );
  const instagram = safeUrl(
    externalIds?.instagram_id
      ? `https://instagram.com/${externalIds.instagram_id}`
      : ""
  );
  const twitter = safeUrl(
    externalIds?.twitter_id
      ? `https://twitter.com/${externalIds.twitter_id}`
      : ""
  );
  const facebook = safeUrl(
    externalIds?.facebook_id
      ? `https://facebook.com/${externalIds.facebook_id}`
      : ""
  );
  const tiktok = safeUrl(
    externalIds?.tiktok_id
      ? `https://www.tiktok.com/@${externalIds.tiktok_id}`
      : ""
  );
  const youtube = safeUrl(
    externalIds?.youtube_id
      ? `https://www.youtube.com/${externalIds.youtube_id}`
      : ""
  );
  const home = safeUrl(homepage ?? "");

  const links: LinkEntry[] = [
    imdb && {
      key: "imdb",
      label: "IMDb",
      url: imdb,
      className:
        "bg-yellow-500/15 hover:bg-yellow-500/25 text-yellow-300 border-yellow-500/30",
      icon: <BrandIcon label="IMDb" />,
    },
    rottenTomatoes && {
      key: "rt",
      label: "Rotten Tomatoes",
      url: rottenTomatoes,
      className: "bg-red-500/15 hover:bg-red-500/25 text-red-300 border-red-500/30",
      icon: <BrandIcon label="RT" />,
    },
    wikidata && {
      key: "wikidata",
      label: "Wikidata",
      url: wikidata,
      className:
        "bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border-blue-500/30",
      icon: <BrandIcon label="W" />,
    },
    instagram && {
      key: "instagram",
      label: "Instagram",
      url: instagram,
      className:
        "bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border-pink-500/30",
      icon: <BrandIcon label="IG" />,
    },
    twitter && {
      key: "twitter",
      label: "Twitter",
      url: twitter,
      className:
        "bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border-sky-500/30",
      icon: <BrandIcon label="X" />,
    },
    facebook && {
      key: "facebook",
      label: "Facebook",
      url: facebook,
      className:
        "bg-blue-600/15 hover:bg-blue-600/25 text-blue-200 border-blue-600/30",
      icon: <BrandIcon label="f" />,
    },
    tiktok && {
      key: "tiktok",
      label: "TikTok",
      url: tiktok,
      className:
        "bg-fuchsia-500/15 hover:bg-fuchsia-500/25 text-fuchsia-300 border-fuchsia-500/30",
      icon: <BrandIcon label="TT" />,
    },
    youtube && {
      key: "youtube",
      label: "YouTube",
      url: youtube,
      className: "bg-red-600/15 hover:bg-red-600/25 text-red-300 border-red-600/30",
      icon: <BrandIcon label="YT" />,
    },
    home && {
      key: "homepage",
      label: "Homepage",
      url: home,
      className:
        "bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30",
      icon: <Globe className="w-4 h-4" />,
    },
  ].filter(Boolean) as LinkEntry[];

  if (links.length === 0) return null;

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className}`}
      aria-label="External links"
    >
      {links.map((l) => (
        <a
          key={l.key}
          href={l.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${l.className}`}
        >
          {l.icon}
          <span>{l.label}</span>
          <Link2 className="w-3 h-3 opacity-60" />
        </a>
      ))}
    </div>
  );
};
