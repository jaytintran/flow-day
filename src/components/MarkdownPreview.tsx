/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface MarkdownPreviewProps {
  text: string;
  placeholder?: string;
  onClick?: () => void;
}

export function parseMarkdown(text: string): string {
  if (!text) return '';

  // 1. Escape HTML
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // 2. Parse inline code: `code`
  html = html.replace(/`([^`\n]+)`/g, '<code class="bg-[#1a1a1a] border border-stone-850 text-amber-400/90 px-1.5 py-0.5 rounded font-mono text-[11px]">$1</code>');

  // 3. Parse bold: **text**
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  // 4. Parse italics: *text* or _text_
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

  // 5. Parse links: [label](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-amber-400/90 hover:text-amber-300 underline transition-colors" onclick="event.stopPropagation()">$1</a>');

  // 6. Split lines to parse blocks
  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('# ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h1 class="text-lg font-bold text-stone-100 mt-4 mb-2 first:mt-0">${line.substring(2)}</h1>`);
    } else if (trimmed.startsWith('## ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h2 class="text-base font-bold text-stone-200 mt-3.5 mb-1.5 first:mt-0">${line.substring(3)}</h2>`);
    } else if (trimmed.startsWith('### ')) {
      if (inList) { result.push('</ul>'); inList = false; }
      result.push(`<h3 class="text-sm font-bold text-stone-300 mt-3 mb-1 first:mt-0">${line.substring(4)}</h3>`);
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList) {
        result.push('<ul class="list-disc pl-5 space-y-1 my-2 text-stone-300">');
        inList = true;
      }
      result.push(`<li class="leading-relaxed">${line.substring(2)}</li>`);
    } else if (trimmed === '') {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      result.push('<div class="h-3"></div>');
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      result.push(`<p class="text-stone-300 leading-relaxed mb-2 last:mb-0">${line}</p>`);
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  return result.join('\n');
}

export default function MarkdownPreview({ text, placeholder = '', onClick }: MarkdownPreviewProps) {
  if (!text.trim()) {
    return (
      <div
        onClick={onClick}
        className="w-full flex-1 text-stone-600 font-serif text-sm italic cursor-pointer py-2 select-none hover:text-stone-500 transition-colors"
      >
        {placeholder}
      </div>
    );
  }

  const parsedHtml = parseMarkdown(text);

  return (
    <div
      onClick={onClick}
      className="w-full flex-1 font-serif text-sm leading-relaxed text-stone-300 cursor-pointer overflow-y-auto max-w-none pt-2"
      dangerouslySetInnerHTML={{ __html: parsedHtml }}
    />
  );
}
