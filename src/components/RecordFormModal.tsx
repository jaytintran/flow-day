/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  FileText,
  Calendar,
  Pin,
  Star,
  Clock,
  Sparkles,
  Send,
  Check,
  ChevronDown,
  RotateCcw,
  Hash,
} from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { TimelineEntry, Category } from '../types';
import { RECORD_CATEGORY_SCOPE, formatDuration } from '../utils';
import { parseSmartDate, parseSmartTimeSpan } from '../lib/parser';
import DetailSheet from './DetailSheet';
import CategoryIcon, { getCategoryColor } from './CategoryIcon';
import MarkdownPreview from './MarkdownPreview';

// Identical to category color styles in RecordsView for visual cohesion
const RECORD_CAT_COLORS: Record<string, { active: string; dot: string; text: string }> = {
  violet: {
    active: 'bg-violet-500/15 border-violet-500/40 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.15)]',
    dot: 'bg-violet-500',
    text: 'text-violet-400',
  },
  emerald: {
    active: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]',
    dot: 'bg-emerald-500',
    text: 'text-emerald-400',
  },
  sky: {
    active: 'bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.15)]',
    dot: 'bg-sky-500',
    text: 'text-sky-400',
  },
  rose: {
    active: 'bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]',
    dot: 'bg-rose-500',
    text: 'text-rose-400',
  },
  amber: {
    active: 'bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]',
    dot: 'bg-amber-500',
    text: 'text-amber-400',
  },
  teal: {
    active: 'bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.15)]',
    dot: 'bg-teal-500',
    text: 'text-teal-400',
  },
  indigo: {
    active: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]',
    dot: 'bg-indigo-500',
    text: 'text-indigo-400',
  },
  orange: {
    active: 'bg-orange-500/15 border-orange-500/40 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.15)]',
    dot: 'bg-orange-500',
    text: 'text-orange-400',
  },
};

function toLocalISOString(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatBadgeDateTime(date: Date, endDate?: Date | null, isEvent?: boolean): string {
  const now = new Date();
  const isToday = now.toDateString() === date.toDateString();
  const dTomorrow = new Date();
  dTomorrow.setDate(dTomorrow.getDate() + 1);
  const isTomorrow = dTomorrow.toDateString() === date.toDateString();

  const dayStr = isToday
    ? 'Today'
    : isTomorrow
      ? 'Tomorrow'
      : date.toLocaleDateString([], { month: 'short', day: 'numeric' });

  const timeStr = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (isEvent && endDate) {
    const isSameDayEnd = date.toDateString() === endDate.toDateString();
    const endTimeStr = endDate.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (isSameDayEnd) {
      return `${dayStr}, ${timeStr} – ${endTimeStr}`;
    }
    const endDayStr = endDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
    return `${dayStr} ${timeStr} – ${endDayStr} ${endTimeStr}`;
  }
  return `${dayStr} @ ${timeStr}`;
}

export interface RecordFormModalProps {
  open: boolean;
  onClose: () => void;
  initialType?: 'event' | 'note';
  initialTitle?: string;
  initialContent?: string;
  initialDate?: Date;
  initialCategoryIds?: string[];
  initialPinned?: boolean;
  initialStarred?: boolean;
  onSaved?: (entry: TimelineEntry) => void;
}

export default function RecordFormModal({
  open,
  onClose,
  initialType = 'note',
  initialTitle = '',
  initialContent = '',
  initialDate,
  initialCategoryIds,
  initialPinned = false,
  initialStarred = false,
  onSaved,
}: RecordFormModalProps) {
  // Form states
  const [modalType, setModalType] = useState<'event' | 'note'>(initialType);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [pinned, setPinned] = useState(initialPinned);
  const [starred, setStarred] = useState(initialStarred);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(initialCategoryIds || []);

  // Time & Date picker states
  const [baseDate, setBaseDate] = useState<Date>(initialDate ? new Date(initialDate) : new Date());
  const [isManualTime, setIsManualTime] = useState(false);
  const [manualStartStr, setManualStartStr] = useState('');
  const [manualEndStr, setManualEndStr] = useState('');
  const [showTimeDropdown, setShowTimeDropdown] = useState(false);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const prevOpenRef = useRef(false);

  // Live Query Categories for Records View
  const categories =
    useLiveQuery(
      () =>
        db.categories.where('scope').equals(RECORD_CATEGORY_SCOPE).sortBy('sort_order'),
      [],
    ) || [];

  // Reset/sync state ONLY when modal transitions from closed to open
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setModalType(initialType);
      setTitle(initialTitle || '');
      setContent(initialContent || '');
      setPinned(initialPinned);
      setStarred(initialStarred);
      setSelectedCategoryIds(initialCategoryIds ? [...initialCategoryIds] : []);

      const b = initialDate ? new Date(initialDate) : new Date();
      setBaseDate(b);

      const startISO = toLocalISOString(b);
      setManualStartStr(startISO);

      const endDefault = new Date(b);
      endDefault.setHours(endDefault.getHours() + 1);
      setManualEndStr(toLocalISOString(endDefault));

      setIsManualTime(false);
      setShowTimeDropdown(false);

      // Focus title input on opening
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
    prevOpenRef.current = open;
  }, [open]);

  // Live NLP Date & Time Parsing on Title
  const parsedNLP = useMemo(() => {
    const clean = title.trim();
    if (!clean) {
      return {
        cleanTitle: '',
        parsedStart: baseDate,
        parsedEnd: null as Date | null,
        hasDetectedDate: false,
        hasTime: false,
        hasSpan: false,
        dateStr: null as string | null,
        spanStr: null as string | null,
        durationStr: null as string | null,
      };
    }

    const { parsedDate: dateBase, textAfterDateRemoval } = parseSmartDate(clean, baseDate);
    const hasDetectedDate = dateBase.toDateString() !== baseDate.toDateString();

    const { parsedStart, parsedEnd, hasSpan, hasTime, textAfterTimeRemoval } =
      parseSmartTimeSpan(textAfterDateRemoval, dateBase);

    const durMs = hasSpan && parsedEnd ? parsedEnd.getTime() - parsedStart.getTime() : null;

    const dateStr = hasDetectedDate
      ? dateBase.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
      : null;

    const formatTimeOnly = (d: Date) =>
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

    const spanStr =
      hasSpan && parsedEnd
        ? `${formatTimeOnly(parsedStart)} – ${formatTimeOnly(parsedEnd)}`
        : hasTime
          ? formatTimeOnly(parsedStart)
          : null;

    return {
      cleanTitle: textAfterTimeRemoval || textAfterDateRemoval || clean,
      parsedStart,
      parsedEnd,
      hasDetectedDate,
      hasTime,
      hasSpan,
      dateStr,
      spanStr,
      durationStr: durMs ? formatDuration(durMs) : null,
    };
  }, [title, baseDate]);

  // Hashtag Category Quick-Selection (#category) - Safe functional updater without dependency loop
  useEffect(() => {
    if (!categories || categories.length === 0) return;
    const combined = `${title} ${content}`;
    const tagMatches = combined.match(/#([a-zA-Z0-9_\u00C0-\u024F\u1EA0-\u1EF9-]+)/g);
    if (!tagMatches) return;

    setSelectedCategoryIds((prev) => {
      const newIds: string[] = [];
      for (const tagWithHash of tagMatches) {
        const cleanTag = tagWithHash.slice(1).toLowerCase().replace(/[-_]/g, '');
        const foundCat = categories.find((c) => {
          const cName = c.name.toLowerCase().replace(/[\s-_]/g, '');
          return cName === cleanTag;
        });
        if (foundCat && !prev.includes(foundCat.id) && !newIds.includes(foundCat.id)) {
          newIds.push(foundCat.id);
        }
      }
      return newIds.length > 0 ? [...prev, ...newIds] : prev;
    });
  }, [title, content, categories]);

  // Resolved final start and end timestamps (Manual vs NLP)
  const resolvedStart = useMemo(() => {
    if (isManualTime && manualStartStr) {
      return new Date(manualStartStr);
    }
    return parsedNLP.parsedStart;
  }, [isManualTime, manualStartStr, parsedNLP.parsedStart]);

  const resolvedEnd = useMemo(() => {
    if (modalType !== 'event') return null;
    if (isManualTime && manualEndStr) {
      return new Date(manualEndStr);
    }
    if (parsedNLP.hasSpan && parsedNLP.parsedEnd) {
      return parsedNLP.parsedEnd;
    }
    // Default 1 hour end for event
    const def = new Date(resolvedStart);
    def.setHours(def.getHours() + 1);
    return def;
  }, [modalType, isManualTime, manualEndStr, parsedNLP.hasSpan, parsedNLP.parsedEnd, resolvedStart]);

  // Quick preset handlers for time badge popover
  const handleSetQuickPreset = (preset: 'today' | 'tomorrow' | 'plus1h' | 'now') => {
    const now = new Date();
    const updated = new Date(resolvedStart);

    if (preset === 'today') {
      updated.setFullYear(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (preset === 'tomorrow') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      updated.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
    } else if (preset === 'plus1h') {
      updated.setHours(updated.getHours() + 1);
    } else if (preset === 'now') {
      updated.setTime(now.getTime());
    }

    setManualStartStr(toLocalISOString(updated));
    const nextEnd = new Date(updated);
    nextEnd.setHours(nextEnd.getHours() + 1);
    setManualEndStr(toLocalISOString(nextEnd));
    setIsManualTime(true);
  };

  // Toggle category assignment
  const handleToggleCategory = (catId: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId],
    );
  };

  // Save handler
  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    const entryId = crypto.randomUUID();
    const finalTitle = parsedNLP.cleanTitle || trimmedTitle;

    const newEntry: TimelineEntry = {
      id: entryId,
      type: modalType,
      title: finalTitle,
      content: content.trim(),
      timestamp: resolvedStart,
      created_at: new Date(),
      scheduled_at: resolvedStart,
      pinned,
      starred,
      ...(modalType === 'event' && resolvedEnd ? { end_timestamp: resolvedEnd } : {}),
      ...(selectedCategoryIds.length > 0 ? { category_ids: selectedCategoryIds } : {}),
    };

    await db.entries.add(newEntry);
    if (onSaved) {
      onSaved(newEntry);
    }
    onClose();
  };

  // Keyboard shortcut: Ctrl+Enter or Cmd+Enter to save
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <DetailSheet
      open={open}
      onClose={onClose}
      fullScreen={true}
      disableDrag={true}
      showMaximizeToggle={false}
      headerContent={
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          {/* Seamless Note / Event Switcher Pill */}
          <div className="flex items-center bg-[#1c1c1c] border border-stone-800 rounded-xl p-0.5 shadow-inner">
            <button
              type="button"
              onClick={() => setModalType('note')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                modalType === 'note'
                  ? 'bg-blue-500/20 text-blue-300 border border-blue-500/35 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              <span>Note</span>
            </button>
            <button
              type="button"
              onClick={() => setModalType('event')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
                modalType === 'event'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35 shadow-sm'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>Event</span>
            </button>
          </div>

          {/* Pin Toggle */}
          <button
            type="button"
            onClick={() => setPinned(!pinned)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
              pinned
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-semibold'
                : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'
            }`}
            title="Pin this record"
          >
            <Pin className={`w-3.5 h-3.5 ${pinned ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">{pinned ? 'Pinned' : 'Pin'}</span>
          </button>

          {/* Star / Highlight Toggle */}
          <button
            type="button"
            onClick={() => setStarred(!starred)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all cursor-pointer border ${
              starred
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400 font-semibold'
                : 'bg-stone-900 border-stone-800 text-stone-500 hover:text-stone-300'
            }`}
            title="Highlight as a key record"
          >
            <Star className={`w-3.5 h-3.5 ${starred ? 'fill-current' : ''}`} />
            <span className="hidden sm:inline">{starred ? 'Highlighted' : 'Highlight'}</span>
          </button>
        </div>
      }
    >
      {/* Form Content */}
      <form
        onSubmit={handleSave}
        onKeyDown={handleKeyDown}
        className="flex-1 flex flex-col min-h-0 space-y-4"
      >
        {/* Title Input & Sub-strip */}
        <div className="space-y-2 shrink-0 border-b border-stone-850/80 pb-3">
          <input
            ref={titleInputRef}
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`w-full bg-transparent text-stone-100 text-xl sm:text-2xl font-serif font-bold tracking-tight focus:outline-none placeholder-stone-700 py-1 transition-colors ${
              modalType === 'event' ? 'focus:border-amber-500/40' : 'focus:border-blue-500/40'
            }`}
            placeholder={
              modalType === 'event'
                ? 'Event title (e.g. Design review tomorrow at 3pm)...'
                : 'Note title (e.g. Product vision & thoughts #ideas)...'
            }
          />

          {/* Sub-strip: Live NLP Chips + Interactive Time Badge */}
          <div className="flex items-center justify-between gap-2 flex-wrap text-xs font-mono">
            {/* Live NLP detected chips */}
            <div className="flex items-center gap-1.5 flex-wrap min-h-[24px]">
              {(parsedNLP.dateStr || parsedNLP.spanStr || parsedNLP.durationStr) && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-stone-500 uppercase tracking-wider font-bold flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                    Detected:
                  </span>
                  {parsedNLP.dateStr && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-950/50 border border-sky-800/60 text-sky-400 text-[11px]">
                      <Calendar className="w-3 h-3" />
                      <span>{parsedNLP.dateStr}</span>
                    </span>
                  )}
                  {parsedNLP.spanStr && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-950/50 border border-indigo-800/60 text-indigo-300 text-[11px]">
                      <Clock className="w-3 h-3" />
                      <span>{parsedNLP.spanStr}</span>
                    </span>
                  )}
                  {parsedNLP.durationStr && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-950/50 border border-amber-800/60 text-amber-400 text-[11px]">
                      <span>⏳ {parsedNLP.durationStr}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Interactive Scheduled Date/Time Badge */}
            <div className="relative inline-block ml-auto">
              <button
                type="button"
                onClick={() => setShowTimeDropdown(!showTimeDropdown)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-medium border transition-all cursor-pointer ${
                  isManualTime
                    ? 'bg-amber-500/10 border-amber-500/40 text-amber-300 hover:bg-amber-500/20'
                    : 'bg-stone-900/80 border-stone-800 text-stone-300 hover:text-stone-100 hover:border-stone-700'
                }`}
                title="Click to manually adjust date and scheduled time"
              >
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                <span>{formatBadgeDateTime(resolvedStart, resolvedEnd, modalType === 'event')}</span>
                {isManualTime && (
                  <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-amber-500/25 text-amber-300 font-bold">
                    Manual
                  </span>
                )}
                <ChevronDown className="w-3 h-3 text-stone-500" />
              </button>

              {/* Compact Time/Date Popover */}
              <AnimatePresence>
                {showTimeDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-2 w-80 bg-[#161616] border border-stone-800 rounded-xl p-3.5 shadow-2xl z-50 space-y-3 backdrop-blur-xl"
                  >
                    <div className="flex items-center justify-between border-b border-stone-800 pb-2">
                      <span className="text-[10px] font-mono uppercase font-bold tracking-wider text-stone-400">
                        {modalType === 'event' ? 'Event Schedule' : 'Note Timestamp'}
                      </span>
                      {isManualTime && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsManualTime(false);
                            setShowTimeDropdown(false);
                          }}
                          className="text-[10px] font-mono text-stone-400 hover:text-amber-400 flex items-center gap-1 cursor-pointer"
                          title="Revert back to NLP parsed time"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Auto NLP</span>
                        </button>
                      )}
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSetQuickPreset('today')}
                        className="px-2 py-1 bg-stone-900 hover:bg-stone-800 border border-stone-800 rounded text-[10px] font-mono text-stone-300 cursor-pointer text-center"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetQuickPreset('tomorrow')}
                        className="px-2 py-1 bg-stone-900 hover:bg-stone-800 border border-stone-800 rounded text-[10px] font-mono text-stone-300 cursor-pointer text-center"
                      >
                        Tomorrow
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetQuickPreset('plus1h')}
                        className="px-2 py-1 bg-stone-900 hover:bg-stone-800 border border-stone-800 rounded text-[10px] font-mono text-stone-300 cursor-pointer text-center"
                      >
                        +1 Hour
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSetQuickPreset('now')}
                        className="px-2 py-1 bg-stone-900 hover:bg-stone-800 border border-stone-800 rounded text-[10px] font-mono text-stone-300 cursor-pointer text-center"
                      >
                        Now
                      </button>
                    </div>

                    {/* Datetime inputs */}
                    <div className="space-y-2 pt-1 border-t border-stone-850">
                      <div className="space-y-1">
                        <span className="text-[9px] font-mono uppercase text-stone-500 font-bold block">
                          {modalType === 'event' ? 'Starts At' : 'Timestamp'}
                        </span>
                        <input
                          type="datetime-local"
                          value={manualStartStr}
                          onChange={(e) => {
                            setManualStartStr(e.target.value);
                            setIsManualTime(true);
                          }}
                          className="w-full bg-[#0d0d0d] text-stone-200 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500/50 cursor-pointer"
                        />
                      </div>

                      {modalType === 'event' && (
                        <div className="space-y-1">
                          <span className="text-[9px] font-mono uppercase text-stone-500 font-bold block">
                            Ends At
                          </span>
                          <input
                            type="datetime-local"
                            value={manualEndStr}
                            onChange={(e) => {
                              setManualEndStr(e.target.value);
                              setIsManualTime(true);
                            }}
                            className="w-full bg-[#0d0d0d] text-stone-200 border border-stone-800 rounded-lg px-2.5 py-1.5 text-xs font-mono focus:outline-none focus:border-amber-500/50 cursor-pointer"
                          />
                        </div>
                      )}
                    </div>

                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setShowTimeDropdown(false)}
                        className="px-3 py-1 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded text-[10px] font-mono font-bold uppercase tracking-wider cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Category Selector Strip */}
        <div className="shrink-0 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500 font-bold flex items-center gap-1 shrink-0">
            <Hash className="w-3 h-3 text-stone-500" />
            Categories:
          </span>

          {categories.length === 0 ? (
            <span className="text-[11px] font-mono text-stone-600 italic">
              No record categories yet (create them in Records view)
            </span>
          ) : (
            <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto max-w-full py-0.5">
              {categories.map((cat) => {
                const isAssigned = selectedCategoryIds.includes(cat.id);
                const cs = RECORD_CAT_COLORS[cat.color] ?? RECORD_CAT_COLORS.violet;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleToggleCategory(cat.id)}
                    className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                      isAssigned
                        ? `${cs.active} font-bold shadow-sm`
                        : 'bg-stone-900/50 border-stone-800 text-stone-400 hover:text-stone-200 hover:border-stone-700'
                    }`}
                  >
                    <CategoryIcon
                      name={cat.icon}
                      color={cat.color}
                      className="w-3 h-3"
                      fallback="Tag"
                    />
                    <span>{cat.name}</span>
                    {isAssigned && <Check className="w-3 h-3 stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Markdown Body Content */}
        <div className="flex-1 flex flex-col min-h-[260px] overflow-hidden space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-mono text-stone-500 font-bold block">
              {modalType === 'event' ? 'Event Description / Agenda' : 'Content & Markdown Notes'}
            </span>
            <span className="text-[10px] font-mono text-stone-600 hidden sm:inline">
              Type #tag to auto-assign category
            </span>
          </div>

          <div className="flex-1 flex flex-col min-h-0 bg-[#0c0c0c] border border-stone-850 rounded-xl p-3 overflow-y-auto">
            <MarkdownPreview
              text={content}
              value={content}
              placeholder={
                modalType === 'event'
                  ? 'Write event agenda, meeting link, attendees, checklist, or location...'
                  : 'Write structured notes, ideas, reflections, checklists, or markdown thoughts...'
              }
              editable={true}
              onChange={setContent}
            />
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="pt-3 border-t border-stone-850/90 flex items-center justify-between shrink-0">
          <span className="text-[10px] text-stone-600 font-mono hidden sm:inline">
            Ctrl+Enter to save
          </span>

          <div className="flex items-center gap-2.5 ml-auto w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-850 text-stone-300 text-xs font-mono uppercase tracking-wider rounded-xl border border-stone-800 transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className={`px-5 py-2 text-xs font-mono font-bold uppercase tracking-wider rounded-xl border transition-all shadow-md active:scale-95 cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed ${
                modalType === 'event'
                  ? 'bg-amber-500 hover:bg-amber-400 text-[#0e0c08] border-amber-400 shadow-amber-500/10'
                  : 'bg-blue-500 hover:bg-blue-400 text-[#070a0e] border-blue-400 shadow-blue-500/10'
              }`}
            >
              <span>{modalType === 'event' ? 'Save Event' : 'Save Note'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </form>
    </DetailSheet>
  );
}
