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
  WalletCards,
  CircleDashed,
  FileText,
  HelpCircle,
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
  rectSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'motion/react';
import SortableRow from '../SortableRow';
import { db } from '../../db';
import { TimelineEntry, Task, TaskStatus, TaskAchievement, Category } from '../../types';

import { useLiveQuery } from 'dexie-react-hooks';
import { MoreHorizontal } from 'lucide-react';
import TaskListManagerModal from '../TaskListManagerModal'; // adjust path as needed
import { TASK_LIST_SCOPE } from '../../utils';

interface ListsViewProps {
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

const PAGE_SIZE = 21;

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
  onOpenStatusModal?: (task: Task) => void;
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
  selectedListId?: string;
}

// ─── Status Picker Popover ──────────────────────────────────────────────────

interface TaskStatusPickerPopoverProps {
  task: Task;
  onClose: () => void;
}

function playCompleteSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.25);
  } catch {}
}

function TaskStatusPickerPopover({ task, onClose }: TaskStatusPickerPopoverProps) {
  const currentStatus = task.status ?? 'todo';

  const handleSelectStatus = async (status: TaskStatus) => {
    const isDone = status === 'done';
    if (isDone && currentStatus !== 'done') {
      playCompleteSound();
    }
    await db.entries.update(task.id, {
      status,
      completed_at: isDone ? new Date() : undefined,
    } as any);
    onClose();
  };

  const STATUS_OPTIONS: {
    status: TaskStatus;
    label: string;
    description: string;
    icon: React.ReactNode;
    colorClasses: string;
    activeClasses: string;
  }[] = [
    {
      status: 'todo',
      label: 'To Do',
      description: 'Backlog / not started',
      icon: <span className="w-3.5 h-3.5 rounded-full border border-stone-500 shrink-0" />,
      colorClasses: 'text-stone-300 hover:bg-stone-800/80',
      activeClasses: 'bg-stone-800 text-stone-100 border-stone-700',
    },
    {
      status: 'in_progress',
      label: 'In Progress',
      description: 'Currently working on this',
      icon: <CircleDashed className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
      colorClasses: 'text-amber-300 hover:bg-amber-500/10',
      activeClasses: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
    },
    {
      status: 'done',
      label: 'Completed',
      description: 'Finished task',
      icon: <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3] shrink-0" />,
      colorClasses: 'text-emerald-300 hover:bg-emerald-500/10',
      activeClasses: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
    },
    {
      status: 'dropped',
      label: 'Dropped',
      description: 'Cancelled or abandoned',
      icon: <X className="w-3.5 h-3.5 text-rose-400 stroke-[2.5] shrink-0" />,
      colorClasses: 'text-rose-300 hover:bg-rose-500/10',
      activeClasses: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
    },
    {
      status: 'maybe',
      label: 'Maybe / Later',
      description: 'Parked for later or undecided',
      icon: <HelpCircle className="w-3.5 h-3.5 text-indigo-400 stroke-[2.5] shrink-0" />,
      colorClasses: 'text-indigo-300 hover:bg-indigo-500/10',
      activeClasses: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40',
    },
  ];

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
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400">
                Change Status
              </p>
              <p className="text-xs font-serif font-semibold text-stone-200 line-clamp-1 mt-0.5">
                {task.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-stone-500 hover:text-stone-300 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Options */}
          <div className="p-3 flex flex-col gap-1.5">
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = currentStatus === opt.status;
              return (
                <button
                  key={opt.status}
                  onClick={() => handleSelectStatus(opt.status)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected ? opt.activeClasses : `${opt.colorClasses} border-transparent`
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-bold leading-tight">{opt.label}</p>
                    <p className="text-[10px] font-mono text-stone-500 leading-tight mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />}
                </button>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
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
                  const isDropped = task.status === 'dropped';
                  const isInProgress = task.status === 'in_progress';
                  const isMaybe = task.status === 'maybe';
                  const isDeleting = deletingId === task.id;
                  return (
                    <div
                      key={task.id}
                      className={`flex items-center gap-2.5 px-4 py-[7px] group/line hover:bg-stone-900/30 transition-colors ${
                        isDone || isDropped ? 'opacity-45' : ''
                      }`}
                    >
                      {/* Complete */}
                      <button
                        onClick={() => onToggleTaskStatus(task)}
                        className={`w-[15px] h-[15px] rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${
                          isDone
                            ? 'bg-emerald-600 border-emerald-500 text-stone-950'
                            : isInProgress
                              ? 'bg-amber-500/20 border-amber-500/60 text-amber-400'
                              : isDropped
                                ? 'bg-rose-950/60 border-rose-800 text-rose-400'
                                : isMaybe
                                  ? 'bg-indigo-950/60 border-indigo-700 text-indigo-400'
                                  : 'border-stone-700 bg-transparent text-transparent hover:text-stone-500 hover:border-stone-500'
                        }`}
                      >
                        {isDone && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                        {isInProgress && (
                          <CircleDashed
                            className="w-2.5 h-2.5 animate-spin"
                            style={{ animationDuration: '4s' }}
                          />
                        )}
                        {isDropped && <X className="w-2.5 h-2.5 stroke-[3]" />}
                        {isMaybe && <HelpCircle className="w-2.5 h-2.5 stroke-[2.5]" />}
                      </button>

                      {/* Title */}
                      <span
                        className={`flex-1 min-w-0 text-[12px] font-mono truncate leading-tight ${
                          isDone
                            ? 'line-through text-stone-600'
                            : isDropped
                              ? 'line-through text-stone-600 opacity-60'
                              : isInProgress
                                ? 'text-amber-200/95 font-semibold'
                                : isMaybe
                                  ? 'text-indigo-200/95 font-semibold'
                                  : 'text-stone-300'
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

const CATEGORY_COLORS: Record<string, string> = {
  violet: 'bg-violet-500/10 border-violet-500/20 text-violet-400',
  sky: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
  emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
  rose: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
  indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
  teal: 'bg-teal-500/10 border-teal-500/20 text-teal-400',
  orange: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
};

const LIST_BORDER_COLORS: Record<string, string> = {
  violet: 'border-violet-500/40 hover:border-violet-500/70',
  sky: 'border-sky-500/40 hover:border-sky-500/70',
  emerald: 'border-emerald-500/40 hover:border-emerald-500/70',
  amber: 'border-amber-500/40 hover:border-amber-500/70',
  rose: 'border-rose-500/40 hover:border-rose-500/70',
  indigo: 'border-indigo-500/40 hover:border-indigo-500/70',
  teal: 'border-teal-500/40 hover:border-teal-500/70',
  orange: 'border-orange-500/40 hover:border-orange-500/70',
};

// ─── Task Action Context Menu ───────────────────────────────────────────────

interface TaskActionContextMenuProps {
  task: Task;
  position: { x: number; y: number };
  onClose: () => void;
  onOpenDetail: (task: Task) => void;
  onActivateTask: (taskId: string) => void;
  onOpenScheduleModal: (task: Task) => void;
  onOpenListPicker: (task: Task) => void;
  onOpenMoveToPage: (task: Task) => void;
  onDeleteEntry: (taskId: string) => void;
  onOpenStatusModal?: (task: Task) => void;
  onToggleTaskStatus: (task: Task) => void;
  totalPages: number;
  taskLists: Category[];
  activeTaskId?: string | null;
}

function TaskActionContextMenu({
  task,
  position,
  onClose,
  onOpenDetail,
  onActivateTask,
  onOpenScheduleModal,
  onOpenListPicker,
  onOpenMoveToPage,
  onDeleteEntry,
  onOpenStatusModal,
  onToggleTaskStatus,
  totalPages,
  taskLists,
  activeTaskId,
}: TaskActionContextMenuProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: position.y, left: position.x });

  const isActive = activeTaskId === task.id;
  const isDone = task.status === 'done';
  const isDropped = task.status === 'dropped';
  const isMaybe = task.status === 'maybe';
  const isDateless = !task.scheduled_at;

  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const menuWidth = rect.width || 230;
    const menuHeight = rect.height || 280;
    const padding = 12;

    let left = position.x;
    let top = position.y;

    if (left + menuWidth > window.innerWidth - padding) {
      left = Math.max(padding, window.innerWidth - menuWidth - padding);
    }
    if (top + menuHeight > window.innerHeight - padding) {
      top = Math.max(padding, window.innerHeight - menuHeight - padding);
    }

    setPos({ top, left });
  }, [position]);

  return (
    <div
      className="fixed inset-0 z-[1000] select-none"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={menuRef}
        style={{ top: `${pos.top}px`, left: `${pos.left}px` }}
        onClick={(e) => e.stopPropagation()}
        className="fixed w-56 bg-[#141414] border border-stone-800 rounded-xl shadow-2xl overflow-hidden py-1.5 z-[1001] animate-in fade-in zoom-in-95 duration-100 font-sans"
      >
        {/* Header with Title Preview */}
        <div className="px-3 py-1.5 border-b border-stone-800/80 mb-1">
          <p className="text-[11px] font-mono font-semibold text-stone-300 truncate">
            {task.title}
          </p>
          <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider">
            {task.status === 'in_progress'
              ? 'In Progress'
              : task.status === 'done'
                ? 'Completed'
                : task.status === 'dropped'
                  ? 'Dropped'
                  : task.status === 'maybe'
                    ? 'Maybe / Later'
                    : 'To Do'}
          </span>
        </div>

        {/* 1. Open Details */}
        <button
          onClick={() => {
            onClose();
            onOpenDetail(task);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs font-mono text-stone-300 hover:text-white hover:bg-stone-800/80 transition-colors cursor-pointer"
        >
          <FileText className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <span>Open Details</span>
        </button>

        {/* 2. Activate as Working Task */}
        {!isDone && !isDropped && !isMaybe && !isActive && (
          <button
            onClick={() => {
              onClose();
              onActivateTask(task.id);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs font-mono text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 transition-colors cursor-pointer"
          >
            <Play className="w-3.5 h-3.5 text-amber-400 fill-current shrink-0" />
            <span>Activate Focus</span>
          </button>
        )}

        {/* 3. Change Status */}
        <button
          onClick={() => {
            onClose();
            if (isDateless && onOpenStatusModal) {
              onOpenStatusModal(task);
            } else {
              onToggleTaskStatus(task);
            }
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs font-mono text-stone-300 hover:text-white hover:bg-stone-800/80 transition-colors cursor-pointer"
        >
          <CircleDashed className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>Change Status</span>
        </button>

        {/* 4. Schedule Date */}
        <button
          onClick={() => {
            onClose();
            onOpenScheduleModal(task);
          }}
          className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs font-mono text-stone-300 hover:text-amber-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
        >
          <Calendar className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>{task.scheduled_at ? 'Reschedule / Date' : 'Schedule Date'}</span>
        </button>

        {/* 5. Assign to List */}
        {isDateless && taskLists.length > 0 && (
          <button
            onClick={() => {
              onClose();
              onOpenListPicker(task);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs font-mono text-stone-300 hover:text-violet-300 hover:bg-stone-800/80 transition-colors cursor-pointer"
          >
            <ListTodo className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span>Assign to List</span>
          </button>
        )}

        {/* 6. Move to Page */}
        {totalPages > 1 && (
          <button
            onClick={() => {
              onClose();
              onOpenMoveToPage(task);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs font-mono text-stone-300 hover:text-white hover:bg-stone-800/80 transition-colors cursor-pointer"
          >
            <ArrowRightLeft className="w-3.5 h-3.5 text-stone-400 shrink-0" />
            <span>Move to Page</span>
          </button>
        )}

        <div className="h-px bg-stone-800 my-1" />

        {/* 7. Delete Task */}
        {confirmDelete ? (
          <button
            onClick={() => {
              onClose();
              onDeleteEntry(task.id);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs font-mono text-red-400 bg-red-950/40 hover:bg-red-900/60 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <span>Confirm Delete?</span>
          </button>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-left text-xs font-mono text-stone-400 hover:text-red-400 hover:bg-red-950/20 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5 text-stone-500 hover:text-red-400 shrink-0" />
            <span>Delete Task</span>
          </button>
        )}
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
  onOpenStatusModal,
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
  selectedListId,
}: TaskSectionProps) {
  const safePage = Math.min(page, totalPages - 1);
  const pageTasks = tasks.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const [openRowId, setOpenRowId] = useState<string | null>(null);
  const [contextMenuTask, setContextMenuTask] = useState<{
    task: Task;
    position: { x: number; y: number };
  } | null>(null);
  const [editingTitleId, setEditingTitleId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState('');

  const saveTitle = async (taskId: string) => {
    const trimmed = editingTitleValue.trim();
    if (trimmed) {
      await db.entries.update(taskId, { title: trimmed } as any);
    }
    setEditingTitleId(null);
  };

  const renderMobileTaskRow = (
    task: Task,
    rowOpenId: string | null,
    setRowOpenId: (id: string | null) => void,
  ) => {
    const isActive = activeTaskId === task.id;
    const isDone = task.status === 'done';
    const isDropped = task.status === 'dropped';
    const isInProgress = task.status === 'in_progress';
    const isMaybe = task.status === 'maybe';
    const hasAchievements = task.achievements && task.achievements.length > 0;
    const badge = formatScheduledBadge(task);
    const isDateless = !task.scheduled_at;
    const isOpen = rowOpenId === task.id;
    const taskCategories = (task.category_ids ?? [])
      .map((id) => taskLists.find((list) => list.id === id))
      .filter((list): list is Category => !!list && list.id !== selectedListId);

    const actionButtons = (
      <>
        {/* Activate */}
        {!isDone && !isDropped && !isMaybe && !isActive && (
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
            id={`tasks-view-mobile-row-${task.id}`}
            onClick={() => {
              if (isOpen) {
                setRowOpenId(null);
                return;
              }
              onOpenDetail(task);
            }}
            className={`group/row relative flex items-center gap-3 px-3 py-2.5 border-b border-stone-900/60 last:border-b-0 hover:bg-stone-900/40 transition-colors cursor-pointer ${
              isActive ? 'border-l-2 border-l-amber-500 bg-amber-500/5' : ''
            }`}
          >
            {/* Status Button */}
            {isDateless && onOpenStatusModal ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenStatusModal(task);
                }}
                className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all cursor-pointer shrink-0 ${
                  isDone
                    ? 'bg-emerald-600 border-emerald-500 text-stone-950 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                    : isInProgress
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                      : isDropped
                        ? 'bg-rose-950/60 border-rose-800 text-rose-400'
                        : isMaybe
                          ? 'bg-indigo-950/60 border-indigo-700 text-indigo-400'
                          : 'border-stone-700 bg-[#0a0a0a] text-transparent hover:border-stone-500 hover:text-stone-500'
                }`}
                title="Change status"
              >
                {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                {isInProgress && (
                  <CircleDashed
                    className="w-3.5 h-3.5 animate-spin"
                    style={{ animationDuration: '4s' }}
                  />
                )}
                {isDropped && <X className="w-3 h-3 stroke-[2.5]" />}
                {isMaybe && <HelpCircle className="w-3.5 h-3.5 stroke-[2.5]" />}
              </button>
            ) : (
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
            )}

            {/* Title + info row */}
            <div className="flex-1 min-w-0">
              <p
                className={`font-serif text-sm font-semibold line-clamp-1 ${
                  isDone
                    ? hasAchievements
                      ? 'text-amber-400/80'
                      : 'text-emerald-600'
                    : isDropped
                      ? 'text-stone-600 opacity-60'
                      : isInProgress
                        ? 'text-amber-200/95 font-bold'
                        : isMaybe
                          ? 'text-indigo-200/95 font-medium'
                          : 'text-stone-200'
                }`}
              >
                {isDone && hasAchievements && <span className="mr-1.5 not-italic">🏆</span>}
                {task.title}
              </p>
              <div className="flex items-center flex-wrap gap-x-1.5 gap-y-0.5 mt-1">
                {isDateless && isInProgress && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 text-amber-400 shrink-0">
                    In Progress
                  </span>
                )}
                {isDateless && isDropped && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border border-rose-500/30 bg-rose-500/10 text-rose-400 shrink-0">
                    Dropped
                  </span>
                )}
                {isDateless && isMaybe && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 shrink-0">
                    Maybe / Later
                  </span>
                )}
                {isDateless &&
                  !isDone &&
                  !isDropped &&
                  !isMaybe &&
                  taskCategories.map((cat) => {
                    const colorClass = CATEGORY_COLORS[cat.color] ?? CATEGORY_COLORS.violet;
                    return (
                      <span
                        key={cat.id}
                        className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border shrink-0 ${colorClass}`}
                      >
                        {cat.name}
                      </span>
                    );
                  })}
                <span className="flex items-center gap-1 text-[10px] font-mono text-stone-500">
                  {isDateless &&
                    !isDone &&
                    !isDropped &&
                    (taskCategories.length > 0 || isInProgress || isMaybe) && (
                      <span className="text-stone-700 mr-0.5">·</span>
                    )}
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

            {/* Scheduled Date Badge */}
            {badge && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenScheduleModal(task);
                }}
                title="Change scheduled date"
                className={`shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-mono font-semibold uppercase tracking-wider transition-colors cursor-pointer ${
                  badge.isOverdue
                    ? 'bg-red-950/20 border-red-800/30 text-red-400 hover:text-red-300 hover:border-red-700/50'
                    : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-emerald-400 hover:border-emerald-500/30'
                }`}
              >
                {badge.label}
              </button>
            )}
          </div>
        </SwipeableRow>
      </SortableRow>
    );
  };

  const renderDesktopTaskCard = (task: Task) => {
    const isActive = activeTaskId === task.id;
    const isDone = task.status === 'done';
    const isDropped = task.status === 'dropped';
    const isInProgress = task.status === 'in_progress';
    const isMaybe = task.status === 'maybe';
    const hasAchievements = task.achievements && task.achievements.length > 0;
    const badge = formatScheduledBadge(task);
    const isDateless = !task.scheduled_at;
    const taskCategories = (task.category_ids ?? [])
      .map((id) => taskLists.find((list) => list.id === id))
      .filter((list): list is Category => !!list && list.id !== selectedListId);

    // Border color based on task status or assigned list color
    const primaryList = (task.category_ids ?? [])
      .map((id) => taskLists.find((list) => list.id === id))
      .find(Boolean);
    const listBorder =
      primaryList && LIST_BORDER_COLORS[primaryList.color]
        ? LIST_BORDER_COLORS[primaryList.color]
        : 'border-stone-800 hover:border-stone-700';

    const borderClass = isDone
      ? hasAchievements
        ? 'border-amber-400/80 hover:border-amber-400'
        : 'border-emerald-600 hover:border-emerald-500'
      : isDropped
        ? 'border-stone-600/60 opacity-60 hover:opacity-100'
        : isInProgress
          ? 'border-amber-200/95 hover:border-amber-200'
          : isMaybe
            ? 'border-indigo-400/80 hover:border-indigo-400'
            : listBorder;

    return (
      <SortableRow key={task.id} id={task.id}>
        <div
          id={`tasks-view-desktop-card-${task.id}`}
          onClick={(e) => {
            // Left-click anywhere except title opens details
            if ((e.target as HTMLElement).closest('[data-title-area]')) return;
            if (editingTitleId === task.id) return;
            onOpenDetail(task);
          }}
          onContextMenu={(e) => {
            // Right-click anywhere opens context menu
            e.preventDefault();
            setContextMenuTask({
              task,
              position: { x: e.clientX, y: e.clientY },
            });
          }}
          className={`group/row relative flex flex-col justify-between p-3 rounded-xl border bg-[#0d0d0d] hover:bg-[#121212] transition-all duration-150 cursor-pointer select-none min-h-[92px] ${borderClass} ${
            isActive ? 'ring-1 ring-amber-500/50 bg-amber-500/[0.04]' : ''
          }`}
        >
          {/* Top Row: Status button + Title */}
          <div className="flex items-start gap-2.5 min-w-0 mb-1.5">
            {/* Status Button */}
            <div data-no-menu className="shrink-0 mt-0.5">
              {isDateless && onOpenStatusModal ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenStatusModal(task);
                  }}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all cursor-pointer ${
                    isDone
                      ? 'bg-emerald-600 border-emerald-500 text-stone-950 shadow-[0_0_8px_rgba(16,185,129,0.3)]'
                      : isInProgress
                        ? 'bg-amber-500/20 border-amber-500/60 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                        : isDropped
                          ? 'bg-rose-950/60 border-rose-800 text-rose-400'
                          : isMaybe
                            ? 'bg-indigo-950/60 border-indigo-700 text-indigo-400'
                            : 'border-stone-700 bg-[#0a0a0a] text-transparent hover:border-stone-500 hover:text-stone-500'
                  }`}
                  title="Change status"
                >
                  {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  {isInProgress && (
                    <CircleDashed
                      className="w-3.5 h-3.5 animate-spin"
                      style={{ animationDuration: '4s' }}
                    />
                  )}
                  {isDropped && <X className="w-3 h-3 stroke-[2.5]" />}
                  {isMaybe && <HelpCircle className="w-3.5 h-3.5 stroke-[2.5]" />}
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleTaskStatus(task);
                  }}
                  className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                    isDone
                      ? 'bg-stone-800 border-stone-700 text-stone-400'
                      : 'border-stone-700 bg-[#0a0a0a] text-transparent hover:text-stone-400 hover:bg-stone-900/60'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </button>
              )}
            </div>

            {/* Title — left-click to inline-edit */}
            <div className="flex-1 min-w-0" data-title-area>
              {editingTitleId === task.id ? (
                <input
                  autoFocus
                  value={editingTitleValue}
                  onChange={(e) => setEditingTitleValue(e.target.value)}
                  onBlur={() => saveTitle(task.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      saveTitle(task.id);
                    } else if (e.key === 'Escape') {
                      setEditingTitleId(null);
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  onContextMenu={(e) => e.stopPropagation()}
                  className="w-full bg-transparent border-b border-stone-600 focus:border-stone-400 outline-none font-serif text-sm font-semibold leading-snug text-stone-100 pb-0.5 caret-stone-300"
                />
              ) : (
                <p
                  onClick={(e) => {
                    // Left-click on title = inline edit
                    e.stopPropagation();
                    setEditingTitleId(task.id);
                    setEditingTitleValue(task.title);
                  }}
                  className={`font-serif text-sm font-semibold line-clamp-2 leading-snug cursor-text ${
                    isDone
                      ? hasAchievements
                        ? 'text-amber-400/80'
                        : 'text-emerald-600'
                      : isDropped
                        ? 'text-stone-600 opacity-60'
                        : isInProgress
                          ? 'text-amber-200/95 font-bold'
                          : isMaybe
                            ? 'text-indigo-200/95 font-medium'
                            : 'text-stone-200'
                  }`}
                >
                  {isDone && hasAchievements && <span className="mr-1.5 not-italic">🏆</span>}
                  {task.title}
                </p>
              )}
            </div>
          </div>

          {/* Middle: Content snippet */}
          {showContent && task.content && task.content.trim() && (
            <p className="text-[10px] font-mono text-stone-500 line-clamp-2 leading-relaxed mb-2">
              {task.content}
            </p>
          )}

          {/* Bottom row: badges and timestamps */}
          <div className="flex items-center justify-between flex-wrap gap-x-1.5 gap-y-1 mt-auto pt-1.5 border-t border-stone-800/40">
            <div className="flex items-center flex-wrap gap-1">
              {isDateless && isInProgress && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border border-amber-500/30 bg-amber-500/10 text-amber-400 shrink-0">
                  In Progress
                </span>
              )}
              {isDateless && isDropped && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border border-rose-500/30 bg-rose-500/10 text-rose-400 shrink-0">
                  Dropped
                </span>
              )}
              {isDateless && isMaybe && (
                <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 shrink-0">
                  Maybe / Later
                </span>
              )}
              {isDateless &&
                !isDone &&
                !isDropped &&
                !isMaybe &&
                taskCategories.map((cat) => {
                  const colorClass = CATEGORY_COLORS[cat.color] ?? CATEGORY_COLORS.violet;
                  return (
                    <span
                      key={cat.id}
                      className={`px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border shrink-0 ${colorClass}`}
                    >
                      {cat.name}
                    </span>
                  );
                })}
              {badge && (
                <span
                  data-no-menu
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenScheduleModal(task);
                  }}
                  className={`shrink-0 px-2 py-0.5 rounded-full border text-[9px] font-mono font-semibold uppercase tracking-wider cursor-pointer ${
                    badge.isOverdue
                      ? 'bg-red-950/20 border-red-800/30 text-red-400 hover:text-red-300 hover:border-red-700/50'
                      : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-emerald-400 hover:border-emerald-500/30'
                  }`}
                >
                  {badge.label}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 text-[9px] font-mono text-stone-500 shrink-0">
              <span>{formatTime(task.created_at)}</span>
              {task.time_spent > 0 && (
                <span className="text-stone-600">· {Math.floor(task.time_spent / 60000)}m</span>
              )}
              {isDone && task.completed_at && (
                <span className="text-emerald-500 font-semibold">
                  · ✓ {formatTime(task.completed_at)}
                </span>
              )}
            </div>
          </div>
        </div>
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
                <SortableContext items={pageTasks.map((t) => t.id)} strategy={rectSortingStrategy}>
                  {/* Mobile view: classic list with swipeable rows */}
                  <div className="md:hidden border border-stone-900/60 rounded-xl overflow-hidden">
                    {pageTasks.map((task) => renderMobileTaskRow(task, openRowId, setOpenRowId))}
                  </div>

                  {/* Desktop view: 3-column cards with status/list borders & context menu */}
                  <div className="hidden md:grid grid-cols-3 gap-2 space-y-5">
                    {pageTasks.map((task) => renderDesktopTaskCard(task))}
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

      {/* Action Context Menu Modal */}
      {contextMenuTask && (
        <TaskActionContextMenu
          task={contextMenuTask.task}
          position={contextMenuTask.position}
          onClose={() => setContextMenuTask(null)}
          onOpenDetail={onOpenDetail}
          onActivateTask={onActivateTask}
          onOpenScheduleModal={onOpenScheduleModal}
          onOpenListPicker={(t) => setListPickerTaskId(t.id)}
          onOpenMoveToPage={setMoveToPageModalTask}
          onDeleteEntry={onDeleteEntry}
          onOpenStatusModal={onOpenStatusModal}
          onToggleTaskStatus={onToggleTaskStatus}
          totalPages={totalPages}
          taskLists={taskLists}
          activeTaskId={activeTaskId}
        />
      )}

      {/* List Picker Popover modal when opened */}
      {listPickerTaskId &&
        (() => {
          const task = tasks.find((t) => t.id === listPickerTaskId);
          if (!task) return null;
          return (
            <ListPickerPopover
              task={task}
              lists={taskLists}
              onClose={() => setListPickerTaskId(null)}
            />
          );
        })()}
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
          className={`shrink-0 p-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
            selectedId === 'all'
              ? 'bg-stone-700 border-stone-600 text-stone-100'
              : 'bg-transparent border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800'
          }`}
        >
          <WalletCards className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onSelect('none')}
          className={`shrink-0 p-1.5 rounded-lg border text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
            selectedId === 'none'
              ? 'bg-stone-700 border-stone-600 text-stone-100'
              : 'bg-transparent border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800'
          }`}
        >
          <CircleDashed className="w-3.5 h-3.5" />
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
                  ? `${cs.active} !border-amber-500 !text-stone-100`
                  : `${cs.active} border-stone-800 !text-stone-100 hover:text-stone-300 hover:border-stone-700`
              }`}
            >
              {/* <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cs.dot}`} /> */}
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

export default function ListsView({
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
}: ListsViewProps) {
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
  const [datelessStateFilter, setDatelessStateFilter] = useState<
    'all' | 'todo' | 'in_progress' | 'done' | 'dropped' | 'maybe'
  >(() => {
    const saved = localStorage.getItem('flowday-tasks-dateless-state-filter');
    if (
      saved === 'all' ||
      saved === 'todo' ||
      saved === 'in_progress' ||
      saved === 'done' ||
      saved === 'dropped' ||
      saved === 'maybe'
    ) {
      return saved;
    }
    return 'all';
  });

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
  const [droppedDatelessCollapsed, setDroppedDatelessCollapsed] = useState(false);
  const [maybeDatelessCollapsed, setMaybeDatelessCollapsed] = useState(false);

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
  const [droppedDatelessPage, setDroppedDatelessPage] = useState(0);
  const [maybeDatelessPage, setMaybeDatelessPage] = useState(0);
  const [completedScheduledPage, setCompletedScheduledPage] = useState(0);

  // Optimistic state per section
  const [optimisticScheduled, setOptimisticScheduled] = useState<Task[] | null>(null);
  const [optimisticDateless, setOptimisticDateless] = useState<Task[] | null>(null);
  const [optimisticCompletedDateless, setOptimisticCompletedDateless] = useState<Task[] | null>(
    null,
  );
  const [optimisticDroppedDateless, setOptimisticDroppedDateless] = useState<Task[] | null>(null);
  const [optimisticMaybeDateless, setOptimisticMaybeDateless] = useState<Task[] | null>(null);
  const [optimisticCompletedScheduled, setOptimisticCompletedScheduled] = useState<Task[] | null>(
    null,
  );

  // Move to page modal
  const [moveToPageModalTask, setMoveToPageModalTask] = useState<Task | null>(null);

  // Status picker modal
  const [statusPickerTask, setStatusPickerTask] = useState<Task | null>(null);

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
      // "Scheduled" view - keep scheduled tasks only (both active and completed)
      tasks = tasks.filter((t) => t.scheduled_at);
    } else if (statusFilter === 'done') {
      tasks = tasks.filter((t) => t.status === 'done');
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

  // ─── Split into scheduled, active dateless, completed dateless, dropped dateless, maybe dateless, and completed scheduled ──────
  const {
    scheduledTasks,
    datelessTasks,
    completedDatelessTasks,
    droppedDatelessTasks,
    maybeDatelessTasks,
    completedScheduledTasks,
  } = useMemo(() => {
    const scheduled: Task[] = [];
    const dateless: Task[] = [];
    const completedDateless: Task[] = [];
    const droppedDateless: Task[] = [];
    const maybeDateless: Task[] = [];
    const completedScheduled: Task[] = [];

    filteredTasks.forEach((t) => {
      if (t.scheduled_at) {
        if (statusFilter === 'todo') {
          if (t.status === 'done') {
            completedScheduled.push(t);
          } else {
            scheduled.push(t);
          }
        } else if (statusFilter === 'done') {
          completedScheduled.push(t);
        }
      } else {
        // Dateless tasks logic
        if (statusFilter === 'inbox') {
          if (t.status === 'done') {
            completedDateless.push(t);
          } else if (t.status === 'dropped') {
            droppedDateless.push(t);
          } else if (t.status === 'maybe') {
            maybeDateless.push(t);
          } else {
            dateless.push(t);
          }
        } else if (statusFilter === 'done') {
          completedDateless.push(t);
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

    // Sort dropped dateless: sort_order, then created_at
    droppedDateless.sort((a, b) => {
      const aSort = a.sort_order ?? Infinity;
      const bSort = b.sort_order ?? Infinity;
      if (aSort !== bSort) return aSort - bSort;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Sort maybe dateless: sort_order, then created_at
    maybeDateless.sort((a, b) => {
      const aSort = a.sort_order ?? Infinity;
      const bSort = b.sort_order ?? Infinity;
      if (aSort !== bSort) return aSort - bSort;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    // Sort completed scheduled: sort_order, then scheduled_at, then created_at
    completedScheduled.sort((a, b) => {
      const aSort = a.sort_order ?? Infinity;
      const bSort = b.sort_order ?? Infinity;
      if (aSort !== bSort) return aSort - bSort;
      const aSched = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Infinity;
      const bSched = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Infinity;
      if (aSched !== bSched) return aSched - bSched;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    return {
      scheduledTasks: scheduled,
      datelessTasks: dateless,
      completedDatelessTasks: completedDateless,
      droppedDatelessTasks: droppedDateless,
      maybeDatelessTasks: maybeDateless,
      completedScheduledTasks: completedScheduled,
    };
  }, [filteredTasks, statusFilter]);

  // ─── Display lists (optimistic override) ──────────────────────────────────
  const displayScheduled = optimisticScheduled ?? scheduledTasks;
  const displayCompletedScheduled = optimisticCompletedScheduled ?? completedScheduledTasks;

  // Apply list filter to dateless tasks
  const baseDisplayDateless = optimisticDateless ?? datelessTasks;
  const listFilteredDateless = useMemo(() => {
    if (selectedListId === 'all') return baseDisplayDateless;
    if (selectedListId === 'none')
      return baseDisplayDateless.filter((t) => {
        const ids = t.category_ids ?? [];
        return ids.length === 0 || !taskLists.some((l) => ids.includes(l.id));
      });
    return baseDisplayDateless.filter((t) => (t.category_ids ?? []).includes(selectedListId));
  }, [baseDisplayDateless, selectedListId, taskLists]);

  const baseDisplayCompletedDateless = optimisticCompletedDateless ?? completedDatelessTasks;
  const listFilteredCompletedDateless = useMemo(() => {
    if (selectedListId === 'all' || selectedListId === 'none') {
      return baseDisplayCompletedDateless;
    }
    return baseDisplayCompletedDateless.filter((t) =>
      (t.category_ids ?? []).includes(selectedListId),
    );
  }, [baseDisplayCompletedDateless, selectedListId]);

  const baseDisplayDroppedDateless = optimisticDroppedDateless ?? droppedDatelessTasks;
  const listFilteredDroppedDateless = useMemo(() => {
    if (selectedListId === 'all' || selectedListId === 'none') {
      return baseDisplayDroppedDateless;
    }
    return baseDisplayDroppedDateless.filter((t) =>
      (t.category_ids ?? []).includes(selectedListId),
    );
  }, [baseDisplayDroppedDateless, selectedListId]);

  const baseDisplayMaybeDateless = optimisticMaybeDateless ?? maybeDatelessTasks;
  const listFilteredMaybeDateless = useMemo(() => {
    if (selectedListId === 'all' || selectedListId === 'none') {
      return baseDisplayMaybeDateless;
    }
    return baseDisplayMaybeDateless.filter((t) => (t.category_ids ?? []).includes(selectedListId));
  }, [baseDisplayMaybeDateless, selectedListId]);

  // Apply dateless status filter ('all' | 'todo' | 'in_progress' | 'done' | 'dropped' | 'maybe')
  const displayDateless = useMemo(() => {
    if (datelessStateFilter === 'all') return listFilteredDateless;
    if (datelessStateFilter === 'todo')
      return listFilteredDateless.filter((t) => t.status === 'todo' || !t.status);
    if (datelessStateFilter === 'in_progress')
      return listFilteredDateless.filter((t) => t.status === 'in_progress');
    return [];
  }, [listFilteredDateless, datelessStateFilter]);

  const displayCompletedDateless = useMemo(() => {
    if (datelessStateFilter === 'all' || datelessStateFilter === 'done') {
      return listFilteredCompletedDateless;
    }
    return [];
  }, [listFilteredCompletedDateless, datelessStateFilter]);

  const displayDroppedDateless = useMemo(() => {
    if (datelessStateFilter === 'all' || datelessStateFilter === 'dropped') {
      return listFilteredDroppedDateless;
    }
    return [];
  }, [listFilteredDroppedDateless, datelessStateFilter]);

  const displayMaybeDateless = useMemo(() => {
    if (datelessStateFilter === 'all' || datelessStateFilter === 'maybe') {
      return listFilteredMaybeDateless;
    }
    return [];
  }, [listFilteredMaybeDateless, datelessStateFilter]);

  // ─── Pagination ────────────────────────────────────────────────────────────
  const scheduledTotalPages = Math.max(1, Math.ceil(displayScheduled.length / PAGE_SIZE));
  const datelessTotalPages = Math.max(1, Math.ceil(displayDateless.length / PAGE_SIZE));
  const completedDatelessTotalPages = Math.max(
    1,
    Math.ceil(displayCompletedDateless.length / PAGE_SIZE),
  );
  const droppedDatelessTotalPages = Math.max(
    1,
    Math.ceil(displayDroppedDateless.length / PAGE_SIZE),
  );
  const maybeDatelessTotalPages = Math.max(1, Math.ceil(displayMaybeDateless.length / PAGE_SIZE));
  const completedScheduledTotalPages = Math.max(
    1,
    Math.ceil(displayCompletedScheduled.length / PAGE_SIZE),
  );

  // Reset pages when filters change
  React.useEffect(() => {
    setScheduledPage(0);
    setDatelessPageMap({});
    setCompletedDatelessPage(0);
    setDroppedDatelessPage(0);
    setMaybeDatelessPage(0);
    setCompletedScheduledPage(0);
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
  const droppedDatelessSafePage = Math.min(droppedDatelessPage, droppedDatelessTotalPages - 1);
  const maybeDatelessSafePage = Math.min(maybeDatelessPage, maybeDatelessTotalPages - 1);
  const completedScheduledSafePage = Math.min(
    completedScheduledPage,
    completedScheduledTotalPages - 1,
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

  const handleDroppedDatelessDragEnd = useMemo(
    () =>
      createDragEndHandler(
        displayDroppedDateless,
        droppedDatelessSafePage,
        setOptimisticDroppedDateless,
        droppedDatelessTasks,
      ),
    [createDragEndHandler, displayDroppedDateless, droppedDatelessSafePage, droppedDatelessTasks],
  );

  const handleMaybeDatelessDragEnd = useMemo(
    () =>
      createDragEndHandler(
        displayMaybeDateless,
        maybeDatelessSafePage,
        setOptimisticMaybeDateless,
        maybeDatelessTasks,
      ),
    [createDragEndHandler, displayMaybeDateless, maybeDatelessSafePage, maybeDatelessTasks],
  );

  const handleCompletedScheduledDragEnd = useMemo(
    () =>
      createDragEndHandler(
        displayCompletedScheduled,
        completedScheduledSafePage,
        setOptimisticCompletedScheduled,
        completedScheduledTasks,
      ),
    [
      createDragEndHandler,
      displayCompletedScheduled,
      completedScheduledSafePage,
      completedScheduledTasks,
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

  const handleDroppedDatelessMoveToPage = useMemo(
    () =>
      createMoveToPageHandler(
        displayDroppedDateless,
        droppedDatelessSafePage,
        setOptimisticDroppedDateless,
        setDroppedDatelessPage,
      ),
    [createMoveToPageHandler, displayDroppedDateless, droppedDatelessSafePage],
  );

  const handleMaybeDatelessMoveToPage = useMemo(
    () =>
      createMoveToPageHandler(
        displayMaybeDateless,
        maybeDatelessSafePage,
        setOptimisticMaybeDateless,
        setMaybeDatelessPage,
      ),
    [createMoveToPageHandler, displayMaybeDateless, maybeDatelessSafePage],
  );

  const handleCompletedScheduledMoveToPage = useMemo(
    () =>
      createMoveToPageHandler(
        displayCompletedScheduled,
        completedScheduledSafePage,
        setOptimisticCompletedScheduled,
        setCompletedScheduledPage,
      ),
    [createMoveToPageHandler, displayCompletedScheduled, completedScheduledSafePage],
  );

  // ─── Close list picker on outside click ───────────────────────────────────
  const [listPickerTaskId, setListPickerTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!listPickerTaskId) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-list-picker]')) {
        setListPickerTaskId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [listPickerTaskId]);

  // ─── Schedule handlers ───────────────────────────────────────────────────
  const handleSelectDate = async (taskId: string, date: Date) => {
    await db.entries.update(taskId, { scheduled_at: date } as any);
  };

  const handleUnschedule = async (taskId: string) => {
    await db.entries.update(taskId, { scheduled_at: undefined } as any);
  };

  const formatScheduledBadge = (task: Task): { label: string; isOverdue: boolean } | null => {
    if (!task.scheduled_at) return null;
    const d = new Date(task.scheduled_at);
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

  // ─── Per-list task counts for sidebar ────────────────────────────────────
  const listTaskCounts = useMemo(() => {
    const counts: Record<string, { active: number; done: number }> = {};
    const datelessAll = allTasks.filter((t) => !t.scheduled_at);

    // 'all'
    counts['all'] = {
      active: datelessAll.filter(
        (t) => t.status !== 'done' && t.status !== 'dropped' && t.status !== 'maybe',
      ).length,
      done: datelessAll.filter((t) => t.status === 'done').length,
    };

    // 'none' — tasks that belong to no known list
    const noneTasks = datelessAll.filter((t) => {
      const ids = t.category_ids ?? [];
      return ids.length === 0 || !taskLists.some((l) => ids.includes(l.id));
    });
    counts['none'] = {
      active: noneTasks.filter(
        (t) => t.status !== 'done' && t.status !== 'dropped' && t.status !== 'maybe',
      ).length,
      done: noneTasks.filter((t) => t.status === 'done').length,
    };

    // per-list
    taskLists.forEach((list) => {
      const listTasks = datelessAll.filter((t) => (t.category_ids ?? []).includes(list.id));
      counts[list.id] = {
        active: listTasks.filter(
          (t) => t.status !== 'done' && t.status !== 'dropped' && t.status !== 'maybe',
        ).length,
        done: listTasks.filter((t) => t.status === 'done').length,
      };
    });

    return counts;
  }, [allTasks, taskLists]);

  const LIST_COLORS: Record<string, { active: string; dot: string; glow: string }> = {
    violet: {
      active: 'bg-violet-500/10 border-violet-500/30 text-violet-300',
      dot: 'bg-violet-500',
      glow: 'text-violet-400',
    },
    sky: {
      active: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
      dot: 'bg-sky-500',
      glow: 'text-sky-400',
    },
    emerald: {
      active: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
      dot: 'bg-emerald-500',
      glow: 'text-emerald-400',
    },
    amber: {
      active: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
      dot: 'bg-amber-500',
      glow: 'text-amber-400',
    },
    rose: {
      active: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
      dot: 'bg-rose-500',
      glow: 'text-rose-400',
    },
    indigo: {
      active: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
      dot: 'bg-indigo-500',
      glow: 'text-indigo-400',
    },
    teal: {
      active: 'bg-teal-500/10 border-teal-500/30 text-teal-300',
      dot: 'bg-teal-500',
      glow: 'text-teal-400',
    },
    orange: {
      active: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
      dot: 'bg-orange-500',
      glow: 'text-orange-400',
    },
  };

  // State filter buttons for Lists view
  const stateFilterButtons = (
    <div className="flex items-center gap-1 bg-[#0d0d0d] border border-stone-800/80 rounded-lg p-0.5 shrink-0 flex-wrap sm:flex-nowrap">
      {(['all', 'todo', 'in_progress', 'done', 'dropped', 'maybe'] as const).map((st) => (
        <button
          key={st}
          onClick={() => {
            setDatelessStateFilter(st);
            localStorage.setItem('flowday-tasks-dateless-state-filter', st);
          }}
          className={`px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wider rounded-md transition-all cursor-pointer ${
            datelessStateFilter === st
              ? st === 'in_progress'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                : st === 'done'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : st === 'dropped'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                    : st === 'maybe'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-sm'
                      : 'bg-stone-800 text-stone-200 shadow-sm border border-stone-700'
              : 'text-stone-500 hover:text-stone-300 border border-transparent'
          }`}
        >
          {st === 'all'
            ? 'All'
            : st === 'todo'
              ? 'To Do'
              : st === 'in_progress'
                ? 'In Progress'
                : st === 'done'
                  ? 'Completed'
                  : st === 'dropped'
                    ? 'Dropped'
                    : 'Maybe / Later'}
        </button>
      ))}
    </div>
  );

  // ─── Task section content (shared between mobile & desktop right column) ──
  const taskSectionsContent = (
    <>
      {/* Dateless Tasks Section (renders in 'inbox' (Lists) mode) */}
      {statusFilter === 'inbox' &&
        (displayDateless.length > 0 ||
          (datelessStateFilter !== 'all' &&
            displayCompletedDateless.length === 0 &&
            displayDroppedDateless.length === 0 &&
            displayMaybeDateless.length === 0) ||
          (displayCompletedDateless.length === 0 &&
            displayDroppedDateless.length === 0 &&
            displayMaybeDateless.length === 0)) && (
          <TaskSection
            label={
              datelessStateFilter === 'in_progress'
                ? 'In Progress'
                : datelessStateFilter === 'todo'
                  ? 'To Do'
                  : 'Dateless To Do'
            }
            icon={
              datelessStateFilter === 'in_progress' ? (
                <CircleDashed className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Inbox className="w-3.5 h-3.5 text-violet-400" />
              )
            }
            accentColor={datelessStateFilter === 'in_progress' ? 'amber' : 'violet'}
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
            onOpenStatusModal={setStatusPickerTask}
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
            selectedListId={selectedListId}
          />
        )}

      {/* Completed Dateless Tasks Section (Renders in 'inbox' (Lists) or 'done' mode) */}
      {(statusFilter === 'inbox' || statusFilter === 'done') &&
        displayCompletedDateless.length > 0 && (
          <TaskSection
            label={statusFilter === 'done' ? 'Completed Dateless' : 'Dateless Completed'}
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
            onOpenStatusModal={setStatusPickerTask}
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
            selectedListId={selectedListId}
          />
        )}

      {/* Maybe / Later Dateless Tasks Section (Renders in 'inbox' (Lists) mode) */}
      {statusFilter === 'inbox' && displayMaybeDateless.length > 0 && (
        <TaskSection
          label="Dateless Maybe / Later"
          icon={<HelpCircle className="w-3.5 h-3.5 text-indigo-400 stroke-[2.5]" />}
          accentColor="indigo"
          tasks={displayMaybeDateless}
          isCollapsed={maybeDatelessCollapsed}
          onToggleCollapse={() => setMaybeDatelessCollapsed((p) => !p)}
          deletingId={deletingId}
          activeTaskId={activeTaskId}
          totalPages={maybeDatelessTotalPages}
          page={maybeDatelessPage}
          setPage={setMaybeDatelessPage}
          onDeleteEntry={onDeleteEntry}
          onOpenDetail={onOpenDetail}
          onToggleTaskStatus={onToggleTaskStatus}
          onOpenStatusModal={setStatusPickerTask}
          onActivateTask={onActivateTask}
          onOpenScheduleModal={setScheduleModalTask}
          formatTime={formatTime}
          sensors={sensors}
          onDragEnd={handleMaybeDatelessDragEnd}
          handleMoveToPage={handleMaybeDatelessMoveToPage}
          formatScheduledBadge={formatScheduledBadge}
          setActiveDate={setActiveDate}
          taskLists={taskLists}
          listPickerTaskId={listPickerTaskId}
          setListPickerTaskId={setListPickerTaskId}
          moveToPageModalTask={moveToPageModalTask}
          setMoveToPageModalTask={setMoveToPageModalTask}
          showContent={showContent}
          selectedListId={selectedListId}
        />
      )}

      {/* Dropped Dateless Tasks Section (Renders in 'inbox' (Lists) mode) */}
      {statusFilter === 'inbox' && displayDroppedDateless.length > 0 && (
        <TaskSection
          label="Dateless Dropped"
          icon={<X className="w-3.5 h-3.5 text-rose-400 stroke-[2.5]" />}
          accentColor="rose"
          tasks={displayDroppedDateless}
          isCollapsed={droppedDatelessCollapsed}
          onToggleCollapse={() => setDroppedDatelessCollapsed((p) => !p)}
          deletingId={deletingId}
          activeTaskId={activeTaskId}
          totalPages={droppedDatelessTotalPages}
          page={droppedDatelessPage}
          setPage={setDroppedDatelessPage}
          onDeleteEntry={onDeleteEntry}
          onOpenDetail={onOpenDetail}
          onToggleTaskStatus={onToggleTaskStatus}
          onOpenStatusModal={setStatusPickerTask}
          onActivateTask={onActivateTask}
          onOpenScheduleModal={setScheduleModalTask}
          formatTime={formatTime}
          sensors={sensors}
          onDragEnd={handleDroppedDatelessDragEnd}
          handleMoveToPage={handleDroppedDatelessMoveToPage}
          formatScheduledBadge={formatScheduledBadge}
          setActiveDate={setActiveDate}
          taskLists={taskLists}
          listPickerTaskId={listPickerTaskId}
          setListPickerTaskId={setListPickerTaskId}
          moveToPageModalTask={moveToPageModalTask}
          setMoveToPageModalTask={setMoveToPageModalTask}
          showContent={showContent}
          selectedListId={selectedListId}
        />
      )}

      {/* Scheduled Tasks Section (Renders only when statusFilter is 'todo' (Scheduled)) */}
      {statusFilter === 'todo' && (
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
          selectedListId={selectedListId}
        />
      )}

      {/* Completed Scheduled Tasks Section (Renders when statusFilter is 'todo' (Scheduled) or 'done') */}
      {(statusFilter === 'todo' || statusFilter === 'done') &&
        displayCompletedScheduled.length > 0 && (
          <TaskSection
            label={statusFilter === 'done' ? 'Completed Scheduled' : 'Scheduled Completed'}
            icon={<Check className="w-3.5 h-3.5 text-emerald-400" />}
            accentColor="emerald"
            tasks={displayCompletedScheduled}
            isCollapsed={completedDatelessCollapsed}
            onToggleCollapse={() => setCompletedDatelessCollapsed((p) => !p)}
            deletingId={deletingId}
            activeTaskId={activeTaskId}
            totalPages={completedScheduledTotalPages}
            page={completedScheduledPage}
            setPage={setCompletedScheduledPage}
            onDeleteEntry={onDeleteEntry}
            onOpenDetail={onOpenDetail}
            onToggleTaskStatus={onToggleTaskStatus}
            onActivateTask={onActivateTask}
            onOpenScheduleModal={setScheduleModalTask}
            formatTime={formatTime}
            sensors={sensors}
            onDragEnd={handleCompletedScheduledDragEnd}
            handleMoveToPage={handleCompletedScheduledMoveToPage}
            formatScheduledBadge={formatScheduledBadge}
            setActiveDate={setActiveDate}
            taskLists={[]}
            listPickerTaskId={null}
            setListPickerTaskId={() => {}}
            moveToPageModalTask={moveToPageModalTask}
            setMoveToPageModalTask={setMoveToPageModalTask}
            showContent={showContent}
            selectedListId={selectedListId}
          />
        )}

      {/* Empty state */}
      {displayScheduled.length === 0 &&
        displayDateless.length === 0 &&
        displayCompletedDateless.length === 0 &&
        displayDroppedDateless.length === 0 &&
        displayCompletedScheduled.length === 0 && (
          <div className="py-24 px-6 text-center text-stone-500 select-none">
            <ListTodo className="w-12 h-12 text-stone-800 mx-auto mb-4" />
            <h4 className="font-sans font-medium text-sm text-stone-400 mb-1">
              {searchQuery.trim()
                ? 'No matching tasks'
                : statusFilter === 'todo'
                  ? 'No scheduled tasks'
                  : statusFilter === 'done'
                    ? 'No completed tasks'
                    : 'List is empty'}
            </h4>
            <p className="text-xs font-sans max-w-md mx-auto leading-relaxed text-stone-500">
              {searchQuery.trim()
                ? 'Try a different search term.'
                : statusFilter === 'todo'
                  ? 'You have no scheduled tasks. Schedule tasks using the input engine below.'
                  : statusFilter === 'done'
                    ? 'Complete some tasks and they will show up here.'
                    : 'Start creating dateless tasks using the input engine below to populate your Lists.'}
            </p>
          </div>
        )}
    </>
  );

  return (
    <div className="space-y-0" id="tasks-view-dashboard">
      {/* Sticky search and filter control header */}
      <div className="z-20 bg-[#0a0a0a] py-0 flex items-center justify-between gap-3">
        <div className="flex gap-1.5">
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
          {/* Paper List trigger */}
          <button
            onClick={() => setIsPaperListOpen(true)}
            className="px-1.75 py-1.5 rounded-lg border border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
            title="Paper List"
          >
            <ClipboardList className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
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
              Lists
            </button>

            <button
              onClick={() => handleStatusFilterChange('todo')}
              className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                statusFilter === 'todo'
                  ? 'bg-stone-800 text-stone-200 shadow-sm'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Scheduled
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

      {/* ── LISTS (INBOX) VIEW ──────────────────────────────────────────────── */}
      {statusFilter === 'inbox' ? (
        <>
          {/* ── MOBILE: original strip layout ── */}
          <div className="md:hidden">
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
            <div className="flex items-center justify-between gap-2 my-2">
              {/* Active list name label */}
              {(() => {
                const activeList = taskLists.find((l) => l.id === selectedListId);
                const cs = activeList
                  ? (LIST_COLORS[activeList.color] ?? LIST_COLORS['violet'])
                  : null;
                return (
                  <div className="flex items-center gap-1.5 min-w-0">
                    {cs && activeList && (
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cs.dot}`} />
                    )}
                    <span className="text-[11px] font-mono font-bold uppercase tracking-widest text-stone-400 truncate">
                      {selectedListId === 'all'
                        ? 'All Tasks'
                        : selectedListId === 'none'
                          ? 'Uncategorized'
                          : (activeList?.name ?? 'Tasks')}
                    </span>
                  </div>
                );
              })()}
              {stateFilterButtons}
            </div>
            {taskSectionsContent}
          </div>

          {/* ── DESKTOP: two-column sidebar layout ── */}
          <div className="hidden md:flex gap-0 mt-3 h-[500px] overflow-hidden">
            {/* LEFT COLUMN — List sidebar */}
            <div className="w-[200px] lg:w-[300px] h-[500px] shrink-0 flex flex-col min-h-0 border-r border-stone-800/60 pr-3 mr-3 items-between">
              {/* Sidebar header: All · None · ··· — pinned, never scrolls */}
              <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-stone-800/60 shrink-0">
                <button
                  onClick={() => {
                    setSelectedListId('all');
                    localStorage.setItem('flowday-tasks-selected-list', 'all');
                    setDatelessPageMap((prev) => ({ ...prev, all: 0 }));
                  }}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                    selectedListId === 'all'
                      ? 'bg-stone-800 border-stone-700 text-stone-100'
                      : 'bg-transparent border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-900'
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => {
                    setSelectedListId('none');
                    localStorage.setItem('flowday-tasks-selected-list', 'none');
                    setDatelessPageMap((prev) => ({ ...prev, none: 0 }));
                  }}
                  className={`flex-1 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer border ${
                    selectedListId === 'none'
                      ? 'bg-stone-800 border-stone-700 text-stone-100'
                      : 'bg-transparent border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-900'
                  }`}
                >
                  None
                </button>
                <button
                  onClick={() => setIsListManagerOpen(true)}
                  className="p-1.5 rounded-lg border border-stone-800 text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer shrink-0"
                  title="Manage lists"
                >
                  <MoreHorizontal className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* List rows — scrollable independently */}
              <div
                className="flex flex-col gap-0.5 overflow-y-auto flex-1 min-h-0"
                style={{ scrollbarWidth: 'none' }}
              >
                {taskLists.length === 0 && (
                  <p className="text-[10px] font-mono text-stone-600 text-center py-6 px-2 leading-relaxed">
                    No lists yet.
                    <br />
                    Click ··· to create one.
                  </p>
                )}
                {taskLists.map((list) => {
                  const cs = LIST_COLORS[list.color] ?? LIST_COLORS['violet'];
                  const isActive = selectedListId === list.id;
                  const counts = listTaskCounts[list.id] ?? { active: 0, done: 0 };
                  return (
                    <button
                      key={list.id}
                      onClick={() => {
                        setSelectedListId(list.id);
                        localStorage.setItem('flowday-tasks-selected-list', list.id);
                        setDatelessPageMap((prev) => ({ ...prev, [list.id]: 0 }));
                      }}
                      className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg border text-left transition-all duration-150 cursor-pointer ${
                        isActive
                          ? cs.active
                          : 'bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:border-stone-800 hover:text-stone-200'
                      }`}
                    >
                      {/* Color dot */}
                      <span className={`w-2 h-2 rounded-full shrink-0 ${cs.dot}`} />

                      {/* List name */}
                      <span className="flex-1 min-w-0 text-[11px] font-mono font-semibold truncate">
                        {list.name}
                      </span>

                      {/* Counts */}
                      <span className="flex items-center gap-1.5 shrink-0">
                        {/* Active count */}
                        {counts.active > 0 && (
                          <span
                            className={`text-[9px] font-mono font-bold tabular-nums min-w-[14px] text-center ${
                              isActive
                                ? 'text-current opacity-80'
                                : 'text-stone-500 group-hover:text-stone-400'
                            }`}
                            title={`${counts.active} active`}
                          >
                            {counts.active}
                          </span>
                        )}
                        {/* Done count */}
                        {counts.done > 0 && (
                          <span
                            className={`text-[9px] font-mono font-bold tabular-nums min-w-[14px] text-center opacity-50 ${
                              isActive
                                ? 'text-current'
                                : 'text-stone-600 group-hover:text-stone-500'
                            }`}
                            title={`${counts.done} completed`}
                          >
                            ✓{counts.done}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Sidebar footer — pinned at bottom, never scrolls */}
              {taskLists.length > 0 && (
                <div className="mt-2 pt-2 border-t border-stone-800/60 shrink-0">
                  <p className="text-[9px] font-mono text-stone-600 tabular-nums">
                    {listTaskCounts['all']?.active ?? 0} active · {listTaskCounts['all']?.done ?? 0}{' '}
                    done
                  </p>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN — Task sections */}
            <div className="flex-1 min-w-0 min-h-0 flex flex-col">
              {/* Active list header & state filter */}
              {(() => {
                const activeList = taskLists.find((l) => l.id === selectedListId);
                const cs = activeList
                  ? (LIST_COLORS[activeList.color] ?? LIST_COLORS['violet'])
                  : null;
                const counts = listTaskCounts[selectedListId] ?? { active: 0, done: 0 };
                return (
                  <div className="flex items-center justify-between gap-2 mb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      {cs && activeList && (
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cs.dot}`} />
                      )}
                      <h3 className="text-[11px] font-mono font-bold uppercase tracking-widest text-stone-400">
                        {selectedListId === 'all'
                          ? 'All Tasks'
                          : selectedListId === 'none'
                            ? 'Uncategorized'
                            : (activeList?.name ?? 'Tasks')}
                      </h3>
                      <span className="text-[9px] font-mono text-stone-600 tabular-nums ml-1">
                        {counts.active > 0 && `${counts.active} active`}
                        {counts.active > 0 && counts.done > 0 && ' · '}
                        {counts.done > 0 && `${counts.done} done`}
                      </span>
                    </div>
                    {stateFilterButtons}
                  </div>
                );
              })()}
              {/* Scrollable task content — independent from left sidebar */}
              <div
                className="flex-1 min-h-0 overflow-y-auto pr-1"
                style={{ scrollbarWidth: 'thin', scrollbarColor: '#3d3d3d transparent' }}
              >
                {taskSectionsContent}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* ── SCHEDULED / DONE VIEWS (unchanged layout) ── */
        <div>{taskSectionsContent}</div>
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

      {/* Task Status Picker Modal */}
      {statusPickerTask && (
        <TaskStatusPickerPopover
          task={statusPickerTask}
          onClose={() => setStatusPickerTask(null)}
        />
      )}

      {/* Move to Page Modal */}
      {moveToPageModalTask && (
        <MoveToPageModal
          task={moveToPageModalTask}
          currentPage={
            moveToPageModalTask.scheduled_at
              ? moveToPageModalTask.status === 'done'
                ? Math.min(completedScheduledPage, completedScheduledTotalPages - 1)
                : Math.min(scheduledPage, scheduledTotalPages - 1)
              : moveToPageModalTask.status === 'done'
                ? Math.min(completedDatelessPage, completedDatelessTotalPages - 1)
                : moveToPageModalTask.status === 'dropped'
                  ? Math.min(droppedDatelessPage, droppedDatelessTotalPages - 1)
                  : moveToPageModalTask.status === 'maybe'
                    ? Math.min(maybeDatelessPage, maybeDatelessTotalPages - 1)
                    : Math.min(datelessPage, datelessTotalPages - 1)
          }
          totalPages={
            moveToPageModalTask.scheduled_at
              ? moveToPageModalTask.status === 'done'
                ? completedScheduledTotalPages
                : scheduledTotalPages
              : moveToPageModalTask.status === 'done'
                ? completedDatelessTotalPages
                : moveToPageModalTask.status === 'dropped'
                  ? droppedDatelessTotalPages
                  : moveToPageModalTask.status === 'maybe'
                    ? maybeDatelessTotalPages
                    : datelessTotalPages
          }
          onClose={() => setMoveToPageModalTask(null)}
          onSelectPage={(taskId, page) => {
            if (moveToPageModalTask.scheduled_at) {
              if (moveToPageModalTask.status === 'done') {
                handleCompletedScheduledMoveToPage(taskId, page);
              } else {
                handleScheduledMoveToPage(taskId, page);
              }
            } else if (moveToPageModalTask.status === 'done') {
              handleCompletedDatelessMoveToPage(taskId, page);
            } else if (moveToPageModalTask.status === 'dropped') {
              handleDroppedDatelessMoveToPage(taskId, page);
            } else if (moveToPageModalTask.status === 'maybe') {
              handleMaybeDatelessMoveToPage(taskId, page);
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
