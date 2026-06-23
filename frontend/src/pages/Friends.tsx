import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import {
  UserPlus,
  UserX,
  Search as SearchIcon,
  Loader2,
  Check,
  X,
  AtSign,
  UserMinus,
  Clock,
  Users,
} from "lucide-react";
import { socialApi, FriendUser, FriendshipRow, SocialSearchResult } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type Tab = "friends" | "incoming" | "outgoing" | "find";

/**
 * Friends page — split into four tabs:
 *   - "friends"     → accepted friends (default)
 *   - "incoming"    → pending requests sent TO me
 *   - "outgoing"    → pending requests I have sent
 *   - "find"        → debounced public profile search for adding new people
 *
 * Every state-changing action optimistically reflects in the local list so the
 * UI feels instant; failures roll back the optimistic mutation and surface a
 * toast.
 */
export const Friends: React.FC = () => {
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>("friends");
  const [loading, setLoading] = useState(true);

  const [friends, setFriends] = useState<FriendshipRow[]>([]);
  const [incoming, setIncoming] = useState<FriendshipRow[]>([]);
  const [outgoing, setOutgoing] = useState<FriendshipRow[]>([]);

  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SocialSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<number | null>(null);

  const fetchLists = useCallback(async () => {
    setLoading(true);
    try {
      const [f, inc, out] = await Promise.all([
        socialApi.listFriends(),
        socialApi.listRequests("incoming"),
        socialApi.listRequests("outgoing"),
      ]);
      setFriends(f.friends ?? []);
      setIncoming(inc.requests ?? []);
      setOutgoing(out.requests ?? []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load friends.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  // Debounced search — 300ms is the sweet spot between feeling instant and
  // hammering the edge function while the user is still typing.
  useEffect(() => {
    if (tab !== "find") return;
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    const q = search.trim();
    if (q.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = window.setTimeout(async () => {
      try {
        const res = await socialApi.searchUsers(q);
        setSearchResults(res.users ?? []);
      } catch (err) {
        console.error(err);
        toast.error("Search failed.");
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [search, tab]);

  // Hide users that are already the current state on the friends/incoming/outgoing
  // lists — the action button is redundant in those cases and we'd otherwise be
  // offering "Add Friend" next to a row that already says "Friends".
  const hiddenIds = useMemo(() => {
    const ids = new Set<string>();
    if (user?.id) ids.add(user.id);
    friends.forEach((f) => ids.add(f.user.id));
    incoming.forEach((f) => ids.add(f.user.id));
    outgoing.forEach((f) => ids.add(f.user.id));
    return ids;
  }, [user, friends, incoming, outgoing]);

  const handleSend = async (target: { user_id: string; username: string | null }) => {
    // Optimistic: just remove from results; the row will appear in "outgoing"
    // after the user navigates back. This is a reasonable trade-off — the
    // alternative is a full refetch which feels heavy for a one-click action.
    const previous = searchResults;
    setSearchResults((rs) => rs.filter((r) => r.id !== target.user_id));
    try {
      await socialApi.sendRequest({ user_id: target.user_id });
      toast.success(`Friend request sent to @${target.username ?? "user"}.`);
      // Refresh outgoing so the count badge updates and the row is visible on
      // the outgoing tab.
      const res = await socialApi.listRequests("outgoing");
      setOutgoing(res.requests ?? []);
    } catch (err: any) {
      setSearchResults(previous);
      toast.error(err?.message ?? "Couldn't send request.");
    }
  };

  const handleAccept = async (row: FriendshipRow) => {
    setIncoming((rows) => rows.filter((r) => r.friendship_id !== row.friendship_id));
    try {
      await socialApi.respondRequest(row.friendship_id, true);
      toast.success(`You're now friends with @${row.user.username ?? "user"}.`);
      // Refresh friends so the new friend appears in the primary list.
      const res = await socialApi.listFriends();
      setFriends(res.friends ?? []);
    } catch (err: any) {
      // Roll back: re-insert in original position.
      setIncoming((rows) => [row, ...rows]);
      toast.error(err?.message ?? "Couldn't accept request.");
    }
  };

  const handleDecline = async (row: FriendshipRow) => {
    setIncoming((rows) => rows.filter((r) => r.friendship_id !== row.friendship_id));
    try {
      await socialApi.respondRequest(row.friendship_id, false);
    } catch (err: any) {
      setIncoming((rows) => [row, ...rows]);
      toast.error(err?.message ?? "Couldn't decline request.");
    }
  };

  const handleCancel = async (row: FriendshipRow) => {
    setOutgoing((rows) => rows.filter((r) => r.friendship_id !== row.friendship_id));
    try {
      await socialApi.cancelRequest(row.friendship_id);
      toast.success("Friend request cancelled.");
    } catch (err: any) {
      setOutgoing((rows) => [row, ...rows]);
      toast.error(err?.message ?? "Couldn't cancel request.");
    }
  };

  const handleUnfriend = async (row: FriendshipRow) => {
    if (!window.confirm(`Remove @${row.user.username ?? "this user"} as a friend?`)) {
      return;
    }
    setFriends((rows) => rows.filter((r) => r.friendship_id !== row.friendship_id));
    try {
      await socialApi.unfriend(row.user.id);
      toast.success("Friend removed.");
    } catch (err: any) {
      setFriends((rows) => [row, ...rows]);
      toast.error(err?.message ?? "Couldn't remove friend.");
    }
  };

  const incomingCount = incoming.length;
  const outgoingCount = outgoing.length;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Friends</h1>
        <p className="text-sm text-theme-secondary mt-1">
          Connect with other Intermission users. Friends can view each other's
          public watch history.
        </p>
      </header>

      {/* Tabs */}
      <div
        role="tablist"
        className="flex items-center gap-1 p-1 rounded-lg overflow-x-auto"
        style={{ background: "var(--bg-tertiary)", border: "1px solid var(--border-subtle)" }}
      >
        <TabButton
          active={tab === "friends"}
          onClick={() => setTab("friends")}
          icon={Users}
          label="Friends"
          count={friends.length}
        />
        <TabButton
          active={tab === "incoming"}
          onClick={() => setTab("incoming")}
          icon={UserPlus}
          label="Incoming"
          count={incomingCount}
          accent
        />
        <TabButton
          active={tab === "outgoing"}
          onClick={() => setTab("outgoing")}
          icon={Clock}
          label="Outgoing"
          count={outgoingCount}
        />
        <TabButton
          active={tab === "find"}
          onClick={() => setTab("find")}
          icon={SearchIcon}
          label="Find people"
        />
      </div>

      {loading && tab !== "find" ? (
        <div className="flex items-center justify-center h-48 text-theme-secondary gap-2">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading…
        </div>
      ) : tab === "friends" ? (
        <FriendsList rows={friends} onUnfriend={handleUnfriend} />
      ) : tab === "incoming" ? (
        <IncomingList rows={incoming} onAccept={handleAccept} onDecline={handleDecline} />
      ) : tab === "outgoing" ? (
        <OutgoingList rows={outgoing} onCancel={handleCancel} />
      ) : (
        <FindPeople
          search={search}
          onSearch={setSearch}
          searching={searching}
          results={searchResults.filter((r) => !hiddenIds.has(r.id))}
          onSend={handleSend}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ElementType;
  label: string;
  count?: number;
  /** Show the count badge in emerald (used for "actionable" tabs). */
  accent?: boolean;
}

const TabButton: React.FC<TabButtonProps> = ({ active, onClick, icon: Icon, label, count, accent }) => (
  <button
    type="button"
    role="tab"
    aria-selected={active}
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors whitespace-nowrap"
    style={{
      background: active ? "var(--bg-primary)" : "transparent",
      color: active ? "var(--text-primary)" : "var(--text-secondary)",
      boxShadow: active ? "0 1px 2px rgba(0,0,0,0.05)" : undefined,
    }}
  >
    <Icon className="w-4 h-4" />
    {label}
    {typeof count === "number" && count > 0 && (
      <span
        className="inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-[10px] font-semibold"
        style={{
          background: accent ? "rgba(16,185,129,0.15)" : "var(--border-subtle)",
          color: accent ? "#10b981" : "var(--text-secondary)",
        }}
      >
        {count}
      </span>
    )}
  </button>
);

/** Avatar used across all four tabs. Falls back to a coloured initial. */
const Avatar: React.FC<{ user: FriendUser | SocialSearchResult; size?: string }> = ({ user, size = "w-10 h-10" }) => {
  const fallback = (user.display_name || user.username || "?").charAt(0).toUpperCase();
  if (user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={user.display_name || user.username || "User"}
        className={`${size} rounded-full object-cover flex-shrink-0`}
        style={{ border: "1px solid var(--border-subtle)" }}
      />
    );
  }
  return (
    <div
      className={`${size} rounded-full flex-shrink-0 flex items-center justify-center text-base font-semibold`}
      style={{
        background: "var(--border-subtle)",
        color: "var(--text-primary)",
        border: "1px solid var(--border-focus)",
      }}
    >
      {fallback}
    </div>
  );
};

const PersonCard: React.FC<{
  user: FriendUser | SocialSearchResult;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}> = ({ user, subtitle, actions }) => {
  const handle = user.username;
  const display = user.display_name || user.username || "Intermission user";
  return (
    <div
      className="dense-card flex items-center gap-3"
    >
      <Avatar user={user} />
      <div className="flex-1 min-w-0">
        <Link
          to={handle ? `/dashboard/u/${handle}` : "#"}
          className="text-sm font-semibold text-theme-primary hover:underline truncate block"
        >
          {display}
        </Link>
        {handle && (
          <p className="flex items-center gap-1 text-xs text-theme-secondary">
            <AtSign className="w-3 h-3" />
            <span className="font-mono truncate">{handle}</span>
          </p>
        )}
        {subtitle && <div className="text-xs text-theme-secondary mt-1">{subtitle}</div>}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
};

const EmptyState: React.FC<{ icon: React.ElementType; title: string; description: string }> = ({
  icon: Icon,
  title,
  description,
}) => (
  <div className="dense-card flex flex-col items-center justify-center text-center py-12 gap-3">
    <Icon className="w-10 h-10 text-theme-muted" />
    <h2 className="text-base font-semibold text-theme-primary">{title}</h2>
    <p className="text-sm text-theme-secondary max-w-sm">{description}</p>
  </div>
);

const FriendsList: React.FC<{
  rows: FriendshipRow[];
  onUnfriend: (row: FriendshipRow) => void;
}> = ({ rows, onUnfriend }) => {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="No friends yet"
        description="Search for people by username and send a friend request to start building your network."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map((row) => (
        <PersonCard
          key={row.friendship_id}
          user={row.user}
          actions={
            <button
              type="button"
              onClick={() => onUnfriend(row)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-theme text-theme-secondary hover:text-red-400 hover:border-red-400/40 transition-colors"
              title="Remove friend"
            >
              <UserMinus className="w-3.5 h-3.5" />
              Unfriend
            </button>
          }
        />
      ))}
    </div>
  );
};

const IncomingList: React.FC<{
  rows: FriendshipRow[];
  onAccept: (row: FriendshipRow) => void;
  onDecline: (row: FriendshipRow) => void;
}> = ({ rows, onAccept, onDecline }) => {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={UserPlus}
        title="No incoming requests"
        description="When someone sends you a friend request, it'll show up here for you to accept or decline."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map((row) => (
        <PersonCard
          key={row.friendship_id}
          user={row.user}
          subtitle={<span>Wants to be friends</span>}
          actions={
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onDecline(row)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md border border-theme text-theme-secondary hover:text-red-400 hover:border-red-400/40 transition-colors"
                title="Decline"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onAccept(row)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-md bg-[#10b981] hover:bg-[#059669] text-black transition-colors"
                title="Accept"
              >
                <Check className="w-3.5 h-3.5" />
                Accept
              </button>
            </div>
          }
        />
      ))}
    </div>
  );
};

const OutgoingList: React.FC<{
  rows: FriendshipRow[];
  onCancel: (row: FriendshipRow) => void;
}> = ({ rows, onCancel }) => {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="No outgoing requests"
        description="Friend requests you send will appear here until they're accepted or declined."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {rows.map((row) => (
        <PersonCard
          key={row.friendship_id}
          user={row.user}
          subtitle={<span>Request pending</span>}
          actions={
            <button
              type="button"
              onClick={() => onCancel(row)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-theme text-theme-secondary hover:text-red-400 hover:border-red-400/40 transition-colors"
            >
              <UserX className="w-3.5 h-3.5" />
              Cancel
            </button>
          }
        />
      ))}
    </div>
  );
};

const FindPeople: React.FC<{
  search: string;
  onSearch: (q: string) => void;
  searching: boolean;
  results: SocialSearchResult[];
  onSend: (target: { user_id: string; username: string | null }) => void;
}> = ({ search, onSearch, searching, results, onSend }) => {
  return (
    <div className="space-y-4">
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search by @username or display name…"
          className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-theme text-sm text-theme-primary placeholder:text-theme-muted focus:outline-none focus:ring-2 focus:ring-[#10b981]/40"
          style={{ background: "var(--bg-tertiary)" }}
          autoFocus
        />
        {searching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-muted animate-spin" />
        )}
      </div>

      {search.trim().length < 2 ? (
        <EmptyState
          icon={SearchIcon}
          title="Find new people"
          description="Type at least two characters to search public profiles."
        />
      ) : results.length === 0 && !searching ? (
        <EmptyState
          icon={UserX}
          title="No matches"
          description="No public profiles matched that search. Try a different username or display name."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {results.map((u) => (
            <PersonCard
              key={u.id}
              user={u}
              subtitle={u.bio ? <span className="line-clamp-2">{u.bio}</span> : null}
              actions={
                <button
                  type="button"
                  onClick={() => onSend({ user_id: u.id, username: u.username })}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-[#10b981] hover:bg-[#059669] text-black transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  Add
                </button>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
};
