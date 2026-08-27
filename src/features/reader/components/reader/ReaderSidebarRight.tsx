import { useState } from "react";
import {
  Highlighter,
  Info,
  Plus,
  Save,
  Search,
  Star,
  StickyNote,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Highlight, Note } from "@/db/schema";
import type { RightTab } from "./types";
import { NoteCard, NoteModal, NotionEditor } from "./notes";

interface ReaderSidebarRightProps {
  rightTab: RightTab;
  onTabChange: (tab: RightTab) => void;
  // Notes
  notes: Note[];
  newNote: string;
  onChangeNewNote: (val: string) => void;
  onAddNote: (custom?: { title?: string; icon?: string; content?: string }) => void;
  onUpdateNote: (id: number, patch: { title?: string; icon?: string; content?: string }) => void;
  onDeleteNote: (id: number) => void;
  locationLabel: string;
  onJumpToLocation: (loc: number | string) => void;
  // Highlights
  highlights: Highlight[];
  selectedText: string;
  selectedColor: string;
  onSelectColor: (color: string) => void;
  onSaveHighlight: () => void;
  onDeleteHighlight: (id: number) => void;
  onHighlightLocClick: (pageOrLocation: number | string) => void;
  bookFileType: "pdf" | "epub";
  // Metadata
  metaTitle: string;
  metaSubtitle: string;
  metaAuthor: string;
  metaPublisher: string;
  metaRating: number;
  metaProgress: number;
  metaTags: string;
  metaDesc: string;
  metaSaved: boolean;
  onChangeMetaTitle: (v: string) => void;
  onChangeMetaSubtitle: (v: string) => void;
  onChangeMetaAuthor: (v: string) => void;
  onChangeMetaPublisher: (v: string) => void;
  onChangeMetaRating: (v: number) => void;
  onChangeMetaProgress: (v: number) => void;
  onChangeMetaTags: (v: string) => void;
  onChangeMetaDesc: (v: string) => void;
  onSaveMetadata: () => void;
}

export function ReaderSidebarRight({
  rightTab,
  onTabChange,
  notes,
  newNote,
  onChangeNewNote,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  locationLabel,
  onJumpToLocation,
  highlights,
  selectedText,
  selectedColor,
  onSelectColor,
  onSaveHighlight,
  onDeleteHighlight,
  onHighlightLocClick,
  bookFileType,
  metaTitle,
  metaSubtitle,
  metaAuthor,
  metaPublisher,
  metaRating,
  metaProgress,
  metaTags,
  metaDesc,
  metaSaved,
  onChangeMetaTitle,
  onChangeMetaSubtitle,
  onChangeMetaAuthor,
  onChangeMetaPublisher,
  onChangeMetaRating,
  onChangeMetaProgress,
  onChangeMetaTags,
  onChangeMetaDesc,
  onSaveMetadata,
}: ReaderSidebarRightProps) {
  const [activeModalNote, setActiveModalNote] = useState<Note | null>(null);
  const [noteSearch, setNoteSearch] = useState("");
  const [showQuickNoteInput, setShowQuickNoteInput] = useState(false);

  const filteredNotes = notes.filter((n) => {
    if (!noteSearch.trim()) return true;
    const q = noteSearch.toLowerCase();
    return (
      (n.title && n.title.toLowerCase().includes(q)) ||
      (n.content && n.content.toLowerCase().includes(q))
    );
  });

  const handleCreateNewNote = () => {
    onAddNote({
      title: "Untitled Note",
      icon: "📝",
      content: "",
    });
  };

  return (
    <>
      <aside className="fixed inset-y-0 right-0 z-30 w-80 max-w-[85vw] md:static md:w-80 shrink-0 border-l border-border bg-card shadow-2xl md:shadow-none flex flex-col animate-in slide-in-from-right duration-200">
        {/* Right Tabs */}
        <div className="flex h-10 border-b border-border bg-background/50 items-stretch">
          <button
            onClick={() => onTabChange("notes")}
            className={cn(
              "flex-1 h-full rounded-none text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border-r border-border/50",
              rightTab === "notes"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            )}
          >
            <StickyNote className="h-3.5 w-3.5" /> Notes ({notes.length})
          </button>
          <button
            onClick={() => onTabChange("highlights")}
            className={cn(
              "flex-1 h-full rounded-none text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border-r border-border/50",
              rightTab === "highlights"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            )}
          >
            <Highlighter className="h-3.5 w-3.5" /> Highlights
          </button>
          <button
            onClick={() => onTabChange("metadata")}
            className={cn(
              "flex-1 h-full rounded-none text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer",
              rightTab === "metadata"
                ? "bg-primary text-primary-foreground font-bold"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
            )}
          >
            <Info className="h-3.5 w-3.5" /> Metadata
          </button>
        </div>

        {/* Right Tab Content */}
        <div className="flex-1 overflow-y-auto p-3">
          {rightTab === "notes" && (
            <div className="flex flex-col gap-3">
              {/* Header Action & Search */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    className="flex-1 text-xs gap-1.5 h-8 font-medium shadow-xs"
                    onClick={handleCreateNewNote}
                  >
                    <Plus className="h-3.5 w-3.5" /> New Note
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-8 px-2.5"
                    onClick={() => setShowQuickNoteInput((v) => !v)}
                    title="Toggle quick inline note"
                  >
                    {showQuickNoteInput ? "Close" : "Quick"}
                  </Button>
                </div>

                {notes.length > 2 && (
                  <div className="relative flex items-center">
                    <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Search notes..."
                      value={noteSearch}
                      onChange={(e) => setNoteSearch(e.target.value)}
                      className="h-7 pl-8 text-xs bg-muted/40"
                    />
                  </div>
                )}
              </div>

              {/* Quick Inline Notion Editor (Collapsible) */}
              {showQuickNoteInput && (
                <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-background p-2.5 shadow-sm animate-in fade-in">
                  <span className="text-[11px] font-semibold text-primary">
                    Quick note for {locationLabel}:
                  </span>
                  <NotionEditor
                    value={newNote}
                    onChange={onChangeNewNote}
                    minHeight="110px"
                    placeholder="Type markdown note..."
                  />
                  <div className="flex justify-end gap-1.5 pt-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[11px]"
                      onClick={() => setShowQuickNoteInput(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="h-6 text-[11px]"
                      onClick={() => {
                        onAddNote();
                        setShowQuickNoteInput(false);
                      }}
                    >
                      Save
                    </Button>
                  </div>
                </div>
              )}

              {/* Stacked Note Cards */}
              <div className="flex flex-col gap-2">
                {filteredNotes.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    onClick={() => setActiveModalNote(n)}
                    onDelete={onDeleteNote}
                    bookFileType={bookFileType}
                  />
                ))}

                {filteredNotes.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center border border-dashed border-border rounded-xl bg-background/50">
                    <span className="text-2xl mb-1.5">📝</span>
                    <p className="text-xs font-medium text-foreground">No notes yet</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 max-w-[180px]">
                      Click "New Note" to create Notion-style markdown notes for this book.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {rightTab === "highlights" && (
            <div className="flex flex-col gap-3">
              {selectedText ? (
                <div className="flex flex-col gap-2.5 rounded-lg border border-primary/40 bg-primary/10 p-3 animate-in fade-in">
                  <span className="text-[11px] font-bold text-primary">Create Highlight</span>
                  <blockquote className="text-xs italic text-foreground/90 border-l-2 border-primary pl-2 line-clamp-3">
                    "{selectedText}"
                  </blockquote>
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex gap-1.5">
                      {["yellow", "green", "blue", "purple"].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => onSelectColor(col)}
                          className={cn(
                            "h-4 w-4 rounded-full border cursor-pointer",
                            col === "yellow" && "bg-yellow-400 border-yellow-500",
                            col === "green" && "bg-green-400 border-green-500",
                            col === "blue" && "bg-blue-400 border-blue-500",
                            col === "purple" && "bg-purple-400 border-purple-500",
                            selectedColor === col && "ring-2 ring-white scale-110"
                          )}
                        />
                      ))}
                    </div>
                    <Button size="sm" className="h-7 text-xs" onClick={onSaveHighlight}>
                      Highlight
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground text-center bg-background/50 p-2.5 rounded-md border border-border">
                  Tip: Select text in the document to create highlights.
                </p>
              )}

              <div className="flex flex-col gap-2">
                {highlights.map((h) => (
                  <div
                    key={h.id}
                    id={`sidebar-hl-${h.id}`}
                    className="group flex flex-col gap-1 rounded-lg border border-border bg-background p-3 text-xs transition-all duration-200"
                  >
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                      <button
                        onClick={() => onHighlightLocClick(h.pageOrLocation)}
                        className="flex items-center gap-1 font-medium hover:text-foreground text-left transition-colors cursor-pointer"
                      >
                        <span
                          className={cn(
                            "h-2 w-2 rounded-full",
                            h.color === "yellow" && "bg-yellow-400",
                            h.color === "green" && "bg-green-400",
                            h.color === "blue" && "bg-blue-400",
                            h.color === "purple" && "bg-purple-400"
                          )}
                        />
                        {bookFileType === "pdf" ? `Page ${h.pageOrLocation}` : `Section ${h.pageOrLocation}`}
                      </button>
                      <button
                        onClick={() => h.id && onDeleteHighlight(h.id)}
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <blockquote className="text-neutral-300 italic line-clamp-3">"{h.text}"</blockquote>
                  </div>
                ))}
                {highlights.length === 0 && (
                  <p className="text-xs text-muted-foreground p-3 text-center">No highlights saved yet.</p>
                )}
              </div>
            </div>
          )}

          {rightTab === "metadata" && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground">
                  Edit Metadata on the fly
                </span>
                {metaSaved && <span className="text-xs font-bold text-green-400">Saved!</span>}
              </div>

              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                Title
                <Input
                  value={metaTitle}
                  onChange={(e) => onChangeMetaTitle(e.target.value)}
                  className="h-8 text-xs"
                />
              </label>

              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                Subtitle
                <Input
                  value={metaSubtitle}
                  onChange={(e) => onChangeMetaSubtitle(e.target.value)}
                  className="h-8 text-xs"
                />
              </label>

              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                Author
                <Input
                  value={metaAuthor}
                  onChange={(e) => onChangeMetaAuthor(e.target.value)}
                  className="h-8 text-xs"
                />
              </label>

              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                Publisher
                <Input
                  value={metaPublisher}
                  onChange={(e) => onChangeMetaPublisher(e.target.value)}
                  className="h-8 text-xs"
                />
              </label>

              <div className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                Rating
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => onChangeMetaRating(i + 1)}
                      className="p-0.5 cursor-pointer"
                    >
                      <Star
                        className={cn(
                          "h-4 w-4",
                          i < metaRating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/50"
                        )}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-[11px] text-muted-foreground">
                <div className="flex items-center justify-between">
                  <span>Reading Progress</span>
                  <span className="font-semibold text-primary">{metaProgress}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={metaProgress}
                  onChange={(e) => onChangeMetaProgress(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-secondary accent-primary"
                />
              </div>

              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                Tags (comma separated)
                <Input
                  value={metaTags}
                  onChange={(e) => onChangeMetaTags(e.target.value)}
                  className="h-8 text-xs"
                />
              </label>

              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                Description
                <textarea
                  value={metaDesc}
                  onChange={(e) => onChangeMetaDesc(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-transparent px-2.5 py-1.5 text-xs text-foreground outline-none resize-none"
                />
              </label>

              <Button size="sm" className="mt-1 gap-1.5" onClick={onSaveMetadata}>
                <Save className="h-3.5 w-3.5" /> Save Metadata
              </Button>
            </div>
          )}
        </div>
      </aside>

      {/* Notion Full Note Modal */}
      {activeModalNote && (
        <NoteModal
          note={activeModalNote}
          isOpen={Boolean(activeModalNote)}
          onClose={() => setActiveModalNote(null)}
          onSave={(data) => {
            if (activeModalNote.id) {
              onUpdateNote(activeModalNote.id, data);
            }
          }}
          onDelete={onDeleteNote}
          onJumpToLocation={onJumpToLocation}
          bookFileType={bookFileType}
        />
      )}
    </>
  );
}
