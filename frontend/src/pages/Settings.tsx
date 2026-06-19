import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "../context/AuthContext";
import { profileApi, UserProfile, settingsApi, UserSettings, accountApi, ImportResult, libraryApi, scrobbleApi, mediaApi, episodeApi } from "../lib/api";
import { ImportFormatHelp } from "../components/ImportFormatHelp";
import { Loader2, Save, Download, Upload, AlertTriangle, User as UserIcon, X } from "lucide-react";
import { parseImportContent, ClientParsedImport } from "../lib/importParser";
import { CustomSelect } from "../components/CustomSelect";
import { useTheme } from "../context/ThemeContext";

export const Settings: React.FC = () => {
  const { user: _user, profile, refreshProfile, signOut } = useAuth();
  const { theme: themeCtx, setTheme: setThemeCtx } = useTheme();
  const [_profile, setProfile] = useState<UserProfile | null>(null);
  const [_settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [theme, setThemeLocal] = useState<"dark" | "light" | "system">(themeCtx);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"json" | "csv">("json");
  const [exportContent, setExportContent] = useState<"full" | "movies" | "shows" | "both">("full");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Preview modal and progress states
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [parsedImportData, setParsedImportData] = useState<ClientParsedImport | null>(null);
  const [importProgress, setImportProgress] = useState(0);
  const [bulkImporting, setBulkImporting] = useState(false);

  // Delete account
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [profileRes, settingsRes] = await Promise.all([
          profileApi.get(),
          settingsApi.get()
        ]);

        setProfile(profileRes.profile);
        setSettings(settingsRes);

        setDisplayName(profileRes.profile.display_name || "");
        setUsername(profileRes.profile.username || "");
        setBio(profileRes.profile.bio || "");
        setThemeLocal(settingsRes.theme);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await Promise.all([
        profileApi.update({
          display_name: displayName,
          username,
          bio
        }),
        settingsApi.update({
          theme
        })
      ]);
      setThemeCtx(theme as "dark" | "light" | "system");
      await refreshProfile();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarLoading(true);
    setError(null);

    try {
      await profileApi.uploadAvatar(file);
      await refreshProfile();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to upload avatar image");
    } finally {
      setAvatarLoading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await accountApi.deleteAccount();
      await signOut();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete account.");
      setDeleting(false);
    }
  };

  const handleExportData = async () => {
    try {
      setExporting(true);
      const data = await accountApi.export();

      let outputData: string;
      let mimeType: string;
      let extension: string;

      if (exportFormat === "json" && exportContent === "full") {
        outputData = JSON.stringify(data, null, 2);
        mimeType = "application/json";
        extension = "json";
      } else {
        let library = data.library || [];
        if (exportContent === "movies") library = library.filter((i: any) => i.media_type === "movie");
        if (exportContent === "shows") library = library.filter((i: any) => i.media_type === "tv");

        let watchlist = data.watchlist || [];
        if (exportContent === "movies") watchlist = watchlist.filter((i: any) => i.media_type === "movie");
        if (exportContent === "shows") watchlist = watchlist.filter((i: any) => i.media_type === "tv");

        if (exportFormat === "json") {
          outputData = JSON.stringify({ library, watchlist }, null, 2);
          mimeType = "application/json";
          extension = "json";
        } else {
          const headers = ["list_type", "tmdb_id", "media_type", "title", "status", "rating", "episodes_watched", "release_year", "notes"];
          const rows = [];
          for (const item of library) {
            rows.push([
              "library",
              item.tmdb_id,
              item.media_type,
              `"${(item.title || "").replace(/"/g, '""')}"`,
              item.status,
              item.rating || "",
              item.episodes_watched || 0,
              item.release_year || "",
              `"${(item.notes || "").replace(/"/g, '""')}"`
            ].join(","));
          }
          for (const item of watchlist) {
             rows.push([
              "watchlist",
              item.tmdb_id,
              item.media_type,
              `"${(item.title || "").replace(/"/g, '""')}"`,
              "plan_to_watch",
              "",
              0,
              item.release_year || "",
              `"${(item.notes || "").replace(/"/g, '""')}"`
            ].join(","));
          }

          outputData = [headers.join(","), ...rows].join("\n");
          mimeType = "text/csv";
          extension = "csv";
        }
      }

      const blob = new Blob([outputData], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `intermission-export-${new Date().toISOString().slice(0, 10)}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
      
      toast.success("Export successful");
    } catch (err) {
      toast.error("Failed to export data.");
    } finally {
      setExporting(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportError(null);
    setImportResult(null);
    setParsedImportData(null);

    try {
      const text = await file.text();
      const result = parseImportContent(text, file.name);
      setParsedImportData(result);
      setShowPreviewModal(true);
    } catch (err: any) {
      setImportError(err.message || "Failed to parse file");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleConfirmBulkImport = async () => {
    if (!parsedImportData || parsedImportData.parsed.length === 0) return;

    setBulkImporting(true);
    setImportProgress(0);

    const parsed = parsedImportData.parsed;
    const batchSize = 5;

    // Fetch existing library items and their watch counts to avoid redundant adds and 409 console errors
    const existingWatches = new Map<string, number>();
    try {
      const libRes = await libraryApi.list({ limit: 1000 });
      if (libRes && Array.isArray(libRes.data)) {
        libRes.data.forEach((item) => {
          existingWatches.set(`${item.media_type}:${item.tmdb_id}`, item.times_watched || 0);
        });
      }
    } catch (err) {
      console.error("Failed to pre-fetch library list:", err);
    }

    try {
      for (let i = 0; i < parsed.length; i += batchSize) {
        const batch = parsed.slice(i, i + batchSize);
        await Promise.all(batch.map(async (item) => {
          try {
            const cacheKey = `${item.media_type}:${item.tmdb_id}`;
            const currentWatches = existingWatches.get(cacheKey);
            const exists = currentWatches !== undefined;

            if (item.media_type === "movie") {
              if (!exists) {
                try {
                  await libraryApi.add({
                    tmdb_id: item.tmdb_id,
                    media_type: "movie",
                    status: item.status as any,
                    rating: item.rating || undefined,
                    notes: item.notes || undefined
                  });
                  existingWatches.set(cacheKey, 1);
                } catch (err: any) {
                  if (!err.message?.includes("already in your library") && !String(err).includes("409")) throw err;
                }

                // If status is completed, the add call initialized times_watched to 1.
                // We scrobble any additional plays to match the target.
                if (item.status === "completed") {
                  const target = item.times_watched || 1;
                  for (let sc = 0; sc < target - 1; sc++) {
                    await scrobbleApi.completeMovie(item.tmdb_id);
                  }
                  existingWatches.set(cacheKey, target);
                } else if (item.status === "watching") {
                  await scrobbleApi.send({ tmdb_id: item.tmdb_id, media_type: "movie", event: "start" });
                }
              } else {
                // If it already exists
                if (item.status === "completed") {
                  const current = existingWatches.get(cacheKey) || 0;
                  const target = item.times_watched || 1;

                  if (item.times_watched === undefined || item.times_watched <= 1) {
                    // For standard watches (like separate rows in CSV), scrobble once
                    await scrobbleApi.completeMovie(item.tmdb_id);
                    existingWatches.set(cacheKey, current + 1);
                  } else if (target > current) {
                    // For consolidation (like JSON imports with times_watched field), scrobble to match target
                    for (let sc = 0; sc < target - current; sc++) {
                      await scrobbleApi.completeMovie(item.tmdb_id);
                    }
                    existingWatches.set(cacheKey, target);
                  }
                } else if (item.status === "watching") {
                  await scrobbleApi.send({ tmdb_id: item.tmdb_id, media_type: "movie", event: "start" });
                }
              }
            } else { // tv
              if (item.is_episode) {
                if (!exists) {
                  try {
                    await libraryApi.add({
                      tmdb_id: item.tmdb_id,
                      media_type: "tv",
                      status: "watching",
                    });
                    existingWatches.set(cacheKey, 0);
                  } catch (err: any) {
                    if (!err.message?.includes("already in your library") && !String(err).includes("409")) throw err;
                  }
                }
                await scrobbleApi.completeEpisode(item.tmdb_id, item.season_number!, item.episode_number!);
              } else {
                if (!exists) {
                  try {
                    await libraryApi.add({
                      tmdb_id: item.tmdb_id,
                      media_type: "tv",
                      status: item.status as any,
                      rating: item.rating || undefined,
                      notes: item.notes || undefined
                    });
                    existingWatches.set(cacheKey, 0);
                  } catch (err: any) {
                    if (!err.message?.includes("already in your library") && !String(err).includes("409")) throw err;
                  }
                }
                if (item.status === "watching") {
                  await scrobbleApi.send({ tmdb_id: item.tmdb_id, media_type: "tv", event: "start" });
                } else if (item.status === "completed") {
                  try {
                    const details = await mediaApi.getShow(item.tmdb_id);
                    const seasonsToMark = details.media.seasons
                      .filter(s => s.season_number > 0) // Typically exclude specials
                      .map(s => ({
                        season_number: s.season_number,
                        episodes: Array.from({ length: s.episode_count }, (_, i) => i + 1)
                      }));
                    
                    if (seasonsToMark.length > 0) {
                      await episodeApi.bulkMarkMultiSeason({
                        tmdb_id: item.tmdb_id,
                        seasons: seasonsToMark,
                        watched: true
                      });
                    }
                  } catch (err) {
                    console.error("Failed to mark all episodes for completed TV show:", err);
                  }
                }
              }
            }
          } catch (err) {
            console.error("Failed to import/scrobble item:", item, err);
          } finally {
            setImportProgress(p => p + 1);
          }
        }));
      }

      setImportResult({
        format: parsedImportData.format,
        library: { imported: parsed.filter(p => !p.is_episode).length, updated: 0, skipped: parsedImportData.skipped.length, errors: [] },
        watchlist: { imported: parsed.filter(p => p.status === "plan_to_watch").length, skipped: 0, errors: [] },
        episodes: { imported: parsed.filter(p => p.is_episode).length, skipped: 0, errors: [] }
      });
      setShowPreviewModal(false);
      window.dispatchEvent(new Event("library:refresh"));
      await refreshProfile();
    } catch (err: any) {
      setImportError(err.message || "Failed to complete bulk import");
    } finally {
      setBulkImporting(false);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="w-8 h-8 text-[#10b981] animate-spin" /></div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      <div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Settings</h1>
        <p className="text-[#a1a1aa] text-sm">Manage your account preferences and profile.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-8">

        {/* Profile Section */}
        <section className="dense-card space-y-6">
          <div className="flex items-center gap-4">
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <div
              className="relative group w-16 h-16 rounded-full overflow-hidden bg-[#27272a] flex items-center justify-center flex-shrink-0 border border-[#27272a] cursor-pointer shadow-md"
              onClick={() => avatarInputRef.current?.click()}
              title="Click to change avatar"
            >
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" className="w-full h-full object-cover group-hover:opacity-50 transition-opacity" />
              ) : (
                <UserIcon className="w-8 h-8 text-[#52525b] group-hover:text-[#ededed] transition-colors" />
              )}
              {avatarLoading && (
                <div className="absolute inset-0 bg-[#0a0a0a]/75 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-[#10b981] animate-spin" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity pointer-events-none">
                <Upload className="w-4 h-4 text-white" />
              </div>
            </div>
            <div>
              <h2 className="font-semibold text-lg">Profile Picture</h2>
              <button
                type="button"
                disabled={avatarLoading}
                onClick={() => avatarInputRef.current?.click()}
                className="text-xs text-[#10b981] hover:text-[#059669] hover:underline font-medium transition-colors mt-1 block"
              >
                {avatarLoading ? "Uploading..." : "Upload new picture"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full"
                placeholder="Jane Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full"
                placeholder="janedoe"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full h-24 resize-none"
              placeholder="Tell us about your favorite movies..."
            />
          </div>
        </section>

        {/* Preferences Section */}
        <section className="dense-card space-y-6">
          <h2 className="font-semibold text-lg border-b border-[#27272a] pb-2">Preferences</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-[#a1a1aa] mb-1">Theme</label>
              <CustomSelect 
                value={theme}
                onChange={(val) => setThemeLocal(val as "dark" | "light" | "system")}
                className="w-full bg-[#141414] border border-[#27272a] rounded"
                buttonClassName="px-3 py-2"
                options={[
                  { value: "dark", label: "Dark" },
                  { value: "light", label: "Light" },
                  { value: "system", label: "System Default" }
                ]}
              />
            </div>
          </div>
        </section>

        {error && <div className="p-3 bg-red-500/10 text-red-500 text-sm rounded border border-red-500/20">{error}</div>}

        <div className="flex items-center gap-4">
          <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
          {success && <span className="text-[#10b981] text-sm">Settings saved successfully!</span>}
        </div>
      </form>

      {/* Danger Zone */}
      <section className="border border-red-500/20 bg-red-500/5 rounded-lg p-6 space-y-6 mt-12">
        <h2 className="font-semibold text-lg text-red-500 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Data & Privacy (GDPR)
        </h2>

        <div className="flex flex-col border-b border-red-500/10 pb-6 gap-6">
          <div>
            <h3 className="font-medium text-[#ededed]">Export Your Data</h3>
            <p className="text-sm text-[#a1a1aa] mt-1 mb-4">Download a copy of your tracking history, reviews, and settings.</p>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Content</label>
                <CustomSelect
                  value={exportContent}
                  onChange={(val) => setExportContent(val as any)}
                  className="w-full bg-[#141414] border border-[#27272a] rounded"
                  buttonClassName="px-3 py-2 text-sm"
                  options={[
                    { value: "full", label: "Full Profile Config" },
                    { value: "both", label: "Movies & Shows" },
                    { value: "movies", label: "Movies Only" },
                    { value: "shows", label: "Shows Only" },
                  ]}
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-[#a1a1aa] mb-1">Format</label>
                <CustomSelect
                  value={exportFormat}
                  onChange={(val) => setExportFormat(val as any)}
                  className="w-full bg-[#141414] border border-[#27272a] rounded"
                  buttonClassName="px-3 py-2 text-sm"
                  options={[
                    { value: "json", label: "JSON" },
                    { value: "csv", label: "CSV" },
                  ]}
                />
              </div>
            </div>
            <button onClick={handleExportData} disabled={exporting} className="btn-secondary whitespace-nowrap flex items-center gap-2 text-sm border-red-500/30 hover:border-red-500/50 hover:bg-red-500/10">
              {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              Export Data
            </button>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-red-500/10 pb-6">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-[#ededed]">Import Data</h3>
              <ImportFormatHelp />
            </div>
            <p className="text-sm text-[#a1a1aa] mt-1">
              Upload a JSON or CSV backup. Supports Intermission JSON exports and custom CSV with TMDB IDs.
            </p>
            {importResult && (
              <p className="text-sm text-[#10b981] mt-2">
                Imported {importResult.library.imported} library items
                {importResult.library.updated > 0 ? ` (${importResult.library.updated} updated)` : ""}
                , {importResult.episodes.imported} episodes
                {importResult.watchlist.imported > 0 ? `, ${importResult.watchlist.imported} watchlist items` : ""}.
                {(importResult.library.skipped + importResult.episodes.skipped) > 0 &&
                  ` ${importResult.library.skipped + importResult.episodes.skipped} rows skipped.`}
              </p>
            )}
            {importError && (
              <p className="text-sm text-red-400 mt-2">{importError}</p>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.csv,application/json,text/csv"
              onChange={handleImportFile}
              className="hidden"
              id="import-file"
            />
            <label
              htmlFor="import-file"
              className={`btn-secondary whitespace-nowrap flex items-center gap-2 text-sm cursor-pointer ${importing ? "opacity-50 pointer-events-none" : ""
                }`}
            >
              {importing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {importing ? "Importing..." : "Choose File"}
            </label>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 className="font-medium text-[#ededed]">Delete Account</h3>
            <p className="text-sm text-[#a1a1aa] mt-1">Permanently delete your account and all associated data. This action cannot be undone.</p>
          </div>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="btn-secondary text-red-500 border-red-500/30 hover:bg-red-500 hover:text-white hover:border-red-500 whitespace-nowrap text-sm"
          >
            Delete Account
          </button>
        </div>
      </section>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-red-500/30 rounded-lg max-w-sm w-full shadow-2xl p-6">
            <h3 className="text-lg font-semibold text-[#ededed] mb-2">Delete Account</h3>
            <p className="text-sm text-[#a1a1aa] mb-6">
              This will permanently delete your account, library, watchlist, and all episode progress. <strong className="text-red-400">This cannot be undone.</strong>
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="btn-secondary text-sm px-4 py-2 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleting ? "Deleting..." : "Yes, Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreviewModal && parsedImportData && (
        <div className="fixed inset-0 bg-[#0a0a0a]/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#27272a] rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-4 border-b border-[#27272a]">
              <h3 className="text-lg font-semibold text-[#ededed]">Review Import Data</h3>
              <button
                onClick={() => { if (!bulkImporting) setShowPreviewModal(false); }}
                className="text-[#52525b] hover:text-[#ededed] transition-colors"
                disabled={bulkImporting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-[#1f1f1f] border border-[#27272a] rounded-lg p-3">
                  <div className="text-2xl font-bold text-[#ededed]">{parsedImportData.totalEntries}</div>
                  <div className="text-xs text-[#a1a1aa] mt-1">Total Entries</div>
                </div>
                <div className="bg-[#1f1f1f] border border-emerald-500/10 rounded-lg p-3">
                  <div className="text-2xl font-bold text-[#10b981]">{parsedImportData.parsed.length}</div>
                  <div className="text-xs text-emerald-400 mt-1">Parsed (Valid)</div>
                </div>
                <div className="bg-[#1f1f1f] border border-red-500/10 rounded-lg p-3">
                  <div className="text-2xl font-bold text-red-500">{parsedImportData.skipped.length}</div>
                  <div className="text-xs text-red-400 mt-1">Skipped (Invalid)</div>
                </div>
              </div>

              <div className="border border-[#27272a] rounded-lg overflow-hidden bg-[#0a0a0a]">
                <div className="max-h-[300px] overflow-y-auto">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead className="bg-[#141414] border-b border-[#27272a] sticky top-0 z-10">
                      <tr>
                        <th className="p-3 text-[#52525b] font-semibold uppercase">Type</th>
                        <th className="p-3 text-[#52525b] font-semibold uppercase">Title / ID</th>
                        <th className="p-3 text-[#52525b] font-semibold uppercase">Status</th>
                        <th className="p-3 text-[#52525b] font-semibold uppercase">Import Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#27272a]/50">
                      {parsedImportData.parsed.map((item, idx) => (
                        <tr key={`parsed-${idx}`} className="bg-emerald-950/5 hover:bg-emerald-950/10 transition-colors">
                          <td className="p-3">
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400">
                              {item.media_type} {item.is_episode ? 'ep' : ''}
                            </span>
                          </td>
                          <td className="p-3 font-medium text-[#ededed]">
                            {item.title || `TMDB: ${item.tmdb_id}`}
                            {item.is_episode && (
                              <span className="text-[#a1a1aa] block text-[10px] mt-0.5">
                                Season {item.season_number} Episode {item.episode_number}
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span className="text-[#a1a1aa]">
                              {item.status.replace(/_/g, ' ')}
                              {item.rating ? ` (${item.rating}/10)` : ''}
                            </span>
                          </td>
                          <td className="p-3 text-[#10b981] font-medium">Ready</td>
                        </tr>
                      ))}

                      {parsedImportData.skipped.map((item, idx) => (
                        <tr key={`skipped-${idx}`} className="bg-red-950/5 hover:bg-red-950/10 transition-colors border-l-2 border-red-500">
                          <td className="p-3">
                            {item.media_type ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-500/10 text-red-400">
                                {item.media_type}
                              </span>
                            ) : (
                              <span className="text-[#52525b]">—</span>
                            )}
                          </td>
                          <td className="p-3 font-medium text-red-300 truncate max-w-xs" title={item.raw}>
                            {item.title || item.raw}
                          </td>
                          <td className="p-3">
                            {item.status ? (
                              <span className="text-red-400">{item.status.replace(/_/g, ' ')}</span>
                            ) : (
                              <span className="text-[#52525b]">—</span>
                            )}
                          </td>
                          <td className="p-3 text-red-400 font-medium" title={item.reason}>
                            Skipped: {item.reason}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {bulkImporting && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#a1a1aa]">Importing items...</span>
                    <span className="text-[#ededed] font-semibold">
                      {importProgress} / {parsedImportData.parsed.length} ({Math.round((importProgress / parsedImportData.parsed.length) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#1f1f1f] h-2.5 rounded-full overflow-hidden border border-[#27272a]">
                    <div
                      className="bg-[#10b981] h-full rounded-full transition-all duration-300"
                      style={{ width: `${(importProgress / parsedImportData.parsed.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-[#27272a] bg-[#141414] flex justify-end gap-3">
              <button
                onClick={() => setShowPreviewModal(false)}
                className="btn-secondary text-sm"
                disabled={bulkImporting}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmBulkImport}
                className="btn-primary flex items-center gap-2 text-sm"
                disabled={bulkImporting || parsedImportData.parsed.length === 0}
              >
                {bulkImporting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Adding to Library...
                  </>
                ) : (
                  `Add Confirmed Entries (${parsedImportData.parsed.length})`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
