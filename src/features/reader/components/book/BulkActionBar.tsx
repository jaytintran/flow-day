import { useState } from "react";
import {
  Check,
  ChevronDown,
  Edit3,
  Folder,
  FolderInput,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useUIStore } from "@/stores/uiStore";
import {
  useAddBooksToCollection,
  useCollections,
  useDeleteBooks,
} from "@/db/hooks";
import { BulkEditModal } from "./BulkEditModal";

export function BulkActionBar() {
  const ids = useUIStore((s) => s.selectedIds);
  const clearSelection = useUIStore((s) => s.clearSelection);
  const deleteBooks = useDeleteBooks();
  const addToCollection = useAddBooksToCollection();
  const { data: collections = [] } = useCollections();
  const [editOpen, setEditOpen] = useState(false);

  if (!ids.length) return null;

  const moveTo = (collectionId: number) => {
    addToCollection.mutate({ bookIds: ids, collectionId });
    clearSelection();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/90 px-4 py-2 shadow-xl shadow-black/5 dark:shadow-black/30 backdrop-blur-md transition-all animate-in fade-in zoom-in-95 duration-150">
      {/* Selected count info */}
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xs">
          <Check className="h-3.5 w-3.5 stroke-[2.5]" />
        </span>
        <span className="text-sm font-medium text-foreground">
          <span className="font-semibold text-primary">{ids.length}</span>{" "}
          {ids.length === 1 ? "book" : "books"} selected
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 rounded-lg text-xs font-medium shadow-2xs hover:bg-accent"
          onClick={() => setEditOpen(true)}
        >
          <Edit3 className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Edit</span>
        </Button>

        {collections.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 rounded-lg text-xs font-medium shadow-2xs hover:bg-accent"
                />
              }
            >
              <FolderInput className="h-3.5 w-3.5 text-muted-foreground" />
              <span>Collection</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-44 p-1">
              <DropdownMenuGroup>
                <DropdownMenuLabel className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Collections
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {collections.map((c) => (
                  <DropdownMenuItem
                    key={c.id}
                    onClick={() => moveTo(c.id!)}
                    className="cursor-pointer gap-2 rounded-md px-2.5 py-1.5 text-xs"
                  >
                    <Folder className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{c.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Button
          size="sm"
          variant="destructive"
          className="h-8 gap-1.5 rounded-lg text-xs font-medium shadow-2xs"
          onClick={() => {
            deleteBooks.mutate(ids);
            clearSelection();
          }}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Delete</span>
        </Button>

        <div className="mx-1 h-4 w-px bg-border" />

        <Button
          size="icon"
          variant="ghost"
          className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
          onClick={clearSelection}
          title="Clear selection"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Clear selection</span>
        </Button>
      </div>

      {editOpen && (
        <BulkEditModal ids={ids} onClose={() => setEditOpen(false)} />
      )}
    </div>
  );
}
