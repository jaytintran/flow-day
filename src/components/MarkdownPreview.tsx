/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { CheckSquare, Square, Check } from 'lucide-react';

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
      result.push(`<h1 class="text-lg font-bold text-stone-100 mt-3 mb-1 first:mt-0">${parseInlineMarkdown(line.substring(2))}</h1>`);
    } else if (trimmed.startsWith('## ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h2 class="text-base font-bold text-stone-200 mt-2.5 mb-1 first:mt-0">${parseInlineMarkdown(line.substring(3))}</h2>`);
    } else if (trimmed.startsWith('### ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h3 class="text-sm font-bold text-stone-300 mt-2 mb-0.5 first:mt-0">${parseInlineMarkdown(line.substring(4))}</h3>`);
    } else if (trimmed.startsWith('- [x] ') || trimmed.startsWith('* [x] ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<div class="flex items-start gap-2 my-1 text-stone-400 line-through opacity-70"><span class="text-emerald-400 mt-0.5 select-none">☑</span><span>${parseInlineMarkdown(line.substring(6))}</span></div>`);
    } else if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('* [ ] ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<div class="flex items-start gap-2 my-1 text-stone-300"><span class="text-stone-500 mt-0.5 select-none">☐</span><span>${parseInlineMarkdown(line.substring(6))}</span></div>`);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        result.push('<ul class="list-disc pl-5 space-y-0.5 my-1 text-stone-300">');
        inList = true;
      }
      result.push(`<li class="leading-relaxed">${parseInlineMarkdown(line.substring(2))}</li>`);
    } else if (trimmed.startsWith('> ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<blockquote class="border-l-2 border-stone-700 pl-3 my-1.5 text-stone-400 italic">${parseInlineMarkdown(line.substring(2))}</blockquote>`);
    } else if (trimmed === '---' || trimmed === '***') {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push('<hr class="border-stone-800 my-2" />');
    } else if (trimmed === '') {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push('<div class="h-3"></div>');
    } else {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<p class="text-stone-300 leading-relaxed mb-1.5 last:mb-0">${parseInlineMarkdown(line)}</p>`);
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
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const activeInputRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const lines = content.length > 0 ? content.split('\n') : [''];

  // Focus and auto-resize active line input
  useEffect(() => {
    if (activeLineIndex !== null && activeInputRef.current) {
      activeInputRef.current.focus();
      activeInputRef.current.style.height = 'auto';
      activeInputRef.current.style.height = `${activeInputRef.current.scrollHeight}px`;
    }
  }, [activeLineIndex]);

  // Click outside listener to exit line edit mode
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setActiveLineIndex(null);
      }
    };
    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  const handleLineChange = (idx: number, newText: string) => {
    const newLines = [...lines];
    newLines[idx] = newText;
    if (onChange) {
      onChange(newLines.join('\n'));
    }
  };

  const handleLineKeyDown = (idx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const currentLine = lines[idx] || '';
      let prefix = '';

      if (currentLine.startsWith('- [ ] ') || currentLine.startsWith('* [ ] ')) {
        if (currentLine.trim() === '- [ ]' || currentLine.trim() === '* [ ]') {
          // Clear empty checkbox line
          handleLineChange(idx, '');
          return;
        }
        prefix = '- [ ] ';
      } else if (currentLine.startsWith('- [x] ') || currentLine.startsWith('* [x] ')) {
        prefix = '- [ ] ';
      } else if (currentLine.startsWith('- ') || currentLine.startsWith('* ')) {
        if (currentLine.trim() === '-' || currentLine.trim() === '*') {
          // Clear empty bullet
          handleLineChange(idx, '');
          return;
        }
        prefix = '- ';
      } else if (currentLine.startsWith('> ')) {
        prefix = '> ';
      }

      const newLines = [...lines.slice(0, idx + 1), prefix, ...lines.slice(idx + 1)];
      if (onChange) {
        onChange(newLines.join('\n'));
      }
      setActiveLineIndex(idx + 1);
    } else if (e.key === 'Backspace') {
      const currentLine = lines[idx] || '';
      if (currentLine === '' && lines.length > 1) {
        e.preventDefault();
        const newLines = lines.filter((_, i) => i !== idx);
        if (onChange) {
          onChange(newLines.join('\n'));
        }
        setActiveLineIndex(Math.max(0, idx - 1));
      }
    } else if (e.key === 'ArrowUp') {
      if (activeInputRef.current?.selectionStart === 0) {
        e.preventDefault();
        setActiveLineIndex(Math.max(0, idx - 1));
      }
    } else if (e.key === 'ArrowDown') {
      const len = lines[idx]?.length || 0;
      if (activeInputRef.current?.selectionStart === len) {
        e.preventDefault();
        setActiveLineIndex(Math.min(lines.length - 1, idx + 1));
      }
    } else if (e.key === 'Escape') {
      setActiveLineIndex(null);
    }
  };

  const handleToggleCheckbox = (idx: number) => {
    const line = lines[idx];
    let updatedLine = line;
    if (line.startsWith('- [ ] ')) {
      updatedLine = line.replace('- [ ] ', '- [x] ');
    } else if (line.startsWith('- [x] ')) {
      updatedLine = line.replace('- [x] ', '- [ ] ');
    } else if (line.startsWith('* [ ] ')) {
      updatedLine = line.replace('* [ ] ', '* [x] ');
    } else if (line.startsWith('* [x] ')) {
      updatedLine = line.replace('* [x] ', '* [ ] ');
    }
    handleLineChange(idx, updatedLine);
  };

  // If non-editable, render pure HTML preview
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

  // If empty content, render interactive placeholder row
  if (content.trim() === '' && activeLineIndex === null) {
    return (
      <div
        ref={containerRef}
        onClick={() => setActiveLineIndex(0)}
        className={`w-full min-h-[60px] text-stone-600 font-serif text-sm italic cursor-text py-2 select-none hover:text-stone-400 transition-colors ${className}`}
      >
        {placeholder}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full flex-1 flex flex-col font-serif text-sm leading-relaxed text-stone-300 space-y-0.5 ${className}`}
    >
      {lines.map((line, idx) => {
        const isEditingThisLine = activeLineIndex === idx;
        const trimmed = line.trim();

        // Checkbox Line detection
        const isUnchecked = trimmed.startsWith('- [ ] ') || trimmed.startsWith('* [ ] ');
        const isChecked = trimmed.startsWith('- [x] ') || trimmed.startsWith('* [x] ');
        const isCheckbox = isUnchecked || isChecked;
        const checkboxLabel = isCheckbox ? line.replace(/^(\s*[-*]\s*\[[ x]\]\s*)/, '') : '';

        // Heading detection
        const isH1 = trimmed.startsWith('# ');
        const isH2 = trimmed.startsWith('## ');
        const isH3 = trimmed.startsWith('### ');

        // Bullet detection
        const isBullet = (trimmed.startsWith('- ') || trimmed.startsWith('* ')) && !isCheckbox;
        const bulletContent = isBullet ? line.replace(/^(\s*[-*]\s*)/, '') : '';

        // Quote detection
        const isQuote = trimmed.startsWith('> ');
        const quoteContent = isQuote ? line.replace(/^(\s*>\s*)/, '') : '';

        // Divider
        const isDivider = trimmed === '---' || trimmed === '***';

        if (isEditingThisLine) {
          return (
            <div key={idx} className="relative w-full py-0.5">
              <textarea
                ref={activeInputRef}
                value={line}
                onChange={(e) => {
                  handleLineChange(idx, e.target.value);
                  if (activeInputRef.current) {
                    activeInputRef.current.style.height = 'auto';
                    activeInputRef.current.style.height = `${activeInputRef.current.scrollHeight}px`;
                  }
                }}
                onKeyDown={(e) => handleLineKeyDown(idx, e)}
                onBlur={() => {
                  // Slight delay so user can click another line or link without blur race
                  setTimeout(() => {
                    if (activeLineIndex === idx) {
                      setActiveLineIndex(null);
                    }
                  }, 120);
                }}
                placeholder={idx === 0 ? placeholder : ''}
                rows={1}
                className="w-full bg-white/[0.04] border-l-2 border-indigo-500/80 text-stone-100 font-mono text-xs sm:text-sm px-2 py-1 rounded-r focus:outline-none resize-none leading-relaxed overflow-hidden"
              />
            </div>
          );
        }

        // Render formatted live-preview line
        return (
          <div
            key={idx}
            onClick={() => setActiveLineIndex(idx)}
            className="group relative flex items-start gap-1.5 px-1.5 py-0.5 -mx-1.5 rounded hover:bg-white/[0.03] transition-colors cursor-text min-h-[24px]"
          >
            {isCheckbox ? (
              <div className="flex items-start gap-2 w-full">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleToggleCheckbox(idx);
                  }}
                  className={`mt-1 w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all cursor-pointer ${
                    isChecked
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'border-stone-700 hover:border-stone-500 bg-stone-900/60 text-stone-500'
                  }`}
                >
                  {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </button>
                <span
                  className={`flex-1 ${
                    isChecked ? 'line-through text-stone-500 opacity-70' : 'text-stone-300'
                  }`}
                  dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(checkboxLabel) }}
                />
              </div>
            ) : isH1 ? (
              <h1
                className="text-lg font-bold text-stone-100 mt-2 mb-0.5 first:mt-0 flex-1"
                dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line.substring(2)) }}
              />
            ) : isH2 ? (
              <h2
                className="text-base font-bold text-stone-200 mt-1.5 mb-0.5 first:mt-0 flex-1"
                dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line.substring(3)) }}
              />
            ) : isH3 ? (
              <h3
                className="text-sm font-bold text-stone-300 mt-1 mb-0.5 first:mt-0 flex-1"
                dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line.substring(4)) }}
              />
            ) : isBullet ? (
              <div className="flex items-start gap-2 w-full pl-2">
                <span className="text-stone-500 select-none">•</span>
                <span
                  className="flex-1"
                  dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(bulletContent) }}
                />
              </div>
            ) : isQuote ? (
              <blockquote
                className="border-l-2 border-stone-700 pl-3 my-0.5 text-stone-400 italic flex-1"
                dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(quoteContent) }}
              />
            ) : isDivider ? (
              <hr className="border-stone-800 my-1 w-full" />
            ) : line === '' ? (
              <div className="h-4 w-full" />
            ) : (
              <p
                className="text-stone-300 leading-relaxed flex-1"
                dangerouslySetInnerHTML={{ __html: parseInlineMarkdown(line) }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

