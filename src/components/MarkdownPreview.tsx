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
  SquareCode,
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
  let inCodeBlock = false;
  let codeBlockLang = '';
  let codeBlockLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Fenced Code Block start/end: ``` or ```lang
    if (trimmed.startsWith('```')) {
      if (inList) { result.push('</ul>'); inList = false; }

      if (inCodeBlock) {
        // Closing code block
        const escapedCode = codeBlockLines
          .map((l) =>
            l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          )
          .join('\n');
        result.push(
          `<div class="my-2.5 rounded-xl border border-stone-800 bg-[#0d0d0d] overflow-hidden font-mono text-[13px] text-stone-200">` +
            (codeBlockLang
              ? `<div class="px-3.5 py-1 text-[10px] font-mono uppercase tracking-widest text-stone-500 bg-stone-900/60 border-b border-stone-800/80">${codeBlockLang}</div>`
              : '') +
            `<pre class="p-3.5 overflow-x-auto leading-relaxed text-amber-300/90 font-mono"><code>${escapedCode}</code></pre>` +
          `</div>`
        );
        inCodeBlock = false;
        codeBlockLang = '';
        codeBlockLines = [];
        continue;
      } else {
        // Opening code block
        inCodeBlock = true;
        codeBlockLang = trimmed.substring(3).trim();
        codeBlockLines = [];
        continue;
      }
    }

    if (inCodeBlock) {
      codeBlockLines.push(line);
      continue;
    }

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

  // Handle unclosed code block if user is still typing
  if (inCodeBlock) {
    const escapedCode = codeBlockLines
      .map((l) =>
        l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      )
      .join('\n');
    result.push(
      `<div class="my-2.5 rounded-xl border border-stone-800 bg-[#0d0d0d] overflow-hidden font-mono text-[13px] text-stone-200">` +
        (codeBlockLang
          ? `<div class="px-3.5 py-1 text-[10px] font-mono uppercase tracking-widest text-stone-500 bg-stone-900/60 border-b border-stone-800/80">${codeBlockLang}</div>`
          : '') +
        `<pre class="p-3.5 overflow-x-auto leading-relaxed text-amber-300/90 font-mono"><code>${escapedCode}</code></pre>` +
      `</div>`
    );
  }

  if (inList) {
    result.push('</ul>');
  }

  return result.join('\n');
}

type ParsedBlock =
  | { type: 'code'; lang: string; code: string }
  | { type: 'checkbox'; isChecked: boolean; label: string; lineIndex: number }
  | { type: 'h1'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'bullet'; text: string }
  | { type: 'quote'; text: string }
  | { type: 'divider' }
  | { type: 'empty' }
  | { type: 'paragraph'; text: string };

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

  // Auto-adjust textarea height smoothly without collapsing parent scroll offset
  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Find closest scrollable ancestor
    const scrollParent = textarea.closest('.overflow-y-auto') as HTMLElement | null;
    const prevScrollTop = scrollParent ? scrollParent.scrollTop : null;

    // Set to 0 to calculate true scrollHeight without latching to inflated height
    textarea.style.height = '0px';
    const targetHeight = Math.max(140, textarea.scrollHeight);
    textarea.style.height = `${targetHeight}px`;

    // Restore parent scroll position so viewport doesn't shift down
    if (scrollParent && prevScrollTop !== null) {
      scrollParent.scrollTop = prevScrollTop;
    }
  };

  // Focus and auto-resize textarea when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      adjustHeight();
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

  // Pre-calculate parsed blocks unconditionally for Preview mode
  const parsedBlocks = React.useMemo(() => {
    const rawLines = content.length > 0 ? content.split('\n') : [];
    const blocks: ParsedBlock[] = [];
    let inCode = false;
    let codeLang = '';
    let codeLines: string[] = [];

    for (let i = 0; i < rawLines.length; i++) {
      const line = rawLines[i];
      const trimmed = line.trim();

      if (trimmed.startsWith('```')) {
        if (inCode) {
          blocks.push({
            type: 'code',
            lang: codeLang,
            code: codeLines.join('\n'),
          });
          inCode = false;
          codeLang = '';
          codeLines = [];
          continue;
        } else {
          inCode = true;
          codeLang = trimmed.substring(3).trim();
          codeLines = [];
          continue;
        }
      }

      if (inCode) {
        codeLines.push(line);
        continue;
      }

      const isUnchecked = trimmed.startsWith('- [ ] ') || trimmed.startsWith('* [ ] ');
      const isChecked = trimmed.startsWith('- [x] ') || trimmed.startsWith('* [x] ');
      const isCheckbox = isUnchecked || isChecked;
      if (isCheckbox) {
        const checkboxLabel = line.replace(/^(\s*[-*]\s*\[[ x]\]\s*)/, '');
        blocks.push({
          type: 'checkbox',
          isChecked,
          label: checkboxLabel,
          lineIndex: i,
        });
        continue;
      }

      if (trimmed.startsWith('# ')) {
        blocks.push({ type: 'h1', text: line.substring(2) });
      } else if (trimmed.startsWith('## ')) {
        blocks.push({ type: 'h2', text: line.substring(3) });
      } else if (trimmed.startsWith('### ')) {
        blocks.push({ type: 'h3', text: line.substring(4) });
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        blocks.push({ type: 'bullet', text: line.replace(/^(\s*[-*]\s*)/, '') });
      } else if (trimmed.startsWith('> ')) {
        blocks.push({ type: 'quote', text: line.replace(/^(\s*>\s*)/, '') });
      } else if (/^\s*([-*_]\s*){3,}$/.test(trimmed)) {
        blocks.push({ type: 'divider' });
      } else if (trimmed === '') {
        blocks.push({ type: 'empty' });
      } else {
        blocks.push({ type: 'paragraph', text: line });
      }
    }

    if (inCode) {
      blocks.push({
        type: 'code',
        lang: codeLang,
        code: codeLines.join('\n'),
      });
    }

    return blocks;
  }, [content]);

  // Handle textarea text change & auto-resize
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    if (onChange) {
      onChange(val);
    }
    adjustHeight();
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
      updated = line.replace('* [x] ', '- [ ] ');
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
      adjustHeight();
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
      adjustHeight();
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
            <button
              type="button"
              onClick={() => wrapSelection('```\n', '\n```', 'code block')}
              title="Code Block (```)"
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <SquareCode className="w-3.5 h-3.5" />
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

  if (parsedBlocks.length === 0 || content.trim() === '') {
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
      {parsedBlocks.map((block, idx) => {
        if (block.type === 'code') {
          return (
            <div
              key={idx}
              onClick={(e) => e.stopPropagation()}
              className="my-2.5 rounded-xl border border-stone-800 bg-[#0d0d0d] overflow-hidden font-mono text-[13px] text-stone-200 shadow-sm cursor-auto"
            >
              <div className="flex items-center justify-between px-3.5 py-1.5 bg-stone-900/60 border-b border-stone-800/80 text-[10px] font-mono uppercase tracking-widest text-stone-500 select-none">
                <span>{block.lang || 'code'}</span>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(block.code);
                    } catch {}
                  }}
                  className="px-2 py-0.5 rounded text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
                  title="Copy code"
                >
                  Copy
                </button>
              </div>
              <pre className="p-3.5 overflow-x-auto leading-relaxed text-amber-300/90 font-mono select-text">
                <code>{block.code}</code>
              </pre>
            </div>
          );
        }

        if (block.type === 'divider') {
          return (
            <div key={idx} className="w-full py-2.5 my-1.5 select-none">
              <div className="w-full h-px bg-stone-800 border-t border-stone-800/80" />
            </div>
          );
        }

        if (block.type === 'checkbox') {
          return (
            <div key={idx} className="flex items-start gap-2 w-full my-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleCheckboxInPreview(block.lineIndex);
                }}
                className={`mt-1 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                  block.isChecked
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                    : 'border-stone-700 hover:border-stone-500 bg-stone-900/60 text-stone-500'
                }`}
                title={block.isChecked ? 'Mark incomplete' : 'Mark complete'}
              >
                {block.isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
              </button>
              <span
                className={`flex-1 text-[15px] ${
                  block.isChecked ? 'line-through text-stone-500 opacity-70' : 'text-stone-300'
                }`}
                dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(block.label) }}
              />
            </div>
          );
        }

        if (block.type === 'h1') {
          return (
            <h1
              key={idx}
              className="text-xl font-bold text-stone-100 mt-3 mb-1 first:mt-0 tracking-tight"
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(block.text) }}
            />
          );
        }

        if (block.type === 'h2') {
          return (
            <h2
              key={idx}
              className="text-lg font-bold text-stone-200 mt-2.5 mb-1 first:mt-0 tracking-tight"
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(block.text) }}
            />
          );
        }

        if (block.type === 'h3') {
          return (
            <h3
              key={idx}
              className="text-base font-semibold text-stone-300 mt-2 mb-0.5 first:mt-0"
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(block.text) }}
            />
          );
        }

        if (block.type === 'bullet') {
          return (
            <div key={idx} className="flex items-start gap-2 w-full pl-2 text-[15px]">
              <span className="text-stone-500 select-none">•</span>
              <span
                className="flex-1"
                dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(block.text) }}
              />
            </div>
          );
        }

        if (block.type === 'quote') {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-stone-700 pl-3.5 my-1 text-stone-400 italic text-[15px]"
              dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(block.text) }}
            />
          );
        }

        if (block.type === 'empty') {
          return <div key={idx} className="h-2 w-full" />;
        }

        return (
          <p
            key={idx}
            className="text-stone-300 text-[15px] leading-relaxed"
            dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(block.text) }}
          />
        );
      })}
    </div>
  );
}

