/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';
import { TimelineEntry, Task, Event, Note, TimeBlock, HabitLog } from '../../types';
import { formatDuration } from '../../utils';
import TimePickerSheet from '../TimePickerSheet';

export type RenderItem =
  | {
      type: 'bracket';
      block: TimeBlock;
      children: TimelineEntry[];
      sortTime: number;
    }
  | { type: 'standalone'; entry: TimelineEntry; sortTime: number };

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
  // Local state for time picker
  const [pickerEntry, setPickerEntry] = useState<TimelineEntry | null>(null);

  const getPickerInitialDate = (entry: TimelineEntry): Date => {
    if (entry.type === 'task') {
      const task = entry as Task;
      if (task.status === 'done' && task.completed_at) return new Date(task.completed_at);
      return new Date(task.scheduled_at || task.created_at);
    }
    if (entry.type === 'event') return new Date((entry as Event).timestamp);
    if (entry.type === 'note') return new Date((entry as Note).timestamp);
    if (entry.type === 'habit-log') return new Date((entry as HabitLog).timestamp);
    return new Date(entry.created_at);
  };

  // Render individual generic row with customized icons
  const renderStandaloneRow = (
    entry: TimelineEntry,
    isFirst: boolean,
    isLast: boolean,
    customSpineMargin = 'left-[19.5px]',
  ) => {
    const isTask = entry.type === 'task';
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
        isScheduledTime = !!task.scheduled_at;
      }
    } else if (isEvent) {
      primaryTime = formatTime((entry as Event).timestamp);
    } else if (isNote) {
      primaryTime = formatTime((entry as Note).timestamp);
    } else if (isHabitLog) {
      primaryTime = formatTime((entry as HabitLog).timestamp);
    }

    return (
      <div
        key={entry.id}
        id={`entry-${entry.id}`}
        onClick={() => !isHabitLog && handleOpenDetail(entry)}
        className={`group relative flex items-center gap-2.5 py-2 rounded md:px-3 transition-colors border-stone-900/50 last:border-b-0 ${
          isHabitLog ? '' : 'hover:bg-stone-900/40 cursor-pointer'
        }`}
      >
        {/* Left Column 1: Time Gutter */}
        <div className="w-10 text-right shrink-0 select-none">
          <span
            onClick={(e) => {
              e.stopPropagation();
              setPickerEntry(entry);
            }}
            className={`text-[10px] font-mono font-medium tracking-tight cursor-pointer hover:text-amber-400 transition-colors ${
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

        {/* Left Column 2: Icon Dot */}
        <div className="w-5 h-5 flex items-center justify-center relative shrink-0 z-10">
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
        <div className="flex-1 min-w-0">
          {/* Row 1: Title + Action Tools */}
          <div className="flex justify-between items-center gap-4">
            <div className="flex-1">
              {isTask && (
                <p
                  id={`task-title-${entry.id}`}
                  className={`text-xs font-sans break-words line-clamp-1 ${
                    (entry as Task).status === 'done'
                      ? (entry as Task).achievements?.length
                        ? 'text-amber-400/80 line-through font-semibold'
                        : 'text-stone-600 line-through font-semibold'
                      : 'text-stone-200 font-semibold'
                  }`}
                >
                  {(entry as Task).status === 'done' && (entry as Task).achievements?.length ? (
                    <span className="mr-1.5 not-italic">🏆</span>
                  ) : null}
                  {(entry as Task).title}
                </p>
              )}

              {isEvent && (
                <p
                  id={`event-title-${entry.id}`}
                  className="text-xs font-sans font-semibold text-stone-200 break-words line-clamp-1"
                >
                  {(entry as Event).title}
                </p>
              )}

              {isNote && (
                <div className="flex items-center gap-2.5">
                  <span
                    id={`note-title-${entry.id}`}
                    className="text-xs font-sans font-semibold text-stone-200 break-words line-clamp-1"
                  >
                    {(entry as Note).title || 'Untitled Note'}
                  </span>
                </div>
              )}

              {isHabitLog && (
                <p
                  id={`habitlog-title-${entry.id}`}
                  className="text-xs font-sans text-emerald-300/90 font-semibold"
                >
                  {(entry as HabitLog).title}
                </p>
              )}
            </div>

            {/* Action Tools */}
            <div className="flex items-center gap-1.5 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0">
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

              {deletingId === entry.id ? (
                <button
                  id={`delete-entry-btn-${entry.id}`}
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
            {isTask && (
              <>
                <span className="flex items-center gap-1 bg-[#121212] border border-stone-800 text-stone-400 rounded px-2 py-0.5 text-[8px]">
                  <Clock className="w-3 h-3 inline-block text-stone-500" />
                  {formatTime(entry.created_at)}
                </span>

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
                Happens at: {formatTime((entry as Event).timestamp)}
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
      } else {
        if (item.entry.type === 'task') counts.tasks++;
        else if (item.entry.type === 'event') counts.events++;
        else if (item.entry.type === 'note') counts.notes++;
        else if (item.entry.type === 'habit-log') counts.habits++;
      }
    });
    return counts;
  }, [items]);

  return (
    <div className="w-full relative" key={labelString}>
      {isFromTimelineView && (
        <div id={`spine-day-${labelString}`} className="flex items-center gap-0 bg-[#0a0a0a]">
          <button
            onClick={() => toggleDayCollapse(labelString)}
            className="w-10 flex items-center justify-center shrink-0 py-4 text-stone-600 hover:text-amber-500 transition-colors cursor-pointer"
            title={isCollapsed ? 'Expand day' : 'Collapse day'}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={() => setActiveDate(new Date(labelString))}
            className="text-xs uppercase font-mono font-bold tracking-widest hover:text-amber-500 text-stone-500 transition-colors cursor-pointer py-4 flex-1 text-left"
          >
            {formatDateStringLabel(labelString)}
            <span className="ml-2 text-[10px] font-normal normal-case text-stone-500 hidden sm:inline">
              {summaryCounts.tasks > 0 ||
              summaryCounts.events > 0 ||
              summaryCounts.notes > 0 ||
              summaryCounts.habits > 0 ||
              summaryCounts.timeBlocks > 0 ? (
                <>
                  {summaryCounts.tasks > 0 && (
                    <span className="text-amber-400/80">
                      {summaryCounts.tasks} task{summaryCounts.tasks !== 1 ? 's' : ''}
                    </span>
                  )}
                  {summaryCounts.events > 0 && (
                    <>
                      {summaryCounts.tasks > 0 && <span className="text-stone-700"> · </span>}
                      <span className="text-indigo-400/80">
                        {summaryCounts.events} event{summaryCounts.events !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                  {summaryCounts.notes > 0 && (
                    <>
                      {(summaryCounts.tasks > 0 || summaryCounts.events > 0) && (
                        <span className="text-stone-700"> · </span>
                      )}
                      <span className="text-blue-400/80">
                        {summaryCounts.notes} note{summaryCounts.notes !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                  {summaryCounts.habits > 0 && (
                    <>
                      {(summaryCounts.tasks > 0 ||
                        summaryCounts.events > 0 ||
                        summaryCounts.notes > 0) && <span className="text-stone-700"> · </span>}
                      <span className="text-emerald-400/80">
                        {summaryCounts.habits} habit{summaryCounts.habits !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                  {summaryCounts.timeBlocks > 0 && (
                    <>
                      {(summaryCounts.tasks > 0 ||
                        summaryCounts.events > 0 ||
                        summaryCounts.notes > 0 ||
                        summaryCounts.habits > 0) && <span className="text-stone-700"> · </span>}
                      <span className="text-stone-400/80">
                        {summaryCounts.timeBlocks} block{summaryCounts.timeBlocks !== 1 ? 's' : ''}
                      </span>
                    </>
                  )}
                </>
              ) : (
                `${items.length} ${items.length === 1 ? 'entry' : 'entries'}`
              )}
            </span>
          </button>
        </div>
      )}

      {/* Timeline spine line — only in timeline mode, when expanded */}
      {isFromTimelineView && !isCollapsed && (
        <div className="absolute top-0 left-0 w-10 bottom-0 pointer-events-none z-0">
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-px bg-stone-800/60" />
        </div>
      )}

      {!isCollapsed &&
        (items.length > 0 ? (
          // AFTER
          <div className="space-y-0 pt-1">
            {/* Non-habit items render normally */}
            {items
              .filter((item) => !(item.type === 'standalone' && item.entry.type === 'habit-log'))
              .map((item) => {
                if (item.type === 'standalone') {
                  return renderStandaloneRow(item.entry, false, false);
                } else {
                  return renderBracketItem(item.block, item.children);
                }
              })}

            {/* Habit logs grouped into a collapsible section at the bottom */}
            {(() => {
              const habitItems = items.filter(
                (item) => item.type === 'standalone' && item.entry.type === 'habit-log',
              );
              if (habitItems.length === 0) return null;

              return (
                <>
                  <div className="flex items-start gap-3 px-3 py-2">
                    <div className="flex-1 h-px bg-stone-900" />
                    <button
                      onClick={() =>
                        setHabitsCollapsed((v) => {
                          const next = !v;
                          try {
                            localStorage.setItem(HABITS_COLLAPSE_KEY, String(next));
                          } catch {}
                          return next;
                        })
                      }
                      className="flex items-start gap-1.5 px-2.5 py-1 border-b border-emerald-800/30 text-[10px] text-emerald-600 hover:text-emerald-400 hover:border-emerald-700/50 transition-colors cursor-pointer shrink-0"
                    >
                      <Repeat2 className="w-3 h-3" />
                      <span>
                        {habitItems.length} habit
                        {habitItems.length !== 1 ? 's' : ''} done
                      </span>
                      {habitsCollapsed ? (
                        <ChevronRight className="w-3 h-3" />
                      ) : (
                        <ChevronDown className="w-3 h-3" />
                      )}
                    </button>
                    <div className="flex-1 h-px bg-stone-900" />
                  </div>

                  {!habitsCollapsed && (
                    <div className="space-y-0">
                      {habitItems.map((item) =>
                        renderStandaloneRow(
                          (
                            item as {
                              type: 'standalone';
                              entry: TimelineEntry;
                              sortTime: number;
                            }
                          ).entry,
                          false,
                          false,
                        ),
                      )}
                    </div>
                  )}
                </>
              );
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
