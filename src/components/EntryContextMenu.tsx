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
  Tag,
  ListTodo,
  FolderInput,
  Copy,
  FileCode,
  FileText,
  Repeat2,
  Trash2,
  Edit3,
  Sparkles,
  ChevronRight,
  ArrowRightLeft,
  CalendarOff,
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
}: EntryContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [adjustedPos, setAdjustedPos] = useState({ x, y });
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
  const [copiedToast, setCopiedToast] = useState(false);

  const taskLists = useLiveQuery(
    () => db.categories.where('scope').equals(TASK_LIST_SCOPE).toArray(),
    []
  ) || [];

  // Calculate boundary-aware coordinates
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
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    const handleWindowBlur = () => onClose();

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleWindowBlur);
    window.addEventListener('scroll', handleWindowBlur, true);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleWindowBlur);
      window.removeEventListener('scroll', handleWindowBlur, true);
    };
  }, [onClose]);

  if (!entry) return null;

  const isTask = entry.type === 'task';
  const isLog = entry.type === 'log';
  const isNote = entry.type === 'note';
  const isEvent = entry.type === 'event';
  const isTimeBlock = entry.type === 'time-block';
  const task = isTask ? (entry as Task) : null;
  const isTimerActive = isTask && activeTaskId === task?.id;

  // Handlers
  const handleStartTimer = () => {
    if (task && onActivateTask) {
      onActivateTask(task.id);
    }
    onClose();
  };

  const handleUpdateTaskStatus = async (status: TaskStatus) => {
    if (!task) return;
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
    if (offsetDays === null) {
      // Clear schedule (Move to Backlog)
      if (isTask) {
        await db.entries.update(entry.id, { scheduled_at: undefined } as any);
      }
      onClose();
      return;
    }

    const target = new Date();
    target.setDate(target.getDate() + offsetDays);

    if (isTask) {
      const orig = task?.scheduled_at ? new Date(task.scheduled_at) : new Date();
      target.setHours(orig.getHours(), orig.getMinutes(), orig.getSeconds(), 0);
      if (onReschedule) {
        onReschedule(entry as TimelineEntry, target);
      } else {
        await db.entries.update(entry.id, { scheduled_at: target } as any);
      }
    } else if (isLog || isNote || isEvent) {
      const orig = (entry as any).timestamp ? new Date((entry as any).timestamp) : new Date();
      target.setHours(orig.getHours(), orig.getMinutes(), orig.getSeconds(), 0);
      if (onReschedule) {
        onReschedule(entry as TimelineEntry, target);
      } else {
        await db.entries.update(entry.id, { timestamp: target } as any);
      }
    }
    onClose();
  };

  const handleToggleListAssignment = async (listId: string) => {
    if (!task) return;
    const currentListIds = task.category_ids ?? [];
    const updated = currentListIds.includes(listId)
      ? currentListIds.filter((id) => id !== listId)
      : [...currentListIds, listId];
    await db.entries.update(task.id, { category_ids: updated } as any);
    onClose();
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
    if (onDeleteEntry) {
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
              {entry.type}
            </span>
          </div>
          <p className="text-xs font-serif font-medium text-stone-200 truncate mt-0.5" title={entry.title}>
            {entry.title || 'Untitled'}
          </p>
        </div>
        {copiedToast && (
          <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 border border-emerald-800/60 px-1.5 py-0.5 rounded animate-pulse shrink-0">
            Copied!
          </span>
        )}
      </div>

      <div className="p-1 space-y-0.5 overflow-y-auto flex-1 overscroll-contain">
        {/* Primary Action: Focus Session for Task */}
        {isTask && (
          <>
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

            {/* Status Section */}
            <div
              className="relative"
              onMouseEnter={() => setActiveSubmenu('status')}
              onMouseLeave={() => setActiveSubmenu(null)}
            >
              <button
                className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
              >
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
                  <span>Status: <strong className="capitalize font-mono text-[11px] text-stone-200">{task?.status || 'todo'}</strong></span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
              </button>

              {/* Status Submenu */}
              {activeSubmenu === 'status' && (
                <div className="absolute left-full top-0 ml-1 w-44 bg-[#141414] border border-stone-800 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in duration-75">
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
            </div>

            {/* Move to List Submenu */}
            {taskLists.length > 0 && (
              <div
                className="relative"
                onMouseEnter={() => setActiveSubmenu('lists')}
                onMouseLeave={() => setActiveSubmenu(null)}
              >
                <button
                  className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    <ListTodo className="w-3.5 h-3.5 text-violet-400" />
                    <span>Move to List</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
                </button>

                {activeSubmenu === 'lists' && (
                  <div className="absolute left-full top-0 ml-1 w-48 max-h-56 overflow-y-auto bg-[#141414] border border-stone-800 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in duration-75">
                    {taskLists.map((list) => {
                      const isAssigned = (task?.category_ids ?? []).includes(list.id);
                      return (
                        <button
                          key={list.id}
                          onClick={() => handleToggleListAssignment(list.id)}
                          className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <CategoryIcon name={list.icon} color={list.color} className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">{list.name}</span>
                          </div>
                          {isAssigned && <CheckCircle2 className="w-3 h-3 text-amber-400 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* Reschedule / Date Submenu */}
        <div
          className="relative"
          onMouseEnter={() => setActiveSubmenu('reschedule')}
          onMouseLeave={() => setActiveSubmenu(null)}
        >
          <button
            className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span>Reschedule</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
          </button>

          {activeSubmenu === 'reschedule' && (
            <div className="absolute left-full top-0 ml-1 w-48 bg-[#141414] border border-stone-800 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in duration-75">
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
              {isTask && task?.scheduled_at && (
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
        </div>

        {/* Priority / Star / Pin */}
        {(isTask || isNote) && (
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
        <div
          className="relative"
          onMouseEnter={() => setActiveSubmenu('convert')}
          onMouseLeave={() => setActiveSubmenu(null)}
        >
          <button
            className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400/80" />
              <span>Convert to...</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
          </button>

          {activeSubmenu === 'convert' && (
            <div className="absolute left-full top-0 ml-1 w-44 bg-[#141414] border border-stone-800 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in duration-75">
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
        </div>

        {/* Copy Options */}
        <div
          className="relative"
          onMouseEnter={() => setActiveSubmenu('copy')}
          onMouseLeave={() => setActiveSubmenu(null)}
        >
          <button
            className="flex items-center justify-between w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Copy className="w-3.5 h-3.5 text-stone-400" />
              <span>Copy</span>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-stone-500" />
          </button>

          {activeSubmenu === 'copy' && (
            <div className="absolute left-full top-0 ml-1 w-44 bg-[#141414] border border-stone-800 rounded-xl shadow-2xl p-1 z-50 animate-in fade-in duration-75">
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

        {/* Duplicate */}
        <button
          onClick={handleDuplicate}
          className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-left text-stone-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400/80" />
          <span>Duplicate</span>
        </button>

        {/* Edit Details */}
        {!isTimeBlock && (
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
          <span>Delete Entry</span>
        </button>
      </div>
    </div>,
    document.body
  );
}
