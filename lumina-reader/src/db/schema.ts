export type ReadingStatus = "currently-reading" | "wanna-read" | "finished";

export interface Book {
  id?: number;
  title: string;
  subtitle?: string;
  author: string;
  publisher?: string;
  rating: number; // 0-5
  progress?: number; // 0-100 percentage
  tags: string[];
  description?: string;
  readingStatus?: ReadingStatus | null;
  isFavorite: boolean;
  fileType: "pdf" | "epub";
  fileKey: string; // OPFS key for the book file
  coverKey?: string; // OPFS key for the generated cover image
  order: number; // global order — used by every view unless inside a folder
  dateAdded: number;
}

export interface Collection {
  id?: number;
  name: string;
  order: number;
  icon?: string;
}

export interface Folder {
  id?: number;
  name: string;
  icon?: string;
  scopeType: "view" | "collection";
  scopeId: string; // e.g. "home", "favorites", or the collection id
  order: number;
}

export interface BookFolder {
  id?: number;
  bookId: number;
  folderId: number;
}

export interface BookCollection {
  id?: number;
  bookId: number;
  collectionId: number;
}

/** Per-folder ordering only — global order lives on `Book.order`. */
export interface BookOrder {
  id?: number;
  bookId: number;
  scopeType: "folder";
  scopeId: string;
  position: number;
}

export interface Source {
  id: string;
  title: string;
  url: string;
}

export interface Bookmark {
  id?: number;
  bookId: number;
  title: string;
  pageOrLocation: number | string;
  createdAt: number;
}

export interface Highlight {
  id?: number;
  bookId: number;
  text: string;
  color: string; // e.g. "yellow", "green", "blue", "purple"
  pageOrLocation: number | string;
  createdAt: number;
}

export interface Note {
  id?: number;
  bookId: number;
  title?: string;
  icon?: string;
  content: string;
  pageOrLocation?: number | string;
  createdAt: number;
  updatedAt: number;
}

export interface ReadingProgress {
  id?: number;
  bookId: number;
  pageOrLocation: number | string;
  percentage: number;
  updatedAt: number;
}

export interface AppSettings {
  key: string; // always "app" — single settings row
  theme: "dark" | "light";
  viewMode: "grid" | "row";
  booksPerRow: number;
  showSubtitle: boolean;
  showAuthor: boolean;
  showRating: boolean;
  showProgress: boolean;
  showTags: boolean;
  showDescription: boolean;
  sources: Source[];
}

export const DEFAULT_SETTINGS: AppSettings = {
  key: "app",
  theme: "dark",
  viewMode: "grid",
  booksPerRow: 4,
  showSubtitle: true,
  showAuthor: true,
  showRating: true,
  showProgress: true,
  showTags: true,
  showDescription: true,
  sources: [],
};
