import { useState, useRef, useEffect } from "react";
import {
  Bold,
  CheckSquare,
  Code,
  Eye,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  PenLine,
  Quote,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NotionEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function NotionEditor({
  value,
  onChange,
  placeholder = "Write note in markdown (type # for heading, - for bullet, [] for task)...",
  className,
  minHeight = "240px",
}: NotionEditorProps) {
  const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content seamlessly
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(160, el.scrollHeight)}px`;
  }, [value, viewMode]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart, selectionEnd, value: text } = textarea;
    const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
    const lineEnd = text.indexOf("\n", selectionStart);
    const actualLineEnd = lineEnd === -1 ? text.length : lineEnd;
    const currentLine = text.slice(lineStart, actualLineEnd);

    // 1. Enter key: continue lists, tasks, quotes
    if (e.key === "Enter" && !e.shiftKey) {
      // Empty prefix line -> clear prefix
      if (/^(\s*-\s*\[[ x]\]\s*|\s*[-*]\s*|\s*\d+\.\s*|\s*>\s*)$/.test(currentLine)) {
        e.preventDefault();
        const nextText = text.slice(0, lineStart) + text.slice(actualLineEnd);
        onChange(nextText);
        setTimeout(() => {
          textarea.setSelectionRange(lineStart, lineStart);
        }, 0);
        return;
      }

      // Checkbox continuation
      const taskMatch = currentLine.match(/^(\s*)-\s*\[[ x]\]\s*/);
      if (taskMatch) {
        e.preventDefault();
        const prefix = `\n${taskMatch[1]}- [ ] `;
        const nextText = text.slice(0, selectionStart) + prefix + text.slice(selectionEnd);
        onChange(nextText);
        setTimeout(() => {
          const nextPos = selectionStart + prefix.length;
          textarea.setSelectionRange(nextPos, nextPos);
        }, 0);
        return;
      }

      // Bullet list continuation
      const bulletMatch = currentLine.match(/^(\s*[-*])\s+/);
      if (bulletMatch) {
        e.preventDefault();
        const prefix = `\n${bulletMatch[1]} `;
        const nextText = text.slice(0, selectionStart) + prefix + text.slice(selectionEnd);
        onChange(nextText);
        setTimeout(() => {
          const nextPos = selectionStart + prefix.length;
          textarea.setSelectionRange(nextPos, nextPos);
        }, 0);
        return;
      }

      // Numbered list continuation
      const numMatch = currentLine.match(/^(\s*)(\d+)\.\s+/);
      if (numMatch) {
        e.preventDefault();
        const nextNum = parseInt(numMatch[2], 10) + 1;
        const prefix = `\n${numMatch[1]}${nextNum}. `;
        const nextText = text.slice(0, selectionStart) + prefix + text.slice(selectionEnd);
        onChange(nextText);
        setTimeout(() => {
          const nextPos = selectionStart + prefix.length;
          textarea.setSelectionRange(nextPos, nextPos);
        }, 0);
        return;
      }

      // Quote continuation
      const quoteMatch = currentLine.match(/^(\s*>)\s*/);
      if (quoteMatch) {
        e.preventDefault();
        const prefix = `\n${quoteMatch[1]} `;
        const nextText = text.slice(0, selectionStart) + prefix + text.slice(selectionEnd);
        onChange(nextText);
        setTimeout(() => {
          const nextPos = selectionStart + prefix.length;
          textarea.setSelectionRange(nextPos, nextPos);
        }, 0);
        return;
      }
    }

    // 2. Tab: Indent / Unindent
    if (e.key === "Tab") {
      e.preventDefault();
      const nextText =
        text.slice(0, selectionStart) + "  " + text.slice(selectionEnd);
      onChange(nextText);
      setTimeout(() => {
        textarea.setSelectionRange(selectionStart + 2, selectionStart + 2);
      }, 0);
    }
  };

  // Helper formatting insert
  const insertFormat = (prefix: string, suffix: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, selectionEnd, value: text } = textarea;
    const selected = text.slice(selectionStart, selectionEnd);
    const replacement = `${prefix}${selected}${suffix}`;
    const nextText = text.slice(0, selectionStart) + replacement + text.slice(selectionEnd);
    onChange(nextText);
    setTimeout(() => {
      textarea.focus();
      const pos = selectionStart + prefix.length + selected.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const insertLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const { selectionStart, value: text } = textarea;
    const lineStart = text.lastIndexOf("\n", selectionStart - 1) + 1;
    const nextText = text.slice(0, lineStart) + prefix + text.slice(lineStart);
    onChange(nextText);
    setTimeout(() => {
      textarea.focus();
      const pos = selectionStart + prefix.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  // Toggle checkbox state inside preview
  const handleToggleTask = (lineIndex: number) => {
    const lines = value.split("\n");
    const targetLine = lines[lineIndex];
    if (targetLine) {
      if (targetLine.includes("- [ ]")) {
        lines[lineIndex] = targetLine.replace("- [ ]", "- [x]");
      } else if (targetLine.includes("- [x]")) {
        lines[lineIndex] = targetLine.replace("- [x]", "- [ ]");
      }
      onChange(lines.join("\n"));
    }
  };

  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-card overflow-hidden", className)}>
      {/* Notion Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-background/50 px-2.5 py-1.5 text-muted-foreground select-none">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5">
          <button
            type="button"
            onClick={() => insertLinePrefix("# ")}
            className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors text-xs font-bold"
            title="Heading 1 (#)"
          >
            <Heading1 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix("## ")}
            className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors text-xs font-bold"
            title="Heading 2 (##)"
          >
            <Heading2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix("### ")}
            className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors text-xs font-bold"
            title="Heading 3 (###)"
          >
            <Heading3 className="h-3.5 w-3.5" />
          </button>
          <div className="h-3.5 w-px bg-border mx-1" />
          <button
            type="button"
            onClick={() => insertFormat("**", "**")}
            className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors"
            title="Bold (**text**)"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat("*", "*")}
            className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors"
            title="Italic (*text*)"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertFormat("`", "`")}
            className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors"
            title="Inline Code (`code`)"
          >
            <Code className="h-3.5 w-3.5" />
          </button>
          <div className="h-3.5 w-px bg-border mx-1" />
          <button
            type="button"
            onClick={() => insertLinePrefix("- [ ] ")}
            className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors"
            title="Task Checkbox ([] )"
          >
            <CheckSquare className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix("- ")}
            className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors"
            title="Bullet List (- )"
          >
            <List className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix("1. ")}
            className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors"
            title="Numbered List (1. )"
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertLinePrefix("> ")}
            className="p-1 rounded hover:bg-accent hover:text-foreground transition-colors"
            title="Blockquote (> )"
          >
            <Quote className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Edit / Preview Toggle */}
        <div className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-border">
          <button
            type="button"
            onClick={() => setViewMode("edit")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
              viewMode === "edit" ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"
            )}
          >
            <PenLine className="h-3 w-3" /> Edit
          </button>
          <button
            type="button"
            onClick={() => setViewMode("preview")}
            className={cn(
              "flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
              viewMode === "preview" ? "bg-background text-foreground shadow-sm" : "hover:text-foreground"
            )}
          >
            <Eye className="h-3 w-3" /> Preview
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 p-3.5" style={{ minHeight }}>
        {viewMode === "edit" ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full bg-transparent font-sans text-sm leading-relaxed text-foreground outline-none resize-none placeholder:text-muted-foreground/60"
            style={{ minHeight }}
          />
        ) : (
          <div className="prose prose-invert max-w-none text-sm leading-relaxed">
            {value.trim() ? (
              value.split("\n").map((line, idx) => {
                // H1
                if (line.startsWith("# ")) {
                  return (
                    <h1 key={idx} className="text-xl font-bold text-foreground mt-4 mb-2 first:mt-0">
                      {line.replace(/^#\s+/, "")}
                    </h1>
                  );
                }
                // H2
                if (line.startsWith("## ")) {
                  return (
                    <h2 key={idx} className="text-lg font-bold text-foreground mt-3 mb-1.5 first:mt-0">
                      {line.replace(/^##\s+/, "")}
                    </h2>
                  );
                }
                // H3
                if (line.startsWith("### ")) {
                  return (
                    <h3 key={idx} className="text-base font-semibold text-foreground mt-2.5 mb-1 first:mt-0">
                      {line.replace(/^###\s+/, "")}
                    </h3>
                  );
                }
                // Task Checkbox
                if (/^\s*-\s*\[[ x]\]/.test(line)) {
                  const checked = /^\s*-\s*\[x\]/i.test(line);
                  const textContent = line.replace(/^\s*-\s*\[[ x]\]\s*/, "");
                  return (
                    <div key={idx} className="flex items-center gap-2 py-0.5 text-foreground/90">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleTask(idx)}
                        className="h-4 w-4 rounded border-border accent-primary cursor-pointer"
                      />
                      <span className={cn(checked && "line-through text-muted-foreground")}>
                        {textContent}
                      </span>
                    </div>
                  );
                }
                // Blockquote
                if (line.startsWith("> ")) {
                  return (
                    <blockquote
                      key={idx}
                      className="border-l-2 border-primary pl-3 py-0.5 text-muted-foreground italic my-1.5"
                    >
                      {line.replace(/^>\s+/, "")}
                    </blockquote>
                  );
                }
                // Bullet List
                if (/^\s*[-*]\s+/.test(line)) {
                  return (
                    <li key={idx} className="ml-4 list-disc text-foreground/90 py-0.5">
                      {line.replace(/^\s*[-*]\s+/, "")}
                    </li>
                  );
                }
                // Numbered List
                if (/^\s*\d+\.\s+/.test(line)) {
                  return (
                    <li key={idx} className="ml-4 list-decimal text-foreground/90 py-0.5">
                      {line.replace(/^\s*\d+\.\s+/, "")}
                    </li>
                  );
                }
                // Empty Line
                if (!line.trim()) {
                  return <div key={idx} className="h-2" />;
                }
                // Normal Paragraph
                return (
                  <p key={idx} className="text-foreground/90 my-1">
                    {line}
                  </p>
                );
              })
            ) : (
              <p className="text-xs text-muted-foreground italic">Note is empty.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
