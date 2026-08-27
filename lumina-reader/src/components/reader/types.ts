export type LeftTab = "toc" | "bookmarks";
export type RightTab = "notes" | "highlights" | "metadata";

export interface PdfOutlineItem {
  title: string;
  pageNumber: number;
  depth: number;
}
