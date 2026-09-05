/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { EntryType, TimelineEntry } from '../types';
import {
  CheckSquare,
  Calendar,
  FileText,
  Clock,
  Send,
  HelpCircle,
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { toLocalDateString, formatDuration } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

import { ViewMode } from '../types';
import {
  parseSmartDate,
  parseSmartTimeSpan,
  parseSmartTime,
  parseTimeBlock,
  fromToRegex,
  atRegex,
  durationRegex,
  durationOnlyMinutesRegex,
} from '../lib/parser';

interface InputBarProps {
  activeDate: Date;
  viewMode?: ViewMode;
}

// Helpers for compact human-readable manual date & time display
const formatHumanDateTime = (dtStr: string) => {
  if (!dtStr) return '';
  try {
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    return (
      d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' @ ' +
      d.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      })
    );
  } catch {
    return dtStr;
  }
};

const formatHumanTimeOnly = (dtStr: string) => {
  if (!dtStr) return '';
  try {
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    return d.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return dtStr;
  }
};

// Ordered list of types for Tab cycling
const ENTRY_TYPES: EntryType[] = ['task', 'log', 'event', 'note', 'time-block'];

// Contextual rotating placeholders covering all existing NLP syntax
const PLACEHOLDERS: Partial<Record<EntryType, string[]>> = {
  task: [
    'Capture task (e.g. Code database schema at 4:30pm tomorrow)...',
    'Try: "Review PR from now to 3pm" (Span starting right now)',
    'Try: "Quick bug fix now 45m" (Span: now + 45m)',
    'Try: "Team sync today from 2pm to 3:30pm" (From/To range)',
    'Try: "Workout in 2 days at 6pm" (Relative offset)',
  ],
  log: [
    'Describe what you are doing (e.g. Walking to the train station)...',
    'Try: "Debugging auth from 10am to now" (Ended just now)',
    'Try: "Deep debugging session from now to 1h30" or "at 3pm 1h30"',
    'Try: "Coffee break with design team now 15m"',
  ],
  event: [
    'Event title (e.g. Project briefing presentation tomorrow at 10am)...',
    'Try: "Emergency team huddle from now to 2pm"',
    'Try: "Product launch keynote on 25/11 from 9am to 11:30am"',
    'Try: "Dentist appointment tomorrow at 3pm45"',
  ],
  note: [
    'Note title (e.g. Brainstorming session today at 2pm)...',
    'Try: "Reflections logged now" (Exact current time)',
    'Try: "Architecture decisions on 12/9 at 11am"',
    'Click the pencil icon on the left to write detailed markdown body',
  ],
  'time-block': [
    'Focus time block (e.g. Deep Work block from 3pm to 5pm)...',
    'Try: "Deep Work block from now to 5pm" (Current time to 5:00 PM)',
    'Try: "Coding Sprint now 2h" (Starts right now for 2 hours)',
    'Try: "Design Review tomorrow from 10am to 12pm"',
  ],
};

export default function InputBar({ activeDate, viewMode }: InputBarProps) {
  const [activeType, setActiveType] = useState<EntryType>('task');
  const [showHelp, setShowHelp] = useState(false);
  const [showTimePopup, setShowTimePopup] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  // Field values
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(''); // for Notes

  // Note Modal state and inputs
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalContent, setModalContent] = useState('');

  // Timestamps (defaults populated based on activeDate)
  const [timestampStr, setTimestampStr] = useState('');
  const [startAtStr, setStartAtStr] = useState('');
  const [endAtStr, setEndAtStr] = useState('');
  const [timeManuallySet, setTimeManuallySet] = useState(false);
  const [calendarViewDate, setCalendarViewDate] = useState<Date>(new Date(activeDate));

  // Sync calendarViewDate with activeDate
  useEffect(() => {
    setCalendarViewDate(new Date(activeDate));
  }, [activeDate]);

  // Debounced live parsed state
  const [debouncedInput, setDebouncedInput] = useState('');

  // Rotate placeholders every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % 5);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Debounce user input by 200ms for live chips preview
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedInput(title);
    }, 200);
    return () => clearTimeout(timer);
  }, [title]);

  // Helper to change selected day in calendar
  const handleSelectCalendarDay = (day: number) => {
    const target = new Date(calendarViewDate);
    target.setDate(day);

    const pad = (n: number) => n.toString().padStart(2, '0');

    if (activeType === 'time-block') {
      const currentStart = startAtStr ? new Date(startAtStr) : new Date();
      currentStart.setFullYear(target.getFullYear(), target.getMonth(), target.getDate());
      setStartAtStr(`${currentStart.getFullYear()}-${pad(currentStart.getMonth() + 1)}-${pad(currentStart.getDate())}T${pad(currentStart.getHours())}:${pad(currentStart.getMinutes())}`);

      const currentEnd = endAtStr ? new Date(endAtStr) : new Date();
      currentEnd.setFullYear(target.getFullYear(), target.getMonth(), target.getDate());
      setEndAtStr(`${currentEnd.getFullYear()}-${pad(currentEnd.getMonth() + 1)}-${pad(currentEnd.getDate())}T${pad(currentEnd.getHours())}:${pad(currentEnd.getMinutes())}`);
    } else {
      const current = timestampStr ? new Date(timestampStr) : new Date();
      current.setFullYear(target.getFullYear(), target.getMonth(), target.getDate());
      setTimestampStr(`${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}T${pad(current.getHours())}:${pad(current.getMinutes())}`);
    }
    setTimeManuallySet(true);
  };

  // Month navigation
  const handlePrevMonth = () => {
    setCalendarViewDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  };

  const handleNextMonth = () => {
    setCalendarViewDate((prev) => {
      const d = new Date(prev);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  };

  // Render 1-Month Mini Calendar & Time Configuration Popup
  const renderCalendarTimePopup = () => {
    if (!showTimePopup) return null;

    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const monthName = calendarViewDate.toLocaleDateString([], { month: 'long', year: 'numeric' });

    // Days in current view month
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    // Selected date check
    const currentSelectedDate = activeType === 'time-block'
      ? (startAtStr ? new Date(startAtStr) : activeDate)
      : (timestampStr ? new Date(timestampStr) : activeDate);

    const isCurrentSelected = (day: number) => {
      return (
        currentSelectedDate.getFullYear() === year &&
        currentSelectedDate.getMonth() === month &&
        currentSelectedDate.getDate() === day
      );
    };

    const isToday = (day: number) => {
      const now = new Date();
      return now.getFullYear() === year && now.getMonth() === month && now.getDate() === day;
    };

    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.96 }}
          transition={{ duration: 0.12, ease: 'easeOut' }}
          className="absolute bottom-full mb-3 left-0 bg-[#161616] border border-stone-800 rounded-2xl p-4 shadow-2xl z-[999] w-[310px] backdrop-blur-xl"
          id="calendar-time-popup"
        >
          {/* Calendar Header with Month Cycling Strip */}
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-2.5 mb-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-lg transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono font-bold text-stone-200 min-w-[120px] text-center select-none">
                {monthName}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1 hover:bg-stone-800 text-stone-400 hover:text-stone-200 rounded-lg transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowTimePopup(false)}
              className="p-1 hover:bg-stone-800 rounded-lg text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mini Calendar Grid */}
          <div className="mb-3.5">
            {/* Weekday headers */}
            <div className="grid grid-cols-7 gap-1 text-center font-mono text-[9px] text-stone-500 uppercase font-bold mb-1">
              <span>Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {Array.from({ length: firstDayIndex }).map((_, i) => (
                <div key={`empty-${i}`} className="h-7 w-7" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const selected = isCurrentSelected(day);
                const today = isToday(day);

                return (
                  <button
                    key={`day-${day}`}
                    type="button"
                    onClick={() => handleSelectCalendarDay(day)}
                    className={`h-7 w-7 rounded-lg text-xs font-mono font-semibold flex items-center justify-center transition-all cursor-pointer ${
                      selected
                        ? activeType === 'task'
                          ? 'bg-emerald-500 text-stone-950 font-bold shadow-md'
                          : activeType === 'log'
                            ? 'bg-stone-200 text-stone-950 font-bold shadow-md'
                            : activeType === 'event'
                              ? 'bg-amber-500 text-stone-950 font-bold shadow-md'
                              : activeType === 'note'
                                ? 'bg-blue-500 text-stone-950 font-bold shadow-md'
                                : 'bg-indigo-500 text-stone-950 font-bold shadow-md'
                        : today
                          ? 'border border-amber-500/60 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20'
                          : 'text-stone-300 hover:bg-stone-800 hover:text-white'
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time and Duration Inputs */}
          <div className="border-t border-stone-800/80 pt-3 space-y-2.5">
            {activeType === 'time-block' ? (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider font-bold">Start Frame</span>
                  <input
                    type="datetime-local"
                    value={startAtStr}
                    onChange={(e) => setStartAtStr(e.target.value)}
                    className="w-full bg-[#0b0b0b] hover:bg-stone-900 text-stone-200 border border-stone-800 rounded-lg px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-indigo-500/40 cursor-pointer"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider font-bold">End Frame</span>
                  <input
                    type="datetime-local"
                    value={endAtStr}
                    onChange={(e) => setEndAtStr(e.target.value)}
                    className="w-full bg-[#0b0b0b] hover:bg-stone-900 text-stone-200 border border-stone-800 rounded-lg px-2 py-1.5 text-[11px] font-mono focus:outline-none focus:border-indigo-500/40 cursor-pointer"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <span className="text-[9px] font-mono text-stone-500 uppercase tracking-wider font-bold">
                  {activeType === 'task' ? 'Scheduled Target Date & Time' : 'Entry Date & Timestamp'}
                </span>
                <input
                  type="datetime-local"
                  value={timestampStr}
                  onChange={(e) => {
                    setTimestampStr(e.target.value);
                    setTimeManuallySet(true);
                  }}
                  className="w-full bg-[#0b0b0b] hover:bg-stone-900 text-stone-200 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500/40 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Popup Footer */}
          <div className="border-t border-stone-800/80 mt-3 pt-2.5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCalendarViewDate(new Date(now));
                handleSelectCalendarDay(now.getDate());
              }}
              className="text-[10px] font-mono text-amber-400 hover:text-amber-300 font-semibold cursor-pointer"
            >
              Jump to Today
            </button>
            <button
              type="button"
              onClick={() => setShowTimePopup(false)}
              className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  };

  // Slash commands instant switcher
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const lower = val.toLowerCase().trim();

    // Check for slash command triggers
    if (lower === '/task' || lower === '/t') {
      setActiveType('task');
      setTitle('');
      return;
    }
    if (lower === '/log' || lower === '/l') {
      setActiveType('log');
      setTitle('');
      return;
    }
    if (lower === '/event' || lower === '/e') {
      setActiveType('event');
      setTitle('');
      return;
    }
    if (lower === '/note' || lower === '/n') {
      setActiveType('note');
      setTitle('');
      return;
    }
    if (lower === '/block' || lower === '/tb' || lower === '/timeblock' || lower === '/time-block' || lower === '/b') {
      setActiveType('time-block');
      setTitle('');
      return;
    }

    // Prefix commands like "/task Write docs" or "t: Write docs"
    const prefixMap: { prefix: RegExp; type: EntryType }[] = [
      { prefix: /^\/(?:task|t)\s+/i, type: 'task' },
      { prefix: /^\/(?:log|l)\s+/i, type: 'log' },
      { prefix: /^\/(?:event|e)\s+/i, type: 'event' },
      { prefix: /^\/(?:note|n)\s+/i, type: 'note' },
      { prefix: /^\/(?:block|timeblock|time-block|tb|b)\s+/i, type: 'time-block' },
    ];

    for (const { prefix, type } of prefixMap) {
      if (prefix.test(val)) {
        setActiveType(type);
        setTitle(val.replace(prefix, ''));
        return;
      }
    }

    setTitle(val);
  };

  // Live parsed metadata extraction
  const liveParsedPreview = React.useMemo(() => {
    const clean = debouncedInput.trim();
    if (!clean) return null;

    let base = new Date(activeDate);
    const now = new Date();
    base.setHours(now.getHours(), now.getMinutes(), 0, 0);

    const { parsedDate: dateBase, textAfterDateRemoval } = parseSmartDate(clean, base);
    const hasDetectedDate = dateBase.toDateString() !== base.toDateString();

    if (activeType === 'time-block') {
      const block = parseTimeBlock(clean, base);
      const isDateDiff = block.startAt.toDateString() !== base.toDateString();
      const hasTimeToken = fromToRegex.test(clean) || atRegex.test(clean) || durationRegex.test(clean) || durationOnlyMinutesRegex.test(clean);
      if (!hasTimeToken && !isDateDiff) return null;

      const durMs = block.endAt.getTime() - block.startAt.getTime();
      return {
        title: block.title || clean,
        dateStr: isDateDiff ? block.startAt.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : null,
        spanStr: `${formatTime(block.startAt)} – ${formatTime(block.endAt)}`,
        durationStr: formatDuration(durMs),
      };
    }

    const { parsedStart, parsedEnd, hasSpan, hasTime, textAfterTimeRemoval } = parseSmartTimeSpan(textAfterDateRemoval, dateBase);
    if (!hasDetectedDate && !hasTime && !hasSpan) return null;

    const durMs = hasSpan && parsedEnd ? parsedEnd.getTime() - parsedStart.getTime() : null;

    return {
      title: textAfterTimeRemoval || clean,
      dateStr: hasDetectedDate ? dateBase.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : null,
      spanStr: hasSpan && parsedEnd ? `${formatTime(parsedStart)} – ${formatTime(parsedEnd)}` : hasTime ? formatTime(parsedStart) : null,
      durationStr: durMs ? formatDuration(durMs) : null,
    };
  }, [debouncedInput, activeDate, activeType]);

  // Close time manual popup if activeType changes
  useEffect(() => {
    setShowTimePopup(false);
    setTimeManuallySet(false);
  }, [activeType]);

  // Auto-update datetime strings when activeDate changes
  useEffect(() => {
    const d = new Date(activeDate);
    const now = new Date();
    d.setHours(now.getHours(), now.getMinutes(), 0, 0);

    // Format to YYYY-MM-DDTHH:mm for datetime-local
    const pad = (n: number) => n.toString().padStart(2, '0');
    const localISO = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setTimestampStr(localISO);
    setTimeManuallySet(false);
    setStartAtStr(localISO);

    // Set default end_at to 1 hour later
    const end = new Date(d);
    end.setHours(d.getHours() + 1);
    const endLocalISO = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
    setEndAtStr(endLocalISO);
  }, [activeDate]);

  // Combine base date from activeDate context and exact hour/minute/second from 'now'
  const getBaseCompletedDate = (overrideTime?: { hour: number; minute: number }) => {
    const d = new Date(activeDate);
    const now = new Date();
    if (overrideTime) {
      d.setHours(overrideTime.hour, overrideTime.minute, 0, 0);
    } else {
      d.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), now.getMilliseconds());
    }
    return d;
  };

  // Handle Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const entryId = crypto.randomUUID();
    let newEntry: TimelineEntry | null = null;

    if (activeType === 'task') {
      let cleanTitle = title.trim();
      let defaultBaseDate =
        timeManuallySet && timestampStr ? new Date(timestampStr) : getBaseCompletedDate();

      const { parsedDate: dateBase, textAfterDateRemoval } = parseSmartDate(
        cleanTitle,
        defaultBaseDate,
      );
      cleanTitle = textAfterDateRemoval;

      const {
        parsedStart,
        parsedEnd,
        hasSpan,
        hasTime,
        textAfterTimeRemoval,
      } = parseSmartTimeSpan(cleanTitle, dateBase);
      cleanTitle = textAfterTimeRemoval;

      const finalTitle = cleanTitle || title.trim();
      if (!finalTitle) return;

      const activeListId = localStorage.getItem('flowday-tasks-selected-list');
      const autoListIds =
        viewMode === 'lists' && activeListId && activeListId !== 'all' && activeListId !== 'none'
          ? [activeListId]
          : [];

      newEntry = {
        id: entryId,
        type: 'task',
        title: finalTitle,
        status: 'todo',
        time_spent: 0,
        created_at: getBaseCompletedDate(),
        // In 'lists' mode, tasks are dateless (no scheduled_at) unless user sets a time/date
        ...(autoListIds.length > 0 ? { category_ids: autoListIds } : {}),
        ...(hasTime || hasSpan || timeManuallySet ? { scheduled_at: parsedStart } : {}),
        ...(hasSpan && parsedEnd ? { scheduled_end_at: parsedEnd } : {}),
      };
    } else if (activeType === 'log') {
      let cleanTitle = title.trim();
      let defaultBaseDate =
        timeManuallySet && timestampStr ? new Date(timestampStr) : getBaseCompletedDate();

      const { parsedDate: dateBase, textAfterDateRemoval } = parseSmartDate(
        cleanTitle,
        defaultBaseDate,
      );
      cleanTitle = textAfterDateRemoval;

      const {
        parsedStart,
        parsedEnd,
        hasSpan,
        textAfterTimeRemoval,
      } = parseSmartTimeSpan(cleanTitle, dateBase);
      cleanTitle = textAfterTimeRemoval;

      const finalTitle = cleanTitle || title.trim();
      if (!finalTitle) return;

      newEntry = {
        id: entryId,
        type: 'log',
        title: finalTitle,
        timestamp: parsedStart,
        created_at: getBaseCompletedDate(),
        scheduled_at: parsedStart,
        ...(hasSpan && parsedEnd ? { end_timestamp: parsedEnd } : {}),
      };
    } else if (activeType === 'event') {
      let cleanTitle = title.trim();
      let defaultBaseDate =
        timeManuallySet && timestampStr ? new Date(timestampStr) : getBaseCompletedDate();

      const { parsedDate: dateBase, textAfterDateRemoval } = parseSmartDate(
        cleanTitle,
        defaultBaseDate,
      );
      cleanTitle = textAfterDateRemoval;

      const {
        parsedStart,
        parsedEnd,
        hasSpan,
        textAfterTimeRemoval,
      } = parseSmartTimeSpan(cleanTitle, dateBase);
      cleanTitle = textAfterTimeRemoval;

      const finalTitle = cleanTitle || title.trim();
      if (!finalTitle) return;

      newEntry = {
        id: entryId,
        type: 'event',
        title: finalTitle,
        content: content.trim(),
        timestamp: parsedStart,
        created_at: getBaseCompletedDate(),
        scheduled_at: parsedStart,
        ...(hasSpan && parsedEnd ? { end_timestamp: parsedEnd } : {}),
      };
    } else if (activeType === 'note') {
      let cleanTitle = title.trim();
      let defaultBaseDate =
        timeManuallySet && timestampStr ? new Date(timestampStr) : getBaseCompletedDate();

      const { parsedDate: dateBase, textAfterDateRemoval } = parseSmartDate(
        cleanTitle,
        defaultBaseDate,
      );
      cleanTitle = textAfterDateRemoval;

      const { parsedDate: finalDate, textAfterTimeRemoval } = parseSmartTime(cleanTitle, dateBase);
      cleanTitle = textAfterTimeRemoval;

      const finalTitle = cleanTitle || title.trim();
      if (!finalTitle) return;

      newEntry = {
        id: entryId,
        type: 'note',
        title: finalTitle,
        content: content.trim(),
        timestamp: finalDate,
        created_at: getBaseCompletedDate(),
        scheduled_at: finalDate,
      };
    } else if (activeType === 'time-block') {
      let cleanTitle = title.trim();
      if (!cleanTitle) return;

      const defaultStart = startAtStr ? new Date(startAtStr) : getBaseCompletedDate();

      const parsedBlock = parseTimeBlock(cleanTitle, defaultStart);
      const finalTitle = parsedBlock.title || title.trim();

      if (parsedBlock.endAt <= parsedBlock.startAt) {
        alert('End time must be after start time.');
        return;
      }

      newEntry = {
        id: entryId,
        type: 'time-block',
        title: finalTitle,
        start_at: parsedBlock.startAt,
        end_at: parsedBlock.endAt,
        created_at: getBaseCompletedDate(),
      };
    }

    if (newEntry) {
      await db.entries.add(newEntry);

      // Reset text inputs
      setTitle('');
      setContent('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    // Tab cycles effortlessly through the 5 entry types
    if (e.key === 'Tab') {
      e.preventDefault();
      const currentIndex = ENTRY_TYPES.indexOf(activeType);
      const nextIndex = e.shiftKey
        ? (currentIndex - 1 + ENTRY_TYPES.length) % ENTRY_TYPES.length
        : (currentIndex + 1) % ENTRY_TYPES.length;
      setActiveType(ENTRY_TYPES[nextIndex]);
      return;
    }

    // Submit on Enter
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div
      className="w-full bg-[#0d0d0d] border-t border-stone-800/60 p-5 md:p-6 relative z-30"
      id="input-bar-container"
    >
      <div className="max-w-4xl mx-auto relative">
        {/* Smart Parser Tooltip / Mobile Bottom Sheet */}
        <AnimatePresence>
          {showHelp && (
            <>
              {/* Dark backdrop overlay on mobile */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowHelp(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              />

              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 20, scale: 0.98 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-2xl border-t border-stone-800 bg-[#141414] shadow-2xl flex flex-col md:absolute md:inset-x-auto md:bottom-full md:mb-4 md:left-0 md:right-0 md:rounded-xl md:border md:border-stone-800/90 md:max-h-[75vh] text-stone-300 backdrop-blur-md"
                id="smart-parser-help-tooltip"
                style={{ paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}
              >
                {/* Mobile Drag Handle Indicator */}
                <div className="md:hidden pt-2.5 pb-1 flex justify-center shrink-0">
                  <div className="w-10 h-1 bg-stone-700 rounded-full" />
                </div>

                {/* Sticky Header */}
                <div className="flex items-center justify-between border-b border-stone-800 px-4 md:px-5 py-2.5 md:py-3 shrink-0">
                  <div className="flex items-center gap-2">
                    {activeType === 'task' && <CheckSquare className="w-4 h-4 text-emerald-400" />}
                    {activeType === 'log' && <CircleDot className="w-4 h-4 text-stone-400" />}
                    {activeType === 'event' && <Calendar className="w-4 h-4 text-amber-400" />}
                    {activeType === 'note' && <FileText className="w-4 h-4 text-blue-400" />}
                    {activeType === 'time-block' && <Clock className="w-4 h-4 text-indigo-400" />}
                    <h4 className="font-mono font-bold text-[11px] uppercase tracking-wider text-stone-100">
                      {activeType} NLP Smart Engine Guidelines
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowHelp(false)}
                    className="p-1 hover:bg-stone-800 rounded-lg text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
                    title="Dismiss help"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Scrollable Comprehensive Content */}
                <div className="overflow-y-auto overscroll-contain px-4 md:px-5 py-3 md:py-4 space-y-4 font-sans text-xs flex-1 min-h-0 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-stone-800 [&::-webkit-scrollbar-thumb]:rounded-full">
                  {/* 1. Universal Time & Span Parsing Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-[#0b0b0b]/80 border border-stone-900 rounded-xl p-3 space-y-1.5">
                      <div className="font-mono text-[9px] text-amber-400 uppercase tracking-widest font-bold flex items-center gap-1">
                        <span>🕒 Exact & Point Times</span>
                      </div>
                      <ul className="text-stone-300 space-y-1 text-[11px] font-mono leading-relaxed">
                        <li>• <code className="text-emerald-400">at 3:45pm</code> / <code className="text-emerald-400">at 15:45</code></li>
                        <li>• <code className="text-emerald-400">at 3pm20</code> / <code className="text-emerald-400">at 3pm</code></li>
                        <li>• <code className="text-emerald-400">at 14h30</code> / <code className="text-emerald-400">at 14h</code></li>
                        <li>• <code className="text-emerald-400">at now</code> / <code className="text-emerald-400">now</code></li>
                      </ul>
                    </div>

                    <div className="bg-[#0b0b0b]/80 border border-stone-900 rounded-xl p-3 space-y-1.5">
                      <div className="font-mono text-[9px] text-sky-400 uppercase tracking-widest font-bold flex items-center gap-1">
                        <span>↔️ "from X to Y" Spans</span>
                      </div>
                      <ul className="text-stone-300 space-y-1 text-[11px] font-mono leading-relaxed">
                        <li>• <code className="text-sky-400">from 1pm to 3:30pm</code></li>
                        <li>• <code className="text-sky-400">from 9 to 11am</code> <span className="text-stone-500">(inherits am)</span></li>
                        <li>• <code className="text-sky-400">from 3pm40 to 5pm50</code></li>
                        <li>• <code className="text-sky-400">from now to 4pm</code> / <code className="text-sky-400">from 10am to now</code></li>
                      </ul>
                    </div>

                    <div className="bg-[#0b0b0b]/80 border border-stone-900 rounded-xl p-3 space-y-1.5">
                      <div className="font-mono text-[9px] text-indigo-400 uppercase tracking-widest font-bold flex items-center gap-1">
                        <span>⏳ Durations & Dates</span>
                      </div>
                      <ul className="text-stone-300 space-y-1 text-[11px] font-mono leading-relaxed">
                        <li>• <code className="text-indigo-400">at 10am 2h30</code> / <code className="text-indigo-400">now 45m</code></li>
                        <li>• <code className="text-indigo-400">today</code> / <code className="text-indigo-400">tomorrow</code></li>
                        <li>• <code className="text-indigo-400">in 3 days</code> / <code className="text-indigo-400">in 1 day</code></li>
                        <li>• <code className="text-indigo-400">25/11/2026</code> or <code className="text-indigo-400">25/11</code></li>
                      </ul>
                    </div>
                  </div>

                  {/* 2. Specific Type Behaviors */}
                  <div className="bg-[#0a0a0a] border border-stone-850 rounded-xl p-3.5 space-y-2">
                    <div className="font-mono text-[10px] text-stone-400 uppercase tracking-wider font-bold">
                      Target Type Behavior: <span className="text-amber-400 uppercase font-extrabold">{activeType}</span>
                    </div>
                    {activeType === 'task' && (
                      <p className="text-stone-300 leading-relaxed text-xs">
                        Tasks are scheduled when a time/date token is typed (e.g. <span className="text-emerald-400 font-mono">"Review PR from now to 3pm"</span>). Completing tasks taking &ge; 15 min automatically displays a timeline span.
                      </p>
                    )}
                    {activeType === 'log' && (
                      <p className="text-stone-300 leading-relaxed text-xs">
                        Logs capture real-time reflections or past completed work (e.g. <span className="text-stone-300 font-mono">"Debugged database from 10am to now"</span>). Easily starred <span className="text-amber-400 font-mono">⭐</span> to Highlights or marked as Accomplishment <span className="text-amber-400 font-mono">🏆</span>.
                      </p>
                    )}
                    {activeType === 'event' && (
                      <p className="text-stone-300 leading-relaxed text-xs">
                        Events schedule calendar appointments and key milestones (e.g. <span className="text-amber-400 font-mono">"Keynote demo tomorrow from 2pm to 3:30pm"</span>). Use the pencil button on the left to write detailed notes.
                      </p>
                    )}
                    {activeType === 'note' && (
                      <p className="text-stone-300 leading-relaxed text-xs">
                        Notes capture unstructured thoughts or meeting notes anchored to a timestamp (e.g. <span className="text-blue-400 font-mono">"Architecture reflections today at 4pm"</span>). Click the pencil button for rich markdown editing.
                      </p>
                    )}
                    {activeType === 'time-block' && (
                      <p className="text-stone-300 leading-relaxed text-xs">
                        Time Blocks visually reserve deep-focus segments on the day timeline (e.g. <span className="text-indigo-400 font-mono">"Deep coding block from now to 5pm"</span> or <span className="text-indigo-400 font-mono">"at 9am 2h30"</span>).
                      </p>
                    )}
                  </div>

                  {/* 3. Global Shortcuts & Slash Commands */}
                  <div className="border-t border-stone-800/80 pt-3 flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono text-stone-400">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-amber-400 font-bold uppercase tracking-wider">Slash Shortcuts:</span>
                      <span className="bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded text-stone-300 font-bold">/t, /task</span>
                      <span className="bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded text-stone-300 font-bold">/l, /log</span>
                      <span className="bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded text-stone-300 font-bold">/e, /event</span>
                      <span className="bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded text-stone-300 font-bold">/n, /note</span>
                      <span className="bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded text-stone-300 font-bold">/b, /tb, /block</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <span className="text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-800/60 px-1.5 py-0.5 rounded">[TAB]</span>
                        <span>Cycle types</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-stone-300 font-bold bg-stone-900 border border-stone-800 px-1.5 py-0.5 rounded">[ENTER]</span>
                        <span>Save entry</span>
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Unified Premium Entry Panel Container */}
        <div className="bg-[#141414] border border-stone-800/80 rounded-b-2xl shadow-2xl p-4 md:p-5 relative overflow-visible transition-all duration-300 focus-within:border-stone-700/80">
          {/* Subtle Ambient Accent Border depending on activeType */}
          <div
            className={`absolute top-0 left-0 right-0 h-[2px] transition-all duration-300 ${
              activeType === 'task'
                ? 'bg-gradient-to-r from-emerald-500/20 via-emerald-500 to-emerald-500/20'
                : activeType === 'log'
                  ? 'bg-gradient-to-r from-stone-500/20 via-stone-500 to-stone-500/20'
                  : activeType === 'event'
                    ? 'bg-gradient-to-r from-amber-500/20 via-amber-500 to-amber-500/20'
                    : activeType === 'note'
                      ? 'bg-gradient-to-r from-blue-500/20 via-blue-500 to-blue-500/20'
                      : 'bg-gradient-to-r from-indigo-500/20 via-indigo-500 to-indigo-500/20'
            }`}
          />

          {/* Sub-Header Widget: Types Switcher + Custom Manual Inputs + Custom Help Toggle */}
          <div
            className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4 mt-1 border-b border-stone-800/50 pb-3"
            id="input-control-strip"
          >
            {/* Left section: Segmented tab selector + Inline Manual Time control button */}
            <div className="flex items-center gap-2.5 w-full lg:w-auto">
              {/* Segmented Command Tab Selector */}
              <div
                className="bg-stone-950 border border-stone-900 p-0.5 rounded-xl flex w-full lg:w-auto items-center overflow-x-auto [&::-webkit-scrollbar]:hidden"
                id="input-type-chips"
              >
                {/* TASK */}
                <button
                  type="button"
                  id="chip-task"
                  onClick={() => setActiveType('task')}
                  className={`flex-1 lg:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeType === 'task'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-md font-extrabold'
                      : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900/50 border border-transparent'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Task</span>
                </button>

                {/* LOG */}
                <button
                  type="button"
                  id="chip-log"
                  onClick={() => setActiveType('log')}
                  className={`flex-1 lg:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeType === 'log'
                      ? 'bg-stone-500/10 text-stone-400 border border-stone-500/20 shadow-md font-extrabold'
                      : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900/50 border border-transparent'
                  }`}
                >
                  <CircleDot className="w-3.5 h-3.5" />
                  <span>Log</span>
                </button>

                {/* EVENT */}
                <button
                  type="button"
                  id="chip-event"
                  onClick={() => setActiveType('event')}
                  className={`flex-1 lg:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeType === 'event'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-md font-extrabold'
                      : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900/50 border border-transparent'
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Event</span>
                </button>

                {/* NOTE */}
                <button
                  type="button"
                  id="chip-note"
                  onClick={() => setActiveType('note')}
                  className={`flex-1 lg:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeType === 'note'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-md font-extrabold'
                      : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900/50 border border-transparent'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Note</span>
                </button>

                {/* TIME BLOCK */}
                <button
                  type="button"
                  id="chip-time-block"
                  onClick={() => setActiveType('time-block')}
                  className={`flex-1 lg:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeType === 'time-block'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-md font-extrabold'
                      : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900/50 border border-transparent'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Block</span>
                </button>

                {/* Divider */}
                <div className="w-[1px] bg-stone-800 my-1 mx-0.5 hidden lg:block" />

                {/* SYNTAX GUIDE - Sitting right next to the Type Switcher */}
                <button
                  type="button"
                  id="chip-syntax-guide"
                  onClick={() => setShowHelp(!showHelp)}
                  className={`flex-initial flex items-center justify-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                    showHelp
                      ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-md font-extrabold'
                      : 'text-stone-400 hover:text-amber-300 hover:bg-stone-900/50 border border-transparent'
                  }`}
                  title="Open comprehensive Smart Syntax & Shortcut Guide"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Syntax Guide</span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Parsing Preview Chips (Debounced 200ms) */}
          <AnimatePresence>
            {liveParsedPreview && (
              <motion.div
                initial={{ opacity: 0, height: 0, y: -4 }}
                animate={{ opacity: 1, height: 'auto', y: 0 }}
                exit={{ opacity: 0, height: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="mb-2.5 overflow-hidden flex items-center gap-2 flex-wrap text-xs font-mono select-none"
              >
                <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                  Detected:
                </span>
                {liveParsedPreview.dateStr && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-950/40 border border-sky-800/60 text-sky-400 text-[11px]">
                    <Calendar className="w-3 h-3" />
                    <span>{liveParsedPreview.dateStr}</span>
                  </span>
                )}
                {liveParsedPreview.spanStr && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/40 border border-indigo-800/60 text-indigo-300 text-[11px]">
                    <Clock className="w-3 h-3" />
                    <span>{liveParsedPreview.spanStr}</span>
                  </span>
                )}
                {liveParsedPreview.durationStr && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/40 border border-amber-800/60 text-amber-400 text-[11px]">
                    <span>⏳ {liveParsedPreview.durationStr}</span>
                  </span>
                )}
                <span className="text-stone-500 text-[10px] truncate max-w-[200px]">
                  → "{liveParsedPreview.title}"
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form Interactive Layout with STABLE Static Area Height */}
          <form onSubmit={handleSubmit} className="w-full h-[46px]" id="timeline-input-form">
            {/* INPUT FIELDS ACCORDING TO STATE TYPE */}
            <div className="w-full h-full">
              {/* TASK INJECT */}
              {activeType === 'task' && (
                <div className="relative w-full flex gap-2.5 items-stretch h-full">
                  {/* Clock Manual Time & Calendar button */}
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setShowTimePopup(!showTimePopup)}
                      className={`h-full px-3.5 flex items-center justify-center bg-stone-950 border border-stone-850 hover:border-stone-750 text-emerald-400 hover:text-emerald-300 rounded-xl transition-all hover:bg-stone-900 cursor-pointer ${
                        showTimePopup ? 'border-emerald-500/50 bg-stone-900 ring-1 ring-emerald-500/30' : ''
                      }`}
                      title="Set task date & scheduled time"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    {renderCalendarTimePopup()}
                  </div>

                  <div className="relative flex-1">
                    <input
                      id="input-task-title"
                      type="text"
                      required
                      maxLength={100}
                      placeholder={PLACEHOLDERS.task[placeholderIndex % PLACEHOLDERS.task.length]}
                      value={title}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyPress}
                      className="w-full h-full bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/50 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none focus:border-emerald-500/50 focus:bg-stone-950 transition-all shadow-inner"
                    />
                  </div>
                  <button
                    type="submit"
                    className="max-sm:hidden px-5 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-sm"
                  >
                    <span>Save</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* LOG INJECT */}
              {activeType === 'log' && (
                <div className="relative w-full flex gap-2.5 items-stretch h-full">
                  {/* Clock Manual Time & Calendar button */}
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setShowTimePopup(!showTimePopup)}
                      className={`h-full px-3.5 flex items-center justify-center bg-stone-950 border border-stone-850 hover:border-stone-750 text-stone-400 hover:text-stone-200 rounded-xl transition-all hover:bg-stone-900 cursor-pointer ${
                        showTimePopup ? 'border-stone-600 bg-stone-900 ring-1 ring-stone-700' : ''
                      }`}
                      title="Set log date & timestamp"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    {renderCalendarTimePopup()}
                  </div>

                  <div className="relative flex-1">
                    <input
                      id="input-log-title"
                      type="text"
                      required
                      maxLength={100}
                      placeholder={PLACEHOLDERS.log[placeholderIndex % PLACEHOLDERS.log.length]}
                      value={title}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyPress}
                      className="w-full h-full bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/50 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-500/50 focus:bg-stone-950 transition-all shadow-inner"
                    />
                  </div>
                  <button
                    type="submit"
                    className="max-sm:hidden px-5 bg-stone-850/80 hover:bg-stone-800 text-stone-200 border border-stone-700/80 hover:border-stone-600 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-sm"
                  >
                    <span>Save</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* EVENT INJECT */}
              {activeType === 'event' && (
                <div className="relative w-full flex gap-2 items-stretch h-full">
                  {/* Pencil Detailed Modal Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setModalTitle(title);
                      setModalContent('');
                      setIsNoteModalOpen(true);
                    }}
                    className="flex items-center justify-center px-3.5 bg-stone-950 border border-stone-850 hover:border-stone-750 text-amber-400 hover:text-amber-300 rounded-xl transition-all hover:bg-stone-900 cursor-pointer"
                    title="Write detailed event with title and body content"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-pencil animate-pulse"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>

                  {/* Clock Manual Time & Calendar button */}
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setShowTimePopup(!showTimePopup)}
                      className={`h-full px-3.5 flex items-center justify-center bg-stone-950 border border-stone-850 hover:border-stone-750 text-amber-400 hover:text-amber-300 rounded-xl transition-all hover:bg-stone-900 cursor-pointer ${
                        showTimePopup ? 'border-amber-500/50 bg-stone-900 ring-1 ring-amber-500/30' : ''
                      }`}
                      title="Set event date & time span"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    {renderCalendarTimePopup()}
                  </div>

                  <div className="relative flex-1">
                    <input
                      id="input-event-title"
                      type="text"
                      required
                      maxLength={100}
                      placeholder={PLACEHOLDERS.event[placeholderIndex % PLACEHOLDERS.event.length]}
                      value={title}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyPress}
                      className="w-full h-full bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/55 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500/50 focus:bg-stone-950 transition-all shadow-inner"
                    />
                  </div>
                  <button
                    type="submit"
                    className="max-sm:hidden px-5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 hover:border-amber-500/50 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-sm"
                  >
                    <span>Save</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* NOTE INJECT */}
              {activeType === 'note' && (
                <div className="relative w-full flex gap-2 items-stretch h-full">
                  {/* Pencil Detailed Modal Button */}
                  <button
                    type="button"
                    onClick={() => {
                      setModalTitle(title);
                      setModalContent('');
                      setIsNoteModalOpen(true);
                    }}
                    className="flex items-center justify-center px-3.5 bg-stone-950 border border-stone-850 hover:border-stone-750 text-blue-400 hover:text-blue-300 rounded-xl transition-all hover:bg-stone-900 cursor-pointer"
                    title="Write detailed note with title and body content"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.1"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="lucide lucide-pencil animate-pulse"
                    >
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>

                  {/* Clock Manual Time & Calendar button */}
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setShowTimePopup(!showTimePopup)}
                      className={`h-full px-3.5 flex items-center justify-center bg-stone-950 border border-stone-850 hover:border-stone-750 text-blue-400 hover:text-blue-300 rounded-xl transition-all hover:bg-stone-900 cursor-pointer ${
                        showTimePopup ? 'border-blue-500/50 bg-stone-900 ring-1 ring-blue-500/30' : ''
                      }`}
                      title="Set note date & timestamp"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    {renderCalendarTimePopup()}
                  </div>

                  <div className="relative flex-1">
                    <input
                      id="input-note-title"
                      type="text"
                      required
                      placeholder={PLACEHOLDERS.note[placeholderIndex % PLACEHOLDERS.note.length]}
                      value={title}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyPress}
                      className="w-full h-full bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/60 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none focus:border-blue-500/50 focus:bg-stone-950 transition-all shadow-inner"
                    />
                  </div>
                  <button
                    type="submit"
                    className="max-sm:hidden px-5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 hover:border-blue-500/50 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-sm"
                  >
                    <span>Save</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* TIME BLOCK INJECT */}
              {activeType === 'time-block' && (
                <div className="relative w-full flex gap-2.5 items-stretch h-full">
                  {/* Clock Manual Time & Calendar button */}
                  <div className="relative inline-block">
                    <button
                      type="button"
                      onClick={() => setShowTimePopup(!showTimePopup)}
                      className={`h-full px-3.5 flex items-center justify-center bg-stone-950 border border-stone-850 hover:border-stone-750 text-indigo-400 hover:text-indigo-300 rounded-xl transition-all hover:bg-stone-900 cursor-pointer ${
                        showTimePopup ? 'border-indigo-500/50 bg-stone-900 ring-1 ring-indigo-500/30' : ''
                      }`}
                      title="Set time block start & end frames"
                    >
                      <Clock className="w-4 h-4" />
                    </button>
                    {renderCalendarTimePopup()}
                  </div>

                  <div className="relative flex-1">
                    <input
                      id="input-timeblock-title"
                      type="text"
                      required
                      maxLength={100}
                      placeholder={PLACEHOLDERS['time-block'][placeholderIndex % PLACEHOLDERS['time-block'].length]}
                      value={title}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyPress}
                      className="w-full h-full bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/50 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none focus:border-indigo-500/50 focus:bg-stone-950 transition-all shadow-inner"
                    />
                  </div>
                  <button
                    type="submit"
                    className="max-sm:hidden px-5 bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-400 border border-indigo-500/30 hover:border-indigo-500/50 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer shadow-sm"
                  >
                    <span>Save</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* DEDICATED DETAILED NOTE CREATION MODAL */}
      <AnimatePresence>
        {isNoteModalOpen && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999] p-4 font-sans">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="bg-[#121212] border border-stone-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl relative flex flex-col"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-850 p-4">
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border ${
                    activeType === 'event'
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                  }`}
                >
                  {activeType === 'event' ? 'New detailed event' : 'New detailed note'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsNoteModalOpen(false)}
                  className="p-1 text-stone-500 hover:text-stone-300 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form body */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!modalTitle.trim()) return;

                  const entryId = crypto.randomUUID();
                  let defaultBaseDate =
                    timeManuallySet && timestampStr
                      ? new Date(timestampStr)
                      : getBaseCompletedDate();

                  let cleanTitle = modalTitle.trim();
                  const { parsedDate: dateBase, textAfterDateRemoval } = parseSmartDate(
                    cleanTitle,
                    defaultBaseDate,
                  );
                  cleanTitle = textAfterDateRemoval;

                  const {
                    parsedStart,
                    parsedEnd,
                    hasSpan,
                    textAfterTimeRemoval,
                  } = parseSmartTimeSpan(cleanTitle, dateBase);
                  cleanTitle = textAfterTimeRemoval;

                  const finalTitle = cleanTitle || modalTitle.trim();

                  const newEntry = {
                    id: entryId,
                    type: (activeType === 'event' ? 'event' : 'note') as 'event' | 'note',
                    title: finalTitle,
                    content: modalContent.trim(),
                    timestamp: parsedStart,
                    created_at: getBaseCompletedDate(),
                    scheduled_at: parsedStart,
                    ...(activeType === 'event' && hasSpan && parsedEnd
                      ? { end_timestamp: parsedEnd }
                      : {}),
                  };

                  await db.entries.add(newEntry);

                  // Reset states
                  setIsNoteModalOpen(false);
                  setModalTitle('');
                  setModalContent('');
                  setTitle('');
                  setContent('');
                }}
                className="p-5 space-y-4"
              >
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-mono text-stone-500 font-bold block">
                    {activeType === 'event' ? 'Event Title' : 'Note Title'}
                  </label>
                  <input
                    type="text"
                    required
                    value={modalTitle}
                    onChange={(e) => setModalTitle(e.target.value)}
                    className={`w-full bg-[#0a0a0a] text-stone-100 border border-stone-850 rounded-xl px-4 py-3 text-sm focus:outline-none placeholder-stone-700 font-serif ${
                      activeType === 'event'
                        ? 'focus:border-amber-500/50'
                        : 'focus:border-blue-500/50'
                    }`}
                    placeholder={
                      activeType === 'event'
                        ? 'Enter event summary/title (e.g. Project briefing presentation tomorrow at 10am)...'
                        : 'Enter short summary/title (e.g. Brainstorming session today at 2pm)...'
                    }
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-wider font-mono text-stone-500 font-bold block">
                    {activeType === 'event' ? 'Event Content / Description' : 'Note Content / Body'}
                  </label>
                  <textarea
                    value={modalContent}
                    rows={6}
                    onChange={(e) => setModalContent(e.target.value)}
                    className={`w-full bg-[#0a0a0a] text-stone-100 border border-stone-850 rounded-xl px-4 py-3 text-sm focus:outline-none font-sans leading-relaxed resize-none ${
                      activeType === 'event'
                        ? 'focus:border-amber-500/50'
                        : 'focus:border-blue-500/50'
                    }`}
                    placeholder={
                      activeType === 'event'
                        ? 'Write event details, description, location, or agenda...'
                        : 'Write structured thoughts, reflections, details, or markdown formatting...'
                    }
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setIsNoteModalOpen(false)}
                    className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-stone-300 text-xs font-mono uppercase tracking-wider rounded-xl border border-stone-800 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-xl border transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5 ${
                      activeType === 'event'
                        ? 'bg-amber-500 hover:bg-amber-400 text-[#0e0c08] border-amber-400'
                        : 'bg-blue-500 hover:bg-blue-400 text-[#070a0e] border-blue-400'
                    }`}
                  >
                    <span>{activeType === 'event' ? 'Save Event' : 'Save Note'}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
