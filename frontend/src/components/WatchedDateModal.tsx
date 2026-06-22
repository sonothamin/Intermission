import React, { useEffect, useState } from "react";
import { Calendar, X } from "lucide-react";
import { libraryApi } from "../lib/api";

interface WatchedDateModalProps {
  isOpen: boolean;
  libraryId: string;
  title: string;
  mediaType: "movie" | "tv";
  initialStartedAt: string | null;
  initialCompletedAt: string | null;
  onClose: () => void;
  onSaved: (updates: { started_at: string | null; completed_at: string | null }) => void;
}

/**
 * Convert a timestamp / ISO string into a `<input type="date">` value (YYYY-MM-DD).
 * Returns "" for null/invalid input so the field renders empty.
 */
function toDateInputValue(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

/**
 * Convert a `<input type="date">` value into a full ISO timestamp at UTC midnight.
 * Returns null when the field is cleared, or undefined if the user hasn't touched it
 * (so we can PATCH only the keys they actually changed).
 */
function fromDateInputValue(
  value: string,
  baseline: string | null | undefined,
): string | null | undefined {
  if (value === "") return null;
  const iso = `${value}T00:00:00.000Z`;
  const candidate = new Date(iso);
  if (isNaN(candidate.getTime())) return baseline ?? null;
  return candidate.toISOString();
}

export const WatchedDateModal: React.FC<WatchedDateModalProps> = ({
  isOpen,
  libraryId,
  title,
  mediaType,
  initialStartedAt,
  initialCompletedAt,
  onClose,
  onSaved,
}) => {
  const [startedAt, setStartedAt] = useState<string>(toDateInputValue(initialStartedAt));
  const [completedAt, setCompletedAt] = useState<string>(toDateInputValue(initialCompletedAt));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when the modal is opened for a new entry
  useEffect(() => {
    if (isOpen) {
      setStartedAt(toDateInputValue(initialStartedAt));
      setCompletedAt(toDateInputValue(initialCompletedAt));
      setError(null);
      setSaving(false);
    }
  }, [isOpen, initialStartedAt, initialCompletedAt]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setError(null);

    // Validate that completed >= started when both are set
    if (startedAt && completedAt && completedAt < startedAt) {
      setError("Completed date must be on or after the started date.");
      return;
    }

    setSaving(true);
    try {
      const updates: { started_at?: string | null; completed_at?: string | null } = {};

      const newStarted = fromDateInputValue(startedAt, initialStartedAt);
      const newCompleted = fromDateInputValue(completedAt, initialCompletedAt);

      // Only PATCH fields that actually changed
      if (
        (newStarted === null ? null : new Date(newStarted as string).toISOString()) !==
        (initialStartedAt ? new Date(initialStartedAt).toISOString() : null)
      ) {
        updates.started_at = newStarted ?? null;
      }
      if (
        (newCompleted === null ? null : new Date(newCompleted as string).toISOString()) !==
        (initialCompletedAt ? new Date(initialCompletedAt).toISOString() : null)
      ) {
        updates.completed_at = newCompleted ?? null;
      }

      const updated = await libraryApi.update(libraryId, updates);
      onSaved({
        started_at: updated.started_at ?? null,
        completed_at: updated.completed_at ?? null,
      });
      onClose();
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Failed to save watched dates";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-theme-secondary border border-theme rounded-xl shadow-2xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-[#10b981]/10 text-[#10b981]">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-lg font-semibold text-theme-primary">Edit watched dates</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-theme-secondary hover:text-theme-primary transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-2">
          <p className="text-sm text-theme-secondary">
            {title}{" "}
            <span className="text-theme-tertiary">
              ({mediaType === "movie" ? "Movie" : "TV show"})
            </span>
          </p>
        </div>

        <div className="px-6 py-4 space-y-4">
          <div>
            <label
              htmlFor="started-at"
              className="block text-sm font-medium text-theme-primary mb-1.5"
            >
              Started watching
            </label>
            <input
              id="started-at"
              type="date"
              value={startedAt}
              max={completedAt || undefined}
              onChange={(e) => setStartedAt(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-theme-primary border border-theme rounded-md text-theme-primary focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
            />
          </div>

          <div>
            <label
              htmlFor="completed-at"
              className="block text-sm font-medium text-theme-primary mb-1.5"
            >
              Finished watching
            </label>
            <input
              id="completed-at"
              type="date"
              value={completedAt}
              min={startedAt || undefined}
              onChange={(e) => setCompletedAt(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-theme-primary border border-theme rounded-md text-theme-primary focus:outline-none focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
            />
            <p className="mt-1.5 text-xs text-theme-tertiary">
              Leave a field blank to clear the date.
            </p>
          </div>

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-md">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-theme-primary border-t border-theme">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-theme-primary bg-theme-tertiary border border-theme-focus rounded-md hover:bg-theme-tertiary transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium rounded-md transition-colors bg-[#10b981] hover:bg-[#059669] text-black disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
};
