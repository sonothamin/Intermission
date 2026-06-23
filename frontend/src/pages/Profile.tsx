import React, { useEffect, useState } from "react";
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
} from "lucide-react";
import { profileApi, UserProfile } from "../lib/api";
import { StatCard } from "../components/StatCard";
import { useAuth } from "../context/AuthContext";

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<"not_found" | "private" | "unknown" | null>(null);

  useEffect(() => {
    let active = true;

    if (!username) {
      setError("not_found");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    profileApi
      .getByUsername(username)
      .then((res) => {
        if (!active) return;
        setProfile(res.profile);
        setStats(res.stats ?? null);
      })
      .catch((err: Error) => {
        if (!active) return;
        // The backend uses a generic "Access denied" message for both private
        // profiles and missing ones. Distinguish them by HTTP status when
        // possible — we surfaced the underlying message via err.message.
        const msg = (err?.message ?? "").toLowerCase();
        if (msg.includes("not found")) {
          setError("not_found");
        } else if (msg.includes("access denied") || msg.includes("forbidden")) {
          setError("private");
        } else {
          setError("unknown");
        }
        setProfile(null);
        setStats(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [username]);

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

              {isOwnProfile && (
                <Link
                  to="/dashboard/settings"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-theme text-sm font-medium text-theme-primary hover:bg-theme-tertiary hover:border-[#10b981]/40 transition-colors"
                >
                  <SettingsIcon className="w-4 h-4" />
                  Edit profile
                </Link>
              )}
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