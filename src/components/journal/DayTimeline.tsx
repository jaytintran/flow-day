/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Clock,
  Pencil,
  Trash2,
  Calendar,
  Check,
  FileText,
  Clock1,
  CheckCircle,
  Play,
  CalendarArrowUp,
  Undo2,
  Repeat2,
  Hourglass,
  Star,
  Sparkles,
} from 'lucide-react';
import { TimelineEntry, Task, Log, Event, Note, TimeBlock, HabitLog } from '../../types';
import { formatDuration, toLocalDateString } from '../../utils';
import TimePickerSheet from '../TimePickerSheet';
import TimeRulerOverlay from './TimeRulerOverlay';
import { db } from '../../db';

function truncateText(text?: string, limit = 100): string {
  if (!text) return '';
  const trimmed = text.trim();
  return trimmed.length > limit ? trimmed.substring(0, limit) + '...' : trimmed;
}

export type RenderItem =
  | {
      type: 'bracket';
      block: TimeBlock;
      children: TimelineEntry[];
      sortTime: number;
    }
  | { type: 'standalone'; entry: TimelineEntry; sortTime: number }
  | { type: 'sleep'; timeStr: string; sortTime: number }
  | { type: 'now_needle'; sortTime: number };

export const DAY_PHASES = [
  {
    id: 'morning',
    title: 'Morning',
    icon: '🌅',
    timeRange: '06:00 AM – 12:00 PM',
    startHour: 0,
    endHour: 12,
    emptyText: 'Set your morning intentions & start fresh.',
    borderClasses: 'border-amber-500/25 hover:border-amber-500/40',
    bgClasses: 'bg-gradient-to-b from-amber-950/15 via-[#111111]/70 to-[#0e0e0e]/90',
    headerBadge: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    dotColor: 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.5)]',
  },
  {
    id: 'noon',
    title: 'Noon',
    icon: '☀️',
    timeRange: '12:00 PM – 02:00 PM',
    startHour: 12,
    endHour: 14,
    emptyText: 'Enjoy your lunch break!',
    borderClasses: 'border-yellow-500/25 hover:border-yellow-500/40',
    bgClasses: 'bg-gradient-to-b from-yellow-950/15 via-[#111111]/70 to-[#0e0e0e]/90',
    headerBadge: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300',
    dotColor: 'bg-yellow-400 shadow-[0_0_8px_rgba(234,179,8,0.5)]',
  },
  {
    id: 'afternoon',
    title: 'Afternoon',
    icon: '🌤️',
    timeRange: '02:00 PM – 06:00 PM',
    startHour: 14,
    endHour: 18,
    emptyText: 'Power through your focus sessions & meetings.',
    borderClasses: 'border-orange-500/25 hover:border-orange-500/40',
    bgClasses: 'bg-gradient-to-b from-orange-950/15 via-[#111111]/70 to-[#0e0e0e]/90',
    headerBadge: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
    dotColor: 'bg-orange-400 shadow-[0_0_8px_rgba(249,115,22,0.5)]',
  },
  {
    id: 'evening',
    title: 'Evening',
    icon: '🌙',
    timeRange: '06:00 PM – 11:00 PM',
    startHour: 18,
    endHour: 24,
    emptyText: "Unwind, review today's wins, and recharge.",
    borderClasses: 'border-indigo-500/25 hover:border-indigo-500/40',
    bgClasses: 'bg-gradient-to-b from-indigo-950/15 via-[#111111]/70 to-[#0e0e0e]/90',
    headerBadge: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
    dotColor: 'bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]',
  },
];

interface DayTimelineProps {
  items: RenderItem[];
  labelString: string;
  isFromTimelineView?: boolean;
  collapsedDays: Set<string>;
  toggleDayCollapse: (dayStr: string) => void;
  setActiveDate: (date: Date) => void;
  deletingId: string | null;
  activeTaskId: string | null;
  handleDeleteEntry: (id: string) => void;
  handleOpenDetail: (entry: TimelineEntry) => void;
  handleToggleTaskStatus: (task: Task) => void;
  handleActivateTask: (taskId: string) => void;
  handleCarryTask: (taskId: string, targetDate: Date) => void;
  formatTime: (dateInput: Date | string) => string;
  formatDateStringLabel: (dayStr: string) => string;
  onTimePickerConfirm: (entry: TimelineEntry, newDate: Date) => void;
}

export default function DayTimeline({
  items,
  labelString,
  isFromTimelineView = false,
  collapsedDays,
  toggleDayCollapse,
  setActiveDate,
  deletingId,
  activeTaskId,
  handleDeleteEntry,
  handleOpenDetail,
  handleToggleTaskStatus,
  handleActivateTask,
  handleCarryTask,
  formatTime,
  formatDateStringLabel,
  onTimePickerConfirm,
}: DayTimelineProps) {
  const isCollapsed = collapsedDays.has(labelString);
  const HABITS_COLLAPSE_KEY = `habits_collapsed_${labelString}`;
  const [habitsCollapsed, setHabitsCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem(HABITS_COLLAPSE_KEY);
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });
  // Local state for time picker and time ruler
  const [pickerEntry, setPickerEntry] = useState<TimelineEntry | null>(null);
  const [activeRulerState, setActiveRulerState] = useState<{
    entry: TimelineEntry | TimeBlock;
    initialDate: Date;
    initialEndDate?: Date;
    mode: 'start' | 'end' | 'span';
    originY: number;
    originX: number;
  } | null>(null);
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartPosRef = React.useRef<{
    x: number;
    y: number;
    entry: TimelineEntry | TimeBlock;
    mode: 'start' | 'end' | 'span';
    initialDate: Date;
    initialEndDate?: Date;
  } | null>(null);

  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [editingLogTitle, setEditingLogTitle] = useState('');

  const [showTimelineContent, setShowTimelineContent] = useState(() => {
    try {
      const stored = localStorage.getItem('flowday_show_note_event_content');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  const [showDayPhases, setShowDayPhases] = useState(() => {
    try {
      const stored = localStorage.getItem('flowday_show_day_phases');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  const [sleepTime, setSleepTime] = useState(() => {
    try {
      return localStorage.getItem('flowday_sleep_time') || '23:00';
    } catch {
      return '23:00';
    }
  });

  const [sleepEnabled, setSleepEnabled] = useState(() => {
    try {
      const stored = localStorage.getItem('flowday_sleep_enabled');
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const handleSettingsChange = () => {
      try {
        const storedShow = localStorage.getItem('flowday_show_note_event_content');
        setShowTimelineContent(storedShow === null ? true : storedShow === 'true');
        const storedSleep = localStorage.getItem('flowday_sleep_time');
        setSleepTime(storedSleep || '23:00');
        const storedSleepEnabled = localStorage.getItem('flowday_sleep_enabled');
        setSleepEnabled(storedSleepEnabled === null ? true : storedSleepEnabled === 'true');
        const storedPhases = localStorage.getItem('flowday_show_day_phases');
        setShowDayPhases(storedPhases === null ? true : storedPhases === 'true');
      } catch {}
    };
    window.addEventListener('flowday-settings-change', handleSettingsChange);
    return () => window.removeEventListener('flowday-settings-change', handleSettingsChange);
  }, []);

  const enrichedItems = useMemo(() => {
    const combined: RenderItem[] = [...items];

    if (sleepEnabled && sleepTime) {
      // Parse sleepTime (e.g. "23:00" -> hours=23, minutes=0)
      const [hoursStr, minutesStr] = sleepTime.split(':');
      const hours = parseInt(hoursStr, 10);
      const minutes = parseInt(minutesStr, 10);
      if (!isNaN(hours) && !isNaN(minutes)) {
        // Create Date for sleep time on this specific day
        const sleepDate = new Date(labelString);
        sleepDate.setHours(hours, minutes, 0, 0);
        combined.push({
          type: 'sleep',
          timeStr: sleepTime,
          sortTime: sleepDate.getTime(),
        });
      }
    }

    // Live Now Needle for Today (only in TimelineView)
    const todayStr = toLocalDateString(new Date());
    if (labelString === todayStr && isFromTimelineView) {
      combined.push({
        type: 'now_needle',
        sortTime: Date.now(),
      });
    }

    return combined.sort((a, b) => a.sortTime - b.sortTime);
  }, [items, sleepEnabled, sleepTime, labelString, isFromTimelineView]);

  const renderNowNeedle = () => {
    const nowStr = formatTime(new Date());
    return (
      <div
        key="live-now-needle"
        className="group relative flex items-center gap-2.5 py-2 rounded md:px-3 select-none z-10"
      >
        {/* Left Column 1: Time Gutter */}
        <div className="w-14 text-right shrink-0 select-none whitespace-nowrap">
          <span className="text-[9px] font-mono font-bold tracking-wider text-amber-400 bg-amber-500/15 border border-amber-500/40 px-1.5 py-0.5 rounded shadow-[0_0_8px_rgba(245,158,11,0.25)]">
            NOW
          </span>
        </div>

        {/* Left Column 2: Glowing Beacon Node directly on spine */}
        <div className="w-5 h-5 flex items-center justify-center relative shrink-0 z-10 bg-[#0a0a0a] rounded-full">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-amber-200 shadow-[0_0_8px_rgba(245,158,11,1)] relative z-10" />
          <div className="w-4 h-4 rounded-full bg-amber-400/40 animate-ping absolute" />
        </div>

        {/* Right Column: Radiant Laser line */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <div className="flex-1 h-px bg-gradient-to-r from-amber-500/80 via-amber-500/30 to-transparent" />
          <span className="text-[9px] font-mono text-amber-400/90 shrink-0 font-medium">{nowStr}</span>
        </div>
      </div>
    );
  };

  const renderSleepRow = (timeStr: string, sortTime: number) => {
    const sleepDate = new Date(sortTime);
    const timeLabel = formatTime(sleepDate);

    const todayStr = toLocalDateString(new Date());
    const isToday = labelString === todayStr;

    let countdownText = '';
    if (isToday) {
      const now = new Date();
      const diffMs = sortTime - now.getTime();
      if (diffMs > 0) {
        const totalMin = Math.floor(diffMs / 60000);
        const hrs = Math.floor(totalMin / 60);
        const mins = totalMin % 60;
        countdownText = hrs > 0 ? `(${hrs}h ${mins}m left)` : `(${mins}m left)`;
      } else {
        countdownText = '(Past bedtime!)';
      }
    }

    return (
      <div
        key="sleep-timeline-row"
        className="group relative flex items-center gap-2.5 py-3 rounded md:px-3 select-none"
      >
        {/* Left Column 1: Time Gutter */}
        <div className="w-14 text-right shrink-0 select-none whitespace-nowrap">
          <span className="text-[10px] font-mono font-medium tracking-tight text-violet-400 whitespace-nowrap">
            {timeLabel}
          </span>
        </div>

        {/* Left Column 2: Icon */}
        <div className="w-5 h-5 flex items-center justify-center relative shrink-0 z-10 bg-[#0a0a0a] rounded-full">
          <div className="w-6 h-6 rounded-full border border-violet-500/20 bg-violet-500/10 text-violet-400 flex items-center justify-center">
            <span className="text-[11px]">🌙</span>
          </div>
        </div>

        {/* Right Column: Sleep Label and Countdown */}
        <div className="flex-1 min-w-0 flex items-center gap-2">
          <span className="text-xs font-sans font-semibold text-violet-300">Sleep Time</span>
          {countdownText && (
            <span
              className={`text-[10px] font-mono ${countdownText.includes('Past') ? 'text-red-400 font-semibold' : 'text-stone-500'}`}
            >
              {countdownText}
            </span>
          )}
        </div>
      </div>
    );
  };

  const saveInlineTitle = async (id: string) => {
    const trimmed = editingLogTitle.trim();
    if (trimmed) {
      await db.entries.update(id, { title: trimmed });
    }
    setEditingLogId(null);
  };

  const getPickerInitialDate = (entry: TimelineEntry): Date => {
    if (entry.type === 'task') {
      const task = entry as Task;
      if (task.status === 'done' && task.completed_at) return new Date(task.completed_at);
      return new Date(task.scheduled_at || task.created_at);
    }
    if (entry.type === 'log') return new Date((entry as Log).timestamp);
    if (entry.type === 'event') return new Date((entry as Event).timestamp);
    if (entry.type === 'note') return new Date((entry as Note).timestamp);
    if (entry.type === 'habit-log') return new Date((entry as HabitLog).timestamp);
    return new Date(entry.created_at);
  };

  const getEntrySpan = (entry: TimelineEntry) => {
    let startDate: Date | null = null;
    let endDate: Date | null = null;

    if (entry.type === 'task') {
      const task = entry as Task;
      const start = task.scheduled_at || task.created_at;
      if (task.scheduled_end_at && start) {
        startDate = new Date(start);
        endDate = new Date(task.scheduled_end_at);
      }
    } else if (entry.type === 'log') {
      const log = entry as Log;
      if (log.end_timestamp) {
        startDate = new Date(log.timestamp);
        endDate = new Date(log.end_timestamp);
      }
    } else if (entry.type === 'event') {
      const event = entry as Event;
      if (event.end_timestamp) {
        startDate = new Date(event.timestamp);
        endDate = new Date(event.end_timestamp);
      }
    }

    if (startDate && endDate && endDate.getTime() > startDate.getTime()) {
      const durationMs = endDate.getTime() - startDate.getTime();
      return {
        hasSpan: true,
        startDate,
        endDate,
        durationMs,
        durationLabel: formatDuration(durationMs),
      };
    }

    return {
      hasSpan: false,
      startDate: new Date(entry.created_at),
      endDate: new Date(entry.created_at),
      durationMs: 0,
      durationLabel: '',
    };
  };

  const handleGutterPointerDown = (
    e: React.PointerEvent,
    entry: TimelineEntry | TimeBlock,
    mode: 'start' | 'end' | 'span' = 'start',
    customStartDate?: Date,
    customEndDate?: Date,
  ) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    const targetEl = e.currentTarget as HTMLElement;

    try {
      targetEl.setPointerCapture(pointerId);
    } catch {}

    const initStartDate =
      customStartDate ||
      ('start_at' in entry
        ? new Date(entry.start_at)
        : getPickerInitialDate(entry as TimelineEntry));

    const initEndDate =
      customEndDate ||
      ('end_at' in entry ? new Date(entry.end_at) : undefined);

    dragStartPosRef.current = {
      x: startX,
      y: startY,
      entry,
      mode,
      initialDate: initStartDate,
      initialEndDate: initEndDate,
    };

    if (holdTimerRef.current) clearTimeout(holdTimerRef.current);

    holdTimerRef.current = setTimeout(() => {
      if (dragStartPosRef.current) {
        setActiveRulerState({
          entry: dragStartPosRef.current.entry,
          initialDate: dragStartPosRef.current.initialDate,
          initialEndDate: dragStartPosRef.current.initialEndDate,
          mode: dragStartPosRef.current.mode,
          originY: startY,
          originX: startX,
        });
      }
    }, 180);
  };

  const handleGutterPointerMove = (e: React.PointerEvent) => {
    if (!dragStartPosRef.current || activeRulerState) return;
    const dist = Math.hypot(
      e.clientX - dragStartPosRef.current.x,
      e.clientY - dragStartPosRef.current.y,
    );
    if (dist > 2) {
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current);
      setActiveRulerState({
        entry: dragStartPosRef.current.entry,
        initialDate: dragStartPosRef.current.initialDate,
        initialEndDate: dragStartPosRef.current.initialEndDate,
        mode: dragStartPosRef.current.mode,
        originY: e.clientY,
        originX: e.clientX,
      });
    }
  };

  const handleGutterPointerUp = (e: React.PointerEvent, entry: TimelineEntry | TimeBlock) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    const hadStart = dragStartPosRef.current;
    dragStartPosRef.current = null;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}

    // Only open standard picker modal if the ruler overlay never got activated
    if (hadStart && !activeRulerState && !('block_type' in entry || 'children_ids' in entry)) {
      e.stopPropagation();
      setPickerEntry(entry as TimelineEntry);
    }
  };

  const handleConfirmSpanRuler = async (newStart: Date, newEnd?: Date) => {
    if (!activeRulerState) return;
    const { entry, mode, initialDate, initialEndDate } = activeRulerState;

    // Validate that End Time is strictly after Start Time
    if (mode === 'end' && newEnd) {
      if (newEnd.getTime() <= initialDate.getTime()) {
        alert('End time cannot be earlier than or equal to start time.');
        setActiveRulerState(null);
        return;
      }
    } else if (mode === 'start' && initialEndDate) {
      if (newStart.getTime() >= initialEndDate.getTime()) {
        alert('Start time cannot be later than or equal to end time.');
        setActiveRulerState(null);
        return;
      }
    }

    setActiveRulerState(null);

    // If it's a TimeBlock bracket
    if ('block_type' in entry || 'children_ids' in entry) {
      const block = entry as TimeBlock;
      if (mode === 'start') {
        await db.entries.update(block.id, { start_at: newStart } as any);
      } else if (mode === 'end' && newEnd) {
        await db.entries.update(block.id, { end_at: newEnd } as any);
      } else if (mode === 'span' && newEnd) {
        await db.entries.update(block.id, { start_at: newStart, end_at: newEnd } as any);
      }
      return;
    }

    // If it's a TimelineEntry
    const timelineEntry = entry as TimelineEntry;
    if (timelineEntry.type === 'task') {
      const task = timelineEntry as Task;
      if (mode === 'start') {
        await db.entries.update(task.id, { scheduled_at: newStart } as any);
      } else if (mode === 'end' && newEnd) {
        await db.entries.update(task.id, { scheduled_end_at: newEnd } as any);
      } else if (mode === 'span' && newEnd) {
        await db.entries.update(task.id, { scheduled_at: newStart, scheduled_end_at: newEnd } as any);
      }
    } else if (timelineEntry.type === 'log') {
      const log = timelineEntry as Log;
      if (mode === 'start') {
        await db.entries.update(log.id, { timestamp: newStart } as any);
      } else if (mode === 'end' && newEnd) {
        await db.entries.update(log.id, { end_timestamp: newEnd } as any);
      } else if (mode === 'span' && newEnd) {
        await db.entries.update(log.id, { timestamp: newStart, end_timestamp: newEnd } as any);
      }
    } else if (timelineEntry.type === 'event') {
      const event = timelineEntry as Event;
      if (mode === 'start') {
        await db.entries.update(event.id, { timestamp: newStart } as any);
      } else if (mode === 'end' && newEnd) {
        await db.entries.update(event.id, { end_timestamp: newEnd } as any);
      } else if (mode === 'span' && newEnd) {
        await db.entries.update(event.id, { timestamp: newStart, end_timestamp: newEnd } as any);
      }
    } else if (timelineEntry.type === 'note') {
      await db.entries.update(timelineEntry.id, { timestamp: newStart } as any);
    } else if (timelineEntry.type === 'habit-log') {
      await db.entries.update(timelineEntry.id, { timestamp: newStart } as any);
    }
  };

  const handleGutterPointerCancel = (e: React.PointerEvent) => {
    if (activeRulerState) return;
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    dragStartPosRef.current = null;
  };

  // Render individual generic row with customized icons
  const renderStandaloneRow = (
    entry: TimelineEntry,
    isFirst: boolean,
    isLast: boolean,
    customSpineMargin = 'left-[19.5px]',
  ) => {
    const isTask = entry.type === 'task';
    const isLog = entry.type === 'log';
    const isEvent = entry.type === 'event';
    const isNote = entry.type === 'note';
    const isHabitLog = entry.type === 'habit-log';

    // Extract primary time to display in the gutter
    let primaryTime = '';
    let isCompletedTask = false;
    let isScheduledTime = false;
    if (isTask) {
      const task = entry as Task;
      if (task.status === 'done' && task.completed_at) {
        primaryTime = formatTime(task.completed_at);
        isCompletedTask = true;
      } else {
        primaryTime = formatTime(task.scheduled_at || task.created_at);
        isScheduledTime =
          !!task.scheduled_at &&
          new Date(task.scheduled_at).getTime() !== new Date(task.created_at).getTime();
      }
    } else if (isLog) {
      primaryTime = formatTime((entry as Log).timestamp);
    } else if (isEvent) {
      primaryTime = formatTime((entry as Event).timestamp);
    } else if (isNote) {
      primaryTime = formatTime((entry as Note).timestamp);
    } else if (isHabitLog) {
      primaryTime = formatTime((entry as HabitLog).timestamp);
    }

    const span = getEntrySpan(entry);

    return (
      <div
        key={entry.id}
        id={`entry-${entry.id}`}
        onClick={() => !isHabitLog && entry.type !== 'log' && handleOpenDetail(entry)}
        className={`group relative flex items-center gap-2.5 py-2.5 rounded md:px-3 transition-colors border-stone-900/50 last:border-b-0 ${
          isHabitLog || entry.type === 'log' ? '' : 'hover:bg-stone-900/40 cursor-pointer'
        }`}
      >
        {/* Left Column 1: Time Gutter */}
        {span.hasSpan ? (
          <div className="w-14 text-right shrink-0 select-none flex flex-col items-end justify-between self-stretch py-2 whitespace-nowrap min-h-[92px]">
            {/* Top: Start Time */}
            <span
              onPointerDown={(e) =>
                handleGutterPointerDown(e, entry, 'start', span.startDate, span.endDate)
              }
              onPointerMove={handleGutterPointerMove}
              onPointerUp={(e) => handleGutterPointerUp(e, entry)}
              onPointerCancel={handleGutterPointerCancel}
              onClick={(e) => e.stopPropagation()}
              title="Drag to adjust Start Time"
              className="text-[9px] font-mono font-bold text-sky-400 hover:text-amber-300 cursor-ns-resize transition-colors whitespace-nowrap tracking-tight leading-none"
            >
              {formatTime(span.startDate)}
            </span>

            {/* Connecting Vertical Rail & Center Duration Badge */}
            <div className="w-full flex items-center justify-end my-2 relative pr-1.5 flex-1 min-h-[36px]">
              <div className="absolute right-0 top-0 bottom-0 w-[1.5px] bg-gradient-to-b from-sky-400/80 via-amber-400/80 to-sky-400/80 rounded-full" />
              <button
                type="button"
                onPointerDown={(e) =>
                  handleGutterPointerDown(e, entry, 'span', span.startDate, span.endDate)
                }
                onPointerMove={handleGutterPointerMove}
                onPointerUp={(e) => handleGutterPointerUp(e, entry)}
                onPointerCancel={handleGutterPointerCancel}
                onClick={(e) => e.stopPropagation()}
                title="Drag to shift entire time span"
                className="relative z-10 px-1 py-0.5 text-[8px] font-mono font-bold rounded bg-[#161616] border border-amber-500/40 text-amber-400 shadow-md hover:border-amber-400 hover:scale-105 active:scale-95 cursor-grab transition-all"
              >
                {span.durationLabel}
              </button>
            </div>

            {/* Bottom: End Time */}
            <span
              onPointerDown={(e) =>
                handleGutterPointerDown(e, entry, 'end', span.startDate, span.endDate)
              }
              onPointerMove={handleGutterPointerMove}
              onPointerUp={(e) => handleGutterPointerUp(e, entry)}
              onPointerCancel={handleGutterPointerCancel}
              onClick={(e) => e.stopPropagation()}
              title="Drag to adjust End Time"
              className="text-[9px] font-mono font-bold text-sky-400/80 hover:text-amber-300 cursor-ns-resize transition-colors whitespace-nowrap tracking-tight leading-none"
            >
              {formatTime(span.endDate)}
            </span>
          </div>
        ) : (
          <div className="w-14 text-right shrink-0 select-none whitespace-nowrap self-center">
            <span
              onPointerDown={(e) => handleGutterPointerDown(e, entry, 'start')}
              onPointerMove={handleGutterPointerMove}
              onPointerUp={(e) => handleGutterPointerUp(e, entry)}
              onPointerCancel={handleGutterPointerCancel}
              onClick={(e) => e.stopPropagation()}
              title="Click to edit · Hold & drag for time ruler"
              className={`text-[10px] font-mono font-medium tracking-tight cursor-pointer hover:text-amber-400 transition-colors touch-none whitespace-nowrap ${
                isCompletedTask || isHabitLog
                  ? 'text-emerald-600 font-semibold'
                  : isScheduledTime
                    ? 'text-sky-500'
                    : 'text-stone-500'
              }`}
            >
              {primaryTime}
            </span>
          </div>
        )}

        {/* Left Column 2: Icon Dot / Checkbox (Centered vertically) */}
        <div className="w-5 h-5 flex items-center justify-center relative shrink-0 z-10 self-center">
          {isTask && (
            <button
              id={`task-status-btn-${entry.id}`}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTaskStatus(entry as Task);
              }}
              className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors cursor-pointer ${
                (entry as Task).status === 'done'
                  ? 'bg-stone-800 border-stone-700 text-stone-400'
                  : 'border-stone-700 bg-[#0a0a0a] text-transparent hover:text-stone-400 hover:bg-stone-900/60'
              }`}
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          )}

          {isLog && (
            <div className="w-6 h-6 flex items-center justify-center select-none">
              <div className="w-2 h-2 rounded-full bg-stone-500" />
            </div>
          )}

          {isEvent && (
            <div className="w-6 h-6 rounded border border-stone-800 bg-[#121212] text-indigo-400 flex items-center justify-center">
              <Calendar className="w-3.5 h-3.5" />
            </div>
          )}

          {isNote && (
            <div
              className={`w-6 h-6 rounded border bg-[#121212] flex items-center justify-center transition-all ${
                Boolean((entry as Note).content?.trim())
                  ? 'border-blue-500/20 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.05)]'
                  : 'border-stone-800 text-stone-600'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
            </div>
          )}

          {isHabitLog && (
            <div className="w-6 h-6 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <Repeat2 className="w-3.5 h-3.5" />
            </div>
          )}
        </div>
        {/* Right Column: Row Display details */}
        <div className="flex-1 min-w-0 flex flex-col justify-center gap-0.5">
          {/* Row 1: Title + Action Tools */}
          <div className="flex justify-between items-center gap-4">
            <div className="flex-1">
              {isLog && (
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  {editingLogId === entry.id ? (
                    <input
                      type="text"
                      value={editingLogTitle}
                      onChange={(e) => setEditingLogTitle(e.target.value)}
                      onBlur={() => saveInlineTitle(entry.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          saveInlineTitle(entry.id);
                        } else if (e.key === 'Escape') {
                          setEditingLogId(null);
                        }
                      }}
                      autoFocus
                      className="bg-stone-900 border border-stone-800 rounded px-2 py-0.5 text-xs text-stone-200 focus:outline-none focus:border-stone-700 w-full font-sans font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <p
                        id={`log-title-${entry.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLogId(entry.id);
                          setEditingLogTitle((entry as Log).title);
                        }}
                        className="text-xs font-sans font-semibold text-stone-200 break-words line-clamp-1 hover:text-stone-300 transition-colors"
                      >
                        {(entry as Log).title}
                      </p>
                      {(entry as Log).end_timestamp && (
                        <span
                          className="inline-flex items-center gap-1 bg-stone-900 border border-stone-800 text-stone-400 rounded-md px-1.5 py-0.5 text-[9px] font-mono shrink-0 select-none"
                          title={`Logged span: ${formatTime((entry as Log).timestamp)} – ${formatTime((entry as Log).end_timestamp!)}`}
                        >
                          <Clock className="w-2.5 h-2.5 text-stone-500" />
                          <span>
                            {formatDuration(
                              new Date((entry as Log).end_timestamp!).getTime() -
                                new Date((entry as Log).timestamp).getTime(),
                            )}
                          </span>
                        </span>
                      )}
                    </>
                  )}
                </div>
              )}

              {isTask && (
                <div className="flex flex-col">
                  <p
                    id={`task-title-${entry.id}`}
                    className={`text-xs font-sans break-words line-clamp-1 ${
                      (entry as Task).status === 'done'
                        ? ((entry as Task).starred || (entry as Task).achievements?.length)
                          ? 'text-amber-400/80 line-through font-semibold'
                          : 'text-stone-600 line-through font-semibold'
                        : 'text-stone-200 font-semibold'
                    }`}
                  >
                    {(entry as Task).status === 'done' && (
                      <>
                        {(entry as Task).achievements?.length ? (
                          <span className="mr-1.5 not-italic" title="Logged Achievements">🏆</span>
                        ) : null}
                        {((entry as Task).starred || ((entry as Task).achievements && (entry as Task).achievements!.length > 0)) ? (
                          <span className="mr-1.5 not-italic text-amber-400" title="Starred Win">⭐</span>
                        ) : null}
                      </>
                    )}
                    {(entry as Task).title}
                  </p>
                  {showTimelineContent && Boolean((entry as Task).content?.trim()) && (
                    <p className="text-[11px] text-stone-400 font-sans mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                      {truncateText((entry as Task).content)}
                    </p>
                  )}
                </div>
              )}

              {isEvent && (
                <div className="flex flex-col">
                  <p
                    id={`event-title-${entry.id}`}
                    className="text-xs font-sans font-semibold text-stone-200 break-words line-clamp-1"
                  >
                    {(entry as Event).title}
                  </p>
                  {showTimelineContent && Boolean((entry as Event).content?.trim()) && (
                    <p className="text-[11px] text-stone-400 font-sans mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                      {truncateText((entry as Event).content)}
                    </p>
                  )}
                </div>
              )}

              {isNote && (
                <div className="flex flex-col">
                  <span
                    id={`note-title-${entry.id}`}
                    className="text-xs font-sans font-semibold text-stone-200 break-words line-clamp-1"
                  >
                    {(entry as Note).title || 'Untitled Note'}
                  </span>
                  {showTimelineContent && Boolean((entry as Note).content?.trim()) && (
                    <p className="text-[11px] text-stone-400 font-sans mt-0.5 whitespace-pre-wrap break-words leading-relaxed">
                      {truncateText((entry as Note).content)}
                    </p>
                  )}
                </div>
              )}

              {isHabitLog && (
                <p
                  id={`habitlog-title-${entry.id}`}
                  className="text-xs font-sans font-semibold text-stone-200 break-words line-clamp-1"
                >
                  {(entry as HabitLog).title}
                </p>
              )}
            </div>

            {/* Right-aligned actions: Delete Entry Tool */}
            <div className="flex items-center gap-1 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
              {isTask && (entry as Task).status === 'todo' && (
                <button
                  id={`activate-task-btn-${entry.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleActivateTask(entry.id);
                  }}
                  className="p-1.5 bg-transparent rounded border border-stone-800 hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                  title="Activate as Working Task"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              )}

              {isTask && (entry as Task).status === 'done' && (
                <button
                  id={`star-task-btn-${entry.id}`}
                  onClick={async (e) => {
                    e.stopPropagation();
                    const task = entry as Task;
                    const isStarred = !task.starred;
                    await db.entries.update(task.id, { starred: isStarred } as any);
                  }}
                  className={`p-1.5 bg-transparent rounded border border-stone-800 hover:bg-stone-850 transition-colors cursor-pointer ${
                    (entry as Task).starred || ((entry as Task).achievements && (entry as Task).achievements!.length > 0)
                      ? 'text-amber-400 hover:text-amber-300'
                      : 'text-stone-500 hover:text-stone-300'
                  }`}
                  title={
                    (entry as Task).starred || ((entry as Task).achievements && (entry as Task).achievements!.length > 0)
                      ? 'Unstar achievement'
                      : 'Star achievement'
                  }
                >
                  <Star
                    className={`w-3.5 h-3.5 ${
                      (entry as Task).starred || ((entry as Task).achievements && (entry as Task).achievements!.length > 0)
                        ? 'fill-current'
                        : ''
                    }`}
                  />
                </button>
              )}

              {deletingId === entry.id ? (
                <button
                  id={`confirm-delete-entry-${entry.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEntry(entry.id);
                  }}
                  className="px-2 py-1 text-[10px] bg-red-950/80 border border-red-800/80 rounded text-red-400 font-mono font-bold hover:bg-red-900 transition-colors cursor-pointer"
                  title="Confirm delete"
                >
                  Sure?
                </button>
              ) : (
                <button
                  id={`delete-entry-btn-${entry.id}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteEntry(entry.id);
                  }}
                  className="p-1.5 bg-transparent rounded border border-stone-800 hover:bg-stone-800 text-stone-500 hover:text-red-400 transition-colors cursor-pointer"
                  title="Delete Log Entry"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Custom info triggers */}
          <div className="flex items-center gap-x-1.5 text-xs pb-1">
            {isLog && (
              <span className="font-mono text-stone-500 flex items-center gap-1.5 flex-wrap">
                {(entry as Log).end_timestamp ? (
                  <>
                    <span>
                      Span: {formatTime((entry as Log).timestamp)} – {formatTime((entry as Log).end_timestamp!)}
                    </span>
                    <span className="text-stone-700">·</span>
                    <span className="text-stone-400">
                      Duration: {formatDuration(
                        new Date((entry as Log).end_timestamp!).getTime() -
                          new Date((entry as Log).timestamp).getTime(),
                      )}
                    </span>
                  </>
                ) : (
                  <span>Logged at: {formatTime((entry as Log).timestamp)}</span>
                )}
              </span>
            )}

            {isTask && (
              <>
                <span className="flex items-center gap-1 bg-[#121212] border border-stone-800 text-stone-400 rounded px-2 py-0.5 text-[8px]">
                  <Clock className="w-3 h-3 inline-block text-stone-500" />
                  {formatTime(entry.created_at)}
                </span>

                {(entry as Task).scheduled_end_at && (
                  <span className="flex items-center gap-1 bg-[#121212] border border-sky-800/30 text-sky-400/90 rounded px-2 py-0.5 text-[8px]">
                    <Calendar className="w-3 h-3 inline-block text-sky-400" />
                    {formatTime((entry as Task).scheduled_at || (entry as Task).created_at)} – {formatTime((entry as Task).scheduled_end_at!)}
                  </span>
                )}

                {(entry as Task).completed_at && (
                  <span className="flex items-center gap-1 bg-[emerald-900] text-emerald-600/90 border border-emerald-600/30 rounded px-2 py-0.5 text-[8px]">
                    <CheckCircle className="w-3 h-3 inline-block" />
                    {formatTime((entry as Task).completed_at!)}
                  </span>
                )}

                <span className="flex items-center gap-1 bg-[#121212] border border-blue-800/30 text-blue-400/90 rounded px-2 py-0.5 text-[8px]">
                  <Hourglass className="w-3 h-3 inline-block" />
                  {formatDuration((entry as Task).time_spent)}
                </span>
              </>
            )}

            {isEvent && (
              <span className="font-mono text-stone-500">
                {(entry as Event).end_timestamp
                  ? `Happens: ${formatTime((entry as Event).timestamp)} – ${formatTime((entry as Event).end_timestamp!)} (${formatDuration(new Date((entry as Event).end_timestamp!).getTime() - new Date((entry as Event).timestamp).getTime())})`
                  : `Happens at: ${formatTime((entry as Event).timestamp)}`}
              </span>
            )}

            {isNote && (
              <span className="font-mono text-stone-500">
                Created at: {formatTime((entry as Note).timestamp)}
              </span>
            )}

            {isHabitLog && (
              <span className="flex items-center gap-1 bg-emerald-950/30 text-emerald-500 border border-emerald-700/30 rounded px-2 py-0.5 text-[10px]">
                <CheckCircle className="w-3 h-3 inline-block" />
                At: {formatTime((entry as HabitLog).timestamp)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render bracket section of a time block
  const renderBracketItem = (block: TimeBlock, children: TimelineEntry[]) => {
    return (
      <div key={block.id} className="w-full py-2" id={`timeblock-${block.id}`}>
        {/* Bracket Header Info */}
        <div
          className="flex justify-between items-center bg-[#121212] border border-stone-800 rounded px-4 py-2.5 ml-5 mt-4 cursor-pointer hover:border-stone-700 transition-colors"
          onClick={() => handleOpenDetail(block)}
        >
          <div className="flex items-center gap-2.5">
            <Clock className="w-4 h-4 text-stone-400 shrink-0" />
            <div className="flex flex-col justify-center min-w-0">
              <span className="text-[9px] text-stone-300 font-mono leading-tight">
                {formatTime(block.start_at)} – {formatTime(block.end_at)}
              </span>
              <span className="font-mono text-[10px] text-stone-300 uppercase tracking-widest font-semibold leading-tight">
                {block.title}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDetail(block);
              }}
              className="p-1 rounded text-stone-500 hover:text-stone-300 hover:bg-stone-850 transition-colors cursor-pointer"
              title="Edit Time Block"
            >
              <Pencil className="w-3 h-3" />
            </button>
            {deletingId === block.id ? (
              <button
                id={`delete-timeblock-${block.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteEntry(block.id);
                }}
                className="px-2.5 py-1 text-[10px] bg-red-950/80 border border-red-800/80 rounded text-red-500 font-mono font-bold hover:bg-red-900 transition-colors cursor-pointer"
                title="Confirm remove time block"
              >
                Sure?
              </button>
            ) : (
              <button
                id={`delete-timeblock-${block.id}`}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteEntry(block.id);
                }}
                className="p-1 rounded text-stone-500 hover:text-stone-300 hover:bg-stone-850 transition-colors cursor-pointer"
                title="Remove Time Block"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Vertical Architectural Bracket representation wrapping its matching children */}
        <div className="relative pr-2 py-3 mt-2 border-l-2 border-stone-800 ml-5.5">
          <div className="absolute top-0 left-0 w-2.5 h-[2px] bg-stone-800" />
          <div className="absolute bottom-0 left-0 w-2.5 h-[2px] bg-stone-800" />

          {children.length > 0 ? (
            <div className="space-y-3">
              {children.map((child, cIdx) =>
                renderStandaloneRow(
                  child,
                  cIdx === 0,
                  cIdx === children.length - 1,
                  'left-[19.5px]',
                ),
              )}
            </div>
          ) : (
            <div className="text-stone-500 font-serif italic text-xs py-2 px-1">
              No matching scheduled entries logged in this span.
            </div>
          )}
        </div>
      </div>
    );
  };

  // Build summary counts for the day header
  const summaryCounts = React.useMemo(() => {
    const counts = { tasks: 0, events: 0, notes: 0, habits: 0, timeBlocks: 0 };
    items.forEach((item) => {
      if (item.type === 'bracket') {
        counts.timeBlocks++;
        item.children.forEach((child) => {
          if (child.type === 'task') counts.tasks++;
          else if (child.type === 'event') counts.events++;
          else if (child.type === 'note') counts.notes++;
          else if (child.type === 'habit-log') counts.habits++;
        });
      } else if (item.type === 'standalone') {
        if (item.entry.type === 'task') counts.tasks++;
        else if (item.entry.type === 'event') counts.events++;
        else if (item.entry.type === 'note') counts.notes++;
        else if (item.entry.type === 'habit-log') counts.habits++;
      }
    });
    return counts;
  }, [items]);

  const todayStr = toLocalDateString(new Date());
  const isToday = labelString === todayStr;

  return (
    <div className="w-full relative" key={labelString}>
      {isFromTimelineView && (
        <div className="sticky top-[94px] sm:top-[72px] z-20 bg-[#0a0a0a] pt-3 pb-1.5 transition-all w-full">
          <div
            id={`spine-day-${labelString}`}
            className={`flex items-center justify-between py-2 px-3 rounded-xl border transition-all ${
              isToday
                ? 'bg-[#14120a] border-amber-500/35 text-amber-300'
                : 'bg-[#0e0e0e] border-stone-800/80 hover:border-stone-700 text-stone-300'
            }`}
          >
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <button
                onClick={() => toggleDayCollapse(labelString)}
                className="p-1 rounded-lg text-stone-500 hover:text-amber-400 hover:bg-stone-800/60 transition-colors cursor-pointer"
                title={isCollapsed ? 'Expand day' : 'Collapse day'}
              >
                {isCollapsed ? (
                  <ChevronRight className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
              </button>

              {/* Day Milestone Marker */}
              <div
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  isToday
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                    : 'bg-stone-900 border-stone-700 text-stone-400'
                }`}
              >
                {isToday ? (
                  <Sparkles className="w-3 h-3 text-amber-400 fill-amber-400/30" />
                ) : (
                  <Calendar className="w-3 h-3 text-stone-400" />
                )}
              </div>

              <button
                onClick={() => setActiveDate(new Date(labelString))}
                className="flex items-center gap-2 text-left cursor-pointer group/title min-w-0"
                title="Click to view in Day View"
              >
                <span
                  className={`text-xs font-mono font-bold uppercase tracking-wider transition-colors ${
                    isToday
                      ? 'text-amber-300 group-hover/title:text-amber-200'
                      : 'text-stone-200 group-hover/title:text-amber-400'
                  }`}
                >
                  {formatDateStringLabel(labelString)}
                </span>

                {isToday && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-widest bg-amber-500/20 border border-amber-500/40 text-amber-300">
                    Today
                  </span>
                )}
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-[10px] font-mono text-stone-500 shrink-0">
              {summaryCounts.tasks > 0 && (
                <span className="text-amber-400/80 font-semibold">
                  {summaryCounts.tasks} task{summaryCounts.tasks !== 1 ? 's' : ''}
                </span>
              )}
              {summaryCounts.events > 0 && (
                <span className="text-indigo-400/80 font-semibold">
                  {summaryCounts.events} event{summaryCounts.events !== 1 ? 's' : ''}
                </span>
              )}
              {summaryCounts.notes > 0 && (
                <span className="text-blue-400/80 font-semibold">
                  {summaryCounts.notes} note{summaryCounts.notes !== 1 ? 's' : ''}
                </span>
              )}
              {summaryCounts.habits > 0 && (
                <span className="text-emerald-400/80 font-semibold">
                  {summaryCounts.habits} habit{summaryCounts.habits !== 1 ? 's' : ''}
                </span>
              )}
              {summaryCounts.tasks === 0 &&
                summaryCounts.events === 0 &&
                summaryCounts.notes === 0 &&
                summaryCounts.habits === 0 && (
                  <span>
                    {items.length} {items.length === 1 ? 'entry' : 'entries'}
                  </span>
                )}
            </div>
          </div>
        </div>
      )}

      {/* Continuous timeline spine line passing through icons */}
      {isFromTimelineView && !isCollapsed && (
        <div className="absolute top-0 bottom-0 left-[76px] md:left-[88px] w-px pointer-events-none z-0">
          <div
            className={`w-full h-full ${
              isToday
                ? 'bg-gradient-to-b from-amber-500/50 via-amber-400/80 to-amber-500/50 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                : 'bg-stone-800/70'
            }`}
          />
        </div>
      )}

      {!isCollapsed &&
        (!isFromTimelineView && showDayPhases ? (
          /* Day View with 4 Themed Daylight Phase Blocks */
          <div className="space-y-4 pt-1">
            {DAY_PHASES.map((phase) => {
              const phaseItems = enrichedItems.filter((item) => {
                if (item.type === 'standalone' && item.entry.type === 'habit-log') return false;
                if (item.type === 'sleep') return false;
                const hour = new Date(item.sortTime).getHours();
                return hour >= phase.startHour && hour < phase.endHour;
              });

              const isCurrentPhase =
                isToday &&
                (() => {
                  const currentH = new Date().getHours();
                  return currentH >= phase.startHour && currentH < phase.endHour;
                })();

              return (
                <div
                  key={`phase-block-${phase.id}`}
                  className={`rounded-2xl border ${phase.borderClasses} ${phase.bgClasses} p-3 sm:p-4 transition-all relative overflow-hidden shadow-sm`}
                >
                  {/* Phase Header */}
                  <div className="flex items-center justify-between pb-2.5 mb-2 border-b border-stone-850/60">
                    <div className="flex items-center gap-2">
                      <span className="text-sm leading-none">{phase.icon}</span>
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200">
                        {phase.title}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold border ${phase.headerBadge}`}
                      >
                        {phase.timeRange}
                      </span>
                      {isCurrentPhase && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-widest bg-amber-500/20 text-amber-300 border border-amber-500/40">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          Active Now
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-stone-500">
                      {phaseItems.length > 0
                        ? `${phaseItems.length} item${phaseItems.length !== 1 ? 's' : ''}`
                        : 'Empty'}
                    </span>
                  </div>

                  {/* Phase Content */}
                  {phaseItems.length > 0 ? (
                    <div className="space-y-0 relative">
                      {phaseItems.map((item) => {
                        if (item.type === 'standalone') {
                          return renderStandaloneRow(item.entry, false, false);
                        } else if (item.type === 'bracket') {
                          return renderBracketItem(item.block, item.children);
                        } else if (item.type === 'now_needle') {
                          return renderNowNeedle();
                        }
                        return null;
                      })}
                    </div>
                  ) : (
                    <div className="py-6 flex flex-col items-center justify-center text-center select-none">
                      <p className="text-xs font-serif italic text-stone-400 font-medium">
                        "{phase.emptyText}"
                      </p>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Habit logs grouped into a sleek horizontal ritual strip */}
            {(() => {
              const habitItems = items.filter(
                (item) => item.type === 'standalone' && item.entry.type === 'habit-log',
              );
              if (habitItems.length === 0) return null;

              return (
                <div className="pt-2.5 pb-1 relative z-10">
                  {/* Section Header */}
                  <div className="flex items-center justify-between px-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400/90">
                        Habits Completed ({habitItems.length})
                      </span>
                    </div>
                    {habitItems.length > 2 && (
                      <span className="text-[9px] font-mono text-stone-600 hidden sm:inline">
                        Scroll for more →
                      </span>
                    )}
                  </div>

                  {/* Horizontal Scrollable Rail */}
                  <div className="flex items-center gap-2 overflow-x-auto px-3 py-1 scrollbar-none">
                    {habitItems.map((item) => {
                      const entry = (item as { type: 'standalone'; entry: TimelineEntry }).entry as HabitLog;
                      const emojiMatch = entry.title?.match(
                        /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u,
                      );
                      const emoji = emojiMatch ? emojiMatch[0] : null;
                      const cleanTitle = emoji
                        ? entry.title.replace(emoji, '').trim()
                        : entry.title;

                      return (
                        <div
                          key={entry.id}
                          onClick={() => handleOpenDetail(entry)}
                          className="group/habit flex items-center gap-2.5 px-3 py-1.5 bg-[#121212] hover:bg-[#181818] border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl transition-all cursor-pointer select-none shrink-0 shadow-sm"
                          title="Click to view details"
                        >
                          {/* Circular Habit Icon */}
                          <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                            {emoji ? (
                              <span className="text-xs leading-none">{emoji}</span>
                            ) : (
                              <Repeat2 className="w-3 h-3 text-emerald-400" />
                            )}
                          </div>

                          {/* Title & Done Time */}
                          <div className="flex flex-col min-w-0 pr-1">
                            <span className="text-xs font-sans font-semibold text-stone-200 group-hover/habit:text-white truncate max-w-[130px]">
                              {cleanTitle}
                            </span>
                            <span className="text-[9px] font-mono text-emerald-400 font-medium leading-tight">
                              ✔ {formatTime(entry.timestamp)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Sleep row rendered at the end */}
            {(() => {
              const sleepItem = enrichedItems.find((item) => item.type === 'sleep');
              if (sleepItem && sleepItem.type === 'sleep') {
                return renderSleepRow(sleepItem.timeStr, sleepItem.sortTime);
              }
              return null;
            })()}
          </div>
        ) : enrichedItems.length > 0 ? (
          <div className="space-y-0 pt-1">
            {/* Non-habit items render normally */}
            {enrichedItems
              .filter(
                (item) =>
                  !(item.type === 'standalone' && item.entry.type === 'habit-log') &&
                  item.type !== 'sleep',
              )
              .map((item) => {
                if (item.type === 'standalone') {
                  return renderStandaloneRow(item.entry, false, false);
                } else if (item.type === 'bracket') {
                  return renderBracketItem(item.block, item.children);
                } else if (item.type === 'now_needle') {
                  return renderNowNeedle();
                }
                return null;
              })}

            {/* Habit logs grouped into a sleek horizontal ritual strip */}
            {(() => {
              const habitItems = items.filter(
                (item) => item.type === 'standalone' && item.entry.type === 'habit-log',
              );
              if (habitItems.length === 0) return null;

              return (
                <div className="pt-2.5 pb-1 relative z-10">
                  {/* Section Header */}
                  <div className="flex items-center justify-between px-3 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
                      <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400/90">
                        Habits Completed ({habitItems.length})
                      </span>
                    </div>
                    {habitItems.length > 2 && (
                      <span className="text-[9px] font-mono text-stone-600 hidden sm:inline">
                        Scroll for more →
                      </span>
                    )}
                  </div>

                  {/* Horizontal Scrollable Rail */}
                  <div className="flex items-center gap-2 overflow-x-auto px-3 py-1 scrollbar-none">
                    {habitItems.map((item) => {
                      const entry = (item as { type: 'standalone'; entry: TimelineEntry }).entry as HabitLog;
                      const emojiMatch = entry.title?.match(
                        /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u,
                      );
                      const emoji = emojiMatch ? emojiMatch[0] : null;
                      const cleanTitle = emoji
                        ? entry.title.replace(emoji, '').trim()
                        : entry.title;

                      return (
                        <div
                          key={entry.id}
                          onClick={() => handleOpenDetail(entry)}
                          className="group/habit flex items-center gap-2.5 px-3 py-1.5 bg-[#121212] hover:bg-[#181818] border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl transition-all cursor-pointer select-none shrink-0 shadow-sm"
                          title="Click to view details"
                        >
                          {/* Circular Habit Icon */}
                          <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                            {emoji ? (
                              <span className="text-xs leading-none">{emoji}</span>
                            ) : (
                              <Repeat2 className="w-3 h-3 text-emerald-400" />
                            )}
                          </div>

                          {/* Title & Done Time */}
                          <div className="flex flex-col min-w-0 pr-1">
                            <span className="text-xs font-sans font-semibold text-stone-200 group-hover/habit:text-white truncate max-w-[130px]">
                              {cleanTitle}
                            </span>
                            <span className="text-[9px] font-mono text-emerald-400 font-medium leading-tight">
                              ✔ {formatTime(entry.timestamp)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Sleep row rendered at the end */}
            {(() => {
              const sleepItem = enrichedItems.find((item) => item.type === 'sleep');
              if (sleepItem && sleepItem.type === 'sleep') {
                return renderSleepRow(sleepItem.timeStr, sleepItem.sortTime);
              }
              return null;
            })()}
          </div>
        ) : (
          <div className="py-24 text-center text-stone-500 relative z-10 select-none">
            <Clock className="w-12 h-12 text-stone-800 mx-auto mb-4" />
            <h4 className="font-sans font-medium text-sm text-stone-400 mb-1">
              Your timeline is completely empty
            </h4>
            <p className="text-xs font-sans max-w-md mx-auto leading-relaxed text-stone-500">
              Start capturing entries using the input engine below. Switch back to "Day View" to log
              your tasks and build an offline productivity timeline easily.
            </p>
          </div>
        ))}

      {/* Time Ruler Overlay (Hold & Drag) */}
      {activeRulerState && (
        <TimeRulerOverlay
          entry={activeRulerState.entry}
          initialDate={activeRulerState.initialDate}
          initialEndDate={activeRulerState.initialEndDate}
          mode={activeRulerState.mode}
          originY={activeRulerState.originY}
          originX={activeRulerState.originX}
          formatTime={formatTime}
          onConfirm={(newDate) => {
            handleConfirmSpanRuler(newDate);
          }}
          onConfirmSpan={(newStart, newEnd) => {
            handleConfirmSpanRuler(newStart, newEnd);
          }}
          onCancel={() => setActiveRulerState(null)}
        />
      )}

      {/* Time Picker Sheet */}
      <TimePickerSheet
        open={pickerEntry !== null}
        onClose={() => setPickerEntry(null)}
        initialDate={pickerEntry ? getPickerInitialDate(pickerEntry) : new Date()}
        onConfirm={(newDate) => {
          if (pickerEntry) onTimePickerConfirm(pickerEntry, newDate);
          setPickerEntry(null);
        }}
      />
    </div>
  );
}
