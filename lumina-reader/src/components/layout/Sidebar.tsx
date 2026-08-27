import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  Home,
  Heart,
  BookOpen,
  Bookmark,
  CheckCircle2,
  Plus,
  Users,
  Building2,
  Tag,
  Star,
  Shuffle,
  GripVertical,
  Trash2,
  Check,
} from "lucide-react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";
import {
  useBooks,
  useCollections,
  useSaveCollections,
  useDeleteCollection,
} from "@/db/hooks";
import type { Collection } from "@/db/schema";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FolderIcon, FOLDER_ICONS } from "@/components/folder/FolderPillStrip";

const primaryNav = [
  { to: "/", label: "Home", icon: Home, dropId: "sidebar-nav-home" },
  { to: "/favorites", label: "Favorites", icon: Heart, dropId: "sidebar-nav-favorites" },
  { to: "/currently-reading", label: "Currently Reading", icon: BookOpen, dropId: "sidebar-nav-reading" },
  { to: "/wanna-read", label: "Wanna Read", icon: Bookmark, dropId: "sidebar-nav-wanna-read" },
  { to: "/finished", label: "Finished", icon: CheckCircle2, dropId: "sidebar-nav-finished" },
];

const smartViews = [
  { to: "/authors", label: "Authors", icon: Users },
  { to: "/publishers", label: "Publishers", icon: Building2 },
  { to: "/tags", label: "Tags", icon: Tag },
  { to: "/ratings", label: "Ratings", icon: Star },
];

function DroppableNavItem({
  to,
  label,
  icon: Icon,
  dropId,
}: {
  to: string;
  label: string;
  icon: typeof Home;
  dropId?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: dropId ?? `nav-${to}`,
    disabled: !dropId,
  });

  return (
    <div ref={setNodeRef} className="w-full">
      <NavLink
        to={to}
        className={({ isActive }) =>
          cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all whitespace-nowrap",
            isActive
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-accent hover:text-foreground",
            isOver && "bg-primary/25 text-primary ring-1 ring-primary scale-[1.02]",
          )
        }
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="whitespace-nowrap">{label}</span>
      </NavLink>
    </div>
  );
}

function SortableCollectionItem({
  collection,
}: {
  collection: Collection;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(collection.name);
  const saveCollections = useSaveCollections();
  const deleteCollection = useDeleteCollection();
  const navigate = useNavigate();

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: `sidebar-collection-${collection.id}` });

  const handleSave = async (iconToSave?: string, close = true) => {
    const trimmed = name.trim();
    const finalName = trimmed || collection.name;
    const finalIcon = iconToSave !== undefined ? iconToSave : collection.icon;
    await saveCollections.mutateAsync([
      {
        ...collection,
        name: finalName,
        icon: finalIcon || undefined,
      },
    ]);
    if (close) {
      setEditing(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (collection.id) {
      await deleteCollection.mutateAsync(collection.id);
      navigate("/");
    }
  };

  if (editing) {
    return (
      <div
        ref={setNodeRef}
        className="flex items-center gap-1 rounded-md bg-accent/70 p-1 ring-1 ring-primary/40"
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-background hover:bg-accent text-primary transition-colors cursor-pointer"
                title="Change icon"
              />
            }
          >
            <FolderIcon name={collection.icon} className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56 p-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground px-1 pb-1 block">
              Choose Icon
            </span>
            <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto p-0.5">
              {FOLDER_ICONS.map(({ key, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSave(collection.icon === key ? "" : key, false)}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded border transition-colors cursor-pointer",
                    collection.icon === key
                      ? "border-primary bg-primary/20 text-primary"
                      : "border-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                  title={key}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setName(collection.name);
              setEditing(false);
            }
          }}
          className="h-7 flex-1 text-xs px-2"
        />

        <button
          type="button"
          onClick={() => handleSave()}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-primary hover:bg-primary/15 transition-colors cursor-pointer"
          title="Save changes"
        >
          <Check className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleDelete}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-destructive/15 transition-colors cursor-pointer"
          title="Delete collection"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      onContextMenu={(e) => {
        e.preventDefault();
        setName(collection.name);
        setEditing(true);
      }}
      title="Right-click to edit or delete"
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : undefined,
        zIndex: isDragging ? 20 : undefined,
      }}
      className={cn(
        "group/col flex items-center rounded-md transition-all",
        isOver && !isDragging && "bg-primary/25 ring-2 ring-primary scale-[1.02] shadow-sm",
      )}
    >
      <div
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover/col:opacity-100 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing transition-opacity"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      <div className="flex-1 rounded-md min-w-0">
        <NavLink
          to={`/collections/${collection.id}`}
          className={({ isActive }) =>
            cn(
              "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-sm font-medium transition-colors whitespace-nowrap",
              isActive
                ? "bg-primary/15 text-primary font-semibold"
                : "text-muted-foreground hover:bg-accent hover:text-foreground",
              isOver && !isDragging && "text-primary font-semibold",
            )
          }
        >
          <FolderIcon name={collection.icon} className="h-4 w-4 shrink-0 text-primary/80" />
          <span className="whitespace-nowrap truncate">{collection.name}</span>
        </NavLink>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { data: books = [] } = useBooks();
  const { data: collections = [] } = useCollections();
  const saveCollections = useSaveCollections();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const handleRandomBook = () => {
    if (books.length === 0) return;
    const randomIndex = Math.floor(Math.random() * books.length);
    const chosen = books[randomIndex];
    if (chosen?.id) {
      navigate(`/reader/${chosen.id}`);
    }
  };

  const addCollection = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await saveCollections.mutateAsync([{ name: trimmed, order: collections.length }]);
    setName("");
    setAdding(false);
  };

  return (
    <aside className="hidden md:flex h-screen min-w-64 max-w-sm w-max shrink-0 flex-col border-r border-border bg-background transition-all duration-200">
      <div className="flex items-center gap-3 px-4 py-4.5 whitespace-nowrap border-b border-border/40">
        <div className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-400 via-indigo-500 to-purple-600 shadow-md shadow-indigo-500/20 shrink-0">
          <svg
            className="h-5 w-5 text-white"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" fill="white" fillOpacity="0.2" />
            <path d="M6 2v20" />
            <path d="M12 7l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" fill="white" stroke="none" />
          </svg>
        </div>
        <div className="flex flex-col">
          <span className="text-base font-extrabold tracking-wider bg-gradient-to-r from-sky-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
            LUMINA
          </span>
          <span className="text-[10px] uppercase font-semibold tracking-widest text-muted-foreground/80 -mt-1">
            Ebook Reader
          </span>
        </div>
      </div>

      <nav className="flex flex-1 flex-col gap-6 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {/* Primary Sections (Drop Targets) */}
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={handleRandomBook}
            disabled={books.length === 0}
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-all whitespace-nowrap text-muted-foreground hover:bg-primary/15 hover:text-primary disabled:opacity-40 disabled:pointer-events-none cursor-pointer group"
            title={books.length ? "Read a random book" : "No books in library"}
          >
            <Shuffle className="h-4 w-4 shrink-0 transition-transform group-hover:rotate-180 duration-300 text-primary" />
            <span className="whitespace-nowrap font-medium">Random Book</span>
          </button>

          {primaryNav.map((item) => (
            <DroppableNavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              dropId={item.dropId}
            />
          ))}
        </div>

        {/* Collections with Drag-to-Reorder and Drop Targets */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between px-3 py-1 whitespace-nowrap">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Collections
            </span>
            <button
              onClick={() => setAdding((v) => !v)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded hover:bg-accent cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
          {adding && (
            <div className="px-3 pb-1">
              <Input
                autoFocus
                value={name}
                placeholder="Collection name"
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") addCollection();
                  if (e.key === "Escape") setAdding(false);
                }}
                onBlur={addCollection}
                className="h-8 text-sm"
              />
            </div>
          )}

          <SortableContext
            items={collections.map((c) => `sidebar-collection-${c.id}`)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-0.5">
              {collections.map((c) => (
                <SortableCollectionItem key={c.id} collection={c} />
              ))}
            </div>
          </SortableContext>
        </div>

        {/* Smart Views */}
        <div className="flex flex-col gap-1">
          <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
            Smart Views
          </span>
          {smartViews.map((item) => (
            <DroppableNavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </div>
      </nav>
    </aside>
  );
}
