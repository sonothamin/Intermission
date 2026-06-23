import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Search as SearchIcon, User as UserIcon, Loader2 } from "lucide-react";
import { profileApi, ProfileSearchResult } from "../lib/api";
import { useAuth } from "../context/AuthContext";

/**
 * PeopleSearch — find other Intermission users by username or display name.
 *
 * Lives on the Dashboard. Debounces input by 250ms, then calls the profile
 * edge function's `?q=` search mode (public-only rows). Results are rendered
 * as a dropdown list with avatar + name + handle + bio preview; clicking a
 * row navigates to `/dashboard/u/{username}` (or `/dashboard/u/{id}` when
 * the matched user hasn't set a username yet).
 *
 * The dropdown closes on outside click and Escape, and re-opens whenever
 * the user types.
 */
export const PeopleSearch: React.FC = () => {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [searched, setSearched] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<number | null>(null);
  const lastQueryRef = useRef("");

  // Debounced search — only fires for queries ≥2 chars (matches the edge
  // function's validation) and skips if the trimmed input hasn't changed.
  useEffect(() => {
    const trimmed = query.trim();
    if (debounceRef.current !== null) {
      window.clearTimeout(debounceRef.current);
    }
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setSearched(false);
      return;
    }
    setLoading(true);
    debounceRef.current = window.setTimeout(async () => {
      debounceRef.current = null;
      try {
        const res = await profileApi.search(trimmed);
        // Guard against an out-of-order response overwriting a newer query
        if (trimmed !== lastQueryRef.current && lastQueryRef.current !== "") {
          // ignore — newer query already kicked off
          return;
        }
        lastQueryRef.current = trimmed;
        // Hide yourself from your own search results
        setResults((res.profiles ?? []).filter((p) => p.id !== user?.id));
        setSearched(true);
      } catch (err) {
        console.error("People search failed", err);
        setResults([]);
        setSearched(true);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
    };
  }, [query, user?.id]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setOpen(true);
  };

  const handleResultClick = () => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSearched(false);
  };

  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full sm:max-w-xs">
      <div className="relative">
        <SearchIcon
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
          style={{ color: "var(--text-muted)" }}
        />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => setOpen(true)}
          placeholder="Find people by @username…"
          aria-label="Find people by username"
          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-md border border-theme bg-theme-secondary text-theme-primary placeholder:text-theme-muted focus:outline-none focus:border-[#10b981] focus:ring-1 focus:ring-[#10b981]/40 transition-colors"
        />
      </div>

      {showDropdown && (
        <div
          role="listbox"
          className="absolute z-20 left-0 right-0 mt-2 max-h-80 overflow-y-auto rounded-md border shadow-xl"
          style={{
            background: "var(--bg-tertiary)",
            borderColor: "var(--border-subtle)",
          }}
        >
          {loading && (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-theme-secondary">
              <Loader2 className="w-4 h-4 animate-spin" />
              Searching…
            </div>
          )}

          {!loading && searched && results.length === 0 && (
            <div className="px-3 py-3 text-sm text-theme-secondary">
              No public profiles matched
              {" "}
              <span className="font-mono text-theme-primary">
                @{query.trim()}
              </span>
              .
            </div>
          )}

          {!loading && results.length > 0 && (
            <ul className="py-1">
              {results.map((p) => (
                <li key={p.id}>
                  <Link
                    to={
                      p.username
                        ? `/dashboard/u/${p.username}`
                        : `/dashboard/u/${p.id}`
                    }
                    onClick={handleResultClick}
                    className="flex items-start gap-3 px-3 py-2 hover:bg-theme-tertiary transition-colors"
                  >
                    <ResultAvatar profile={p} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium truncate text-theme-primary">
                          {p.display_name || p.username || "Intermission user"}
                        </span>
                        {p.username && (
                          <span className="text-xs text-theme-muted font-mono truncate">
                            @{p.username}
                          </span>
                        )}
                      </div>
                      {p.bio && (
                        <p className="mt-0.5 text-xs text-theme-secondary line-clamp-1">
                          {p.bio}
                        </p>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Avatar circle used in the search dropdown. Falls back to the first letter
 * of display_name/username when no avatar_url is set.
 */
const ResultAvatar: React.FC<{ profile: ProfileSearchResult }> = ({ profile }) => {
  const fallback = (
    profile.display_name || profile.username || "?"
  ).charAt(0).toUpperCase();

  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.display_name || profile.username || "Profile"}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
        style={{ border: "1px solid var(--border-focus)" }}
      />
    );
  }
  return (
    <div
      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0"
      style={{
        background: "var(--border-subtle)",
        color: "var(--text-primary)",
        border: "1px solid var(--border-focus)",
      }}
    >
      {fallback || <UserIcon className="w-4 h-4" />}
    </div>
  );
};