/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import DayTimeline, { RenderItem } from './DayTimeline';
import { TimelineEntry, Task, DayRange } from '../../types';
import { ChevronDown, ChevronRight, Calendar, Trash2, Sparkles, AlertCircle, Play, Plus } from 'lucide-react';
import EntryContextMenu from '../EntryContextMenu';
import { toLocalDateString, formatDateLabel, isSameDay } from '../../utils';

interface DayViewProps {
  activeDate: Date;
  activeDayString: string;
  dayRenderItems: RenderItem[];
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
  overdueTasks: Task[];
  handleImportAllOverdue: () => Promise<void>;
  handleRescheduleAllOverdue: (targetDate: Date) => Promise<void>;
  dayRange?: DayRange;
  entries?: TimelineEntry[];
  getDayRenderItems?: (dayEntries: TimelineEntry[]) => RenderItem[];
}

export default function DayView({
  activeDate,
  activeDayString,
  dayRenderItems,
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
  overdueTasks,
  handleImportAllOverdue,
  handleRescheduleAllOverdue,
  dayRange = '1D',
  entries = [],
  getDayRenderItems,
}: DayViewProps) {
  const [isOverdueCollapsed, setIsOverdueCollapsed] = useState(() => {
    try {
      return localStorage.getItem('flow-day-overdue-collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleOverdueCollapsed = () => {
    setIsOverdueCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('flow-day-overdue-collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const [contextMenu, setContextMenu] = useState<{
    entry: Task;
    x: number;
    y: number;
  } | null>(null);

  // Compute multi-day columns when dayRange !== '1D'
  const multiDayDates = React.useMemo(() => {
    if (dayRange === '1D') return [activeDate];

    const dates: Date[] = [];
    if (dayRange === '3D') {
      for (let offset = -1; offset <= 1; offset++) {
        const d = new Date(activeDate);
        d.setDate(d.getDate() + offset);
        dates.push(d);
      }
    } else if (dayRange === '4D') {
      for (let offset = 0; offset < 4; offset++) {
        const d = new Date(activeDate);
        d.setDate(d.getDate() + offset);
        dates.push(d);
      }
    } else if (dayRange === '1W') {
      // Monday to Sunday for the active date's week
      const current = new Date(activeDate);
      const dayOfWeek = current.getDay(); // 0 is Sunday, 1 is Monday...
      const distanceToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(current);
      monday.setDate(current.getDate() + distanceToMonday);

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(d);
      }
    }
    return dates;
  }, [activeDate, dayRange]);

  const renderOverdueSection = () => {
    if (overdueTasks.length === 0) return null;

    return (
      <div className="bg-[#121212]/80 backdrop-blur-md border border-red-500/20 rounded-xl overflow-hidden shadow-lg shadow-red-950/10">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 bg-red-950/10 border-b border-red-950/20">
          <button
            onClick={toggleOverdueCollapsed}
            className="flex items-center gap-1.5 text-red-400 hover:text-red-300 font-mono font-bold tracking-wider uppercase text-[10px] sm:text-xs cursor-pointer focus:outline-none"
          >
            {isOverdueCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5 text-red-500" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-red-500" />
            )}
            <AlertCircle className="w-3.5 h-3.5 text-red-500 animate-pulse" />
            <span>Overdue ({overdueTasks.length})</span>
          </button>

          {!isOverdueCollapsed && (
            <div className="flex items-center gap-1.5">
              {/* Reschedule All */}
              <div
                className="relative flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 bg-stone-900 border border-stone-800 hover:border-stone-700 text-stone-400 hover:text-stone-200 rounded-lg text-[10px] sm:text-xs font-mono font-bold uppercase transition-all cursor-pointer"
              >
                <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span className="hidden sm:inline">Reschedule All</span>
                <input
                  type="date"
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                  onChange={(e) => {
                    if (!e.target.value) return;
                    handleRescheduleAllOverdue(new Date(e.target.value));
                  }}
                />
              </div>

              {/* Import All */}
              <button
                onClick={handleImportAllOverdue}
                className="flex items-center gap-1 px-2 py-1 sm:px-3 sm:py-1.5 bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-lg text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 fill-current shrink-0 animate-pulse" />
                <span className="hidden sm:inline">Import to Today</span>
                <span className="inline sm:hidden">Import</span>
              </button>
            </div>
          )}
        </div>

        {/* List */}
        {!isOverdueCollapsed && (
          <div className="divide-y divide-stone-900/60 max-h-60 sm:max-h-72 overflow-y-auto">
            {overdueTasks.map((task) => {
              const taskDate = new Date(task.scheduled_at || task.created_at);
              const isWorking = activeTaskId === task.id;

              return (
                <div
                  key={task.id}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({
                      entry: task,
                      x: e.clientX,
                      y: e.clientY,
                    });
                  }}
                  className="group relative flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-2.5 hover:bg-stone-900/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleTaskStatus(task)}
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded-full border border-stone-700 bg-[#0a0a0a] text-transparent hover:text-stone-400 hover:bg-stone-900/60 flex items-center justify-center transition-colors cursor-pointer shrink-0 text-[10px] sm:text-xs"
                    >
                      ✓
                    </button>

                    {/* Title & Info */}
                    <div className="min-w-0 flex-1">
                      <span
                        onClick={() => handleOpenDetail(task)}
                        className="text-stone-200 font-serif text-xs sm:text-sm font-medium tracking-wide break-words hover:text-amber-400 cursor-pointer block"
                      >
                        {task.title}
                      </span>
                      <span className="text-[9px] sm:text-[10px] text-red-500/80 font-mono block mt-0.5">
                        Overdue since {taskDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    {/* Activate Task */}
                    {!isWorking && (
                      <button
                        onClick={() => handleActivateTask(task.id)}
                        className="p-1 sm:p-1.5 bg-transparent rounded border border-stone-850 hover:bg-stone-800 text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
                        title="Activate as Working Task"
                      >
                        <Play className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
                      </button>
                    )}

                    {/* Today button */}
                    <button
                      onClick={() => handleCarryTask(task.id, new Date(activeDayString))}
                      className="flex items-center justify-center px-1.5 py-1 sm:p-1.5 bg-transparent rounded border border-stone-850 hover:bg-stone-800 text-stone-500 hover:text-emerald-400 transition-colors cursor-pointer font-mono text-[9px] sm:text-[10px] font-bold uppercase"
                      title="Port to Today"
                    >
                      Today
                    </button>

                    {/* Reschedule Calendar */}
                    <div
                      className="relative p-1 sm:p-1.5 rounded border border-stone-850 hover:bg-stone-800 text-stone-500 hover:text-sky-400 transition-colors cursor-pointer flex items-center justify-center"
                      title="Reschedule Date"
                    >
                      <Calendar className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      <input
                        type="date"
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        onChange={(e) => {
                          if (!e.target.value) return;
                          handleCarryTask(task.id, new Date(e.target.value));
                        }}
                      />
                    </div>

                    {/* Delete */}
                    {deletingId === task.id ? (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEntry(task.id);
                        }}
                        className="px-1.5 py-0.5 sm:px-2 sm:py-1 text-[9px] sm:text-[10px] bg-red-950/80 border border-red-800/80 rounded text-red-400 font-mono font-bold hover:bg-red-900 transition-colors cursor-pointer"
                        title="Confirm delete"
                      >
                        Sure?
                      </button>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteEntry(task.id);
                        }}
                        className="p-1 sm:p-1.5 rounded border border-stone-850 hover:bg-stone-800 text-stone-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete Overdue Task"
                      >
                        <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // 1D View Mode: Keep the existing single timeline layout
  if (dayRange === '1D') {
    return (
      <div className="space-y-6">
        {renderOverdueSection()}

        <DayTimeline
          items={dayRenderItems}
          labelString={activeDayString}
          isFromTimelineView={false}
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

        {contextMenu && (
          <EntryContextMenu
            entry={contextMenu.entry}
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(null)}
            activeTaskId={activeTaskId}
            onOpenDetail={handleOpenDetail}
            onDeleteEntry={handleDeleteEntry}
            onActivateTask={handleActivateTask}
            onToggleTaskStatus={handleToggleTaskStatus}
            onReschedule={(targetEntry, targetDate) => {
              onTimePickerConfirm(targetEntry, targetDate);
            }}
          />
        )}
      </div>
    );
  }

  // Multi-day View Mode (3D | 4D | 1W): Multi-column grid on desktop
  const gridColsClass =
    dayRange === '3D'
      ? 'grid-cols-1 md:grid-cols-3'
      : dayRange === '4D'
      ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
      : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-7';

  return (
    <div className="space-y-6 w-full">
      {renderOverdueSection()}

      {/* Multi-Day Columns Grid */}
      <div className={`grid ${gridColsClass} gap-4 w-full items-start`}>
        {multiDayDates.map((colDate) => {
          const colDayString = toLocalDateString(colDate);
          const isSelectedDay = isSameDay(colDate, activeDate);
          const isToday = isSameDay(colDate, new Date());

          // Get items for this column's day
          const colDayEntries = entries.filter((e) => {
            if (e.type === 'task' && !e.scheduled_at) {
              if (e.status !== 'done' || !e.completed_at) return false;
              return toLocalDateString(new Date(e.completed_at)) === colDayString;
            }
            return toLocalDateString(new Date(e.scheduled_at || e.created_at || (e as any).timestamp)) === colDayString;
          });

          const colRenderItems = getDayRenderItems ? getDayRenderItems(colDayEntries) : [];

          return (
            <div
              key={colDayString}
              onClick={() => setActiveDate(colDate)}
              className={`flex flex-col bg-[#111111]/80 backdrop-blur-md rounded-2xl border transition-all duration-200 overflow-hidden shadow-sm ${
                isSelectedDay
                  ? 'border-amber-500/50 ring-1 ring-amber-500/30 bg-[#141414]'
                  : 'border-stone-850 hover:border-stone-750'
              }`}
            >
              {/* Column Header */}
              <div
                className={`flex items-center justify-between px-3.5 py-2.5 border-b cursor-pointer transition-colors ${
                  isSelectedDay
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : isToday
                    ? 'bg-stone-850/50 border-stone-800'
                    : 'bg-stone-900/40 border-stone-850'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`text-xs font-mono font-bold uppercase tracking-wider truncate ${
                      isSelectedDay ? 'text-amber-300' : isToday ? 'text-amber-400' : 'text-stone-300'
                    }`}
                  >
                    {formatDateLabel(colDate)}
                  </span>
                  {isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0 shadow-[0_0_6px_#f59e0b]" />
                  )}
                </div>

                <span className="text-[10px] font-mono text-stone-500 shrink-0 font-bold">
                  {colRenderItems.length} {colRenderItems.length === 1 ? 'item' : 'items'}
                </span>
              </div>

              {/* Day Timeline Column Body */}
              <div className="p-2 sm:p-3 overflow-y-auto max-h-[calc(100vh-280px)]">
                <DayTimeline
                  items={colRenderItems}
                  labelString={colDayString}
                  isFromTimelineView={false}
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
              </div>
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <EntryContextMenu
          entry={contextMenu.entry}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          activeTaskId={activeTaskId}
          onOpenDetail={handleOpenDetail}
          onDeleteEntry={handleDeleteEntry}
          onActivateTask={handleActivateTask}
          onToggleTaskStatus={handleToggleTaskStatus}
          onReschedule={(targetEntry, targetDate) => {
            onTimePickerConfirm(targetEntry, targetDate);
          }}
        />
      )}
    </div>
  );
}
