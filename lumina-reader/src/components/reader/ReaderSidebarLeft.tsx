import { Bookmark as BookmarkIcon, List, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Bookmark } from "@/db/schema";
import type { ParsedEpubContent } from "@/lib/importer";
import type { LeftTab, PdfOutlineItem } from "./types";

interface ReaderSidebarLeftProps {
  leftTab: LeftTab;
  onTabChange: (tab: LeftTab) => void;
  book: { fileType: "pdf" | "epub" };
  pdfOutline: PdfOutlineItem[];
  pdfCurrentPage: number;
  onPdfOutlineClick: (pageNumber: number) => void;
  epubDoc: ParsedEpubContent | null;
  epubSectionIdx: number;
  onEpubTocClick: (tocHref: string) => void;
  bookmarks: Bookmark[];
  onAddBookmark: () => void;
  onDeleteBookmark: (id: number) => void;
  onBookmarkClick: (pageOrLocation: number | string) => void;
}

export function ReaderSidebarLeft({
  leftTab,
  onTabChange,
  book,
  pdfOutline,
  pdfCurrentPage,
  onPdfOutlineClick,
  epubDoc,
  epubSectionIdx,
  onEpubTocClick,
  bookmarks,
  onAddBookmark,
  onDeleteBookmark,
  onBookmarkClick,
}: ReaderSidebarLeftProps) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-80 max-w-[85vw] md:static md:w-72 shrink-0 border-r border-border bg-card shadow-2xl md:shadow-none flex flex-col animate-in slide-in-from-left duration-200">
      {/* Left Tabs */}
      <div className="flex h-10 border-b border-border bg-background/50 items-stretch">
        <button
          onClick={() => onTabChange("toc")}
          className={cn(
            "flex-1 h-full rounded-none text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-r border-border/50",
            leftTab === "toc"
              ? "bg-primary text-primary-foreground font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
          )}
        >
          <List className="h-3.5 w-3.5" /> Table of Contents
        </button>
        <button
          onClick={() => onTabChange("bookmarks")}
          className={cn(
            "flex-1 h-full rounded-none text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer",
            leftTab === "bookmarks"
              ? "bg-primary text-primary-foreground font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
          )}
        >
          <BookmarkIcon className="h-3.5 w-3.5" /> Bookmarks ({bookmarks.length})
        </button>
      </div>

      {/* Left Tab Content */}
      <div className="flex-1 overflow-y-auto p-3">
        {leftTab === "toc" && (
          <div className="flex flex-col gap-1">
            {book.fileType === "pdf" ? (
              pdfOutline.length > 0 ? (
                pdfOutline.map((item, idx) => (
                  <button
                    key={idx}
                    onClick={() => onPdfOutlineClick(item.pageNumber)}
                    style={{ paddingLeft: `${Math.max(10, (item.depth || 0) * 12 + 10)}px` }}
                    className={cn(
                      "text-left text-xs py-2 pr-2.5 rounded-md transition-colors flex items-center justify-between cursor-pointer",
                      pdfCurrentPage === item.pageNumber
                        ? "bg-primary/20 text-primary font-bold"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <span className="truncate pr-2">{item.title}</span>
                    <span className="text-[10px] opacity-70">p.{item.pageNumber}</span>
                  </button>
                ))
              ) : (
                <p className="text-xs text-muted-foreground p-3 text-center">
                  No table of contents in this PDF.
                </p>
              )
            ) : (
              epubDoc?.toc.map((t, idx) => (
                <button
                  key={t.id || idx}
                  onClick={() => onEpubTocClick(t.href)}
                  className={cn(
                    "text-left text-xs py-2 px-2.5 rounded-md transition-colors truncate cursor-pointer",
                    epubSectionIdx === idx
                      ? "bg-primary/20 text-primary font-bold"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  {t.label}
                </button>
              ))
            )}
          </div>
        )}

        {leftTab === "bookmarks" && (
          <div className="flex flex-col gap-3">
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs gap-1.5 border-dashed"
              onClick={onAddBookmark}
            >
              <Plus className="h-3.5 w-3.5" />
              Bookmark current {book.fileType === "pdf" ? `Page ${pdfCurrentPage}` : `Section ${epubSectionIdx + 1}`}
            </Button>

            <div className="flex flex-col gap-1.5">
              {bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="group flex items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs transition-colors hover:border-primary/50"
                >
                  <button
                    onClick={() => onBookmarkClick(bm.pageOrLocation)}
                    className="flex-1 text-left truncate font-medium text-foreground hover:text-primary cursor-pointer"
                  >
                    {bm.title}
                  </button>
                  <button
                    onClick={() => bm.id && onDeleteBookmark(bm.id)}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {bookmarks.length === 0 && (
                <p className="text-xs text-muted-foreground p-3 text-center">No bookmarks saved yet.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
