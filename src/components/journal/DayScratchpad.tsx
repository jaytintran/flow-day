/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { db } from '../../db';
import { Task } from '../../types';
import {
  StickyNote,
  X,
  Plus,
  GripVertical,
  Trash2,
  Sparkles,
} from 'lucide-react';

export interface ScratchpadItem {
  id: string;
  text: string;
  isConverted?: boolean;
  convertedTaskId?: string;
}

interface DayScratchpadProps {
  activeDate: Date;
  viewMode?: 'day' | 'timeline' | 'records' | 'lists' | 'hub';
  isOpen?: boolean;
  onToggle?: () => void;
}

const STORAGE_ITEMS_KEY = 'flowday_day_scratchpad_items_v1';
const STORAGE_OPEN_KEY = 'flowday_day_scratchpad_is_open';
const STORAGE_POS_KEY = 'flowday_day_scratchpad_pos_v1';

interface Position {
  x: number;
  y: number;
}

function loadSavedPosition(): Position {
  try {
    const raw = localStorage.getItem(STORAGE_POS_KEY);
    if (!raw) return { x: 0, y: 0 };
    const parsed = JSON.parse(raw);
    if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
      return parsed;
    }
    return { x: 0, y: 0 };
  } catch {
    return { x: 0, y: 0 };
  }
}

function savePosition(pos: Position) {
  try {
    localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(pos));
  } catch {}
}

interface MobileScratchpadItemProps {
  item: ScratchpadItem;
  index: number;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
  onTextChange: (id: string, text: string, targetEl?: HTMLTextAreaElement) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, id: string, index: number) => void;
  onConvertToTask: (item: ScratchpadItem) => void;
  onDeleteItem: (id: string) => void;
}

function MobileScratchpadItem({
  item,
  index,
  textareaRef,
  onTextChange,
  onKeyDown,
  onConvertToTask,
  onDeleteItem,
}: MobileScratchpadItemProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      key={item.id}
      value={item}
      dragListener={false}
      dragControls={dragControls}
      className="flex items-start gap-2 bg-[#1b1b1b] border border-stone-850/80 rounded-xl p-2.5 focus-within:border-amber-500/40 transition-colors"
    >
      <button
        type="button"
        onPointerDown={(e) => dragControls.start(e)}
        className="p-1 -ml-1 text-stone-600 active:text-amber-400 touch-none cursor-grab active:cursor-grabbing shrink-0 mt-0.5"
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <textarea
        ref={textareaRef}
        rows={1}
        value={item.text}
        onChange={(e) => onTextChange(item.id, e.target.value, e.target)}
        onKeyDown={(e) => onKeyDown(e, item.id, index)}
        placeholder="Jot thought / task..."
        className={`flex-1 bg-transparent text-sm focus:outline-none placeholder-stone-600 resize-none overflow-hidden leading-relaxed ${
          item.isConverted ? 'line-through text-stone-500 italic' : 'text-stone-200'
        }`}
      />
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        {!item.isConverted && item.text.trim() && (
          <button
            type="button"
            onClick={() => onConvertToTask(item)}
            title="Convert to Task for Today"
            className="p-1.5 text-stone-400 hover:text-amber-400 bg-stone-900/80 hover:bg-stone-850 border border-stone-800 rounded-lg text-[10px] font-mono flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            <span>Task</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onDeleteItem(item.id)}
          className="p-1 text-stone-500 hover:text-rose-400 rounded-lg"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </Reorder.Item>
  );
}

function loadSavedItems(): ScratchpadItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_ITEMS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveItems(items: ScratchpadItem[]) {
  try {
    localStorage.setItem(STORAGE_ITEMS_KEY, JSON.stringify(items));
  } catch {}
}

export default function DayScratchpad({
  activeDate,
  viewMode,
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
}: DayScratchpadProps) {
  const [items, setItems] = useState<ScratchpadItem[]>(loadSavedItems);
  const [position, setPosition] = useState<Position>(loadSavedPosition);
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_OPEN_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const [isMobile, setIsMobile] = useState<boolean>(false);
  const [isClearConfirming, setIsClearConfirming] = useState(false);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleSyncUpdate = () => {
      setItems(loadSavedItems());
    };
    window.addEventListener('scratchpad_sync_update', handleSyncUpdate);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('scratchpad_sync_update', handleSyncUpdate);
    };
  }, []);

  const toggleOpen = () => {
    if (controlledOnToggle) {
      controlledOnToggle();
    } else {
      setInternalIsOpen((prev) => {
        const next = !prev;
        try {
          localStorage.setItem(STORAGE_OPEN_KEY, String(next));
        } catch {}
        return next;
      });
    }
  };

  const handleUpdateItems = (newItems: ScratchpadItem[]) => {
    setItems(newItems);
    saveItems(newItems);
  };

  const handleTextChange = (id: string, text: string, targetEl?: HTMLTextAreaElement) => {
    if (targetEl) {
      targetEl.style.height = 'auto';
      targetEl.style.height = `${targetEl.scrollHeight}px`;
    }
    const updated = items.map((item) => (item.id === id ? { ...item, text } : item));
    handleUpdateItems(updated);
  };

  const handleAddItem = (afterId?: string) => {
    const newItem: ScratchpadItem = {
      id: crypto.randomUUID(),
      text: '',
    };

    let updated: ScratchpadItem[];
    if (afterId) {
      const index = items.findIndex((item) => item.id === afterId);
      if (index !== -1) {
        updated = [...items.slice(0, index + 1), newItem, ...items.slice(index + 1)];
      } else {
        updated = [...items, newItem];
      }
    } else {
      updated = [...items, newItem];
    }

    handleUpdateItems(updated);
    setTimeout(() => {
      const el = textareaRefs.current.get(newItem.id);
      if (el) {
        el.focus();
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
      }
    }, 50);
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter((item) => item.id !== id);
    handleUpdateItems(updated);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    id: string,
    index: number,
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddItem(id);
    } else if (e.key === 'Backspace' && items[index]?.text === '') {
      e.preventDefault();
      handleDeleteItem(id);
      if (index > 0) {
        const prevId = items[index - 1].id;
        setTimeout(() => {
          const el = textareaRefs.current.get(prevId);
          if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        }, 50);
      }
    } else if (e.key === 'ArrowUp' && index > 0) {
      const target = e.currentTarget;
      if (target.selectionStart === 0 && target.selectionEnd === 0) {
        e.preventDefault();
        const prevId = items[index - 1].id;
        textareaRefs.current.get(prevId)?.focus();
      }
    } else if (e.key === 'ArrowDown' && index < items.length - 1) {
      const target = e.currentTarget;
      if (
        target.selectionStart === target.value.length &&
        target.selectionEnd === target.value.length
      ) {
        e.preventDefault();
        const nextId = items[index + 1].id;
        textareaRefs.current.get(nextId)?.focus();
      }
    }
  };

  const handleConvertToTask = async (item: ScratchpadItem) => {
    if (!item.text.trim()) return;

    // Option A: Contextual scheduling based on current viewMode
    let scheduledDate: Date | undefined = undefined;
    if (viewMode === 'day') {
      scheduledDate = activeDate;
    } else if (viewMode === 'timeline') {
      scheduledDate = new Date();
    } // in 'lists', 'records', 'hub' -> undefined (dateless list task)

    const taskId = crypto.randomUUID();
    const newTask: Task = {
      id: taskId,
      type: 'task',
      title: item.text.trim(),
      status: 'todo',
      time_spent: 0,
      ...(scheduledDate ? { scheduled_at: scheduledDate } : {}),
      created_at: new Date(),
    };

    await db.entries.add(newTask);

    const updated = items.map((i) =>
      i.id === item.id ? { ...i, isConverted: true, convertedTaskId: taskId } : i,
    );
    handleUpdateItems(updated);
  };

  const handleClearConverted = () => {
    const updated = items.filter((item) => !item.isConverted);
    handleUpdateItems(updated);
  };

  const handleClearAll = () => {
    if (!isClearConfirming) {
      setIsClearConfirming(true);
      setTimeout(() => setIsClearConfirming(false), 3000);
      return;
    }
    setIsClearConfirming(false);
    handleUpdateItems([]);
  };

  const uncompletedCount = items.filter((i) => !i.isConverted && i.text.trim().length > 0).length;

  return (
    <>
      {/* SCRATCHPAD MODAL / WINDOW */}
      <AnimatePresence>
        {isOpen &&
          (isMobile ? (
            /* MOBILE DRAWER */
            <div className="fixed inset-0 z-50 flex items-end justify-center font-sans">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                onClick={toggleOpen}
                className="absolute inset-0 bg-black/70"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                drag="y"
                dragConstraints={{ top: 0 }}
                dragElastic={{ top: 0, bottom: 0.4 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 100 || info.velocity.y > 300) {
                    toggleOpen();
                  }
                }}
                transition={{ type: 'spring', damping: 30, stiffness: 320, mass: 0.7 }}
                className="relative w-full max-h-[85vh] bg-[#141414] border-t border-stone-800 rounded-t-2xl shadow-2xl z-10 flex flex-col overflow-hidden pb-6"
              >
                {/* Mobile Handle & Header */}
                <div className="flex-none flex flex-col items-center pt-3 pb-2 border-b border-stone-850">
                  <button
                    type="button"
                    onClick={toggleOpen}
                    className="p-2 -my-2 flex items-center justify-center cursor-pointer group"
                  >
                    <div className="w-12 h-1.5 bg-stone-700 group-hover:bg-stone-500 rounded-full transition-colors" />
                  </button>
                  <div className="w-full px-4 flex justify-between items-center mt-2">
                    <div className="flex items-center gap-2">
                      <StickyNote className="w-4 h-4 text-amber-500" />
                      <h3 className="text-sm font-serif font-bold text-stone-100">Scratchpad</h3>
                      <span className="text-[10px] font-mono text-stone-500">
                        {uncompletedCount} active
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {items.some((i) => i.isConverted) && (
                        <button
                          type="button"
                          onClick={handleClearConverted}
                          className="text-[10px] font-mono text-stone-400 hover:text-stone-200 px-2 py-1 bg-stone-900 border border-stone-800 rounded-md"
                        >
                          Clear Done
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={toggleOpen}
                        className="p-1 text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-lg"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Mobile Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  <Reorder.Group
                    axis="y"
                    values={items}
                    onReorder={handleUpdateItems}
                    className="space-y-2"
                  >
                    {items.map((item, index) => (
                      <MobileScratchpadItem
                        key={item.id}
                        item={item}
                        index={index}
                        textareaRef={(el) => {
                          if (el) {
                            textareaRefs.current.set(item.id, el);
                            el.style.height = 'auto';
                            el.style.height = `${el.scrollHeight}px`;
                          } else {
                            textareaRefs.current.delete(item.id);
                          }
                        }}
                        onTextChange={handleTextChange}
                        onKeyDown={handleKeyDown}
                        onConvertToTask={handleConvertToTask}
                        onDeleteItem={handleDeleteItem}
                      />
                    ))}
                  </Reorder.Group>

                  <button
                    type="button"
                    onClick={() => handleAddItem()}
                    className="w-full py-2.5 px-3 border border-dashed border-stone-800 hover:border-amber-500/40 rounded-xl text-stone-400 hover:text-amber-400 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-4 h-4" /> Add Item
                  </button>
                </div>
              </motion.div>
            </div>
          ) : (
            /* DESKTOP FLOATING DRAGGABLE WINDOW */
            <motion.div
              drag
              dragMomentum={false}
              onDragEnd={(_, info) => {
                const newPos = {
                  x: position.x + info.offset.x,
                  y: position.y + info.offset.y,
                };
                setPosition(newPos);
                savePosition(newPos);
              }}
              initial={{ opacity: 0, scale: 0.95, x: position.x, y: position.y + 15 }}
              animate={{ opacity: 1, scale: 1, x: position.x, y: position.y }}
              exit={{ opacity: 0, scale: 0.95, x: position.x, y: position.y + 15 }}
              transition={{ duration: 0.2 }}
              className="fixed z-50 bottom-20 right-8 w-[480px] max-w-[90vw] max-h-[600px] bg-[#141414]/95 border border-stone-800 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden font-sans"
            >
              {/* Window Header (Drag Handle) */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#181818] border-b border-stone-850 cursor-grab active:cursor-grabbing select-none">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-stone-600" />
                  <StickyNote className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-serif font-bold text-stone-200">Scratchpad</h3>
                  <span className="text-[10px] font-mono text-stone-500 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                    {uncompletedCount} active
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {items.some((i) => i.isConverted) && (
                    <button
                      type="button"
                      onClick={handleClearConverted}
                      title="Remove converted items"
                      className="text-[10px] font-mono text-stone-400 hover:text-stone-200 px-2 py-0.5 bg-stone-900 border border-stone-800 hover:bg-stone-850 rounded transition-colors cursor-pointer"
                    >
                      Clear Done
                    </button>
                  )}
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      title="Clear all items"
                      className={`text-[10px] font-mono px-2 py-0.5 border rounded transition-colors cursor-pointer ${
                        isClearConfirming
                          ? 'bg-red-950/80 border-red-800 text-red-400 animate-pulse'
                          : 'text-stone-500 hover:text-red-400 bg-stone-900 border-stone-800'
                      }`}
                    >
                      {isClearConfirming ? 'Sure?' : 'Clear'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={toggleOpen}
                    title="Close"
                    className="p-1 text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer ml-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2 max-h-[460px]">
                {items.length === 0 ? (
                  <div className="py-8 text-center text-stone-600 text-xs font-mono flex flex-col items-center gap-2">
                    <StickyNote className="w-6 h-6 stroke-1 text-stone-700" />
                    <span>No scratch ideas yet.</span>
                    <span className="text-[10px] text-stone-700">
                      Jot down micro-tasks or thoughts freely.
                    </span>
                  </div>
                ) : (
                  <Reorder.Group
                    axis="y"
                    values={items}
                    onReorder={handleUpdateItems}
                    className="space-y-2"
                  >
                    {items.map((item, index) => (
                      <Reorder.Item
                        key={item.id}
                        value={item}
                        className="group flex items-start gap-2 bg-[#1b1b1b]/80 hover:bg-[#1f1f1f] border border-stone-850 rounded-xl px-3 py-2 focus-within:border-amber-500/40 focus-within:bg-[#202020] transition-colors"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-stone-600 group-hover:text-stone-400 shrink-0 cursor-grab active:cursor-grabbing mt-1" />
                        <textarea
                          ref={(el) => {
                            if (el) {
                              textareaRefs.current.set(item.id, el);
                              el.style.height = 'auto';
                              el.style.height = `${el.scrollHeight}px`;
                            } else {
                              textareaRefs.current.delete(item.id);
                            }
                          }}
                          rows={1}
                          value={item.text}
                          onChange={(e) => handleTextChange(item.id, e.target.value, e.target)}
                          onKeyDown={(e) => handleKeyDown(e, item.id, index)}
                          placeholder="Jot idea / action..."
                          className={`flex-1 bg-transparent text-xs sm:text-sm focus:outline-none placeholder-stone-600 resize-none overflow-hidden leading-relaxed ${
                            item.isConverted
                              ? 'line-through text-stone-500 italic'
                              : 'text-stone-200'
                          }`}
                        />
                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                          {!item.isConverted && item.text.trim() && (
                            <button
                              type="button"
                              onClick={() => handleConvertToTask(item)}
                              title="Convert to Task for Today"
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-stone-400 hover:text-amber-400 hover:bg-stone-800 border border-stone-800 rounded-md shrink-0 text-[10px] font-mono flex items-center gap-1 transition-opacity cursor-pointer"
                            >
                              <Sparkles className="w-3 h-3 text-amber-500" />
                              <span>Task</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            title="Delete item"
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 text-stone-500 hover:text-rose-400 rounded transition-opacity cursor-pointer shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                )}

                <button
                  type="button"
                  onClick={() => handleAddItem()}
                  className="w-full py-2.5 px-3 border border-dashed border-stone-850 hover:border-amber-500/30 rounded-xl text-stone-500 hover:text-amber-400 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add scratch item (or press Enter)
                </button>
              </div>

              {/* Window Footer hint */}
              <div className="px-4 py-2 bg-[#121212] border-t border-stone-850/60 text-[10px] font-mono text-stone-500 flex justify-between items-center">
                <span>Enter = new line</span>
                <span>Drag header to move</span>
              </div>
            </motion.div>
          ))}
      </AnimatePresence>
    </>
  );
}
