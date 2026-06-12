/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState } from 'react';
import DayTimeline, { RenderItem } from './DayTimeline';
import { TimelineEntry, Task } from '../../types';
import { Calendar, ArrowDown } from 'lucide-react';
import { toLocalDateString } from '../../utils';

interface TimelineViewProps {
  sortedTimelineDays: string[];
  timelineDaysMap: { [key: string]: TimelineEntry[] };
  getDayRenderItems: (dayEntries: TimelineEntry[]) => RenderItem[];
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
  handleRevertCarry: (taskId: string) => void;
  formatTime: (dateInput: Date | string) => string;
  formatDateStringLabel: (dayStr: string) => string;
  onTimePickerConfirm: (entry: TimelineEntry, newDate: Date) => void;
}

export default function TimelineView({
  sortedTimelineDays,
  timelineDaysMap,
  getDayRenderItems,
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
  handleRevertCarry,
  formatTime,
  formatDateStringLabel,
  onTimePickerConfirm,
}: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showJumpToday, setShowJumpToday] = useState(false);
  const todayStr = toLocalDateString(new Date());

  // Show jump-to-today button when today's block is not in the viewport
  useEffect(() => {
    if (!sortedTimelineDays.includes(todayStr)) {
      setShowJumpToday(true);
      return;
    }

    const handleScroll = () => {
      const todayEl = document.getElementById(`spine-day-${todayStr}`);
      if (!todayEl) {
        setShowJumpToday(true);
        return;
      }
      const rect = todayEl.getBoundingClientRect();
      // Show button if today's header is above the viewport or scrolled out
      setShowJumpToday(rect.bottom < 0 || rect.top > window.innerHeight);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sortedTimelineDays, todayStr]);

  if (sortedTimelineDays.length > 0) {
    return (
      <div className="space-y-0" ref={containerRef}>
        {sortedTimelineDays.map((dayStr) => {
          const dayEntries = timelineDaysMap[dayStr];
          const dayItems = getDayRenderItems(dayEntries);
          return (
            <DayTimeline
              key={dayStr}
              items={dayItems}
              labelString={dayStr}
              isFromTimelineView={true}
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
              handleRevertCarry={handleRevertCarry}
              formatTime={formatTime}
              formatDateStringLabel={formatDateStringLabel}
              onTimePickerConfirm={onTimePickerConfirm}
            />
          );
        })}

        {/* Jump-to-today floating button */}
        {showJumpToday && (
          <button
            onClick={() => {
              const todayEl = document.getElementById(`spine-day-${todayStr}`);
              if (todayEl) {
                todayEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
              } else {
                setActiveDate(new Date());
                setTimeout(() => {
                  const el = document.getElementById(`spine-day-${todayStr}`);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
              }
            }}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-amber-500/15 border border-amber-500/40 hover:bg-amber-500/25 hover:border-amber-500/60 text-amber-400 hover:text-amber-300 rounded-full text-[11px] font-mono font-bold uppercase tracking-wider transition-all duration-200 shadow-lg shadow-amber-500/5 cursor-pointer active:scale-95"
            title="Jump to today"
          >
            <ArrowDown className="w-3.5 h-3.5" />
            <span>Today</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="py-24 text-center text-stone-500 select-none">
      <Calendar className="w-12 h-12 text-stone-800 mx-auto mb-4" />
      <h4 className="font-sans font-medium text-sm text-stone-400 mb-1">
        Your timeline is completely empty
      </h4>
      <p className="text-xs font-sans max-w-md mx-auto leading-relaxed text-stone-500">
        Start capturing entries using the input engine below. Switch back to "Day View" to log your
        tasks and build an offline productivity timeline easily.
      </p>
    </div>
  );
}
