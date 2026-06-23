import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Globe,
  MapPin,
  Calendar,
  AtSign,
  Loader2,
  Lock,
  UserX,
  Settings as SettingsIcon,
  Clock as ClockIcon,
  Film as FilmIcon,
  Tv as TvIcon,
  Trophy as TrophyIcon,
  UserPlus,
  UserCheck,
  Check,
  X as XIcon,
  Archive,
} from "lucide-react";
import { toast } from "react-hot-toast";
import {
  profileApi,
  UserProfile,
  FriendStatus,
  libraryApi,
  LibraryItem,
  socialApi,
} from "../lib/api";
import { StatCard } from "../components/StatCard";
import { useAuth } from "../context/AuthContext";
import { mediaPath } from "../lib/media";

interface WatchStats {
  movies_watched?: number;
  total_movies?: number;
  series_tracked?: number;
  series_completed?: number;
  series_watching?: number;
  series_dropped?: number;
  total_hours_watched?: number;
  avg_rating?: number | null;
}

/**
 * Friendly avatar that uses the URL when present and falls back to the
 * profile's display_name / username / email initial.
 */
const ProfileAvatar: React.FC<{
  profile: Pick<UserProfile, "avatar_url" | "display_name" | "username">;
  email?: string | null;
  sizeClass?: string;
}> = ({ profile, email, sizeClass = "w-24 h-24" }) => {
  const fallback = (
    profile.display_name || profile.username || email || "?"
  ).charAt(0).toUpperCase();

  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.display_name || profile.username || "Profile"}
        className={`${sizeClass} rounded-full object-cover border-2 border-theme`}
        style={{ borderColor: "var(--border-focus)" }}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center text-2xl font-semibold`}
      style={{
        background: "var(--border-subtle)",
        color: "var(--text-primary)",
        border: "2px solid var(--border-focus)",
      }}
    >
      {fallback}
    </div>
  );
};

/**
 * Public profile view at /u/:username.
 *
 * Mirrors the Dashboard stats row but scoped to whichever profile the URL
 * refers to. Owners land here from the sidebar/topbar avatar; visitors land
 * here from shared links. Private profiles render a friendly "private" state
 * instead of leaking data.
 */
export const Profile: React.FC = () => {
  const { username } = useParams<{ username: string }>();
  const { user, profile: ownProfile } = useAuth();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<WatchStats | null>(null);
  const [friendStatus, setFriendStatus] = useState<FriendStatus | null>(null);
  const [friendshipId, setFriendshipId] = useState<string | null>(null);
  const [friendActionPending, setFriendActionPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not_found" | "private" | "unknown" | null>(null);

  // Library preview — only fetched when the viewer is allowed to see it
  // (own profile, or an accepted friend of a public profile).
  const [libraryItems, setLibraryItems] = useState<LibraryItem[]>([]);
  const [libraryTotal, setLibraryTotal] = useState(0);
  const [libraryLoading, setLibraryLoading] = useState(false);
  // We also keep a "show 50 by default" per-section cap so the two
  // Movies / TV Show grids mirror the Library page's full grid look instead
  // of rendering the prior 2–3 row preview.
  const LIBRARY_PREVIEW_LIMIT = 50;

  // Re-fetch the profile and reconcile local state with server truth. Used
  // both as the initial load and after any friend action so that
  // `friendStatus` (and the library gating that depends on it) stays in
  // sync — previously the page only set state on send/cancel/accept/unfriend
  // optimistically, so a 409 ("already friends") or any other server-side
  // divergence would leave the UI stuck on the wrong button forever.
  const refreshProfile = useCallback(
    async (opts?: { silent?: boolean }): Promise<FriendStatus | null> => {
      if (!username) return null;
      try {
        const res = await profileApi.getByUsername(username);
        setProfile(res.profile);
        setStats(res.stats ?? null);
        const next: FriendStatus | null = res.friend_status ?? null;
        setFriendStatus(next);
        // The server doesn't surface the row id through the profile endpoint;
        // for the `accepted` case we don't need it.
        if (next === "accepted") setFriendshipId(null);
        return next;
      } catch (err) {
        if (!opts?.silent) {
          const msg = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
          if (msg.includes("not found")) {
            setError("not_found");
          } else if (msg.includes("access denied") || msg.includes("forbidden")) {
            setError("private");
          } else {
            setError("unknown");
          }
        }
        return null;
      }
    },
    [username],
  );

  useEffect(() => {
    let active = true;

    if (!username) {
      setError("not_found");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setProfile(null);
    setStats(null);
    setFriendStatus(null);
    setFriendshipId(null);
    setLibraryItems([]);

    refreshProfile()
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [username, refreshProfile]);

  // When we know the relationship, decide whether to load the library preview.
  // Owners always see their own library; non-owners only see it if they're
  // an accepted friend. The "self viewing private profile" case is already
  // handled by the profile endpoint returning the data.
  const canViewLibrary = !!profile && (
    ownProfile?.id === profile.id || friendStatus === "accepted"
  );

  useEffect(() => {
    if (!canViewLibrary || !profile) return;
    let active = true;
    setLibraryLoading(true);
    libraryApi
      .list({
        user_id: profile.id,
        page: 1,
        limit: LIBRARY_PREVIEW_LIMIT,
        sort_by: "updated_at",
        sort_dir: "desc",
      })
      .then((res) => {
        if (!active) return;
        setLibraryItems(res.data ?? []);
        setLibraryTotal(res.pagination?.total ?? res.data?.length ?? 0);
      })
      .catch((err) => {
        console.error("Failed to load library preview", err);
        if (!active) return;
        setLibraryItems([]);
        setLibraryTotal(0);
      })
      .finally(() => {
        if (active) setLibraryLoading(false);
      });
    return () => {
      active = false;
    };
  }, [canViewLibrary, profile]);

  /**
   * Look up the friendship id for a pending_incoming request so we can accept
   * or decline from the profile page itself. Done lazily because the
   * profile endpoint doesn't return the row id and we only need it for this
   * one status.
   */
  const ensureIncomingFriendshipId = useCallback(async (): Promise<string | null> => {
    if (friendStatus !== "pending_incoming") return null;
    if (friendshipId) return friendshipId;
    try {
      const res = await socialApi.listRequests("incoming");
      const match = (res.requests ?? []).find(
        (r) => profile && r.user.id === profile.id,
      );
      if (match) {
        setFriendshipId(match.friendship_id);
        return match.friendship_id;
      }
    } catch (err) {
      console.error("Failed to look up incoming request", err);
    }
    return null;
  }, [friendStatus, friendshipId, profile]);

  const handleFriendAction = async () => {
    if (!profile || friendActionPending) return;
    if (friendStatus === "none") {
      setFriendActionPending(true);
      try {
        await socialApi.sendRequest({ user_id: profile.id });
        setFriendStatus("pending_outgoing");
        toast.success(`Friend request sent to @${profile.username ?? "user"}.`);
      } catch (err: any) {
        const msg = (err?.message ?? "").toLowerCase();
        // The local state was stale — server says we're already friends (or a
        // request already exists). Re-sync the UI from server truth instead
        // of leaving the user stuck on a button that will keep 409-ing.
        if (msg.includes("already friend") || msg.includes("already exists")) {
          await refreshProfile();
          toast(msg.includes("already friend")
            ? `You're already friends with @${profile.username ?? "this user"}.`
            : "A friend request is already pending.");
        } else {
          toast.error(err?.message ?? "Couldn't send friend request.");
        }
      } finally {
        setFriendActionPending(false);
      }
      return;
    }

    if (friendStatus === "pending_outgoing") {
      // Outgoing — clicking cancels. We need the row id from the outgoing
      // list.
      setFriendActionPending(true);
      try {
        const res = await socialApi.listRequests("outgoing");
        const match = (res.requests ?? []).find(
          (r) => r.user.id === profile.id,
        );
        if (match) {
          await socialApi.cancelRequest(match.friendship_id);
        }
        setFriendStatus("none");
        toast.success("Friend request cancelled.");
      } catch (err: any) {
        toast.error(err?.message ?? "Couldn't cancel friend request.");
        // Re-sync from server in case the state diverged (e.g. they accepted
        // the request while we were trying to cancel).
        await refreshProfile();
      } finally {
        setFriendActionPending(false);
      }
      return;
    }

    if (friendStatus === "pending_incoming") {
      // Default action for an incoming request is "Accept" — decline is a
      // separate, secondary button next to it.
      setFriendActionPending(true);
      try {
        const id = await ensureIncomingFriendshipId();
        if (!id) {
          toast.error("Couldn't find that request anymore.");
          await refreshProfile();
          return;
        }
        await socialApi.respondRequest(id, true);
        setFriendStatus("accepted");
        toast.success(`You're now friends with @${profile.username ?? "user"}.`);
        // Re-fetch so the server-canonical friend_status wins; the library
        // effect will pick up the change on its own.
        await refreshProfile({ silent: true });
      } catch (err: any) {
        toast.error(err?.message ?? "Couldn't accept request.");
        await refreshProfile();
      } finally {
        setFriendActionPending(false);
      }
      return;
    }

    if (friendStatus === "accepted") {
      if (
        !window.confirm(
          `Remove @${profile.username ?? "this user"} as a friend?`,
        )
      ) {
        return;
      }
      setFriendActionPending(true);
      try {
        await socialApi.unfriend(profile.id);
        setFriendStatus("none");
        toast.success("Friend removed.");
        await refreshProfile({ silent: true });
      } catch (err: any) {
        toast.error(err?.message ?? "Couldn't remove friend.");
        await refreshProfile();
      } finally {
        setFriendActionPending(false);
      }
    }
  };

  const handleDeclineIncoming = async () => {
    if (!profile || friendActionPending) return;
    setFriendActionPending(true);
    try {
      const id = await ensureIncomingFriendshipId();
      if (!id) {
        toast.error("Couldn't find that request anymore.");
        await refreshProfile();
        return;
      }
      await socialApi.respondRequest(id, false);
      setFriendStatus("none");
      toast.success("Friend request declined.");
      await refreshProfile({ silent: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Couldn't decline request.");
      await refreshProfile();
    } finally {
      setFriendActionPending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-theme-secondary gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        Loading profile…
      </div>
    );
  }

  if (error === "not_found") {
    return (
      <div className="dense-card flex flex-col items-center justify-center text-center py-16 gap-3">
        <UserX className="w-10 h-10 text-theme-muted" />
        <h1 className="text-xl font-semibold">User not found</h1>
        <p className="text-sm text-theme-secondary max-w-sm">
          We couldn't find a user with the handle
          {" "}
          <span className="font-mono text-theme-primary">@{username}</span>.
          They may have changed their username or deleted their account.
        </p>
        <Link
          to="/dashboard"
          className="mt-2 text-sm font-medium text-[#10b981] hover:underline"
        >
          Back to your dashboard
        </Link>
      </div>
    );
  }

  if (error === "private") {
    return (
      <div className="dense-card flex flex-col items-center justify-center text-center py-16 gap-3">
        <Lock className="w-10 h-10 text-theme-muted" />
        <h1 className="text-xl font-semibold">This profile is private</h1>
        <p className="text-sm text-theme-secondary max-w-sm">
          <span className="font-mono text-theme-primary">@{username}</span>
          {" "}
          has chosen to keep their watch history private.
        </p>
        <Link
          to="/dashboard"
          className="mt-2 text-sm font-medium text-[#10b981] hover:underline"
        >
          Back to your dashboard
        </Link>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="dense-card flex flex-col items-center justify-center text-center py-16 gap-3">
        <h1 className="text-xl font-semibold">Couldn't load profile</h1>
        <p className="text-sm text-theme-secondary max-w-sm">
          Something went wrong while loading this profile. Please try again in a moment.
        </p>
        <Link
          to="/dashboard"
          className="mt-2 text-sm font-medium text-[#10b981] hover:underline"
        >
          Back to your dashboard
        </Link>
      </div>
    );
  }

  const isOwnProfile = ownProfile?.id === profile.id;
  const displayName = profile.display_name || profile.username || "Intermission user";
  const memberSince = new Date(profile.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
  });

  const moviesWatched = stats?.movies_watched ?? 0;
  const totalMovies = stats?.total_movies ?? 0;
  const seriesTracked = stats?.series_tracked ?? 0;
  const totalHours = stats?.total_hours_watched ?? 0;
  const totalMinutes = Math.round(totalHours * 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const avgRating = stats?.avg_rating ?? null;

  return (
    <div className="space-y-6">
      {/* Hero / header card */}
      <section className="dense-card overflow-hidden p-0">
        {profile.banner_url ? (
          <div
            className="h-32 sm:h-40 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${profile.banner_url})` }}
            aria-hidden
          />
        ) : (
          <div
            className="h-32 sm:h-40 w-full"
            style={{
              background:
                "linear-gradient(135deg, rgba(16,185,129,0.18), rgba(59,130,246,0.10))",
            }}
            aria-hidden
          />
        )}

        <div className="px-6 pb-6 -mt-12 flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-shrink-0">
            <ProfileAvatar profile={profile} email={user?.email} sizeClass="w-24 h-24" />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight truncate">
                  {displayName}
                </h1>
                {profile.username && (
                  <p className="flex items-center gap-1 text-sm text-theme-secondary">
                    <AtSign className="w-3.5 h-3.5" />
                    <span className="font-mono">{profile.username}</span>
                  </p>
                )}
              </div>

              {isOwnProfile ? (
                <Link
                  to="/dashboard/settings"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-theme text-sm font-medium text-theme-primary hover:bg-theme-tertiary hover:border-[#10b981]/40 transition-colors"
                >
                  <SettingsIcon className="w-4 h-4" />
                  Edit profile
                </Link>
              ) : friendStatus === "pending_incoming" ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleFriendAction}
                    disabled={friendActionPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#10b981] hover:bg-[#059669] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                  >
                    {friendActionPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={handleDeclineIncoming}
                    disabled={friendActionPending}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-theme text-sm font-medium text-theme-primary hover:bg-theme-tertiary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    <XIcon className="w-4 h-4" />
                    Decline
                  </button>
                </div>
              ) : friendStatus === "pending_outgoing" ? (
                <button
                  type="button"
                  onClick={handleFriendAction}
                  disabled={friendActionPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-theme text-sm font-medium text-theme-primary hover:bg-theme-tertiary disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {friendActionPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <XIcon className="w-4 h-4" />
                  )}
                  Request sent
                </button>
              ) : friendStatus === "accepted" ? (
                <button
                  type="button"
                  onClick={handleFriendAction}
                  disabled={friendActionPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#10b981]/40 text-[#10b981] text-sm font-medium hover:bg-[#10b981]/10 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {friendActionPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  Friends
                </button>
              ) : friendStatus === "none" ? (
                <button
                  type="button"
                  onClick={handleFriendAction}
                  disabled={friendActionPending}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#10b981] hover:bg-[#059669] disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                >
                  {friendActionPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <UserPlus className="w-4 h-4" />
                  )}
                  Add friend
                </button>
              ) : null}
            </div>

            {profile.bio && (
              <p className="mt-3 text-sm text-theme-primary whitespace-pre-line">
                {profile.bio}
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-theme-secondary">
              <span className="inline-flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                Joined {memberSince}
              </span>
              {profile.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {profile.location}
                </span>
              )}
              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#10b981] hover:underline truncate max-w-[16rem]"
                >
                  <Globe className="w-3.5 h-3.5" />
                  {prettyWebsite(profile.website)}
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Stats row — same StatCard chrome as the Dashboard summary */}
      <section
        aria-label="Watch stats"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          icon={ClockIcon}
          color="emerald"
          label="Total Watch Time"
          value={
            days > 0
              ? `${days}d ${hours}h`
              : hours > 0
                ? `${hours}h ${minutes}m`
                : `${minutes}m`
          }
          hint={
            days > 0
              ? `${hours}h ${minutes}m extra`
              : `${totalHours.toFixed(1)} hours total`
          }
        />
        <StatCard
          icon={FilmIcon}
          color="blue"
          label="Movies Watched"
          value={moviesWatched}
          hint={<>{totalMovies} in library</>}
        />
        <StatCard
          icon={TvIcon}
          color="purple"
          label="Series Tracked"
          value={seriesTracked}
          hint={
            avgRating !== null ? <>Avg rating {avgRating.toFixed(1)}/10</> : null
          }
        />
        <StatCard
          icon={TrophyIcon}
          color="amber"
          label="Member Since"
          value={new Date(profile.created_at).getFullYear()}
          hint={<>@{profile.username ?? "user"}</>}
        />
      </section>

      {isOwnProfile && !profile.username && (
        <div className="dense-card text-sm text-theme-secondary">
          <p>
            <strong className="text-theme-primary">Claim your handle.</strong>{" "}
            You don't have a username yet, so your profile isn't reachable via
            a public link. Pick one in{" "}
            <Link
              to="/dashboard/settings"
              className="text-[#10b981] hover:underline"
            >
              Settings
            </Link>
            .
          </p>
        </div>
      )}

      {/* Library preview — only rendered when the viewer is allowed to see
          this profile's library (own profile, or accepted friend). Split
          into Movies and TV Shows sections so each gets its own grid, and
          the layout mirrors the Library page's grid view (same poster card
          chrome, dense-card wrapper, hover state). */}
      {canViewLibrary && (
        <section aria-label="Library preview" className="space-y-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Archive className="w-5 h-5 text-theme-secondary" />
              Library
            </h2>
            <span className="text-xs text-theme-secondary">
              {libraryTotal} {libraryTotal === 1 ? "item" : "items"}
            </span>
          </div>

          {libraryLoading ? (
            <div className="dense-card flex items-center justify-center h-40 text-theme-secondary gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading library…
            </div>
          ) : libraryItems.length === 0 ? (
            <div className="dense-card text-center py-10 text-sm text-theme-secondary">
              {isOwnProfile
                ? "Your library is empty. Add a movie or show to get started."
                : `@${profile.username ?? "user"} hasn't added anything to their library yet.`}
            </div>
          ) : (
            <>
              <ProfileLibrarySection
                title="Movies"
                icon={<FilmIcon className="w-5 h-5 text-blue-400" />}
                items={libraryItems.filter((it) => it.media_type === "movie")}
                totalLabel="movies"
              />
              <ProfileLibrarySection
                title="TV Shows"
                icon={<TvIcon className="w-5 h-5 text-purple-400" />}
                items={libraryItems.filter((it) => it.media_type === "tv")}
                totalLabel="shows"
              />
            </>
          )}
        </section>
      )}
    </div>
  );
};

/**
 * One Media Type section in the profile library preview.
 *
 * Renders the same `dense-card` + `aspect-[2/3]` poster card chrome as the
 * Library page's grid view, with a header showing the section icon, label,
 * and total count. When the section is empty (e.g. user only has TV in
 * their library), we render a small empty card explaining that so the
 * page never shows a naked header with no content.
 */
const ProfileLibrarySection: React.FC<{
  title: string;
  icon: React.ReactNode;
  items: LibraryItem[];
  totalLabel: string;
}> = ({ title, icon, items, totalLabel }) => {
  // Hide sections with zero items so the page doesn't render an empty
  // header + empty card (which would look broken) — unless the user
  // explicitly wants to see the "nothing here yet" affordance.
  if (items.length === 0) return null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-md font-semibold flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <span className="text-xs text-theme-secondary">
          {items.length} {totalLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        {items.map((item) => (
          <Link
            key={item.id}
            to={mediaPath(item.media_type, item.tmdb_id)}
            className="group dense-card overflow-hidden p-0 hover:border-[#10b981]/40 transition-colors"
          >
            <div className="aspect-[2/3] w-full bg-theme-tertiary overflow-hidden">
              {item.poster_url ? (
                <img
                  src={item.poster_url}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-theme-muted text-xs">
                  No poster
                </div>
              )}
            </div>
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium truncate" title={item.title}>
                {item.title}
              </p>
              <p className="text-[10px] uppercase tracking-wide text-theme-secondary">
                <span
                  className={
                    item.media_type === "movie"
                      ? "text-blue-400"
                      : "text-purple-400"
                  }
                >
                  {item.media_type === "movie" ? "Movie" : "TV"}
                </span>
                {item.release_year ? ` · ${item.release_year}` : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
};

// Local icon imports — kept inline so the page owns its iconography and the
// Stats grid reads as one cohesive block above.

/** Strip a noisy protocol + trailing slash for compact display. */
function prettyWebsite(url: string): string {
  try {
    const u = new URL(url);
    return u.host + (u.pathname && u.pathname !== "/" ? u.pathname : "");
  } catch {
    return url;
  }
}