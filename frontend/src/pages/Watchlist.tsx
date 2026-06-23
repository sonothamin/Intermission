import React, { useEffect, useMemo, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { watchlistApi, WatchlistItem, libraryApi } from "../lib/api";
import { mediaPath } from "../lib/media";
import {
  Loader2,
  ListPlus,
  Film,
  Trash2,
  ArrowUp,
  ArrowDown,
  List,
  LayoutGrid,
  Tv,
  Layers,
  Search,
  ArrowUpDown,
  Play,
  X,
  Inbox,
} from "lucide-react";
import { CustomSelect } from "../components/CustomSelect";

type ViewMode = "list" | "grid";
type MediaFilter = "all" | "movie" | "tv";
type SortKey = "priority" | "recent" | "title";

const SORT_OPTIONS: { value: SortKey; label: React.ReactNode }[] = [
  { value: "priority", label: "Highest priority" },
  { value: "recent", label: "Recently added" },
  { value: "title", label: "Title (A–Z)" },
];

export const Watchlist: React.FC = () => {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("priority");

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const res = await watchlistApi.list({ sort_by: "priority", sort_dir: "desc" });
      setItems(res.data);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't load your watchlist.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlist();
  }, []);

  const handlePriorityChange = async (id: string, current: number, change: number) => {
    const newPriority = current + change;
    try {
      await watchlistApi.update(id, { priority: newPriority });
      // Optimistic sort
      const newItems = items.map(item => (item.id === id ? { ...item, priority: newPriority } : item));
      newItems.sort((a, b) => b.priority - a.priority);
      setItems(newItems);
    } catch (err) {
      console.error(err);
      toast.error("Couldn't update priority.");
    }
  };

  const handleRemove = async (id: string, title: string) => {
    if (!window.confirm(`Remove "${title}" from your watchlist?`)) return;
    try {
      await watchlistApi.remove(id);
      setItems(items.filter(item => item.id !== id));
      toast.success(`Removed "${title}"`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove item.");
    }
  };

  const handleMoveToLibrary = async (item: WatchlistItem) => {
    try {
      await libraryApi.add({
        tmdb_id: item.tmdb_id,
        media_type: item.media_type,
        status: "watching",
      });
      // The backend doesn't auto-remove from watchlist yet — clean up client-side.
      await watchlistApi.remove(item.id);
      setItems(items.filter(i => i.id !== item.id));
      toast.success(`"${item.title}" added to your library`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to move to library.");
    }
  };

  // --- Derived state ---------------------------------------------------------

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();
    let list = items.filter(item => {
      if (mediaFilter !== "all" && item.media_type !== mediaFilter) return false;
      if (term && !item.title.toLowerCase().includes(term)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      switch (sortKey) {
        case "recent":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "title":
          return a.title.localeCompare(b.title);
        case "priority":
        default:
          return b.priority - a.priority;
      }
    });
    return list;
  }, [items, mediaFilter, search, sortKey]);

  const stats = useMemo(() => {
    const total = items.length;
    if (total === 0) return { total: 0, movies: 0, tv: 0, topPriority: 0, avgPriority: 0 };
    const movies = items.filter(i => i.media_type === "movie").length;
    const tv = total - movies;
    const topPriority = items.reduce((max, i) => Math.max(max, i.priority), 0);
    const avgPriority = Math.round(items.reduce((sum, i) => sum + i.priority, 0) / total);
    return { total, movies, tv, topPriority, avgPriority };
  }, [items]);

  const hasActiveSearch = search.trim().length > 0;

  // --- Render ----------------------------------------------------------------

  return (
    <div className="flex flex-col h-full gap-5">
      {/* ── Header band ─────────────────────────────────────────────────────── */}
      <header className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-[0.18em] text-[#10b981] font-semibold">
              Watchlist
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-theme-primary">
              Your Queue
            </h1>
            <p className="text-theme-secondary text-sm">
              Prioritize what to watch next.
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search */}
            <div className="relative flex-1 min-w-[180px] sm:w-56">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted pointer-events-none" />
              <input
                type="text"
                placeholder="Search queue…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-theme-secondary border border-theme rounded-md text-sm text-theme-primary placeholder:text-theme-muted focus:border-[#10b981] focus:outline-none focus:ring-2 focus:ring-[#10b981]/20 transition-colors"
                aria-label="Search watchlist"
              />
              {hasActiveSearch && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-theme-muted hover:text-theme-primary rounded transition-colors"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort */}
            <CustomSelect
              value={sortKey}
              onChange={(val) => setSortKey(val as SortKey)}
              icon={<ArrowUpDown className="w-4 h-4 text-theme-muted" />}
              className="bg-theme-secondary border border-theme rounded-md text-sm text-theme-primary"
              buttonClassName="py-2 px-3"
              align="right"
              options={SORT_OPTIONS}
            />

            {/* Media type segmented control */}
            <div
              className="flex bg-theme-secondary border border-theme rounded-md p-0.5"
              role="tablist"
              aria-label="Media type filter"
            >
              {([
                { v: "all", label: "All", icon: Layers, title: "All media" },
                { v: "movie", label: "Movies", icon: Film, title: "Movies only" },
                { v: "tv", label: "TV", icon: Tv, title: "TV shows only" },
              ] as const).map(({ v, label, icon: Icon, title }) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={mediaFilter === v}
                  onClick={() => setMediaFilter(v)}
                  className={`flex items-center justify-center px-2.5 sm:px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${
                    mediaFilter === v
                      ? "bg-theme-tertiary text-theme-primary shadow-sm"
                      : "text-theme-secondary hover:text-theme-primary"
                  }`}
                  title={title}
                >
                  <Icon className="w-3.5 h-3.5 sm:mr-1.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>

            {/* View toggle */}
            <div className="flex bg-theme-secondary border border-theme rounded-md overflow-hidden">
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 transition-colors ${
                  viewMode === "list"
                    ? "bg-theme-tertiary text-theme-primary"
                    : "text-theme-muted hover:text-theme-secondary"
                }`}
                title="List view"
                aria-pressed={viewMode === "list"}
              >
                <List className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 transition-colors ${
                  viewMode === "grid"
                    ? "bg-theme-tertiary text-theme-primary"
                    : "text-theme-muted hover:text-theme-secondary"
                }`}
                title="Grid view"
                aria-pressed={viewMode === "grid"}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Stats + count strip */}
        {!loading && stats.total > 0 && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-theme-secondary border border-theme text-xs">
              <Inbox className="w-3.5 h-3.5 text-[#10b981]" />
              <span className="text-theme-secondary">
                Showing <span className="font-semibold text-theme-primary">{filteredItems.length}</span>
                {" "}of <span className="font-semibold text-theme-primary">{stats.total}</span>
              </span>
            </div>
            <div className="hidden md:flex items-center gap-2 text-xs text-theme-secondary">
              <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 font-medium">
                {stats.movies} {stats.movies === 1 ? "movie" : "movies"}
              </span>
              <span className="px-2 py-1 rounded bg-purple-500/10 text-purple-400 font-medium">
                {stats.tv} {stats.tv === 1 ? "show" : "shows"}
              </span>
              <span className="px-2 py-1 rounded bg-[#10b981]/10 text-[#10b981] font-medium">
                Top priority: {stats.topPriority}
              </span>
              <span className="px-2 py-1 rounded bg-theme-tertiary text-theme-secondary font-medium">
                Avg: {stats.avgPriority}
              </span>
            </div>
          </div>
        )}
      </header>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 dense-card overflow-hidden flex flex-col p-0 min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            title="Your queue is empty"
            description="Browse and add titles you want to watch — they'll line up here, ready to prioritize."
            icon={<ListPlus className="w-10 h-10" />}
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState
            title="No matches"
            description={
              hasActiveSearch
                ? `Nothing in your queue matches "${search}". Try a different term.`
                : "No titles match the current filter."
            }
            icon={<Search className="w-10 h-10" />}
            action={
              hasActiveSearch
                ? { label: "Clear search", onClick: () => setSearch("") }
                : undefined
            }
          />
        ) : (
          <>
            {viewMode === "list" && (
              <ListView
                items={filteredItems}
                onPriorityChange={handlePriorityChange}
                onRemove={handleRemove}
                onMoveToLibrary={handleMoveToLibrary}
              />
            )}
            {viewMode === "grid" && (
              <GridView
                items={filteredItems}
                onPriorityChange={handlePriorityChange}
                onRemove={handleRemove}
                onMoveToLibrary={handleMoveToLibrary}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ===========================================================================
// Sub-components
// ===========================================================================

interface EmptyStateProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: { label: string; onClick: () => void };
}

const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, action }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center px-6 py-12">
    <div className="w-20 h-20 rounded-2xl bg-theme-secondary border border-theme flex items-center justify-center mb-5 text-theme-muted">
      {icon}
    </div>
    <h3 className="text-lg font-semibold text-theme-primary">{title}</h3>
    <p className="text-theme-secondary text-sm mt-1.5 max-w-sm">{description}</p>
    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
      {!action && (
        <Link
          to="/dashboard/search"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#10b981] hover:bg-[#10b981]/90 text-white text-sm font-medium transition-colors"
        >
          <Search className="w-4 h-4" />
          Find something to watch
        </Link>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#10b981] hover:bg-[#10b981]/90 text-white text-sm font-medium transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  </div>
);

interface ItemActionsProps {
  item: WatchlistItem;
  onMoveToLibrary: (item: WatchlistItem) => void;
  onRemove: (id: string, title: string) => void;
  variant: "inline" | "stacked";
}

const ItemActions: React.FC<ItemActionsProps> = ({ item, onMoveToLibrary, onRemove, variant }) => {
  if (variant === "stacked") {
    return (
      <div className="flex items-center gap-1">
        <button
          onClick={() => onMoveToLibrary(item)}
          className="p-2 text-theme-muted hover:text-[#10b981] hover:bg-[#10b981]/10 rounded-md transition-colors"
          title="Start watching"
          aria-label="Start watching"
        >
          <Play className="w-4 h-4" />
        </button>
        <button
          onClick={() => onRemove(item.id, item.title)}
          className="p-2 text-theme-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
          title="Remove from watchlist"
          aria-label="Remove from watchlist"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2 sm:flex-shrink-0">
      <button
        onClick={() => onRemove(item.id, item.title)}
        className="p-1.5 text-theme-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
        title="Remove from watchlist"
        aria-label="Remove from watchlist"
      >
        <Trash2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => onMoveToLibrary(item)}
        className="inline-flex items-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-md bg-[#10b981] hover:bg-[#10b981]/90 text-white whitespace-nowrap transition-colors"
      >
        <Play className="w-3.5 h-3.5" />
        Start Watching
      </button>
    </div>
  );
};

interface PriorityControlProps {
  priority: number;
  isTop: boolean;
  onChange: (delta: number) => void;
  orientation?: "vertical" | "horizontal";
  compact?: boolean;
}

const PriorityControl: React.FC<PriorityControlProps> = ({
  priority,
  isTop,
  onChange,
  orientation = "vertical",
  compact = false,
}) => {
  const disabledUp = isTop && priority >= 100;
  if (orientation === "horizontal") {
    return (
      <div className="inline-flex items-center bg-theme-tertiary border border-theme rounded-md overflow-hidden">
        <button
          onClick={() => onChange(-1)}
          className="p-1.5 text-theme-muted hover:text-red-500 hover:bg-red-500/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-theme-muted transition-colors"
          aria-label="Decrease priority"
        >
          <ArrowDown className="w-3.5 h-3.5" />
        </button>
        <span className="px-2 text-xs font-mono font-bold text-theme-primary min-w-[2.25rem] text-center tabular-nums">
          {priority}
        </span>
        <button
          onClick={() => onChange(1)}
          disabled={disabledUp}
          className="p-1.5 text-theme-muted hover:text-[#10b981] hover:bg-[#10b981]/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-theme-muted transition-colors"
          aria-label="Increase priority"
        >
          <ArrowUp className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center gap-0.5 ${
        compact ? "w-7" : "w-9"
      } flex-shrink-0`}
    >
      <button
        onClick={() => onChange(1)}
        disabled={disabledUp}
        className="p-0.5 text-theme-muted hover:text-[#10b981] disabled:opacity-30 disabled:hover:text-theme-muted transition-colors rounded"
        title="Increase priority"
        aria-label="Increase priority"
      >
        <ArrowUp className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </button>
      <span
        className={`text-xs font-mono font-bold text-theme-primary tabular-nums ${
          priority >= 80 ? "text-[#10b981]" : priority >= 50 ? "text-amber-400" : "text-theme-secondary"
        }`}
        title={`Priority ${priority}`}
      >
        {priority}
      </span>
      <button
        onClick={() => onChange(-1)}
        className="p-0.5 text-theme-muted hover:text-red-500 transition-colors rounded"
        title="Decrease priority"
        aria-label="Decrease priority"
      >
        <ArrowDown className={compact ? "w-3.5 h-3.5" : "w-4 h-4"} />
      </button>
    </div>
  );
};

// ----- List View -------------------------------------------------------------

interface ListViewProps {
  items: WatchlistItem[];
  onPriorityChange: (id: string, current: number, change: number) => void;
  onRemove: (id: string, title: string) => void;
  onMoveToLibrary: (item: WatchlistItem) => void;
}

const ListView: React.FC<ListViewProps> = ({ items, onPriorityChange, onRemove, onMoveToLibrary }) => (
  <div className="flex-1 overflow-auto p-3 sm:p-4">
    <ul className="space-y-2">
      {items.map((item, index) => (
        <li
          key={item.id}
          className="group flex items-stretch gap-2 sm:gap-3 p-2 sm:p-3 bg-theme-secondary border border-theme rounded-lg hover:border-theme-focus transition-colors"
        >
          {/* Priority (vertical, always visible) */}
          <div className="flex items-center">
            <PriorityControl
              priority={item.priority}
              isTop={index === 0}
              onChange={(delta) => onPriorityChange(item.id, item.priority, delta)}
              orientation="vertical"
              compact
            />
          </div>

          {/* Poster */}
          <Link
            to={mediaPath(item.media_type, item.tmdb_id)}
            className="w-14 h-20 sm:w-16 sm:h-24 bg-theme-tertiary rounded-md overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-[#10b981]/50 transition-all"
          >
            {item.poster_url ? (
              <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="w-5 h-5 text-theme-muted" />
              </div>
            )}
          </Link>

          {/* Info */}
          <div className="flex-1 min-w-0 py-0.5 flex flex-col">
            <div className="flex items-start gap-2 min-w-0">
              <Link
                to={mediaPath(item.media_type, item.tmdb_id)}
                className="font-semibold text-theme-primary text-sm sm:text-base leading-tight hover:text-[#10b981] transition-colors truncate flex-1 min-w-0"
              >
                {item.title}
              </Link>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              <span
                className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                  item.media_type === "movie"
                    ? "bg-blue-500/10 text-blue-400"
                    : "bg-purple-500/10 text-purple-400"
                }`}
              >
                {item.media_type === "movie" ? "Movie" : "TV"}
              </span>
              {item.release_year && (
                <span className="text-xs text-theme-secondary">{item.release_year}</span>
              )}
              {item.content_rating && (
                <span className="text-[10px] text-theme-secondary border border-theme px-1 rounded">
                  {item.content_rating}
                </span>
              )}
              {item.genres?.slice(0, 2).map(g => (
                <span key={g} className="text-[10px] text-theme-muted hidden md:inline">
                  · {g}
                </span>
              ))}
            </div>
            {item.notes && (
              <p className="hidden sm:block text-xs text-theme-secondary mt-1.5 italic line-clamp-2">
                "{item.notes}"
              </p>
            )}

            {/* Mobile action row */}
            <div className="flex sm:hidden items-center gap-2 mt-2">
              <button
                onClick={() => onMoveToLibrary(item)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-medium py-1.5 px-3 rounded-md bg-[#10b981] hover:bg-[#10b981]/90 text-white transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Start Watching
              </button>
              <button
                onClick={() => onRemove(item.id, item.title)}
                className="p-2 text-theme-muted hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                aria-label="Remove from watchlist"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Desktop actions */}
          <div className="hidden sm:flex items-center pl-3 border-l border-theme">
            <ItemActions item={item} onMoveToLibrary={onMoveToLibrary} onRemove={onRemove} variant="stacked" />
          </div>
        </li>
      ))}
    </ul>
  </div>
);

// ----- Grid View -------------------------------------------------------------

interface GridViewProps {
  items: WatchlistItem[];
  onPriorityChange: (id: string, current: number, change: number) => void;
  onRemove: (id: string, title: string) => void;
  onMoveToLibrary: (item: WatchlistItem) => void;
}

const GridView: React.FC<GridViewProps> = ({ items, onPriorityChange, onRemove, onMoveToLibrary }) => (
  <div className="flex-1 overflow-auto p-3 sm:p-4">
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
      {items.map((item, index) => (
        <article
          key={item.id}
          className="group relative flex flex-col bg-theme-secondary border border-theme rounded-lg overflow-hidden hover:border-theme-focus transition-colors"
        >
          {/* Poster */}
          <Link
            to={mediaPath(item.media_type, item.tmdb_id)}
            className="block aspect-[2/3] bg-theme-tertiary relative overflow-hidden"
          >
            {item.poster_url ? (
              <img
                src={item.poster_url}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="w-8 h-8 text-theme-muted" />
              </div>
            )}

            {/* Priority badge */}
            <div className="absolute top-2 left-2 inline-flex items-center gap-0.5 bg-black/70 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-xs font-mono font-bold text-white tabular-nums shadow-md">
              <ArrowUp className="w-3 h-3 opacity-70" />
              {item.priority}
            </div>

            {/* Type badge */}
            <div className="absolute top-2 right-2">
              <span
                className={`inline-flex items-center gap-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded backdrop-blur-sm ${
                  item.media_type === "movie"
                    ? "bg-blue-500/30 text-blue-100"
                    : "bg-purple-500/30 text-purple-100"
                }`}
              >
                {item.media_type === "movie" ? <Film className="w-3 h-3" /> : <Tv className="w-3 h-3" />}
              </span>
            </div>

            {/* Hover overlay (desktop) */}
            <div className="absolute inset-x-0 bottom-0 hidden sm:flex items-center justify-center gap-1 p-2 bg-gradient-to-t from-black/80 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  onMoveToLibrary(item);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#10b981] hover:bg-[#10b981]/90 text-white text-xs font-medium transition-colors"
              >
                <Play className="w-3.5 h-3.5" />
                Start
              </button>
            </div>
          </Link>

          {/* Footer */}
          <div className="p-2.5 sm:p-3 flex flex-col gap-2 flex-1">
            <div className="min-w-0">
              <Link
                to={mediaPath(item.media_type, item.tmdb_id)}
                className="font-semibold text-xs sm:text-sm text-theme-primary leading-snug block hover:text-[#10b981] transition-colors line-clamp-2"
                title={item.title}
              >
                {item.title}
              </Link>
              <div className="text-[11px] text-theme-secondary mt-1 flex items-center gap-2">
                <span>{item.release_year || "—"}</span>
                {item.content_rating && (
                  <>
                    <span className="text-theme-muted">•</span>
                    <span className="border border-theme px-1 rounded text-[10px]">{item.content_rating}</span>
                  </>
                )}
              </div>
            </div>

            {/* Controls row */}
            <div className="mt-auto flex items-center justify-between gap-1 pt-2 border-t border-theme">
              <PriorityControl
                priority={item.priority}
                isTop={index === 0}
                onChange={(delta) => onPriorityChange(item.id, item.priority, delta)}
                orientation="horizontal"
              />
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onMoveToLibrary(item)}
                  className="sm:hidden p-1.5 text-[#10b981] hover:bg-[#10b981]/10 rounded transition-colors"
                  title="Start watching"
                  aria-label="Start watching"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  onClick={() => onRemove(item.id, item.title)}
                  className="p-1.5 text-theme-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                  title="Remove"
                  aria-label="Remove from watchlist"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  </div>
);
