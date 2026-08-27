import { useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Globe,
  Loader2,
  ShoppingBag,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCover } from "@/lib/useCover";
import { saveFile } from "@/db/opfs";
import { useUpdateBook } from "@/db/hooks";
import { useUIStore } from "@/stores/uiStore";
import type { Book, ReadingStatus } from "@/db/schema";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const STATUSES: { value: ReadingStatus; label: string }[] = [
  { value: "currently-reading", label: "Currently Reading" },
  { value: "wanna-read", label: "Wanna Read" },
  { value: "finished", label: "Finished" },
];

interface FetchedMetadata {
  source: string;
  title?: string;
  subtitle?: string;
  author?: string;
  publisher?: string;
  rating?: number;
  tags?: string[];
  description?: string;
  coverUrl?: string;
}

async function fetchOnlineMetadata(
  query: string,
  source: "google" | "goodreads" | "amazon",
) {
  if (!query.trim()) return null;

  if (source === "google") {
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=1`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Google Books request failed");
    const json = await res.json();
    const item = json.items?.[0]?.volumeInfo;
    if (!item) return null;

    return {
      title: item.title,
      subtitle: item.subtitle,
      author: item.authors?.join(", "),
      publisher: item.publisher,
      rating: item.averageRating ? Math.round(item.averageRating) : undefined,
      tags: item.categories,
      description: item.description,
      coverUrl:
        item.imageLinks?.thumbnail?.replace("http://", "https://") ||
        item.imageLinks?.smallThumbnail?.replace("http://", "https://"),
    };
  }

  // Goodreads / Amazon catalog lookup via Open Library
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Search request failed for ${source}`);
  const json = await res.json();
  const doc = json.docs?.[0];
  if (!doc) return null;

  const coverId = doc.cover_i;
  return {
    title: doc.title,
    subtitle: doc.subtitle,
    author: doc.author_name?.join(", "),
    publisher: doc.publisher?.[0],
    rating: doc.ratings_average ? Math.round(doc.ratings_average) : undefined,
    tags: doc.subject?.slice(0, 5),
    description: doc.first_sentence?.[0] || doc.description,
    coverUrl: coverId
      ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
      : undefined,
  };
}

function RatingInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i + 1)}
          className="p-0.5"
        >
          <Star
            className={cn(
              "h-5 w-5",
              i < value
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground",
            )}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-muted-foreground">
        {value ? `${value} / 5` : "No rating"}
      </span>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function FetchedFieldItem({
  label,
  value,
  onCopy,
  onApply,
  copied,
}: {
  label: string;
  value?: string | number;
  onCopy: () => void;
  onApply?: () => void;
  copied: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/70 bg-background/60 p-2.5 shadow-2xs">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <div className="flex items-center gap-1">
          {onApply && (
            <button
              type="button"
              onClick={onApply}
              className="rounded px-1.5 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
            >
              Use
            </button>
          )}
          <button
            type="button"
            onClick={onCopy}
            className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-500 font-medium">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
      </div>
      <p className="text-xs text-foreground font-medium line-clamp-3 select-text">
        {String(value)}
      </p>
    </div>
  );
}

export function EditMetadataModal({
  book,
  onClose,
}: {
  book: Book;
  onClose: () => void;
}) {
  const updateBook = useUpdateBook();
  const setIsEditingMetadata = useUIStore((s) => s.setIsEditingMetadata);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsEditingMetadata(true);
    return () => setIsEditingMetadata(false);
  }, [setIsEditingMetadata]);

  const [coverKey, setCoverKey] = useState(book.coverKey);
  const [title, setTitle] = useState(book.title);
  const [subtitle, setSubtitle] = useState(book.subtitle ?? "");
  const [author, setAuthor] = useState(book.author);
  const [publisher, setPublisher] = useState(book.publisher ?? "");
  const [rating, setRating] = useState(book.rating);
  const [progress, setProgress] = useState(book.progress ?? 0);
  const [tags, setTags] = useState(book.tags.join(", "));
  const [description, setDescription] = useState(book.description ?? "");
  const [status, setStatus] = useState<ReadingStatus | "">(
    book.readingStatus ?? "",
  );
  const [favorite, setFavorite] = useState(book.isFavorite);
  const [fetchStatus, setFetchStatus] = useState<
    "idle" | "loading" | "success" | "not-found"
  >("idle");
  const [fetchedData, setFetchedData] = useState<FetchedMetadata | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const coverUrl = useCover(coverKey);

  const uploadCover = async (file: File | undefined) => {
    if (!file) return;
    const newKey = `${book.fileKey}.cover-${crypto.randomUUID()}`;
    await saveFile(newKey, file);
    await updateBook.mutateAsync({ id: book.id!, patch: { coverKey: newKey } });
    setCoverKey(newKey);
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 1500);
  };

  const handleFetch = async (source: "google" | "goodreads" | "amazon") => {
    const query = `${title || book.title} ${
      author && author !== "Unknown" ? author : ""
    }`.trim();
    if (!query) return;

    setFetchStatus("loading");
    try {
      const data = await fetchOnlineMetadata(query, source);
      if (!data || (!data.title && !data.author && !data.description)) {
        setFetchStatus("not-found");
        setTimeout(() => setFetchStatus("idle"), 3000);
        return;
      }

      setFetchedData({
        source:
          source === "google"
            ? "Google Books"
            : source === "goodreads"
              ? "Goodreads"
              : "Amazon",
        title: data.title,
        subtitle: data.subtitle,
        author: data.author,
        publisher: data.publisher,
        rating: data.rating,
        tags: data.tags,
        description: data.description,
        coverUrl: data.coverUrl,
      });

      setFetchStatus("success");
      setTimeout(() => setFetchStatus("idle"), 2500);
    } catch (err) {
      console.error("Fetch metadata error:", err);
      setFetchStatus("not-found");
      setTimeout(() => setFetchStatus("idle"), 3000);
    }
  };

  const save = async () => {
    await updateBook.mutateAsync({
      id: book.id!,
      patch: {
        title: title.trim() || book.title,
        subtitle: subtitle.trim() || undefined,
        author: author.trim() || "Unknown",
        publisher: publisher.trim() || undefined,
        rating,
        progress,
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        description: description.trim() || undefined,
        readingStatus: status || null,
        isFavorite: favorite,
      },
    });
    onClose();
  };

  const handleClose = () => {
    setFetchedData(null);
    onClose();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && handleClose()}>
      <DialogContent
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onTouchStart={(e) => e.stopPropagation()}
        className={cn(
          "transition-all duration-200",
          fetchedData ? "sm:max-w-4xl" : "sm:max-w-xl",
        )}
      >
        <DialogHeader className="flex flex-row items-center justify-between pr-6 pb-2 border-b border-border/40">
          <DialogTitle>Edit Metadata</DialogTitle>

          <div className="flex items-center gap-2">
            {fetchStatus === "loading" && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground animate-pulse">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" /> Fetching...
              </span>
            )}
            {fetchStatus === "not-found" && (
              <span className="text-xs text-amber-500 font-medium animate-in fade-in">
                No info found
              </span>
            )}
            {fetchStatus === "success" && (
              <span className="text-xs text-emerald-500 font-medium animate-in fade-in">
                Data fetched!
              </span>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={fetchStatus === "loading"}
                    className="h-8 gap-1.5 text-xs font-medium border-primary/40 text-primary hover:bg-primary/10 shadow-2xs cursor-pointer"
                  />
                }
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Fetch Online</span>
                <ChevronDown className="h-3 w-3 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-44 p-1">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Metadata Source
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleFetch("google")}
                    className="cursor-pointer gap-2 rounded-md px-2.5 py-1.5 text-xs"
                  >
                    <Globe className="h-3.5 w-3.5 text-primary" />
                    <span>Google Books</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleFetch("goodreads")}
                    className="cursor-pointer gap-2 rounded-md px-2.5 py-1.5 text-xs"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-primary" />
                    <span>Goodreads</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleFetch("amazon")}
                    className="cursor-pointer gap-2 rounded-md px-2.5 py-1.5 text-xs"
                  >
                    <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                    <span>Amazon</span>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogHeader>

        <div
          className={cn(
            "grid gap-5",
            fetchedData ? "grid-cols-1 md:grid-cols-12" : "grid-cols-1",
          )}
        >
          {/* Main Edit Metadata Form */}
          <div
            className={cn(
              fetchedData ? "md:col-span-7" : "",
              "flex max-h-[70vh] gap-4 overflow-y-auto pr-1",
            )}
          >
            <div className="flex shrink-0 flex-col items-center gap-2">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={book.title}
                  className="h-44 w-32 rounded-sm object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-44 w-32 items-center justify-center rounded-sm bg-neutral-800 p-2 text-center text-xs font-bold text-white shadow-sm">
                  {book.title.slice(0, 30)}
                </div>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => uploadCover(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => coverInputRef.current?.click()}
              >
                Upload cover
              </Button>
            </div>

            <div className="flex flex-1 flex-col gap-3">
              <Field label="Title">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </Field>
              <Field label="Subtitle">
                <Input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Author">
                  <Input
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                  />
                </Field>
                <Field label="Publisher">
                  <Input
                    value={publisher}
                    onChange={(e) => setPublisher(e.target.value)}
                  />
                </Field>
              </div>
              <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                Rating
                <RatingInput value={rating} onChange={setRating} />
              </div>
              <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Reading Progress</span>
                  <span className="font-semibold text-primary">{progress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={progress}
                  onChange={(e) => setProgress(Number(e.target.value))}
                  className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
                />
              </div>
              <Field label="Tags (comma separated)">
                <Input value={tags} onChange={(e) => setTags(e.target.value)} />
              </Field>
              <Field label="Description">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </Field>
              <div className="grid grid-cols-2 items-end gap-3">
                <Field label="Reading status">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button
                          variant="outline"
                          type="button"
                          className="h-9 w-full justify-between rounded-md border-input bg-background px-3 text-sm font-normal text-foreground shadow-2xs hover:bg-accent"
                        />
                      }
                    >
                      <span
                        className={
                          status ? "text-foreground" : "text-muted-foreground"
                        }
                      >
                        {STATUSES.find((s) => s.value === status)?.label ??
                          "— None —"}
                      </span>
                      <ChevronDown className="h-4 w-4 text-muted-foreground opacity-60" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-(--anchor-width) min-w-44 p-1"
                    >
                      <DropdownMenuGroup>
                        <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          Reading Status
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setStatus("")}
                          className="cursor-pointer gap-2 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground"
                        >
                          <span className="flex-1">— None —</span>
                          {!status && <Check className="h-3.5 w-3.5 text-primary" />}
                        </DropdownMenuItem>
                        {STATUSES.map((s) => (
                          <DropdownMenuItem
                            key={s.value}
                            onClick={() => setStatus(s.value)}
                            className="cursor-pointer gap-2 rounded-md px-2.5 py-1.5 text-xs"
                          >
                            <span className="flex-1">{s.label}</span>
                            {status === s.value && (
                              <Check className="h-3.5 w-3.5 text-primary" />
                            )}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Field>
                <label className="flex items-center gap-2 pb-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={favorite}
                    onChange={(e) => setFavorite(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Favorite
                </label>
              </div>
            </div>
          </div>

          {/* Right Column: Ephemeral Fetched Data Panel */}
          {fetchedData && (
            <div className="md:col-span-5 flex max-h-[70vh] flex-col rounded-xl border border-primary/30 bg-muted/20 p-3.5 shadow-sm overflow-hidden animate-in fade-in slide-in-from-right-4 duration-200">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50">
                <div className="flex items-center gap-1.5">
                  <span className="rounded-md bg-primary/15 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {fetchedData.source}
                  </span>
                  <span className="text-xs font-semibold text-foreground">
                    Fetched Data
                  </span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-primary hover:bg-primary/10 cursor-pointer"
                    onClick={() => {
                      if (fetchedData.title) setTitle(fetchedData.title);
                      if (fetchedData.subtitle) setSubtitle(fetchedData.subtitle);
                      if (fetchedData.author) setAuthor(fetchedData.author);
                      if (fetchedData.publisher) setPublisher(fetchedData.publisher);
                      if (fetchedData.rating) setRating(fetchedData.rating);
                      if (fetchedData.tags) setTags(fetchedData.tags.join(", "));
                      if (fetchedData.description)
                        setDescription(fetchedData.description);
                    }}
                  >
                    Use All
                  </Button>
                  <button
                    type="button"
                    onClick={() => setFetchedData(null)}
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer"
                    title="Dismiss fetched data"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 text-xs">
                {fetchedData.coverUrl && (
                  <div className="flex items-center gap-3 rounded-md border border-border/70 bg-background/60 p-2">
                    <img
                      src={fetchedData.coverUrl}
                      alt="Fetched cover"
                      className="h-16 w-12 rounded object-cover shadow-xs shrink-0"
                    />
                    <div className="flex flex-col gap-1 min-w-0 flex-1">
                      <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                        Cover Image
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(fetchedData.coverUrl!, "coverUrl")}
                          className="rounded bg-accent px-2 py-0.5 text-[10px] text-foreground hover:bg-accent/80 transition-colors cursor-pointer"
                        >
                          {copiedField === "coverUrl" ? "Copied Link" : "Copy Link"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <FetchedFieldItem
                  label="Title"
                  value={fetchedData.title}
                  copied={copiedField === "title"}
                  onCopy={() => copyToClipboard(fetchedData.title || "", "title")}
                  onApply={() => fetchedData.title && setTitle(fetchedData.title)}
                />

                <FetchedFieldItem
                  label="Subtitle"
                  value={fetchedData.subtitle}
                  copied={copiedField === "subtitle"}
                  onCopy={() =>
                    copyToClipboard(fetchedData.subtitle || "", "subtitle")
                  }
                  onApply={() =>
                    fetchedData.subtitle && setSubtitle(fetchedData.subtitle)
                  }
                />

                <FetchedFieldItem
                  label="Author"
                  value={fetchedData.author}
                  copied={copiedField === "author"}
                  onCopy={() => copyToClipboard(fetchedData.author || "", "author")}
                  onApply={() => fetchedData.author && setAuthor(fetchedData.author)}
                />

                <FetchedFieldItem
                  label="Publisher"
                  value={fetchedData.publisher}
                  copied={copiedField === "publisher"}
                  onCopy={() =>
                    copyToClipboard(fetchedData.publisher || "", "publisher")
                  }
                  onApply={() =>
                    fetchedData.publisher && setPublisher(fetchedData.publisher)
                  }
                />

                {fetchedData.rating !== undefined && (
                  <FetchedFieldItem
                    label="Rating"
                    value={`${fetchedData.rating} / 5 stars`}
                    copied={copiedField === "rating"}
                    onCopy={() => copyToClipboard(String(fetchedData.rating), "rating")}
                    onApply={() => fetchedData.rating && setRating(fetchedData.rating)}
                  />
                )}

                {fetchedData.tags && fetchedData.tags.length > 0 && (
                  <FetchedFieldItem
                    label="Tags / Categories"
                    value={fetchedData.tags.join(", ")}
                    copied={copiedField === "tags"}
                    onCopy={() => copyToClipboard(fetchedData.tags!.join(", "), "tags")}
                    onApply={() => setTags(fetchedData.tags!.join(", "))}
                  />
                )}

                <FetchedFieldItem
                  label="Description"
                  value={fetchedData.description}
                  copied={copiedField === "desc"}
                  onCopy={() => copyToClipboard(fetchedData.description || "", "desc")}
                  onApply={() =>
                    fetchedData.description && setDescription(fetchedData.description)
                  }
                />
              </div>

              <div className="pt-2 mt-2 border-t border-border/40 text-[10px] text-muted-foreground/80 flex items-center justify-between">
                <span>In-memory preview only</span>
                <span>Cleared on close</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={save}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
