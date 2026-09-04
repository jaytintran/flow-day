/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { db } from '../../db';
import { Task, ViewMode } from '../../types';
import {
  StickyNote,
  X,
  Plus,
  GripVertical,
  Sparkles,
  Check,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export interface ScratchpadItem {
  id: string;
  text: string;
  isCompleted?: boolean;
  completedAt?: string;
  isConverted?: boolean;
  convertedTaskId?: string;
}

export interface Scratchpad {
  id: string;
  name: string;
  items: ScratchpadItem[];
  created_at: string;
}

interface DayScratchpadProps {
  activeDate: Date;
  viewMode?: ViewMode;
  isOpen?: boolean;
  onToggle?: () => void;
}

const STORAGE_PADS_KEY = 'flowday_scratchpad_pads_v1';
const STORAGE_ACTIVE_PAD_ID_KEY = 'flowday_scratchpad_active_id_v1';
const STORAGE_LEGACY_ITEMS_KEY = 'flowday_day_scratchpad_items_v1';
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

function createDefaultPad(): Scratchpad {
  return {
    id: 'default-inbox',
    name: 'Inbox',
    items: [],
    created_at: new Date().toISOString(),
  };
}

function loadSavedPads(): Scratchpad[] {
  try {
    const raw = localStorage.getItem(STORAGE_PADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }

    // Migration from legacy flat items if available
    const legacyRaw = localStorage.getItem(STORAGE_LEGACY_ITEMS_KEY);
    if (legacyRaw) {
      const legacyItems = JSON.parse(legacyRaw);
      if (Array.isArray(legacyItems) && legacyItems.length > 0) {
        const initialPad: Scratchpad = {
          id: 'default-inbox',
          name: 'Inbox',
          items: legacyItems,
          created_at: new Date().toISOString(),
        };
        savePads([initialPad]);
        return [initialPad];
      }
    }

    const initial = [createDefaultPad()];
    savePads(initial);
    return initial;
  } catch {
    return [createDefaultPad()];
  }
}

function savePads(pads: Scratchpad[]) {
  try {
    localStorage.setItem(STORAGE_PADS_KEY, JSON.stringify(pads));
  } catch {}
}

interface MobileScratchpadItemProps {
  item: ScratchpadItem;
  index: number;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
  onTextChange: (id: string, text: string, targetEl?: HTMLTextAreaElement) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, item: ScratchpadItem, index: number) => void;
  onToggleComplete: (item: ScratchpadItem) => void;
  onConvertToTask: (item: ScratchpadItem) => void;
  onDeleteItem: (id: string) => void;
}

function MobileScratchpadItem({
  item,
  index,
  textareaRef,
  onTextChange,
  onKeyDown,
  onToggleComplete,
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
      className="flex items-start gap-1.5 bg-[#1b1b1b] border border-stone-850/80 rounded-lg px-2.5 py-1.5 focus-within:border-amber-500/40 transition-colors"
    >
      <button
        type="button"
        onPointerDown={(e) => dragControls.start(e)}
        className="p-0.5 -ml-0.5 text-stone-600 active:text-amber-400 touch-none cursor-grab active:cursor-grabbing shrink-0 mt-0.5"
        title="Drag to reorder"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => onToggleComplete(item)}
        title="Mark as completed"
        className="w-3.5 h-3.5 rounded-full border border-stone-600 active:border-emerald-400 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors"
      >
        <Check className="w-2 h-2 text-transparent active:text-emerald-400" />
      </button>

      <textarea
        ref={textareaRef}
        rows={1}
        value={item.text}
        onChange={(e) => onTextChange(item.id, e.target.value, e.target)}
        onKeyDown={(e) => onKeyDown(e, item, index)}
        placeholder="Jot thought / task..."
        className={`flex-1 bg-transparent text-xs focus:outline-none placeholder-stone-600 resize-none overflow-hidden leading-normal ${
          item.isConverted ? 'text-stone-500' : 'text-stone-200'
        }`}
      />
      <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
        {!item.isConverted && item.text.trim() && (
          <button
            type="button"
            onClick={() => onConvertToTask(item)}
            title="Convert to Task for Today"
            className="p-1 text-stone-400 hover:text-amber-400 bg-stone-900/80 hover:bg-stone-850 border border-stone-800 rounded-md text-[9px] font-mono flex items-center gap-0.5"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Task</span>
          </button>
        )}
        <button
          type="button"
          onClick={() => onDeleteItem(item.id)}
          className="p-0.5 text-stone-500 hover:text-rose-400 rounded"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </Reorder.Item>
  );
}

export default function DayScratchpad({
  activeDate,
  viewMode,
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
}: DayScratchpadProps) {
  const [pads, setPads] = useState<Scratchpad[]>(loadSavedPads);
  const [activePadId, setActivePadId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_ACTIVE_PAD_ID_KEY);
      if (savedId) return savedId;
    } catch {}
    return 'default-inbox';
  });

  const [editingPadId, setEditingPadId] = useState<string | null>(null);
  const [editingPadName, setEditingPadName] = useState<string>('');

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
  const [deletingPadId, setDeletingPadId] = useState<string | null>(null);
  const [isCompletedOpen, setIsCompletedOpen] = useState<boolean>(false);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // Ensure valid active pad
  const currentPad = pads.find((p) => p.id === activePadId) || pads[0] || createDefaultPad();
  const items = currentPad.items;

  const activeItems = items.filter((i) => !i.isCompleted);
  const completedItems = items.filter((i) => i.isCompleted);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);

    const handleSyncUpdate = () => {
      const updatedPads = loadSavedPads();
      setPads(updatedPads);
    };
    window.addEventListener('scratchpad_sync_update', handleSyncUpdate);

    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('scratchpad_sync_update', handleSyncUpdate);
    };
  }, []);

  const handleSelectPad = (id: string) => {
    setActivePadId(id);
    try {
      localStorage.setItem(STORAGE_ACTIVE_PAD_ID_KEY, id);
    } catch {}
  };

  const handleCreateNewPad = () => {
    const newPad: Scratchpad = {
      id: crypto.randomUUID(),
      name: `Pad ${pads.length + 1}`,
      items: [],
      created_at: new Date().toISOString(),
    };
    const updated = [...pads, newPad];
    setPads(updated);
    savePads(updated);
    handleSelectPad(newPad.id);
  };

  const handleStartRenamePad = (pad: Scratchpad, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingPadId(pad.id);
    setEditingPadName(pad.name);
  };

  const handleSaveRenamePad = () => {
    if (!editingPadId) return;
    const finalName = editingPadName.trim() || 'Untitled';
    const updated = pads.map((p) => (p.id === editingPadId ? { ...p, name: finalName } : p));
    setPads(updated);
    savePads(updated);
    setEditingPadId(null);
  };

  const handleDeletePad = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (pads.length <= 1) return; // Keep at least one pad

    if (deletingPadId !== id) {
      setDeletingPadId(id);
      setTimeout(() => {
        setDeletingPadId((curr) => (curr === id ? null : curr));
      }, 3000);
      return;
    }

    setDeletingPadId(null);
    const updated = pads.filter((p) => p.id !== id);
    setPads(updated);
    savePads(updated);
    if (activePadId === id) {
      handleSelectPad(updated[0].id);
    }
  };

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
    const updatedPads = pads.map((p) =>
      p.id === currentPad.id ? { ...p, items: newItems } : p,
    );
    setPads(updatedPads);
    savePads(updatedPads);
  };

  const handleReorderActiveItems = (newActiveItems: ScratchpadItem[]) => {
    handleUpdateItems([...newActiveItems, ...completedItems]);
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
      isCompleted: false,
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
      const lastActiveIndex = items.reduce(
        (acc, curr, idx) => (!curr.isCompleted ? idx : acc),
        -1,
      );
      if (lastActiveIndex !== -1 && lastActiveIndex < items.length - 1) {
        updated = [
          ...items.slice(0, lastActiveIndex + 1),
          newItem,
          ...items.slice(lastActiveIndex + 1),
        ];
      } else {
        updated = [...items, newItem];
      }
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

  const handleToggleComplete = async (item: ScratchpadItem) => {
    const nextCompleted = !item.isCompleted;
    const updated = items.map((i) =>
      i.id === item.id
        ? {
            ...i,
            isCompleted: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
          }
        : i,
    );
    handleUpdateItems(updated);

    // If this item was converted to a database task, sync status with Dexie
    if (item.convertedTaskId) {
      try {
        await db.entries.update(item.convertedTaskId, {
          status: nextCompleted ? 'done' : 'todo',
          completed_at: nextCompleted ? new Date() : undefined,
        });
      } catch (e) {
        console.error('Failed to update converted task status in DB:', e);
      }
    }
  };

  const handleDeleteItem = (id: string) => {
    const updated = items.filter((item) => item.id !== id);
    handleUpdateItems(updated);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
    item: ScratchpadItem,
    indexInActive: number,
  ) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleToggleComplete(item);
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddItem(item.id);
    } else if (e.key === 'Backspace' && item.text === '') {
      e.preventDefault();
      handleDeleteItem(item.id);
      if (indexInActive > 0) {
        const prevId = activeItems[indexInActive - 1].id;
        setTimeout(() => {
          const el = textareaRefs.current.get(prevId);
          if (el) {
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
          }
        }, 50);
      }
    } else if (e.key === 'ArrowUp' && indexInActive > 0) {
      const target = e.currentTarget;
      if (target.selectionStart === 0 && target.selectionEnd === 0) {
        e.preventDefault();
        const prevId = activeItems[indexInActive - 1].id;
        textareaRefs.current.get(prevId)?.focus();
      }
    } else if (e.key === 'ArrowDown' && indexInActive < activeItems.length - 1) {
      const target = e.currentTarget;
      if (
        target.selectionStart === target.value.length &&
        target.selectionEnd === target.value.length
      ) {
        e.preventDefault();
        const nextId = activeItems[indexInActive + 1].id;
        textareaRefs.current.get(nextId)?.focus();
      }
    }
  };

  const handleConvertToTask = async (item: ScratchpadItem) => {
    if (!item.text.trim()) return;

    let scheduledDate: Date | undefined = undefined;
    if (viewMode === 'day') {
      scheduledDate = activeDate;
    } else if (viewMode === 'timeline') {
      scheduledDate = new Date();
    }

    const taskId = crypto.randomUUID();
    const newTask: Task = {
      id: taskId,
      type: 'task',
      title: item.text.trim(),
      status: item.isCompleted ? 'done' : 'todo',
      time_spent: 0,
      ...(scheduledDate ? { scheduled_at: scheduledDate } : {}),
      created_at: new Date(),
      ...(item.isCompleted ? { completed_at: new Date() } : {}),
    };

    await db.entries.add(newTask);

    const updated = items.map((i) =>
      i.id === item.id ? { ...i, isConverted: true, convertedTaskId: taskId } : i,
    );
    handleUpdateItems(updated);
  };

  const handleClearDone = () => {
    const updated = items.filter((item) => !item.isCompleted && !item.isConverted);
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

  const uncompletedCount = items.filter(
    (i) => !i.isCompleted && !i.isConverted && i.text.trim().length > 0,
  ).length;

  const hasDoneItems = items.some((i) => i.isCompleted || i.isConverted);

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
                className="relative w-full min-h-[60vh] max-h-[88vh] bg-[#141414] border-t border-stone-800 rounded-t-2xl shadow-2xl z-10 flex flex-col overflow-hidden pb-6"
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
                      {hasDoneItems && (
                        <button
                          type="button"
                          onClick={handleClearDone}
                          className="text-[10px] font-mono text-stone-400 hover:text-stone-200 px-2 py-1 bg-stone-900 border border-stone-800 rounded-md cursor-pointer"
                        >
                          Clear Done
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={toggleOpen}
                        className="p-1 text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-lg cursor-pointer"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Multi-Pad Tabs Row (Mobile) */}
                  <div className="w-full px-3 mt-2.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                    {pads.map((pad) => {
                      const isActive = pad.id === currentPad.id;
                      const activeItemCount = pad.items.filter(
                        (i) => !i.isCompleted && !i.isConverted && i.text.trim().length > 0,
                      ).length;
                      return (
                        <div
                          key={pad.id}
                          onClick={() => handleSelectPad(pad.id)}
                          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer shrink-0 border ${
                            isActive
                              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-bold'
                              : 'bg-stone-900/60 border-stone-850 text-stone-400 hover:text-stone-200'
                          }`}
                        >
                          {editingPadId === pad.id ? (
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                autoFocus
                                type="text"
                                value={editingPadName}
                                onChange={(e) => setEditingPadName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveRenamePad();
                                  if (e.key === 'Escape') setEditingPadId(null);
                                }}
                                onBlur={handleSaveRenamePad}
                                className="bg-stone-950 border border-amber-500/50 rounded px-1 text-xs text-amber-300 w-20 focus:outline-none"
                              />
                              <button onClick={handleSaveRenamePad} className="text-emerald-400 p-0.5">
                                <Check className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span
                                onClick={(e) => {
                                  if (isActive) {
                                    handleStartRenamePad(pad, e);
                                  }
                                }}
                                className="cursor-pointer select-none"
                                title="Click to rename"
                              >
                                {pad.name}
                              </span>
                              {activeItemCount > 0 && (
                                <span className="text-[9px] opacity-70 bg-stone-950/60 px-1 rounded-full">
                                  {activeItemCount}
                                </span>
                              )}
                              {pads.length > 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => handleDeletePad(pad.id, e)}
                                  className={`p-0.5 ml-0.5 rounded transition-colors cursor-pointer ${
                                    deletingPadId === pad.id
                                      ? 'bg-rose-950/90 text-rose-300 border border-rose-800 animate-pulse px-1'
                                      : 'text-stone-500 hover:text-rose-400'
                                  }`}
                                  title={deletingPadId === pad.id ? 'Click again to confirm delete' : 'Delete Pad'}
                                >
                                  {deletingPadId === pad.id ? (
                                    <span className="text-[9px] font-mono font-bold leading-none">Sure?</span>
                                  ) : (
                                    <X className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={handleCreateNewPad}
                      className="p-1 px-2 rounded-lg bg-stone-900 border border-stone-850 text-stone-400 hover:text-amber-400 flex items-center gap-1 text-xs shrink-0 cursor-pointer"
                      title="Create New Pad"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Mobile Items List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  <Reorder.Group
                    axis="y"
                    values={activeItems}
                    onReorder={handleReorderActiveItems}
                    className="space-y-1.5"
                  >
                    {activeItems.map((item, index) => (
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
                        onToggleComplete={handleToggleComplete}
                        onConvertToTask={handleConvertToTask}
                        onDeleteItem={handleDeleteItem}
                      />
                    ))}
                  </Reorder.Group>

                  <button
                    type="button"
                    onClick={() => handleAddItem()}
                    className="w-full py-2 px-2.5 border border-dashed border-stone-800 hover:border-amber-500/40 rounded-lg text-stone-400 hover:text-amber-400 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>

                  {/* Collapsible Completed Section (Mobile) */}
                  {completedItems.length > 0 && (
                    <div className="pt-2.5 border-t border-stone-850 mt-2.5">
                      <div className="flex items-center justify-between py-0.5 px-1">
                        <button
                          type="button"
                          onClick={() => setIsCompletedOpen((prev) => !prev)}
                          className="flex items-center gap-1.5 text-xs font-mono text-stone-400 hover:text-stone-200 cursor-pointer select-none"
                        >
                          {isCompletedOpen ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                          <span>Completed ({completedItems.length})</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleClearDone}
                          className="text-[9px] font-mono text-stone-500 hover:text-rose-400 px-1 py-0.5 rounded cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>

                      <AnimatePresence>
                        {isCompletedOpen && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-1 mt-1.5 overflow-hidden"
                          >
                            {completedItems.map((item) => (
                              <div
                                key={item.id}
                                className="flex items-start gap-1.5 bg-[#171717] border border-stone-850/60 rounded-lg px-2.5 py-1.5 opacity-75"
                              >
                                <button
                                  type="button"
                                  onClick={() => handleToggleComplete(item)}
                                  title="Mark as active"
                                  className="w-3.5 h-3.5 rounded-full border bg-emerald-500/20 border-emerald-500/60 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer"
                                >
                                  <Check className="w-2 h-2 stroke-[3]" />
                                </button>
                                <span className="flex-1 text-xs text-stone-500 select-text break-words py-0.5 leading-normal">
                                  {item.text}
                                </span>
                                <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                                  {item.isConverted && (
                                    <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/70 border border-amber-500/20">
                                      Task
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteItem(item.id)}
                                    className="p-0.5 text-stone-500 hover:text-rose-400 rounded cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
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
              className="fixed z-50 bottom-20 right-8 w-[420px] max-w-[90vw] max-h-[620px] bg-[#141414]/95 border border-stone-800 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden font-sans"
            >
              {/* Window Header (Drag Handle) */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#181818] border-b border-stone-850 cursor-grab active:cursor-grabbing select-none">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-stone-600" />
                  <StickyNote className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-serif font-bold text-stone-200">Scratchpad</h3>
                  <span className="text-[10px] font-mono text-stone-500 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                    {uncompletedCount} active
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {hasDoneItems && (
                    <button
                      type="button"
                      onClick={handleClearDone}
                      title="Remove completed/converted items"
                      className="text-[10px] font-mono text-stone-400 hover:text-stone-200 px-2 py-0.5 bg-stone-900 border border-stone-800 hover:bg-stone-850 rounded transition-colors cursor-pointer"
                    >
                      Clear Done
                    </button>
                  )}
                  {items.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAll}
                      title="Clear all items in this pad"
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

              {/* Multi-Pad Tabs Row (Desktop) */}
              <div className="flex items-center gap-1 px-3 py-1.5 bg-[#121212] border-b border-stone-850/70 overflow-x-auto no-scrollbar">
                {pads.map((pad) => {
                  const isActive = pad.id === currentPad.id;
                  const activeItemCount = pad.items.filter(
                    (i) => !i.isCompleted && !i.isConverted && i.text.trim().length > 0,
                  ).length;

                  return (
                    <div
                      key={pad.id}
                      onClick={() => handleSelectPad(pad.id)}
                      className={`group flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer shrink-0 border ${
                        isActive
                          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-bold shadow-sm'
                          : 'bg-stone-900/40 border-transparent text-stone-500 hover:text-stone-300 hover:bg-stone-900/80'
                      }`}
                    >
                      {editingPadId === pad.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <input
                            autoFocus
                            type="text"
                            value={editingPadName}
                            onChange={(e) => setEditingPadName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveRenamePad();
                              if (e.key === 'Escape') setEditingPadId(null);
                            }}
                            onBlur={handleSaveRenamePad}
                            className="bg-stone-950 border border-amber-500/50 rounded px-1.5 py-0.5 text-xs text-amber-300 w-24 focus:outline-none"
                          />
                          <button onClick={handleSaveRenamePad} className="text-emerald-400 p-0.5 cursor-pointer">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <span
                            onClick={(e) => {
                              if (isActive) {
                                handleStartRenamePad(pad, e);
                              }
                            }}
                            className="cursor-pointer select-none"
                            title="Click to rename"
                          >
                            {pad.name}
                          </span>
                          {activeItemCount > 0 && (
                            <span className="text-[9px] opacity-70 bg-stone-950/60 px-1 rounded-full">
                              {activeItemCount}
                            </span>
                          )}
                          {pads.length > 1 && (
                            <button
                              type="button"
                              onClick={(e) => handleDeletePad(pad.id, e)}
                              className={`p-0.5 ml-0.5 rounded transition-colors cursor-pointer ${
                                deletingPadId === pad.id
                                  ? 'bg-rose-950/90 text-rose-300 border border-rose-800 animate-pulse px-1'
                                  : 'text-stone-500 hover:text-rose-400'
                              }`}
                              title={deletingPadId === pad.id ? 'Click again to confirm delete' : 'Delete Pad'}
                            >
                              {deletingPadId === pad.id ? (
                                <span className="text-[9px] font-mono font-bold leading-none">Sure?</span>
                              ) : (
                                <X className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}

                <button
                  type="button"
                  onClick={handleCreateNewPad}
                  className="p-1 px-2 rounded-lg bg-stone-900/60 border border-stone-850/80 text-stone-500 hover:text-amber-400 hover:bg-stone-900 flex items-center gap-1 text-xs shrink-0 cursor-pointer transition-colors"
                  title="Create New Pad"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono">New</span>
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2 max-h-[460px]">
                {items.length === 0 ? (
                  <div className="py-8 text-center text-stone-600 text-xs font-mono flex flex-col items-center gap-2">
                    <StickyNote className="w-6 h-6 stroke-1 text-stone-700" />
                    <span>No scratch ideas in "{currentPad.name}".</span>
                    <span className="text-[10px] text-stone-700">
                      Jot down micro-tasks or thoughts freely.
                    </span>
                  </div>
                ) : (
                  <Reorder.Group
                    axis="y"
                    values={activeItems}
                    onReorder={handleReorderActiveItems}
                    className="space-y-1.5"
                  >
                    {activeItems.map((item, index) => (
                      <Reorder.Item
                        key={item.id}
                        value={item}
                        className="group flex items-start gap-1.5 bg-[#1b1b1b]/80 hover:bg-[#1f1f1f] border border-stone-850 rounded-lg px-2.5 py-1.5 focus-within:border-amber-500/40 focus-within:bg-[#202020] transition-colors"
                      >
                        <GripVertical className="w-3 h-3 text-stone-600 group-hover:text-stone-400 shrink-0 cursor-grab active:cursor-grabbing mt-0.5" />
                        
                        <button
                          type="button"
                          onClick={() => handleToggleComplete(item)}
                          title="Mark as completed (Ctrl+Enter)"
                          className="w-3.5 h-3.5 rounded-full border border-stone-600 hover:border-emerald-400 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors group/check"
                        >
                          <Check className="w-2 h-2 text-transparent group-hover/check:text-emerald-400/70" />
                        </button>

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
                          onKeyDown={(e) => handleKeyDown(e, item, index)}
                          placeholder="Jot idea / action..."
                          className={`flex-1 bg-transparent text-xs focus:outline-none placeholder-stone-600 resize-none overflow-hidden leading-normal ${
                            item.isConverted
                              ? 'text-stone-500'
                              : 'text-stone-200'
                          }`}
                        />
                        <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                          {!item.isConverted && item.text.trim() && (
                            <button
                              type="button"
                              onClick={() => handleConvertToTask(item)}
                              title="Convert to Task for Today"
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 px-1.5 text-stone-400 hover:text-amber-400 hover:bg-stone-800 border border-stone-800 rounded-md shrink-0 text-[9px] font-mono flex items-center gap-0.5 transition-opacity cursor-pointer"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                              <span>Task</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            title="Delete item"
                            className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 text-stone-500 hover:text-rose-400 rounded transition-opacity cursor-pointer shrink-0"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>
                )}

                <button
                  type="button"
                  onClick={() => handleAddItem()}
                  className="w-full py-1.5 px-2.5 border border-dashed border-stone-850 hover:border-amber-500/30 rounded-lg text-stone-500 hover:text-amber-400 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Add scratch item (or press Enter)
                </button>

                {/* Collapsible Completed Section (Desktop) */}
                {completedItems.length > 0 && (
                  <div className="pt-2 border-t border-stone-850/60 mt-2.5">
                    <div className="flex items-center justify-between py-0.5 px-1">
                      <button
                        type="button"
                        onClick={() => setIsCompletedOpen((prev) => !prev)}
                        className="flex items-center gap-1.5 text-xs font-mono text-stone-500 hover:text-stone-300 transition-colors cursor-pointer select-none"
                      >
                        {isCompletedOpen ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                        <span>Completed ({completedItems.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleClearDone}
                        className="text-[9px] font-mono text-stone-500 hover:text-rose-400 px-1 py-0.5 rounded transition-colors cursor-pointer"
                        title="Clear completed items"
                      >
                        Clear
                      </button>
                    </div>

                    <AnimatePresence>
                      {isCompletedOpen && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1 mt-1.5 overflow-hidden"
                        >
                          {completedItems.map((item) => (
                            <div
                              key={item.id}
                              className="group flex items-start gap-1.5 bg-stone-900/30 border border-stone-850/50 rounded-lg px-2.5 py-1.5 transition-colors opacity-75 hover:opacity-100"
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleComplete(item)}
                                title="Mark as active"
                                className="w-3.5 h-3.5 rounded-full border bg-emerald-500/20 border-emerald-500/60 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-all hover:bg-emerald-500/30"
                              >
                                <Check className="w-2 h-2 stroke-[3]" />
                              </button>
                              <span className="flex-1 text-xs text-stone-500 select-text break-words py-0.5 leading-normal">
                                {item.text}
                              </span>
                              <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
                                {item.isConverted && (
                                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/70 border border-amber-500/20">
                                    Task
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item.id)}
                                  title="Delete item"
                                  className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-0.5 text-stone-600 hover:text-rose-400 rounded transition-opacity cursor-pointer shrink-0"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Window Footer hint */}
              <div className="px-4 py-2 bg-[#121212] border-t border-stone-850/60 text-[10px] font-mono text-stone-500 flex justify-between items-center">
                <span>Enter = new line • Ctrl+Enter = complete</span>
                <span>Click tab title to rename</span>
              </div>
            </motion.div>
          ))}
      </AnimatePresence>
    </>
  );
}
