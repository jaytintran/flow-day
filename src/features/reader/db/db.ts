import Dexie, { type EntityTable } from "dexie";
import type {
  Book,
  Collection,
  Folder,
  BookFolder,
  BookCollection,
  BookOrder,
  AppSettings,
  Bookmark,
  Highlight,
  Note,
  ReadingProgress,
} from "./schema";

export const db = new Dexie("BookshelfDB") as Dexie & {
  books: EntityTable<Book, "id">;
  collections: EntityTable<Collection, "id">;
  folders: EntityTable<Folder, "id">;
  bookFolders: EntityTable<BookFolder, "id">;
  bookCollections: EntityTable<BookCollection, "id">;
  bookOrder: EntityTable<BookOrder, "id">;
  settings: EntityTable<AppSettings, "key">;
  bookmarks: EntityTable<Bookmark, "id">;
  highlights: EntityTable<Highlight, "id">;
  notes: EntityTable<Note, "id">;
  readingProgress: EntityTable<ReadingProgress, "id">;
};

db.version(2).stores({
  books: "++id, title, author, publisher, readingStatus, isFavorite, dateAdded, order",
  collections: "++id, order",
  folders: "++id, scopeType, scopeId, order",
  bookFolders: "++id, bookId, folderId, [bookId+folderId]",
  bookCollections: "++id, bookId, collectionId, [bookId+collectionId]",
  bookOrder: "++id, bookId, scopeType, scopeId, [scopeType+scopeId]",
  settings: "key",
  bookmarks: "++id, bookId, createdAt",
  highlights: "++id, bookId, createdAt",
  notes: "++id, bookId, createdAt, updatedAt",
  readingProgress: "++id, bookId",
});
