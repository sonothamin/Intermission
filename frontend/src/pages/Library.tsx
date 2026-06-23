import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { libraryApi, LibraryItem, WatchStatus } from "../lib/api";
import { toast } from "react-hot-toast";
import { ConfirmModal } from "../components/ConfirmModal";
import { WatchedDateModal } from "../components/WatchedDateModal";
import { mediaPath, mediaTypeBadge } from "../lib/media";
import { Loader2, Search, Filter, MoreVertical, Star, Film, Archive, List, LayoutGrid, Tv, Layers, Calendar } from "lucide-react";
import { format } from "date-fns";
import { CustomSelect } from "../components/CustomSelect";

const PAGE_SIZE = 50;

export const Library: React.FC = () => {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<WatchStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [mediaFilter, setMediaFilter] = useState<"all" | "movie" | "tv">("all");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [dateEditTarget, setDateEditTarget] = useState<LibraryItem | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const handleDeleteItem = async (id: string) => {
    setItemToDelete(id);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const id = itemToDelete;
    try {
      await libraryApi.remove(id);
      setItems(items.filter(item => item.id !== id));
      setActiveMenuId(null);
      setItemToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error("Failed to remove item.");
    }
  };

  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const res = await libraryApi.list({
        page: pageNum,
        limit: PAGE_SIZE,
        sort_by: "updated_at",
        sort_dir: "desc"
      });
      setItems(prev => append ? [...prev, ...res.data] : res.data);
      setHasMore(pageNum < res.pagination.total_pages);
      setPage(pageNum);
    } catch (err) {
      console.error(err);
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, []);

  const resetAndFetch = useCallback(() => {
    setItems([]);
    setHasMore(true);
    setPage(1);
    fetchPage(1, false);
  }, [fetchPage]);

  useEffect(() => {
    resetAndFetch();

    const onVisible = () => {
      if (document.visibilityState === "visible") resetAndFetch();
    };
    const onRefresh = () => resetAndFetch();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("library:refresh", onRefresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("library:refresh", onRefresh);
    };
  }, [resetAndFetch]);

  // Lazy load next page when the sentinel scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollContainerRef.current;
    if (!sentinel || !root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && hasMore && !loading && !loadingMore) {
          fetchPage(page + 1, true);
        }
      },
      { root, rootMargin: "200px", threshold: 0 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [fetchPage, hasMore, loading, loadingMore, page]);

  const handleStatusChange = async (id: string, newStatus: WatchStatus) => {
    try {
      await libraryApi.update(id, { status: newStatus });
      setItems(items.map(item => item.id === id ? { ...item, status: newStatus } : item));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRatingChange = async (id: string, newRating: number) => {
    try {
      await libraryApi.update(id, { rating: newRating });
      setItems(items.map(item => item.id === id ? { ...item, rating: newRating } : item));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDatesSaved = (id: string, updates: { started_at: string | null; completed_at: string | null }) => {
    setItems(items.map(item =>
      item.id === id ? { ...item, ...updates } : item,
    ));
  };

  const filteredItems = items.filter(item => {
    if (filter !== "all" && item.status !== filter) return false;
    if (mediaFilter !== "all" && item.media_type !== mediaFilter) return false;
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Library</h1>
          <p className="text-theme-secondary text-sm">Manage your watch history and progress.</p>
        </div>
        
        <div className="flex flex-wrap gap-3 w-full md:w-auto items-center">
          <div className="relative flex-1 min-w-[200px] md:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-theme-muted" />
            <input 
              type="text" 
              placeholder="Filter library..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 py-2 bg-theme-secondary border border-theme rounded-md text-sm text-theme-primary focus:border-[#10b981]"
            />
          </div>
          
          <CustomSelect
            value={filter}
            onChange={(val) => setFilter(val as WatchStatus | "all")}
            icon={<Filter className="w-4 h-4 text-theme-muted" />}
            className="bg-theme-secondary border border-theme rounded-md text-sm text-theme-primary"
            buttonClassName="py-2 px-3"
            align="right"
            options={[
              { value: "all", label: "All Statuses" },
              { value: "watching", label: "Watching" },
              { value: "completed", label: "Completed" },
              { value: "plan_to_watch", label: "Plan to Watch" },
              { value: "on_hold", label: "On Hold" },
              { value: "dropped", label: "Dropped" },
              { value: "rewatching", label: "Rewatching" }
            ]}
          />

          {/* Media Type Filter (Segmented Control) */}
          <div className="flex bg-theme-secondary border border-theme rounded-md p-0.5">
            <button
              onClick={() => setMediaFilter("all")}
              className={`flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${mediaFilter === "all" ? "bg-theme-tertiary text-theme-primary shadow-sm" : "text-theme-secondary hover:text-theme-primary"}`}
              title="All Media"
            >
              <Layers className="w-3.5 h-3.5 md:mr-1.5" />
              <span className="hidden md:inline">All</span>
            </button>
            <button
              onClick={() => setMediaFilter("movie")}
              className={`flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${mediaFilter === "movie" ? "bg-theme-tertiary text-theme-primary shadow-sm" : "text-theme-secondary hover:text-theme-primary"}`}
              title="Movies"
            >
              <Film className="w-3.5 h-3.5 md:mr-1.5" />
              <span className="hidden md:inline">Movies</span>
            </button>
            <button
              onClick={() => setMediaFilter("tv")}
              className={`flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${mediaFilter === "tv" ? "bg-theme-tertiary text-theme-primary shadow-sm" : "text-theme-secondary hover:text-theme-primary"}`}
              title="TV Shows"
            >
              <Tv className="w-3.5 h-3.5 md:mr-1.5" />
              <span className="hidden md:inline">TV</span>
            </button>
          </div>

          <div className="flex bg-theme-secondary border border-theme rounded-md overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${viewMode === "list" ? "bg-theme-tertiary text-theme-primary" : "text-theme-muted hover:text-theme-secondary"}`}
              title="List View"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-2 transition-colors ${viewMode === "grid" ? "bg-theme-tertiary text-theme-primary" : "text-theme-muted hover:text-theme-secondary"}`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <Link
            to="/dashboard/continue-rating"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-theme-secondary border border-theme text-sm font-medium text-theme-primary hover:bg-theme-tertiary hover:border-[#10b981]/40 transition-colors"
            title="Rate your unrated library items"
          >
            <Star className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Continue Rating</span>
            <span className="sm:hidden">Rate</span>
          </Link>
        </div>
      </div>

      <div className="flex-1 dense-card overflow-hidden flex flex-col p-0 relative">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-theme-secondary p-8">
            <Archive className="w-12 h-12 mb-4 text-theme-muted opacity-40" />
            <p>No items found in your library.</p>
          </div>
        ) : (
          <>
            {viewMode === "grid" && (
              <div ref={scrollContainerRef} className="flex-1 overflow-auto p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredItems.map(item => (
                    <div key={item.id} className="relative group rounded-lg bg-theme-secondary border border-theme hover:border-theme-focus transition-colors flex flex-col h-full">
                      <Link to={mediaPath(item.media_type, item.tmdb_id)} className="block aspect-[2/3] bg-theme-tertiary relative rounded-t-lg overflow-hidden">
                        {item.poster_url ? (
                          <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <Film className="w-8 h-8 m-auto absolute inset-0 text-theme-muted" />
                        )}
                      </Link>
                      <div className="p-3 flex-1 flex flex-col justify-between">
                        <div>
                          <Link to={mediaPath(item.media_type, item.tmdb_id)} className="font-semibold text-sm text-theme-primary leading-tight block hover:text-[#10b981] line-clamp-2">
                            {item.title}
                          </Link>
                          <div className="text-xs text-theme-secondary mt-1 flex items-center justify-between">
                            <span className={mediaTypeBadge(item.media_type).className.replace("text-[10px]", "text-[9px]").replace("px-1.5", "px-1")}>
                              {item.media_type}
                            </span>
                            <span>{item.release_year || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="absolute top-2 right-2 z-30">
                        <button 
                          onClick={(e) => { e.preventDefault(); setActiveMenuId(activeMenuId === item.id ? null : item.id); }}
                          className={`p-1.5 rounded-full transition-all bg-black/50 text-theme-primary hover:bg-black/80 backdrop-blur`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {activeMenuId === item.id && (
                          <>
                            <div className="fixed inset-0 z-40 cursor-default" onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} />
                            <div className="absolute right-0 mt-1 w-44 bg-theme-tertiary border border-theme rounded-md shadow-xl z-50 py-1 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                              <button
                                onClick={() => { setDateEditTarget(item); setActiveMenuId(null); }}
                                className="w-full text-left px-3 py-1.5 text-xs text-theme-primary hover:bg-theme-secondary font-medium transition-colors flex items-center gap-1.5"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                Edit watched dates
                              </button>
                              <div className="my-1 border-t border-theme" />
                              <button
                                onClick={() => handleDeleteItem(item.id)}
                                className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-500 font-medium transition-colors"
                              >
                                Delete
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div ref={sentinelRef} className="h-1" />
                {loadingMore && (
                  <div className="flex items-center justify-center py-4 text-theme-muted">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
                {!hasMore && items.length > 0 && (
                  <div className="text-center py-4 text-xs text-theme-muted">End of library</div>
                )}
              </div>
            )}

            {viewMode === "list" && (
              <div ref={scrollContainerRef} className="flex-1 overflow-auto flex flex-col">
                <table className="dense-table w-full table-fixed">
                  <thead className="bg-theme-secondary sticky top-0 z-10 shadow-sm border-b border-theme">
                    <tr>
                      <th className="w-16">Poster</th>
                      <th className="min-w-0">Title</th>
                      <th className="w-24">Type</th>
                      <th className="w-40">Status</th>
                      <th className="w-32">Progress</th>
                      <th className="w-32">Rating</th>
                      <th className="w-48 whitespace-nowrap">Watched</th>
                      <th className="w-32 text-right">Updated</th>
                      <th className="w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map(item => (
                      <tr key={item.id} className="group">
                        <td className="text-center p-2">
                          <Link to={mediaPath(item.media_type, item.tmdb_id)} className="block w-10 h-14 bg-theme-tertiary rounded overflow-hidden mx-auto hover:ring-2 hover:ring-[#10b981]/50 transition-all">
                            {item.poster_url ? (
                              <img src={item.poster_url} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <Film className="w-4 h-4 m-auto mt-5 text-theme-muted" />
                            )}
                          </Link>
                        </td>
                        <td className="min-w-0">
                          <Link
                            to={mediaPath(item.media_type, item.tmdb_id)}
                            className="block hover:text-[#10b981] transition-colors overflow-hidden"
                          >
                            <div className="font-medium text-theme-primary group-hover:text-[#10b981] truncate">{item.title}</div>
                            <div className="text-xs text-theme-muted">{item.release_year || "—"}</div>
                          </Link>
                        </td>
                        <td>
                          <span className={mediaTypeBadge(item.media_type).className}>
                            {item.media_type}
                          </span>
                        </td>
                        <td>
                          <CustomSelect 
                            value={item.status}
                            onChange={(val) => handleStatusChange(item.id, val as WatchStatus)}
                            className="bg-transparent text-xs w-full"
                            buttonClassName="py-1 px-2 hover:bg-theme-tertiary/50 rounded text-theme-secondary hover:text-theme-primary"
                            options={[
                              { value: "watching", label: "Watching" },
                              { value: "completed", label: "Completed" },
                              { value: "plan_to_watch", label: "Plan to Watch" },
                              { value: "on_hold", label: "On Hold" },
                              { value: "dropped", label: "Dropped" },
                              { value: "rewatching", label: "Rewatching" }
                            ]}
                          />
                        </td>
                        <td className="text-xs">
                          {item.media_type === "movie" ? (
                            item.times_watched > 0 ? `${item.times_watched} views` : "—"
                          ) : (
                            <div className="flex flex-col gap-0.5">
                              <span className={item.episodes_watched > 0 ? "text-theme-primary font-medium" : "text-theme-muted"}>
                                {item.current_season ? `S${item.current_season} ` : ""}E{item.current_episode ?? item.episodes_watched ?? 0}
                              </span>
                              <span className="text-theme-muted text-[10px]">
                                {item.episodes_watched ?? 0}/{item.total_episodes ?? "?"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-1 group/rating">
                            <Star className={`w-3.5 h-3.5 flex-shrink-0 ${item.rating ? 'fill-amber-500 text-amber-500' : 'text-theme-muted'}`} />
                            <CustomSelect
                              value={item.rating || ""}
                              onChange={(val) => handleRatingChange(item.id, val ? parseFloat(val) : 0)}
                              className="bg-transparent text-xs w-16"
                              buttonClassName="py-1 px-1 hover:bg-theme-tertiary/50 rounded text-theme-secondary hover:text-theme-primary"
                              placeholder="—"
                              options={[
                                { value: "", label: "—" },
                                ...[10,9,8,7,6,5,4,3,2,1].map(n => ({ value: n, label: String(n) }))
                              ]}
                            />
                          </div>
                        </td>
                        <td>
                          <button
                            onClick={() => setDateEditTarget(item)}
                            className="text-left text-xs text-theme-secondary hover:text-[#10b981] transition-colors group/dates"
                            title="Edit watched dates"
                          >
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-theme-muted group-hover/dates:text-[#10b981]" />
                              <div className="flex flex-col leading-tight whitespace-nowrap">
                                <span className={item.started_at ? "text-theme-primary" : "text-theme-muted"}>
                                  {item.started_at ? `${format(new Date(item.started_at), "MMM d, yyyy")}` : "Not started"}
                                </span>
                                {item.media_type === "movie" && (
                                  <span className={item.completed_at ? "text-theme-primary" : "text-theme-muted"}>
                                    {item.completed_at ? `${format(new Date(item.completed_at), "MMM d, yyyy")}` : "—"}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        </td>
                        <td className="text-right text-xs text-theme-muted whitespace-nowrap">
                          {format(new Date(item.updated_at), "MMM d, yyyy")}
                        </td>
                        <td className="text-center relative">
                          <button 
                            onClick={() => setActiveMenuId(activeMenuId === item.id ? null : item.id)}
                            className={`p-1 transition-all rounded hover:bg-theme-tertiary/50 text-theme-primary`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>
                          
                          {activeMenuId === item.id && (
                            <>
                              <div
                                className="fixed inset-0 z-40 cursor-default"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveMenuId(null);
                                }}
                              />
                              <div className="absolute right-2 mt-1 w-44 bg-theme-tertiary border border-theme rounded-md shadow-xl z-50 py-1 text-left animate-in fade-in slide-in-from-top-1 duration-150">
                                <button
                                  onClick={() => { setDateEditTarget(item); setActiveMenuId(null); }}
                                  className="w-full text-left px-3 py-1.5 text-xs text-theme-primary hover:bg-theme-secondary font-medium transition-colors flex items-center gap-1.5"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                  Edit watched dates
                                </button>
                                <div className="my-1 border-t border-theme" />
                                <button
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-500 font-medium transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div ref={sentinelRef} className="h-1" />
                {loadingMore && (
                  <div className="flex items-center justify-center py-4 text-theme-muted">
                    <Loader2 className="w-5 h-5 animate-spin" />
                  </div>
                )}
                {!hasMore && items.length > 0 && (
                  <div className="text-center py-4 text-xs text-theme-muted">End of library</div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={itemToDelete !== null}
        title="Remove Item"
        message="Are you sure you want to remove this item from your library? This action cannot be undone."
        confirmText="Remove"
        onConfirm={confirmDelete}
        onCancel={() => setItemToDelete(null)}
      />

      <WatchedDateModal
        isOpen={dateEditTarget !== null}
        libraryId={dateEditTarget?.id ?? ""}
        title={dateEditTarget?.title ?? ""}
        mediaType={dateEditTarget?.media_type ?? "movie"}
        initialStartedAt={dateEditTarget?.started_at ?? null}
        initialCompletedAt={dateEditTarget?.completed_at ?? null}
        onClose={() => setDateEditTarget(null)}
        onSaved={(updates) => {
          if (dateEditTarget) handleDatesSaved(dateEditTarget.id, updates);
        }}
      />
    </div>
  );
};
