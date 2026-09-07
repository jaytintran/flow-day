/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Play,
  Square,
  CheckCircle2,
  CircleDashed,
  HelpCircle,
  XCircle,
  Clock,
  Calendar,
  CalendarDays,
  CalendarPlus,
  Star,
  ListTodo,
  Copy,
  FileCode,
  FileText,
  Trash2,
  Edit3,
  Sparkles,
  ChevronRight,
  ArrowRightLeft,
  CalendarOff,
  CheckSquare,
} from 'lucide-react';
import { TimelineEntry, Task, Log, Note, Event, TimeBlock, TaskStatus, Category } from '../types';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { TASK_LIST_SCOPE } from '../utils';
import CategoryIcon from './CategoryIcon';

export interface EntryContextMenuProps {
  entry: TimelineEntry | TimeBlock | null;
  x: number;
  y: number;
  onClose: () => void;
  activeTaskId?: string | null;
  onOpenDetail?: (entry: TimelineEntry) => void;
  onDeleteEntry?: (id: string) => void;
  onActivateTask?: (taskId: string) => void;
  onToggleTaskStatus?: (task: Task) => void;
  onReschedule?: (entry: TimelineEntry, date: Date) => void;
  onNavigateToDate?: (date: Date) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string) => void;
  selectedTaskIds?: string[];
  onBatchDelete?: (ids: string[]) => void;
  onBatchUpdateStatus?: (ids: string[], status: TaskStatus) => void;
  onBatchAssignList?: (ids: string[], listId: string) => void;
  onBatchReschedule?: (ids: string[], date: Date | null) => void;
}

export default function EntryContextMenu({
  entry,
  x,
  y,
  onClose,
  activeTaskId,
  onOpenDetail,
  onDeleteEntry,
  onActivateTask,
  onToggleTaskStatus,
  onReschedule,
  onNavigateToDate,
  isSelected,
  onToggleSelect,
  selectedTaskIds,
  onBatchDelete,
  onBatchUpdateStatus,
  onBatchAssignList,
  onBatchReschedule,
}: EntryContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [submenuPos, setSubmenuPos] = useState<{ x: number; y: number } | null>(null);
  const leaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  const taskLists = useLiveQuery(
    () => db.categories.where('scope').equals(TASK_LIST_SCOPE).toArray(),
    []
  ) || [];

  const liveEntry = useLiveQuery(
    () => (entry ? db.entries.get(entry.id) : undefined),
    [entry?.id]
  ) || entry;

  // Calculate boundary-aware coordinates for the main context menu
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const padding = 12;
    let newX = x;
    let newY = y;

    if (newX + rect.width > window.innerWidth - padding) {
      newX = Math.max(padding, window.innerWidth - rect.width - padding);
    }
    if (newY + rect.height > window.innerHeight - padding) {
      newY = Math.max(padding, window.innerHeight - rect.height - padding);
    }

    setAdjustedPos({ x: newX, y: newY });
  }, [x, y, entry]);

  // Outside click & Escape to dismiss
  useEffect(() => {
    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (menuRef.current && !menuRef.current.contains(target)) {
        const floatingSubmenu = document.getElementById('context-menu-floating-submenu');
        if (floatingSubmenu && floatingSubmenu.contains(target)) {
          return;
        }
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const handleWindowBlur = () => onClose();
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (menuRef.current && target && menuRef.current.contains(target)) {
        return;
      }
      const floatingSubmenu = document.getElementById('context-menu-floating-submenu');
      if (floatingSubmenu && target && floatingSubmenu.contains(target)) {
        return;
      }
      onClose();
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowBlur);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      if (leaveTimeoutRef.current) {
        clearTimeout(leaveTimeoutRef.current);
      }
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowBlur);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose]);

  if (!liveEntry) return null;

  const isTask = liveEntry.type === 'task';
  const isLog = liveEntry.type === 'log';
  const isNote = liveEntry.type === 'note';
  const isEvent = liveEntry.type === 'event';
  const isTimeBlock = liveEntry.type === 'time-block';
  const task = isTask ? (liveEntry as Task) : null;
  const isTimerActive = isTask && activeTaskId === task?.id;

  const isBatch = !!(selectedTaskIds && selectedTaskIds.length > 1 && selectedTaskIds.includes(liveEntry.id));
  const batchCount = isBatch ? selectedTaskIds.length : 1;

  // Submenu Hover Handlers
  const handleTriggerMouseEnter = (submenuKey: string, e: React.MouseEvent<HTMLElement>) => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const submenuWidth = 196;
    const padding = 12;
    const openLeft = rect.right + submenuWidth > window.innerWidth - padding;
    const subX = openLeft
      ? Math.max(padding, rect.left - submenuWidth - 4)
      : Math.min(window.innerWidth - submenuWidth - padding, rect.right + 4);
    const subY = Math.min(Math.max(padding, rect.top - 4), window.innerHeight - 260);

    setActiveSubmenu(submenuKey);
    setSubmenuPos({ x: subX, y: subY });
  };

  const handleTriggerMouseLeave = () => {
    leaveTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null);
      setSubmenuPos(null);
    }, 180);
  };

  const handleSubmenuMouseEnter = () => {
    if (leaveTimeoutRef.current) {
      clearTimeout(leaveTimeoutRef.current);
      leaveTimeoutRef.current = null;
    }
  };

  const handleSubmenuMouseLeave = () => {
    leaveTimeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null);
      setSubmenuPos(null);
    }, 180);
  };

  // Action Handlers
  const handleStartTimer = () => {
    if (task && onActivateTask) {
      onActivateTask(task.id);
    }
    onClose();
  };

  const handleUpdateTaskStatus = async (status: TaskStatus) => {
    if (isBatch && onBatchUpdateStatus && selectedTaskIds) {
      onBatchUpdateStatus(selectedTaskIds, status);
    } else if (isBatch && selectedTaskIds) {
      await db.transaction('rw', db.entries, async () => {
        for (const id of selectedTaskIds) {
          if (status === 'done') {
            await db.entries.update(id, {
              status: 'done',
              completed_at: new Date(),
            } as any);
          } else {
            await db.entries.update(id, {
              status,
              completed_at: undefined,
            } as any);
          }
        }
      });
    } else if (task) {
      if (status === 'done') {
        await db.entries.update(task.id, {
          status: 'done',
          completed_at: new Date(),
        } as any);
      } else {
        await db.entries.update(task.id, {
          status,
          completed_at: undefined,
        } as any);
      }
    }
    onClose();
  };

  const handleToggleStar = async () => {
    const currentStarred = !!(entry as any).starred;
    await db.entries.update(entry.id, {
      starred: !currentStarred,
    } as any);
    onClose();
  };

  const handleTogglePinned = async () => {
    const currentPinned = !!(entry as any).pinned;
    await db.entries.update(entry.id, {
      pinned: !currentPinned,
    } as any);
    onClose();
  };

  const handleQuickReschedule = async (offsetDays: number | null) => {
    const target = offsetDays === null ? null : (() => {
      const d = new Date();
      d.setDate(d.getDate() + offsetDays);
      return d;
    })();

    if (isBatch && onBatchReschedule && selectedTaskIds) {
      onBatchReschedule(selectedTaskIds, target);
    } else if (isBatch && selectedTaskIds) {
      await db.transaction('rw', db.entries, async () => {
        for (const id of selectedTaskIds) {
          if (target === null) {
            await db.entries.update(id, { scheduled_at: undefined } as any);
          } else {
            await db.entries.update(id, { scheduled_at: target } as any);
          }
        }
      });
    } else if (offsetDays === null) {
      if (isTask) {
        await db.entries.update(entry.id, { scheduled_at: undefined } as any);
      }
    } else {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + offsetDays);
      if (isTask) {
        const orig = task?.scheduled_at ? new Date(task.scheduled_at) : new Date();
        targetDate.setHours(orig.getHours(), orig.getMinutes(), orig.getSeconds(), 0);
        if (onReschedule) {
          onReschedule(entry as TimelineEntry, targetDate);
        } else {
          await db.entries.update(entry.id, { scheduled_at: targetDate } as any);
        }
      } else if (isLog || isNote || isEvent) {
        const orig = (entry as any).timestamp ? new Date((entry as any).timestamp) : new Date();
        targetDate.setHours(orig.getHours(), orig.getMinutes(), orig.getSeconds(), 0);
        if (onReschedule) {
          onReschedule(entry as TimelineEntry, targetDate);
        } else {
          await db.entries.update(entry.id, { timestamp: targetDate } as any);
        }
      }
    }
    onClose();
  };

  const handleToggleListAssignment = async (listId: string) => {
    if (isBatch && onBatchAssignList && selectedTaskIds) {
      onBatchAssignList(selectedTaskIds, listId);
    } else if (isBatch && selectedTaskIds) {
      await db.transaction('rw', db.entries, async () => {
        for (const id of selectedTaskIds) {
          const item = await db.entries.get(id);
          if (item && item.type === 'task') {
            const current = item.category_ids ?? [];
            const updated = current.includes(listId)
              ? current.filter((cId) => cId !== listId)
              : [...current, listId];
            await db.entries.update(id, { category_ids: updated } as any);
          }
        }
      });
    } else if (task) {
      const currentListIds = task.category_ids ?? [];
      const updated = currentListIds.includes(listId)
        ? currentListIds.filter((id) => id !== listId)
        : [...currentListIds, listId];
      await db.entries.update(task.id, { category_ids: updated } as any);
    }
  };

  const handleDuplicate = async () => {
    const newEntry: any = {
      ...entry,
      id: crypto.randomUUID(),
      created_at: new Date(),
    };
    if (newEntry.type === 'task') {
      newEntry.status = 'todo';
      newEntry.time_spent = 0;
      delete newEntry.completed_at;
    }
    await db.entries.add(newEntry);
    onClose();
  };

  const handleConvert = async (targetType: 'task' | 'log' | 'note') => {
    if (entry.type === targetType) return;

    if (targetType === 'task') {
      const newTask: Task = {
        id: entry.id,
        type: 'task',
        title: entry.title || 'Untitled',
        status: 'todo',
        time_spent: (entry as any).time_spent || 0,
        content: (entry as any).content || '',
        scheduled_at: (entry as any).timestamp || (entry as any).scheduled_at || new Date(),
        created_at: entry.created_at || new Date(),
        category_ids: (entry as any).category_ids,
        starred: (entry as any).starred,
      };
      await db.entries.put(newTask as any);
    } else if (targetType === 'log') {
      const newLog: Log = {
        id: entry.id,
        type: 'log',
        title: entry.title || 'Untitled',
        timestamp: (entry as any).scheduled_at || (entry as any).timestamp || new Date(),
        created_at: entry.created_at || new Date(),
      };
      await db.entries.put(newLog as any);
    } else if (targetType === 'note') {
      const newNote: Note = {
        id: entry.id,
        type: 'note',
        title: entry.title || 'Untitled',
        content: (entry as any).content || '',
        timestamp: (entry as any).scheduled_at || (entry as any).timestamp || new Date(),
        created_at: entry.created_at || new Date(),
        category_ids: (entry as any).category_ids,
        pinned: (entry as any).pinned,
      };
      await db.entries.put(newNote as any);
    }
    onClose();
  };

  const handleCopyTitle = async () => {
    if (entry.title) {
      await navigator.clipboard.writeText(entry.title);
      setCopiedToast(true);
      setTimeout(() => onClose(), 400);
    }
  };

  const handleCopyMarkdown = async () => {
    const md = isTask
      ? `- [${task?.status === 'done' ? 'x' : ' '}] ${entry.title}`
      : `### ${entry.title}\n${(entry as any).content || ''}`;
    await navigator.clipboard.writeText(md.trim());
    setCopiedToast(true);
    setTimeout(() => onClose(), 400);
  };

  const handleDelete = () => {
    if (isBatch && onBatchDelete && selectedTaskIds) {
      onBatchDelete(selectedTaskIds);
    } else if (isBatch && selectedTaskIds) {
      db.entries.bulkDelete(selectedTaskIds);
    } else if (onDeleteEntry) {
      onDeleteEntry(entry.id);
    } else {
      db.entries.delete(entry.id);
    }
    onClose();
  };

  const handleEdit = () => {
    if (onOpenDetail && !isTimeBlock) {
      onOpenDetail(entry as TimelineEntry);
    }
    onClose();
  };

  return createPortal(
    <>
      <div
        ref={menuRef}
        role="menu"
        aria-label="Entry Context Menu"
        style={{
          position: 'fixed',
          left: `${adjustedPos.x}px`,
          top: `${adjustedPos.y}px`,
          zIndex: 99999,
        }}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => e.preventDefault()}
        className="w-64 max-h-[85vh] flex flex-col bg-[#121212] border border-stone-800/90 rounded-xl shadow-2xl shadow-black/80 text-stone-300 text-xs select-none animate-in fade-in zoom-in-95 duration-100 backdrop-blur-md"
      >
        {/* Header Info */}
        <div className="px-3 py-2 border-b border-stone-800/80 bg-stone-950/60 rounded-t-xl flex items-center justify-between gap-2 shrink-0">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isTask
                    ? 'bg-amber-400'
                    : isLog
                    ? 'bg-stone-400'
                    : isNote
                    ? 'bg-blue-400'
                    : isEvent
                    ? 'bg-indigo-400'
                    : 'bg-emerald-400'
                }`}
              />
              <span className="text-[10px] font-mono font-bold tracking-wider uppercase text-stone-400 truncate">
                {isBatch ? `${batchCount} Tasks Selected` : entry.type}
              </span>
            </div>
            <p
              className="text-xs font-serif font-medium text-stone-200 truncate mt-0.5"
              title={entry.title}
            >
              {isBatch ? `Batch actions for ${batchCount} tasks` : entry.title || 'Untitled'}
            </p>
          </div>
          {copiedToast && (
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-1.5 py-0.5 rounded animate-pulse shrink-0">
              Copied!
            </span>
          )}
        </div>

        <div className="p-1 space-y-0.5 overflow-y-auto flex-1 overscroll-contain">
          {/* Select / Deselect Action */}
          {onToggleSelect && (
            <button
              onClick={() => {
                onToggleSelect(entry.id);
                onClose();
              }}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 hover:text-stone-100 transition-colors cursor-pointer"
            >
              <CheckSquare
                className={`w-3.5 h-3.5 ${isSelected ? 'text-violet-400' : 'text-stone-400'}`}
              />
              <span>
                {isSelected
                  ? isBatch
                    ? `Deselect (${batchCount} tasks)`
                    : 'Deselect Task'
                  : 'Select Task'}
              </span>
            </button>
          )}

          {/* Primary Action: Focus Session for Single Task */}
          {isTask && !isBatch && (
            <button
              onClick={handleStartTimer}
              className={`flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left transition-colors cursor-pointer font-medium ${
                isTimerActive
                  ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                  : 'text-stone-200 hover:bg-stone-800/80 hover:text-amber-400'
              }`}
            >
              {isTimerActive ? (
                <>
                  <Square className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Active in Focus Bar</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                  <span>Start Focus Session</span>
                </>
              )}
            </button>
          )}

          {/* Status Section */}
          {isTask && (
            <div
              onMouseEnter={(e) => handleTriggerMouseEnter('status', e)}
              onMouseLeave={handleTriggerMouseLeave}
            >
              <button className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5">
                  {task?.status === 'done' ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : task?.status === 'in_progress' ? (
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                  ) : task?.status === 'dropped' ? (
                    <XCircle className="w-3.5 h-3.5 text-stone-500" />
                  ) : task?.status === 'maybe' ? (
                    <HelpCircle className="w-3.5 h-3.5 text-violet-400" />
                  ) : (
                    <CircleDashed className="w-3.5 h-3.5 text-stone-400" />
                  )}
                  <span>
                    Status:{' '}
                    <strong className="capitalize font-mono text-[11px] text-stone-200">
                      {isBatch ? 'Change status' : task?.status || 'todo'}
                    </strong>
                  </span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
              </button>
            </div>
          )}

          {/* Assign to Lists Submenu */}
          {isTask && taskLists.length > 0 && (
            <div
              onMouseEnter={(e) => handleTriggerMouseEnter('lists', e)}
              onMouseLeave={handleTriggerMouseLeave}
            >
              <button className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <ListTodo className="w-3.5 h-3.5 text-violet-400" />
                  <span>Assign to Lists</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
              </button>
            </div>
          )}

          {/* Reschedule / Date Submenu */}
          <div
            onMouseEnter={(e) => handleTriggerMouseEnter('reschedule', e)}
            onMouseLeave={handleTriggerMouseLeave}
          >
            <button className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer">
              <div className="flex items-center gap-2.5">
                <Calendar className="w-3.5 h-3.5 text-sky-400" />
                <span>Reschedule</span>
              </div>
              <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
            </button>
          </div>

          {/* Priority / Star / Pin */}
          {!isBatch && (isTask || isNote) && (
            <button
              onClick={isTask ? handleToggleStar : handleTogglePinned}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
            >
              <Star
                className={`w-3.5 h-3.5 ${
                  (entry as any).starred || (entry as any).pinned
                    ? 'text-amber-400 fill-amber-400'
                    : 'text-stone-400'
                }`}
              />
              <span>
                {isTask
                  ? (entry as any).starred
                    ? 'Remove Star'
                    : 'Star / High Priority'
                  : (entry as any).pinned
                  ? 'Unpin Note'
                  : 'Pin Note'}
              </span>
            </button>
          )}

          <div className="h-px bg-stone-800/80 my-1" />

          {/* Convert Submenu */}
          {!isBatch && (
            <div
              onMouseEnter={(e) => handleTriggerMouseEnter('convert', e)}
              onMouseLeave={handleTriggerMouseLeave}
            >
              <button className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400/80" />
                  <span>Convert to...</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
              </button>
            </div>
          )}

          {/* Copy Options */}
          {!isBatch && (
            <div
              onMouseEnter={(e) => handleTriggerMouseEnter('copy', e)}
              onMouseLeave={handleTriggerMouseLeave}
            >
              <button className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer">
                <div className="flex items-center gap-2.5">
                  <Copy className="w-3.5 h-3.5 text-stone-400" />
                  <span>Copy</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
              </button>
            </div>
          )}

          {/* Duplicate */}
          {!isBatch && (
            <button
              onClick={handleDuplicate}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
              <span>Duplicate</span>
            </button>
          )}

          {/* Edit Details */}
          {!isBatch && !isTimeBlock && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5 text-stone-400" />
              <span>Edit Details</span>
            </button>
          )}

          <div className="h-px bg-stone-800/80 my-1" />

          {/* Delete */}
          <button
            onClick={handleDelete}
            className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400" />
            <span>{isBatch ? `Delete (${batchCount} tasks)` : 'Delete Entry'}</span>
          </button>
        </div>
      </div>

      {/* Floating Submenu Portal Container */}
      {activeSubmenu && submenuPos && (
        <div
          id="context-menu-floating-submenu"
          style={{
            position: 'fixed',
            left: `${submenuPos.x}px`,
            top: `${submenuPos.y}px`,
            zIndex: 100000,
          }}
          onMouseEnter={handleSubmenuMouseEnter}
          onMouseLeave={handleSubmenuMouseLeave}
          className="w-48 bg-[#141414] border border-stone-800 rounded-xl shadow-2xl p-1 animate-in fade-in zoom-in-95 duration-75 text-xs text-stone-300 backdrop-blur-md select-none"
        >
          {activeSubmenu === 'status' && (
            <div className="space-y-0.5">
              <button
                onClick={() => handleUpdateTaskStatus('todo')}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
              >
                <CircleDashed className="w-3.5 h-3.5 text-stone-400" />
                <span>To-do</span>
              </button>
              <button
                onClick={() => handleUpdateTaskStatus('in_progress')}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
              >
                <Clock className="w-3.5 h-3.5 text-sky-400" />
                <span>In Progress</span>
              </button>
              <button
                onClick={() => handleUpdateTaskStatus('done')}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-emerald-400 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Completed</span>
              </button>
              <button
                onClick={() => handleUpdateTaskStatus('maybe')}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
              >
                <HelpCircle className="w-3.5 h-3.5 text-violet-400" />
                <span>Maybe / Later</span>
              </button>
              <button
                onClick={() => handleUpdateTaskStatus('dropped')}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-400 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
              >
                <XCircle className="w-3.5 h-3.5 text-stone-500" />
                <span>Dropped</span>
              </button>
            </div>
          )}

          {activeSubmenu === 'lists' && (
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {taskLists.map((list) => {
                const isAssigned = (task?.category_ids ?? []).includes(list.id);
                return (
                  <button
                    key={list.id}
                    onClick={() => handleToggleListAssignment(list.id)}
                    className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <CategoryIcon
                        name={list.icon}
                        color={list.color}
                        className="w-3.5 h-3.5 shrink-0"
                      />
                      <span className="truncate">{list.name}</span>
                    </div>
                    {isAssigned && !isBatch && (
                      <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {activeSubmenu === 'reschedule' && (
            <div className="space-y-0.5">
              <button
                onClick={() => handleQuickReschedule(0)}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
              >
                <CalendarDays className="w-3.5 h-3.5 text-amber-400" />
                <span>Today</span>
              </button>
              <button
                onClick={() => handleQuickReschedule(1)}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
              >
                <CalendarPlus className="w-3.5 h-3.5 text-sky-400" />
                <span>Tomorrow</span>
              </button>
              <button
                onClick={() => handleQuickReschedule(7)}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
              >
                <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                <span>Next Week (+7d)</span>
              </button>
              {isTask && (task?.scheduled_at || isBatch) && (
                <button
                  onClick={() => handleQuickReschedule(null)}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-400 hover:bg-stone-800 hover:text-stone-200 transition-colors cursor-pointer text-xs border-t border-stone-800/80 mt-1 pt-1.5"
                >
                  <CalendarOff className="w-3.5 h-3.5 text-stone-500" />
                  <span>Clear Date (Backlog)</span>
                </button>
              )}
            </div>
          )}

          {activeSubmenu === 'convert' && (
            <div className="space-y-0.5">
              {!isTask && (
                <button
                  onClick={() => handleConvert('task')}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
                >
                  <CircleDashed className="w-3.5 h-3.5 text-amber-400" />
                  <span>Convert to Task</span>
                </button>
              )}
              {!isLog && (
                <button
                  onClick={() => handleConvert('log')}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-stone-400 inline-block ml-0.5 mr-0.5" />
                  <span>Convert to Log</span>
                </button>
              )}
              {!isNote && (
                <button
                  onClick={() => handleConvert('note')}
                  className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
                >
                  <FileText className="w-3.5 h-3.5 text-blue-400" />
                  <span>Convert to Note</span>
                </button>
              )}
            </div>
          )}

          {activeSubmenu === 'copy' && (
            <div className="space-y-0.5">
              <button
                onClick={handleCopyTitle}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
              >
                <FileText className="w-3.5 h-3.5 text-stone-400" />
                <span>Copy Title</span>
              </button>
              <button
                onClick={handleCopyMarkdown}
                className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
              >
                <FileCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Copy Markdown</span>
              </button>
            </div>
          )}
        </div>
      )}
    </>,
    document.body
  );
}

