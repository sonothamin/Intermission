import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { libraryApi, LibraryItem, WatchStatus } from "../lib/api";
import { toast } from "react-hot-toast";
import { ConfirmModal } from "../components/ConfirmModal";
import { mediaPath } from "../lib/media";
import { Loader2, Search, Filter, MoreVertical, Star, Film, Archive, List, LayoutGrid, Tv, Layers } from "lucide-react";
import { format } from "date-fns";
import { CustomSelect } from "../components/CustomSelect";

export const Library: React.FC = () => {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WatchStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [mediaFilter, setMediaFilter] = useState<"all" | "movie" | "tv">("all");
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

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

  const fetchLibrary = async () => {
    setLoading(true);
    try {
      const res = await libraryApi.list({ 
        limit: 100,
        sort_by: "updated_at",
        sort_dir: "desc"
      });
      setItems(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();

    const onVisible = () => {
      if (document.visibilityState === "visible") fetchLibrary();
    };
    const onRefresh = () => fetchLibrary();

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("library:refresh", onRefresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("library:refresh", onRefresh);
    };
  }, []);

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
              <div className="flex-1 overflow-auto p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredItems.map(item => (
                    <div key={item.id} className="relative group rounded-lg overflow-hidden bg-theme-secondary border border-theme hover:border-theme-focus transition-colors flex flex-col h-full">
                      <Link to={mediaPath(item.media_type, item.tmdb_id)} className="block aspect-[2/3] bg-theme-tertiary relative">
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
                            <span className={`text-[9px] uppercase font-bold px-1 py-0.5 rounded ${
                              item.media_type === 'movie' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                            }`}>
                              {item.media_type}
                            </span>
                            <span>{item.release_year || "—"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="absolute top-2 right-2 z-10">
                        <button 
                          onClick={(e) => { e.preventDefault(); setActiveMenuId(activeMenuId === item.id ? null : item.id); }}
                          className={`p-1.5 rounded-full transition-all bg-black/50 text-theme-primary hover:bg-black/80 backdrop-blur`}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {activeMenuId === item.id && (
                          <>
                            <div className="fixed inset-0 z-40 cursor-default" onClick={(e) => { e.stopPropagation(); setActiveMenuId(null); }} />
                            <div className="absolute right-0 mt-1 w-28 bg-theme-tertiary border border-theme rounded-md shadow-xl z-50 py-1 text-left animate-in fade-in slide-in-from-top-1 duration-150">
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
              </div>
            )}

            {viewMode === "list" && (
              <div className="flex-1 overflow-auto">
                <table className="dense-table w-full">
                  <thead className="bg-theme-secondary sticky top-0 z-10 shadow-sm border-b border-theme">
                    <tr>
                      <th className="w-16">Poster</th>
                      <th>Title</th>
                      <th className="w-24">Type</th>
                      <th className="w-40">Status</th>
                      <th className="w-32">Progress</th>
                      <th className="w-32">Rating</th>
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
                        <td>
                          <Link
                            to={mediaPath(item.media_type, item.tmdb_id)}
                            className="block hover:text-[#10b981] transition-colors"
                          >
                            <div className="font-medium text-theme-primary group-hover:text-[#10b981]">{item.title}</div>
                            <div className="text-xs text-theme-muted">{item.release_year || "—"}</div>
                          </Link>
                        </td>
                        <td>
                          <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                            item.media_type === 'movie' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                          }`}>
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
                        <td className="text-right text-xs text-theme-muted">
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
                              <div className="absolute right-2 mt-1 w-28 bg-theme-tertiary border border-theme rounded-md shadow-xl z-50 py-1 text-left animate-in fade-in slide-in-from-top-1 duration-150">
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
    </div>
  );
};
