import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Download,
  HardDrive,
  Plus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useBooks, useSettings, useUpdateSettings } from "@/db/hooks";
import { db } from "@/db/db";
import { clearAllFiles } from "@/db/opfs";
import type { AppSettings } from "@/db/schema";
import { useUIStore } from "@/stores/uiStore";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function Segment<T extends string | number>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex rounded-md border border-border p-0.5 bg-background/50">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
            value === o.value
              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const PREVIEW_FIELDS: { key: keyof AppSettings; label: string }[] = [
  { key: "showSubtitle", label: "Subtitle" },
  { key: "showAuthor", label: "Author" },
  { key: "showRating", label: "Rating" },
  { key: "showProgress", label: "Reading Progress" },
  { key: "showTags", label: "Tags" },
  { key: "showDescription", label: "Description" },
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function SettingsModal() {
  const open = useUIStore((s) => s.settingsOpen);
  const setOpen = useUIStore((s) => s.setSettingsOpen);
  const { data: settings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();
  const { data: books = [] } = useBooks();

  const [sourceTitle, setSourceTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");

  // Storage estimation state
  const [storageUsage, setStorageUsage] = useState<number>(0);
  const [storageQuota, setStorageQuota] = useState<number>(0);
  const [loadingStorage, setLoadingStorage] = useState(false);

  // Delete confirmation dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [confirmAppNameInput, setConfirmAppNameInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchStorageEstimate = async () => {
    if ("storage" in navigator && "estimate" in navigator.storage) {
      setLoadingStorage(true);
      try {
        if ("persist" in navigator.storage) {
          const isPersist = await navigator.storage.persisted();
          if (!isPersist) {
            await navigator.storage.persist();
          }
        }
        const estimate = await navigator.storage.estimate();
        setStorageUsage(estimate.usage || 0);
        setStorageQuota(estimate.quota || 0);
      } catch (err) {
        console.error("Error estimating storage:", err);
      } finally {
        setLoadingStorage(false);
      }
    }
  };

  useEffect(() => {
    if (open) {
      fetchStorageEstimate();
    }
  }, [open]);

  if (!open || isLoading || !settings) return null;

  const addSource = () => {
    if (!sourceTitle.trim() || !sourceUrl.trim()) return;
    updateSettings.mutate({
      sources: [
        ...settings.sources,
        {
          id: crypto.randomUUID(),
          title: sourceTitle.trim(),
          url: sourceUrl.trim(),
        },
      ],
    });
    setSourceTitle("");
    setSourceUrl("");
  };

  const exportAllData = async () => {
    try {
      const [
        allBooks,
        collections,
        folders,
        bookFolders,
        bookCollections,
        bookmarks,
        highlights,
        notes,
        progress,
      ] = await Promise.all([
        db.books.toArray(),
        db.collections.toArray(),
        db.folders.toArray(),
        db.bookFolders.toArray(),
        db.bookCollections.toArray(),
        db.bookmarks.toArray(),
        db.highlights.toArray(),
        db.notes.toArray(),
        db.readingProgress.toArray(),
      ]);

      const backupData = {
        exportedAt: new Date().toISOString(),
        version: 1,
        app: "Lumina Reader",
        data: {
          books: allBooks,
          collections,
          folders,
          bookFolders,
          bookCollections,
          bookmarks,
          highlights,
          notes,
          progress,
          settings,
        },
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lumina-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Export error:", err);
    }
  };

  const handleDeleteAllData = async () => {
    setIsDeleting(true);
    try {
      // 1. Clear OPFS files
      await clearAllFiles();

      // 2. Clear all Dexie database tables
      await Promise.all([
        db.books.clear(),
        db.collections.clear(),
        db.folders.clear(),
        db.bookFolders.clear(),
        db.bookCollections.clear(),
        db.bookOrder.clear(),
        db.bookmarks.clear(),
        db.highlights.clear(),
        db.notes.clear(),
        db.readingProgress.clear(),
      ]);

      setDeleteDialogOpen(false);
      setOpen(false);

      // Reload to ensure all react-query cache and in-memory states are reset
      window.location.reload();
    } catch (err) {
      console.error("Error deleting all data:", err);
      setIsDeleting(false);
    }
  };

  const usagePercent = storageQuota > 0 ? (storageUsage / storageQuota) * 100 : 0;
  const availableBytes = Math.max(0, storageQuota - storageUsage);
  const requiredConfirmationText = "Lumina Reader";
  const isDeleteConfirmed =
    confirmAppNameInput.trim().toLowerCase() === requiredConfirmationText.toLowerCase();

  return (
    <>
      <Dialog open onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Settings</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-6 py-2">
            {/* 1. Storage & Backup Section */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Storage & Data</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={fetchStorageEstimate}
                  disabled={loadingStorage}
                  title="Refresh storage estimate"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", loadingStorage && "animate-spin")} />
                </Button>
              </div>

              {/* Storage Usage Bar & Stats */}
              <div className="flex flex-col gap-2 rounded-lg bg-background/60 p-3 border border-border/60">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    {formatBytes(storageUsage)} used
                  </span>
                  <span className="text-muted-foreground text-[11px]">
                    {storageQuota > 2.5 * 1024 * 1024 * 1024
                      ? `${formatBytes(availableBytes)} available of ${formatBytes(storageQuota)}`
                      : `Initial pool: ${formatBytes(storageQuota)} (Auto-expandable)`}
                  </span>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500",
                      usagePercent > 85
                        ? "bg-destructive"
                        : usagePercent > 60
                        ? "bg-yellow-500"
                        : "bg-primary"
                    )}
                    style={{ width: `${Math.max(2, Math.min(100, usagePercent))}%` }}
                  />
                </div>

                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Stores {books.length} book{books.length === 1 ? "" : "s"}, cached pages, notes, highlights, and OPFS files. Storage dynamically grows on your disk as more books are imported.
                </p>
              </div>

              {/* Export & Delete All Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportAllData}
                  className="text-xs h-8 gap-1.5 font-medium cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5 text-primary" /> Export Library (JSON Backup)
                </Button>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setConfirmAppNameInput("");
                    setDeleteDialogOpen(true);
                  }}
                  className="text-xs h-8 gap-1.5 cursor-pointer font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete All Data & Free Space
                </Button>
              </div>
            </div>

            {/* 2. 2-Columns Section: Appearance & Book Preview Displays */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 rounded-xl border border-border bg-card p-4 shadow-xs">
              {/* Left Column: Theme, View Mode & Books per row */}
              <div className="flex flex-col gap-4">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Appearance & View
                </span>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground">Theme</span>
                  <Segment
                    value={settings.theme}
                    onChange={(theme) => updateSettings.mutate({ theme })}
                    options={[
                      { value: "dark", label: "Dark" },
                      { value: "light", label: "Light" },
                    ]}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground">View Mode</span>
                  <Segment
                    value={settings.viewMode}
                    onChange={(viewMode) => updateSettings.mutate({ viewMode })}
                    options={[
                      { value: "grid", label: "Grid" },
                      { value: "row", label: "Row" },
                    ]}
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-foreground">Books Per Row</span>
                  <Segment
                    value={settings.booksPerRow}
                    onChange={(booksPerRow) => updateSettings.mutate({ booksPerRow })}
                    options={[
                      { value: 3, label: "3" },
                      { value: 4, label: "4" },
                      { value: 5, label: "5" },
                      { value: 6, label: "6" },
                      { value: 7, label: "7" },
                      { value: 8, label: "8" },
                    ]}
                  />
                </div>
              </div>

              {/* Right Column: Book Preview Shows */}
              <div className="flex flex-col gap-4 md:border-l md:border-border/60 md:pl-5">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Book Preview Info
                </span>

                <div className="flex flex-col gap-2 rounded-lg bg-background/50 p-3 border border-border/50">
                  <p className="text-[11px] text-muted-foreground mb-1">
                    Select which details appear on book cards in your library:
                  </p>
                  {PREVIEW_FIELDS.map((f) => (
                    <label
                      key={f.key}
                      className="flex cursor-pointer items-center gap-2.5 text-xs text-foreground hover:text-primary transition-colors py-0.5"
                    >
                      <input
                        type="checkbox"
                        checked={!!settings[f.key]}
                        onChange={() =>
                          updateSettings.mutate({ [f.key]: !settings[f.key] })
                        }
                        className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                      />
                      {f.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* 3. Download Sources Section */}
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Download Sources</span>
                <span className="text-xs text-muted-foreground">{settings.sources.length} sources</span>
              </div>

              <div className="flex flex-col gap-2">
                {settings.sources.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2 text-xs transition-colors hover:border-primary/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-foreground">{s.title}</p>
                      <p
                        className="truncate text-[11px] text-muted-foreground"
                        title={s.url}
                      >
                        {s.url}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      onClick={() =>
                        updateSettings.mutate({
                          sources: settings.sources.filter((x) => x.id !== s.id),
                        })
                      }
                      title="Remove source"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}

                {settings.sources.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2 bg-background/50 rounded-lg border border-dashed border-border">
                    No download sources configured.
                  </p>
                )}

                <div className="flex flex-col sm:flex-row items-center gap-2 pt-1">
                  <Input
                    value={sourceTitle}
                    onChange={(e) => setSourceTitle(e.target.value)}
                    placeholder="Source Title (e.g. Standard Ebooks)"
                    className="h-8 text-xs flex-1"
                  />
                  <Input
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="https://..."
                    className="h-8 text-xs flex-1"
                  />
                  <Button size="sm" onClick={addSource} className="h-8 text-xs shrink-0 gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md border-destructive/40">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <DialogTitle className="text-base font-bold">
                Permanently Delete All Data?
              </DialogTitle>
            </div>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2 text-xs leading-relaxed">
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-foreground space-y-1">
              <p className="font-semibold text-destructive">Warning: This action cannot be undone.</p>
              <p className="text-muted-foreground text-[11px]">
                This will permanently delete all {books.length} book files from OPFS storage, along with all reading progress, bookmarks, highlights, notes, and custom folders.
              </p>
            </div>

            {/* Export prompt */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-background p-2.5">
              <div className="flex flex-col">
                <span className="font-semibold text-foreground">Save a backup first?</span>
                <span className="text-[10px] text-muted-foreground">Export your library data as a JSON file</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 font-medium"
                onClick={exportAllData}
              >
                <Download className="h-3 w-3 text-primary" /> Export Backup
              </Button>
            </div>

            {/* Type app name to confirm */}
            <div className="flex flex-col gap-1.5 pt-1">
              <label className="text-[11px] font-medium text-foreground">
                To confirm deletion, type <span className="font-bold text-destructive select-all">Lumina Reader</span> below:
              </label>
              <Input
                value={confirmAppNameInput}
                onChange={(e) => setConfirmAppNameInput(e.target.value)}
                placeholder="Type 'Lumina Reader'"
                className="h-8 text-xs bg-background"
                autoFocus
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="h-8 text-xs gap-1.5 font-semibold"
              disabled={!isDeleteConfirmed || isDeleting}
              onClick={handleDeleteAllData}
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isDeleting ? "Deleting..." : "Permanently Delete Everything"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
