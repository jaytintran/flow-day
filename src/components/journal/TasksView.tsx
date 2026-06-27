import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
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
  ClipboardList,
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
import { TimelineEntry, Task, TaskAchievement, Category } from '../../types';

import { useLiveQuery } from 'dexie-react-hooks';
import { MoreHorizontal } from 'lucide-react';
import TaskListManagerModal from '../TaskListManagerModal'; // adjust path as needed
import { TASK_LIST_SCOPE } from '../../utils';

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

// ─── Move to Page Modal ──────────────────────────────────────────────────────

interface MoveToPageModalProps {
  task: Task;
  currentPage: number;
  totalPages: number;
  onClose: () => void;
  onSelectPage: (taskId: string, page: number) => void;
}

function MoveToPageModal({
  task,
  currentPage,
  totalPages,
  onClose,
  onSelectPage,
}: MoveToPageModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onMouseDown={(e) => e.stopPropagation()}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className="bg-[#141414] border border-stone-800 rounded-2xl shadow-2xl w-[300px] max-w-[90vw] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest mb-1">
                Move to Page
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

          {/* Page buttons */}
          <div className="px-5 pb-5 pt-2">
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onSelectPage(task.id, i);
                    onClose();
                  }}
                  disabled={i === currentPage}
                  className={`py-1.5 px-2 rounded border text-xs font-mono font-bold transition-all cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed ${
                    i === currentPage
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                      : 'border-stone-700 bg-stone-900/50 text-stone-300 hover:bg-stone-800 hover:border-stone-600'
                  }`}
                  title={`Page ${i + 1}${i === currentPage ? ' (current)' : ''}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

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
        onMouseDown={(e) => e.stopPropagation()}
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
  handleMoveToPage: (taskId: string, targetPage: number) => void;
  formatScheduledBadge: (task: Task) => { label: string; isOverdue: boolean } | null;
  setActiveDate: (date: Date) => void;
  showContent: boolean;
  taskLists: Category[];
  listPickerTaskId: string | null;
  setListPickerTaskId: (id: string | null) => void;
  moveToPageModalTask: Task | null;
  setMoveToPageModalTask: (task: Task | null) => void;
}

// ─── List Picker Popover ─────────────────────────────────────────────────────

interface ListPickerPopoverProps {
  task: Task;
  lists: Category[];
  onClose: () => void;
}

function ListPickerPopover({ task, lists, onClose }: ListPickerPopoverProps) {
  const currentIds = task.category_ids ?? [];

  const COLORS: Record<string, { dot: string; active: string }> = {
    violet: {
      dot: 'bg-violet-500',
      active: 'text-violet-300 border-violet-500/40 bg-violet-500/10',
    },
    sky: { dot: 'bg-sky-500', active: 'text-sky-300 border-sky-500/40 bg-sky-500/10' },
    emerald: {
      dot: 'bg-emerald-500',
      active: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
    },
    amber: { dot: 'bg-amber-500', active: 'text-amber-300 border-amber-500/40 bg-amber-500/10' },
    rose: { dot: 'bg-rose-500', active: 'text-rose-300 border-rose-500/40 bg-rose-500/10' },
    indigo: {
      dot: 'bg-indigo-500',
      active: 'text-indigo-300 border-indigo-500/40 bg-indigo-500/10',
    },
    teal: { dot: 'bg-teal-500', active: 'text-teal-300 border-teal-500/40 bg-teal-500/10' },
    orange: {
      dot: 'bg-orange-500',
      active: 'text-orange-300 border-orange-500/40 bg-orange-500/10',
    },
  };

  const handleToggle = async (listId: string) => {
    const next = currentIds.includes(listId)
      ? currentIds.filter((id) => id !== listId)
      : [...currentIds, listId];
    await db.entries.update(task.id, { category_ids: next } as any);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1100] flex items-center justify-center p-4 font-sans"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 12 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs bg-[#131313] border border-stone-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-stone-800/60">
            <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400">
              Assign to List
            </span>
            <button
              onClick={onClose}
              className="p-1 text-stone-500 hover:text-stone-300 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content */}
          <div className="p-4">
            {lists.length === 0 ? (
              <p className="text-xs font-mono text-stone-500 text-center py-6">
                No lists yet — create one via ···
              </p>
            ) : (
              <div className="flex flex-col gap-1">
                {lists.map((list) => {
                  const cs = COLORS[list.color] ?? COLORS['violet'];
                  const isAssigned = currentIds.includes(list.id);
                  return (
                    <button
                      key={list.id}
                      onClick={() => handleToggle(list.id)}
                      className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                        isAssigned
                          ? cs.active
                          : 'border-transparent text-stone-400 hover:bg-stone-800 hover:text-stone-200'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${cs.dot}`} />
                      <span className="truncate flex-1 text-left">{list.name}</span>
                      {isAssigned && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Paper List Modal ─────────────────────────────────────────────────────────

interface PaperListModalProps {
  tasks: Task[];
  onClose: () => void;
  onToggleTaskStatus: (task: Task) => void;
  onDeleteEntry: (id: string) => void;
  deletingId: string | null;
}

function PaperListModal({
  tasks,
  onClose,
  onToggleTaskStatus,
  onDeleteEntry,
  deletingId,
}: PaperListModalProps) {
  const doneCount = tasks.filter((t) => t.status === 'done').length;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, y: 80 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 80 }}
          transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
          className="bg-[#111] border border-stone-800 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:w-[480px] sm:max-w-[90vw] flex flex-col max-h-[85vh] sm:max-h-[80vh] overflow-hidden pb-10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-900/60 shrink-0">
            <div>
              <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest mb-0.5">
                Paper List
              </p>
              <p className="text-[10px] font-mono text-stone-600">
                {doneCount}/{tasks.length} done
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto">
            {tasks.length === 0 ? (
              <div className="py-12 text-center text-stone-600">
                <p className="text-xs font-mono">No dateless tasks</p>
              </div>
            ) : (
              <div className="divide-y divide-stone-900/30">
                {tasks.map((task) => {
                  const isDone = task.status === 'done';
                  const isDeleting = deletingId === task.id;
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center gap-2.5 px-4 py-[7px] group/line hover:bg-stone-900/30 transition-colors ${
                        isDone ? 'opacity-45' : ''
                      }`}
                    >
                      {/* Complete */}
                      <button
                        onClick={() => onToggleTaskStatus(task)}
                        className={`w-[15px] h-[15px] rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                          isDone
                            ? 'bg-stone-700 border-stone-600 text-stone-400'
                            : 'border-stone-700 bg-transparent text-transparent hover:text-stone-500 hover:border-stone-500'
                        }`}
                      >
                        <Check className="w-2.5 h-2.5 stroke-[3]" />
                      </button>

                      {/* Title */}
                      <span
                        className={`flex-1 min-w-0 text-[12px] font-mono truncate leading-tight ${
                          isDone ? 'line-through text-stone-600' : 'text-stone-300'
                        }`}
                      >
                        {task.title}
                      </span>

                      {/* Delete */}
                      {isDeleting ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteEntry(task.id);
                          }}
                          className="px-1.5 py-0.5 text-[9px] bg-red-950/80 border border-red-800/80 rounded text-red-400 font-mono font-bold hover:bg-red-900 transition-colors cursor-pointer shrink-0"
                        >
                          Sure?
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteEntry(task.id);
                          }}
                          className="p-1 rounded text-stone-800 hover:text-red-400 transition-all cursor-pointer shrink-0"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Swipeable Row ───────────────────────────────────────────────────────────

interface SwipeableRowProps {
  id: string;
  isOpen: boolean;
  onOpen: (id: string) => void;
  onClose: () => void;
  actions: React.ReactNode;
  children: React.ReactNode;
  actionsWidth?: number;
}

function SwipeableRow({
  id,
  isOpen,
  onOpen,
  onClose,
  actions,
  children,
  actionsWidth = 180,
}: SwipeableRowProps) {
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  const isDraggingHorizontal = useRef<boolean>(false);
  const dragOffset = useRef<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Apply transform directly to the DOM node — no React re-render during drag
  const setTranslate = (px: number, animated: boolean) => {
    const el = contentRef.current;
    if (!el) return;
    el.style.transition = animated ? 'transform 200ms ease-out' : 'none';
    el.style.transform = `translateX(${px}px)`;
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDraggingHorizontal.current = false;
    // Start offset is where the row currently rests
    dragOffset.current = isOpen ? -actionsWidth : 0;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current);

    // Lock axis on first significant move
    if (!isDraggingHorizontal.current) {
      if (dy > Math.abs(dx)) return; // vertical scroll — ignore
      if (Math.abs(dx) < 4) return; // too small to decide yet
      isDraggingHorizontal.current = true;
    }

    // Clamp: can't slide right past 0, or left past -actionsWidth
    const raw = dragOffset.current + dx;
    const clamped = Math.min(0, Math.max(-actionsWidth, raw));
    setTranslate(clamped, false);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isDraggingHorizontal.current) return;

    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const totalOffset = dragOffset.current + dx;
    // Snap open if dragged more than halfway, otherwise snap closed
    const threshold = actionsWidth / 2;

    if (totalOffset < -threshold) {
      setTranslate(-actionsWidth, true);
      onOpen(id);
    } else {
      setTranslate(0, true);
      onClose();
    }
  };

  // Keep DOM in sync when isOpen changes from outside (e.g. another row opens)
  React.useEffect(() => {
    setTranslate(isOpen ? -actionsWidth : 0, true);
  }, [isOpen, actionsWidth]);

  return (
    <div
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Action buttons layer — sits on the right */}
      <div
        className="absolute right-0 top-0 bottom-0 flex items-center justify-end pr-2 gap-1"
        style={{ width: actionsWidth }}
      >
        {actions}
      </div>

      {/* Row content — follows the finger, snaps on release */}
      <div ref={contentRef} className="relative bg-[#0a0a0a]">
        {children}
      </div>
    </div>
  );
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
  handleMoveToPage,
  formatScheduledBadge,
  setActiveDate,
  showContent,
  taskLists,
  listPickerTaskId,
  setListPickerTaskId,
  moveToPageModalTask,
  setMoveToPageModalTask,
}: TaskSectionProps) {
  const safePage = Math.min(page, totalPages - 1);
  const pageTasks = tasks.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const [openRowId, setOpenRowId] = useState<string | null>(null);

  const renderTaskRow = (
    task: Task,
    rowOpenId: string | null,
    setRowOpenId: (id: string | null) => void,
  ) => {
    const isActive = activeTaskId === task.id;
    const isDone = task.status === 'done';
    const hasAchievements = task.achievements && task.achievements.length > 0;
    const badge = formatScheduledBadge(task);
    const isDateless = !task.scheduled_at;
    const isOpen = rowOpenId === task.id;

    const actionButtons = (
      <>
        {/* Activate */}
        {!isDone && !isActive && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onActivateTask(task.id);
            }}
            className="p-1.5 bg-stone-900 rounded border border-stone-700 hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
            title="Activate as Working Task"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
          </button>
        )}

        {/* Schedule */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpenScheduleModal(task);
          }}
          className="p-1.5 bg-stone-900 rounded border border-stone-700 hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition-colors cursor-pointer"
          title="Schedule date"
        >
          <Calendar className="w-3.5 h-3.5" />
        </button>

        {/* List picker — only for dateless tasks */}
        {!task.scheduled_at && taskLists.length > 0 && (
          <div className="relative" data-list-picker>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setListPickerTaskId(listPickerTaskId === task.id ? null : task.id);
              }}
              className={`p-1.5 bg-stone-900 rounded border transition-colors cursor-pointer ${
                (task.category_ids ?? []).some((id) => taskLists.some((l) => l.id === id))
                  ? 'border-violet-700/60 text-violet-400 hover:bg-violet-950/20'
                  : 'border-stone-700 hover:bg-stone-800 text-stone-400 hover:text-violet-400'
              }`}
              title="Assign to list"
            >
              <ListTodo className="w-3.5 h-3.5" />
            </button>

            {listPickerTaskId === task.id && (
              <ListPickerPopover
                task={task}
                lists={taskLists}
                onClose={() => setListPickerTaskId(null)}
              />
            )}
          </div>
        )}

        {/* Move to Page (only when multiple pages exist) */}
        {totalPages > 1 && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMoveToPageModalTask(task);
            }}
            className="p-1.5 bg-stone-900 rounded border border-stone-700 hover:bg-stone-800 text-stone-400 hover:text-amber-400 transition-colors cursor-pointer"
            title="Move to page"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
          </button>
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
            className="p-1.5 bg-stone-900 rounded border border-stone-700 hover:bg-stone-800 text-stone-500 hover:text-red-400 transition-colors cursor-pointer"
            title="Delete Task"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </>
    );

    return (
      <SortableRow key={task.id} id={task.id}>
        <SwipeableRow
          id={task.id}
          isOpen={isOpen}
          onOpen={(id) => setRowOpenId(id)}
          onClose={() => setRowOpenId(null)}
          actions={actionButtons}
        >
          <div
            id={`tasks-view-row-${task.id}`}
            onClick={() => {
              if (isOpen) {
                setRowOpenId(null);
                return;
              }
              onOpenDetail(task);
            }}
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
              {showContent && task.content && task.content.trim() && (
                <p className="text-[10px] font-mono text-stone-500 mt-1 line-clamp-1 leading-relaxed">
                  {task.content}
                </p>
              )}
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

            {/* Desktop Action Buttons */}
            <div className="hidden sm:flex items-center gap-1.5 shrink-0 opacity-0 group-hover/row:opacity-100 focus-within:opacity-100 transition-opacity ml-2">
              {actionButtons}
            </div>
          </div>
        </SwipeableRow>
      </SortableRow>
    );
  };

  return (
    <div className="mb-4">
      {/* Section Header */}
      <div className="w-full flex items-center justify-between px-1 py-2 group/header">
        <button
          onClick={onToggleCollapse}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <motion.div animate={{ rotate: isCollapsed ? -90 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronDown className="w-3.5 h-3.5 text-stone-500 group-hover/header:text-stone-300 transition-colors" />
          </motion.div>
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-stone-400 group-hover/header:text-stone-200 transition-colors">
              {label}
            </span>
          </div>
          <span className="text-[10px] font-mono text-stone-600">
            ({tasks.length} task{tasks.length !== 1 ? 's' : ''})
          </span>
        </button>

        {/* Redesigned Pagination UI directly next to the header (on the right) */}
        {!isCollapsed && tasks.length > 0 && totalPages > 1 && (
          <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-widest text-stone-500">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={safePage === 0}
              className="text-stone-500 hover:text-stone-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="select-none">
              {safePage + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={safePage >= totalPages - 1}
              className="text-stone-500 hover:text-stone-200 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

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
                    {pageTasks.map((task) => renderTaskRow(task, openRowId, setOpenRowId))}
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

// ─── List Strip ──────────────────────────────────────────────────────────────

interface ListStripProps {
  lists: Category[];
  selectedId: string;
  onSelect: (id: string) => void;
  onManage: () => void;
}

function ListStrip({ lists, selectedId, onSelect, onManage }: ListStripProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showFade, setShowFade] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const check = () =>
      setShowFade(
        el.scrollWidth > el.clientWidth && el.scrollLeft < el.scrollWidth - el.clientWidth - 2,
      );
    check();

    el.addEventListener('scroll', check);
    window.addEventListener('resize', check);
    return () => {
      el.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [lists]);

  const COLORS: Record<string, { active: string; dot: string }> = {
    violet: {
      active: 'bg-violet-500/15 border-violet-500/40 text-violet-300',
      dot: 'bg-violet-500',
    },
    sky: { active: 'bg-sky-500/15 border-sky-500/40 text-sky-300', dot: 'bg-sky-500' },
    emerald: {
      active: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
      dot: 'bg-emerald-500',
    },
    amber: { active: 'bg-amber-500/15 border-amber-500/40 text-amber-300', dot: 'bg-amber-500' },
    rose: { active: 'bg-rose-500/15 border-rose-500/40 text-rose-300', dot: 'bg-rose-500' },
    indigo: {
      active: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300',
      dot: 'bg-indigo-500',
    },
    teal: { active: 'bg-teal-500/15 border-teal-500/40 text-teal-300', dot: 'bg-teal-500' },
    orange: {
      active: 'bg-orange-500/15 border-orange-500/40 text-orange-300',
      dot: 'bg-orange-500',
    },
  };

  // if (lists.length === 0) return null;

  return (
    <div className="relative flex items-center gap-1 mt-1 mb-2">
      {/* Pinned left: All + None */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onSelect('all')}
          className={`shrink-0 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
            selectedId === 'all'
              ? 'bg-stone-700 border-stone-600 text-stone-100'
              : 'bg-transparent border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800'
          }`}
        >
          All
        </button>
        <button
          onClick={() => onSelect('none')}
          className={`shrink-0 px-2.5 py-1 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
            selectedId === 'none'
              ? 'bg-stone-700 border-stone-600 text-stone-100'
              : 'bg-transparent border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800'
          }`}
        >
          None
        </button>

        {/* Divider */}
        {lists.length > 0 && <div className="w-px h-4 bg-stone-800 mx-0.5 shrink-0" />}
      </div>

      {/* Scrollable list pills */}
      <div
        ref={scrollRef}
        className="flex items-center gap-1 overflow-x-auto flex-1 min-w-0 pr-1 scrollbar-none"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {lists.map((list) => {
          const cs = COLORS[list.color] ?? COLORS['violet'];
          const isActive = selectedId === list.id;
          return (
            <button
              key={list.id}
              onClick={() => onSelect(list.id)}
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                isActive
                  ? cs.active
                  : 'bg-transparent border-stone-800 text-stone-500 hover:text-stone-300 hover:border-stone-700'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cs.dot}`} />
              {list.name}
            </button>
          );
        })}
      </div>

      {/* Right fade overlay */}
      {showFade && (
        <div className="absolute right-7 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0a0a0a] to-transparent pointer-events-none" />
      )}

      {/* Pinned right: Manage button */}
      <button
        onClick={onManage}
        className="shrink-0 p-1.5 rounded-lg border border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
        title="Manage lists"
      >
        <MoreHorizontal className="w-3.5 h-3.5" />
      </button>
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
  const showContent = localStorage.getItem('flowday_show_note_event_content') !== 'false';
  const [statusFilter, setStatusFilter] = useState<'inbox' | 'todo' | 'done'>(() => {
    const saved = localStorage.getItem('flowday-tasks-status-filter');
    if (saved === 'inbox' || saved === 'todo' || saved === 'done') {
      return saved;
    }
    return 'inbox';
  });

  const [selectedListId, setSelectedListId] = useState<string>(() => {
    return localStorage.getItem('flowday-tasks-selected-list') ?? 'all';
  });
  const [isListManagerOpen, setIsListManagerOpen] = useState(false);

  const rawTaskLists = (useLiveQuery(
    () => db.categories.where('scope').equals(TASK_LIST_SCOPE).toArray(),
    [],
  ) ?? []) as Category[];

  const taskLists = [...rawTaskLists].sort((a, b) => {
    const aO = (a as any).sort_order ?? Date.parse(a.created_at.toString());
    const bO = (b as any).sort_order ?? Date.parse(b.created_at.toString());
    return aO - bO;
  });

  const handleStatusFilterChange = (filter: 'inbox' | 'todo' | 'done') => {
    setStatusFilter(filter);
    localStorage.setItem('flowday-tasks-status-filter', filter);
  };

  // Section collapse state
  const [scheduledCollapsed, setScheduledCollapsed] = useState(false);
  const [datelessCollapsed, setDatelessCollapsed] = useState(false);
  const [completedDatelessCollapsed, setCompletedDatelessCollapsed] = useState(false);

  // Pagination per section
  const [scheduledPage, setScheduledPage] = useState(0);
  const [datelessPageMap, setDatelessPageMap] = useState<Record<string, number>>({});

  const datelessPage = datelessPageMap[selectedListId] ?? 0;
  const setDatelessPage: React.Dispatch<React.SetStateAction<number>> = (value) => {
    setDatelessPageMap((prev) => {
      const current = prev[selectedListId] ?? 0;
      const next = typeof value === 'function' ? value(current) : value;
      return { ...prev, [selectedListId]: next };
    });
  };
  const [completedDatelessPage, setCompletedDatelessPage] = useState(0);

  // Optimistic state per section
  const [optimisticScheduled, setOptimisticScheduled] = useState<Task[] | null>(null);
  const [optimisticDateless, setOptimisticDateless] = useState<Task[] | null>(null);
  const [optimisticCompletedDateless, setOptimisticCompletedDateless] = useState<Task[] | null>(
    null,
  );

  // Move to page modal
  const [moveToPageModalTask, setMoveToPageModalTask] = useState<Task | null>(null);

  // Paper list modal
  const [isPaperListOpen, setIsPaperListOpen] = useState(false);

  // Schedule calendar modal
  const [scheduleModalTask, setScheduleModalTask] = useState<Task | null>(null);

  // ─── DnD sensors ──────────────────────────────────────────────────────────
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // ─── Extract tasks ────────────────────────────────────────────────────────
  const allTasks = useMemo(() => entries.filter((e): e is Task => e.type === 'task'), [entries]);

  // All dateless tasks for the Paper List (ignores status filter and list filter)
  const paperListTasks = useMemo(() => {
    return allTasks
      .filter((t) => !t.scheduled_at)
      .sort((a, b) => {
        const aSort = a.sort_order ?? Infinity;
        const bSort = b.sort_order ?? Infinity;
        if (aSort !== bSort) return aSort - bSort;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
  }, [allTasks]);

  // ─── Filter ──────────────────────────────────────────────────────────────
  const filteredTasks = useMemo(() => {
    let tasks = allTasks;

    if (statusFilter === 'todo') {
      tasks = tasks.filter((t) => t.status === 'todo');
    } else if (statusFilter === 'done') {
      tasks = tasks.filter((t) => t.status === 'done');
    }
    // Note: statusFilter === 'inbox' filters are handled split-wise to separate active vs completed dateless.

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

  // ─── Split into scheduled, active dateless and completed dateless ───────────────────────
  const { scheduledTasks, datelessTasks, completedDatelessTasks } = useMemo(() => {
    const scheduled: Task[] = [];
    const dateless: Task[] = [];
    const completedDateless: Task[] = [];

    filteredTasks.forEach((t) => {
      if (t.scheduled_at) {
        // Scheduled only matters for Todo and Done filters
        if (statusFilter !== 'inbox') {
          scheduled.push(t);
        }
      } else {
        // Dateless tasks logic
        if (statusFilter === 'inbox') {
          if (t.status === 'done') {
            completedDateless.push(t);
          } else {
            dateless.push(t);
          }
        } else {
          // Todo/Done filters
          dateless.push(t);
        }
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

    // Sort completed dateless: sort_order, then created_at
    completedDateless.sort((a, b) => {
      const aSort = a.sort_order ?? Infinity;
      const bSort = b.sort_order ?? Infinity;
      if (aSort !== bSort) return aSort - bSort;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    return {
      scheduledTasks: scheduled,
      datelessTasks: dateless,
      completedDatelessTasks: completedDateless,
    };
  }, [filteredTasks, statusFilter]);

  // ─── Display lists (optimistic override) ──────────────────────────────────
  const displayScheduled = optimisticScheduled ?? scheduledTasks;
  const displayCompletedDateless = optimisticCompletedDateless ?? completedDatelessTasks;

  // Apply list filter to dateless tasks
  const baseDisplayDateless = optimisticDateless ?? datelessTasks;
  const displayDateless = useMemo(() => {
    if (selectedListId === 'all') return baseDisplayDateless;
    if (selectedListId === 'none')
      return baseDisplayDateless.filter((t) => {
        const ids = t.category_ids ?? [];
        return ids.length === 0 || !taskLists.some((l) => ids.includes(l.id));
      });
    return baseDisplayDateless.filter((t) => (t.category_ids ?? []).includes(selectedListId));
  }, [baseDisplayDateless, selectedListId, taskLists]);

  // ─── Pagination ────────────────────────────────────────────────────────────
  const scheduledTotalPages = Math.max(1, Math.ceil(displayScheduled.length / PAGE_SIZE));
  const datelessTotalPages = Math.max(1, Math.ceil(displayDateless.length / PAGE_SIZE));
  const completedDatelessTotalPages = Math.max(
    1,
    Math.ceil(displayCompletedDateless.length / PAGE_SIZE),
  );

  // Reset pages when filters change
  React.useEffect(() => {
    setScheduledPage(0);
    setDatelessPageMap({});
    setCompletedDatelessPage(0);
    setSelectedListId('all');
    localStorage.setItem('flowday-tasks-selected-list', 'all');
  }, [statusFilter, searchQuery]);

  // Starred selection modal state
  const [isStarModalOpen, setIsStarModalOpen] = useState(false);

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
  const completedDatelessSafePage = Math.min(
    completedDatelessPage,
    completedDatelessTotalPages - 1,
  );

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

  const handleCompletedDatelessDragEnd = useMemo(
    () =>
      createDragEndHandler(
        displayCompletedDateless,
        completedDatelessSafePage,
        setOptimisticCompletedDateless,
        completedDatelessTasks,
      ),
    [
      createDragEndHandler,
      displayCompletedDateless,
      completedDatelessSafePage,
      completedDatelessTasks,
    ],
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
          setMoveToPageModalTask(null);
          return;
        }

        const fullList = [...displayList];
        const movedIdx = fullList.findIndex((t) => t.id === taskId);
        if (movedIdx === -1) {
          setMoveToPageModalTask(null);
          return;
        }

        const [movedTask] = fullList.splice(movedIdx, 1);
        const insertAt = targetPage * PAGE_SIZE;
        fullList.splice(insertAt, 0, movedTask);

        setOptimistic(fullList);

        await db.transaction('rw', db.entries, async () => {
          for (let i = 0; i < fullList.length; i++) {
            await db.entries.update(fullList[i].id, { sort_order: i } as any);
          }
        });

        setPageFn(targetPage);
        setMoveToPageModalTask(null);
        setTimeout(() => setOptimistic(null), 2000);
      },
    [setMoveToPageModalTask],
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

  const handleCompletedDatelessMoveToPage = useMemo(
    () =>
      createMoveToPageHandler(
        displayCompletedDateless,
        completedDatelessSafePage,
        setOptimisticCompletedDateless,
        setCompletedDatelessPage,
      ),
    [createMoveToPageHandler, displayCompletedDateless, completedDatelessSafePage],
  );

  // ─── Close list picker on outside click ───────────────────────────────────
  const [listPickerTaskId, setListPickerTaskId] = useState<string | null>(null);

  React.useEffect(() => {
    if (!listPickerTaskId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-list-picker]')) {
        e.stopPropagation();
        setListPickerTaskId(null);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [listPickerTaskId]);

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
      <div className="z-20 bg-[#0a0a0a] py-0 flex items-center justify-between gap-3">
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

        {/* Actions */}
        <div className="flex gap-2">
          {/* Paper List trigger */}
          <button
            onClick={() => setIsPaperListOpen(true)}
            className="p-1.5 rounded-lg border border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
            title="Paper List"
          >
            <ClipboardList className="w-3.5 h-3.5" />
          </button>

          {/* Status filter */}
          <div className="flex items-center gap-1 bg-[#0a0a0a] border border-stone-800 rounded-lg p-0.5 w-fit">
            <button
              onClick={() => handleStatusFilterChange('inbox')}
              className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                statusFilter === 'inbox'
                  ? 'bg-stone-800 text-stone-200 shadow-sm'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Inbox
            </button>

            <button
              onClick={() => handleStatusFilterChange('todo')}
              className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                statusFilter === 'todo'
                  ? 'bg-stone-800 text-stone-200 shadow-sm'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Todo
            </button>
            <button
              onClick={() => handleStatusFilterChange('done')}
              className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                statusFilter === 'done'
                  ? 'bg-emerald-900/60 text-emerald-300 shadow-sm'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Done
            </button>
          </div>
        </div>
      </div>

      {/* List strip — only in inbox mode where dateless tasks live */}
      {statusFilter === 'inbox' && (
        <ListStrip
          lists={taskLists}
          selectedId={selectedListId}
          onSelect={(id) => {
            setSelectedListId(id);
            localStorage.setItem('flowday-tasks-selected-list', id);
            setDatelessPageMap((prev) => ({ ...prev, [id]: 0 }));
          }}
          onManage={() => setIsListManagerOpen(true)}
        />
      )}

      {/* Dateless Tasks Section (renders in 'inbox' mode as active dateless, and in todo/done filters as dateless matches) */}
      {(statusFilter !== 'inbox' ||
        displayDateless.length > 0 ||
        displayCompletedDateless.length > 0) && (
        <TaskSection
          label={statusFilter === 'inbox' ? 'Dateless' : 'Dateless Tasks'}
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
          handleMoveToPage={handleDatelessMoveToPage}
          formatScheduledBadge={formatScheduledBadge}
          setActiveDate={setActiveDate}
          taskLists={taskLists}
          listPickerTaskId={listPickerTaskId}
          setListPickerTaskId={setListPickerTaskId}
          moveToPageModalTask={moveToPageModalTask}
          setMoveToPageModalTask={setMoveToPageModalTask}
          showContent={showContent}
        />
      )}

      {/* Completed Dateless Tasks Section (Only renders when statusFilter is 'inbox') */}
      {statusFilter === 'inbox' &&
        (displayDateless.length > 0 || displayCompletedDateless.length > 0) && (
          <TaskSection
            label="Dateless Completed"
            icon={<Check className="w-3.5 h-3.5 text-emerald-400" />}
            accentColor="emerald"
            tasks={displayCompletedDateless}
            isCollapsed={completedDatelessCollapsed}
            onToggleCollapse={() => setCompletedDatelessCollapsed((p) => !p)}
            deletingId={deletingId}
            activeTaskId={activeTaskId}
            totalPages={completedDatelessTotalPages}
            page={completedDatelessPage}
            setPage={setCompletedDatelessPage}
            onDeleteEntry={onDeleteEntry}
            onOpenDetail={onOpenDetail}
            onToggleTaskStatus={onToggleTaskStatus}
            onActivateTask={onActivateTask}
            onOpenScheduleModal={setScheduleModalTask}
            formatTime={formatTime}
            sensors={sensors}
            onDragEnd={handleCompletedDatelessDragEnd}
            handleMoveToPage={handleCompletedDatelessMoveToPage}
            formatScheduledBadge={formatScheduledBadge}
            setActiveDate={setActiveDate}
            taskLists={taskLists}
            listPickerTaskId={listPickerTaskId}
            setListPickerTaskId={setListPickerTaskId}
            moveToPageModalTask={moveToPageModalTask}
            setMoveToPageModalTask={setMoveToPageModalTask}
            showContent={showContent}
          />
        )}

      {/* Scheduled Tasks Section (Renders only when statusFilter is NOT 'inbox') */}
      {statusFilter !== 'inbox' && (
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
          handleMoveToPage={handleScheduledMoveToPage}
          formatScheduledBadge={formatScheduledBadge}
          setActiveDate={setActiveDate}
          taskLists={[]}
          listPickerTaskId={null}
          setListPickerTaskId={() => {}}
          moveToPageModalTask={moveToPageModalTask}
          setMoveToPageModalTask={setMoveToPageModalTask}
          showContent={showContent}
        />
      )}

      {/* Empty state */}
      {displayScheduled.length === 0 &&
        displayDateless.length === 0 &&
        (statusFilter !== 'inbox' || displayCompletedDateless.length === 0) && (
          <div className="py-24 px-6 text-center text-stone-500 select-none">
            <ListTodo className="w-12 h-12 text-stone-800 mx-auto mb-4" />
            <h4 className="font-sans font-medium text-sm text-stone-400 mb-1">
              {searchQuery.trim()
                ? 'No matching tasks'
                : statusFilter === 'todo'
                  ? 'No open tasks'
                  : statusFilter === 'done'
                    ? 'No completed tasks'
                    : 'Inbox is empty'}
            </h4>
            <p className="text-xs font-sans max-w-md mx-auto leading-relaxed text-stone-500">
              {searchQuery.trim()
                ? 'Try a different search term.'
                : statusFilter === 'todo'
                  ? 'All your tasks are done. Create new tasks using the input engine below.'
                  : statusFilter === 'done'
                    ? 'Complete some tasks and they will show up here.'
                    : 'Start creating dateless tasks using the input engine below to populate your Inbox.'}
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

      {/* Move to Page Modal */}
      {moveToPageModalTask && (
        <MoveToPageModal
          task={moveToPageModalTask}
          currentPage={
            moveToPageModalTask.scheduled_at
              ? Math.min(scheduledPage, scheduledTotalPages - 1)
              : moveToPageModalTask.status === 'done'
                ? Math.min(completedDatelessPage, completedDatelessTotalPages - 1)
                : Math.min(datelessPage, datelessTotalPages - 1)
          }
          totalPages={
            moveToPageModalTask.scheduled_at
              ? scheduledTotalPages
              : moveToPageModalTask.status === 'done'
                ? completedDatelessTotalPages
                : datelessTotalPages
          }
          onClose={() => setMoveToPageModalTask(null)}
          onSelectPage={(taskId, page) => {
            if (moveToPageModalTask.scheduled_at) {
              handleScheduledMoveToPage(taskId, page);
            } else if (moveToPageModalTask.status === 'done') {
              handleCompletedDatelessMoveToPage(taskId, page);
            } else {
              handleDatelessMoveToPage(taskId, page);
            }
          }}
        />
      )}

      {isListManagerOpen && <TaskListManagerModal onClose={() => setIsListManagerOpen(false)} />}

      {/* Paper List Modal */}
      {isPaperListOpen && (
        <PaperListModal
          tasks={paperListTasks}
          onClose={() => setIsPaperListOpen(false)}
          onToggleTaskStatus={onToggleTaskStatus}
          onDeleteEntry={onDeleteEntry}
          deletingId={deletingId}
        />
      )}
    </div>
  );
}
