/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Bold,
  Italic,
  Link2,
  CheckSquare,
  List,
  Code,
  Check,
} from 'lucide-react';

export interface MarkdownPreviewProps {
  text?: string;
  value?: string;
  placeholder?: string;
  editable?: boolean;
  onChange?: (newText: string) => void;
  onClick?: () => void;
  className?: string;
}

// Inline Markdown parser for formatting and colored clickable links
export function parseInlineMarkdown(text: string): string {
  if (!text) return '';

  // 1. Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Parse inline code: `code`
  html = html.replace(
    /`([^`\n]+)`/g,
    '<code class="bg-[#1a1a1a] border border-stone-850 text-amber-400/90 px-1.5 py-0.5 rounded font-mono text-[11px]">$1</code>'
  );

  // 3. Parse strikethrough: ~~text~~
  html = html.replace(/~~([^~]+)~~/g, '<del class="line-through text-stone-500">$1</del>');

  // 4. Parse bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-bold text-stone-100">$1</strong>');

  // 5. Parse italics: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic text-stone-200">$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em class="italic text-stone-200">$1</em>');

  // 6. Parse named Markdown links: [label](url)
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors font-medium inline-flex items-center gap-0.5 cursor-pointer" onclick="event.stopPropagation()">$1<span class="text-[9px] opacity-70">↗</span></a>'
  );

  // 7. Parse bare URLs: https://... or http://... (not preceded by href=" or >)
  html = html.replace(
    /(^|[\s(])(https?:\/\/[^\s<)]+)/g,
    '$1<a href="$2" target="_blank" rel="noopener noreferrer" class="text-sky-400 hover:text-sky-300 underline underline-offset-2 transition-colors font-medium inline-flex items-center gap-0.5 cursor-pointer" onclick="event.stopPropagation()">$2<span class="text-[9px] opacity-70">↗</span></a>'
  );

  return html;
}

export function parseMarkdown(text: string): string {
  if (!text) return '';

  const lines = text.split('\n');
  const result: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('# ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h1 class="text-xl font-bold text-stone-100 mt-4 mb-1.5 first:mt-0 tracking-tight">${parseInlineMarkdown(line.substring(2))}</h1>`);
    } else if (trimmed.startsWith('## ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h2 class="text-lg font-bold text-stone-200 mt-3 mb-1 first:mt-0 tracking-tight">${parseInlineMarkdown(line.substring(3))}</h2>`);
    } else if (trimmed.startsWith('### ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h3 class="text-base font-semibold text-stone-300 mt-2.5 mb-1 first:mt-0">${parseInlineMarkdown(line.substring(4))}</h3>`);
    } else if (trimmed.startsWith('- [x] ') || trimmed.startsWith('* [x] ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<div class="flex items-start gap-2 my-1 text-stone-400 line-through opacity-70"><span class="text-emerald-400 mt-0.5 select-none">☑</span><span>${parseInlineMarkdown(line.substring(6))}</span></div>`);
    } else if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('* [ ] ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<div class="flex items-start gap-2 my-1 text-stone-300"><span class="text-stone-500 mt-0.5 select-none">☐</span><span>${parseInlineMarkdown(line.substring(6))}</span></div>`);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        result.push('<ul class="list-disc pl-5 space-y-1 my-1.5 text-stone-300 text-[15px]">');
        inList = true;
      }
      result.push(`<li class="leading-relaxed">${parseInlineMarkdown(line.substring(2))}</li>`);
    } else if (trimmed.startsWith('> ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<blockquote class="border-l-2 border-stone-700 pl-3.5 my-2 text-stone-400 italic text-[15px]">${parseInlineMarkdown(line.substring(2))}</blockquote>`);
    } else if (/^\s*([-*_]\s*){3,}$/.test(trimmed)) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push('<div class="w-full py-2.5 my-1.5 select-none"><div class="w-full h-px bg-stone-800 border-t border-stone-800/80"></div></div>');
    } else if (trimmed === '') {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push('<div class="h-3"></div>');
    } else {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<p class="text-stone-300 text-[15px] leading-relaxed mb-2 last:mb-0">${parseInlineMarkdown(line)}</p>`);
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  return result.join('\n');
}

export default function MarkdownPreview({
  text,
  value,
  placeholder = 'Add context, notes, or links...',
  editable = false,
  onChange,
  onClick,
  className = '',
}: MarkdownPreviewProps) {
  const content = (value !== undefined ? value : text) || '';
  const [isEditing, setIsEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Focus and auto-resize textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(120, textareaRef.current.scrollHeight)}px`;
    }
  }, [isEditing]);

  // Click outside listener to exit edit mode
  useEffect(() => {
    if (!isEditing) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (!containerRef.current) return;
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      if (path.length > 0) {
        if (!path.includes(containerRef.current)) {
          setIsEditing(false);
        }
      } else if (!containerRef.current.contains(e.target as Node)) {
        setIsEditing(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [isEditing]);

  // Handle textarea text change & auto-resize
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (onChange) {
      onChange(val);
    }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.max(120, textareaRef.current.scrollHeight)}px`;
    }
  };

  // 1-Tap Checkbox Toggle in Preview Mode
  const handleToggleCheckboxInPreview = (lineIndex: number) => {
    const lines = content.split('\n');
    const line = lines[lineIndex];
    if (!line) return;

    let updated = line;
    if (line.startsWith('- [ ] ')) {
      updated = line.replace('- [ ] ', '- [x] ');
    } else if (line.startsWith('- [x] ')) {
      updated = line.replace('- [x] ', '- [ ] ');
    } else if (line.startsWith('* [ ] ')) {
      updated = line.replace('* [ ] ', '* [x] ');
    } else if (line.startsWith('* [x] ')) {
      updated = line.replace('* [x] ', '* [ ] ');
    }

    lines[lineIndex] = updated;
    if (onChange) {
      onChange(lines.join('\n'));
    }
  };

  // Keyboard Navigation & Markdown Shortcuts inside Textarea
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Ctrl/Cmd + Enter: Commit and exit edit mode
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      setIsEditing(false);
      return;
    }

    // Escape: Commit and exit edit mode
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditing(false);
      return;
    }

    // Ctrl/Cmd + B: Bold
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      wrapSelection('**', '**', 'bold text');
      return;
    }

    // Ctrl/Cmd + I: Italic
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'i') {
      e.preventDefault();
      wrapSelection('*', '*', 'italic text');
      return;
    }

    // Ctrl/Cmd + K: Link
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      wrapSelection('[', '](https://)', 'link text');
      return;
    }

    // Enter: Auto-continue list prefixes (- , * , - [ ] , > )
    if (e.key === 'Enter' && !e.shiftKey) {
      const start = textarea.selectionStart;
      const beforeCursor = content.substring(0, start);
      const lastNewLine = beforeCursor.lastIndexOf('\n');
      const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
      const currentLine = content.substring(lineStart, start);

      let prefix = '';
      if (currentLine.startsWith('- [ ] ') || currentLine.startsWith('* [ ] ')) {
        if (currentLine.trim() === '- [ ]' || currentLine.trim() === '* [ ]') {
          // Clear empty checkbox on second Enter
          e.preventDefault();
          const newContent = content.substring(0, lineStart) + content.substring(start);
          if (onChange) onChange(newContent);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.setSelectionRange(lineStart, lineStart);
            }
          }, 0);
          return;
        }
        prefix = '- [ ] ';
      } else if (currentLine.startsWith('- [x] ') || currentLine.startsWith('* [x] ')) {
        prefix = '- [ ] ';
      } else if (currentLine.startsWith('- ') || currentLine.startsWith('* ')) {
        if (currentLine.trim() === '-' || currentLine.trim() === '*') {
          // Clear empty bullet on second Enter
          e.preventDefault();
          const newContent = content.substring(0, lineStart) + content.substring(start);
          if (onChange) onChange(newContent);
          setTimeout(() => {
            if (textareaRef.current) {
              textareaRef.current.setSelectionRange(lineStart, lineStart);
            }
          }, 0);
          return;
        }
        prefix = '- ';
      } else if (currentLine.startsWith('> ')) {
        prefix = '> ';
      }

      if (prefix) {
        e.preventDefault();
        const newContent = content.substring(0, start) + '\n' + prefix + content.substring(start);
        if (onChange) onChange(newContent);
        setTimeout(() => {
          if (textareaRef.current) {
            const newPos = start + 1 + prefix.length;
            textareaRef.current.setSelectionRange(newPos, newPos);
          }
        }, 0);
      }
    }

    // Tab: Insert 2 spaces
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      if (onChange) onChange(newContent);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(start + 2, start + 2);
        }
      }, 0);
    }
  };

  // Helper: Wrap text selection
  const wrapSelection = (before: string, after: string = before, placeholderText = 'text') => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = content.substring(start, end);
    const textToWrap = selected.length > 0 ? selected : placeholderText;
    const replacement = `${before}${textToWrap}${after}`;
    const newContent = content.substring(0, start) + replacement + content.substring(end);
    if (onChange) onChange(newContent);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(
          start + before.length,
          start + before.length + textToWrap.length
        );
      }
    }, 0);
  };

  // Helper: Toggle line prefix (e.g. checkbox or bullet)
  const toggleLinePrefix = (prefix: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const beforeCursor = content.substring(0, start);
    const lastNewLine = beforeCursor.lastIndexOf('\n');
    const lineStart = lastNewLine === -1 ? 0 : lastNewLine + 1;
    const currentLine = content.substring(lineStart, start);

    let newContent: string;
    let newCursor: number;
    if (currentLine.startsWith(prefix)) {
      newContent = content.substring(0, lineStart) + currentLine.substring(prefix.length) + content.substring(start);
      newCursor = Math.max(lineStart, start - prefix.length);
    } else {
      newContent = content.substring(0, lineStart) + prefix + content.substring(lineStart);
      newCursor = start + prefix.length;
    }
    if (onChange) onChange(newContent);
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newCursor, newCursor);
      }
    }, 0);
  };

  // Non-editable mode (pure HTML render)
  if (!editable) {
    if (!content.trim()) {
      return (
        <div
          onClick={onClick}
          className={`w-full text-stone-600 font-serif text-sm italic cursor-pointer py-1 select-none hover:text-stone-500 transition-colors ${className}`}
        >
          {placeholder}
        </div>
      );
    }

    const parsedHtml = parseMarkdown(content);
    return (
      <div
        onClick={onClick}
        className={`w-full font-serif text-sm leading-relaxed text-stone-300 cursor-pointer overflow-y-auto max-w-none pt-1 ${className}`}
        dangerouslySetInnerHTML={{ __html: parsedHtml }}
      />
    );
  }

  // EDIT MODE: Seamless Multi-line Textarea + Quick Formatting Toolbar
  if (isEditing) {
    return (
      <div
        ref={containerRef}
        className={`w-full flex-1 flex flex-col space-y-3 bg-transparent transition-all ${className}`}
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full bg-transparent text-stone-200 font-serif text-[15px] focus:outline-none resize-none leading-relaxed placeholder-stone-600 min-h-[140px] p-0 border-none"
        />

        {/* Floating Quick Action Toolbar */}
        <div className="flex items-center justify-between pt-2.5 border-t border-stone-850/60 gap-1 flex-wrap select-none">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => wrapSelection('**', '**', 'bold')}
              title="Bold (Ctrl+B)"
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <Bold className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('*', '*', 'italic')}
              title="Italic (Ctrl+I)"
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <Italic className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('[', '](https://)', 'link text')}
              title="Link (Ctrl+K)"
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => toggleLinePrefix('- [ ] ')}
              title="Checklist Item"
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <CheckSquare className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => toggleLinePrefix('- ')}
              title="Bullet List"
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => wrapSelection('`', '`', 'code')}
              title="Inline Code"
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] text-stone-600 font-mono hidden sm:inline">
              Ctrl+Enter or Esc to save
            </span>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-stone-800 hover:bg-stone-750 text-stone-200 hover:text-white text-xs font-mono font-medium border border-stone-700 transition-all cursor-pointer active:scale-95 shadow-sm"
            >
              <Check className="w-3 h-3 text-emerald-400" />
              <span>Done</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PREVIEW MODE: Rich Formatted Markdown with Interactive Checkboxes & Clickable Links
  const lines = content.length > 0 ? content.split('\n') : [];

  if (lines.length === 0 || content.trim() === '') {
    return (
      <div
        ref={containerRef}
        onClick={() => setIsEditing(true)}
        className={`w-full min-h-[60px] text-stone-600 font-serif text-[15px] italic cursor-text py-1 select-none ${className}`}
      >
        {placeholder}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onClick={() => setIsEditing(true)}
      className={`w-full flex-1 flex flex-col font-serif text-[15px] leading-relaxed text-stone-300 space-y-1.5 cursor-text py-1 ${className}`}
    >
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Checkbox Line
        const isUnchecked = trimmed.startsWith('- [ ] ') || trimmed.startsWith('* [ ] ');
        const isChecked = trimmed.startsWith('- [x] ') || trimmed.startsWith('* [x] ');
        const isCheckbox = isUnchecked || isChecked;
        const checkboxLabel = isCheckbox ? line.replace(/^(\s*[-*]\s*\[[ x]\]\s*)/, '') : '';

        // Heading
        const isH1 = trimmed.startsWith('# ');
        const isH2 = trimmed.startsWith('## ');
        const isH3 = trimmed.startsWith('### ');

        // Bullet
        const isBullet = (trimmed.startsWith('- ') || trimmed.startsWith('* ')) && !isCheckbox;
        const bulletContent = isBullet ? line.replace(/^(\s*[-*]\s*)/, '') : '';

        // Quote
        const isQuote = trimmed.startsWith('> ');
        const quoteContent = isQuote ? line.replace(/^(\s*>\s*)/, '') : '';

        // Divider
        const isDivider = /^\s*([-*_]\s*){3,}$/.test(trimmed);

        if (isDivider) {
          return (
            <div key={idx} className="w-full py-2.5 my-1.5 select-none">
              <div className="w-full h-px bg-stone-800 border-t border-stone-800/80" />
            </div>
          );
        }

        if (isCheckbox) {
          return (
            <div key={idx} className="flex items-start gap-2 w-full my-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleCheckboxInPreview(idx);
                }}
                className={`mt-1 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                  isChecked
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'border-stone-700 hover:border-stone-500 bg-stone-900/60 text-stone-500'
                }`}
                title={isChecked ? 'Mark incomplete' : 'Mark complete'}
              >
                {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </button>
              <span
                className={`flex-1 text-[15px] ${
                  isChecked ? 'line-through text-stone-500 opacity-70' : 'text-stone-300'
                }`}
                dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(checkboxLabel) }}
              />
            </div>
          );
        }

        if (isH1) {
          return (
            <h1
              key={idx}
              className="text-xl font-bold text-stone-100 mt-3 mb-1 first:mt-0 tracking-tight"
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line.substring(2)) }}
            />
          );
        }

        if (isH2) {
          return (
            <h2
              key={idx}
              className="text-lg font-bold text-stone-200 mt-2.5 mb-1 first:mt-0 tracking-tight"
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line.substring(3)) }}
            />
          );
        }

        if (isH3) {
          return (
            <h3
              key={idx}
              className="text-base font-semibold text-stone-300 mt-2 mb-0.5 first:mt-0"
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line.substring(4)) }}
            />
          );
        }

        if (isBullet) {
          return (
            <div key={idx} className="flex items-start gap-2 w-full pl-2 text-[15px]">
              <span className="text-stone-500 select-none">•</span>
              <span
                className="flex-1"
                dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(bulletContent) }}
              />
            </div>
          );
        }

        if (isQuote) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-stone-700 pl-3.5 my-1 text-stone-400 italic text-[15px]"
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(quoteContent) }}
            />
          );
        }

        if (line === '') {
          return <div key={idx} className="h-2 w-full" />;
        }

        return (
          <p
            key={idx}
            className="text-stone-300 text-[15px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line) }}
          />
        );
      })}
    </div>
  );
}

