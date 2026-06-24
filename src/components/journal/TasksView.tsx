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
  ChevronDown,
  CalendarClock,
  Inbox,
  X,
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
import { AnimatePresence, motion } from 'motion/react';
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

// ─── Calendar Modal ──────────────────────────────────────────────────────────

interface ScheduleCalendarModalProps {
  task: Task;
  onClose: () => void;
  onSelectDate: (taskId: string, date: Date) => void;
  onUnschedule: (taskId: string) => void;
}

function ScheduleCalendarModal({
  task,
  onClose,
  onSelectDate,
  onUnschedule,
}: ScheduleCalendarModalProps) {
  const today = new Date();
  const initialMonth = task.scheduled_at ? new Date(task.scheduled_at) : today;
  const [displayedMonth, setDisplayedMonth] = useState(
    new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
  );

  const year = displayedMonth.getFullYear();
  const month = displayedMonth.getMonth();
  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weekdays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const dayCells: (number | null)[] = [];
  for (let i = 0; i < firstDayOfWeek; i++) dayCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) dayCells.push(d);

  const monthLabel = displayedMonth.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const isSameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const handleDoToday = () => {
    onSelectDate(task.id, new Date());
    onClose();
  };

  const handleSelectDay = (day: number) => {
    const selected = new Date(year, month, day);
    const now = new Date();
    selected.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    onSelectDate(task.id, selected);
    onClose();
  };

  const handleUnschedule = () => {
    onUnschedule(task.id);
    onClose();
  };

  const scheduledDate = task.scheduled_at ? new Date(task.scheduled_at) : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="bg-[#141414] border border-stone-800 rounded-2xl shadow-2xl w-[340px] max-w-[90vw] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest mb-1">
                Schedule Task
              </p>
              <p className="text-sm font-serif font-semibold text-stone-200 line-clamp-1">
                {task.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer shrink-0 ml-2"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Do Today Quick Action */}
          <div className="px-5 pt-2 pb-3">
            <button
              onClick={handleDoToday}
              className="w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono font-bold uppercase tracking-widest hover:bg-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer active:scale-[0.98]"
            >
              ⚡ Do Today
            </button>
          </div>

          {/* Calendar */}
          <div className="px-5 pb-4">
            {/* Month header */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setDisplayedMonth(new Date(year, month - 1, 1))}
                className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-500 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="font-mono text-[11px] text-stone-400 uppercase tracking-widest font-semibold">
                {monthLabel}
              </span>
              <button
                onClick={() => setDisplayedMonth(new Date(year, month + 1, 1))}
                className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-500 hover:text-white transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Day grid */}
            <div className="grid grid-cols-7 text-center text-xs gap-1">
              {weekdays.map((wd) => (
                <span
                  key={wd}
                  className="text-stone-600 font-mono font-semibold py-1 text-[9px] uppercase tracking-widest"
                >
                  {wd}
                </span>
              ))}
              {dayCells.map((day, dIdx) => {
                if (day === null) return <span key={`blank-${dIdx}`} />;

                const cellDate = new Date(year, month, day);
                const isToday = isSameDay(cellDate, today);
                const isScheduledDay = scheduledDate ? isSameDay(cellDate, scheduledDate) : false;

                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => handleSelectDay(day)}
                    className={`py-1.5 text-[11px] font-mono rounded-lg transition-all cursor-pointer active:scale-95 ${
                      isScheduledDay
                        ? 'bg-amber-500 text-stone-950 font-bold shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                        : isToday
                          ? 'border border-amber-500/30 text-amber-400 font-semibold hover:bg-amber-500/10'
                          : 'text-stone-400 hover:bg-stone-800/60 hover:text-stone-200'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unschedule button (only when task has a scheduled date) */}
          {scheduledDate && (
            <div className="px-5 pb-4">
              <button
                onClick={handleUnschedule}
                className="w-full py-2 rounded-xl bg-stone-800/40 border border-stone-700/50 text-stone-400 text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-stone-800/70 hover:text-stone-300 transition-all cursor-pointer"
              >
                Make Dateless
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Collapsible Task Section ────────────────────────────────────────────────

interface TaskSectionProps {
  label: string;
  icon: React.ReactNode;
  accentColor: string; // tailwind color token e.g. 'amber'
  tasks: Task[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  deletingId: string | null;
  activeTaskId: string | null;
  totalPages: number;
  page: number;
  setPage: (p: number) => void;
  onDeleteEntry: (id: string) => void;
  onOpenDetail: (entry: TimelineEntry) => void;
  onToggleTaskStatus: (task: Task) => void;
  onActivateTask: (taskId: string) => void;
  onOpenScheduleModal: (task: Task) => void;
  formatTime: (dateInput: Date | string) => string;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (event: DragEndEvent) => void;
  movePopoverTaskId: string | null;
  setMovePopoverTaskId: (id: string | null) => void;
  handleMoveToPage: (taskId: string, targetPage: number) => void;
  formatScheduledBadge: (task: Task) => { label: string; isOverdue: boolean } | null;
  setActiveDate: (date: Date) => void;
}

function TaskSection({
  label,
  icon,
  accentColor,
  tasks,
  isCollapsed,
  onToggleCollapse,
  deletingId,
  activeTaskId,
  totalPages,
  page,
  setPage,
  onDeleteEntry,
  onOpenDetail,
  onToggleTaskStatus,
  onActivateTask,
  onOpenScheduleModal,
  formatTime,
  sensors,
  onDragEnd,
  movePopoverTaskId,
  setMovePopoverTaskId,
  handleMoveToPage,
  formatScheduledBadge,
  setActiveDate,
}: TaskSectionProps) {
  const safePage = Math.min(page, totalPages - 1);
  const pageTasks = tasks.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const renderTaskRow = (task: Task) => {
    const isActive = activeTaskId === task.id;
    const isDone = task.status === 'done';
    const hasAchievements = task.achievements && task.achievements.length > 0;
    const badge = formatScheduledBadge(task);
    const isDateless = !task.scheduled_at;

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

          {/* Scheduled Date Badge / Assign Date */}
          {badge ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenScheduleModal(task);
              }}
              title="Change scheduled date"
              className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors cursor-pointer hidden sm:inline-block ${
                badge.isOverdue
                  ? 'bg-red-950/20 border-red-800/30 text-red-400 hover:text-red-300 hover:border-red-700/50'
                  : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-emerald-400 hover:border-emerald-500/30'
              }`}
            >
              {badge.label}
            </button>
          ) : isDateless ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenScheduleModal(task);
              }}
              title="Assign a date"
              className="shrink-0 px-2 py-0.5 rounded-full border border-dashed border-stone-700 text-[10px] font-mono font-semibold uppercase tracking-wider text-stone-500 hover:text-amber-400 hover:border-amber-500/30 transition-colors cursor-pointer hidden sm:inline-block"
            >
              + Date
            </button>
          ) : null}

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

            {/* Schedule (mobile calendar icon) */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenScheduleModal(task);
              }}
              className="p-1.5 bg-transparent rounded border border-stone-800 hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition-colors cursor-pointer sm:hidden"
              title="Schedule date"
            >
              <Calendar className="w-3.5 h-3.5" />
            </button>

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
    <div className="mb-4">
      {/* Section Header */}
      <button
        onClick={onToggleCollapse}
        className="w-full flex items-center gap-2.5 px-1 py-2 group/header cursor-pointer"
      >
        <motion.div
          animate={{ rotate: isCollapsed ? -90 : 0 }}
          transition={{ duration: 0.15 }}
        >
          <ChevronDown className="w-3.5 h-3.5 text-stone-500 group-hover/header:text-stone-300 transition-colors" />
        </motion.div>
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-stone-400 group-hover/header:text-stone-200 transition-colors">
            {label}
          </span>
        </div>
        <span className="text-[10px] font-mono text-stone-600 ml-auto">
          {tasks.length} task{tasks.length !== 1 ? 's' : ''}
        </span>
      </button>

      {/* Collapsible Content */}
      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            style={{ overflow: 'hidden' }}
          >
            {/* Pagination info */}
            {tasks.length > 0 && totalPages > 1 && (
              <div className="px-1 py-0.5 text-[10px] font-mono text-stone-500 tracking-wider flex items-center justify-end mb-1.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={safePage === 0}
                    className="text-stone-500 hover:text-stone-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span>
                    Page {safePage + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={safePage >= totalPages - 1}
                    className="text-stone-500 hover:text-stone-300 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {pageTasks.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={onDragEnd}
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
            ) : (
              <div className="py-8 px-6 text-center text-stone-600 select-none">
                <p className="text-xs font-sans">No tasks in this section</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

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

  // Section collapse state
  const [scheduledCollapsed, setScheduledCollapsed] = useState(false);
  const [datelessCollapsed, setDatelessCollapsed] = useState(false);

  // Pagination per section
  const [scheduledPage, setScheduledPage] = useState(0);
  const [datelessPage, setDatelessPage] = useState(0);

  // Optimistic state per section
  const [optimisticScheduled, setOptimisticScheduled] = useState<Task[] | null>(null);
  const [optimisticDateless, setOptimisticDateless] = useState<Task[] | null>(null);

  // Move popover per section
  const [movePopoverTaskId, setMovePopoverTaskId] = useState<string | null>(null);

  // Schedule calendar modal
  const [scheduleModalTask, setScheduleModalTask] = useState<Task | null>(null);

  // ─── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ─── Extract tasks ────────────────────────────────────────────────────────
  const allTasks = useMemo(() => entries.filter((e): e is Task => e.type === 'task'), [entries]);

  // ─── Filter ──────────────────────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    let tasks = allTasks;

    if (statusFilter !== 'all') {
      tasks = tasks.filter((t) => t.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      tasks = tasks.filter((t) => {
        const title = (t.title || '').toLowerCase();
        const content = (t.content || '').toLowerCase();
        return title.includes(q) || content.includes(q);
      });
    }

    return tasks;
  }, [allTasks, statusFilter, searchQuery]);

  // ─── Split into scheduled and dateless ─────────────────────────────────────
  const { scheduledTasks, datelessTasks } = useMemo(() => {
    const scheduled: Task[] = [];
    const dateless: Task[] = [];

    filteredTasks.forEach((t) => {
      if (t.scheduled_at) {
        scheduled.push(t);
      } else {
        dateless.push(t);
      }
    });

    // Sort scheduled: sort_order, then scheduled_at, then created_at
    scheduled.sort((a, b) => {
      const aSort = a.sort_order ?? Infinity;
      const bSort = b.sort_order ?? Infinity;
      if (aSort !== bSort) return aSort - bSort;
      const aSched = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
      const bSched = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
      if (aSched !== bSched) return aSched - bSched;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Sort dateless: sort_order, then created_at
    dateless.sort((a, b) => {
      const aSort = a.sort_order ?? Infinity;
      const bSort = b.sort_order ?? Infinity;
      if (aSort !== bSort) return aSort - bSort;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    return { scheduledTasks: scheduled, datelessTasks: dateless };
  }, [filteredTasks]);

  // ─── Display lists (optimistic override) ──────────────────────────────────
  const displayScheduled = optimisticScheduled ?? scheduledTasks;
  const displayDateless = optimisticDateless ?? datelessTasks;

  // ─── Pagination ────────────────────────────────────────────────────────────
  const scheduledTotalPages = Math.max(1, Math.ceil(displayScheduled.length / PAGE_SIZE));
  const datelessTotalPages = Math.max(1, Math.ceil(displayDateless.length / PAGE_SIZE));

  // Reset pages when filters change
  React.useEffect(() => {
    setScheduledPage(0);
    setDatelessPage(0);
  }, [statusFilter, searchQuery]);

  // ─── DragEnd Handlers ─────────────────────────────────────────────────────
  const createDragEndHandler = useCallback(
    (
      displayList: Task[],
      safePage: number,
      setOptimistic: React.Dispatch<React.SetStateAction<Task[] | null>>,
      filteredList: Task[],
    ) =>
      async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const pageTasks = displayList.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
        const pageIds = pageTasks.map((t) => t.id);
        const oldIndex = pageIds.indexOf(active.id as string);
        const newIndex = pageIds.indexOf(over.id as string);
        if (oldIndex === -1 || newIndex === -1) return;

        const reorderedIds = arrayMove(pageIds, oldIndex, newIndex);

        setOptimistic((prev) => {
          const base = prev ?? filteredList;
          const idSet = new Set(reorderedIds);
          const rest = base.filter((t) => !idSet.has(t.id));
          const reorderedPage = reorderedIds
            .map((id) => base.find((t) => t.id === id)!)
            .filter(Boolean);
          const pageStart = safePage * PAGE_SIZE;
          const before = rest.slice(0, pageStart);
          const after = rest.slice(pageStart);
          return [...before, ...reorderedPage, ...after];
        });

        for (let i = 0; i < reorderedIds.length; i++) {
          await db.entries.update(reorderedIds[i], {
            sort_order: safePage * PAGE_SIZE + i,
          } as any);
        }

        setTimeout(() => setOptimistic(null), 2000);
      },
    [],
  );

  const scheduledSafePage = Math.min(scheduledPage, scheduledTotalPages - 1);
  const datelessSafePage = Math.min(datelessPage, datelessTotalPages - 1);

  const handleScheduledDragEnd = useMemo(
    () =>
      createDragEndHandler(
        displayScheduled,
        scheduledSafePage,
        setOptimisticScheduled,
        scheduledTasks,
      ),
    [createDragEndHandler, displayScheduled, scheduledSafePage, scheduledTasks],
  );

  const handleDatelessDragEnd = useMemo(
    () =>
      createDragEndHandler(displayDateless, datelessSafePage, setOptimisticDateless, datelessTasks),
    [createDragEndHandler, displayDateless, datelessSafePage, datelessTasks],
  );

  // ─── MoveToPage Handlers ──────────────────────────────────────────────────
  const createMoveToPageHandler = useCallback(
    (
      displayList: Task[],
      safePage: number,
      setOptimistic: React.Dispatch<React.SetStateAction<Task[] | null>>,
      setPageFn: React.Dispatch<React.SetStateAction<number>>,
    ) =>
      async (taskId: string, targetPage: number) => {
        if (targetPage === safePage) {
          setMovePopoverTaskId(null);
          return;
        }

        const fullList = [...displayList];
        const movedIdx = fullList.findIndex((t) => t.id === taskId);
        if (movedIdx === -1) {
          setMovePopoverTaskId(null);
          return;
        }

        const [movedTask] = fullList.splice(movedIdx, 1);
        const targetStart = targetPage * PAGE_SIZE;
        const targetEnd = targetStart + PAGE_SIZE - 1;

        if (targetEnd < fullList.length) {
          const [bumpedTask] = fullList.splice(targetStart, 1);
          fullList.splice(movedIdx, 0, bumpedTask);
          fullList.splice(targetEnd, 0, movedTask);
        } else {
          const insertAt = Math.min(targetEnd, fullList.length);
          fullList.splice(insertAt, 0, movedTask);
        }

        setOptimistic(fullList);

        await db.transaction('rw', db.entries, async () => {
          for (let i = 0; i < fullList.length; i++) {
            await db.entries.update(fullList[i].id, { sort_order: i } as any);
          }
        });

        setPageFn(targetPage);
        setMovePopoverTaskId(null);
        setTimeout(() => setOptimistic(null), 2000);
      },
    [],
  );

  const handleScheduledMoveToPage = useMemo(
    () =>
      createMoveToPageHandler(
        displayScheduled,
        scheduledSafePage,
        setOptimisticScheduled,
        setScheduledPage,
      ),
    [createMoveToPageHandler, displayScheduled, scheduledSafePage],
  );

  const handleDatelessMoveToPage = useMemo(
    () =>
      createMoveToPageHandler(
        displayDateless,
        datelessSafePage,
        setOptimisticDateless,
        setDatelessPage,
      ),
    [createMoveToPageHandler, displayDateless, datelessSafePage],
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

  // ─── Schedule Modal Handlers ──────────────────────────────────────────────
  const handleSelectDate = async (taskId: string, date: Date) => {
    onCarryTask(taskId, date);
  };

  const handleUnschedule = async (taskId: string) => {
    await db.entries.update(taskId, { scheduled_at: undefined } as any);
  };

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
      {(displayScheduled.length > 0 || displayDateless.length > 0) && (
        <div className="px-1 py-0.5 text-[10px] font-mono text-stone-500 tracking-wider mt-3 mb-1.5">
          <span>
            {displayScheduled.length + displayDateless.length} task
            {displayScheduled.length + displayDateless.length !== 1 ? 's' : ''}
            {statusFilter === 'todo' ? ' to do' : statusFilter === 'done' ? ' completed' : ' total'}
            {searchQuery.trim() ? ` matching "${searchQuery.trim()}"` : ''}
          </span>
        </div>
      )}

      {/* Dateless Tasks Section */}
      <TaskSection
        label="Dateless Tasks"
        icon={<Inbox className="w-3.5 h-3.5 text-violet-400" />}
        accentColor="violet"
        tasks={displayDateless}
        isCollapsed={datelessCollapsed}
        onToggleCollapse={() => setDatelessCollapsed((p) => !p)}
        deletingId={deletingId}
        activeTaskId={activeTaskId}
        totalPages={datelessTotalPages}
        page={datelessPage}
        setPage={setDatelessPage}
        onDeleteEntry={onDeleteEntry}
        onOpenDetail={onOpenDetail}
        onToggleTaskStatus={onToggleTaskStatus}
        onActivateTask={onActivateTask}
        onOpenScheduleModal={setScheduleModalTask}
        formatTime={formatTime}
        sensors={sensors}
        onDragEnd={handleDatelessDragEnd}
        movePopoverTaskId={movePopoverTaskId}
        setMovePopoverTaskId={setMovePopoverTaskId}
        handleMoveToPage={handleDatelessMoveToPage}
        formatScheduledBadge={formatScheduledBadge}
        setActiveDate={setActiveDate}
      />

      {/* Scheduled Tasks Section */}
      <TaskSection
        label="Scheduled Tasks"
        icon={<CalendarClock className="w-3.5 h-3.5 text-amber-400" />}
        accentColor="amber"
        tasks={displayScheduled}
        isCollapsed={scheduledCollapsed}
        onToggleCollapse={() => setScheduledCollapsed((p) => !p)}
        deletingId={deletingId}
        activeTaskId={activeTaskId}
        totalPages={scheduledTotalPages}
        page={scheduledPage}
        setPage={setScheduledPage}
        onDeleteEntry={onDeleteEntry}
        onOpenDetail={onOpenDetail}
        onToggleTaskStatus={onToggleTaskStatus}
        onActivateTask={onActivateTask}
        onOpenScheduleModal={setScheduleModalTask}
        formatTime={formatTime}
        sensors={sensors}
        onDragEnd={handleScheduledDragEnd}
        movePopoverTaskId={movePopoverTaskId}
        setMovePopoverTaskId={setMovePopoverTaskId}
        handleMoveToPage={handleScheduledMoveToPage}
        formatScheduledBadge={formatScheduledBadge}
        setActiveDate={setActiveDate}
      />

      {/* Empty state */}
      {displayScheduled.length === 0 && displayDateless.length === 0 && (
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

      {/* Schedule Calendar Modal */}
      {scheduleModalTask && (
        <ScheduleCalendarModal
          task={scheduleModalTask}
          onClose={() => setScheduleModalTask(null)}
          onSelectDate={handleSelectDate}
          onUnschedule={handleUnschedule}
        />
      )}
    </div>
  );
}
