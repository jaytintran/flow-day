import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { ChevronDown, ChevronRight, FolderPlus } from "lucide-react";
import { useScopeBooks } from "@/db/hooks";
import type { Book, Folder as FolderT } from "@/db/schema";
import { BookGrid } from "@/components/book/BookGrid";
import {
  FolderIcon,
  FolderPillStrip,
} from "@/components/folder/FolderPillStrip";

function FolderSection({
  folder,
  books,
  scopeType,
  scopeId,
}: {
  folder: FolderT;
  books: Book[];
  scopeType: string;
  scopeId: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `folder-${folder.id}` });
  const storageKey = `folder-collapsed-${folder.id}`;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  });

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(storageKey, String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  return (
    <section
      ref={setNodeRef}
      id={`folder-${folder.id}`}
      className={`flex scroll-mt-24 flex-col gap-3 rounded-xl border transition-all p-4 ${
        isOver
          ? "border-primary bg-primary/10 ring-2 ring-primary/30"
          : "border-border/70 bg-card/40 hover:border-border"
      }`}
    >
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={toggleCollapsed}
          className="flex items-center gap-2.5 text-base font-semibold text-foreground hover:text-primary transition-colors cursor-pointer group"
        >
          <span className="text-muted-foreground group-hover:text-primary transition-colors">
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </span>
          <FolderIcon name={folder.icon} className="h-5 w-5 text-primary" />
          <span>{folder.name}</span>
          <span className="text-xs font-normal text-muted-foreground tabular-nums">
            ({books.length} {books.length === 1 ? "book" : "books"})
          </span>
        </button>
      </div>

      {!collapsed && (
        <div className="pt-1">
          {books.length > 0 ? (
            <BookGrid
              books={books}
              scopeType={scopeType}
              scopeId={scopeId}
              sortable={{ folderId: folder.id! }}
            />
          ) : (
            <div
              className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed py-8 px-4 text-center transition-all ${
                isOver
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border/80 bg-background/30 text-muted-foreground"
              }`}
            >
              <FolderPlus className="h-8 w-8 mb-2 opacity-60" />
              <p className="text-sm font-medium">Empty folder</p>
              <p className="text-xs opacity-75 mt-0.5">
                Drag and drop book cards here to add them to "{folder.name}"
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export function LibrarySections({
  title,
  baseBooks,
  scopeType,
  scopeId,
  emptyText,
}: {
  title?: string;
  baseBooks: Book[];
  scopeType: string;
  scopeId: string;
  emptyText: string;
}) {
  const { data } = useScopeBooks(baseBooks, scopeType, scopeId);

  if (!data) return null;
  const { folders, grouped, ungrouped } = data;

  return (
    <div className="flex flex-col gap-8">
      <FolderPillStrip scopeType={scopeType} scopeId={scopeId} />

      {/* FLAT LIST BOOKS */}
      {ungrouped.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">
            {folders.length ? "All Books" : title || "All Books"}
          </h2>
          <BookGrid
            books={ungrouped}
            scopeType={scopeType}
            scopeId={scopeId}
            sortable="global"
          />
        </section>
      )}
      {baseBooks.length === 0 && (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      )}

      {/* FOLDER SECTIONS */}
      {folders.map((f) => (
        <FolderSection
          key={f.id}
          folder={f}
          books={grouped.get(f.id!) ?? []}
          scopeType={scopeType}
          scopeId={scopeId}
        />
      ))}
    </div>
  );
}
