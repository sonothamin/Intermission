import React, { useState } from "react";
import { toast } from "react-hot-toast";
import { ConfirmModal } from "./ConfirmModal";
import {
  LibraryItem,
  WatchStatus,
  libraryApi,
  watchlistApi,
} from "../lib/api";
import { formatStatus } from "../lib/media";
import { Loader2, ListPlus, Plus, Check, Star } from "lucide-react";
import { CustomSelect } from "./CustomSelect";

interface MediaActionsProps {
  tmdbId: number;
  mediaType: "movie" | "tv";
  userEntry: LibraryItem | null;
  onUserEntryChange: (entry: LibraryItem | null) => void;
  /** Called with the new LibraryItem right after it is created. Awaited before loading stops. */
  onAfterAdd?: (entry: LibraryItem) => Promise<void>;
}

export const MediaActions: React.FC<MediaActionsProps> = ({
  tmdbId,
  mediaType,
  userEntry,
  onUserEntryChange,
  onAfterAdd,
}) => {
  const [loading, setLoading] = useState(false);
  const [inWatchlist, setInWatchlist] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleAddToLibrary = async () => {
    setLoading(true);
    try {
      const entry = await libraryApi.add({
        tmdb_id: tmdbId,
        media_type: mediaType,
        status: "watching",
      });
      if (onAfterAdd) {
        await onAfterAdd(entry);
      } else {
        onUserEntryChange(entry);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to add to library.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddToWatchlist = async () => {
    setLoading(true);
    try {
      await watchlistApi.add({
        tmdb_id: tmdbId,
        media_type: mediaType,
        priority: 0,
      });
      setInWatchlist(true);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add to watchlist.");
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (status: WatchStatus) => {
    if (!userEntry) return;
    setLoading(true);
    try {
      const updated = await libraryApi.update(userEntry.id, { status });
      onUserEntryChange(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRatingChange = async (rating: number | null) => {
    if (!userEntry) return;
    setLoading(true);
    try {
      const updated = await libraryApi.update(userEntry.id, { rating });
      onUserEntryChange(updated);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!userEntry) return;
    setShowConfirm(true);
  };

  const confirmRemove = async () => {
    if (!userEntry) return;
    setShowConfirm(false);
    setLoading(true);
    try {
      await libraryApi.remove(userEntry.id);
      onUserEntryChange(null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-[#a1a1aa]">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Updating...</span>
      </div>
    );
  }

  if (!userEntry) {
    return (
      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
        <button
          onClick={handleAddToLibrary}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" />
          Add to Library
        </button>
        {!inWatchlist && (
          <button
            onClick={handleAddToWatchlist}
            className="btn-secondary flex items-center gap-2 text-sm"
          >
            <ListPlus className="w-4 h-4" />
            Watchlist
          </button>
        )}
        {inWatchlist && (
          <span className="inline-flex items-center gap-1.5 px-3 py-2 text-sm text-[#8b5cf6] bg-[#8b5cf6]/10 border border-[#8b5cf6]/20 rounded-md">
            <Check className="w-4 h-4" />
            On Watchlist
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
        <CustomSelect
          value={userEntry.status}
          onChange={(val) => handleStatusChange(val as WatchStatus)}
          className="text-sm bg-[#1f1f1f] border border-[#27272a] rounded-md"
          buttonClassName="px-3 py-1.5"
          options={[
            { value: "watching", label: "Watching" },
            { value: "completed", label: "Completed" },
            { value: "plan_to_watch", label: "Plan to Watch" },
            { value: "on_hold", label: "On Hold" },
            { value: "dropped", label: "Dropped" },
            { value: "rewatching", label: "Rewatching" }
          ]}
        />

        <div className="flex items-center gap-1.5 bg-[#1f1f1f] border border-[#27272a] rounded-md px-2">
          <Star className="w-3.5 h-3.5 text-amber-500" />
          <CustomSelect
            value={userEntry.rating ?? ""}
            onChange={(val) => handleRatingChange(val ? parseFloat(val) : null)}
            className="text-sm bg-transparent"
            buttonClassName="py-1.5 px-2"
            placeholder="Rate"
            options={[
              { value: "", label: "Rate" },
              ...[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => ({ value: n, label: `${n}/10` }))
            ]}
          />
        </div>

        <button
          onClick={handleRemove}
          className="text-sm text-[#a1a1aa] hover:text-red-400 px-3 py-2 rounded-md hover:bg-red-400/10 transition-colors"
        >
          Remove
        </button>
      </div>

      <p className="text-xs text-[#52525b]">
        In your library · {formatStatus(userEntry.status)}
        {userEntry.rating ? ` · Rated ${userEntry.rating}/10` : ""}
      </p>

      <ConfirmModal
        isOpen={showConfirm}
        title="Remove Item"
        message="Are you sure you want to remove this item from your library? This action cannot be undone."
        confirmText="Remove"
        onConfirm={confirmRemove}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
};
