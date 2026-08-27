import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pin,
  PinOff,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParsedEpubContent } from "@/lib/importer";

interface ReaderHeaderProps {
  book: {
    title: string;
    author: string;
    fileType: "pdf" | "epub";
  };
  onBack: () => void;
  // PDF Controls
  pdfCurrentPage: number;
  pdfNumPages: number;
  pdfScale: number;
  onPdfPrevPage: () => void;
  onPdfNextPage: () => void;
  onPdfZoomIn: () => void;
  onPdfZoomOut: () => void;
  onPdfZoomReset: () => void;
  // EPUB Controls
  epubDoc: ParsedEpubContent | null;
  epubSectionIdx: number;
  epubFontSize: number;
  onEpubPrevSection: () => void;
  onEpubNextSection: () => void;
  onEpubZoomIn: () => void;
  onEpubZoomOut: () => void;
  onEpubZoomReset: () => void;
  // Sidebar Toggles
  leftPinned: boolean;
  rightPinned: boolean;
  onToggleLeftPinned: () => void;
  onToggleRightPinned: () => void;
}

export function ReaderHeader({
  book,
  onBack,
  pdfCurrentPage,
  pdfNumPages,
  pdfScale,
  onPdfPrevPage,
  onPdfNextPage,
  onPdfZoomIn,
  onPdfZoomOut,
  onPdfZoomReset,
  epubDoc,
  epubSectionIdx,
  epubFontSize,
  onEpubPrevSection,
  onEpubNextSection,
  onEpubZoomIn,
  onEpubZoomOut,
  onEpubZoomReset,
  leftPinned,
  rightPinned,
  onToggleLeftPinned,
  onToggleRightPinned,
}: ReaderHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur z-20">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex flex-col">
          <h1 className="text-sm font-bold truncate max-w-xs md:max-w-md">{book.title}</h1>
          <p className="text-[11px] text-muted-foreground truncate">
            {book.author} · {book.fileType.toUpperCase()}
          </p>
        </div>
      </div>

      {/* Center Controls (Zoom & Navigation) */}
      <div className="flex items-center gap-2">
        {book.fileType === "pdf" ? (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pdfCurrentPage <= 1}
              onClick={onPdfPrevPage}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium tabular-nums px-1">
              {pdfCurrentPage} / {pdfNumPages || 1}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pdfCurrentPage >= pdfNumPages}
              onClick={onPdfNextPage}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <div className="h-4 w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pdfScale <= 0.5}
              onClick={onPdfZoomOut}
              title="Zoom Out (-)"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <button
              onClick={onPdfZoomReset}
              title="Reset Zoom to 100% (0)"
              className="text-[11px] text-muted-foreground hover:text-foreground w-11 text-center font-medium transition-colors cursor-pointer"
            >
              {Math.round(pdfScale * 100)}%
            </button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={pdfScale >= 3.0}
              onClick={onPdfZoomIn}
              title="Zoom In (+)"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
          </>
        ) : (
          epubDoc && (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={epubSectionIdx <= 0}
                onClick={onEpubPrevSection}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium tabular-nums px-1">
                Section {epubSectionIdx + 1} of {epubDoc.sections.length}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={epubSectionIdx >= epubDoc.sections.length - 1}
                onClick={onEpubNextSection}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="h-4 w-px bg-border mx-1" />
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={epubFontSize <= 70}
                onClick={onEpubZoomOut}
                title="Decrease Font Size (-)"
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <button
                onClick={onEpubZoomReset}
                title="Reset Font Size to 100% (0)"
                className="text-[11px] text-muted-foreground hover:text-foreground w-11 text-center font-medium transition-colors cursor-pointer"
              >
                {epubFontSize}%
              </button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={epubFontSize >= 200}
                onClick={onEpubZoomIn}
                title="Increase Font Size (+)"
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </>
          )
        )}
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant={leftPinned ? "secondary" : "ghost"}
          size="sm"
          className="text-xs h-8 gap-1.5"
          onClick={onToggleLeftPinned}
          title="Toggle TOC & Bookmarks ([)"
        >
          {leftPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          <span className="hidden md:inline">TOC / Bookmarks</span>
        </Button>

        <Button
          variant={rightPinned ? "secondary" : "ghost"}
          size="sm"
          className="text-xs h-8 gap-1.5"
          onClick={onToggleRightPinned}
          title="Toggle Notes & Highlights (])"
        >
          {rightPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          <span className="hidden md:inline">Notes & Info</span>
        </Button>
      </div>
    </header>
  );
}
