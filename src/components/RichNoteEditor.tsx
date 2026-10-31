/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  Strikethrough,
  Code,
  List,
  CheckSquare,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  Link2,
  Undo2,
  Redo2,
} from 'lucide-react';

export interface RichNoteEditorHandle {
  focus: () => void;
  clear: () => void;
}

export interface RichNoteEditorProps {
  initialContent?: string;
  placeholder?: string;
  onChange?: (content: string) => void;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Converts standard Markdown or plaintext into HTML for Tiptap
 */
function markdownToHtml(md: string): string {
  if (!md || !md.trim()) return '';

  // If already HTML
  if (md.trim().startsWith('<') && md.trim().endsWith('>')) {
    return md;
  }

  const lines = md.split('\n');
  const out: string[] = [];
  let inList = false;
  let inTaskList = false;

  const closeLists = () => {
    if (inList) {
      out.push('</ul>');
      inList = false;
    }
    if (inTaskList) {
      out.push('</ul>');
      inTaskList = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Checkbox items: - [ ] or - [x]
    if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('* [ ] ') || trimmed.startsWith('* [x] ')) {
      if (inList) { out.push('</ul>'); inList = false; }
      if (!inTaskList) {
        out.push('<ul data-type="taskList">');
        inTaskList = true;
      }
      const checked = trimmed.startsWith('- [x] ') || trimmed.startsWith('* [x] ');
      const text = trimmed.substring(6);
      out.push(`<li data-type="taskItem" data-checked="${checked}"><label><input type="checkbox" ${checked ? 'checked' : ''} /></label><div><p>${formatInline(text)}</p></div></li>`);
      continue;
    }

    // Bullet items: - or *
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (inTaskList) { out.push('</ul>'); inTaskList = false; }
      if (!inList) {
        out.push('<ul>');
        inList = true;
      }
      out.push(`<li><p>${formatInline(trimmed.substring(2))}</p></li>`);
      continue;
    }

    closeLists();

    if (trimmed.startsWith('# ')) {
      out.push(`<h1>${formatInline(trimmed.substring(2))}</h1>`);
    } else if (trimmed.startsWith('## ')) {
      out.push(`<h2>${formatInline(trimmed.substring(3))}</h2>`);
    } else if (trimmed.startsWith('### ')) {
      out.push(`<h3>${formatInline(trimmed.substring(4))}</h3>`);
    } else if (trimmed.startsWith('> ')) {
      out.push(`<blockquote><p>${formatInline(trimmed.substring(2))}</p></blockquote>`);
    } else if (/^\s*([-*_]\s*){3,}$/.test(trimmed)) {
      out.push('<hr />');
    } else if (trimmed === '') {
      // Empty line
      out.push('<p></p>');
    } else {
      out.push(`<p>${formatInline(raw)}</p>`);
    }
  }

  closeLists();
  return out.join('');
}

function formatInline(text: string): string {
  let res = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold
  res = res.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  res = res.replace(/(^|[^*_])\*([^*]+)\*/g, '$1<em>$2</em>');
  res = res.replace(/(^|[^*_])_([^_]+)_/g, '$1<em>$2</em>');
  // Strike
  res = res.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  // Inline code
  res = res.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Links
  res = res.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  return res;
}

/**
 * Converts Tiptap HTML or DOM tree back to clean Markdown
 */
function htmlToMarkdown(html: string): string {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const walk = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as HTMLElement;
    const tag = el.tagName.toLowerCase();
    const childrenText = Array.from(el.childNodes).map(walk).join('');

    switch (tag) {
      case 'h1':
        return `# ${childrenText}\n\n`;
      case 'h2':
        return `## ${childrenText}\n\n`;
      case 'h3':
        return `### ${childrenText}\n\n`;
      case 'p':
        return `${childrenText}\n\n`;
      case 'strong':
      case 'b':
        return `**${childrenText}**`;
      case 'em':
      case 'i':
        return `*${childrenText}*`;
      case 's':
      case 'del':
      case 'strike':
        return `~~${childrenText}~~`;
      case 'code':
        return `\`${childrenText}\``;
      case 'blockquote':
        return `> ${childrenText.trim()}\n\n`;
      case 'hr':
        return `---\n\n`;
      case 'a':
        return `[${childrenText}](${el.getAttribute('href') || ''})`;
      case 'ul': {
        if (el.getAttribute('data-type') === 'taskList') {
          return `${childrenText}\n`;
        }
        return `${childrenText}\n`;
      }
      case 'li': {
        if (el.getAttribute('data-type') === 'taskItem') {
          const isChecked = el.getAttribute('data-checked') === 'true' || el.querySelector('input[type="checkbox"]:checked') !== null;
          const labelEl = el.querySelector('div') || el;
          const cleanText = Array.from(labelEl.childNodes).map(walk).join('').trim();
          return `- [${isChecked ? 'x' : ' '}] ${cleanText}\n`;
        }
        return `- ${childrenText.trim()}\n`;
      }
      default:
        return childrenText;
    }
  };

  const md = Array.from(doc.body.childNodes).map(walk).join('').trim();
  return md;
}

const RichNoteEditor = forwardRef<RichNoteEditorHandle, RichNoteEditorProps>(({
  initialContent = '',
  placeholder = 'Start writing your thoughts, notes, checklist, or ideas...',
  onChange,
  autoFocus = false,
  className = '',
}, ref) => {
  const [slashMenuOpen, setSlashMenuOpen] = useState(false);
  const [slashSearch, setSlashSearch] = useState('');
  const lastEmittedRef = useRef<string>(initialContent);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        bulletList: { keepMarks: true },
        orderedList: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-sky-400 underline underline-offset-2 hover:text-sky-300',
        },
      }),
    ],
    content: markdownToHtml(initialContent),
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: {
        class: 'focus:outline-none min-h-[140px] text-stone-200 font-serif text-[15px] leading-relaxed selection:bg-amber-500/25 selection:text-amber-200',
      },
      handleKeyDown: (view, event) => {
        // Trigger slash commands menu when user types '/' on an empty line or space
        if (event.key === '/') {
          setTimeout(() => {
            const { state } = view;
            const { from } = state.selection;
            const textBefore = state.doc.textBetween(Math.max(0, from - 1), from, '\n', '\0');
            if (textBefore === '/' || textBefore === '') {
              setSlashMenuOpen(true);
              setSlashSearch('');
            }
          }, 10);
        } else if (event.key === 'Escape') {
          setSlashMenuOpen(false);
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const md = htmlToMarkdown(html);
      lastEmittedRef.current = md;
      if (onChange) {
        onChange(md);
      }
    },
  });

  useImperativeHandle(ref, () => ({
    focus: () => {
      editor?.commands.focus();
    },
    clear: () => {
      editor?.commands.clearContent();
    },
  }));

  // Synchronize when initialContent updates externally (e.g. switching between different entries)
  useEffect(() => {
    if (!editor) return;
    if (initialContent !== lastEmittedRef.current) {
      const newHtml = markdownToHtml(initialContent);
      editor.commands.setContent(newHtml, { emitUpdate: false });
      lastEmittedRef.current = initialContent;
    }
  }, [initialContent, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('Enter link URL (https://...):', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const executeSlashAction = (action: () => void) => {
    // Delete the slash trigger character
    editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).run();
    action();
    setSlashMenuOpen(false);
  };

  return (
    <div className={`relative flex flex-col flex-1 min-h-0 w-full ${className}`}>
      {/* Notion-style Persistent Compact Format Toolbar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-850/80 gap-1 flex-wrap select-none shrink-0">
        <div className="flex items-center gap-0.5 flex-wrap">
          {/* Text formatting */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              editor.isActive('bold')
                ? 'bg-amber-500/20 text-amber-300 font-bold'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              editor.isActive('italic')
                ? 'bg-amber-500/20 text-amber-300 font-bold'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleStrike().run()}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              editor.isActive('strike')
                ? 'bg-amber-500/20 text-amber-300 font-bold'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
            }`}
            title="Strikethrough"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleCode().run()}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              editor.isActive('code')
                ? 'bg-amber-500/20 text-amber-300 font-bold'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
            }`}
            title="Inline Code (`)"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={setLink}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              editor.isActive('link')
                ? 'bg-sky-500/20 text-sky-300 font-bold'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
            }`}
            title="Add Link"
          >
            <Link2 className="w-3.5 h-3.5" />
          </button>

          <span className="w-px h-4 bg-stone-800 mx-1" />

          {/* Block Level Elements */}
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleTaskList().run()}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              editor.isActive('taskList')
                ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
            }`}
            title="Interactive Checklist"
          >
            <CheckSquare className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              editor.isActive('bulletList')
                ? 'bg-amber-500/20 text-amber-300 font-bold'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
            }`}
            title="Bullet List"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              editor.isActive('heading', { level: 1 })
                ? 'bg-amber-500/20 text-amber-300 font-bold'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
            }`}
            title="Heading 1"
          >
            <Heading1 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              editor.isActive('heading', { level: 2 })
                ? 'bg-amber-500/20 text-amber-300 font-bold'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
            }`}
            title="Heading 2"
          >
            <Heading2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              editor.isActive('heading', { level: 3 })
                ? 'bg-amber-500/20 text-amber-300 font-bold'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
            }`}
            title="Heading 3"
          >
            <Heading3 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              editor.isActive('blockquote')
                ? 'bg-amber-500/20 text-amber-300 font-bold'
                : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850'
            }`}
            title="Quote"
          >
            <Quote className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            className="p-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-850 transition-colors cursor-pointer"
            title="Divider Line"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().undo()}
            className="p-1 rounded text-stone-500 hover:text-stone-200 disabled:opacity-30 disabled:hover:text-stone-500 cursor-pointer"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().redo()}
            className="p-1 rounded text-stone-500 hover:text-stone-200 disabled:opacity-30 disabled:hover:text-stone-500 cursor-pointer"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Slash command quick picker popup */}
      {slashMenuOpen && (
        <div className="absolute top-12 left-0 z-50 w-64 bg-[#18181a] border border-stone-800 rounded-xl shadow-2xl p-1.5 text-xs font-mono backdrop-blur-xl">
          <div className="text-[10px] uppercase font-bold text-stone-500 px-2 py-1 tracking-wider border-b border-stone-850/80 mb-1">
            Blocks & Elements
          </div>
          <div className="space-y-0.5">
            <button
              type="button"
              onClick={() => executeSlashAction(() => editor.chain().focus().toggleTaskList().run())}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-stone-300 hover:bg-stone-800/80 hover:text-emerald-400 transition-colors text-left cursor-pointer"
            >
              <CheckSquare className="w-4 h-4 text-emerald-400" />
              <span>To-do Checklist</span>
            </button>
            <button
              type="button"
              onClick={() => executeSlashAction(() => editor.chain().focus().toggleBulletList().run())}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-stone-300 hover:bg-stone-800/80 hover:text-amber-400 transition-colors text-left cursor-pointer"
            >
              <List className="w-4 h-4 text-amber-400" />
              <span>Bulleted List</span>
            </button>
            <button
              type="button"
              onClick={() => executeSlashAction(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-stone-300 hover:bg-stone-800/80 hover:text-stone-100 transition-colors text-left cursor-pointer"
            >
              <Heading1 className="w-4 h-4 text-stone-400" />
              <span>Heading 1</span>
            </button>
            <button
              type="button"
              onClick={() => executeSlashAction(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-stone-300 hover:bg-stone-800/80 hover:text-stone-100 transition-colors text-left cursor-pointer"
            >
              <Heading2 className="w-4 h-4 text-stone-400" />
              <span>Heading 2</span>
            </button>
            <button
              type="button"
              onClick={() => executeSlashAction(() => editor.chain().focus().toggleBlockquote().run())}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-stone-300 hover:bg-stone-800/80 hover:text-stone-100 transition-colors text-left cursor-pointer"
            >
              <Quote className="w-4 h-4 text-stone-400" />
              <span>Quote</span>
            </button>
            <button
              type="button"
              onClick={() => executeSlashAction(() => editor.chain().focus().setHorizontalRule().run())}
              className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-stone-300 hover:bg-stone-800/80 hover:text-stone-100 transition-colors text-left cursor-pointer"
            >
              <Minus className="w-4 h-4 text-stone-400" />
              <span>Divider Line</span>
            </button>
          </div>
        </div>
      )}

      {/* Editor Content Area */}
      <div
        onClick={() => {
          if (!editor.isFocused) {
            editor.commands.focus();
          }
        }}
        className="flex-1 overflow-y-auto cursor-text pr-1"
      >
        <EditorContent editor={editor} />
      </div>

      <style>{`
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #57534e;
          pointer-events: none;
          height: 0;
          font-style: italic;
        }
        .ProseMirror h1 {
          font-size: 1.35rem;
          font-weight: 700;
          color: #f5f5f4;
          margin-top: 1rem;
          margin-bottom: 0.35rem;
          letter-spacing: -0.02em;
        }
        .ProseMirror h2 {
          font-size: 1.15rem;
          font-weight: 600;
          color: #e7e5e4;
          margin-top: 0.85rem;
          margin-bottom: 0.25rem;
          letter-spacing: -0.01em;
        }
        .ProseMirror h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #d6d3d1;
          margin-top: 0.75rem;
          margin-bottom: 0.2rem;
        }
        .ProseMirror ul[data-type="taskList"] {
          list-style: none;
          padding: 0;
          margin: 0.5rem 0;
        }
        .ProseMirror ul[data-type="taskList"] li {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          margin: 0.25rem 0;
        }
        .ProseMirror ul[data-type="taskList"] li > label {
          margin-top: 0.25rem;
          user-select: none;
          cursor: pointer;
        }
        .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"] {
          appearance: none;
          width: 0.95rem;
          height: 0.95rem;
          border-radius: 0.25rem;
          border: 1px solid #57534e;
          background-color: rgba(28, 25, 23, 0.6);
          cursor: pointer;
          position: relative;
          display: inline-block;
          vertical-align: middle;
          transition: all 0.15s ease;
        }
        .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"]:checked {
          background-color: #10b981;
          border-color: #059669;
        }
        .ProseMirror ul[data-type="taskList"] li > label input[type="checkbox"]:checked::after {
          content: '';
          position: absolute;
          left: 4px;
          top: 1px;
          width: 4px;
          height: 8px;
          border: solid #000;
          border-width: 0 2px 2px 0;
          transform: rotate(45deg);
        }
        .ProseMirror ul[data-type="taskList"] li[data-checked="true"] > div > p {
          text-decoration: line-through;
          color: #78716c;
        }
        .ProseMirror ul:not([data-type="taskList"]) {
          list-style-type: disc;
          padding-left: 1.25rem;
          margin: 0.5rem 0;
        }
        .ProseMirror blockquote {
          border-left: 2px solid #57534e;
          padding-left: 0.85rem;
          margin: 0.5rem 0;
          color: #a8a29e;
          font-style: italic;
        }
        .ProseMirror hr {
          border: none;
          border-top: 1px solid #292524;
          margin: 1rem 0;
        }
        .ProseMirror code {
          background-color: #1c1917;
          border: 1px solid #292524;
          color: #fbbf24;
          padding: 0.1rem 0.35rem;
          border-radius: 0.25rem;
          font-family: monospace;
          font-size: 0.85em;
        }
      `}</style>
    </div>
  );
});

export default RichNoteEditor;
