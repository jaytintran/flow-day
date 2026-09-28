/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'motion/react';
import { db } from '../../db';
import { Task, Log, ViewMode } from '../../types';
import {
  StickyNote,
  X,
  Plus,
  GripVertical,
  Sparkles,
  Check,
  ChevronDown,
  ChevronRight,
  Trash2,
  CalendarDays,
  RotateCcw,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScratchpadItem {
  id: string;
  text: string;
  isCompleted?: boolean;
  completedAt?: string;
  /** The date string (YYYY-MM-DD) of the day the item was active/created */
  dateKey?: string;
  isConverted?: boolean;
  convertedTaskId?: string;
  completedLogId?: string;
}

export interface Scratchpad {
  id: string;
  name: string;
  items: ScratchpadItem[];
  created_at: string;
}

/** The special daily-capped tab data, kept separate from free-form pads */
export interface TodayPadData {
  /** name is user-renameable */
  name: string;
  /** All items ever added — active and completed, across all dates */
  items: ScratchpadItem[];
}

interface DayScratchpadProps {
  activeDate: Date;
  viewMode?: ViewMode;
  isOpen?: boolean;
  onToggle?: () => void;
}

// ─── Constants & storage ────────────────────────────────────────────────────

const STORAGE_PADS_KEY = 'flowday_scratchpad_pads_v1';
const STORAGE_ACTIVE_PAD_ID_KEY = 'flowday_scratchpad_active_id_v1';
const STORAGE_LEGACY_ITEMS_KEY = 'flowday_day_scratchpad_items_v1';
const STORAGE_OPEN_KEY = 'flowday_day_scratchpad_is_open';
const STORAGE_POS_KEY = 'flowday_day_scratchpad_pos_v1';
const STORAGE_TODAY_PAD_KEY = 'flowday_today_pad_v1';
const TODAY_PAD_ID = '__today__';
const TODAY_PAD_MAX_ITEMS = 5;

interface Position { x: number; y: number; }

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDateKey(key: string): string {
  try {
    const d = new Date(key + 'T00:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return key; }
}

function loadSavedPosition(): Position {
  try {
    const raw = localStorage.getItem(STORAGE_POS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { x: 0, y: 0 };
}

function savePosition(pos: Position) {
  try { localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(pos)); } catch {}
}

function createDefaultPad(): Scratchpad {
  return { id: 'default-inbox', name: 'Main', items: [], created_at: new Date().toISOString() };
}

function loadSavedPads(): Scratchpad[] {
  try {
    const raw = localStorage.getItem(STORAGE_PADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Scratchpad[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
    const legacyRaw = localStorage.getItem(STORAGE_LEGACY_ITEMS_KEY);
    if (legacyRaw) {
      const legacyItems = JSON.parse(legacyRaw) as ScratchpadItem[];
      if (Array.isArray(legacyItems) && legacyItems.length > 0) {
        const initialPad: Scratchpad = { id: 'default-inbox', name: 'Main', items: legacyItems, created_at: new Date().toISOString() };
        savePads([initialPad]);
        return [initialPad];
      }
    }
  } catch {}
  const defaultPad = createDefaultPad();
  savePads([defaultPad]);
  return [defaultPad];
}

function savePads(pads: Scratchpad[]) {
  try {
    localStorage.setItem(STORAGE_PADS_KEY, JSON.stringify(pads));
    window.dispatchEvent(new CustomEvent('scratchpad_sync_update'));
  } catch {}
}

function loadTodayPad(): TodayPadData {
  try {
    const raw = localStorage.getItem(STORAGE_TODAY_PAD_KEY);
    if (raw) return JSON.parse(raw) as TodayPadData;
  } catch {}
  return { name: 'Today', items: [] };
}

function saveTodayPad(data: TodayPadData) {
  try {
    localStorage.setItem(STORAGE_TODAY_PAD_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent('scratchpad_sync_update'));
  } catch {}
}

// ─── PadTab component ────────────────────────────────────────────────────────

interface PadTabProps {
  pad: Scratchpad | { id: string; name: string; items: ScratchpadItem[] };
  isActive: boolean;
  isDragTarget?: boolean;
  editingPadId: string | null;
  editingPadName: string;
  onSelect: (id: string) => void;
  onStartRename: (padId: string, name: string, e?: React.MouseEvent) => void;
  onRenameChange: (val: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  isMobile?: boolean;
  /** If true, renders as a plain div (not Reorder.Item) — for the pinned Today tab */
  pinned?: boolean;
  badge?: React.ReactNode;
}

function PadTab({
  pad,
  isActive,
  isDragTarget,
  editingPadId,
  editingPadName,
  onSelect,
  onStartRename,
  onRenameChange,
  onSaveRename,
  onCancelRename,
  isMobile,
  pinned,
  badge,
}: PadTabProps) {
  const isEditing = editingPadId === pad.id;

  const className = `group flex items-center h-7 gap-1.5 ${
    isMobile ? 'px-3' : 'px-2.5'
  } rounded-lg text-xs font-mono transition-colors cursor-pointer shrink-0 border select-none ${
    isDragTarget
      ? 'bg-amber-500/30 border-amber-400 text-amber-300 ring-2 ring-amber-500/60 shadow-md font-bold'
      : isActive
      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-bold shadow-xs'
      : isMobile
      ? 'bg-stone-900/60 border-stone-850 text-stone-400 hover:text-stone-200'
      : 'bg-stone-900/40 border-stone-850/50 text-stone-500 hover:text-stone-300 hover:bg-stone-900/80'
  }`;

  const inner = isEditing ? (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <input
        autoFocus
        type="text"
        value={editingPadName}
        onChange={(e) => onRenameChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSaveRename();
          if (e.key === 'Escape') onCancelRename();
        }}
        onBlur={onSaveRename}
        className={`bg-stone-950 border border-amber-500/50 rounded px-1.5 py-0.5 text-xs text-amber-300 ${
          isMobile ? 'w-20' : 'w-24'
        } focus:outline-none`}
      />
      <button onClick={onSaveRename} className="text-emerald-400 p-0.5 cursor-pointer">
        <Check className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : (
    <>
      <span
        onClick={(e) => { if (isActive) onStartRename(pad.id, pad.name, e); }}
        className="cursor-pointer select-none truncate max-w-[110px]"
        title={pinned ? 'Click to rename, always stays first' : 'Click to rename, drag to reorder'}
      >
        {pad.name}
      </span>
      {badge}
    </>
  );

  if (pinned) {
    return (
      <div
        data-pad-id={pad.id}
        onClick={() => { if (!isEditing) onSelect(pad.id); }}
        className={className}
      >
        {inner}
      </div>
    );
  }

  return (
    <Reorder.Item
      key={pad.id}
      value={pad}
      as="div"
      data-pad-id={pad.id}
      dragListener={!isEditing}
      whileDrag={{ zIndex: 50, cursor: 'grabbing', opacity: 0.85 }}
      transition={{ duration: 0.15 }}
      onClick={() => { if (!isEditing) onSelect(pad.id); }}
      className={className}
    >
      {inner}
    </Reorder.Item>
  );
}

// ─── MobileScratchpadItem ────────────────────────────────────────────────────

interface MobileScratchpadItemProps {
  item: ScratchpadItem;
  index: number;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
  onTextChange: (id: string, text: string, targetEl?: HTMLTextAreaElement) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>, item: ScratchpadItem, index: number) => void;
  onToggleComplete: (item: ScratchpadItem) => void;
  onConvertToTask: (item: ScratchpadItem) => void;
  onDeleteItem: (id: string) => void;
  onDrag?: (e: any, info: { point: { x: number; y: number } }) => void;
  onDragEnd?: (item: ScratchpadItem, e: any, info: { point: { x: number; y: number } }) => void;
}

function MobileScratchpadItem({
  item, index, textareaRef, onTextChange, onKeyDown,
  onToggleComplete, onConvertToTask, onDeleteItem, onDrag, onDragEnd,
}: MobileScratchpadItemProps) {
  const dragControls = useDragControls();
  return (
    <Reorder.Item
      key={item.id} value={item} as="div" layout="position"
      dragListener={false} dragControls={dragControls}
      onDrag={onDrag}
      onDragEnd={(e, info) => onDragEnd?.(item, e, info)}
      transition={{ layout: { duration: 0.15 } }}
      className="flex items-start gap-1.5 bg-[#1b1b1b] border border-stone-850/80 rounded-lg px-2.5 py-1.5 focus-within:border-amber-500/40 transition-colors"
    >
      <button type="button" onPointerDown={(e) => dragControls.start(e)}
        className="p-0.5 -ml-0.5 text-stone-600 active:text-amber-400 touch-none cursor-grab active:cursor-grabbing shrink-0 mt-0.5">
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <button type="button" onClick={() => onToggleComplete(item)}
        className="w-3.5 h-3.5 rounded-full border border-stone-600 active:border-emerald-400 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors">
        <Check className="w-2 h-2 text-transparent active:text-emerald-400" />
      </button>
      <textarea ref={textareaRef} rows={1} value={item.text}
        onChange={(e) => onTextChange(item.id, e.target.value, e.target)}
        onKeyDown={(e) => onKeyDown(e, item, index)}
        placeholder="Jot thought / task..."
        className={`flex-1 bg-transparent text-xs focus:outline-none placeholder-stone-600 resize-none overflow-hidden leading-normal ${item.isConverted ? 'text-stone-500' : 'text-stone-200'}`}
      />
      <div className="flex items-center gap-0.5 shrink-0 mt-0.5">
        {!item.isConverted && item.text.trim() && (
          <button type="button" onClick={() => onConvertToTask(item)}
            className="p-1 text-stone-400 hover:text-amber-400 bg-stone-900/80 hover:bg-stone-850 border border-stone-800 rounded-md text-[9px] font-mono flex items-center gap-0.5">
            <Sparkles className="w-3 h-3 text-amber-500" /><span>Task</span>
          </button>
        )}
        <button type="button" onClick={() => onDeleteItem(item.id)}
          className="p-0.5 text-stone-500 hover:text-rose-400 rounded">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </Reorder.Item>
  );
}

// ─── TodayPad sub-component ──────────────────────────────────────────────────

interface TodayPadProps {
  todayPad: TodayPadData;
  onUpdate: (data: TodayPadData) => void;
  viewMode?: ViewMode;
  activeDate: Date;
}

function TodayPad({ todayPad, onUpdate, viewMode, activeDate }: TodayPadProps) {
  const today = todayDateKey();
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  // Items that are active today (not completed, dateKey = today or no dateKey)
  const todayActiveItems = todayPad.items.filter(
    (i) => !i.isCompleted && (i.dateKey === today || !i.dateKey),
  );

  // Completed items grouped by dateKey, sorted newest first
  const completedByDate = todayPad.items
    .filter((i) => i.isCompleted)
    .reduce<Record<string, ScratchpadItem[]>>((acc, item) => {
      const dk = item.dateKey || today;
      if (!acc[dk]) acc[dk] = [];
      acc[dk].push(item);
      return acc;
    }, {});
  const sortedDateKeys = Object.keys(completedByDate).sort((a, b) => (a > b ? -1 : 1));

  // Roll-over: uncompleted items from previous days
  const rolloverItems = todayPad.items.filter(
    (i) => !i.isCompleted && i.dateKey && i.dateKey !== today,
  );

  const [openDates, setOpenDates] = useState<Set<string>>(
    () => new Set(sortedDateKeys.slice(0, 1)),
  );
  const [rolledOverDismissed, setRolledOverDismissed] = useState(false);

  const slotsUsed = todayActiveItems.length;
  const slotsLeft = TODAY_PAD_MAX_ITEMS - slotsUsed;
  const isFull = slotsLeft <= 0;

  const updateItems = (newItems: ScratchpadItem[]) => {
    onUpdate({ ...todayPad, items: newItems });
  };

  const handleAddTodayItem = () => {
    if (isFull) return;
    const newItem: ScratchpadItem = {
      id: crypto.randomUUID(),
      text: '',
      isCompleted: false,
      dateKey: today,
    };
    // Insert before completed items
    const nonCompleted = todayPad.items.filter((i) => !i.isCompleted);
    const completed = todayPad.items.filter((i) => i.isCompleted);
    updateItems([...nonCompleted, newItem, ...completed]);
    setTimeout(() => {
      const el = textareaRefs.current.get(newItem.id);
      if (el) { el.focus(); el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
    }, 50);
  };

  const handleTextChange = (id: string, text: string, targetEl?: HTMLTextAreaElement) => {
    if (targetEl) { targetEl.style.height = 'auto'; targetEl.style.height = `${targetEl.scrollHeight}px`; }
    updateItems(todayPad.items.map((i) => (i.id === id ? { ...i, text } : i)));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, item: ScratchpadItem, idx: number) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleToggleComplete(item);
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isFull) handleAddTodayItem();
      return;
    }
    if (e.key === 'Backspace' && item.text === '') {
      e.preventDefault();
      updateItems(todayPad.items.filter((i) => i.id !== item.id));
      if (idx > 0) {
        const prevId = todayActiveItems[idx - 1].id;
        setTimeout(() => { const el = textareaRefs.current.get(prevId); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 50);
      }
    }
  };

  const handleToggleComplete = async (item: ScratchpadItem) => {
    const nextCompleted = !item.isCompleted;
    let logId = item.completedLogId;

    if (nextCompleted && !item.convertedTaskId && item.text.trim()) {
      try {
        logId = crypto.randomUUID();
        const now = new Date();
        const newLog: Log = { id: logId!, type: 'log', title: item.text.trim(), timestamp: now, created_at: now };
        await db.entries.add(newLog);
      } catch {}
    } else if (!nextCompleted && item.completedLogId) {
      try { await db.entries.delete(item.completedLogId); logId = undefined; } catch {}
    }

    updateItems(todayPad.items.map((i) =>
      i.id === item.id
        ? { ...i, isCompleted: nextCompleted, completedAt: nextCompleted ? new Date().toISOString() : undefined, completedLogId: nextCompleted ? logId : undefined }
        : i,
    ));

    if (item.convertedTaskId) {
      try {
        await db.entries.update(item.convertedTaskId, { status: nextCompleted ? 'done' : 'todo', completed_at: nextCompleted ? new Date() : undefined } as any);
      } catch {}
    }
  };

  const handleDeleteItem = (id: string) => {
    updateItems(todayPad.items.filter((i) => i.id !== id));
  };

  const handleDeleteFromTimeline = async (item: ScratchpadItem) => {
    if (item.convertedTaskId) { try { await db.entries.delete(item.convertedTaskId); } catch {} }
    if (item.completedLogId) { try { await db.entries.delete(item.completedLogId); } catch {} }
    updateItems(todayPad.items.filter((i) => i.id !== item.id));
  };

  const handleConvertToTask = async (item: ScratchpadItem) => {
    if (!item.text.trim()) return;
    let scheduledDate: Date | undefined;
    if (viewMode === 'day') scheduledDate = activeDate;
    else if (viewMode === 'timeline') scheduledDate = new Date();
    const taskId = crypto.randomUUID();
    const newTask: Task = {
      id: taskId, type: 'task', title: item.text.trim(),
      status: item.isCompleted ? 'done' : 'todo', time_spent: 0,
      ...(scheduledDate ? { scheduled_at: scheduledDate } : {}),
      created_at: new Date(),
      ...(item.isCompleted ? { completed_at: new Date() } : {}),
    };
    await db.entries.add(newTask);
    updateItems(todayPad.items.map((i) => i.id === item.id ? { ...i, isConverted: true, convertedTaskId: taskId } : i));
  };

  const handleReorderActive = (newActive: ScratchpadItem[]) => {
    const completed = todayPad.items.filter((i) => i.isCompleted);
    updateItems([...newActive, ...completed]);
  };

  const handleRollOver = () => {
    const updated = todayPad.items.map((i) =>
      (!i.isCompleted && i.dateKey && i.dateKey !== today) ? { ...i, dateKey: today } : i,
    );
    onUpdate({ ...todayPad, items: updated });
    setRolledOverDismissed(true);
  };

  const handleDismissRollover = () => {
    setRolledOverDismissed(true);
  };

  const handleClearDay = (dk: string) => {
    updateItems(todayPad.items.filter((i) => !(i.isCompleted && (i.dateKey || today) === dk)));
  };

  const handleDeleteDayFromTimeline = async (dk: string) => {
    const dayItems = (completedByDate[dk] || []);
    for (const item of dayItems) {
      if (item.convertedTaskId) { try { await db.entries.delete(item.convertedTaskId); } catch {} }
      if (item.completedLogId) { try { await db.entries.delete(item.completedLogId); } catch {} }
    }
    updateItems(todayPad.items.filter((i) => !(i.isCompleted && (i.dateKey || today) === dk)));
  };

  const toggleDate = (dk: string) => {
    setOpenDates((prev) => {
      const next = new Set(prev);
      if (next.has(dk)) next.delete(dk); else next.add(dk);
      return next;
    });
  };

  const dragControls = useDragControls();

  return (
    <div className="flex flex-col gap-2">

      {/* Slot progress bar */}
      <div className="flex items-center gap-2 px-0.5">
        <div className="flex gap-1">
          {Array.from({ length: TODAY_PAD_MAX_ITEMS }).map((_, i) => (
            <div
              key={i}
              className={`h-1 w-5 rounded-full transition-colors ${
                i < slotsUsed ? 'bg-amber-500/70' : 'bg-stone-800'
              }`}
            />
          ))}
        </div>
        <span className="text-[9px] font-mono text-stone-500">
          {slotsUsed}/{TODAY_PAD_MAX_ITEMS} today
        </span>
      </div>

      {/* Roll-over banner */}
      <AnimatePresence>
        {rolloverItems.length > 0 && !rolledOverDismissed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex items-center justify-between gap-2 bg-amber-950/40 border border-amber-800/50 rounded-lg px-2.5 py-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                <span className="text-[10px] font-mono text-amber-400 truncate">
                  {rolloverItems.length} item{rolloverItems.length > 1 ? 's' : ''} unfinished from a previous day
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleRollOver}
                  className="flex items-center gap-1 text-[9px] font-mono font-bold text-amber-300 bg-amber-900/60 hover:bg-amber-900 border border-amber-700/60 rounded px-1.5 py-0.5 cursor-pointer transition-colors"
                >
                  <RotateCcw className="w-2.5 h-2.5" /> Roll over
                </button>
                <button
                  type="button"
                  onClick={handleDismissRollover}
                  className="text-stone-500 hover:text-stone-300 p-0.5 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active items */}
      {todayActiveItems.length === 0 && !isFull ? (
        <div className="py-4 text-center text-stone-600 text-[10px] font-mono flex flex-col items-center gap-1">
          <CalendarDays className="w-5 h-5 text-stone-700" />
          <span>Up to 5 intentions for today.</span>
        </div>
      ) : (
        <Reorder.Group
          as="div"
          axis="y"
          values={todayActiveItems}
          onReorder={handleReorderActive}
          className="space-y-1.5"
        >
          {todayActiveItems.map((item, index) => (
            <Reorder.Item
              key={item.id}
              value={item}
              as="div"
              layout="position"
              transition={{ layout: { duration: 0.15 } }}
              className="group relative flex items-start gap-1.5 bg-[#1b1b1b]/80 hover:bg-[#1f1f1f] border border-stone-850 rounded-lg px-2.5 py-1.5 focus-within:border-amber-500/40 focus-within:bg-[#202020] transition-colors"
            >
              <GripVertical className="w-3 h-3 text-stone-600 group-hover:text-stone-400 shrink-0 cursor-grab active:cursor-grabbing mt-0.5" />
              <button
                type="button"
                onClick={() => handleToggleComplete(item)}
                className="w-3.5 h-3.5 rounded-full border border-stone-600 hover:border-emerald-400 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors group/check"
              >
                <Check className="w-2 h-2 text-transparent group-hover/check:text-emerald-400/70" />
              </button>
              <textarea
                ref={(el) => {
                  if (el) { textareaRefs.current.set(item.id, el); el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
                  else textareaRefs.current.delete(item.id);
                }}
                rows={1}
                value={item.text}
                onChange={(e) => handleTextChange(item.id, e.target.value, e.target)}
                onKeyDown={(e) => handleKeyDown(e, item, index)}
                placeholder="Intention for today..."
                className={`flex-1 w-full min-w-0 bg-transparent text-xs focus:outline-none placeholder-stone-600 resize-none overflow-hidden leading-normal pr-1 ${item.isConverted ? 'text-stone-500' : 'text-stone-200'}`}
              />
              <div className="absolute right-1.5 top-1 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto focus-within:pointer-events-auto bg-[#1b1b1b] group-hover:bg-[#1f1f1f] pl-1.5 py-0.5 rounded-md">
                {!item.isConverted && item.text.trim() && (
                  <button type="button" onClick={() => handleConvertToTask(item)}
                    className="p-0.5 px-1.5 text-stone-400 hover:text-amber-400 bg-stone-900 hover:bg-stone-850 border border-stone-800 rounded-md shrink-0 text-[9px] font-mono flex items-center gap-0.5 transition-colors cursor-pointer">
                    <Sparkles className="w-2.5 h-2.5 text-amber-500" /><span>Task</span>
                  </button>
                )}
                <button type="button" onClick={() => handleDeleteItem(item.id)}
                  className="p-0.5 text-stone-500 hover:text-rose-400 bg-stone-900 hover:bg-stone-850 border border-stone-800 rounded-md transition-colors cursor-pointer shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      {/* Add button or full message */}
      {isFull ? (
        <div className="flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg border border-stone-850/50 bg-stone-900/20 text-[9px] font-mono text-stone-600">
          <AlertTriangle className="w-3 h-3 text-stone-700" />
          All 5 slots filled — complete one to add more.
        </div>
      ) : (
        <button
          type="button"
          onClick={handleAddTodayItem}
          className="w-full py-1.5 px-2.5 border border-dashed border-stone-850 hover:border-amber-500/30 rounded-lg text-stone-500 hover:text-amber-400 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" /> Add intention ({slotsLeft} left)
        </button>
      )}

      {/* Completed history grouped by date */}
      {sortedDateKeys.length > 0 && (
        <div className="mt-1 space-y-1">
          <div className="flex items-center gap-1.5 px-0.5 pt-1 border-t border-stone-850/60">
            <CalendarDays className="w-3 h-3 text-stone-600" />
            <span className="text-[9px] font-mono text-stone-600 uppercase tracking-wide">History</span>
          </div>
          {sortedDateKeys.map((dk) => {
            const dayItems = completedByDate[dk];
            const isOpen = openDates.has(dk);
            return (
              <div key={dk} className="rounded-lg border border-stone-850/50 bg-stone-900/20 overflow-hidden">
                {/* Date header */}
                <div className="flex items-center justify-between px-2.5 py-1.5">
                  <button
                    type="button"
                    onClick={() => toggleDate(dk)}
                    className="flex items-center gap-1.5 text-[10px] font-mono text-stone-400 hover:text-stone-200 cursor-pointer select-none"
                  >
                    {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    <span>{formatDateKey(dk)}</span>
                    <span className="text-[9px] bg-stone-800 text-stone-500 px-1.5 rounded-full">
                      {dayItems.length}
                    </span>
                  </button>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleClearDay(dk)}
                      className="text-[9px] font-mono text-stone-500 hover:text-stone-300 px-1.5 py-0.5 rounded hover:bg-stone-800 cursor-pointer transition-colors"
                      title="Remove from pad"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteDayFromTimeline(dk)}
                      className="text-[9px] font-mono text-stone-600 hover:text-rose-400 px-1.5 py-0.5 rounded hover:bg-stone-800/60 cursor-pointer transition-colors flex items-center gap-0.5"
                      title="Remove from pad + delete from timeline"
                    >
                      <Trash2 className="w-2.5 h-2.5" /> Delete
                    </button>
                  </div>
                </div>

                {/* Items */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-px pb-1.5 px-1">
                        {dayItems.map((item) => (
                          <div
                            key={item.id}
                            className="group flex items-start gap-1.5 px-2 py-1.5 rounded-lg hover:bg-stone-900/40 transition-colors"
                          >
                            <div className="w-3 h-3 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                              <Check className="w-2 h-2 stroke-[3]" />
                            </div>
                            <span className="flex-1 text-xs text-stone-500 select-text break-words leading-normal pr-1">
                              {item.text}
                            </span>
                            <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              {item.isConverted && (
                                <span className="text-[8px] font-mono px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/70 border border-amber-500/20">
                                  Task
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleDeleteItem(item.id)}
                                className="p-0.5 text-stone-600 hover:text-stone-300 cursor-pointer rounded"
                                title="Remove from pad"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              {(item.convertedTaskId || item.completedLogId) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFromTimeline(item)}
                                  className="p-0.5 text-stone-600 hover:text-rose-400 cursor-pointer rounded"
                                  title="Remove from pad + delete from timeline"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main DayScratchpad component ────────────────────────────────────────────

export default function DayScratchpad({
  activeDate,
  viewMode,
  isOpen: controlledIsOpen,
  onToggle: controlledOnToggle,
}: DayScratchpadProps) {
  const [pads, setPads] = useState<Scratchpad[]>(loadSavedPads);
  const [todayPad, setTodayPad] = useState<TodayPadData>(loadTodayPad);

  const [activePadId, setActivePadId] = useState<string>(() => {
    try {
      const savedId = localStorage.getItem(STORAGE_ACTIVE_PAD_ID_KEY);
      if (savedId) return savedId;
    } catch {}
    return TODAY_PAD_ID;
  });

  const [editingPadId, setEditingPadId] = useState<string | null>(null);
  const [editingPadName, setEditingPadName] = useState<string>('');

  const [position, setPosition] = useState<Position>(loadSavedPosition);
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_OPEN_KEY) === 'true'; } catch { return false; }
  });

  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : internalIsOpen;

  const [isMobile, setIsMobile] = useState(false);
  const [isClearConfirming, setIsClearConfirming] = useState(false);
  const [isDeletePadConfirming, setIsDeletePadConfirming] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState(false);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const windowDragControls = useDragControls();
  const [dragOverPadId, setDragOverPadId] = useState<string | null>(null);
  const dragOverPadIdRef = useRef<string | null>(null);

  const isOnTodayPad = activePadId === TODAY_PAD_ID;
  const currentPad = isOnTodayPad
    ? null
    : (pads.find((p) => p.id === activePadId) || pads[0] || createDefaultPad());
  const items = currentPad?.items ?? [];
  const activeItems = items.filter((i) => !i.isCompleted);
  const completedItems = items.filter((i) => i.isCompleted);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    const handleSyncUpdate = () => {
      setPads(loadSavedPads());
      setTodayPad(loadTodayPad());
    };
    window.addEventListener('scratchpad_sync_update', handleSyncUpdate);
    return () => {
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('scratchpad_sync_update', handleSyncUpdate);
    };
  }, []);

  const handleTodayPadUpdate = useCallback((data: TodayPadData) => {
    setTodayPad(data);
    saveTodayPad(data);
  }, []);

  const handleSelectPad = (id: string) => {
    setActivePadId(id);
    setIsDeletePadConfirming(false);
    setIsClearConfirming(false);
    try { localStorage.setItem(STORAGE_ACTIVE_PAD_ID_KEY, id); } catch {}
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

  const handleStartRenamePad = (padId: string, name: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingPadId(padId);
    setEditingPadName(name);
  };

  const handleSaveRenamePad = () => {
    if (!editingPadId) return;
    const finalName = editingPadName.trim() || 'Untitled';
    if (editingPadId === TODAY_PAD_ID) {
      handleTodayPadUpdate({ ...todayPad, name: finalName });
    } else {
      const updated = pads.map((p) => (p.id === editingPadId ? { ...p, name: finalName } : p));
      setPads(updated);
      savePads(updated);
    }
    setEditingPadId(null);
  };

  const handleReorderPads = (newPads: Scratchpad[]) => {
    setPads(newPads);
    savePads(newPads);
  };

  const handleDeleteCurrentPad = () => {
    if (pads.length <= 1) return;
    if (!isDeletePadConfirming) {
      setIsDeletePadConfirming(true);
      setTimeout(() => setIsDeletePadConfirming(false), 3000);
      return;
    }
    setIsDeletePadConfirming(false);
    const updated = pads.filter((p) => p.id !== currentPad!.id);
    setPads(updated);
    savePads(updated);
    handleSelectPad(TODAY_PAD_ID);
  };

  const handleMoveItemToPad = (itemId: string, sourcePadId: string, targetPadId: string) => {
    const sourcePad = pads.find((p) => p.id === sourcePadId);
    const itemToMove = sourcePad?.items.find((i) => i.id === itemId);
    if (!itemToMove) return;
    const updatedPads = pads.map((p) => {
      if (p.id === sourcePadId) return { ...p, items: p.items.filter((i) => i.id !== itemId) };
      if (p.id === targetPadId) return { ...p, items: [itemToMove, ...p.items] };
      return p;
    });
    setPads(updatedPads);
    savePads(updatedPads);
  };

  const handleItemDrag = (_: any, info: { point: { x: number; y: number } }) => {
    const el = document.elementFromPoint(info.point.x, info.point.y);
    const padTabEl = el?.closest('[data-pad-id]');
    const padId = padTabEl?.getAttribute('data-pad-id');
    if (padId && padId !== activePadId) {
      if (dragOverPadIdRef.current !== padId) { dragOverPadIdRef.current = padId; setDragOverPadId(padId); }
    } else {
      if (dragOverPadIdRef.current !== null) { dragOverPadIdRef.current = null; setDragOverPadId(null); }
    }
  };

  const handleItemDragEnd = (item: ScratchpadItem, _: any, info: { point: { x: number; y: number } }) => {
    const el = document.elementFromPoint(info.point.x, info.point.y);
    const padTabEl = el?.closest('[data-pad-id]');
    const directPadId = padTabEl?.getAttribute('data-pad-id');
    const targetPadId = (directPadId && directPadId !== activePadId) ? directPadId : dragOverPadIdRef.current;
    dragOverPadIdRef.current = null;
    setDragOverPadId(null);
    if (targetPadId && targetPadId !== activePadId) handleMoveItemToPad(item.id, activePadId, targetPadId);
  };

  const toggleOpen = () => {
    if (controlledOnToggle) { controlledOnToggle(); }
    else {
      setInternalIsOpen((prev) => {
        const next = !prev;
        try { localStorage.setItem(STORAGE_OPEN_KEY, String(next)); } catch {}
        return next;
      });
    }
  };

  const handleUpdateItems = (newItems: ScratchpadItem[]) => {
    const updatedPads = pads.map((p) => (p.id === currentPad?.id ? { ...p, items: newItems } : p));
    setPads(updatedPads);
    savePads(updatedPads);
  };

  const handleReorderActiveItems = (newActiveItems: ScratchpadItem[]) => {
    handleUpdateItems([...newActiveItems, ...completedItems]);
  };

  const handleTextChange = async (id: string, text: string, targetEl?: HTMLTextAreaElement) => {
    if (targetEl) { targetEl.style.height = 'auto'; targetEl.style.height = `${targetEl.scrollHeight}px`; }
    const updated = items.map((item) => (item.id === id ? { ...item, text } : item));
    handleUpdateItems(updated);
    const targetItem = items.find((i) => i.id === id);
    if (targetItem?.convertedTaskId && text.trim()) { try { await db.entries.update(targetItem.convertedTaskId, { title: text.trim() } as any); } catch {} }
    if (targetItem?.completedLogId && text.trim()) { try { await db.entries.update(targetItem.completedLogId, { title: text.trim() } as any); } catch {} }
  };

  const handleAddItem = (afterId?: string) => {
    const newItem: ScratchpadItem = { id: crypto.randomUUID(), text: '', isCompleted: false };
    let updated: ScratchpadItem[];
    if (afterId) {
      const index = items.findIndex((item) => item.id === afterId);
      updated = index !== -1 ? [...items.slice(0, index + 1), newItem, ...items.slice(index + 1)] : [...items, newItem];
    } else {
      const lastActiveIndex = items.reduce((acc, curr, idx) => (!curr.isCompleted ? idx : acc), -1);
      if (lastActiveIndex !== -1 && lastActiveIndex < items.length - 1) {
        updated = [...items.slice(0, lastActiveIndex + 1), newItem, ...items.slice(lastActiveIndex + 1)];
      } else { updated = [...items, newItem]; }
    }
    handleUpdateItems(updated);
    setTimeout(() => {
      const el = textareaRefs.current.get(newItem.id);
      if (el) { el.focus(); el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; }
    }, 50);
  };

  const handleToggleComplete = async (item: ScratchpadItem) => {
    const nextCompleted = !item.isCompleted;
    let logId = item.completedLogId;
    if (nextCompleted && !item.convertedTaskId && item.text.trim()) {
      try {
        logId = crypto.randomUUID();
        const now = new Date();
        const newLog: Log = { id: logId!, type: 'log', title: item.text.trim(), timestamp: now, created_at: now };
        await db.entries.add(newLog);
      } catch {}
    } else if (!nextCompleted && item.completedLogId) {
      try { await db.entries.delete(item.completedLogId); logId = undefined; } catch {}
    }
    const updated = items.map((i) => i.id === item.id
      ? { ...i, isCompleted: nextCompleted, completedAt: nextCompleted ? new Date().toISOString() : undefined, completedLogId: nextCompleted ? logId : undefined }
      : i,
    );
    handleUpdateItems(updated);
    if (item.convertedTaskId) {
      try { await db.entries.update(item.convertedTaskId, { status: nextCompleted ? 'done' : 'todo', completed_at: nextCompleted ? new Date() : undefined } as any); } catch {}
    }
  };

  const handleDeleteItem = (id: string) => {
    handleUpdateItems(items.filter((item) => item.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, item: ScratchpadItem, indexInActive: number) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleToggleComplete(item); return; }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddItem(item.id); }
    else if (e.key === 'Backspace' && item.text === '') {
      e.preventDefault(); handleDeleteItem(item.id);
      if (indexInActive > 0) {
        const prevId = activeItems[indexInActive - 1].id;
        setTimeout(() => { const el = textareaRefs.current.get(prevId); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }, 50);
      }
    } else if (e.key === 'ArrowUp' && indexInActive > 0) {
      const target = e.currentTarget;
      if (target.selectionStart === 0 && target.selectionEnd === 0) { e.preventDefault(); textareaRefs.current.get(activeItems[indexInActive - 1].id)?.focus(); }
    } else if (e.key === 'ArrowDown' && indexInActive < activeItems.length - 1) {
      const target = e.currentTarget;
      if (target.selectionStart === target.value.length && target.selectionEnd === target.value.length) { e.preventDefault(); textareaRefs.current.get(activeItems[indexInActive + 1].id)?.focus(); }
    }
  };

  const handleConvertToTask = async (item: ScratchpadItem) => {
    if (!item.text.trim()) return;
    let scheduledDate: Date | undefined;
    if (viewMode === 'day') scheduledDate = activeDate;
    else if (viewMode === 'timeline') scheduledDate = new Date();
    const taskId = crypto.randomUUID();
    const newTask: Task = {
      id: taskId, type: 'task', title: item.text.trim(),
      status: item.isCompleted ? 'done' : 'todo', time_spent: 0,
      ...(scheduledDate ? { scheduled_at: scheduledDate } : {}),
      created_at: new Date(),
      ...(item.isCompleted ? { completed_at: new Date() } : {}),
    };
    await db.entries.add(newTask);
    handleUpdateItems(items.map((i) => i.id === item.id ? { ...i, isConverted: true, convertedTaskId: taskId } : i));
  };

  const handleClearDone = () => handleUpdateItems(items.filter((item) => !item.isCompleted && !item.isConverted));

  const handleClearAll = () => {
    if (!isClearConfirming) { setIsClearConfirming(true); setTimeout(() => setIsClearConfirming(false), 3000); return; }
    setIsClearConfirming(false);
    handleUpdateItems([]);
  };

  const uncompletedCount = isOnTodayPad
    ? todayPad.items.filter((i) => !i.isCompleted && i.dateKey === todayDateKey()).length
    : items.filter((i) => !i.isCompleted && !i.isConverted && i.text.trim().length > 0).length;

  const hasDoneItems = !isOnTodayPad && items.some((i) => i.isCompleted || i.isConverted);

  // Virtual pad object for the Today tab in PadTab
  const todayPadProxy = { id: TODAY_PAD_ID, name: todayPad.name, items: todayPad.items };

  const todayActiveBadge = (() => {
    const dk = todayDateKey();
    const count = todayPad.items.filter((i) => !i.isCompleted && (i.dateKey === dk || !i.dateKey)).length;
    return (
      <span className="text-[9px] font-mono opacity-70 bg-stone-950/60 px-1 rounded-full">
        {count}/{TODAY_PAD_MAX_ITEMS}
      </span>
    );
  })();

  const renderHeaderActions = (isMobileView: boolean) => (
    <div className="flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
      {!isOnTodayPad && (hasDoneItems || items.length > 0 || pads.length > 1) && (
        <div className="flex items-center gap-1 bg-stone-900/90 border border-stone-800/80 rounded-lg p-0.5 shadow-inner">
          {hasDoneItems && (
            <button type="button" onClick={handleClearDone}
              className="text-[10px] font-mono font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 px-2 py-0.5 rounded transition-colors cursor-pointer">
              Clear Done
            </button>
          )}
          {items.length > 0 && (
            <button type="button" onClick={handleClearAll}
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all cursor-pointer ${isClearConfirming ? 'bg-red-950 text-red-300 border border-red-800/80 animate-pulse font-bold' : 'text-stone-400 hover:text-red-400 hover:bg-stone-800'}`}>
              {isClearConfirming ? 'Sure?' : 'Clear'}
            </button>
          )}
          {pads.length > 1 && (
            <button type="button" onClick={handleDeleteCurrentPad}
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${isDeletePadConfirming ? 'bg-rose-950 text-rose-300 border border-rose-800/80 animate-pulse font-bold' : 'text-stone-500 hover:text-rose-400 hover:bg-stone-800'}`}>
              <Trash2 className="w-3 h-3" />
              <span>{isDeletePadConfirming ? 'Sure?' : 'Delete Pad'}</span>
            </button>
          )}
        </div>
      )}
      <button type="button" onClick={toggleOpen}
        className={`text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer ${isMobileView ? 'p-1.5' : 'p-1'}`}>
        <X className={isMobileView ? 'w-5 h-5' : 'w-4 h-4'} />
      </button>
    </div>
  );

  const renderTabsRow = (mobileView: boolean) => (
    <div className={`flex-none flex items-center gap-1 ${mobileView ? 'px-3 py-2' : 'px-3 py-1.5'} bg-[#121212] border-b border-stone-850/70 overflow-x-auto no-scrollbar`}>
      {/* Pinned Today tab */}
      <PadTab
        pad={todayPadProxy}
        isActive={isOnTodayPad}
        isDragTarget={dragOverPadId === TODAY_PAD_ID}
        editingPadId={editingPadId}
        editingPadName={editingPadName}
        onSelect={handleSelectPad}
        onStartRename={handleStartRenamePad}
        onRenameChange={setEditingPadName}
        onSaveRename={handleSaveRenamePad}
        onCancelRename={() => setEditingPadId(null)}
        isMobile={mobileView}
        pinned
        badge={todayActiveBadge}
      />

      {/* Regular draggable pads */}
      <Reorder.Group as="div" axis="x" values={pads} onReorder={handleReorderPads} className="flex items-center gap-1 shrink-0">
        {pads.map((pad) => (
          <PadTab
            key={pad.id}
            pad={pad}
            isActive={pad.id === activePadId}
            isDragTarget={pad.id === dragOverPadId}
            editingPadId={editingPadId}
            editingPadName={editingPadName}
            onSelect={handleSelectPad}
            onStartRename={handleStartRenamePad}
            onRenameChange={setEditingPadName}
            onSaveRename={handleSaveRenamePad}
            onCancelRename={() => setEditingPadId(null)}
            isMobile={mobileView}
          />
        ))}
      </Reorder.Group>

      <button type="button" onClick={handleCreateNewPad}
        className="h-7 px-2 rounded-lg bg-stone-900/60 border border-stone-850/80 text-stone-500 hover:text-amber-400 hover:bg-stone-900 flex items-center gap-1 text-xs shrink-0 cursor-pointer transition-colors">
        <Plus className="w-3.5 h-3.5" />
        <span className="text-[10px] font-mono">New</span>
      </button>
    </div>
  );

  const renderRegularPadItems = () => (
    <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
      {items.length === 0 ? (
        <div className="py-8 text-center text-stone-600 text-xs font-mono flex flex-col items-center gap-2">
          <StickyNote className="w-6 h-6 stroke-1 text-stone-700" />
          <span>No scratch ideas in "{currentPad?.name}".</span>
          <span className="text-[10px] text-stone-700">Jot down micro-tasks or thoughts freely.</span>
        </div>
      ) : (
        <Reorder.Group as="div" axis="y" values={activeItems} onReorder={handleReorderActiveItems} className="space-y-1.5">
          {activeItems.map((item, index) => (
            <Reorder.Item key={item.id} value={item} as="div" layout="position"
              onDrag={handleItemDrag} onDragEnd={(e, info) => handleItemDragEnd(item, e, info)}
              transition={{ layout: { duration: 0.15 } }}
              className="group relative flex items-start gap-1.5 bg-[#1b1b1b]/80 hover:bg-[#1f1f1f] border border-stone-850 rounded-lg px-2.5 py-1.5 focus-within:border-amber-500/40 focus-within:bg-[#202020] transition-colors"
            >
              <GripVertical className="w-3 h-3 text-stone-600 group-hover:text-stone-400 shrink-0 cursor-grab active:cursor-grabbing mt-0.5" />
              <button type="button" onClick={() => handleToggleComplete(item)}
                className="w-3.5 h-3.5 rounded-full border border-stone-600 hover:border-emerald-400 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors group/check">
                <Check className="w-2 h-2 text-transparent group-hover/check:text-emerald-400/70" />
              </button>
              <textarea
                ref={(el) => { if (el) { textareaRefs.current.set(item.id, el); el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } else textareaRefs.current.delete(item.id); }}
                rows={1} value={item.text}
                onChange={(e) => handleTextChange(item.id, e.target.value, e.target)}
                onKeyDown={(e) => handleKeyDown(e, item, index)}
                placeholder="Jot idea / action..."
                className={`flex-1 w-full min-w-0 bg-transparent text-xs focus:outline-none placeholder-stone-600 resize-none overflow-hidden leading-normal pr-1 ${item.isConverted ? 'text-stone-500' : 'text-stone-200'}`}
              />
              <div className="absolute right-1.5 top-1 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto focus-within:pointer-events-auto bg-[#1b1b1b] group-hover:bg-[#1f1f1f] group-focus-within:bg-[#202020] pl-1.5 py-0.5 rounded-md">
                {!item.isConverted && item.text.trim() && (
                  <button type="button" onClick={() => handleConvertToTask(item)}
                    className="p-0.5 px-1.5 text-stone-400 hover:text-amber-400 bg-stone-900 hover:bg-stone-850 border border-stone-800 rounded-md shrink-0 text-[9px] font-mono flex items-center gap-0.5 transition-colors cursor-pointer">
                    <Sparkles className="w-2.5 h-2.5 text-amber-500" /><span>Task</span>
                  </button>
                )}
                <button type="button" onClick={() => handleDeleteItem(item.id)}
                  className="p-0.5 text-stone-500 hover:text-rose-400 bg-stone-900 hover:bg-stone-850 border border-stone-800 rounded-md transition-colors cursor-pointer shrink-0">
                  <X className="w-3 h-3" />
                </button>
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      )}

      <button type="button" onClick={() => handleAddItem()}
        className="w-full py-1.5 px-2.5 border border-dashed border-stone-850 hover:border-amber-500/30 rounded-lg text-stone-500 hover:text-amber-400 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
        <Plus className="w-3.5 h-3.5" /> Add scratch item (or press Enter)
      </button>

      {completedItems.length > 0 && (
        <div className="pt-2 border-t border-stone-850/60 mt-2.5">
          <div className="flex items-center justify-between py-0.5 px-1">
            <button type="button" onClick={() => setIsCompletedOpen((prev) => !prev)}
              className="flex items-center gap-1.5 text-xs font-mono text-stone-500 hover:text-stone-300 transition-colors cursor-pointer select-none">
              {isCompletedOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
              <span>Completed ({completedItems.length})</span>
            </button>
            <button type="button" onClick={handleClearDone}
              className="text-[9px] font-mono text-stone-500 hover:text-rose-400 px-1 py-0.5 rounded transition-colors cursor-pointer">
              Clear
            </button>
          </div>
          <AnimatePresence>
            {isCompletedOpen && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                className="space-y-1 mt-1.5 overflow-hidden">
                {completedItems.map((item) => (
                  <div key={item.id} className="group relative flex items-start gap-1.5 bg-stone-900/30 hover:bg-stone-900/60 border border-stone-850/50 rounded-lg px-2.5 py-1.5 transition-colors opacity-75 hover:opacity-100">
                    <button type="button" onClick={() => handleToggleComplete(item)}
                      className="w-3.5 h-3.5 rounded-full border bg-emerald-500/20 border-emerald-500/60 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer">
                      <Check className="w-2 h-2 stroke-[3]" />
                    </button>
                    <span className="flex-1 w-full min-w-0 text-xs text-stone-500 select-text break-words py-0.5 leading-normal pr-1">{item.text}</span>
                    <div className="absolute right-1.5 top-1 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 pl-1.5 py-0.5 rounded-md">
                      {item.isConverted && <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/70 border border-amber-500/20">Task</span>}
                      <button type="button" onClick={() => handleDeleteItem(item.id)}
                        className="p-0.5 text-stone-600 hover:text-rose-400 bg-stone-950 border border-stone-800 rounded cursor-pointer shrink-0">
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
  );

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          isMobile ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 z-50 bg-[#141414] flex flex-col font-sans overflow-hidden"
              style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))', paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))' }}
            >
              <div className="flex-none flex items-center justify-between px-4 py-3 bg-[#181818] border-b border-stone-850">
                <div className="flex items-center gap-2">
                  <StickyNote className="w-4.5 h-4.5 text-amber-500" />
                  <h3 className="text-base font-serif font-bold text-stone-100">Scratchpad</h3>
                  <span className="text-[11px] font-mono text-stone-400 bg-stone-900 px-2 py-0.5 rounded border border-stone-800">
                    {uncompletedCount} active
                  </span>
                </div>
                {renderHeaderActions(true)}
              </div>

              {renderTabsRow(true)}

              <div className="flex-1 overflow-y-auto">
                {isOnTodayPad ? (
                  <div className="p-4">
                    <TodayPad todayPad={todayPad} onUpdate={handleTodayPadUpdate} viewMode={viewMode} activeDate={activeDate} />
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {items.length === 0 ? (
                      <div className="py-16 text-center text-stone-600 text-xs font-mono flex flex-col items-center gap-2">
                        <StickyNote className="w-8 h-8 stroke-1 text-stone-700" />
                        <span>No scratch ideas in "{currentPad?.name}".</span>
                        <span className="text-[11px] text-stone-700">Jot down micro-tasks or thoughts freely.</span>
                      </div>
                    ) : (
                      <Reorder.Group as="div" axis="y" values={activeItems} onReorder={handleReorderActiveItems} className="space-y-1.5">
                        {activeItems.map((item, index) => (
                          <MobileScratchpadItem key={item.id} item={item} index={index}
                            textareaRef={(el) => { if (el) { textareaRefs.current.set(item.id, el); el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } else textareaRefs.current.delete(item.id); }}
                            onTextChange={handleTextChange} onKeyDown={handleKeyDown}
                            onToggleComplete={handleToggleComplete} onConvertToTask={handleConvertToTask}
                            onDeleteItem={handleDeleteItem} onDrag={handleItemDrag} onDragEnd={handleItemDragEnd}
                          />
                        ))}
                      </Reorder.Group>
                    )}
                    <button type="button" onClick={() => handleAddItem()}
                      className="w-full py-2.5 px-3 border border-dashed border-stone-800 hover:border-amber-500/40 rounded-xl text-stone-400 hover:text-amber-400 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2">
                      <Plus className="w-3.5 h-3.5" /> Add Item
                    </button>
                    {completedItems.length > 0 && (
                      <div className="pt-3 border-t border-stone-850 mt-3">
                        <div className="flex items-center justify-between py-1 px-1">
                          <button type="button" onClick={() => setIsCompletedOpen((prev) => !prev)}
                            className="flex items-center gap-1.5 text-xs font-mono text-stone-400 hover:text-stone-200 cursor-pointer select-none">
                            {isCompletedOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                            <span>Completed ({completedItems.length})</span>
                          </button>
                          <button type="button" onClick={handleClearDone}
                            className="text-[10px] font-mono text-stone-500 hover:text-rose-400 px-2 py-0.5 rounded cursor-pointer">
                            Clear
                          </button>
                        </div>
                        <AnimatePresence>
                          {isCompletedOpen && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                              className="space-y-1.5 mt-2 overflow-hidden">
                              {completedItems.map((item) => (
                                <div key={item.id} className="flex items-start gap-1.5 bg-[#171717] border border-stone-850/60 rounded-lg px-2.5 py-2 opacity-75">
                                  <button type="button" onClick={() => handleToggleComplete(item)}
                                    className="w-4 h-4 rounded-full border bg-emerald-500/20 border-emerald-500/60 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer">
                                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                                  </button>
                                  <span className="flex-1 text-xs text-stone-500 select-text break-words py-0.5 leading-normal">{item.text}</span>
                                  <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                    {item.isConverted && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/70 border border-amber-500/20">Task</span>}
                                    <button type="button" onClick={() => handleDeleteItem(item.id)} className="p-1 text-stone-500 hover:text-rose-400 rounded cursor-pointer">
                                      <X className="w-3.5 h-3.5" />
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
                )}
              </div>
            </motion.div>
          ) : (
            /* DESKTOP FLOATING WINDOW */
            <motion.div
              drag dragListener={false} dragControls={windowDragControls} dragMomentum={false}
              onDragEnd={(_, info) => {
                const newPos = { x: position.x + info.offset.x, y: position.y + info.offset.y };
                setPosition(newPos); savePosition(newPos);
              }}
              initial={{ opacity: 0, scale: 0.95, x: position.x, y: position.y + 15 }}
              animate={{ opacity: 1, scale: 1, x: position.x, y: position.y }}
              exit={{ opacity: 0, scale: 0.95, x: position.x, y: position.y + 15 }}
              transition={{ duration: 0.2 }}
              className="fixed z-50 bottom-20 right-8 w-[480px] max-w-[90vw] h-[560px] max-h-[85vh] bg-[#141414]/95 border border-stone-800 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden font-sans"
            >
              {/* Header */}
              <div onPointerDown={(e) => windowDragControls.start(e)}
                className="flex-none flex items-center justify-between px-4 py-2.5 bg-[#181818] border-b border-stone-850 cursor-grab active:cursor-grabbing select-none">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-stone-600" />
                  <StickyNote className="w-4 h-4 text-amber-500" />
                  <h3 className="text-sm font-serif font-bold text-stone-200">Scratchpad</h3>
                  <span className="text-[10px] font-mono text-stone-500 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800">
                    {uncompletedCount} active
                  </span>
                </div>
                {renderHeaderActions(false)}
              </div>

              {renderTabsRow(false)}

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-3.5">
                {isOnTodayPad ? (
                  <TodayPad todayPad={todayPad} onUpdate={handleTodayPadUpdate} viewMode={viewMode} activeDate={activeDate} />
                ) : (
                  renderRegularPadItems()
                )}
              </div>

              {/* Footer hint */}
              <div className="flex-none px-4 py-2 bg-[#121212] border-t border-stone-850/60 text-[10px] font-mono text-stone-500 flex justify-between items-center">
                <span>Enter = new item • Ctrl+Enter = complete</span>
                <span>Click tab title to rename</span>
              </div>
            </motion.div>
          )
        )}
      </AnimatePresence>
    </>
  );
}
