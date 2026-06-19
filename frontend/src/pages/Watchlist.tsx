import React, { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { watchlistApi, WatchlistItem, libraryApi } from "../lib/api";
import { mediaPath } from "../lib/media";
import { Loader2, ListPlus, Film, Trash2, ArrowUp, ArrowDown, List, LayoutGrid, Tv, Layers } from "lucide-react";

export const Watchlist: React.FC = () => {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [mediaFilter, setMediaFilter] = useState<"all" | "movie" | "tv">("all");

  const fetchWatchlist = async () => {
    setLoading(true);
    try {
      const res = await watchlistApi.list({ sort_by: "priority", sort_dir: "desc" });
      setItems(res.data);
    } catch (err) {
      console.error(err);
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
      const newItems = items.map(item => item.id === id ? { ...item, priority: newPriority } : item);
      newItems.sort((a, b) => b.priority - a.priority);
      setItems(newItems);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemove = async (id: string) => {
    try {
      await watchlistApi.remove(id);
      setItems(items.filter(item => item.id !== id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveToLibrary = async (item: WatchlistItem) => {
    try {
      await libraryApi.add({
        tmdb_id: item.tmdb_id,
        media_type: item.media_type,
        status: "watching"
      });
      // Optionally remove from watchlist here, but our backend doesn't automatically do it yet.
      // So let's manually remove it for better UX.
      await watchlistApi.remove(item.id);
      setItems(items.filter(i => i.id !== item.id));
    } catch (err) {
      console.error(err);
      toast.error("Failed to move to library.");
    }
  };

  const filteredItems = items.filter(item => {
    if (mediaFilter !== "all" && item.media_type !== mediaFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6 flex flex-col h-full">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">Your Queue</h1>
          <p className="text-[#a1a1aa] text-sm">Prioritize what to watch next.</p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
          {/* Media Type Filter (Segmented Control) */}
          <div className="flex bg-[#141414] border border-[#27272a] rounded-md p-0.5">
            <button
              onClick={() => setMediaFilter("all")}
              className={`flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${mediaFilter === "all" ? "bg-[#27272a] text-[#ededed] shadow-sm" : "text-[#a1a1aa] hover:text-[#ededed]"}`}
              title="All Media"
            >
              <Layers className="w-3.5 h-3.5 md:mr-1.5" />
              <span className="hidden md:inline">All</span>
            </button>
            <button
              onClick={() => setMediaFilter("movie")}
              className={`flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${mediaFilter === "movie" ? "bg-[#27272a] text-[#ededed] shadow-sm" : "text-[#a1a1aa] hover:text-[#ededed]"}`}
              title="Movies"
            >
              <Film className="w-3.5 h-3.5 md:mr-1.5" />
              <span className="hidden md:inline">Movies</span>
            </button>
            <button
              onClick={() => setMediaFilter("tv")}
              className={`flex items-center justify-center px-3 py-1.5 text-xs font-medium rounded-sm transition-all ${mediaFilter === "tv" ? "bg-[#27272a] text-[#ededed] shadow-sm" : "text-[#a1a1aa] hover:text-[#ededed]"}`}
              title="TV Shows"
            >
              <Tv className="w-3.5 h-3.5 md:mr-1.5" />
              <span className="hidden md:inline">TV</span>
            </button>
          </div>

          <div className="flex bg-[#141414] border border-[#27272a] rounded-md overflow-hidden">
          <button 
            onClick={() => setViewMode("list")} 
            className={`p-2 transition-colors ${viewMode === "list" ? "bg-[#27272a] text-[#ededed]" : "text-[#52525b] hover:text-[#a1a1aa]"}`}
            title="List View"
          >
            <List className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setViewMode("grid")} 
            className={`p-2 transition-colors ${viewMode === "grid" ? "bg-[#27272a] text-[#ededed]" : "text-[#52525b] hover:text-[#a1a1aa]"}`}
            title="Grid View"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
        </div>
      </div>
      </div>

      <div className="flex-1 dense-card overflow-hidden flex flex-col p-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-[#10b981] animate-spin" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-[#a1a1aa] p-8">
            <ListPlus className="w-12 h-12 mb-4 text-[#27272a]" />
            <p>Your watchlist is empty.</p>
            <Link to="/search" className="mt-4 text-[#10b981] hover:underline text-sm font-medium">Find something to watch</Link>
          </div>
        ) : (
          <>
            {viewMode === "list" && (
              <div className="flex-1 overflow-auto p-4 space-y-3">
                {filteredItems.map((item, index) => (
                  <div key={item.id} className="flex gap-4 p-3 bg-[#141414] border border-[#27272a] rounded-lg group hover:border-[#3f3f46] transition-colors">
                    
                    {/* Priority Controls */}
                    <div className="flex flex-col items-center justify-center gap-1 w-8">
                      <button 
                        onClick={() => handlePriorityChange(item.id, item.priority, 1)}
                        className="p-1 text-[#52525b] hover:text-[#10b981] disabled:opacity-30"
                        disabled={index === 0 && item.priority >= 100}
                      >
                        <ArrowUp className="w-5 h-5" />
                      </button>
                      <span className="text-xs font-mono font-bold text-[#ededed]">{item.priority}</span>
                      <button 
                        onClick={() => handlePriorityChange(item.id, item.priority, -1)}
                        className="p-1 text-[#52525b] hover:text-red-500 disabled:opacity-30"
                      >
                        <ArrowDown className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Poster */}
                    <Link
                      to={mediaPath(item.media_type, item.tmdb_id)}
                      className="w-16 h-24 bg-[#27272a] rounded overflow-hidden flex-shrink-0 hover:ring-2 hover:ring-[#10b981]/50 transition-all"
                    >
                      {item.poster_url ? (
                        <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <Film className="w-6 h-6 m-auto mt-9 text-[#52525b]" />
                      )}
                    </Link>

                    {/* Info */}
                    <div className="flex-1 py-1 flex flex-col min-w-0">
                      <Link
                        to={mediaPath(item.media_type, item.tmdb_id)}
                        className="font-semibold text-[#ededed] text-lg leading-tight hover:text-[#10b981] transition-colors truncate"
                      >
                        {item.title}
                      </Link>
                      <div className="flex gap-2 mt-1">
                        <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                          item.media_type === 'movie' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                        }`}>
                          {item.media_type}
                        </span>
                        <span className="text-xs text-[#a1a1aa]">{item.release_year || "Unknown"}</span>
                        {item.content_rating && <span className="text-xs text-[#a1a1aa] border border-[#27272a] px-1 rounded">{item.content_rating}</span>}
                      </div>
                      
                      {item.notes && (
                        <p className="text-sm text-[#a1a1aa] mt-2 italic flex-1">"{item.notes}"</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col justify-between items-end gap-2 border-l border-[#27272a] pl-4">
                      <button 
                        onClick={() => handleRemove(item.id)}
                        className="p-1.5 text-[#52525b] hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                        title="Remove from watchlist"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <button 
                        onClick={() => handleMoveToLibrary(item)}
                        className="btn-primary text-xs py-1.5 px-3 whitespace-nowrap"
                      >
                        Start Watching
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {viewMode === "grid" && (
              <div className="flex-1 overflow-auto p-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {filteredItems.map((item, index) => (
                    <div key={item.id} className="relative group rounded-lg overflow-hidden bg-[#141414] border border-[#27272a] hover:border-[#3f3f46] transition-colors flex flex-col h-full">
                      <Link to={mediaPath(item.media_type, item.tmdb_id)} className="block aspect-[2/3] bg-[#27272a] relative">
                        {item.poster_url ? (
                          <img src={item.poster_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <Film className="w-8 h-8 m-auto absolute inset-0 text-[#52525b]" />
                        )}
                        <div className="absolute top-2 left-2 bg-black/60 backdrop-blur rounded px-1.5 py-0.5 text-xs font-mono font-bold text-[#ededed]">
                          {item.priority}
                        </div>
                      </Link>
                      <div className="p-3 flex-1 flex flex-col justify-between gap-3">
                        <div>
                          <Link to={mediaPath(item.media_type, item.tmdb_id)} className="font-semibold text-sm text-[#ededed] leading-tight block hover:text-[#10b981] line-clamp-2">
                            {item.title}
                          </Link>
                          <div className="text-xs text-[#a1a1aa] mt-1 flex items-center justify-between">
                            <span className={`text-[9px] uppercase font-bold px-1 py-0.5 rounded ${
                              item.media_type === 'movie' ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                            }`}>
                              {item.media_type}
                            </span>
                            <span>{item.release_year || "—"}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-[#27272a] pt-2">
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handlePriorityChange(item.id, item.priority, 1)}
                              className="p-1 text-[#52525b] hover:text-[#10b981] hover:bg-[#10b981]/10 rounded disabled:opacity-30"
                              disabled={index === 0 && item.priority >= 100}
                              title="Increase Priority"
                            >
                              <ArrowUp className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handlePriorityChange(item.id, item.priority, -1)}
                              className="p-1 text-[#52525b] hover:text-red-500 hover:bg-red-500/10 rounded disabled:opacity-30"
                              title="Decrease Priority"
                            >
                              <ArrowDown className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleMoveToLibrary(item)}
                              className="p-1 text-[#52525b] hover:text-[#10b981] hover:bg-[#10b981]/10 rounded"
                              title="Start Watching"
                            >
                              <ListPlus className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleRemove(item.id)}
                              className="p-1 text-[#52525b] hover:text-red-500 hover:bg-red-500/10 rounded"
                              title="Remove from watchlist"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
