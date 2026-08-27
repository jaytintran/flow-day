import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Library,
  Heart,
  BookOpen,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  Globe,
  Plus,
  Trash2,
} from "lucide-react";
import { StatCard } from "@/components/layout/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LibrarySections } from "@/components/library/LibrarySections";
import { useBooks, useSettings, useUpdateSettings } from "@/db/hooks";
import { useUIStore } from "@/stores/uiStore";
import type { Book } from "@/db/schema";

const VIEW_FILTERS: Record<string, (b: Book) => boolean> = {
  Home: () => true,
  Favorites: (b) => b.isFavorite,
  "Currently Reading": (b) => b.readingStatus === "currently-reading",
  "Wanna Read": (b) => b.readingStatus === "wanna-read",
  Finished: (b) => b.readingStatus === "finished",
};

const SCOPE_IDS: Record<string, string> = {
  Home: "home",
  Favorites: "favorites",
  "Currently Reading": "currently-reading",
  "Wanna Read": "wanna-read",
  Finished: "finished",
};

export function HomePage({ viewLabel }: { viewLabel: string }) {
  const navigate = useNavigate();
  const { data: books = [] } = useBooks();
  const { data: settings } = useSettings();
  const [sourceModalOpen, setSourceModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<{
    id: string;
    title: string;
    url: string;
  } | null>(null);
  const searchQuery = useUIStore((s) => s.searchQuery)
    .trim()
    .toLowerCase();

  const filter = VIEW_FILTERS[viewLabel] ?? (() => true);
  const filteredCategoryBooks = books.filter(filter);
  const viewBooks = searchQuery
    ? filteredCategoryBooks.filter((b) => {
        const titleMatch = b.title.toLowerCase().includes(searchQuery);
        const subtitleMatch =
          b.subtitle?.toLowerCase().includes(searchQuery) ?? false;
        const authorMatch = b.author.toLowerCase().includes(searchQuery);
        const publisherMatch =
          b.publisher?.toLowerCase().includes(searchQuery) ?? false;
        const tagMatch = b.tags.some((t) =>
          t.toLowerCase().includes(searchQuery),
        );
        const descMatch =
          b.description?.toLowerCase().includes(searchQuery) ?? false;
        return (
          titleMatch ||
          subtitleMatch ||
          authorMatch ||
          publisherMatch ||
          tagMatch ||
          descMatch
        );
      })
    : filteredCategoryBooks;

  const count = (f: (b: Book) => boolean) => books.filter(f).length;

  return (
    <div className="flex flex-col gap-6">
      {/* STATS CARDS */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <StatCard
          icon={Library}
          value={books.length}
          label="Total Books"
          colorClass="bg-blue-500/15 text-blue-400"
          active={viewLabel === "Home"}
          onClick={() => navigate("/")}
        />
        <StatCard
          icon={Heart}
          value={count((b) => b.isFavorite)}
          label="Favorites"
          colorClass="bg-rose-500/15 text-rose-400"
          active={viewLabel === "Favorites"}
          onClick={() => navigate("/favorites")}
        />
        <StatCard
          icon={BookOpen}
          value={count((b) => b.readingStatus === "currently-reading")}
          label="Reading"
          colorClass="bg-blue-500/15 text-blue-400"
          active={viewLabel === "Currently Reading"}
          onClick={() => navigate("/currently-reading")}
        />
        <StatCard
          icon={Bookmark}
          value={count((b) => b.readingStatus === "wanna-read")}
          label="Wanna Read"
          colorClass="bg-yellow-500/15 text-yellow-400"
          active={viewLabel === "Wanna Read"}
          onClick={() => navigate("/wanna-read")}
        />
        <StatCard
          icon={CheckCircle2}
          value={count((b) => b.readingStatus === "finished")}
          label="Finished"
          colorClass="bg-green-500/15 text-green-400"
          active={viewLabel === "Finished"}
          onClick={() => navigate("/finished")}
        />
      </div>

      {viewLabel === "Home" && (
        <div className="rounded-xl border border-border/80 bg-card/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Globe className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-base font-semibold">Download Sources</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs font-medium"
              onClick={() => {
                setEditingSource(null);
                setSourceModalOpen(true);
              }}
            >
              <Plus className="h-3.5 w-3.5" /> Add Source
            </Button>
          </div>
          {settings?.sources?.length ? (
            <div className="flex flex-wrap gap-2.5">
              {settings.sources.map((s) => (
                <div
                  key={s.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setEditingSource(s);
                    setSourceModalOpen(true);
                  }}
                  className="group relative flex items-center gap-2 rounded-lg border border-border bg-card px-3.5 py-2.5 text-sm font-medium transition-all hover:border-primary/50 hover:bg-accent/40 shadow-xs cursor-pointer select-none"
                  title="Right-click to edit or delete"
                >
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-foreground hover:text-primary transition-colors"
                  >
                    <span>{s.title}</span>
                    <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              No sources yet — click "Add Source" to bookmark your favorite
              ebook websites.
            </p>
          )}
        </div>
      )}

      <LibrarySections
        title={viewLabel === "Home" ? "All Books" : viewLabel}
        baseBooks={viewBooks}
        scopeType="view"
        scopeId={SCOPE_IDS[viewLabel] ?? "home"}
        emptyText={
          books.length
            ? `No books in ${viewLabel} yet.`
            : "No books yet — use the import button in the header to add some."
        }
      />

      {sourceModalOpen && (
        <SourceModal
          source={editingSource}
          onClose={() => {
            setSourceModalOpen(false);
            setEditingSource(null);
          }}
        />
      )}
    </div>
  );
}

function SourceModal({
  source,
  onClose,
}: {
  source?: { id: string; title: string; url: string } | null;
  onClose: () => void;
}) {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const [title, setTitle] = useState(source?.title ?? "");
  const [url, setUrl] = useState(source?.url ?? "");

  const handleSave = () => {
    if (!title.trim() || !url.trim() || !settings) return;
    let cleanUrl = url.trim();
    if (!/^https?:\/\//i.test(cleanUrl)) {
      cleanUrl = `https://${cleanUrl}`;
    }

    if (source) {
      updateSettings.mutate({
        sources: settings.sources.map((s) =>
          s.id === source.id ? { ...s, title: title.trim(), url: cleanUrl } : s,
        ),
      });
    } else {
      updateSettings.mutate({
        sources: [
          ...settings.sources,
          {
            id: crypto.randomUUID(),
            title: title.trim(),
            url: cleanUrl,
          },
        ],
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (!source || !settings) return;
    updateSettings.mutate({
      sources: settings.sources.filter((s) => s.id !== source.id),
    });
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            {source ? "Edit Download Source" : "Add Download Source"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            Source Title
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Standard Ebooks, Project Gutenberg"
              className="text-sm text-foreground"
            />
          </label>

          <label className="flex flex-col gap-1.5 text-xs font-medium text-muted-foreground">
            URL
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://standardebooks.org"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
              }}
              className="text-sm text-foreground"
            />
          </label>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
          {source ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              className="gap-1.5"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!title.trim() || !url.trim()}
            >
              {source ? "Save Changes" : "Add Source"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
