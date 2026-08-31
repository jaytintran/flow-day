/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useEffect, useState, useMemo } from 'react';
import DayTimeline, { RenderItem } from './DayTimeline';
import { TimelineEntry, Task } from '../../types';
import {
  Calendar,
  ArrowDown,
  CircleDashed,
  CheckCircle2,
  ListFilter,
  ArrowUpDown,
  Layers,
  Clock,
  FileText,
  Activity,
  CalendarDays,
  Clock3,
} from 'lucide-react';
import { toLocalDateString } from '../../utils';

type StatusFilter = 'all' | 'pending' | 'done';
type TypeFilter = 'all' | 'task' | 'log' | 'note' | 'event' | 'time-block';
type SortOrder = 'time' | 'status_first';

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
  formatTime,
  formatDateStringLabel,
  onTimePickerConfirm,
}: TimelineViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [showJumpToday, setShowJumpToday] = useState(false);
  const todayStr = toLocalDateString(new Date());

  // Filter and Sort states with persistent localStorage
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    try {
      return (localStorage.getItem('flowday_timeline_status_filter') as StatusFilter) || 'all';
    } catch {
      return 'all';
    }
  });

  const [typeFilter, setTypeFilter] = useState<TypeFilter>(() => {
    try {
      return (localStorage.getItem('flowday_timeline_type_filter') as TypeFilter) || 'all';
    } catch {
      return 'all';
    }
  });

  const [sortOrder, setSortOrder] = useState<SortOrder>(() => {
    try {
      return (localStorage.getItem('flowday_timeline_sort_order') as SortOrder) || 'time';
    } catch {
      return 'time';
    }
  });

  const handleStatusFilterChange = (status: StatusFilter) => {
    setStatusFilter(status);
    try {
      localStorage.setItem('flowday_timeline_status_filter', status);
    } catch {}
  };

  const handleTypeFilterChange = (type: TypeFilter) => {
    setTypeFilter(type);
    try {
      localStorage.setItem('flowday_timeline_type_filter', type);
    } catch {}
  };

  const handleSortOrderChange = (sort: SortOrder) => {
    setSortOrder(sort);
    try {
      localStorage.setItem('flowday_timeline_sort_order', sort);
    } catch {}
  };

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

  // Overall counts for summary
  const totalStats = useMemo(() => {
    let totalTasks = 0;
    let pendingTasks = 0;
    let doneTasks = 0;

    Object.values(timelineDaysMap).forEach((entries) => {
      entries.forEach((e) => {
        if (e.type === 'task') {
          totalTasks++;
          if (e.status === 'done') {
            doneTasks++;
          } else {
            pendingTasks++;
          }
        }
      });
    });

    return { totalTasks, pendingTasks, doneTasks };
  }, [timelineDaysMap]);

  // Filter entries per day
  const filteredDaysData = useMemo(() => {
    const map: { [key: string]: RenderItem[] } = {};
    const validDays: string[] = [];

    sortedTimelineDays.forEach((dayStr) => {
      const dayEntries = timelineDaysMap[dayStr] || [];

      // Filter entries by type and status
      const filteredEntries = dayEntries.filter((entry) => {
        // Type filter
        if (typeFilter !== 'all') {
          if (entry.type !== typeFilter) return false;
        }

        // Status filter (scheduled tasks only have done / pending)
        if (statusFilter === 'pending') {
          if (entry.type === 'task') {
            return entry.status !== 'done';
          }
          // If statusFilter is active and user didn't specify a type, only show pending tasks or other entries
          return typeFilter !== 'all';
        }

        if (statusFilter === 'done') {
          if (entry.type === 'task') {
            return entry.status === 'done';
          }
          return false;
        }

        return true;
      });

      if (filteredEntries.length === 0 && (statusFilter !== 'all' || typeFilter !== 'all')) {
        return;
      }

      let renderItems = getDayRenderItems(filteredEntries);

      // Sort mechanism: Chronological vs Pending Status First
      if (sortOrder === 'status_first') {
        const isItemDone = (item: RenderItem): boolean => {
          if (item.type === 'standalone') {
            return item.entry.type === 'task' && item.entry.status === 'done';
          }
          if (item.type === 'bracket') {
            const taskChildren = item.children.filter((c) => c.type === 'task');
            return taskChildren.length > 0 && taskChildren.every((c) => (c as Task).status === 'done');
          }
          return false;
        };

        const pendingItems = renderItems.filter((item) => !isItemDone(item));
        const doneItems = renderItems.filter((item) => isItemDone(item));

        pendingItems.sort((a, b) => a.sortTime - b.sortTime);
        doneItems.sort((a, b) => a.sortTime - b.sortTime);

        renderItems = [...pendingItems, ...doneItems];
      }

      map[dayStr] = renderItems;
      validDays.push(dayStr);
    });

    return { map, validDays };
  }, [sortedTimelineDays, timelineDaysMap, getDayRenderItems, statusFilter, typeFilter, sortOrder]);

  return (
    <div className="space-y-2" ref={containerRef}>
      {/* ─── Timeline Top Filter & Sort Bar (Full-Width Solid Opaque Shelf) ─── */}
      <div className="sticky top-0 z-30 bg-[#0a0a0a] border-b border-stone-800/80 pt-1 pb-2.5 px-0 transition-all">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
          {/* Status Filter Tabs (All / To Do / Done) */}
          <div className="flex items-center gap-1 bg-black/40 border border-stone-800/80 p-1 rounded-xl w-full sm:w-auto overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => handleStatusFilterChange('all')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer select-none ${
                statusFilter === 'all'
                  ? 'bg-stone-800 text-stone-100 shadow-sm border border-stone-700/80'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
              }`}
            >
              <Layers className="w-3 h-3" />
              <span>All</span>
            </button>

            <button
              type="button"
              onClick={() => handleStatusFilterChange('pending')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer select-none ${
                statusFilter === 'pending'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
              }`}
            >
              <CircleDashed className="w-3 h-3" />
              <span>To Do ({totalStats.pendingTasks})</span>
            </button>

            <button
              type="button"
              onClick={() => handleStatusFilterChange('done')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all cursor-pointer select-none ${
                statusFilter === 'done'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900/60'
              }`}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Done ({totalStats.doneTasks})</span>
            </button>
          </div>

          {/* Type & Sort Options */}
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            {/* Entry Type Selector */}
            <div className="flex items-center gap-1 bg-black/40 border border-stone-800/80 p-0.5 rounded-xl">
              {(
                [
                  { id: 'all', label: 'All Types', icon: ListFilter },
                  { id: 'task', label: 'Tasks', icon: CircleDashed },
                  { id: 'log', label: 'Logs', icon: Activity },
                  { id: 'note', label: 'Notes', icon: FileText },
                  { id: 'event', label: 'Events', icon: CalendarDays },
                  { id: 'time-block', label: 'Blocks', icon: Clock3 },
                ] as const
              ).map((typeItem) => {
                const IconComponent = typeItem.icon;
                const isSelected = typeFilter === typeItem.id;
                return (
                  <button
                    key={typeItem.id}
                    type="button"
                    onClick={() => handleTypeFilterChange(typeItem.id)}
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[9px] font-mono uppercase tracking-wider transition-all cursor-pointer select-none ${
                      isSelected
                        ? 'bg-stone-800 text-stone-200 font-bold border border-stone-700/80'
                        : 'text-stone-500 hover:text-stone-300 hover:bg-stone-900/40'
                    }`}
                    title={`Filter by ${typeItem.label}`}
                  >
                    <IconComponent className="w-2.5 h-2.5" />
                    <span className="hidden md:inline">{typeItem.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Sort Mechanism Toggle */}
            <button
              type="button"
              onClick={() => handleSortOrderChange(sortOrder === 'time' ? 'status_first' : 'time')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider border transition-all cursor-pointer select-none shrink-0 ${
                sortOrder === 'status_first'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-black/40 border-stone-800/80 text-stone-400 hover:text-stone-200'
              }`}
              title="Toggle sort: Chronological vs Pending tasks first"
            >
              <ArrowUpDown className="w-3 h-3" />
              <span>{sortOrder === 'status_first' ? 'To Do First' : 'By Time'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── Timeline Days Content ────────────────────────────────────────── */}
      {filteredDaysData.validDays.length > 0 ? (
        <div className="space-y-0">
          {filteredDaysData.validDays.map((dayStr) => {
            const dayItems = filteredDaysData.map[dayStr];
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
      ) : (
        <div className="py-24 text-center text-stone-500 select-none bg-[#0e0e0e]/40 border border-dashed border-stone-800/80 rounded-2xl p-8">
          <Calendar className="w-12 h-12 text-stone-800 mx-auto mb-4" />
          <h4 className="font-sans font-medium text-sm text-stone-400 mb-1">
            No entries match your filter
          </h4>
          <p className="text-xs font-sans max-w-md mx-auto leading-relaxed text-stone-500">
            {statusFilter !== 'all' || typeFilter !== 'all'
              ? 'Try switching the filter tabs back to "All" to view the complete multi-day schedule.'
              : 'Start capturing entries using the input engine below to build your timeline.'}
          </p>
          {(statusFilter !== 'all' || typeFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                handleStatusFilterChange('all');
                handleTypeFilterChange('all');
              }}
              className="mt-4 px-3.5 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-mono text-stone-300 transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
