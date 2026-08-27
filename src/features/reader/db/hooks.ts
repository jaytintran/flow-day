import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { db } from "./db";
import { deleteFile } from "./opfs";
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type Book,
  type BookCollection,
  type BookFolder,
  type Collection,
  type Folder,
} from "./schema";

// Query keys are stable per list. staleTime: Infinity (set in queryClient)
// means a fetched list lives in the cache for the session, so navigating
// between views never refetches and never shows a skeleton again.
export const keys = {
  books: ["books"] as const,
  book: (id: number) => ["books", id] as const,
  collections: ["collections"] as const,
  folders: ["folders"] as const,
  folderScope: (scopeType: string, scopeId: string) =>
    ["folders", scopeType, scopeId] as const,
  folderOrder: (folderId: number) => ["bookOrder", folderId] as const,
  collectionBooks: (id: number) => ["bookCollections", id] as const,
  scopeBooks: ["scopeBooks"] as const,
  settings: ["settings"] as const,
  bookmarks: (bookId: number) => ["bookmarks", bookId] as const,
  highlights: (bookId: number) => ["highlights", bookId] as const,
  notes: (bookId: number) => ["notes", bookId] as const,
  progress: (bookId: number) => ["progress", bookId] as const,
};

function useInvalidate() {
  const qc = useQueryClient();
  return (queryKeys: readonly (readonly unknown[])[]) =>
    queryKeys.forEach((key) => qc.invalidateQueries({ queryKey: [...key] }));
}

// --- Queries -------------------------------------------------------------

export function useBooks() {
  return useQuery({
    queryKey: keys.books,
    queryFn: () => db.books.orderBy("order").toArray(),
  });
}

export function useBook(id?: number) {
  return useQuery({
    queryKey: keys.book(id!),
    enabled: id != null,
    queryFn: () => db.books.get(id!),
  });
}

export function useCollections() {
  return useQuery({
    queryKey: keys.collections,
    queryFn: () => db.collections.orderBy("order").toArray(),
  });
}

export function useFolders(scopeType: string, scopeId: string) {
  return useQuery({
    queryKey: keys.folderScope(scopeType, scopeId),
    queryFn: () => db.folders.where({ scopeType, scopeId }).sortBy("order"),
  });
}

export function useCollectionBooks(collectionId: number) {
  return useQuery({
    queryKey: keys.collectionBooks(collectionId),
    queryFn: async () => {
      const rows = await db.bookCollections
        .where("collectionId")
        .equals(collectionId)
        .toArray();
      if (!rows.length) return [] as Book[];
      const books = await db.books.bulkGet(rows.map((r) => r.bookId));
      return books
        .filter((b): b is Book => !!b)
        .sort((a, b) => a.order - b.order);
    },
  });
}

/** Partition a base book list into this scope's folders + ungrouped books. */
export function useScopeBooks(
  baseBooks: Book[] | undefined,
  scopeType: string,
  scopeId: string,
) {
  const { data: folders = [] } = useFolders(scopeType, scopeId);
  const folderIds = folders.map((f) => f.id!).filter(Boolean);

  const { data: bookFolders = [] } = useQuery({
    queryKey: ["bookFolders", scopeType, scopeId, folderIds] as const,
    enabled: folderIds.length > 0,
    queryFn: () => db.bookFolders.where("folderId").anyOf(folderIds).toArray(),
  });

  const { data: orderRows = [] } = useQuery({
    queryKey: ["bookOrderScope", scopeType, scopeId, folderIds] as const,
    enabled: folderIds.length > 0,
    queryFn: () =>
      db.bookOrder
        .where("[scopeType+scopeId]")
        .anyOf(folderIds.map((id) => ["folder", String(id)] as [string, string]))
        .toArray(),
  });

  const books = baseBooks ?? [];
  const grouped = new Map<number, Book[]>();
  for (const f of folders) grouped.set(f.id!, []);

  if (folders.length && books.length) {
    const byId = new Map(books.map((b) => [b.id!, b]));
    const pos = new Map(orderRows.map((o) => [`${o.scopeId}:${o.bookId}`, o.position]));
    for (const r of bookFolders) {
      const book = byId.get(r.bookId);
      if (book) grouped.get(r.folderId)?.push(book);
    }
    for (const f of folders) {
      grouped
        .get(f.id!)!
        .sort(
          (a, b) =>
            (pos.get(`${f.id}:${a.id}`) ?? 0) - (pos.get(`${f.id}:${b.id}`) ?? 0),
        );
    }
  }

  // All base books remain in the main flat list view
  const ungrouped = books;

  return {
    data: { folders, grouped, ungrouped },
    isLoading: false,
  };
}

export function useFolderOrder(folderId: number) {
  return useQuery({
    queryKey: keys.folderOrder(folderId),
    queryFn: () =>
      db.bookOrder
        .where("[scopeType+scopeId]")
        .equals(["folder", String(folderId)])
        .toArray(),
  });
}

export function useSettings() {
  return useQuery({
    queryKey: keys.settings,
    queryFn: () => db.settings.get("app").then((s) => s ?? DEFAULT_SETTINGS),
  });
}

// --- Mutations -----------------------------------------------------------

export function useUpdateSettings() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (patch: Partial<AppSettings>) => {
      const current = (await db.settings.get("app")) ?? DEFAULT_SETTINGS;
      await db.settings.put({ ...current, ...patch, key: "app" });
    },
    onSuccess: () => invalidate([keys.settings]),
  });
}

export function useUpsertBooks() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (books: Book[]) => db.books.bulkPut(books),
    onSuccess: () => invalidate([keys.books]),
  });
}

export function useUpdateBook() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: Partial<Book> }) =>
      db.books.update(id, patch),
    onSuccess: (_res, { id }) => invalidate([keys.books, keys.book(id)]),
  });
}

export function useDeleteBooks() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      const books = await db.books.bulkGet(ids);
      for (const b of books) {
        if (!b) continue;
        if (b.fileKey) await deleteFile(b.fileKey);
        if (b.coverKey) await deleteFile(b.coverKey);
      }
      await db.books.bulkDelete(ids);
    },
    onSuccess: () => invalidate([keys.books]),
  });
}

export function useSaveCollections() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (collections: Collection[]) => db.collections.bulkPut(collections),
    onSuccess: () => invalidate([keys.collections]),
  });
}

export function useDeleteCollection() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (id: number) => {
      await db.collections.delete(id);
      await db.bookCollections.where("collectionId").equals(id).delete();
      await db.folders.where({ scopeType: "collection", scopeId: String(id) }).delete();
    },
    onSuccess: () => invalidate([keys.collections, keys.folders]),
  });
}

export function useSaveFolders() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (folders: Folder[]) => db.folders.bulkPut(folders),
    onSuccess: () => invalidate([keys.folders, keys.scopeBooks]),
  });
}

export function useDeleteFolder() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await db.folders.delete(id);
      await db.bookFolders.where("folderId").equals(id).delete();
      await db.bookOrder.where({ scopeType: "folder", scopeId: String(id) }).delete();
    },
    onSuccess: () => {
      invalidate([keys.folders, keys.books]);
      qc.invalidateQueries({ queryKey: ["bookFolders"] });
      qc.invalidateQueries({ queryKey: ["bookOrderScope"] });
    },
  });
}

/** Add books to a folder (idempotent — skips books already in it). */
export function useAddBooksToFolder() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bookIds,
      folderId,
    }: {
      bookIds: number[];
      folderId: number;
    }) => {
      const existing = await db.bookFolders.where("folderId").equals(folderId).toArray();
      const have = new Set(existing.map((r) => r.bookId));
      const rows: BookFolder[] = bookIds
        .filter((id) => !have.has(id))
        .map((bookId) => ({ bookId, folderId }));
      if (rows.length) await db.bookFolders.bulkAdd(rows);
    },
    onSuccess: () => {
      invalidate([keys.books, keys.folders]);
      qc.invalidateQueries({ queryKey: ["bookFolders"] });
      qc.invalidateQueries({ queryKey: ["bookOrderScope"] });
    },
  });
}

/** Add books to a collection (idempotent — skips books already in it). */
export function useAddBooksToCollection() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      bookIds,
      collectionId,
    }: {
      bookIds: number[];
      collectionId: number;
    }) => {
      const existing = await db.bookCollections
        .where("collectionId")
        .equals(collectionId)
        .toArray();
      const have = new Set(existing.map((r) => r.bookId));
      const rows: BookCollection[] = bookIds
        .filter((id) => !have.has(id))
        .map((bookId) => ({ bookId, collectionId }));
      if (rows.length) await db.bookCollections.bulkAdd(rows);
    },
    onSuccess: (_res, { collectionId }) => {
      invalidate([keys.books, keys.collections, keys.collectionBooks(collectionId)]);
      qc.invalidateQueries({ queryKey: ["bookCollections"] });
    },
  });
}

export function useRemoveBookFromCollection() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ bookId, collectionId }: { bookId: number; collectionId: number }) =>
      db.bookCollections.where({ bookId, collectionId }).delete(),
    onSuccess: (_res, { collectionId }) =>
      invalidate([keys.books, keys.collections, keys.collectionBooks(collectionId)]),
  });
}

export function useRemoveBookFromFolder() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bookId, folderId }: { bookId: number; folderId: number }) =>
      db.bookFolders.where({ bookId, folderId }).delete(),
    onSuccess: () => {
      invalidate([keys.books, keys.folders]);
      qc.invalidateQueries({ queryKey: ["bookFolders"] });
      qc.invalidateQueries({ queryKey: ["bookOrderScope"] });
    },
  });
}

/** Rewrite the global book order from an array of book ids. */
export function useReorderGlobal() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (ids: number[]) =>
      Promise.all(ids.map((id, index) => db.books.update(id, { order: index }))),
    onSuccess: () => invalidate([keys.books]),
  });
}

/** Rewrite a folder's own book order (does not touch the global order). */
export function useReorderInFolder() {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ folderId, ids }: { folderId: number; ids: number[] }) =>
      Promise.all(
        ids.map((bookId, position) =>
          db.bookOrder.put({ bookId, scopeType: "folder", scopeId: String(folderId), position }),
        ),
      ),
    onSuccess: (_res, { folderId }) => {
      invalidate([keys.folderOrder(folderId), keys.books]);
      qc.invalidateQueries({ queryKey: ["bookOrderScope"] });
    },
  });
}

// --- Reader Hooks ---

export function useBookmarks(bookId?: number) {
  return useQuery({
    queryKey: keys.bookmarks(bookId!),
    enabled: bookId != null,
    queryFn: () =>
      db.bookmarks.where("bookId").equals(bookId!).sortBy("createdAt"),
  });
}

export function useAddBookmark() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: { bookId: number; title: string; pageOrLocation: number | string }) =>
      db.bookmarks.add({ ...data, createdAt: Date.now() }),
    onSuccess: (_res, { bookId }) => invalidate([keys.bookmarks(bookId)]),
  });
}

export function useDeleteBookmark() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id }: { id: number; bookId: number }) =>
      db.bookmarks.delete(id),
    onSuccess: (_res, { bookId }) => invalidate([keys.bookmarks(bookId)]),
  });
}

export function useHighlights(bookId?: number) {
  return useQuery({
    queryKey: keys.highlights(bookId!),
    enabled: bookId != null,
    queryFn: () =>
      db.highlights.where("bookId").equals(bookId!).sortBy("createdAt"),
  });
}

export function useAddHighlight() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: {
      bookId: number;
      text: string;
      color: string;
      pageOrLocation: number | string;
    }) => db.highlights.add({ ...data, createdAt: Date.now() }),
    onSuccess: (_res, { bookId }) => invalidate([keys.highlights(bookId)]),
  });
}

export function useDeleteHighlight() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id }: { id: number; bookId: number }) =>
      db.highlights.delete(id),
    onSuccess: (_res, { bookId }) => invalidate([keys.highlights(bookId)]),
  });
}

export function useNotes(bookId?: number) {
  return useQuery({
    queryKey: keys.notes(bookId!),
    enabled: bookId != null,
    queryFn: () => db.notes.where("bookId").equals(bookId!).reverse().sortBy("updatedAt"),
  });
}

export function useAddNote() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (data: {
      bookId: number;
      title?: string;
      icon?: string;
      content: string;
      pageOrLocation?: number | string;
    }) =>
      db.notes.add({
        ...data,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    onSuccess: (_res, { bookId }) => invalidate([keys.notes(bookId)]),
  });
}

export function useUpdateNote() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      bookId: _bookId,
      patch,
    }: {
      id: number;
      bookId: number;
      patch: {
        title?: string;
        icon?: string;
        content?: string;
        pageOrLocation?: number | string;
      };
    }) =>
      db.notes.update(id, {
        ...patch,
        updatedAt: Date.now(),
      }),
    onSuccess: (_res, { bookId }) => invalidate([keys.notes(bookId)]),
  });
}

export function useDeleteNote() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id }: { id: number; bookId: number }) =>
      db.notes.delete(id),
    onSuccess: (_res, { bookId }) => invalidate([keys.notes(bookId)]),
  });
}

export function useReadingProgress(bookId?: number) {
  return useQuery({
    queryKey: keys.progress(bookId!),
    enabled: bookId != null,
    queryFn: () => db.readingProgress.where("bookId").equals(bookId!).first(),
  });
}

export function useSaveReadingProgress() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: async (data: {
      bookId: number;
      pageOrLocation: number | string;
      percentage: number;
    }) => {
      const existing = await db.readingProgress
        .where("bookId")
        .equals(data.bookId)
        .first();
      if (existing?.id) {
        await db.readingProgress.update(existing.id, {
          ...data,
          updatedAt: Date.now(),
        });
      } else {
        await db.readingProgress.add({
          ...data,
          updatedAt: Date.now(),
        });
      }
    },
    onSuccess: (_res, { bookId }) => invalidate([keys.progress(bookId)]),
  });
}
