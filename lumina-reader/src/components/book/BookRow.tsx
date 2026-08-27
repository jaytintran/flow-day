import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Heart, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCover } from "@/lib/useCover";
import { useSettings, useUpdateBook } from "@/db/hooks";
import { useUIStore } from "@/stores/uiStore";
import type { Book } from "@/db/schema";
import { BookContextMenu } from "./BookContextMenu";
import { EditMetadataModal } from "./EditMetadataModal";

export function BookRow({
  book,
  scopeType,
  scopeId,
}: {
  book: Book;
  scopeType?: string;
  scopeId?: string;
}) {
  const { data: settings } = useSettings();
  const updateBook = useUpdateBook();
  const coverUrl = useCover(book.coverKey);
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const hasSelection = useUIStore((s) => s.selectedIds.length > 0);
  const selected = useUIStore((s) => s.selectedIds.includes(book.id!));
  const toggleSelected = useUIStore((s) => s.toggleSelected);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isLongPressRef = useRef(false);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    startPosRef.current = { x: e.clientX, y: e.clientY };
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      toggleSelected(book.id!);
      try {
        navigator.vibrate?.(40);
      } catch {
        // ignore
      }
    }, 500);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPosRef.current || !timerRef.current) return;
    const dist = Math.hypot(
      e.clientX - startPosRef.current.x,
      e.clientY - startPosRef.current.y,
    );
    if (dist > 8) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handlePointerUpOrCancel = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleClick = () => {
    if (isLongPressRef.current) {
      isLongPressRef.current = false;
      return;
    }
    if (hasSelection) {
      toggleSelected(book.id!);
    } else {
      navigate(`/reader/${book.id}`);
    }
  };

  return (
    <>
      <BookContextMenu
        book={book}
        onEdit={() => setEditing(true)}
        scopeType={scopeType}
        scopeId={scopeId}
      >
        <div
          className={cn(
            "group relative cursor-pointer rounded-lg border border-border bg-card p-4 transition-all hover:border-primary/50",
            selected && "border-primary bg-primary/10 ring-2 ring-primary shadow-md",
            hasSelection && !selected && "opacity-40 hover:opacity-75",
          )}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUpOrCancel}
          onPointerCancel={handlePointerUpOrCancel}
          onClick={handleClick}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleSelected(book.id!);
            }}
            className={cn(
              "absolute right-3 top-3 z-20 flex h-6 w-6 items-center justify-center rounded-full border bg-card shadow transition-all",
              selected
                ? "border-primary bg-primary text-primary-foreground scale-110"
                : hasSelection
                  ? "border-muted-foreground/50 opacity-90 hover:scale-105"
                  : "border-border opacity-0 group-hover:opacity-100 hover:opacity-100",
            )}
          >
            {selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
          </button>
          <div className="flex gap-4">
            <div className="relative shrink-0">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt={book.title}
                  className="h-32 w-22 shrink-0 rounded-sm object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-32 w-22 shrink-0 items-center justify-center rounded-sm bg-neutral-800 p-1 text-center text-[9px] font-bold text-white shadow-sm">
                  {book.title.slice(0, 24)}
                </div>
              )}

              {/* Status and Favorite Badges */}
              <div className="absolute left-1.5 top-1.5 z-10 flex flex-col items-start gap-1">
                {book.isFavorite && (
                  <span className="flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-950/80 text-rose-400 backdrop-blur border border-rose-500/30 shadow-xs">
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
                <h3 className="truncate text-sm font-semibold leading-tight">
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
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "h-3 w-3",
                        i < book.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground",
                      )}
                    />
                  ))}
                </div>
              )}
              {(settings?.showProgress ?? true) && (
                <div
                  className="flex flex-col gap-1 pt-0.5 max-w-xs"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
                    <span>Progress</span>
                    <span className="font-semibold text-primary">{book.progress ?? 0}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={book.progress ?? 0}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateBook.mutate({
                        id: book.id!,
                        patch: { progress: Number(e.target.value) },
                      });
                    }}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary hover:h-2 transition-all"
                  />
                </div>
              )}
              {(settings?.showTags ?? true) && book.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {book.tags.slice(0, 6).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              )}
              {(settings?.showDescription ?? true) && book.description && (
                <p className="line-clamp-2 text-xs text-muted-foreground">
                  {book.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </BookContextMenu>
      {editing && (
        <EditMetadataModal book={book} onClose={() => setEditing(false)} />
      )}
    </>
  );
}
