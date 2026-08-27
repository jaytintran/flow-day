import { useState } from "react";
import { Smile, X } from "lucide-react";
import { cn } from "@/lib/utils";

const EMOJI_CATEGORIES = [
  {
    name: "Ideas & Reading",
    emojis: ["📝", "💡", "📖", "📚", "🔖", "📌", "✍️", "🔍", "🧠", "🎯", "⭐", "✨", "🔥", "💭", "🏷️", "📑"],
  },
  {
    name: "Status & Priority",
    emojis: ["✅", "⏳", "⚠️", "❗", "❓", "❌", "🟢", "🟡", "🔴", "🟣", "🔵", "🏁", "🚀", "🏆", "💎", "🔑"],
  },
  {
    name: "Symbols & Nature",
    emojis: ["🌱", "🌿", "☕", "☀️", "🌙", "⚡", "🎨", "🧩", "📦", "🛠️", "💬", "❤️", "🍀", "🌊", "🔔", "🔮"],
  },
];

interface EmojiPickerProps {
  currentEmoji?: string;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

export function EmojiPicker({ currentEmoji, onSelect, onClose, className }: EmojiPickerProps) {
  const [search, setSearch] = useState("");

  return (
    <div
      className={cn(
        "absolute z-50 flex flex-col w-64 rounded-xl border border-border bg-popover p-2.5 shadow-2xl animate-in fade-in zoom-in-95 duration-150",
        className
      )}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-border">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
          <Smile className="h-3.5 w-3.5 text-primary" />
          <span>Choose an icon</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors cursor-pointer"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <input
        type="text"
        placeholder="Filter icons..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full h-7 mb-2 px-2 text-xs rounded-md bg-muted/60 border border-input text-foreground outline-none placeholder:text-muted-foreground"
        autoFocus
      />

      <div className="flex flex-col gap-2.5 max-h-48 overflow-y-auto pr-1">
        {EMOJI_CATEGORIES.map((cat) => {
          const filtered = cat.emojis.filter((e) => !search || e.includes(search));
          if (filtered.length === 0) return null;
          return (
            <div key={cat.name} className="flex flex-col gap-1">
              <span className="text-[10px] font-medium text-muted-foreground px-0.5">{cat.name}</span>
              <div className="grid grid-cols-6 gap-1">
                {filtered.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onSelect(emoji);
                      onClose();
                    }}
                    className={cn(
                      "h-8 w-8 rounded-lg text-lg flex items-center justify-center transition-all hover:bg-accent hover:scale-115 cursor-pointer",
                      currentEmoji === emoji && "bg-primary/20 ring-1 ring-primary"
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
