import { useState } from "react";
import { BookOpen, Building2, Star, Tag, User } from "lucide-react";
import { BookGrid } from "@/components/book/BookGrid";
import { useBooks } from "@/db/hooks";
import type { Book } from "@/db/schema";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/uiStore";

type Group = { key: string; books: Book[] };

function groupBy(books: Book[], pick: (b: Book) => string): Group[] {
  const map = new Map<string, Book[]>();
  for (const b of books) {
    const raw = pick(b)?.trim();
    const key = raw || "Unknown / Unspecified";
    map.set(key, [...(map.get(key) ?? []), b]);
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
    .map(([key, bs]) => ({
      key,
      books: bs.sort((x, y) => x.order - y.order),
    }));
}

const GROUPERS: Record<string, (books: Book[]) => Group[]> = {
  Authors: (books) => groupBy(books, (b) => b.author),
  Publishers: (books) => groupBy(books, (b) => b.publisher ?? ""),
  Tags: (books) => {
    const map = new Map<string, Book[]>();
    const untagged: Book[] = [];
    for (const b of books) {
      if (!b.tags || b.tags.length === 0) {
        untagged.push(b);
      } else {
        for (const t of b.tags) {
          const clean = t.trim();
          if (clean) {
            map.set(clean, [...(map.get(clean) ?? []), b]);
          }
        }
      }
    }
    const res = [...map.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { sensitivity: "base" }))
      .map(([key, bs]) => ({
        key,
        books: bs.sort((x, y) => x.order - y.order),
      }));

    if (untagged.length > 0) {
      res.push({ key: "Untagged", books: untagged });
    }
    return res;
  },
  Ratings: (books) => {
    const ratingBuckets: { [rating: number]: Book[] } = {
      5: [],
      4: [],
      3: [],
      2: [],
      1: [],
      0: [],
    };
    for (const b of books) {
      const r = Math.max(0, Math.min(5, Math.floor(b.rating ?? 0)));
      ratingBuckets[r].push(b);
    }
    const res: Group[] = [];
    for (let r = 5; r >= 1; r--) {
      if (ratingBuckets[r].length > 0) {
        res.push({
          key: `${r} Star${r > 1 ? "s" : ""}`,
          books: ratingBuckets[r].sort((x, y) => x.order - y.order),
        });
      }
    }
    if (ratingBuckets[0].length > 0) {
      res.push({
        key: "Unrated",
        books: ratingBuckets[0].sort((x, y) => x.order - y.order),
      });
    }
    return res;
  },
};

const VIEW_ICONS: Record<string, typeof User> = {
  Authors: User,
  Publishers: Building2,
  Tags: Tag,
  Ratings: Star,
};

export function SmartViewPage({ viewLabel }: { viewLabel: string }) {
  const { data: books = [] } = useBooks();
  const searchQuery = useUIStore((s) => s.searchQuery).trim().toLowerCase();

  const filteredBooks = searchQuery
    ? books.filter((b) => {
        const titleMatch = b.title.toLowerCase().includes(searchQuery);
        const subtitleMatch = b.subtitle?.toLowerCase().includes(searchQuery) ?? false;
        const authorMatch = b.author.toLowerCase().includes(searchQuery);
        const publisherMatch = b.publisher?.toLowerCase().includes(searchQuery) ?? false;
        const tagMatch = b.tags.some((t) => t.toLowerCase().includes(searchQuery));
        const descMatch = b.description?.toLowerCase().includes(searchQuery) ?? false;
        return titleMatch || subtitleMatch || authorMatch || publisherMatch || tagMatch || descMatch;
      })
    : books;

  const group = GROUPERS[viewLabel] ?? ((bs: Book[]) => [{ key: viewLabel, books: bs }]);
  const groups = group(filteredBooks);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const Icon = VIEW_ICONS[viewLabel] ?? BookOpen;
  const filteredGroups = selectedKey ? groups.filter((g) => g.key === selectedKey) : groups;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Icon className="h-5 w-5" />
            </span>
            {viewLabel}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {groups.length} {viewLabel.toLowerCase()} category groups · {books.length} total books
          </p>
        </div>

        {/* Quick Filter Pill Strip */}
        {groups.length > 1 && (
          <div className="flex flex-wrap items-center gap-1.5 max-w-xl">
            <button
              onClick={() => setSelectedKey(null)}
              className={cn(
                "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                selectedKey === null
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground hover:text-foreground"
              )}
            >
              All ({groups.length})
            </button>
            {groups.slice(0, 15).map((g) => (
              <button
                key={g.key}
                onClick={() => setSelectedKey(selectedKey === g.key ? null : g.key)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors truncate max-w-[150px]",
                  selectedKey === g.key
                    ? "bg-primary text-primary-foreground"
                    : "border border-border bg-card text-muted-foreground hover:text-foreground"
                )}
              >
                {g.key} ({g.books.length})
              </button>
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            No books found. Import books into your library to populate this Smart View.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-8">
        {filteredGroups.map((g) => (
          <section key={g.key} className="flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-border/60 pb-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold">
                <span className="h-2 w-2 rounded-full bg-primary" />
                {g.key}
                <span className="text-xs font-normal text-muted-foreground">
                  ({g.books.length} {g.books.length === 1 ? "book" : "books"})
                </span>
              </h2>
            </div>
            <BookGrid books={g.books} />
          </section>
        ))}
      </div>
    </div>
  );
}
