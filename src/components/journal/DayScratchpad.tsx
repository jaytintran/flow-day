/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
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
} from 'lucide-react';

export interface ScratchpadItem {
  id: string;
  text: string;
  isCompleted?: boolean;
  completedAt?: string;
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
    if (raw) return JSON.parse(raw);
  } catch {}
  return { x: 0, y: 0 };
}

function savePosition(pos: Position) {
  try {
    localStorage.setItem(STORAGE_POS_KEY, JSON.stringify(pos));
  } catch {}
}

function createDefaultPad(): Scratchpad {
  return {
    id: 'default-inbox',
    name: 'Main',
    items: [],
    created_at: new Date().toISOString(),
  };
}

function loadSavedPads(): Scratchpad[] {
  try {
    const raw = localStorage.getItem(STORAGE_PADS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Scratchpad[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
    const legacyRaw = localStorage.getItem(STORAGE_LEGACY_ITEMS_KEY);
    if (legacyRaw) {
      const legacyItems = JSON.parse(legacyRaw) as ScratchpadItem[];
      if (Array.isArray(legacyItems) && legacyItems.length > 0) {
        const initialPad: Scratchpad = {
          id: 'default-inbox',
          name: 'Main',
          items: legacyItems,
          created_at: new Date().toISOString(),
        };
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

interface PadTabProps {
  pad: Scratchpad;
  isActive: boolean;
  isDragTarget?: boolean;
  editingPadId: string | null;
  editingPadName: string;
  onSelect: (id: string) => void;
  onStartRename: (pad: Scratchpad, e?: React.MouseEvent) => void;
  onRenameChange: (val: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  isMobile?: boolean;
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
}: PadTabProps) {
  const activeItemCount = pad.items.filter(
    (i) => !i.isCompleted && !i.isConverted && i.text.trim().length > 0,
  ).length;

  const isEditing = editingPadId === pad.id;

  return (
    <Reorder.Item
      key={pad.id}
      value={pad}
      as="div"
      data-pad-id={pad.id}
      dragListener={!isEditing}
      whileDrag={{ zIndex: 50, cursor: 'grabbing', opacity: 0.85 }}
      transition={{ duration: 0.15 }}
      onClick={() => {
        if (!isEditing) {
          onSelect(pad.id);
        }
      }}
      className={`group flex items-center h-7 gap-1.5 ${
        isMobile ? 'px-3' : 'px-2.5'
      } rounded-lg text-xs font-mono transition-colors cursor-pointer shrink-0 border select-none ${
        isDragTarget
          ? 'bg-amber-500/30 border-amber-400 text-amber-300 ring-2 ring-amber-500/60 shadow-md font-bold'
          : isActive
          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-bold shadow-xs'
          : isMobile
          ? 'bg-stone-900/60 border-stone-850 text-stone-400 hover:text-stone-200'
          : 'bg-stone-900/40 border-stone-850/50 text-stone-500 hover:text-stone-300 hover:bg-stone-900/80'
      }`}
    >
      {isEditing ? (
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
            onClick={(e) => {
              if (isActive) {
                onStartRename(pad, e);
              }
            }}
            className="cursor-pointer select-none truncate max-w-[130px]"
            title="Click to rename, drag to reorder"
          >
            {pad.name}
          </span>
          {activeItemCount > 0 && (
            <span className="text-[9px] opacity-70 bg-stone-950/60 px-1 rounded-full">
              {activeItemCount}
            </span>
          )}
        </>
      )}
    </Reorder.Item>
  );
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
  onDrag?: (e: any, info: { point: { x: number; y: number } }) => void;
  onDragEnd?: (item: ScratchpadItem, e: any, info: { point: { x: number; y: number } }) => void;
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
  onDrag,
  onDragEnd,
}: MobileScratchpadItemProps) {
  const dragControls = useDragControls();

  return (
    <Reorder.Item
      key={item.id}
      value={item}
      as="div"
      layout="position"
      dragListener={false}
      dragControls={dragControls}
      onDrag={onDrag}
      onDragEnd={(e, info) => onDragEnd?.(item, e, info)}
      transition={{ layout: { duration: 0.15 } }}
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
  const [isDeletePadConfirming, setIsDeletePadConfirming] = useState(false);
  const [isCompletedOpen, setIsCompletedOpen] = useState<boolean>(false);
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const windowDragControls = useDragControls();

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
    setIsDeletePadConfirming(false);
    setIsClearConfirming(false);
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

  const handleReorderPads = (newPads: Scratchpad[]) => {
    setPads(newPads);
    savePads(newPads);
  };

  const handleDeleteCurrentPad = () => {
    if (pads.length <= 1) return; // Keep at least one pad

    if (!isDeletePadConfirming) {
      setIsDeletePadConfirming(true);
      setTimeout(() => {
        setIsDeletePadConfirming(false);
      }, 3000);
      return;
    }

    setIsDeletePadConfirming(false);
    const updated = pads.filter((p) => p.id !== currentPad.id);
    setPads(updated);
    savePads(updated);
    handleSelectPad(updated[0].id);
  };

  const [dragOverPadId, setDragOverPadId] = useState<string | null>(null);
  const dragOverPadIdRef = useRef<string | null>(null);

  const handleMoveItemToPad = (
    itemId: string,
    sourcePadId: string,
    targetPadId: string,
  ) => {
    const sourcePad = pads.find((p) => p.id === sourcePadId);
    const itemToMove = sourcePad?.items.find((i) => i.id === itemId);
    if (!itemToMove) return;

    const updatedPads = pads.map((p) => {
      if (p.id === sourcePadId) {
        return {
          ...p,
          items: p.items.filter((i) => i.id !== itemId),
        };
      }
      if (p.id === targetPadId) {
        return {
          ...p,
          items: [itemToMove, ...p.items],
        };
      }
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
      if (dragOverPadIdRef.current !== padId) {
        dragOverPadIdRef.current = padId;
        setDragOverPadId(padId);
      }
    } else {
      if (dragOverPadIdRef.current !== null) {
        dragOverPadIdRef.current = null;
        setDragOverPadId(null);
      }
    }
  };

  const handleItemDragEnd = (
    item: ScratchpadItem,
    _: any,
    info: { point: { x: number; y: number } },
  ) => {
    const el = document.elementFromPoint(info.point.x, info.point.y);
    const padTabEl = el?.closest('[data-pad-id]');
    const directPadId = padTabEl?.getAttribute('data-pad-id');

    const targetPadId =
      directPadId && directPadId !== activePadId ? directPadId : dragOverPadIdRef.current;
    dragOverPadIdRef.current = null;
    setDragOverPadId(null);

    if (targetPadId && targetPadId !== activePadId) {
      handleMoveItemToPad(item.id, activePadId, targetPadId);
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

  const handleTextChange = async (id: string, text: string, targetEl?: HTMLTextAreaElement) => {
    if (targetEl) {
      targetEl.style.height = 'auto';
      targetEl.style.height = `${targetEl.scrollHeight}px`;
    }
    const updated = items.map((item) => (item.id === id ? { ...item, text } : item));
    handleUpdateItems(updated);

    const targetItem = items.find((i) => i.id === id);
    if (targetItem?.convertedTaskId && text.trim()) {
      try {
        await db.entries.update(targetItem.convertedTaskId, { title: text.trim() } as any);
      } catch {}
    }
    if (targetItem?.completedLogId && text.trim()) {
      try {
        await db.entries.update(targetItem.completedLogId, { title: text.trim() } as any);
      } catch {}
    }
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
    let logId = item.completedLogId;

    if (nextCompleted) {
      // 1. If checking off and item has text:
      // If it wasn't already converted to a task, create a Log entry in DB
      if (!item.convertedTaskId && item.text.trim()) {
        try {
          logId = crypto.randomUUID();
          const now = new Date();
          const newLog: Log = {
            id: logId,
            type: 'log',
            title: item.text.trim(),
            timestamp: now,
            created_at: now,
          };
          await db.entries.add(newLog);
        } catch (e) {
          console.error('Failed to create log entry for scratchpad item:', e);
        }
      }
    } else {
      // 2. If unchecking:
      // If a linked Log entry was created, delete it from Dexie DB
      if (item.completedLogId) {
        try {
          await db.entries.delete(item.completedLogId);
          logId = undefined;
        } catch (e) {
          console.error('Failed to remove log entry for uncompleted scratchpad item:', e);
        }
      }
    }

    const updated = items.map((i) =>
      i.id === item.id
        ? {
            ...i,
            isCompleted: nextCompleted,
            completedAt: nextCompleted ? new Date().toISOString() : undefined,
            completedLogId: nextCompleted ? logId : undefined,
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
        } as any);
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

  const renderHeaderActions = (isMobileView: boolean) => (
    <div className="flex items-center gap-1.5" onPointerDown={(e) => e.stopPropagation()}>
      {(hasDoneItems || items.length > 0 || pads.length > 1) && (
        <div className="flex items-center gap-1 bg-stone-900/90 border border-stone-800/80 rounded-lg p-0.5 shadow-inner">
          {hasDoneItems && (
            <button
              type="button"
              onClick={handleClearDone}
              title="Remove completed items from this pad"
              className="text-[10px] font-mono font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 px-2 py-0.5 rounded transition-colors cursor-pointer"
            >
              Clear Done
            </button>
          )}

          {items.length > 0 && (
            <button
              type="button"
              onClick={handleClearAll}
              title="Clear all items in this pad"
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all cursor-pointer ${
                isClearConfirming
                  ? 'bg-red-950 text-red-300 border border-red-800/80 animate-pulse font-bold'
                  : 'text-stone-400 hover:text-red-400 hover:bg-stone-800'
              }`}
            >
              {isClearConfirming ? 'Sure?' : 'Clear'}
            </button>
          )}

          {pads.length > 1 && (
            <button
              type="button"
              onClick={handleDeleteCurrentPad}
              title={`Delete "${currentPad.name}"`}
              className={`text-[10px] font-mono px-2 py-0.5 rounded transition-all cursor-pointer flex items-center gap-1 ${
                isDeletePadConfirming
                  ? 'bg-rose-950 text-rose-300 border border-rose-800/80 animate-pulse font-bold'
                  : 'text-stone-500 hover:text-rose-400 hover:bg-stone-800'
              }`}
            >
              <Trash2 className="w-3 h-3" />
              <span>{isDeletePadConfirming ? 'Sure?' : 'Delete Pad'}</span>
            </button>
          )}
        </div>
      )}

      {/* Close Button */}
      <button
        type="button"
        onClick={toggleOpen}
        title="Close Scratchpad"
        className={`text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer ${
          isMobileView ? 'p-1.5' : 'p-1'
        }`}
      >
        <X className={isMobileView ? 'w-5 h-5' : 'w-4 h-4'} />
      </button>
    </div>
  );

  return (
    <>
      {/* SCRATCHPAD MODAL / WINDOW */}
      <AnimatePresence>
        {isOpen &&
          (isMobile ? (
            /* MOBILE FULL-SCREEN MODAL */
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="fixed inset-0 z-50 bg-[#141414] flex flex-col font-sans overflow-hidden"
              style={{
                paddingTop: 'max(0.5rem, env(safe-area-inset-top, 0.5rem))',
                paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0.5rem))',
              }}
            >
              {/* Mobile Header */}
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

              {/* Multi-Pad Tabs Row (Mobile) */}
              <div className="flex-none px-3 py-2 bg-[#121212] border-b border-stone-850/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <Reorder.Group
                  as="div"
                  axis="x"
                  values={pads}
                  onReorder={handleReorderPads}
                  className="flex items-center gap-1.5 shrink-0"
                >
                  {pads.map((pad) => (
                    <PadTab
                      key={pad.id}
                      pad={pad}
                      isActive={pad.id === currentPad.id}
                      isDragTarget={pad.id === dragOverPadId}
                      editingPadId={editingPadId}
                      editingPadName={editingPadName}
                      onSelect={handleSelectPad}
                      onStartRename={handleStartRenamePad}
                      onRenameChange={setEditingPadName}
                      onSaveRename={handleSaveRenamePad}
                      onCancelRename={() => setEditingPadId(null)}
                      isMobile={true}
                    />
                  ))}
                </Reorder.Group>

                <button
                  type="button"
                  onClick={handleCreateNewPad}
                  className="h-7 px-2.5 rounded-lg bg-stone-900/80 border border-stone-800 text-stone-400 hover:text-amber-400 flex items-center gap-1 text-xs shrink-0 cursor-pointer transition-colors"
                  title="Create New Pad"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-mono">New</span>
                </button>
              </div>

              {/* Mobile Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {items.length === 0 ? (
                  <div className="py-16 text-center text-stone-600 text-xs font-mono flex flex-col items-center gap-2">
                    <StickyNote className="w-8 h-8 stroke-1 text-stone-700" />
                    <span>No scratch ideas in "{currentPad.name}".</span>
                    <span className="text-[11px] text-stone-700">
                      Jot down micro-tasks or thoughts freely.
                    </span>
                  </div>
                ) : (
                  <Reorder.Group
                    as="div"
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
                        onDrag={handleItemDrag}
                        onDragEnd={handleItemDragEnd}
                      />
                    ))}
                  </Reorder.Group>
                )}

                <button
                  type="button"
                  onClick={() => handleAddItem()}
                  className="w-full py-2.5 px-3 border border-dashed border-stone-800 hover:border-amber-500/40 rounded-xl text-stone-400 hover:text-amber-400 text-xs font-mono flex items-center justify-center gap-1.5 transition-colors cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5" /> Add Item
                </button>

                {/* Collapsible Completed Section (Mobile) */}
                {completedItems.length > 0 && (
                  <div className="pt-3 border-t border-stone-850 mt-3">
                    <div className="flex items-center justify-between py-1 px-1">
                      <button
                        type="button"
                        onClick={() => setIsCompletedOpen((prev) => !prev)}
                        className="flex items-center gap-1.5 text-xs font-mono text-stone-400 hover:text-stone-200 cursor-pointer select-none"
                      >
                        {isCompletedOpen ? (
                          <ChevronDown className="w-3.5 h-3.5" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5" />
                        )}
                        <span>Completed ({completedItems.length})</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleClearDone}
                        className="text-[10px] font-mono text-stone-500 hover:text-rose-400 px-2 py-0.5 rounded cursor-pointer"
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
                          className="space-y-1.5 mt-2 overflow-hidden"
                        >
                          {completedItems.map((item) => (
                            <div
                              key={item.id}
                              className="flex items-start gap-1.5 bg-[#171717] border border-stone-850/60 rounded-lg px-2.5 py-2 opacity-75"
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleComplete(item)}
                                title="Mark as active"
                                className="w-4 h-4 rounded-full border bg-emerald-500/20 border-emerald-500/60 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer"
                              >
                                <Check className="w-2.5 h-2.5 stroke-[3]" />
                              </button>
                              <span className="flex-1 text-xs text-stone-500 select-text break-words py-0.5 leading-normal">
                                {item.text}
                              </span>
                              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                {item.isConverted && (
                                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400/70 border border-amber-500/20">
                                    Task
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item.id)}
                                  className="p-1 text-stone-500 hover:text-rose-400 rounded cursor-pointer"
                                >
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
            </motion.div>
          ) : (
            /* DESKTOP FLOATING DRAGGABLE WINDOW */
            <motion.div
              drag
              dragListener={false}
              dragControls={windowDragControls}
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
              className="fixed z-50 bottom-20 right-8 w-[480px] max-w-[90vw] h-[520px] max-h-[85vh] bg-[#141414]/95 border border-stone-800 rounded-2xl shadow-2xl backdrop-blur-md flex flex-col overflow-hidden font-sans"
            >
              {/* Window Header (Drag Handle) */}
              <div
                onPointerDown={(e) => windowDragControls.start(e)}
                className="flex-none flex items-center justify-between px-4 py-2.5 bg-[#181818] border-b border-stone-850 cursor-grab active:cursor-grabbing select-none"
              >
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

              {/* Multi-Pad Tabs Row (Desktop) */}
              <div className="flex-none flex items-center gap-1 px-3 py-1.5 bg-[#121212] border-b border-stone-850/70 overflow-x-auto no-scrollbar">
                <Reorder.Group
                  as="div"
                  axis="x"
                  values={pads}
                  onReorder={handleReorderPads}
                  className="flex items-center gap-1 shrink-0"
                >
                  {pads.map((pad) => (
                    <PadTab
                      key={pad.id}
                      pad={pad}
                      isActive={pad.id === currentPad.id}
                      isDragTarget={pad.id === dragOverPadId}
                      editingPadId={editingPadId}
                      editingPadName={editingPadName}
                      onSelect={handleSelectPad}
                      onStartRename={handleStartRenamePad}
                      onRenameChange={setEditingPadName}
                      onSaveRename={handleSaveRenamePad}
                      onCancelRename={() => setEditingPadId(null)}
                      isMobile={false}
                    />
                  ))}
                </Reorder.Group>

                <button
                  type="button"
                  onClick={handleCreateNewPad}
                  className="h-7 px-2 rounded-lg bg-stone-900/60 border border-stone-850/80 text-stone-500 hover:text-amber-400 hover:bg-stone-900 flex items-center gap-1 text-xs shrink-0 cursor-pointer transition-colors"
                  title="Create New Pad"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-mono">New</span>
                </button>
              </div>

              {/* Items List */}
              <div className="flex-1 overflow-y-auto p-3.5 space-y-2">
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
                    as="div"
                    axis="y"
                    values={activeItems}
                    onReorder={handleReorderActiveItems}
                    className="space-y-1.5"
                  >
                    {activeItems.map((item, index) => (
                      <Reorder.Item
                        key={item.id}
                        value={item}
                        as="div"
                        layout="position"
                        onDrag={handleItemDrag}
                        onDragEnd={(e, info) => handleItemDragEnd(item, e, info)}
                        transition={{ layout: { duration: 0.15 } }}
                        className="group relative flex items-start gap-1.5 bg-[#1b1b1b]/80 hover:bg-[#1f1f1f] border border-stone-850 rounded-lg px-2.5 py-1.5 focus-within:border-amber-500/40 focus-within:bg-[#202020] transition-colors"
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
                          className={`flex-1 w-full min-w-0 bg-transparent text-xs focus:outline-none placeholder-stone-600 resize-none overflow-hidden leading-normal pr-1 ${
                            item.isConverted
                              ? 'text-stone-500'
                              : 'text-stone-200'
                          }`}
                        />

                        {/* Action buttons overlaid on top of text on hover (pure solid background) */}
                        <div className="absolute right-1.5 top-1 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity pointer-events-none group-hover:pointer-events-auto focus-within:pointer-events-auto bg-[#1b1b1b] group-hover:bg-[#1f1f1f] group-focus-within:bg-[#202020] pl-1.5 py-0.5 rounded-md">
                          {!item.isConverted && item.text.trim() && (
                            <button
                              type="button"
                              onClick={() => handleConvertToTask(item)}
                              title="Convert to Task for Today"
                              className="p-0.5 px-1.5 text-stone-400 hover:text-amber-400 bg-stone-900 hover:bg-stone-850 border border-stone-800 rounded-md shrink-0 text-[9px] font-mono flex items-center gap-0.5 transition-colors cursor-pointer"
                            >
                              <Sparkles className="w-2.5 h-2.5 text-amber-500" />
                              <span>Task</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            title="Delete item"
                            className="p-0.5 text-stone-500 hover:text-rose-400 bg-stone-900 hover:bg-stone-850 border border-stone-800 rounded-md transition-colors cursor-pointer shrink-0"
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
                              className="group relative flex items-start gap-1.5 bg-stone-900/30 hover:bg-stone-900/60 border border-stone-850/50 rounded-lg px-2.5 py-1.5 transition-colors opacity-75 hover:opacity-100"
                            >
                              <button
                                type="button"
                                onClick={() => handleToggleComplete(item)}
                                title="Mark as active"
                                className="w-3.5 h-3.5 rounded-full border bg-emerald-500/20 border-emerald-500/60 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-all hover:bg-emerald-500/30"
                              >
                                <Check className="w-2 h-2 stroke-[3]" />
                              </button>
                              <span className="flex-1 w-full min-w-0 text-xs text-stone-500 select-text break-words py-0.5 leading-normal pr-1">
                                {item.text}
                              </span>
                              <div className="absolute right-1.5 top-1 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-stone-900 pl-1.5 py-0.5 rounded-md">
                                {item.isConverted && (
                                  <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/70 border border-amber-500/20">
                                    Task
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleDeleteItem(item.id)}
                                  title="Delete item"
                                  className="p-0.5 text-stone-600 hover:text-rose-400 bg-stone-950 border border-stone-800 rounded cursor-pointer shrink-0 transition-colors"
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
              <div className="flex-none px-4 py-2 bg-[#121212] border-t border-stone-850/60 text-[10px] font-mono text-stone-500 flex justify-between items-center">
                <span>Enter = new line • Ctrl+Enter = complete</span>
                <span>Click tab title to rename</span>
              </div>
            </motion.div>
          ))}
      </AnimatePresence>
    </>
  );
}
