import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { LibrarySections } from "@/components/library/LibrarySections";
import { FolderIcon, FOLDER_ICONS } from "@/components/folder/FolderPillStrip";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  useCollectionBooks,
  useCollections,
  useDeleteCollection,
  useSaveCollections,
} from "@/db/hooks";
import { useUIStore } from "@/stores/uiStore";

export function CollectionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const collectionId = Number(id);
  const { data: collections = [] } = useCollections();
  const collection = collections.find((c) => c.id === collectionId);
  const { data: books = [] } = useCollectionBooks(collectionId);
  const saveCollections = useSaveCollections();
  const deleteCollection = useDeleteCollection();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const searchQuery = useUIStore((s) => s.searchQuery).trim().toLowerCase();

  const viewBooks = searchQuery
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

  if (!collection) {
    return <h1 className="text-2xl font-bold">Collection not found</h1>;
  }

  const rename = async () => {
    if (name.trim()) {
      await saveCollections.mutateAsync([{ ...collection, name: name.trim() }]);
    }
    setEditing(false);
  };

  const setIcon = async (iconKey: string) => {
    await saveCollections.mutateAsync([
      { ...collection, icon: iconKey || undefined },
    ]);
  };

  const remove = async () => {
    if (confirm(`Delete collection "${collection.name}"?`)) {
      await deleteCollection.mutateAsync(collection.id!);
      navigate("/");
    }
  };

  const renderIconSelector = (sizeClass = "h-9 w-9", iconSize = "h-5 w-5") => (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex items-center justify-center rounded-lg border border-border/60 bg-card hover:bg-accent hover:border-primary/50 text-primary transition-all cursor-pointer shadow-xs",
              sizeClass,
            )}
            title="Change collection icon"
          />
        }
      >
        <FolderIcon name={collection.icon} className={iconSize} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64 p-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-1 block">
          Choose Collection Icon
        </span>
        <div className="grid grid-cols-6 gap-1 max-h-56 overflow-y-auto p-0.5">
          {FOLDER_ICONS.map(({ key, Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => setIcon(collection.icon === key ? "" : key)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md border transition-colors cursor-pointer",
                collection.icon === key
                  ? "border-primary bg-primary/20 text-primary font-semibold"
                  : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
              title={key}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        {editing ? (
          <div className="flex items-center gap-2">
            {renderIconSelector("h-9 w-9", "h-4 w-4")}
            <Input
              value={name}
              autoFocus
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") rename();
                if (e.key === "Escape") setEditing(false);
              }}
              className="w-64"
            />
            <Button variant="ghost" size="icon-sm" onClick={rename}>
              <Check />
            </Button>
            <Button variant="ghost" size="icon-sm" onClick={() => setEditing(false)}>
              <X />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            {renderIconSelector()}
            <h1 className="text-2xl font-bold">{collection.name}</h1>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => {
              setName(collection.name);
              setEditing(true);
            }}
          >
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={remove}>
            <Trash2 />
          </Button>
        </div>
      </div>

      <LibrarySections
        baseBooks={viewBooks}
        scopeType="collection"
        scopeId={String(collectionId)}
        emptyText={
          searchQuery
            ? `No books match "${searchQuery}" in this collection.`
            : 'No books here yet — right-click any book and choose "Move to Collection".'
        }
      />
    </div>
  );
}
