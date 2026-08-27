import { Trash2 } from "lucide-react";
import type { Note } from "@/db/schema";

interface NoteCardProps {
  note: Note;
  onClick: () => void;
  onDelete: (id: number) => void;
  bookFileType?: "pdf" | "epub";
}

function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString([], { month: "short", day: "numeric" });
}

function cleanMarkdownSnippet(text: string) {
  if (!text) return "No content";
  return text
    .replace(/^#+\s+/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/^>\s+/gm, "")
    .replace(/`{1,3}[^`]*`{1,3}/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function NoteCard({ note, onClick, onDelete, bookFileType = "pdf" }: NoteCardProps) {
  const displayTitle = note.title?.trim() || cleanMarkdownSnippet(note.content).slice(0, 35) || "Untitled Note";
  const snippet = cleanMarkdownSnippet(note.content);

  return (
    <div
      onClick={onClick}
      className="group relative flex items-start gap-3 rounded-xl border border-border bg-background p-3 text-xs transition-all duration-150 hover:border-primary/50 hover:bg-muted/40 cursor-pointer shadow-sm hover:shadow-md"
    >
      {/* Icon Badge */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base shadow-xs group-hover:scale-105 transition-transform">
        {note.icon || "📝"}
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-1">
          <span className="font-semibold text-foreground truncate text-xs group-hover:text-primary transition-colors">
            {displayTitle}
          </span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatRelativeTime(note.updatedAt)}
          </span>
        </div>

        <p className="text-muted-foreground text-[11px] line-clamp-2 leading-relaxed">
          {snippet}
        </p>

        {note.pageOrLocation && (
          <div className="flex items-center gap-1.5 pt-1">
            <span className="inline-flex items-center rounded-sm bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {bookFileType === "pdf" ? `p. ${note.pageOrLocation}` : `Sec. ${note.pageOrLocation}`}
            </span>
          </div>
        )}
      </div>

      {/* Hover Delete Action */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (note.id) onDelete(note.id);
        }}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded transition-all hover:bg-destructive/10"
        title="Delete note"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
