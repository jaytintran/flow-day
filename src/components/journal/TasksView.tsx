/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Search,
  Play,
  Calendar,
  Trash2,
  ListTodo,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import SortableRow from '../SortableRow';
import { db } from '../../db';
import { TimelineEntry, Task } from '../../types';

interface TasksViewProps {
  entries: TimelineEntry[];
  deletingId: string | null;
  activeTaskId: string | null;
  setActiveDate: (date: Date) => void;
  onDeleteEntry: (id: string) => void;
  onOpenDetail: (entry: TimelineEntry) => void;
  onToggleTaskStatus: (task: Task) => void;
  onActivateTask: (taskId: string) => void;
  onCarryTask: (taskId: string, targetDate: Date) => void;
  formatTime: (dateInput: Date | string) => string;
  formatDateStringLabel: (dayStr: string) => string;
}

const PAGE_SIZE = 9;

export default function TasksView({
  entries,
  deletingId,
  activeTaskId,
  setActiveDate,
  onDeleteEntry,
  onOpenDetail,
  onToggleTaskStatus,
  onActivateTask,
  onCarryTask,
  formatTime,
  formatDateStringLabel,
}: TasksViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todo' | 'done' | 'all'>('todo');
  const [page, setPage] = useState(0);
  const [optimisticTasks, setOptimisticTasks] = useState<Task[] | null>(null);
  const [movePopoverTaskId, setMovePopoverTaskId] = useState<string | null>(null);

  // ─── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ─── Extract tasks ────────────────────────────────────────────────────────
  const allTasks = useMemo(() => entries.filter((e): e is Task => e.type === 'task'), [entries]);

  // ─── Filter and sort ──────────────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    let tasks = allTasks;

    // Apply status filter
    if (statusFilter !== 'all') {
      tasks = tasks.filter((t) => t.status === statusFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tasks = tasks.filter((t) => {
        const title = (t.title || '').toLowerCase();
        const content = (t.content || '').toLowerCase();
        return title.includes(q) || content.includes(q);
      });
    }

    // Sort: sort_order (nulls last), then scheduled_at (nulls last), then created_at
    return [...tasks].sort((a, b) => {
      const aSort = a.sort_order ?? Infinity;
      const bSort = b.sort_order ?? Infinity;
      if (aSort !== bSort) return aSort - bSort;
      const aSched = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
      const bSched = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
      if (aSched !== bSched) return aSched - bSched;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
  }, [allTasks, statusFilter, searchQuery]);

  // ─── Display list (optimistic override) ────────────────────────────────────
  const displayTasks = optimisticTasks ?? filteredTasks;

  // ─── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(displayTasks.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const pageTasks = displayTasks.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  // Reset page to 0 when filters change
  React.useEffect(() => {
    setPage(0);
  }, [statusFilter, searchQuery]);

  // ─── handleDragEnd ────────────────────────────────────────────────────────
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const pageIds = pageTasks.map((t) => t.id);
      const oldIndex = pageIds.indexOf(active.id as string);
      const newIndex = pageIds.indexOf(over.id as string);
      if (oldIndex === -1 || newIndex === -1) return;

      const reorderedIds = arrayMove(pageIds, oldIndex, newIndex);

      // Optimistic: rebuild the full displayTasks with the page reordered
      setOptimisticTasks((prev) => {
        const base = prev ?? filteredTasks;
        const idSet = new Set(reorderedIds);
        const rest = base.filter((t) => !idSet.has(t.id));
        // Build reordered page items
        const reorderedPage = reorderedIds
          .map((id) => base.find((t) => t.id === id)!)
          .filter(Boolean);
        // Splice them back in at page start
        const pageStart = safePage * PAGE_SIZE;
        const before = rest.slice(0, pageStart);
        const after = rest.slice(pageStart);
        return [...before, ...reorderedPage, ...after];
      });

      // Persist sort_order only for the current page (items moved within it)
      for (let i = 0; i < reorderedIds.length; i++) {
        await db.entries.update(reorderedIds[i], { sort_order: safePage * PAGE_SIZE + i } as any);
      }

      setTimeout(() => setOptimisticTasks(null), 2000);
    },
    [pageTasks, filteredTasks, safePage],
  );

  // ─── handleMoveToPage ─────────────────────────────────────────────────────
  const handleMoveToPage = useCallback(
    async (taskId: string, targetPage: number) => {
      const sourcePage = safePage;
      if (targetPage === sourcePage) {
        setMovePopoverTaskId(null);
        return;
      }

      const fullList = [...displayTasks];
      const movedIdx = fullList.findIndex((t) => t.id === taskId);
      if (movedIdx === -1) {
        setMovePopoverTaskId(null);
        return;
      }

      const [movedTask] = fullList.splice(movedIdx, 1);

      // Calculate target page boundaries in the reduced list
      const targetStart = targetPage * PAGE_SIZE;
      const targetEnd = targetStart + PAGE_SIZE - 1; // last index of the target page

      if (targetEnd < fullList.length) {
        // Target page is full — bump its first item to the source slot
        const [bumpedTask] = fullList.splice(targetStart, 1);
        // Insert bumped task at the moved item's original position
        fullList.splice(movedIdx, 0, bumpedTask);
        // Insert moved task at the end of target page
        fullList.splice(targetEnd, 0, movedTask);
      } else {
        // Target page has room — just append at the end of target page (or end of array)
        const insertAt = Math.min(targetEnd, fullList.length);
        fullList.splice(insertAt, 0, movedTask);
      }

      // Optimistic update
      setOptimisticTasks(fullList);

      // Persist sort_order for all items
      await db.transaction('rw', db.entries, async () => {
        for (let i = 0; i < fullList.length; i++) {
          await db.entries.update(fullList[i].id, { sort_order: i } as any);
        }
      });

      // Navigate to target page so user sees the moved task
      setPage(targetPage);
      setMovePopoverTaskId(null);

      setTimeout(() => setOptimisticTasks(null), 2000);
    },
    [displayTasks, safePage],
  );

  // ─── Close move popover on outside click ──────────────────────────────────
  React.useEffect(() => {
    if (!movePopoverTaskId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(`[data-move-popover]`)) {
        setMovePopoverTaskId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [movePopoverTaskId]);

  // ─── Helpers ──────────────────────────────────────────────────────────────
  const formatScheduledBadge = (task: Task): { label: string; isOverdue: boolean } | null => {
    const date = task.scheduled_at;
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((targetDay.getTime() - today.getTime()) / 86400000);

    if (diffDays === 0) return { label: 'Today', isOverdue: false };
    if (diffDays === 1) return { label: 'Tomorrow', isOverdue: false };
    if (diffDays === -1) return { label: 'Yesterday', isOverdue: true };
    if (diffDays < -1) return { label: `${Math.abs(diffDays)}d ago`, isOverdue: true };
    if (diffDays <= 7) return { label: `${diffDays}d left`, isOverdue: false };
    return {
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      isOverdue: false,
    };
  };

  const handleScheduledDateClick = (task: Task) => {
    if (task.scheduled_at) {
      setActiveDate(new Date(task.scheduled_at));
    }
  };

  // ─── Render task row ──────────────────────────────────────────────────────
  const renderTaskRow = (task: Task) => {
    const isActive = activeTaskId === task.id;
    const isDone = task.status === 'done';
    const hasAchievements = task.achievements && task.achievements.length > 0;
    const badge = formatScheduledBadge(task);

    return (
      <SortableRow key={task.id} id={task.id}>
        <div
          id={`tasks-view-row-${task.id}`}
          onClick={() => onOpenDetail(task)}
          className={`group/row relative flex items-center gap-3 px-3 py-2.5 last:border-b-0 hover:bg-stone-900/40 transition-colors cursor-pointer ${
            isActive ? 'border-l-2 border-l-amber-500 bg-amber-500/5' : ''
          }`}
        >
          {/* Checkbox */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleTaskStatus(task);
            }}
            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
              isDone
                ? 'bg-stone-800 border-stone-700 text-stone-400'
                : 'border-stone-700 bg-[#0a0a0a] text-transparent hover:text-stone-400 hover:bg-stone-900/60'
            }`}
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </button>

          {/* Title + info row */}
          <div className="flex-1 min-w-0">
            <p
              className={`font-serif text-sm font-semibold line-clamp-1 ${
                isDone
                  ? hasAchievements
                    ? 'text-amber-400/80 line-through'
                    : 'text-stone-600 line-through'
                  : 'text-stone-200'
              }`}
            >
              {isDone && hasAchievements && <span className="mr-1.5 not-italic">🏆</span>}
              {task.title}
            </p>
            <div className="flex items-center gap-x-1.5 mt-1">
              <span className="flex items-center gap-1 text-[10px] font-mono text-stone-500">
                Created: {formatTime(task.created_at)}
              </span>
              {task.time_spent > 0 && (
                <span className="text-[10px] font-mono text-stone-600">
                  · {Math.floor(task.time_spent / 60000)}m spent
                </span>
              )}
              {isDone && task.completed_at && (
                <span className="flex items-center gap-0.5 text-[10px] font-mono text-emerald-500">
                  · ✓ {formatTime(task.completed_at)}
                </span>
              )}
            </div>
          </div>

          {/* Scheduled Date Badge */}
          {/* {badge && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleScheduledDateClick(task);
              }}
              title="Jump to scheduled date"
              className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors cursor-pointer hidden sm:inline-block ${
                badge.isOverdue
                  ? 'bg-red-950/20 border-red-800/30 text-red-400 hover:text-red-300 hover:border-red-700/50'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-emerald-400 hover:border-emerald-500/30'
              }`}
            >
              {badge.label}
            </button>
          )}
          {!badge && <div className="shrink-0 hidden sm:block w-16" />} */}

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover/row:opacity-100 transition-opacity shrink-0">
            {/* Activate */}
            {!isDone && !isActive && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onActivateTask(task.id);
                }}
                className="p-1.5 bg-transparent rounded border border-stone-800 hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                title="Activate as Working Task"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
              </button>
            )}

            {/* Move to Page (only when multiple pages exist) */}
            {totalPages > 1 && (
              <div className="relative" data-move-popover>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMovePopoverTaskId(movePopoverTaskId === task.id ? null : task.id);
                  }}
                  className="p-1.5 bg-transparent rounded border border-stone-800 hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition-colors cursor-pointer"
                  title="Move to page"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5" />
                </button>

                {/* Page picker popover */}
                {movePopoverTaskId === task.id && (
                  <div
                    className="absolute bottom-full mb-1.5 right-0 bg-[#141414] border border-stone-700 rounded-lg p-2 shadow-xl z-50"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <p className="text-[9px] font-mono text-stone-500 uppercase tracking-wider mb-1.5 px-0.5">
                      Move to page
                    </p>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button
                          key={i}
                          onClick={() => handleMoveToPage(task.id, i)}
                          disabled={i === safePage}
                          className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-mono font-bold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                            i === safePage
                              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                              : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200 border border-stone-700'
                          }`}
                          title={`Page ${i + 1}${i === safePage ? ' (current)' : ''}`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Reschedule
            <div
              className="relative p-1.5 rounded border border-stone-800 hover:bg-stone-800 text-stone-400 hover:text-sky-400 transition-colors cursor-pointer"
              title="Reschedule Date"
              onClick={(e) => e.stopPropagation()}
            >
              <Calendar className="w-3.5 h-3.5" />
              <input
                type="date"
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                onChange={(e) => {
                  if (!e.target.value) return;
                  onCarryTask(task.id, new Date(e.target.value));
                }}
              />
            </div> */}

            {/* Delete */}
            {deletingId === task.id ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteEntry(task.id);
                }}
                className="px-2 py-1 text-[10px] bg-red-950/80 border border-red-800/80 rounded text-red-400 font-mono font-bold hover:bg-red-900 transition-colors cursor-pointer"
                title="Confirm delete"
              >
                Sure?
              </button>
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteEntry(task.id);
                }}
                className="p-1.5 bg-transparent rounded border border-stone-800 hover:bg-stone-800 text-stone-500 hover:text-red-400 transition-colors cursor-pointer"
                title="Delete Task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </SortableRow>
    );
  };

  return (
    <div className="space-y-0" id="tasks-view-dashboard">
      {/* Sticky search and filter control header */}
      <div className="z-20 bg-[#0a0a0a] py-0 border-b border-stone-900/60 flex items-center justify-between gap-3">
        <div className="relative flex items-center flex-1 max-w-[200px] sm:max-w-xs">
          <Search className="absolute left-2.5 w-3.5 h-3.5 text-stone-500 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            className="w-full sm:w-64 pl-7 pr-2.5 py-1.5 text-[11px] font-mono bg-[#0a0a0a] border border-stone-800 rounded-lg text-stone-300 placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
          />
        </div>

        <div className="flex items-center gap-1 bg-[#0a0a0a] border border-stone-800 rounded-lg p-0.5 w-fit">
          <button
            onClick={() => setStatusFilter('todo')}
            className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
              statusFilter === 'todo'
                ? 'bg-stone-800 text-stone-200 shadow-sm'
                : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            Todo
          </button>
          <button
            onClick={() => setStatusFilter('done')}
            className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
              statusFilter === 'done'
                ? 'bg-emerald-900/60 text-emerald-300 shadow-sm'
                : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            Done
          </button>
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-stone-800 text-stone-200 shadow-sm'
                : 'text-stone-500 hover:text-stone-300'
            }`}
          >
            All
          </button>
        </div>
      </div>

      {/* Task count summary */}
      {displayTasks.length > 0 && (
        <div className="px-1 py-0.5 text-[10px] font-mono text-stone-500 tracking-wider flex items-center justify-between mt-3 mb-1.5">
          <span>
            {displayTasks.length} task{displayTasks.length !== 1 ? 's' : ''}
            {statusFilter === 'todo' ? ' to do' : statusFilter === 'done' ? ' completed' : ' total'}
            {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ''}
          </span>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="text-stone-500 hover:text-stone-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>

              <span>
                Page {safePage + 1} of {totalPages}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="text-stone-500 hover:text-stone-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Task list */}
      {pageTasks.length > 0 ? (
        <>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={pageTasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="border border-stone-900/60 rounded-xl overflow-hidden">
                {pageTasks.map((task) => renderTaskRow(task))}
              </div>
            </SortableContext>
          </DndContext>
        </>
      ) : (
        <div className="py-24 px-6 text-center text-stone-500 select-none">
          <ListTodo className="w-12 h-12 text-stone-800 mx-auto mb-4" />
          <h4 className="font-sans font-medium text-sm text-stone-400 mb-1">
            {searchQuery.trim()
              ? 'No matching tasks'
              : statusFilter === 'todo'
                ? 'No open tasks'
                : statusFilter === 'done'
                  ? 'No completed tasks'
                  : 'No tasks yet'}
          </h4>
          <p className="text-xs font-sans max-w-md mx-auto leading-relaxed text-stone-500">
            {searchQuery.trim()
              ? 'Try a different search term.'
              : statusFilter === 'todo'
                ? 'All your tasks are done. Create new tasks using the input engine below.'
                : statusFilter === 'done'
                  ? 'Complete some tasks and they will show up here.'
                  : 'Start creating tasks using the input engine below to build your task list.'}
          </p>
        </div>
      )}
    </div>
  );
}
