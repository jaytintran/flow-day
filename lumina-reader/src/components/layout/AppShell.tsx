import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
  pointerWithin,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { MobileSidebarDrawer } from "./MobileSidebarDrawer";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { BulkActionBar } from "@/components/book/BulkActionBar";
import {
  useBooks,
  useSettings,
  useUpdateBook,
  useAddBooksToCollection,
  useAddBooksToFolder,
  useReorderGlobal,
  useCollections,
  useSaveCollections,
} from "@/db/hooks";
import { useUIStore } from "@/stores/uiStore";
import { useCover } from "@/lib/useCover";
import type { Book } from "@/db/schema";

import { Heart, Star } from "lucide-react";
import type { Modifier } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

const snapCenterToCursor: Modifier = ({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
}) => {
  if (
    activatorEvent &&
    activeNodeRect &&
    "clientX" in activatorEvent &&
    "clientY" in activatorEvent
  ) {
    const mouseX = (activatorEvent as MouseEvent).clientX;
    const mouseY = (activatorEvent as MouseEvent).clientY;

    const width = overlayNodeRect ? overlayNodeRect.width : activeNodeRect.width;
    const height = overlayNodeRect ? overlayNodeRect.height : activeNodeRect.height;

    const originX = activeNodeRect.left + width / 2;
    const originY = activeNodeRect.top + height / 2;

    return {
      ...transform,
      x: transform.x + (mouseX - originX),
      y: transform.y + (mouseY - originY),
    };
  }
  return transform;
};

function DraggedBookOverlay({ book }: { book: Book }) {
  const { data: settings } = useSettings();
  const selectedIds = useUIStore((s) => s.selectedIds);
  const isBulk = selectedIds.length > 1 && selectedIds.includes(book.id!);
  const count = selectedIds.length;
  const coverUrl = useCover(book.coverKey);
  const isRow = settings?.viewMode === "row";

  if (isRow) {
    return (
      <div className="relative pointer-events-none select-none">
        {isBulk && (
          <>
            <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-lg border-2 border-primary/40 bg-card/60 rotate-2 shadow-lg" />
            <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-lg border-2 border-primary/60 bg-card/75 rotate-1 shadow-xl" />
          </>
        )}
        <div className="relative w-[340px] rounded-lg border-2 border-primary/80 bg-card/90 p-3 shadow-2xl backdrop-blur-md opacity-90">
          {isBulk && (
            <div className="absolute -top-3 -right-3 z-30 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-lg ring-2 ring-background animate-in zoom-in-75">
              <span>{count}</span>
              <span className="text-[10px] font-medium opacity-90">books</span>
            </div>
          )}
          <div className="flex gap-3.5">
            <div className="relative shrink-0">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={book.title}
                  className="h-28 w-20 shrink-0 rounded-sm object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-sm bg-neutral-800 p-1 text-center text-[9px] font-bold text-white shadow-sm">
                  {book.title.slice(0, 20)}
                </div>
              )}

              {/* Status and Favorite Badges */}
              <div className="absolute left-1 top-1 z-10 flex flex-col items-start gap-1">
                {book.isFavorite && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-950/80 text-rose-400 backdrop-blur border border-rose-500/30 shadow-xs">
                    <Heart className="h-2.5 w-2.5 fill-rose-500 text-rose-500" />
                  </span>
                )}
                {book.readingStatus === "finished" && (
                  <span className="rounded-full bg-green-950/80 px-1.5 py-0.2 text-[8px] font-semibold text-green-400 backdrop-blur border border-green-500/30 shadow-xs">
                    Finished
                  </span>
                )}
                {book.readingStatus === "currently-reading" && (
                  <span className="rounded-full bg-blue-950/80 px-1.5 py-0.2 text-[8px] font-semibold text-blue-400 backdrop-blur border border-blue-500/30 shadow-xs">
                    Reading
                  </span>
                )}
                {book.readingStatus === "wanna-read" && (
                  <span className="rounded-full bg-yellow-950/80 px-1.5 py-0.2 text-[8px] font-semibold text-yellow-400 backdrop-blur border border-yellow-500/30 shadow-xs">
                    Wanna Read
                  </span>
                )}
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              <div className="flex flex-col gap-0.5">
                <h3 className="truncate text-sm font-semibold leading-snug">
                  {book.title}
                </h3>
                {(settings?.showSubtitle ?? true) && book.subtitle && (
                  <p className="truncate text-[11px] italic font-normal text-muted-foreground/80 leading-tight">
                    {book.subtitle}
                  </p>
                )}
              </div>
              {(settings?.showAuthor ?? true) && (
                <p className="truncate text-xs font-medium text-foreground/80">
                  {book.author} <span className="text-[10px] font-normal text-muted-foreground/70">· {book.fileType.toUpperCase()}</span>
                </p>
              )}
              {(settings?.showRating ?? true) && (
                <div className="flex items-center gap-0.5 pt-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-3 w-3",
                        i < (book.rating ?? 0)
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground/40",
                      )}
                    />
                  ))}
                </div>
              )}
              {(settings?.showProgress ?? true) && (
                <div className="flex items-center gap-2 pt-0.5">
                  <div className="h-1.5 flex-1 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${book.progress ?? 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-primary">
                    {book.progress ?? 0}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pointer-events-none select-none">
      {isBulk && (
        <>
          <div className="absolute inset-0 translate-x-3 translate-y-3 rounded-lg border-2 border-primary/40 bg-card/60 rotate-3 shadow-lg" />
          <div className="absolute inset-0 translate-x-1.5 translate-y-1.5 rounded-lg border-2 border-primary/60 bg-card/75 rotate-1.5 shadow-xl" />
        </>
      )}
      <div className="relative w-52 rounded-lg border-2 border-primary/80 bg-card/90 p-3 shadow-2xl backdrop-blur-md opacity-90">
        {isBulk && (
          <div className="absolute -top-3 -right-3 z-30 flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground shadow-lg ring-2 ring-background animate-in zoom-in-75">
            <span>{count}</span>
            <span className="text-[10px] font-medium opacity-90">books</span>
          </div>
        )}
        <div className="flex flex-col gap-2.5">
          <div className="relative aspect-[2/3] w-full overflow-hidden rounded-md bg-neutral-900 shadow-sm">
            {coverUrl ? (
              <img
                src={coverUrl}
                alt={book.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center p-3 text-center">
                <span className="text-xs font-semibold line-clamp-3 text-white">
                  {book.title}
                </span>
                <span className="mt-1 text-[10px] text-neutral-400">
                  {book.fileType.toUpperCase()}
                </span>
              </div>
            )}

            {/* Status and Favorite Badges */}
            <div className="absolute left-1 top-1 z-10 flex flex-col items-start gap-1">
              {book.isFavorite && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-rose-950/80 text-rose-400 backdrop-blur border border-rose-500/30 shadow-xs">
                  <Heart className="h-2.5 w-2.5 fill-rose-500 text-rose-500" />
                </span>
              )}
              {book.readingStatus === "finished" && (
                <span className="rounded-full bg-green-950/80 px-1.5 py-0.2 text-[8px] font-semibold text-green-400 backdrop-blur border border-green-500/30 shadow-xs">
                  Finished
                </span>
              )}
              {book.readingStatus === "currently-reading" && (
                <span className="rounded-full bg-blue-950/80 px-1.5 py-0.2 text-[8px] font-semibold text-blue-400 backdrop-blur border border-blue-500/30 shadow-xs">
                  Reading
                </span>
              )}
              {book.readingStatus === "wanna-read" && (
                <span className="rounded-full bg-yellow-950/80 px-1.5 py-0.2 text-[8px] font-semibold text-yellow-400 backdrop-blur border border-yellow-500/30 shadow-xs">
                  Wanna Read
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-0.5">
            <h3 className="truncate text-sm font-semibold leading-snug">
              {book.title}
            </h3>
            {(settings?.showAuthor ?? true) && (
              <p className="truncate text-xs font-medium text-foreground/80">
                {book.author} <span className="text-[10px] font-normal text-muted-foreground/70">· {book.fileType.toUpperCase()}</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AppShell() {
  const { data: settings } = useSettings();
  const { data: books = [] } = useBooks();
  const { data: collections = [] } = useCollections();
  const saveCollections = useSaveCollections();
  const updateBook = useUpdateBook();
  const addToCollection = useAddBooksToCollection();
  const addToFolder = useAddBooksToFolder();
  const reorderGlobal = useReorderGlobal();

  const [activeBook, setActiveBook] = useState<Book | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 6,
      },
    }),
  );

  useEffect(() => {
    document.documentElement.classList.toggle(
      "dark",
      settings?.theme !== "light",
    );
  }, [settings?.theme]);

  const handleDragStart = (event: DragStartEvent) => {
    const id = event.active.id;
    if (typeof id === "number") {
      const found = books.find((b) => b.id === id);
      if (found) setActiveBook(found);
    }
  };

  const handleDragEnd = (e: DragEndEvent) => {
    setActiveBook(null);
    const { active, over } = e;
    if (!over) return;

    const activeIdStr = String(active.id);
    const overIdStr = String(over.id);

    // 1. Sidebar collection reordering
    if (activeIdStr.startsWith("sidebar-collection-")) {
      const activeColId = Number(activeIdStr.slice("sidebar-collection-".length));
      if (overIdStr.startsWith("sidebar-collection-")) {
        const overColId = Number(overIdStr.slice("sidebar-collection-".length));
        if (!Number.isNaN(activeColId) && !Number.isNaN(overColId) && activeColId !== overColId) {
          const oldIndex = collections.findIndex((c) => c.id === activeColId);
          const newIndex = collections.findIndex((c) => c.id === overColId);
          if (oldIndex !== -1 && newIndex !== -1) {
            const reordered = arrayMove(collections, oldIndex, newIndex).map((c, idx) => ({
              ...c,
              order: idx,
            }));
            saveCollections.mutate(reordered);
          }
        }
      }
      return;
    }

    // 2. Book drag & drop targets
    const activeId = active.id as number;
    if (activeId === (over.id as unknown)) return;

    const selectedIds = useUIStore.getState().selectedIds;
    const targetBookIds =
      selectedIds.length > 0 && selectedIds.includes(activeId)
        ? selectedIds
        : [activeId];

    // 2a. Sidebar primary navigation drop targets
    if (overIdStr === "sidebar-nav-favorites") {
      targetBookIds.forEach((id) => {
        updateBook.mutate({ id, patch: { isFavorite: true } });
      });
      if (selectedIds.length > 0) useUIStore.getState().clearSelection();
      return;
    }
    if (overIdStr === "sidebar-nav-reading") {
      targetBookIds.forEach((id) => {
        updateBook.mutate({ id, patch: { readingStatus: "currently-reading" } });
      });
      if (selectedIds.length > 0) useUIStore.getState().clearSelection();
      return;
    }
    if (overIdStr === "sidebar-nav-wanna-read") {
      targetBookIds.forEach((id) => {
        updateBook.mutate({ id, patch: { readingStatus: "wanna-read" } });
      });
      if (selectedIds.length > 0) useUIStore.getState().clearSelection();
      return;
    }
    if (overIdStr === "sidebar-nav-finished") {
      targetBookIds.forEach((id) => {
        updateBook.mutate({ id, patch: { readingStatus: "finished" } });
      });
      if (selectedIds.length > 0) useUIStore.getState().clearSelection();
      return;
    }

    // 2b. Sidebar collections drop targets
    if (overIdStr.startsWith("sidebar-collection-")) {
      const colId = Number(overIdStr.slice("sidebar-collection-".length));
      if (!Number.isNaN(colId)) {
        addToCollection.mutate({ bookIds: targetBookIds, collectionId: colId });
        if (selectedIds.length > 0) useUIStore.getState().clearSelection();
      }
      return;
    }

    // 2c. In-page folder drop targets
    if (overIdStr.startsWith("folder-")) {
      const folderId = Number(overIdStr.slice("folder-".length));
      if (!Number.isNaN(folderId)) {
        addToFolder.mutate({ bookIds: targetBookIds, folderId });
        if (selectedIds.length > 0) useUIStore.getState().clearSelection();
      }
      return;
    }

    // 2d. Global book reordering
    if (typeof over.id === "number") {
      const list = books.map((b) => b.id!);
      const oldI = list.indexOf(activeId);
      const newI = list.indexOf(over.id as number);
      if (oldI !== -1 && newI !== -1) {
        reorderGlobal.mutate(arrayMove(list, oldI, newI));
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-screen overflow-hidden bg-background text-foreground">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <div className="px-4 md:px-6 pt-2 md:pt-4">
            <BulkActionBar />
          </div>
          <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">
            <Outlet />
          </main>
        </div>
        <MobileNav />
        <MobileSidebarDrawer />
        <SettingsModal />
        <DragOverlay dropAnimation={null} modifiers={[snapCenterToCursor]}>
          {activeBook ? <DraggedBookOverlay book={activeBook} /> : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
}
