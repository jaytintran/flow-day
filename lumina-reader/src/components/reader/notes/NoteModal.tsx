import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Clock,
  ExternalLink,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Note } from "@/db/schema";
import { EmojiPicker } from "./EmojiPicker";
import { NotionEditor } from "./NotionEditor";

interface NoteModalProps {
  note: Note | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { title: string; icon: string; content: string }) => void;
  onDelete: (id: number) => void;
  onJumpToLocation?: (loc: number | string) => void;
  bookFileType?: "pdf" | "epub";
}

export function NoteModal({
  note,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onJumpToLocation,
  bookFileType = "pdf",
}: NoteModalProps) {
  const [title, setTitle] = useState("");
  const [icon, setIcon] = useState("📝");
  const [content, setContent] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  // Sync state when note opens
  useEffect(() => {
    if (note && isOpen) {
      setTitle(note.title ?? "");
      setIcon(note.icon ?? "📝");
      setContent(note.content ?? "");
      setLastSaved(note.updatedAt);
    }
  }, [note, isOpen]);

  // Debounced auto-save on changes
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (note) {
        onSave({ title, icon, content: newContent });
        setLastSaved(Date.now());
      }
    }, 600);
  };

  const handleTitleChange = (newTitle: string) => {
    setTitle(newTitle);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (note) {
        onSave({ title: newTitle, icon, content });
        setLastSaved(Date.now());
      }
    }, 600);
  };

  const handleIconSelect = (newIcon: string) => {
    setIcon(newIcon);
    if (note) {
      onSave({ title, icon: newIcon, content });
      setLastSaved(Date.now());
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !note) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative flex flex-col w-full max-w-3xl max-h-[85vh] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Notion Header */}
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-background/50 px-4">
          <div className="flex items-center gap-2">
            {note.pageOrLocation && (
              <button
                onClick={() => {
                  if (onJumpToLocation && note.pageOrLocation) {
                    onJumpToLocation(note.pageOrLocation);
                    onClose();
                  }
                }}
                className="group flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                title="Jump to this page in reader"
              >
                <BookOpen className="h-3 w-3" />
                <span>
                  {bookFileType === "pdf" ? `Page ${note.pageOrLocation}` : `Section ${note.pageOrLocation}`}
                </span>
                <ExternalLink className="h-2.5 w-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
              </button>
            )}

            {lastSaved && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground ml-1">
                <Clock className="h-3 w-3" />
                Saved {new Date(lastSaved).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                if (note.id) {
                  onDelete(note.id);
                  onClose();
                }
              }}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Delete Note"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </header>

        {/* Note Document Canvas */}
        <div className="flex-1 overflow-y-auto p-6 md:p-10 space-y-6">
          {/* Icon Selector & Title */}
          <div className="relative flex flex-col gap-2">
            <div className="relative inline-block w-fit">
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className="h-12 w-12 rounded-xl text-3xl flex items-center justify-center bg-muted/40 hover:bg-muted border border-border hover:scale-105 transition-all cursor-pointer shadow-sm"
                title="Change Icon"
              >
                {icon || <Smile className="h-6 w-6 text-muted-foreground" />}
              </button>

              {showEmojiPicker && (
                <EmojiPicker
                  currentEmoji={icon}
                  onSelect={handleIconSelect}
                  onClose={() => setShowEmojiPicker(false)}
                  className="top-14 left-0"
                />
              )}
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Untitled Note"
              className="w-full text-2xl md:text-3xl font-bold tracking-tight text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/40"
            />
          </div>

          {/* Notion Markdown Body */}
          <NotionEditor
            value={content}
            onChange={handleContentChange}
            minHeight="340px"
          />
        </div>
      </div>
    </div>
  );
}
