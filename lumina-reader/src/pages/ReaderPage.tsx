import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import "pdfjs-dist/web/pdf_viewer.css";

import { readFile } from "@/db/opfs";
import {
  useAddBookmark,
  useAddHighlight,
  useAddNote,
  useBook,
  useBookmarks,
  useDeleteBookmark,
  useDeleteHighlight,
  useDeleteNote,
  useHighlights,
  useNotes,
  useReadingProgress,
  useSaveReadingProgress,
  useUpdateBook,
  useUpdateNote,
} from "@/db/hooks";
import { parseFullEpub, type ParsedEpubContent } from "@/lib/importer";
import {
  EpubReaderView,
  PdfPageItem,
  ReaderHeader,
  ReaderSidebarLeft,
  ReaderSidebarRight,
  type LeftTab,
  type PdfOutlineItem,
  type RightTab,
} from "@/components/reader";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export function ReaderPage() {
  const params = useParams();
  const navigate = useNavigate();
  const rawId = params.bookId ?? params.id;
  const bookId = Number(rawId);

  const { data: book, isLoading: bookLoading } = useBook(Number.isNaN(bookId) ? undefined : bookId);
  const updateBook = useUpdateBook();

  // Panels state (default open on desktop, closed on mobile)
  const [leftPinned, setLeftPinned] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  const [rightPinned, setRightPinned] = useState(() => typeof window !== "undefined" && window.innerWidth >= 768);
  const [leftTab, setLeftTab] = useState<LeftTab>("toc");
  const [rightTab, setRightTab] = useState<RightTab>("notes");

  // Reader database data
  const { data: bookmarks = [] } = useBookmarks(bookId);
  const { data: highlights = [] } = useHighlights(bookId);
  const { data: notes = [] } = useNotes(bookId);
  const { data: progress } = useReadingProgress(bookId);

  const addBookmark = useAddBookmark();
  const deleteBookmark = useDeleteBookmark();
  const addHighlight = useAddHighlight();
  const deleteHighlight = useDeleteHighlight();
  const addNote = useAddNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const saveProgress = useSaveReadingProgress();

  // Document state
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [pdfDoc, setPdfDoc] = useState<pdfjs.PDFDocumentProxy | null>(null);
  const [pdfNumPages, setPdfNumPages] = useState(0);
  const [pdfCurrentPage, setPdfCurrentPage] = useState(1);
  const [pdfScale, setPdfScale] = useState(1.2);
  const [pdfPageSize, setPdfPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
  const [pdfOutline, setPdfOutline] = useState<PdfOutlineItem[]>([]);

  const [epubDoc, setEpubDoc] = useState<ParsedEpubContent | null>(null);
  const [epubSectionIdx, setEpubSectionIdx] = useState(0);
  const [epubFontSize, setEpubFontSize] = useState(100);

  const centerScrollRef = useRef<HTMLDivElement>(null);

  // Metadata form state
  const [metaTitle, setMetaTitle] = useState("");
  const [metaSubtitle, setMetaSubtitle] = useState("");
  const [metaAuthor, setMetaAuthor] = useState("");
  const [metaPublisher, setMetaPublisher] = useState("");
  const [metaRating, setMetaRating] = useState(0);
  const [metaProgress, setMetaProgress] = useState(0);
  const [metaTags, setMetaTags] = useState("");
  const [metaDesc, setMetaDesc] = useState("");
  const [metaSaved, setMetaSaved] = useState(false);

  // Note form state
  const [newNote, setNewNote] = useState("");

  // Highlight selection state
  const [selectedText, setSelectedText] = useState("");
  const [selectedColor, setSelectedColor] = useState("yellow");

  // Sync metadata form when book loaded
  useEffect(() => {
    if (book) {
      setMetaTitle(book.title);
      setMetaSubtitle(book.subtitle ?? "");
      setMetaAuthor(book.author);
      setMetaPublisher(book.publisher ?? "");
      setMetaRating(book.rating);
      setMetaProgress(book.progress ?? 0);
      setMetaTags(book.tags.join(", "));
      setMetaDesc(book.description ?? "");
    }
  }, [book]);

  // Load book file from OPFS
  useEffect(() => {
    let alive = true;
    async function loadBook() {
      if (!book) return;
      setLoadingDoc(true);
      try {
        const file = await readFile(book.fileKey);
        if (!file) throw new Error("Book file not found in storage");
        const buffer = await file.arrayBuffer();

        if (book.fileType === "pdf") {
          const loadedPdf = await pdfjs.getDocument({ data: buffer }).promise;
          if (!alive) return;
          setPdfDoc(loadedPdf);
          setPdfNumPages(loadedPdf.numPages);

          try {
            const firstPage = await loadedPdf.getPage(1);
            const defaultViewport = firstPage.getViewport({ scale: 1 });
            if (alive) {
              setPdfPageSize({ width: defaultViewport.width, height: defaultViewport.height });
            }
          } catch {
            // fallback
          }

          try {
            const outline = await loadedPdf.getOutline();
            if (outline?.length) {
              const parseOutline = async (
                nodes: unknown[],
                depth = 0
              ): Promise<PdfOutlineItem[]> => {
                const list: PdfOutlineItem[] = [];
                for (const item of nodes as any[]) {
                  let pageNumber = 1;
                  if (item.dest) {
                    try {
                      let destRef = item.dest;
                      if (typeof destRef === "string") {
                        destRef = await loadedPdf.getDestination(destRef);
                      }
                      if (Array.isArray(destRef) && destRef[0]) {
                        const pageIdx = await loadedPdf.getPageIndex(destRef[0]);
                        pageNumber = pageIdx + 1;
                      } else if (typeof destRef === "number") {
                        pageNumber = destRef + 1;
                      }
                    } catch {
                      // ignore destination parse error
                    }
                  }
                  list.push({ title: item.title, pageNumber, depth });
                  if (item.items && item.items.length > 0) {
                    const children = await parseOutline(item.items, depth + 1);
                    list.push(...children);
                  }
                }
                return list;
              };

              const parsedOutline = await parseOutline(outline);
              if (alive) {
                setPdfOutline(parsedOutline);
              }
            }
          } catch {
            // fallback
          }

          if (progress?.pageOrLocation) {
            setPdfCurrentPage(Number(progress.pageOrLocation) || 1);
          }
        } else if (book.fileType === "epub") {
          const parsed = parseFullEpub(buffer);
          if (!alive) return;
          setEpubDoc(parsed);

          if (progress?.pageOrLocation) {
            setEpubSectionIdx(Number(progress.pageOrLocation) || 0);
          }
        }
      } catch (err) {
        console.error("Error loading document:", err);
      } finally {
        if (alive) setLoadingDoc(false);
      }
    }
    loadBook();
    return () => {
      alive = false;
    };
  }, [book, book?.fileKey]);

  // Zoom handlers
  const handlePdfZoomOut = () => setPdfScale((s) => Math.max(0.5, Math.round((s - 0.2) * 10) / 10));
  const handlePdfZoomIn = () => setPdfScale((s) => Math.min(3.0, Math.round((s + 0.2) * 10) / 10));
  const handlePdfZoomReset = () => setPdfScale(1.0);

  const handleEpubZoomOut = () => setEpubFontSize((s) => Math.max(70, s - 10));
  const handleEpubZoomIn = () => setEpubFontSize((s) => Math.min(200, s + 10));
  const handleEpubZoomReset = () => setEpubFontSize(100);

  // Highlight click / selection handler
  const handleHighlightClick = (highlightId: number) => {
    setRightTab("highlights");
    setRightPinned(true);
    setTimeout(() => {
      const itemEl = document.getElementById(`sidebar-hl-${highlightId}`);
      if (itemEl) {
        itemEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
        itemEl.classList.add("ring-2", "ring-primary");
        setTimeout(() => itemEl.classList.remove("ring-2", "ring-primary"), 2000);
      }
    }, 100);
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement | null;
    const highlightEl = target?.closest(".lumina-highlight");
    if (highlightEl) {
      const hlId = highlightEl.getAttribute("data-highlight-id");
      if (hlId) {
        handleHighlightClick(Number(hlId));
        return;
      }
    }

    const text = window.getSelection()?.toString().trim();
    if (text && text.length > 1) {
      setSelectedText(text);
      setRightTab("highlights");
      setRightPinned(true);
    }
  };

  const handleSaveMetadata = async () => {
    await updateBook.mutateAsync({
      id: bookId,
      patch: {
        title: metaTitle.trim() || book?.title,
        subtitle: metaSubtitle.trim() || undefined,
        author: metaAuthor.trim() || "Unknown",
        publisher: metaPublisher.trim() || undefined,
        rating: metaRating,
        progress: metaProgress,
        tags: metaTags.split(",").map((t) => t.trim()).filter(Boolean),
        description: metaDesc.trim() || undefined,
      },
    });
    setMetaSaved(true);
    setTimeout(() => setMetaSaved(false), 2000);
  };

  const handleAddBookmark = () => {
    const loc = book?.fileType === "pdf" ? pdfCurrentPage : epubSectionIdx + 1;
    const title = book?.fileType === "pdf" ? `Page ${pdfCurrentPage}` : `Section ${epubSectionIdx + 1}`;
    addBookmark.mutate({
      bookId,
      title,
      pageOrLocation: loc,
    });
  };

  const handleSaveHighlight = () => {
    if (!selectedText) return;
    const loc = book?.fileType === "pdf" ? pdfCurrentPage : epubSectionIdx + 1;
    addHighlight.mutate({
      bookId,
      text: selectedText,
      color: selectedColor,
      pageOrLocation: loc,
    });
    setSelectedText("");
  };

  const handleAddNote = (custom?: { title?: string; icon?: string; content?: string }) => {
    const loc = book?.fileType === "pdf" ? pdfCurrentPage : epubSectionIdx + 1;
    if (custom) {
      addNote.mutate({
        bookId,
        title: custom.title || "Untitled Note",
        icon: custom.icon || "📝",
        content: custom.content || "",
        pageOrLocation: loc,
      });
      return;
    }
    if (!newNote.trim()) return;
    addNote.mutate({
      bookId,
      title: "Quick Note",
      icon: "💡",
      content: newNote.trim(),
      pageOrLocation: loc,
    });
    setNewNote("");
  };

  const handleScrollToPdfPage = (pageNumber: number) => {
    setPdfCurrentPage(pageNumber);
    const el = document.getElementById(`pdf-page-${pageNumber}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleScrollToEpubSection = (sectionIndex: number) => {
    setEpubSectionIdx(sectionIndex);
    const el = document.getElementById(`epub-sec-${sectionIndex}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleEpubTocClick = (tocHref: string) => {
    if (!epubDoc) return;
    const [targetPath, targetHash] = tocHref.split("#");
    const normalize = (p: string) => p.replace(/^\.?\/+/, "").toLowerCase();

    let targetIdx = -1;
    if (targetPath) {
      const normTarget = normalize(targetPath);
      targetIdx = epubDoc.sections.findIndex((s) => {
        const normSec = normalize(s.href);
        return normSec === normTarget || normSec.endsWith("/" + normTarget) || normTarget.endsWith("/" + normSec);
      });
    }

    if (targetIdx === -1 && !targetPath && targetHash) {
      targetIdx = epubSectionIdx;
    }

    if (targetIdx !== -1) {
      setEpubSectionIdx(targetIdx);
    }

    if (targetHash) {
      const anchorEl = document.getElementById(targetHash) || document.querySelector(`[name="${targetHash}"]`);
      if (anchorEl) {
        anchorEl.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }

    handleScrollToEpubSection(targetIdx !== -1 ? targetIdx : 0);
  };

  const handleJumpToLocation = (pageOrLocation: number | string) => {
    if (book?.fileType === "pdf") {
      handleScrollToPdfPage(Number(pageOrLocation));
    } else {
      handleScrollToEpubSection(Number(pageOrLocation) - 1);
    }
  };

  // Keyboard navigation & hotkeys
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target?.isContentEditable) {
        return;
      }

      // Page / Section Navigation
      if (e.key === "ArrowLeft" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) {
        e.preventDefault();
        if (book?.fileType === "pdf") {
          handleScrollToPdfPage(Math.max(1, pdfCurrentPage - 1));
        } else if (epubDoc) {
          handleScrollToEpubSection(Math.max(0, epubSectionIdx - 1));
        }
      } else if (e.key === "ArrowRight" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) {
        e.preventDefault();
        if (book?.fileType === "pdf") {
          handleScrollToPdfPage(Math.min(pdfNumPages, pdfCurrentPage + 1));
        } else if (epubDoc) {
          handleScrollToEpubSection(Math.min(epubDoc.sections.length - 1, epubSectionIdx + 1));
        }
      }

      // Zoom Controls
      else if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        if (book?.fileType === "pdf") handlePdfZoomIn();
        else handleEpubZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        if (book?.fileType === "pdf") handlePdfZoomOut();
        else handleEpubZoomOut();
      } else if (e.key === "0") {
        e.preventDefault();
        if (book?.fileType === "pdf") handlePdfZoomReset();
        else handleEpubZoomReset();
      }

      // Bookmark
      else if (e.key === "b" || e.key === "B") {
        e.preventDefault();
        handleAddBookmark();
      }

      // Sidebars Toggle
      else if (e.key === "[") {
        e.preventDefault();
        setLeftPinned((p) => !p);
      } else if (e.key === "]") {
        e.preventDefault();
        setRightPinned((p) => !p);
      }

      // Search / TOC focus
      else if ((e.key === "f" || e.key === "F") && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setLeftTab("toc");
        setLeftPinned(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [book?.fileType, pdfCurrentPage, pdfNumPages, epubSectionIdx, epubDoc, handleAddBookmark]);

  if (bookLoading || !book) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="text-sm font-medium text-muted-foreground animate-pulse">Loading book...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground select-text">
      {/* Header */}
      <ReaderHeader
        book={book}
        onBack={() => navigate("/")}
        pdfCurrentPage={pdfCurrentPage}
        pdfNumPages={pdfNumPages}
        pdfScale={pdfScale}
        onPdfPrevPage={() => handleScrollToPdfPage(Math.max(1, pdfCurrentPage - 1))}
        onPdfNextPage={() => handleScrollToPdfPage(Math.min(pdfNumPages, pdfCurrentPage + 1))}
        onPdfZoomIn={handlePdfZoomIn}
        onPdfZoomOut={handlePdfZoomOut}
        onPdfZoomReset={handlePdfZoomReset}
        epubDoc={epubDoc}
        epubSectionIdx={epubSectionIdx}
        epubFontSize={epubFontSize}
        onEpubPrevSection={() => handleScrollToEpubSection(Math.max(0, epubSectionIdx - 1))}
        onEpubNextSection={() => handleScrollToEpubSection(Math.min(epubDoc?.sections.length ? epubDoc.sections.length - 1 : 0, epubSectionIdx + 1))}
        onEpubZoomIn={handleEpubZoomIn}
        onEpubZoomOut={handleEpubZoomOut}
        onEpubZoomReset={handleEpubZoomReset}
        leftPinned={leftPinned}
        rightPinned={rightPinned}
        onToggleLeftPinned={() => setLeftPinned((p) => !p)}
        onToggleRightPinned={() => setRightPinned((p) => !p)}
      />

      {/* 3-Column Main Body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Left Column (TOC / Bookmarks) */}
        {leftPinned && (
          <ReaderSidebarLeft
            leftTab={leftTab}
            onTabChange={setLeftTab}
            book={book}
            pdfOutline={pdfOutline}
            pdfCurrentPage={pdfCurrentPage}
            onPdfOutlineClick={handleScrollToPdfPage}
            epubDoc={epubDoc}
            epubSectionIdx={epubSectionIdx}
            onEpubTocClick={handleEpubTocClick}
            bookmarks={bookmarks}
            onAddBookmark={handleAddBookmark}
            onDeleteBookmark={(id) => deleteBookmark.mutate({ id, bookId })}
            onBookmarkClick={handleJumpToLocation}
          />
        )}

        {/* Center Column: Reader Viewport */}
        <main
          ref={centerScrollRef}
          onMouseUp={handleMouseUp}
          className="flex-1 overflow-auto bg-neutral-950 flex flex-col items-center justify-start p-4 md:p-8"
        >
          {loadingDoc ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground animate-pulse">
              Rendering document...
            </div>
          ) : book.fileType === "pdf" && pdfDoc ? (
            <div className="flex flex-col items-center pb-16 min-w-min">
              {Array.from({ length: pdfNumPages }).map((_, idx) => (
                <PdfPageItem
                  key={idx + 1}
                  pdfDoc={pdfDoc}
                  pageNumber={idx + 1}
                  scale={pdfScale}
                  pageSize={pdfPageSize}
                  highlights={highlights}
                  onHighlightClick={handleHighlightClick}
                  onVisible={(page) => {
                    setPdfCurrentPage(page);
                    saveProgress.mutate({
                      bookId,
                      pageOrLocation: page,
                      percentage: Math.round((page / pdfNumPages) * 100),
                    });
                  }}
                />
              ))}
            </div>
          ) : (
            epubDoc && (
              <EpubReaderView
                epubDoc={epubDoc}
                epubFontSize={epubFontSize}
                highlights={highlights}
                onVisibleSection={(secIdx) => {
                  setEpubSectionIdx(secIdx);
                  saveProgress.mutate({
                    bookId,
                    pageOrLocation: secIdx,
                    percentage: Math.round(((secIdx + 1) / epubDoc.sections.length) * 100),
                  });
                }}
              />
            )
          )}
        </main>

        {/* Right Column (Notes, Highlights, Metadata) */}
        {rightPinned && (
          <ReaderSidebarRight
            rightTab={rightTab}
            onTabChange={setRightTab}
            notes={notes}
            newNote={newNote}
            onChangeNewNote={setNewNote}
            onAddNote={handleAddNote}
            onUpdateNote={(id, patch) => updateNote.mutate({ id, bookId, patch })}
            onDeleteNote={(id) => deleteNote.mutate({ id, bookId })}
            locationLabel={book.fileType === "pdf" ? `page ${pdfCurrentPage}` : `section ${epubSectionIdx + 1}`}
            onJumpToLocation={handleJumpToLocation}
            highlights={highlights}
            selectedText={selectedText}
            selectedColor={selectedColor}
            onSelectColor={setSelectedColor}
            onSaveHighlight={handleSaveHighlight}
            onDeleteHighlight={(id) => deleteHighlight.mutate({ id, bookId })}
            onHighlightLocClick={handleJumpToLocation}
            bookFileType={book.fileType}
            metaTitle={metaTitle}
            metaSubtitle={metaSubtitle}
            metaAuthor={metaAuthor}
            metaPublisher={metaPublisher}
            metaRating={metaRating}
            metaProgress={metaProgress}
            metaTags={metaTags}
            metaDesc={metaDesc}
            metaSaved={metaSaved}
            onChangeMetaTitle={setMetaTitle}
            onChangeMetaSubtitle={setMetaSubtitle}
            onChangeMetaAuthor={setMetaAuthor}
            onChangeMetaPublisher={setMetaPublisher}
            onChangeMetaRating={setMetaRating}
            onChangeMetaProgress={setMetaProgress}
            onChangeMetaTags={setMetaTags}
            onChangeMetaDesc={setMetaDesc}
            onSaveMetadata={handleSaveMetadata}
          />
        )}
      </div>
    </div>
  );
}
