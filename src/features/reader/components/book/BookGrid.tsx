import type { ReactNode } from "react";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { BookCard } from "./BookCard";
import { BookRow } from "./BookRow";
import { useSettings } from "@/db/hooks";
import { useUIStore } from "@/stores/uiStore";
import type { Book } from "@/db/schema";

export type SortableMode = "global" | { folderId: number };

function SortableItem({
  id,
  children,
  disabled,
}: {
  id: number;
  children: ReactNode;
  disabled?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
      {...attributes}
      {...(disabled ? {} : listeners)}
    >
      {children}
    </div>
  );
}

export function BookGrid({
  books,
  scopeType,
  scopeId,
  sortable,
}: {
  books: Book[];
  scopeType?: string;
  scopeId?: string;
  sortable?: SortableMode;
}) {
  const { data: settings } = useSettings();
  const isEditingMetadata = useUIStore((s) => s.isEditingMetadata);
  const cols = settings?.booksPerRow ?? 4;
  const Row = settings?.viewMode === "row" ? BookRow : BookCard;

  const grid = (
    <div
      className="grid gap-4"
      style={{
        gridTemplateColumns:
          settings?.viewMode === "row"
            ? `repeat(auto-fill, minmax(min(100%, max(360px, calc(100% / ${cols} - 1rem))), 1fr))`
            : `repeat(${cols}, minmax(0, 1fr))`,
      }}
    >
      {books.map((book) =>
        sortable ? (
          <SortableItem
            key={book.id}
            id={book.id!}
            disabled={isEditingMetadata}
          >
            <Row book={book} scopeType={scopeType} scopeId={scopeId} />
          </SortableItem>
        ) : (
          <Row key={book.id} book={book} scopeType={scopeType} scopeId={scopeId} />
        ),
      )}
    </div>
  );

  if (!sortable) return grid;

  return (
    <SortableContext
      items={books.map((b) => b.id!)}
      strategy={rectSortingStrategy}
    >
      {grid}
    </SortableContext>
  );
}
