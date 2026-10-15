/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  StickyNote,
  Plus,
  Trash2,
  Check,
  X,
  Copy,
  Clock,
  CheckCheck,
} from 'lucide-react';

export interface QuickNote {
  id: string;
  text: string;
  created_at: string;
  updated_at?: string;
}

export const STORAGE_QUICK_NOTES_KEY = 'flowday_scratchpad_quick_notes_v1';

export function loadSavedQuickNotes(): QuickNote[] {
  try {
    const raw = localStorage.getItem(STORAGE_QUICK_NOTES_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
}

export function saveQuickNotes(notes: QuickNote[]) {
  try {
    localStorage.setItem(STORAGE_QUICK_NOTES_KEY, JSON.stringify(notes));
    window.dispatchEvent(new CustomEvent('scratchpad_sync_update'));
  } catch {}
}

function formatNoteDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const timeStr = date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
    if (isToday) return `Today at ${timeStr}`;
    return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${timeStr}`;
  } catch {
    return '';
  }
}

interface QuickNotesTabProps {
  isMobile?: boolean;
}

export default function QuickNotesTab({ isMobile }: QuickNotesTabProps) {
  const [notes, setNotes] = useState<QuickNote[]>(() => loadSavedQuickNotes());
  const [newNoteText, setNewNoteText] = useState('');
  const [isEditorActive, setIsEditorActive] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const newTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync external changes (e.g. from Gist restore or other tabs)
  useEffect(() => {
    const handleSync = () => {
      setNotes(loadSavedQuickNotes());
    };
    window.addEventListener('scratchpad_sync_update', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('scratchpad_sync_update', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, []);

  // Auto-grow textarea height
  const handleAutoGrow = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 40)}px`;
  };

  const handleCreateNote = () => {
    const trimmed = newNoteText.trim();
    if (!trimmed) {
      setIsEditorActive(false);
      return;
    }
    const newNote: QuickNote = {
      id: crypto.randomUUID(),
      text: trimmed,
      created_at: new Date().toISOString(),
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    saveQuickNotes(updated);
    setNewNoteText('');
    setIsEditorActive(false);
    if (newTextareaRef.current) {
      newTextareaRef.current.style.height = 'auto';
    }
  };

  const handleStartEdit = (note: QuickNote, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingNoteId(note.id);
    setEditingText(note.text);
    setTimeout(() => {
      if (editTextareaRef.current) {
        handleAutoGrow(editTextareaRef.current);
        editTextareaRef.current.focus();
        editTextareaRef.current.setSelectionRange(
          editTextareaRef.current.value.length,
          editTextareaRef.current.value.length,
        );
      }
    }, 50);
  };

  const handleSaveEdit = () => {
    if (!editingNoteId) return;
    const trimmed = editingText.trim();
    if (!trimmed) {
      handleDeleteNote(editingNoteId);
      setEditingNoteId(null);
      return;
    }
    const updated = notes.map((n) =>
      n.id === editingNoteId
        ? { ...n, text: trimmed, updated_at: new Date().toISOString() }
        : n,
    );
    setNotes(updated);
    saveQuickNotes(updated);
    setEditingNoteId(null);
  };

  const handleDeleteNote = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    saveQuickNotes(updated);
    if (editingNoteId === id) setEditingNoteId(null);
  };

  const handleCopyNote = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  return (
    <div className="flex flex-col h-full font-sans select-none">
      {/* ── Top Freeform Notepad (Google Keep Style) ── */}
      <div className="shrink-0 mb-3">
        <div
          onClick={() => {
            setIsEditorActive(true);
            setTimeout(() => newTextareaRef.current?.focus(), 50);
          }}
          className={`rounded-xl border transition-all ${
            isEditorActive
              ? 'bg-stone-900 border-amber-500/50 shadow-lg shadow-amber-500/5 p-3'
              : 'bg-stone-900/60 hover:bg-stone-900/90 border-stone-800 hover:border-stone-700/80 p-2.5 cursor-text'
          }`}
        >
          <textarea
            ref={newTextareaRef}
            rows={isEditorActive ? 3 : 1}
            value={newNoteText}
            onFocus={() => setIsEditorActive(true)}
            onChange={(e) => {
              setNewNoteText(e.target.value);
              handleAutoGrow(e.target);
            }}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleCreateNote();
              }
              if (e.key === 'Escape' && !newNoteText.trim()) {
                setIsEditorActive(false);
              }
            }}
            placeholder={isEditorActive ? 'Jot down thoughts freely...' : 'Take a quick note...'}
            className="w-full bg-transparent text-xs text-stone-200 placeholder-stone-500 focus:outline-none resize-none overflow-hidden leading-relaxed select-text"
          />

          {isEditorActive && (
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-stone-800/80">
              <span className="text-[10px] font-mono text-stone-500 select-none">
                Ctrl+Enter to save
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setNewNoteText('');
                    setIsEditorActive(false);
                    if (newTextareaRef.current) newTextareaRef.current.style.height = 'auto';
                  }}
                  className="px-2.5 py-1 text-xs font-mono text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCreateNote();
                  }}
                  disabled={!newNoteText.trim()}
                  className="flex items-center gap-1 px-3 py-1 text-xs font-mono font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 rounded-lg transition-colors cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Save Note</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Saved Notes Stack (Google Keep Cards) ── */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-0.5">
        {notes.length === 0 ? (
          <div className="py-16 text-center text-stone-500 text-xs font-mono flex flex-col items-center gap-2 border border-dashed border-stone-800/60 rounded-xl">
            <StickyNote className="w-7 h-7 stroke-1 text-stone-600" />
            <span className="font-bold text-stone-400">No quick notes yet</span>
            <span className="text-[11px] text-stone-500 max-w-xs">
              Jot down thoughts, links, code snippets, or ideas. Each note is saved as a full-detail card.
            </span>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {notes.map((note) => {
              const isEditing = editingNoteId === note.id;
              const isDeleting = deletingId === note.id;

              return (
                <motion.div
                  key={note.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => {
                    if (!isEditing) handleStartEdit(note, e);
                  }}
                  className={`group relative rounded-xl border transition-all ${
                    isEditing
                      ? 'bg-stone-900 border-amber-500/60 shadow-lg p-3'
                      : 'bg-stone-900/60 hover:bg-stone-900/90 border-stone-800/80 hover:border-amber-500/30 p-3 cursor-pointer shadow-xs'
                  }`}
                >
                  {isEditing ? (
                    /* Inline Edit Mode */
                    <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        ref={editTextareaRef}
                        value={editingText}
                        onChange={(e) => {
                          setEditingText(e.target.value);
                          handleAutoGrow(e.target);
                        }}
                        onKeyDown={(e) => {
                          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                            e.preventDefault();
                            handleSaveEdit();
                          }
                          if (e.key === 'Escape') {
                            setEditingNoteId(null);
                          }
                        }}
                        className="w-full bg-stone-950/80 border border-stone-700/80 focus:border-amber-500/60 rounded-lg p-2 text-xs text-stone-200 focus:outline-none resize-none leading-relaxed select-text"
                      />
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-stone-500">
                          Ctrl+Enter to save · Esc to cancel
                        </span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setEditingNoteId(null)}
                            className="px-2 py-0.5 text-xs font-mono text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded transition-colors cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEdit}
                            className="flex items-center gap-1 px-2.5 py-0.5 text-xs font-mono font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 rounded transition-colors cursor-pointer"
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                            <span>Save</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Card View: Full Text Details */
                    <div>
                      {/* Note text content */}
                      <div className="text-xs text-stone-200 whitespace-pre-wrap select-text break-words leading-relaxed pr-8">
                        {note.text}
                      </div>

                      {/* Footer meta & actions */}
                      <div className="flex items-center justify-between pt-2 mt-2 border-t border-stone-800/40 text-[10px] font-mono text-stone-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 opacity-60" />
                          <span>{formatNoteDate(note.created_at)}</span>
                          {note.updated_at && (
                            <span className="opacity-60">(edited)</span>
                          )}
                        </div>

                        {/* Card Hover Action Buttons */}
                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => handleCopyNote(note.text, note.id, e)}
                            className="p-1 text-stone-500 hover:text-stone-200 hover:bg-stone-800 rounded transition-colors cursor-pointer"
                            title="Copy to clipboard"
                          >
                            {copiedId === note.id ? (
                              <CheckCheck className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>

                          {isDeleting ? (
                            <div
                              className="flex items-center gap-1 bg-rose-950/80 border border-rose-800/60 rounded px-1.5 py-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="text-[9px] text-rose-300">Delete?</span>
                              <button
                                type="button"
                                onClick={(e) => handleDeleteNote(note.id, e)}
                                className="text-[9px] text-rose-400 hover:text-rose-200 font-bold ml-1 cursor-pointer"
                              >
                                Yes
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingId(null);
                                }}
                                className="text-[9px] text-stone-400 hover:text-stone-200 ml-1 cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingId(note.id);
                              }}
                              className="p-1 text-stone-500 hover:text-rose-400 hover:bg-stone-800 rounded transition-colors cursor-pointer"
                              title="Delete note"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
