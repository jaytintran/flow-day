/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { TimelineEntry, Task, Event, Note, TimeBlock, TaskAchievement } from '../../types';
import { formatDuration, toLocalDateString, getEffectiveDate } from '../../utils';
import DetailSheet from '../DetailSheet';
import DayView from './DayView';
import TimelineView from './TimelineView';
import RecordsView from './RecordsView';
import TasksView from './TasksView';
import GoalsSheet from '../GoalsSheet';
import ObjectivesSheet from '../ObjectivesSheet';
import HabitsSheet from '../HabitsSheet';

interface JournalProps {
  activeDate: Date;
  setActiveDate: (date: Date) => void;
  viewMode: 'day' | 'timeline' | 'records' | 'tasks' | 'hub';
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
  activeHubTab?: 'goals' | 'objectives' | 'habits';
  setActiveHubTab?: (tab: 'goals' | 'objectives' | 'habits') => void;
}

// ─── EditableChip ───────────────────────────────────────────────────────────

function parseDuration(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (!s || s === '0') return 0;

  // h:mm:ss or mm:ss
  const colonMatch = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (colonMatch) {
    const a = parseInt(colonMatch[1]);
    const b = parseInt(colonMatch[2]);
    const c = colonMatch[3] ? parseInt(colonMatch[3]) : null;
    if (c !== null) return (a * 3600 + b * 60 + c) * 1000;
    return (a * 60 + b) * 1000;
  }

  // 1h 30m 20s — all parts optional but at least one required
  const unitMatch = s.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/);
  if (unitMatch && (unitMatch[1] || unitMatch[2] || unitMatch[3])) {
    const h = parseInt(unitMatch[1] ?? '0');
    const m = parseInt(unitMatch[2] ?? '0');
    const sec = parseInt(unitMatch[3] ?? '0');
    return (h * 3600 + m * 60 + sec) * 1000;
  }

  return null;
}

function formatDurationEditable(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

interface EditableChipProps {
  label: string;
  value: Date; // the raw Date for datetime mode
  displayValue: string; // human-readable string shown on chip
  mode: 'datetime' | 'duration';
  durationValue?: number; // ms for duration mode
  chipClass?: string;
  onSave: (d: Date) => Promise<void>; // datetime mode
  onSaveDuration?: (raw: string) => Promise<void>; // duration mode
}

// Human-readable date display: relative for today/yesterday, short format otherwise
function formatChipDate(d: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

  if (targetDay.getTime() === today.getTime()) return `Today ${time}`;
  if (targetDay.getTime() === yesterday.getTime()) return `Yesterday ${time}`;

  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm} ${time}`;
}

function EditableChip({
  label,
  value,
  displayValue,
  mode,
  durationValue,
  chipClass = '',
  onSave,
  onSaveDuration,
}: EditableChipProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftDate, setDraftDate] = useState('');
  const [draftTime, setDraftTime] = useState('');
  const [draftDuration, setDraftDuration] = useState('');
  const [invalid, setInvalid] = useState(false);
  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const durationRef = useRef<HTMLInputElement>(null);

  const toDateInput = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  const toTimeInput = (d: Date) => {
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mi}`;
  };

  const open = () => {
    if (mode === 'datetime') {
      setDraftDate(toDateInput(value));
      setDraftTime(toTimeInput(value));
      setInvalid(false);
      setIsEditing(true);
      setTimeout(() => dateRef.current?.focus(), 0);
    } else {
      setDraftDuration(formatDurationEditable(durationValue ?? 0));
      setInvalid(false);
      setIsEditing(true);
      setTimeout(() => durationRef.current?.focus(), 0);
    }
  };

  const cancel = () => {
    setIsEditing(false);
    setInvalid(false);
  };

  const commitDatetime = async () => {
    if (!draftDate || !draftTime) {
      setInvalid(true);
      return;
    }
    const d = new Date(`${draftDate}T${draftTime}:00`);
    if (isNaN(d.getTime())) {
      setInvalid(true);
      return;
    }
    await onSave(d);
    setIsEditing(false);
    setInvalid(false);
  };

  const commitDuration = async () => {
    if (!onSaveDuration) return;
    if (parseDuration(draftDuration) === null) {
      setInvalid(true);
      return;
    }
    await onSaveDuration(draftDuration);
    setIsEditing(false);
    setInvalid(false);
  };

  if (!isEditing) {
    return (
      <button
        onClick={open}
        className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-mono border transition-colors hover:border-amber-500/40 hover:text-amber-400 cursor-pointer ${chipClass}`}
      >
        <span className="text-stone-500 font-medium">{label}</span>
        <span>{displayValue}</span>
      </button>
    );
  }

  // ── DATE + TIME SPLIT EDIT (datetime mode) ──
  if (mode === 'datetime') {
    return (
      <div className="flex items-center gap-1.5">
        <input
          ref={dateRef}
          type="date"
          value={draftDate}
          onChange={(e) => setDraftDate(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') cancel();
          }}
          onBlur={() => {
            // Commit only if the other field isn't focused
            setTimeout(() => {
              if (document.activeElement !== timeRef.current) commitDatetime();
            }, 100);
          }}
          className={`bg-[#0a0a0a] border rounded px-2 py-1 text-xs font-mono focus:outline-none transition-colors ${
            invalid
              ? 'border-red-500/70 text-red-400 focus:border-red-500'
              : 'border-amber-500/40 text-amber-300 focus:border-amber-500'
          }`}
        />
        <input
          ref={timeRef}
          type="time"
          value={draftTime}
          onChange={(e) => setDraftTime(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitDatetime();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={() => {
            setTimeout(() => {
              if (document.activeElement !== dateRef.current) commitDatetime();
            }, 100);
          }}
          className={`bg-[#0a0a0a] border rounded px-2 py-1 text-xs font-mono focus:outline-none transition-colors ${
            invalid
              ? 'border-red-500/70 text-red-400 focus:border-red-500'
              : 'border-amber-500/40 text-amber-300 focus:border-amber-500'
          }`}
        />
        <button
          onMouseDown={(e) => {
            e.preventDefault();
            cancel();
          }}
          className="text-xs font-mono text-stone-500 hover:text-stone-300 px-1 cursor-pointer"
        >
          ✕
        </button>
      </div>
    );
  }

  // ── DURATION EDIT ──
  return (
    <div className="flex items-center gap-1">
      <input
        ref={durationRef}
        type="text"
        value={draftDuration}
        onChange={(e) => {
          setDraftDuration(e.target.value);
          setInvalid(parseDuration(e.target.value) === null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitDuration();
          if (e.key === 'Escape') cancel();
        }}
        onBlur={commitDuration}
        className={`bg-[#0a0a0a] border rounded px-2 py-1 text-xs font-mono focus:outline-none transition-colors w-24 ${
          invalid
            ? 'border-red-500/70 text-red-400 focus:border-red-500'
            : 'border-amber-500/40 text-amber-300 focus:border-amber-500'
        }`}
      />
      <button
        onMouseDown={(e) => {
          e.preventDefault();
          cancel();
        }}
        className="text-xs font-mono text-stone-500 hover:text-stone-300 px-1 cursor-pointer"
      >
        ✕
      </button>
    </div>
  );
}

export default function Journal({
  activeDate,
  setActiveDate,
  viewMode,
  activeTaskId,
  setActiveTaskId,
  activeHubTab,
  setActiveHubTab,
}: JournalProps) {
  const [highlightedDay, setHighlightedDay] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Selected entry for detail and edit modal
  const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTimestamp, setEditTimestamp] = useState('');
  const [editStartAt, setEditStartAt] = useState('');
  const [editEndAt, setEditEndAt] = useState('');

  // Helper: format a Date to "YYYY-MM-DD" for date input
  const toDateInputValue = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = (d.getMonth() + 1).toString().padStart(2, '0');
    const dd = d.getDate().toString().padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Helper: format a Date to "HH:MM" for time input
  const toTimeInputValue = (d: Date): string => {
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `${hh}:${mm}`;
  };

  // Sync edit state when selectedEntry changes
  useEffect(() => {
    if (!selectedEntry) return;
    setEditTitle(
      selectedEntry.type === 'note'
        ? (selectedEntry as Note).title || ''
        : selectedEntry.title || '',
    );

    if (
      selectedEntry.type === 'note' ||
      selectedEntry.type === 'event' ||
      selectedEntry.type === 'task'
    ) {
      setEditContent((selectedEntry as Note | Event | Task).content || '');
    } else {
      setEditContent('');
    }

    if (selectedEntry.type === 'event' || selectedEntry.type === 'note') {
      const ts = new Date((selectedEntry as Event | Note).timestamp);
      setEditTimestamp(toDateInputValue(ts) + 'T' + toTimeInputValue(ts));
    }

    if (selectedEntry.type === 'time-block') {
      const tb = selectedEntry as TimeBlock;
      const s = new Date(tb.start_at);
      const e = new Date(tb.end_at);
      setEditStartAt(toDateInputValue(s) + 'T' + toTimeInputValue(s));
      setEditEndAt(toDateInputValue(e) + 'T' + toTimeInputValue(e));
    }
  }, [selectedEntry]);

  // Open detail sheet for a given entry
  const handleOpenDetail = (entry: TimelineEntry) => {
    setSelectedEntry(entry);
    setIsDetailOpen(true);
  };

  // Close detail sheet and persist changes
  const handleCloseDetail = async () => {
    if (!selectedEntry) return;

    const id = selectedEntry.id;
    const type = selectedEntry.type;

    switch (type) {
      case 'note': {
        await db.entries.update(id, {
          title: editTitle.trim(),
          content: editContent.trim(),
        } as any);
        break;
      }
      case 'task': {
        await db.entries.update(id, {
          title: editTitle.trim(),
          content: editContent.trim(),
        } as any);
        break;
      }
      case 'event': {
        const newTimestamp = editTimestamp ? new Date(editTimestamp) : undefined;
        await db.entries.update(id, {
          title: editTitle.trim(),
          content: editContent.trim(),
          ...(newTimestamp ? { timestamp: newTimestamp } : {}),
        } as any);
        break;
      }
      case 'time-block': {
        const newStart = editStartAt ? new Date(editStartAt) : undefined;
        const newEnd = editEndAt ? new Date(editEndAt) : undefined;
        await db.entries.update(id, {
          title: editTitle.trim(),
          ...(newStart ? { start_at: newStart } : {}),
          ...(newEnd ? { end_at: newEnd } : {}),
        } as any);
        break;
      }
    }

    setIsDetailOpen(false);
    setSelectedEntry(null);
  };

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Track which days are collapsed in timeline view
  const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

  const toggleDayCollapse = (dayStr: string) => {
    setCollapsedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dayStr)) {
        next.delete(dayStr);
      } else {
        next.add(dayStr);
      }
      return next;
    });
  };

  // Read all timeline entries reactive from Dexie.js (filter out objectives & goals — they live in their own sheets)
  const entries = (useLiveQuery(() => db.entries.toArray()) || []).filter(
    (e) => e.type !== 'objective' && e.type !== 'goal',
  );

  // Group and sort logic for Day View and Timeline View
  const getEntrySortTime = (e: TimelineEntry): number => {
    // For tasks: first available of completed_at → scheduled_at → created_at
    if (e.type === 'task') {
      if (e.completed_at) return new Date(e.completed_at).getTime();
      if (e.scheduled_at) return new Date(e.scheduled_at).getTime();
      return new Date(e.created_at).getTime();
    }
    // For non-tasks: carried_to → natural timestamp (events/notes: timestamp, time-blocks: start_at)
    return getEffectiveDate(e).getTime();
  };

  // Strike sounds
  function playStrikeSound() {
    const ctx = new AudioContext();
    const duration = 0.35;
    const sampleRate = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      // Slow attack, long sustain, tail fade
      const envelope = Math.pow(t, 0.15) * Math.pow(1 - t, 1.5);
      // Layered noise: fast + slow modulation = pencil texture
      const noise = Math.random() * 2 - 1;
      const scrape = Math.sin(t * 800) * 0.15; // subtle periodic scrape texture
      data[i] = (noise + scrape) * envelope;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Bandpass centered on pencil scratch frequencies
    const filter1 = ctx.createBiquadFilter();
    filter1.type = 'bandpass';
    filter1.frequency.value = 4000;
    filter1.Q.value = 0.6;

    // Second filter for that papery hiss on top
    const filter2 = ctx.createBiquadFilter();
    filter2.type = 'highpass';
    filter2.frequency.value = 2500;

    // Frequency sweep: starts lower, rises as pencil drags across
    filter1.frequency.setValueAtTime(2000, ctx.currentTime);
    filter1.frequency.linearRampToValueAtTime(5500, ctx.currentTime + 0.35);

    const gain = ctx.createGain();
    gain.gain.value = 0.5;

    source.connect(filter1);
    filter1.connect(filter2);
    filter2.connect(gain);
    gain.connect(ctx.destination);

    source.start();
    source.onended = () => ctx.close();
  }

  // Toggles status of Task
  const handleToggleTaskStatus = async (task: Task) => {
    const isDone = task.status === 'done';
    const nextStatus = isDone ? 'todo' : 'done';

    if (nextStatus === 'done') playStrikeSound();

    await db.entries.update(task.id, {
      status: nextStatus,
      completed_at: nextStatus === 'done' ? new Date() : undefined,
    } as any);
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Delete entry helper
  const handleDeleteEntry = async (id: string) => {
    if (deletingId === id) {
      await db.entries.delete(id);
      if (activeTaskId === id) {
        setActiveTaskId(null);
      }
      setDeletingId(null);
    } else {
      setDeletingId(id);
      setTimeout(() => {
        setDeletingId((prev) => (prev === id ? null : prev));
      }, 3000);
    }
  };

  // Quick activate a task for the timer bar
  const handleActivateTask = (taskId: string) => {
    setActiveTaskId(taskId);
  };

  // Carry a task to a new date (by updating scheduled_at)
  const handleCarryTask = async (taskId: string, targetDate: Date) => {
    await db.entries.update(taskId, {
      scheduled_at: targetDate,
      carried_to: undefined,
    } as any);
  };

  // Find overdue tasks (todo status, and effective date is prior to activeDate)
  const activeDayStr = toLocalDateString(activeDate);
  const overdueTasks = React.useMemo(() => {
    return entries.filter((e) => {
      if (e.type !== 'task' || e.status !== 'todo') return false;
      const taskDayStr = toLocalDateString(getEffectiveDate(e));
      return taskDayStr < activeDayStr;
    }) as Task[];
  }, [entries, activeDayStr]);

  const handleImportAllOverdue = async () => {
    if (overdueTasks.length === 0) return;
    await db.transaction('rw', db.entries, async () => {
      for (const t of overdueTasks) {
        const oldD = getEffectiveDate(t);
        const newD = new Date(activeDate);
        newD.setHours(
          oldD.getHours(),
          oldD.getMinutes(),
          oldD.getSeconds(),
          oldD.getMilliseconds(),
        );
        await db.entries.update(t.id, {
          scheduled_at: newD,
          carried_to: undefined,
        } as any);
      }
    });
  };

  const handleRescheduleAllOverdue = async (targetDate: Date) => {
    if (overdueTasks.length === 0) return;
    await db.transaction('rw', db.entries, async () => {
      for (const t of overdueTasks) {
        const oldD = getEffectiveDate(t);
        const newD = new Date(targetDate);
        newD.setHours(
          oldD.getHours(),
          oldD.getMinutes(),
          oldD.getSeconds(),
          oldD.getMilliseconds(),
        );
        await db.entries.update(t.id, {
          scheduled_at: newD,
          carried_to: undefined,
        } as any);
      }
    });
  };

  // Time picker: persist updated time to DB
  const handleTimePickerConfirm = async (entry: TimelineEntry, newDate: Date) => {
    const id = entry.id;
    switch (entry.type) {
      case 'task': {
        const task = entry as Task;
        const field = task.status === 'done' ? 'completed_at' : 'scheduled_at';
        await db.entries.update(id, { [field]: newDate } as any);
        break;
      }
      case 'event':
      case 'note':
      case 'log':
      case 'habit-log':
        await db.entries.update(id, { timestamp: newDate } as any);
        break;
    }
  };

  // Formats time strings to elegant short format (e.g. 10:45 AM)
  const formatTime = (dateInput: Date | string): string => {
    const d = new Date(dateInput);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate();

    const time = d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    if (isToday) return time;
    // if (isYesterday) return `-1d ${time}`;

    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}\n${time}`;
  };

  // Group entries of a single day with nested timeblocks logic
  const getDayRenderItems = (dayEntries: TimelineEntry[]) => {
    const blocks = dayEntries.filter((e) => e.type === 'time-block') as TimeBlock[];
    const others = dayEntries.filter((e) => e.type !== 'time-block');

    // Sort blocks by start_at
    blocks.sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());

    // Hold children associated with time blocks
    const assignedIds = new Set<string>();
    const timeBlocksWithChildren = blocks.map((block) => {
      const start = new Date(block.start_at).getTime();
      const end = new Date(block.end_at).getTime();

      const children = others.filter((entry) => {
        if (assignedIds.has(entry.id)) return false;
        const checkTime =
          entry.type === 'task'
            ? new Date(entry.scheduled_at || entry.created_at).getTime()
            : getEntrySortTime(entry);
        const fits = checkTime >= start && checkTime <= end;
        if (fits) {
          assignedIds.add(entry.id);
        }
        return fits;
      });

      // Sort children chronologically
      children.sort((a, b) => getEntrySortTime(a) - getEntrySortTime(b));

      return { block, children };
    });

    const standaloneEntries = others.filter((entry) => !assignedIds.has(entry.id));

    // Combine into timeline
    const items: any[] = [];
    timeBlocksWithChildren.forEach(({ block, children }) => {
      items.push({
        type: 'bracket',
        block,
        children,
        sortTime: new Date(block.start_at).getTime(),
      });
    });

    standaloneEntries.forEach((entry) => {
      items.push({
        type: 'standalone',
        entry,
        sortTime: getEntrySortTime(entry),
      });
    });

    // Chronological stack
    return items.sort((a, b) => a.sortTime - b.sortTime);
  };

  // Day View data
  const activeDayString = toLocalDateString(activeDate);
  const activeDayEntries = entries.filter((e) => {
    return toLocalDateString(getEffectiveDate(e)) === activeDayString;
  });
  const dayRenderItems = getDayRenderItems(activeDayEntries);

  // Timeline View data: grouped by local day strings, sorted chronologically oldest-to-newest
  const timelineDaysMap: { [key: string]: TimelineEntry[] } = {};
  entries.forEach((e) => {
    const dayStr = toLocalDateString(getEffectiveDate(e));
    if (!timelineDaysMap[dayStr]) {
      timelineDaysMap[dayStr] = [];
    }
    timelineDaysMap[dayStr].push(e);
  });

  const sortedTimelineDays = Object.keys(timelineDaysMap).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  // Scrolling into selected day separator in Timeline mode
  useEffect(() => {
    if (viewMode === 'timeline' && sortedTimelineDays.includes(activeDayString)) {
      const elementId = `spine-day-${activeDayString}`;
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setHighlightedDay(activeDayString);
        const timer = setTimeout(() => {
          setHighlightedDay(null);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [viewMode, activeDate]);

  // Parse YYYY-MM-DD back to readable label with relative markers
  const formatDateStringLabel = (dayStr: string): string => {
    const parts = dayStr.split('-');
    const parsedDate = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);
    const yearText =
      parsedDate.getFullYear() !== today.getFullYear() ? `, ${parsedDate.getFullYear()}` : '';

    if (
      parsedDate.getFullYear() === today.getFullYear() &&
      parsedDate.getMonth() === today.getMonth() &&
      parsedDate.getDate() === today.getDate()
    ) {
      return `Today · ${parsedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${yearText}`;
    } else if (
      parsedDate.getFullYear() === yesterday.getFullYear() &&
      parsedDate.getMonth() === yesterday.getMonth() &&
      parsedDate.getDate() === yesterday.getDate()
    ) {
      return `Yesterday · ${parsedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${yearText}`;
    } else if (
      parsedDate.getFullYear() === tomorrow.getFullYear() &&
      parsedDate.getMonth() === tomorrow.getMonth() &&
      parsedDate.getDate() === tomorrow.getDate()
    ) {
      return `Tomorrow · ${parsedDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}${yearText}`;
    }
    return parsedDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: parsedDate.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
    });
  };

  return (
    <div
      className={`flex-1 px-2 md:px-6 pb-4 md:pb-6 ${
        viewMode === 'hub'
          ? 'overflow-hidden pt-3 flex flex-col h-full'
          : 'overflow-y-auto pt-4 md:pt-6'
      } ${viewMode === 'records' ? 'pt-0' : ''}`}
      id="timeline-journal-scrollable"
      ref={containerRef}
    >
      <div
        className={`w-full md:mx-auto ${viewMode === 'hub' ? 'h-full md:max-w-9xl flex flex-col' : 'md:max-w-4xl space-y-8'}`}
      >
        {viewMode === 'records' ? (
          <RecordsView
            entries={entries}
            deletingId={deletingId}
            onDeleteEntry={handleDeleteEntry}
            onOpenDetail={handleOpenDetail}
            formatTime={formatTime}
            formatDateStringLabel={formatDateStringLabel}
          />
        ) : viewMode === 'tasks' ? (
          <TasksView
            entries={entries}
            deletingId={deletingId}
            activeTaskId={activeTaskId}
            setActiveDate={setActiveDate}
            onDeleteEntry={handleDeleteEntry}
            onOpenDetail={handleOpenDetail}
            onToggleTaskStatus={handleToggleTaskStatus}
            onActivateTask={handleActivateTask}
            onCarryTask={handleCarryTask}
            formatTime={formatTime}
            formatDateStringLabel={formatDateStringLabel}
          />
        ) : viewMode === 'day' ? (
          <DayView
            activeDayString={activeDayString}
            dayRenderItems={dayRenderItems}
            collapsedDays={collapsedDays}
            toggleDayCollapse={toggleDayCollapse}
            setActiveDate={setActiveDate}
            deletingId={deletingId}
            activeTaskId={activeTaskId}
            handleDeleteEntry={handleDeleteEntry}
            handleOpenDetail={handleOpenDetail}
            handleToggleTaskStatus={handleToggleTaskStatus}
            handleActivateTask={handleActivateTask}
            handleCarryTask={handleCarryTask}
            formatTime={formatTime}
            formatDateStringLabel={formatDateStringLabel}
            onTimePickerConfirm={handleTimePickerConfirm}
            overdueTasks={overdueTasks}
            handleImportAllOverdue={handleImportAllOverdue}
            handleRescheduleAllOverdue={handleRescheduleAllOverdue}
          />
        ) : viewMode === 'hub' ? (
          <div className="w-full flex-1 min-h-0 flex flex-col">
            {/* Desktop 3-column Layout */}
            <div className="hidden md:grid grid-cols-3 gap-6 h-full items-stretch pt-2">
              <GoalsSheet isInline={true} />
              <ObjectivesSheet isInline={true} />
              <HabitsSheet isInline={true} activeDate={activeDate} />
            </div>

            {/* Mobile Single-column Switchable Layout */}
            <div className="md:hidden h-full flex flex-col pb-2">
              {activeHubTab === 'goals' && <GoalsSheet isInline={true} />}
              {activeHubTab === 'objectives' && <ObjectivesSheet isInline={true} />}
              {activeHubTab === 'habits' && <HabitsSheet isInline={true} activeDate={activeDate} />}
            </div>
          </div>
        ) : (
          <TimelineView
            sortedTimelineDays={sortedTimelineDays}
            timelineDaysMap={timelineDaysMap}
            getDayRenderItems={getDayRenderItems}
            collapsedDays={collapsedDays}
            toggleDayCollapse={toggleDayCollapse}
            setActiveDate={setActiveDate}
            deletingId={deletingId}
            activeTaskId={activeTaskId}
            handleDeleteEntry={handleDeleteEntry}
            handleOpenDetail={handleOpenDetail}
            handleToggleTaskStatus={handleToggleTaskStatus}
            handleActivateTask={handleActivateTask}
            handleCarryTask={handleCarryTask}
            formatTime={formatTime}
            formatDateStringLabel={formatDateStringLabel}
            onTimePickerConfirm={handleTimePickerConfirm}
          />
        )}
      </div>

      {/* GENERALIZED DETAIL SHEET — EDIT ANY ENTRY TYPE */}
      <DetailSheet
        open={isDetailOpen && selectedEntry !== null}
        onClose={handleCloseDetail}
        label={
          selectedEntry?.type === 'task'
            ? 'Edit Task'
            : selectedEntry?.type === 'event'
              ? 'Edit Event'
              : selectedEntry?.type === 'note'
                ? 'Note Details'
                : selectedEntry?.type === 'time-block'
                  ? 'Edit Time Block'
                  : 'Edit Entry'
        }
        labelColor={
          selectedEntry?.type === 'task'
            ? 'emerald'
            : selectedEntry?.type === 'event'
              ? 'indigo'
              : selectedEntry?.type === 'note'
                ? 'blue'
                : selectedEntry?.type === 'time-block'
                  ? 'amber'
                  : 'blue'
        }
        isMobile={isMobile}
      >
        {selectedEntry && (
          <>
            {/* Title field */}
            <textarea
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder={
                selectedEntry.type === 'task'
                  ? 'Task Title'
                  : selectedEntry.type === 'event'
                    ? 'Event Title'
                    : selectedEntry.type === 'time-block'
                      ? 'Time Block Title'
                      : 'Note Title'
              }
              className="w-full bg-transparent text-stone-100 font-serif font-bold text-xl focus:outline-none placeholder-stone-700 pb-2 border-b border-stone-900/60 resize-none overflow-hidden"
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = el.scrollHeight + 'px';
              }}
            />

            {/* ── TASK ── */}
            {selectedEntry.type === 'task' && (
              <div className="flex flex-col flex-1 space-y-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <EditableChip
                    label="Created"
                    value={new Date((selectedEntry as Task).created_at)}
                    displayValue={formatChipDate(new Date((selectedEntry as Task).created_at))}
                    mode="datetime"
                    chipClass="bg-[#121212] border-stone-800 text-stone-400"
                    onSave={async (d) => {
                      await db.entries.update(selectedEntry.id, {
                        created_at: d,
                      } as any);
                      setSelectedEntry({ ...selectedEntry, created_at: d } as Task);
                    }}
                  />

                  <EditableChip
                    label="Spent"
                    value={new Date()} // unused for duration
                    displayValue={formatDurationEditable((selectedEntry as Task).time_spent)}
                    mode="duration"
                    durationValue={(selectedEntry as Task).time_spent}
                    chipClass="bg-[#121212] border-stone-800 text-stone-400"
                    onSaveDuration={async (raw) => {
                      const ms = parseDuration(raw)!;
                      await db.entries.update(selectedEntry.id, { time_spent: ms } as any);
                      setSelectedEntry({ ...selectedEntry, time_spent: ms } as Task);
                    }}
                    onSave={async () => {}}
                  />

                  {(selectedEntry as Task).scheduled_at && (
                    <EditableChip
                      label="Scheduled"
                      value={new Date((selectedEntry as Task).scheduled_at!)}
                      displayValue={formatChipDate(new Date((selectedEntry as Task).scheduled_at!))}
                      mode="datetime"
                      chipClass="bg-[#121212] border-indigo-800/40 text-indigo-400"
                      onSave={async (d) => {
                        await db.entries.update(selectedEntry.id, {
                          scheduled_at: d,
                        } as any);
                        setSelectedEntry({ ...selectedEntry, scheduled_at: d } as Task);
                      }}
                    />
                  )}
                </div>

                {(selectedEntry as Task).completed_at && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <EditableChip
                      label="Completed"
                      value={new Date((selectedEntry as Task).completed_at!)}
                      displayValue={formatChipDate(new Date((selectedEntry as Task).completed_at!))}
                      mode="datetime"
                      chipClass="bg-[#121212] border-emerald-800/40 text-emerald-500"
                      onSave={async (d) => {
                        await db.entries.update(selectedEntry.id, {
                          completed_at: d,
                        } as any);
                        setSelectedEntry({ ...selectedEntry, completed_at: d } as Task);
                      }}
                    />
                  </div>
                )}

                {/* Achievements */}
                {(selectedEntry as Task).achievements &&
                  (selectedEntry as Task).achievements!.length > 0 && (
                    <div className="space-y-1.5">
                      {((selectedEntry as Task).achievements ?? []).map((a) => (
                        <div
                          key={a.id}
                          className="flex items-start gap-2 text-xs font-mono text-stone-300 bg-stone-900/60 border border-stone-800 rounded-lg px-3 py-2"
                        >
                          <span className="text-amber-500 mt-0.5 shrink-0">🏆</span>
                          <div className="flex-1 min-w-0">
                            <p className="break-words">{a.text}</p>
                            <p className="text-[9px] text-stone-600 mt-0.5">
                              {formatTime(new Date(a.created_at))}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add achievement..."
                    className="flex-1 bg-[#0a0a0a] border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/30 transition-colors font-mono"
                    onKeyDown={async (e) => {
                      if (e.key !== 'Enter' || !e.currentTarget.value.trim()) return;
                      const text = e.currentTarget.value.trim();
                      const task = selectedEntry as Task;
                      const entry: TaskAchievement = {
                        id: crypto.randomUUID(),
                        text,
                        created_at: new Date(),
                      };
                      const updated = [...(task.achievements ?? []), entry];
                      await db.entries.update(task.id, { achievements: updated } as any);
                      setSelectedEntry({ ...task, achievements: updated });
                      e.currentTarget.value = '';
                    }}
                  />
                </div>

                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Add context, links, notes about this task..."
                  className="w-full bg-transparent text-stone-300 font-serif text-sm focus:outline-none resize-none leading-relaxed placeholder-stone-700 flex-1 border-t border-stone-900 pt-3"
                />
              </div>
            )}

            {/* ── NOTE ── */}
            {selectedEntry.type === 'note' && (
              <div className="flex flex-col flex-1 space-y-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <EditableChip
                    label="Logged"
                    value={new Date((selectedEntry as Note).timestamp)}
                    displayValue={formatChipDate(new Date((selectedEntry as Note).timestamp))}
                    mode="datetime"
                    chipClass="bg-[#121212] border-stone-800 text-stone-400"
                    onSave={async (d) => {
                      await db.entries.update(selectedEntry.id, { timestamp: d } as any);
                      setSelectedEntry({ ...selectedEntry, timestamp: d } as Note);
                      setEditTimestamp(
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
                      );
                    }}
                  />
                </div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Tap to start typing your thoughts..."
                  className="w-full bg-transparent text-stone-300 font-serif text-sm focus:outline-none resize-none leading-relaxed placeholder-stone-700 flex-1"
                />
              </div>
            )}

            {/* ── EVENT ── */}
            {selectedEntry.type === 'event' && (
              <div className="flex flex-col flex-1 space-y-3">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <EditableChip
                    label="At"
                    value={new Date((selectedEntry as Event).timestamp)}
                    displayValue={formatChipDate(new Date((selectedEntry as Event).timestamp))}
                    mode="datetime"
                    chipClass="bg-[#121212] border-indigo-800/40 text-indigo-400"
                    onSave={async (d) => {
                      await db.entries.update(selectedEntry.id, { timestamp: d } as any);
                      setSelectedEntry({ ...selectedEntry, timestamp: d } as Event);
                      setEditTimestamp(
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
                      );
                    }}
                  />
                </div>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="Event description, notes, or details..."
                  className="w-full bg-transparent text-stone-300 font-serif text-sm focus:outline-none resize-none leading-relaxed placeholder-stone-700 flex-1"
                />
              </div>
            )}

            {/* ── TIME BLOCK ── */}
            {selectedEntry.type === 'time-block' && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <EditableChip
                  label="Start"
                  value={new Date((selectedEntry as TimeBlock).start_at)}
                  displayValue={formatChipDate(new Date((selectedEntry as TimeBlock).start_at))}
                  mode="datetime"
                  chipClass="bg-[#121212] border-amber-800/40 text-amber-400"
                  onSave={async (d) => {
                    await db.entries.update(selectedEntry.id, { start_at: d } as any);
                    setSelectedEntry({ ...selectedEntry, start_at: d } as TimeBlock);
                    setEditStartAt(
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
                    );
                  }}
                />
                <EditableChip
                  label="End"
                  value={new Date((selectedEntry as TimeBlock).end_at)}
                  displayValue={formatChipDate(new Date((selectedEntry as TimeBlock).end_at))}
                  mode="datetime"
                  chipClass="bg-[#121212] border-amber-800/40 text-amber-400"
                  onSave={async (d) => {
                    await db.entries.update(selectedEntry.id, { end_at: d } as any);
                    setSelectedEntry({ ...selectedEntry, end_at: d } as TimeBlock);
                    setEditEndAt(
                      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
                    );
                  }}
                />
              </div>
            )}
          </>
        )}
      </DetailSheet>
    </div>
  );
}
