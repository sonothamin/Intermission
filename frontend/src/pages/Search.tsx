import React, { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Link } from "react-router-dom";
import { searchApi, SearchResult, libraryApi, watchlistApi } from "../lib/api";
import { formatStatus, mediaPath } from "../lib/media";
import { Search as SearchIcon, Plus, ListPlus, Loader2, Film } from "lucide-react";

export const Search: React.FC = () => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 500);
    return () => clearTimeout(timer);
  }, [query]);

  // Fetch results
  useEffect(() => {
    const fetchResults = async () => {
      setLoading(true);
      try {
        if (debouncedQuery.trim() === "") {
          const res = await searchApi.trending();
          setResults(res.results);
        } else {
          const res = await searchApi.search(debouncedQuery);
          setResults(res.results);
        }
      } catch (err) {
        console.error("Failed to fetch search results", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchResults();
  }, [debouncedQuery]);

  const handleAddToLibrary = async (item: SearchResult) => {
    setActionLoading(item.tmdb_id);
    try {
      await libraryApi.add({
        tmdb_id: item.tmdb_id,
        media_type: item.media_type,
        status: "plan_to_watch"
      });
      // Optimistically update UI
      setResults(results.map(r => 
        r.tmdb_id === item.tmdb_id 
          ? { ...r, user_status: { status: "plan_to_watch", rating: null } }
          : r
      ));
    } catch (err) {
      console.error(err);
      toast.error("Failed to add to library. It might already exist.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddToWatchlist = async (item: SearchResult) => {
    setActionLoading(item.tmdb_id);
    try {
      await watchlistApi.add({
        tmdb_id: item.tmdb_id,
        media_type: item.media_type,
        priority: 0
      });
      // Optimistically update UI
      setResults(results.map(r => 
        r.tmdb_id === item.tmdb_id 
          ? { ...r, in_watchlist: true }
          : r
      ));
    } catch (err) {
      console.error(err);
      toast.error("Failed to add to watchlist. It might already exist.");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Search Media</h1>
        <p className="text-theme-secondary text-sm">Find movies and TV shows to add to your library.</p>
      </div>

      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <SearchIcon className="h-5 w-5 text-theme-muted" />
        </div>
        <input
          type="text"
          className="w-full pl-10 py-3 bg-theme-secondary border border-theme rounded-lg text-theme-primary placeholder:text-theme-muted focus:border-[#10b981] transition-colors outline-none text-lg"
          placeholder="Search for Inception, Breaking Bad..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && (
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <Loader2 className="h-5 w-5 text-[#10b981] animate-spin" />
          </div>
        )}
      </div>

      <div className="space-y-4">
        {debouncedQuery === "" && results.length > 0 && (
          <h2 className="text-sm font-semibold text-theme-secondary uppercase tracking-wider mb-4">Trending Today</h2>
        )}
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {results.map((item) => (
            <div key={`${item.media_type}-${item.tmdb_id}`} className="dense-card flex flex-col group hover:border-theme-focus transition-colors p-3">
              <Link to={mediaPath(item.media_type, item.tmdb_id)} className="block">
                <div className="aspect-[2/3] w-full bg-theme-tertiary rounded overflow-hidden relative mb-3">
                  {item.poster_url ? (
                    <img 
                      src={item.poster_url} 
                      alt={item.title} 
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" 
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Film className="w-12 h-12 text-theme-muted" />
                    </div>
                  )}
                  
                  <div className="absolute top-2 right-2 flex gap-1">
                    <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-md ${
                      item.media_type === 'movie' ? 'bg-blue-500/80 text-white' : 'bg-purple-500/80 text-white'
                    }`}>
                      {item.media_type === 'movie' ? 'Movie' : 'TV'}
                    </span>
                  </div>
                </div>

                <h3 className="font-semibold text-theme-primary leading-tight mb-1 line-clamp-2 group-hover:text-[#10b981] transition-colors" title={item.title}>
                  {item.title}
                </h3>
                <p className="text-xs text-theme-secondary mb-3">
                  {item.release_year || "Unknown Year"} • {item.vote_average ? `${item.vote_average.toFixed(1)}/10` : "Unrated"}
                </p>
              </Link>

                <div className="mt-auto pt-3 border-t border-theme flex gap-2">
                  {item.user_status ? (
                    <div className="flex-1 py-1.5 text-center bg-[#10b981]/10 text-[#10b981] rounded text-xs font-medium border border-[#10b981]/20">
                      In Library ({formatStatus(item.user_status.status)})
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddToLibrary(item)}
                      disabled={actionLoading === item.tmdb_id}
                      className="flex-1 py-1.5 flex items-center justify-center gap-1 bg-theme-tertiary hover:bg-[#10b981] hover:text-black text-theme-primary text-xs font-medium rounded transition-colors"
                    >
                      {actionLoading === item.tmdb_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      Library
                    </button>
                  )}

                  {!item.user_status && !item.in_watchlist ? (
                    <button
                      onClick={() => handleAddToWatchlist(item)}
                      disabled={actionLoading === item.tmdb_id}
                      className="py-1.5 px-3 flex items-center justify-center bg-theme-tertiary hover:bg-theme-tertiary text-theme-primary rounded transition-colors"
                      title="Add to Watchlist"
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
                  
                  {item.in_watchlist && !item.user_status ? (
                    <div className="py-1.5 px-3 flex items-center justify-center bg-[#8b5cf6]/10 text-[#8b5cf6] border border-[#8b5cf6]/20 rounded" title="In Watchlist">
                      <ListPlus className="w-3.5 h-3.5" />
                    </div>
                  ) : null}
                </div>
            </div>
          ))}
        </div>
        
        {!loading && debouncedQuery !== "" && results.length === 0 && (
          <div className="text-center py-12 text-theme-secondary">
            No results found for "{debouncedQuery}"
          </div>
        )}
      </div>
    </div>
  );
};
