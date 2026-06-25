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
  CircleDot,
} from 'lucide-react';
import { toLocalDateString } from '../utils';
import { motion, AnimatePresence } from 'motion/react';

interface InputBarProps {
  activeDate: Date;
  viewMode?: 'day' | 'timeline' | 'records' | 'tasks' | 'hub';
}

// Helper to parse date keyword/string from text
function parseSmartDate(
  inputText: string,
  defaultDate: Date,
): { parsedDate: Date; textAfterDateRemoval: string } {
  let cleanText = inputText;
  let targetDate = new Date(defaultDate);

  const tomorrowRegex = /\btomorrow\b/i;
  const todayRegex = /\btoday\b/i;
  const inXDaysRegex = /\bin\s*(\d+)\s*days?\b/i;
  // matches formats like d/m/yyyy or d/m/yy or d/m (e.g., 2/5/2026, 2/6)
  const exactDateRegex = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;

  if (tomorrowRegex.test(cleanText)) {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    targetDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    cleanText = cleanText.replace(tomorrowRegex, ' ');
  } else if (todayRegex.test(cleanText)) {
    const d = new Date();
    targetDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    cleanText = cleanText.replace(todayRegex, ' ');
  } else {
    const inXMatch = cleanText.match(inXDaysRegex);
    if (inXMatch) {
      const daysCount = parseInt(inXMatch[1], 10);
      const d = new Date();
      d.setDate(d.getDate() + daysCount);
      targetDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
      cleanText = cleanText.replace(inXDaysRegex, ' ');
    } else {
      const exactMatch = cleanText.match(exactDateRegex);
      if (exactMatch) {
        const day = parseInt(exactMatch[1], 10);
        const month = parseInt(exactMatch[2], 10) - 1;
        const year = exactMatch[3] ? parseInt(exactMatch[3], 10) : new Date().getFullYear();

        let fullYear = year;
        if (exactMatch[3] && exactMatch[3].length === 2) {
          fullYear = 2000 + year;
        }

        const tempDate = new Date(fullYear, month, day);
        if (
          tempDate.getFullYear() === fullYear &&
          tempDate.getMonth() === month &&
          tempDate.getDate() === day
        ) {
          targetDate.setFullYear(fullYear, month, day);
          cleanText = cleanText.replace(exactDateRegex, ' ');
        }
      }
    }
  }

  cleanText = cleanText.trim().replace(/\s+/g, ' ');
  return { parsedDate: targetDate, textAfterDateRemoval: cleanText };
}

// Helper to parse time keyword from text
function parseSmartTime(
  inputText: string,
  baseDate: Date,
): { parsedDate: Date; textAfterTimeRemoval: string } {
  let cleanText = inputText;
  let targetDate = new Date(baseDate);

  const timeRegex = /(?:\s+|^)at\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  const match = cleanText.match(timeRegex);
  if (match) {
    const h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const ampm = match[3] ? match[3].toLowerCase() : null;

    let targetHour = h;
    if (ampm === 'pm' && h < 12) {
      targetHour += 12;
    } else if (ampm === 'am' && h === 12) {
      targetHour = 0;
    }

    if (targetHour >= 0 && targetHour < 24 && m >= 0 && m < 60) {
      targetDate.setHours(targetHour, m, 0, 0);
      cleanText = cleanText.replace(timeRegex, ' ');
    }
  }

  cleanText = cleanText.trim().replace(/\s+/g, ' ');
  return { parsedDate: targetDate, textAfterTimeRemoval: cleanText };
}

// Helper to parse complex timeblock options
function parseTimeBlock(
  inputText: string,
  defaultStart: Date,
): { title: string; startAt: Date; endAt: Date } {
  let cleanText = inputText;

  // 1. Smart parse date (today, tomorrow, in X days, d/m/y, d/m)
  const { parsedDate: dateBaseline, textAfterDateRemoval } = parseSmartDate(
    cleanText,
    defaultStart,
  );
  cleanText = textAfterDateRemoval;

  let startAt = new Date(dateBaseline);
  let endAt = new Date(dateBaseline);
  // Default end is 1 hour after start if not overridden
  endAt.setHours(startAt.getHours() + 1);

  // 2. Try to parse "from X to Y" (e.g. "from 6pm to 7pm" or "from 6:30pm to 7:20pm")
  const fromToRegex =
    /(?:\s+|^)from\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*to\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
  const fromToMatch = cleanText.match(fromToRegex);

  let hasFromTo = false;
  if (fromToMatch) {
    let startH = parseInt(fromToMatch[1], 10);
    let startM = fromToMatch[2] ? parseInt(fromToMatch[2], 10) : 0;
    let startAmpm = fromToMatch[3] ? fromToMatch[3].toLowerCase() : null;

    let endH = parseInt(fromToMatch[4], 10);
    let endM = fromToMatch[5] ? parseInt(fromToMatch[5], 10) : 0;
    let endAmpm = fromToMatch[6] ? fromToMatch[6].toLowerCase() : null;

    // Inherit am/pm if one is missing but the other exists
    if (!startAmpm && endAmpm && startH < 12) {
      startAmpm = endAmpm;
    }
    if (!endAmpm && startAmpm && endH < 12) {
      endAmpm = startAmpm;
    }

    if (startAmpm === 'pm' && startH < 12) startH += 12;
    if (startAmpm === 'am' && startH === 12) startH = 0;
    if (endAmpm === 'pm' && endH < 12) endH += 12;
    if (endAmpm === 'am' && endH === 12) endH = 0;

    if (startH >= 0 && startH < 24 && startM >= 0 && startM < 60) {
      startAt.setHours(startH, startM, 0, 0);
    }
    if (endH >= 0 && endH < 24 && endM >= 0 && endM < 60) {
      endAt.setHours(endH, endM, 0, 0);
      if (endAt.getTime() < startAt.getTime()) {
        endAt.setDate(endAt.getDate() + 1);
      }
    }
    hasFromTo = true;
    cleanText = cleanText.replace(fromToRegex, ' ').trim().replace(/\s+/g, ' ');
  }

  // 3. Otherwise try discrete "at X" (e.g. "at 6pm") as startAt
  if (!hasFromTo) {
    const timeRegex = /(?:\s+|^)at\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i;
    const timeMatch = cleanText.match(timeRegex);
    if (timeMatch) {
      let h = parseInt(timeMatch[1], 10);
      let m = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
      let ampm = timeMatch[3] ? timeMatch[3].toLowerCase() : null;

      let targetHour = h;
      if (ampm === 'pm' && h < 12) {
        targetHour += 12;
      } else if (ampm === 'am' && h === 12) {
        targetHour = 0;
      }

      if (targetHour >= 0 && targetHour < 24 && m >= 0 && m < 60) {
        startAt.setHours(targetHour, m, 0, 0);
        endAt = new Date(startAt);
        endAt.setHours(startAt.getHours() + 1);
      }
      cleanText = cleanText.replace(timeRegex, ' ').trim().replace(/\s+/g, ' ');
    }
  }

  // 4. Parse duration keywords: e.g. "1h30", "45m"
  const durationRegex = /(?:\s+|^)(\d+)\s*h\s*(\d+)?\s*(?:m|min)?\b/i;
  const durationOnlyMinutesRegex = /(?:\s+|^)(\d+)\s*(?:m|min)\b/i;

  let durationMinutes = 0;
  let matchedDuration = false;

  const durMatch = cleanText.match(durationRegex);
  if (durMatch) {
    const h = parseInt(durMatch[1], 10);
    const m = durMatch[2] ? parseInt(durMatch[2], 10) : 0;
    durationMinutes = h * 60 + m;
    matchedDuration = true;
    cleanText = cleanText.replace(durationRegex, ' ').trim().replace(/\s+/g, ' ');
  } else {
    const minMatch = cleanText.match(durationOnlyMinutesRegex);
    if (minMatch) {
      durationMinutes = parseInt(minMatch[1], 10);
      matchedDuration = true;
      cleanText = cleanText.replace(durationOnlyMinutesRegex, ' ').trim().replace(/\s+/g, ' ');
    }
  }

  if (matchedDuration) {
    endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
  }

  return {
    title: cleanText.trim(),
    startAt,
    endAt,
  };
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

export default function InputBar({ activeDate, viewMode }: InputBarProps) {
  const [activeType, setActiveType] = useState<EntryType>('task');
  const [showHelp, setShowHelp] = useState(false);
  const [showTimePopup, setShowTimePopup] = useState(false);

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
      let defaultBaseDate = getBaseCompletedDate();

      const { parsedDate: dateBase, textAfterDateRemoval } = parseSmartDate(
        cleanTitle,
        defaultBaseDate,
      );
      cleanTitle = textAfterDateRemoval;

      const { parsedDate: finalDate, textAfterTimeRemoval } = parseSmartTime(cleanTitle, dateBase);
      cleanTitle = textAfterTimeRemoval;

      const finalTitle = cleanTitle || title.trim();
      if (!finalTitle) return;

      const activeListId = localStorage.getItem('flowday-tasks-selected-list');
      const autoListIds =
        viewMode === 'tasks' && activeListId && activeListId !== 'all' && activeListId !== 'none'
          ? [activeListId]
          : [];

      newEntry = {
        id: entryId,
        type: 'task',
        title: finalTitle,
        status: 'todo',
        time_spent: 0,
        created_at: getBaseCompletedDate(),
        // In 'tasks' mode, tasks are dateless (no scheduled_at) unless the user explicitly typed a date keyword
        ...(autoListIds.length > 0 ? { category_ids: autoListIds } : {}),
        ...(viewMode === 'tasks' ? {} : { scheduled_at: finalDate }),
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

      const { parsedDate: finalDate, textAfterTimeRemoval } = parseSmartTime(cleanTitle, dateBase);
      cleanTitle = textAfterTimeRemoval;

      const finalTitle = cleanTitle || title.trim();
      if (!finalTitle) return;

      newEntry = {
        id: entryId,
        type: 'log',
        title: finalTitle,
        timestamp: finalDate,
        created_at: getBaseCompletedDate(),
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

      const { parsedDate: finalDate, textAfterTimeRemoval } = parseSmartTime(cleanTitle, dateBase);
      cleanTitle = textAfterTimeRemoval;

      const finalTitle = cleanTitle || title.trim();
      if (!finalTitle) return;

      newEntry = {
        id: entryId,
        type: 'event',
        title: finalTitle,
        content: content.trim(),
        timestamp: finalDate,
        created_at: getBaseCompletedDate(),
        scheduled_at: finalDate,
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
        {/* Smart Parser Tooltip Handbooks */}
        <AnimatePresence>
          {showHelp && (
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="absolute bottom-full mb-4 left-0 right-0 bg-[#141414] border border-stone-800/90 rounded-xl p-5 shadow-2xl z-50 text-stone-300 backdrop-blur-md"
              id="smart-parser-help-tooltip"
            >
              <div className="flex items-center justify-between border-b border-stone-800 pb-2.5 mb-3">
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

              {/* Help Content */}
              <div className="space-y-3.5 font-sans text-xs">
                {activeType === 'task' && (
                  <>
                    <p className="text-stone-400 leading-relaxed">
                      Our task input scans your words dynamically for dates and times, creates the
                      timeline entry correctly, and formats the clean residual title.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="bg-[#0b0b0b]/60 border border-stone-900 rounded-lg p-3">
                        <div className="font-mono text-[9px] text-stone-500 uppercase tracking-widest mb-1.5 font-bold">
                          Time Recognition
                        </div>
                        <p className="text-stone-300 leading-relaxed">
                          Type{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-emerald-400">
                            at 3:45pm
                          </code>{' '}
                          or{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-emerald-400">
                            at 20:15
                          </code>
                          .
                        </p>
                      </div>
                      <div className="bg-[#0b0b0b]/60 border border-stone-900 rounded-lg p-3">
                        <div className="font-mono text-[9px] text-stone-500 uppercase tracking-widest mb-1.5 font-bold">
                          Date Recognition
                        </div>
                        <p className="text-stone-300 leading-relaxed">
                          Type{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-emerald-400">
                            today
                          </code>
                          ,{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-emerald-400">
                            tomorrow
                          </code>
                          ,{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-emerald-400">
                            in 3 days
                          </code>
                          , or specific date{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-emerald-400">
                            24/6
                          </code>
                          .
                        </p>
                      </div>
                    </div>
                    <div className="bg-emerald-950/15 border border-emerald-900/30 rounded-lg p-3 mt-2">
                      <span className="font-mono font-bold text-[9px] text-emerald-400 uppercase tracking-wider block mb-1">
                        Interactive Example:
                      </span>
                      <span className="font-sans text-stone-200 text-sm leading-relaxed block font-medium">
                        "Review engineering specs tomorrow at 11am"
                      </span>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-stone-400 border-t border-emerald-900/20 pt-1.5">
                        <span>
                          ✓ Clean Title:{' '}
                          <strong className="text-emerald-400">"Review engineering specs"</strong>
                        </span>
                        <span>
                          ✓ Calculated Date:{' '}
                          <strong className="text-emerald-400">Tomorrow @ 11:00 AM</strong>
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {activeType === 'log' && (
                  <>
                    <p className="text-stone-400 leading-relaxed">
                      Our log input scans your words dynamically for dates and times, creates the
                      timeline entry correctly, and formats the clean residual title.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="bg-[#0b0b0b]/60 border border-stone-900 rounded-lg p-3">
                        <div className="font-mono text-[9px] text-stone-500 uppercase tracking-widest mb-1.5 font-bold">
                          Time Recognition
                        </div>
                        <p className="text-stone-300 leading-relaxed">
                          Type{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-stone-400">
                            at 3:45pm
                          </code>{' '}
                          or{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-stone-400">
                            at 20:15
                          </code>
                          .
                        </p>
                      </div>
                      <div className="bg-[#0b0b0b]/60 border border-stone-900 rounded-lg p-3">
                        <div className="font-mono text-[9px] text-stone-500 uppercase tracking-widest mb-1.5 font-bold">
                          Date Recognition
                        </div>
                        <p className="text-stone-300 leading-relaxed">
                          Type{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-stone-400">
                            today
                          </code>
                          ,{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-stone-400">
                            tomorrow
                          </code>
                          , or specific date{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-stone-400">
                            24/6
                          </code>
                          .
                        </p>
                      </div>
                    </div>
                    <div className="bg-stone-950/15 border border-stone-900/30 rounded-lg p-3 mt-2">
                      <span className="font-mono font-bold text-[9px] text-stone-450 uppercase tracking-wider block mb-1">
                        Interactive Example:
                      </span>
                      <span className="font-sans text-stone-200 text-sm leading-relaxed block font-medium">
                        "Walking to the train station today at 2:30pm"
                      </span>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-stone-400 border-t border-stone-900/20 pt-1.5">
                        <span>
                          ✓ Clean Title:{' '}
                          <strong className="text-stone-450">"Walking to the train station"</strong>
                        </span>
                        <span>
                          ✓ Calculated Date:{' '}
                          <strong className="text-stone-450">Today @ 2:30 PM</strong>
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {activeType === 'event' && (
                  <>
                    <p className="text-stone-400 leading-relaxed">
                      Events map visual milestones or specific schedule goals. Type natural
                      dates/hours in the input to configure the schedule automatically, or click the
                      custom date-time picker!
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="bg-[#0b0b0b]/60 border border-stone-900 rounded-lg p-3">
                        <div className="font-mono text-[9px] text-stone-500 uppercase tracking-widest mb-1.5 font-bold">
                          Time Alignment
                        </div>
                        <p className="text-stone-300 leading-relaxed">
                          Add phrases like{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-amber-400">
                            at 9am
                          </code>{' '}
                          or{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-amber-400">
                            at 18:30
                          </code>
                          .
                        </p>
                      </div>
                      <div className="bg-[#0b0b0b]/60 border border-stone-900 rounded-lg p-3">
                        <div className="font-mono text-[9px] text-stone-500 uppercase tracking-widest mb-1.5 font-bold">
                          Relative Dates
                        </div>
                        <p className="text-stone-300 leading-relaxed">
                          Words like{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-amber-400">
                            today
                          </code>
                          ,{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-amber-400">
                            tomorrow
                          </code>
                          , or{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-amber-400">
                            inXdays
                          </code>{' '}
                          map instantly.
                        </p>
                      </div>
                    </div>
                    <div className="bg-amber-950/15 border border-amber-900/30 rounded-lg p-3 mt-2">
                      <span className="font-mono font-bold text-[9px] text-amber-400 uppercase tracking-wider block mb-1">
                        Interactive Example:
                      </span>
                      <span className="font-sans text-stone-200 text-sm leading-relaxed block font-medium">
                        "Sprint planning demonstration today at 3pm"
                      </span>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-stone-400 border-t border-amber-900/20 pt-1.5">
                        <span>
                          ✓ Saved Title:{' '}
                          <strong className="text-amber-400">
                            "Sprint planning demonstration"
                          </strong>
                        </span>
                        <span>
                          ✓ Date Set: <strong className="text-amber-400">Today @ 3:00 PM</strong>
                        </span>
                      </div>
                    </div>
                  </>
                )}

                {activeType === 'note' && (
                  <>
                    <p className="text-stone-400 leading-relaxed">
                      Record quick text blocks, diary logs, or logs. You can inject timestamps
                      inline via plain-text parsing or use the manual custom override below!
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="bg-[#0b0b0b]/60 border border-stone-900 rounded-lg p-3">
                        <div className="font-mono text-[9px] text-stone-500 uppercase tracking-widest mb-1.5 font-bold">
                          Chronology Override
                        </div>
                        <p className="text-stone-300 leading-relaxed">
                          Insert{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-blue-400">
                            at 10pm
                          </code>{' '}
                          or{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-blue-400">
                            at 12:45
                          </code>{' '}
                          to date of the logs of note.
                        </p>
                      </div>
                      <div className="bg-[#0b0b0b]/60 border border-stone-900 rounded-lg p-3">
                        <div className="font-mono text-[9px] text-stone-500 uppercase tracking-widest mb-1.5 font-bold">
                          Custom Dates
                        </div>
                        <p className="text-stone-300 leading-relaxed">
                          Words like{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-blue-400">
                            tomorrow
                          </code>
                          ,{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-blue-400">
                            today
                          </code>
                          , or exact dates like{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-blue-400">
                            5/6
                          </code>{' '}
                          can be parsed.
                        </p>
                      </div>
                    </div>
                  </>
                )}

                {activeType === 'time-block' && (
                  <>
                    <p className="text-stone-400 leading-relaxed">
                      Establish rich duration spans on your productivity timeline with simple
                      expressions.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <div className="bg-[#0b0b0b]/60 border border-stone-900 rounded-lg p-3">
                        <div className="font-mono text-[9px] text-stone-500 uppercase tracking-widest mb-1.5 font-bold">
                          Span Range Keyword
                        </div>
                        <p className="text-stone-300 leading-relaxed">
                          Type{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-indigo-400">
                            from 1pm to 3:30pm
                          </code>
                          .
                        </p>
                      </div>
                      <div className="bg-[#0b0b0b]/60 border border-stone-900 rounded-lg p-3">
                        <div className="font-mono text-[9px] text-stone-500 uppercase tracking-widest mb-1.5 font-bold">
                          Duration Keywords
                        </div>
                        <p className="text-stone-300 leading-relaxed">
                          Type starting time and duration:{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-indigo-400">
                            at 10am 2h30
                          </code>{' '}
                          or{' '}
                          <code className="bg-stone-900 border border-stone-800 px-1 py-0.5 rounded font-mono text-indigo-400">
                            at 5pm 45m
                          </code>
                          .
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
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
                className="bg-stone-950 border border-stone-900 p-0.5 rounded-xl flex w-full lg:w-auto"
                id="input-type-chips"
              >
                {/* TASK */}
                <button
                  type="button"
                  id="chip-task"
                  onClick={() => setActiveType('task')}
                  className={`flex-1 lg:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
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
                  className={`flex-1 lg:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
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
                  className={`flex-1 lg:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
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
                  className={`flex-1 lg:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
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
                  className={`flex-1 lg:flex-initial flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                    activeType === 'time-block'
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-md font-extrabold'
                      : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900/50 border border-transparent'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Block</span>
                </button>
              </div>

              {/* Combined Trigger Button Next to tab selector */}
              {activeType !== 'task' && (
                <div
                  className="max-sm:hidden relative inline-block z-40"
                  id="manual-time-popup-trigger-container"
                >
                  <button
                    type="button"
                    onClick={() => setShowTimePopup(!showTimePopup)}
                    className={`flex items-center justify-center p-2 bg-[#0e0e0e] border rounded-xl text-xs font-mono font-medium transition-all duration-200 cursor-pointer ${
                      showTimePopup
                        ? 'text-white border-stone-700 bg-stone-900 shadow-md ring-1 ring-stone-800'
                        : 'text-stone-300 border-stone-850 hover:text-white hover:bg-stone-900/40'
                    }`}
                    style={{
                      borderColor: showTimePopup
                        ? activeType === 'log'
                          ? '#a8a29e'
                          : activeType === 'event'
                            ? '#f59e0b'
                            : activeType === 'note'
                              ? '#3b82f6'
                              : '#6366f1'
                        : undefined,
                    }}
                    title={`Configure ${activeType} time settings manually`}
                  >
                    <Clock
                      className={`w-4 h-4 ${
                        activeType === 'log'
                          ? 'text-stone-400'
                          : activeType === 'event'
                            ? 'text-amber-400'
                            : activeType === 'note'
                              ? 'text-blue-400'
                              : 'text-indigo-400'
                      }`}
                    />
                  </button>

                  <AnimatePresence>
                    {showTimePopup && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.12, ease: 'easeOut' }}
                        className="absolute bottom-full mb-3 left-0 bg-[#161616] border border-stone-800 rounded-xl p-4 shadow-2xl z-[999] w-72 backdrop-blur-md"
                        id="time-setting-popup"
                      >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-stone-800 pb-2 mb-3">
                          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-stone-400">
                            Adjust Time Configuration
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowTimePopup(false)}
                            className="p-1 hover:bg-stone-800 rounded text-stone-500 hover:text-stone-300 transition-colors cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Config fields */}
                        <div className="space-y-3">
                          {activeType === 'log' && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <CircleDot className="w-3.5 h-3.5 text-stone-400" />
                                <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest font-bold">
                                  Log Time Details
                                </span>
                              </div>
                              <input
                                id="input-log-time"
                                type="datetime-local"
                                required
                                value={timestampStr}
                                onChange={(e) => {
                                  setTimestampStr(e.target.value);
                                  setTimeManuallySet(true);
                                }}
                              />
                            </div>
                          )}

                          {activeType === 'event' && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                                <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest font-bold">
                                  Event Details
                                </span>
                              </div>
                              <input
                                id="input-event-time"
                                type="datetime-local"
                                required
                                value={timestampStr}
                                onChange={(e) => {
                                  setTimestampStr(e.target.value);
                                  setTimeManuallySet(true);
                                }}
                              />
                            </div>
                          )}

                          {activeType === 'note' && (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1.5">
                                <FileText className="w-3.5 h-3.5 text-blue-400" />
                                <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest font-bold">
                                  Timestamp Details
                                </span>
                              </div>
                              <input
                                id="input-note-time"
                                type="datetime-local"
                                required
                                value={timestampStr}
                                onChange={(e) => {
                                  setTimestampStr(e.target.value);
                                  setTimeManuallySet(true);
                                }}
                              />
                            </div>
                          )}

                          {activeType === 'time-block' && (
                            <div className="space-y-3">
                              {/* Start Time with green icon */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-emerald-400" />
                                  <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest font-bold">
                                    Start Frame
                                  </span>
                                </div>
                                <input
                                  id="input-timeblock-start"
                                  type="datetime-local"
                                  required
                                  value={startAtStr}
                                  onChange={(e) => setStartAtStr(e.target.value)}
                                  className="w-full bg-[#0b0b0b] hover:bg-stone-900 text-stone-200 border border-stone-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500/40 font-mono cursor-pointer transition-colors"
                                />
                              </div>

                              {/* End Time with indigo icon */}
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-1.5">
                                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                                  <span className="text-[10px] font-mono text-stone-500 uppercase tracking-widest font-bold">
                                    End Frame
                                  </span>
                                </div>
                                <input
                                  id="input-timeblock-end"
                                  type="datetime-local"
                                  required
                                  value={endAtStr}
                                  onChange={(e) => setEndAtStr(e.target.value)}
                                  className="w-full bg-[#0b0b0b] hover:bg-stone-900 text-stone-200 border border-stone-800 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500/40 font-mono cursor-pointer transition-colors"
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Done Action Button inside Popup */}
                        <div className="border-t border-stone-800 mt-3 pt-2.5 flex justify-end">
                          <button
                            type="button"
                            onClick={() => setShowTimePopup(false)}
                            className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
                          >
                            Done
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Smart Hints / Config Panel Tips */}
            <div className="max-sm:hidden flex items-center justify-between lg:justify-end gap-3 self-stretch lg:self-auto">
              <div className="flex items-center gap-2">
                {activeType === 'task' && (
                  <span className="text-[10px] font-mono font-semibold text-emerald-400 bg-emerald-950/15 border border-emerald-950 px-2 py-0.5 rounded-md">
                    Parser Enabled
                  </span>
                )}
                {activeType === 'log' && (
                  <span className="text-[10px] font-mono font-semibold text-stone-400 bg-stone-950/15 border border-stone-950 px-2 py-0.5 rounded-md">
                    Parser Enabled
                  </span>
                )}
                {activeType === 'event' && (
                  <span className="text-[10px] font-mono font-semibold text-amber-400 bg-amber-950/15 border border-amber-950 px-2 py-0.5 rounded-md">
                    Implicit Schedule Active
                  </span>
                )}
                {activeType === 'note' && (
                  <span className="text-[10px] font-mono font-semibold text-blue-400 bg-blue-950/15 border border-blue-950 px-2 py-0.5 rounded-md">
                    Time Override Active
                  </span>
                )}
                {activeType === 'time-block' && (
                  <span className="text-[10px] font-mono font-semibold text-indigo-400 bg-indigo-950/15 border border-indigo-950 px-2 py-0.5 rounded-md">
                    Duration Span Active
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowHelp(!showHelp)}
                className={`py-1 px-2.5 rounded-lg text-xs font-mono transition-all cursor-pointer flex items-center gap-1.5 ${
                  showHelp
                    ? 'bg-stone-800 text-stone-200 border border-stone-700'
                    : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900/50 border border-transparent'
                }`}
                title="Review parser syntax hints"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>Format Tips</span>
              </button>
            </div>
          </div>

          {/* Form Interactive Layout with STABLE Static Area Height */}
          <form onSubmit={handleSubmit} className="w-full h-[46px]" id="timeline-input-form">
            {/* INPUT FIELDS ACCORDING TO STATE TYPE */}
            <div className="w-full h-full">
              {/* TASK INJECT */}
              {activeType === 'task' && (
                <div className="relative w-full flex gap-3.5 items-stretch h-full">
                  <div className="relative flex-1">
                    <input
                      id="input-task-title"
                      type="text"
                      required
                      maxLength={100}
                      placeholder="Capture real-time task (e.g. Code database schema at 4:30pm tomorrow)..."
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      onKeyDown={handleKeyPress}
                      className="w-full h-full bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/50 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none focus:border-emerald-500/50 focus:bg-stone-950 transition-all shadow-inner"
                    />
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none select-none text-[10px] font-mono text-stone-600 tracking-wider hidden md:block">
                      [ENTER] TO SAVE
                    </div>
                  </div>
                  <button
                    type="submit"
                    className="max-sm:hidden px-6 bg-emerald-500 text-[#070e0a] hover:bg-emerald-400 border border-emerald-400 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-250 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <span>Save Entry</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* LOG INJECT */}
              {activeType === 'log' && (
                <div className="relative w-full flex gap-3.5 items-stretch h-full">
                  <input
                    id="input-log-title"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="Describe what you are doing at the moment (e.g. Walking to the train station)..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1 bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/50 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none focus:border-stone-500/50 focus:bg-stone-950 transition-all shadow-inner"
                  />
                  <button
                    type="submit"
                    className="max-sm:hidden px-6 bg-stone-850 text-stone-300 hover:bg-stone-800 border border-stone-700 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-250 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <span>Save Log</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* EVENT INJECT */}
              {activeType === 'event' && (
                <div className="relative w-full flex gap-3.5 items-stretch h-full">
                  <button
                    type="button"
                    onClick={() => {
                      setModalTitle(title);
                      setModalContent('');
                      setIsNoteModalOpen(true);
                    }}
                    className="flex items-center justify-center px-4 bg-stone-950 border border-stone-850 hover:border-stone-750 text-amber-400 hover:text-amber-300 rounded-xl transition-all hover:bg-stone-900 cursor-pointer"
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
                  <input
                    id="input-event-title"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="Event title details (e.g. Project briefing presentation tomorrow at 10am)..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1 bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/55 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500/50 focus:bg-stone-950 transition-all shadow-inner"
                  />
                  <button
                    type="submit"
                    className="max-sm:hidden px-6 bg-amber-500 text-[#0e0c08] hover:bg-amber-400 border border-amber-400 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-250 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <span>Save Entry</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* NOTE INJECT */}
              {activeType === 'note' && (
                <div className="relative w-full flex gap-3.5 items-stretch h-full">
                  <button
                    type="button"
                    onClick={() => {
                      setModalTitle(title);
                      setModalContent('');
                      setIsNoteModalOpen(true);
                    }}
                    className="flex items-center justify-center px-4 bg-stone-950 border border-stone-850 hover:border-stone-750 text-blue-400 hover:text-blue-300 rounded-xl transition-all hover:bg-stone-900 cursor-pointer"
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
                  <input
                    id="input-note-title"
                    type="text"
                    required
                    placeholder="Enter note title (e.g. Brainstorming session today)..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1 bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/60 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none focus:border-blue-500/50 focus:bg-stone-950 transition-all shadow-inner"
                  />
                  <button
                    type="submit"
                    className="max-sm:hidden px-6 bg-blue-500 text-[#070a0e] hover:bg-blue-400 border border-blue-400 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-250 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <span>Save Entry</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* TIME BLOCK INJECT */}
              {activeType === 'time-block' && (
                <div className="relative w-full flex gap-3.5 items-stretch h-full">
                  <input
                    id="input-timeblock-title"
                    type="text"
                    required
                    maxLength={100}
                    placeholder="Focus time block name (e.g. Deep Work blocks from 3pm to 5pm or at 9am 1h30)..."
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    onKeyDown={handleKeyPress}
                    className="flex-1 bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/50 border border-stone-850 rounded-xl px-4 py-3 text-sm placeholder-stone-600 focus:outline-none focus:border-indigo-500/50 focus:bg-stone-950 transition-all shadow-inner"
                  />
                  <button
                    type="submit"
                    className="max-sm:hidden px-6 bg-indigo-500 text-[#07070e] hover:bg-indigo-400 border border-indigo-400 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all duration-250 active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer"
                  >
                    <span>Save Entry</span>
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

                  const { parsedDate: finalDate, textAfterTimeRemoval } = parseSmartTime(
                    cleanTitle,
                    dateBase,
                  );
                  cleanTitle = textAfterTimeRemoval;

                  const finalTitle = cleanTitle || modalTitle.trim();

                  const newEntry = {
                    id: entryId,
                    type: (activeType === 'event' ? 'event' : 'note') as 'event' | 'note',
                    title: finalTitle,
                    content: modalContent.trim(),
                    timestamp: finalDate,
                    created_at: getBaseCompletedDate(),
                    scheduled_at: finalDate,
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
