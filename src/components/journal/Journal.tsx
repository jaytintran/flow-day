/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";
import { TimelineEntry, Task, Event, Note, TimeBlock } from "../../types";
import {
  formatDuration,
  toLocalDateString,
  getEffectiveDate,
} from "../../utils";
import DetailSheet from "../DetailSheet";
import DayView from "./DayView";
import TimelineView from "./TimelineView";
import RecordsView from "./RecordsView";

interface JournalProps {
  activeDate: Date;
  setActiveDate: (date: Date) => void;
  viewMode: "day" | "timeline" | "records";
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
}

export default function Journal({
  activeDate,
  setActiveDate,
  viewMode,
  activeTaskId,
  setActiveTaskId,
}: JournalProps) {
  const [highlightedDay, setHighlightedDay] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Selected entry for detail and edit modal
  const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(
    null,
  );
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editTimestamp, setEditTimestamp] = useState("");
  const [editStartAt, setEditStartAt] = useState("");
  const [editEndAt, setEditEndAt] = useState("");

  // Helper: format a Date to "YYYY-MM-DD" for date input
  const toDateInputValue = (d: Date): string => {
    const yyyy = d.getFullYear();
    const mm = (d.getMonth() + 1).toString().padStart(2, "0");
    const dd = d.getDate().toString().padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  // Helper: format a Date to "HH:MM" for time input
  const toTimeInputValue = (d: Date): string => {
    const hh = d.getHours().toString().padStart(2, "0");
    const mm = d.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  };

  // Sync edit state when selectedEntry changes
  useEffect(() => {
    if (!selectedEntry) return;
    setEditTitle(
      selectedEntry.type === "note"
        ? (selectedEntry as Note).title || ""
        : selectedEntry.title || "",
    );

    if (selectedEntry.type === "note" || selectedEntry.type === "event") {
      setEditContent((selectedEntry as Note | Event).content || "");
    } else {
      setEditContent("");
    }

    if (selectedEntry.type === "event" || selectedEntry.type === "note") {
      const ts = new Date((selectedEntry as Event | Note).timestamp);
      setEditTimestamp(toDateInputValue(ts) + "T" + toTimeInputValue(ts));
    }

    if (selectedEntry.type === "time-block") {
      const tb = selectedEntry as TimeBlock;
      const s = new Date(tb.start_at);
      const e = new Date(tb.end_at);
      setEditStartAt(toDateInputValue(s) + "T" + toTimeInputValue(s));
      setEditEndAt(toDateInputValue(e) + "T" + toTimeInputValue(e));
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
      case "note": {
        await db.entries.update(id, {
          title: editTitle.trim(),
          content: editContent.trim(),
        } as any);
        break;
      }
      case "task": {
        await db.entries.update(id, {
          title: editTitle.trim(),
        } as any);
        break;
      }
      case "event": {
        const newTimestamp = editTimestamp
          ? new Date(editTimestamp)
          : undefined;
        await db.entries.update(id, {
          title: editTitle.trim(),
          content: editContent.trim(),
          ...(newTimestamp ? { timestamp: newTimestamp } : {}),
        } as any);
        break;
      }
      case "time-block": {
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
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
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
    (e) => e.type !== "objective" && e.type !== "goal",
  );

  // Group and sort logic for Day View and Timeline View
  const getEntrySortTime = (e: TimelineEntry): number => {
    // For tasks: first available of completed_at → scheduled_at → created_at
    if (e.type === "task") {
      if (e.completed_at) return new Date(e.completed_at).getTime();
      if (e.scheduled_at) return new Date(e.scheduled_at).getTime();
      return new Date(e.created_at).getTime();
    }
    // For non-tasks: carried_to → natural timestamp (events/notes: timestamp, time-blocks: start_at)
    return getEffectiveDate(e).getTime();
  };

  // Toggles status of Task
  const handleToggleTaskStatus = async (task: Task) => {
    const isDone = task.status === "done";
    const nextStatus = isDone ? "todo" : "done";
    await db.entries.update(task.id, {
      status: nextStatus,
      completed_at: nextStatus === "done" ? new Date() : undefined,
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

  // Carry a task to a new date (soft move via carried_to)
  const handleCarryTask = async (taskId: string, targetDate: Date) => {
    await db.entries.update(taskId, {
      carried_to: targetDate,
    } as any);
  };

  // Revert a carried task back to its original date
  const handleRevertCarry = async (taskId: string) => {
    await db.entries.update(taskId, {
      carried_to: undefined,
    } as any);
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

    const time = d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday) return time;
    if (isYesterday) return `-1d ${time}`;

    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${dd}/${mm} ${time}`;
  };

  // Group entries of a single day with nested timeblocks logic
  const getDayRenderItems = (dayEntries: TimelineEntry[]) => {
    const blocks = dayEntries.filter(
      (e) => e.type === "time-block",
    ) as TimeBlock[];
    const others = dayEntries.filter((e) => e.type !== "time-block");

    // Sort blocks by start_at
    blocks.sort(
      (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
    );

    // Hold children associated with time blocks
    const assignedIds = new Set<string>();
    const timeBlocksWithChildren = blocks.map((block) => {
      const start = new Date(block.start_at).getTime();
      const end = new Date(block.end_at).getTime();

      const children = others.filter((entry) => {
        if (assignedIds.has(entry.id)) return false;
        const checkTime =
          entry.type === "task"
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

    const standaloneEntries = others.filter(
      (entry) => !assignedIds.has(entry.id),
    );

    // Combine into timeline
    const items: any[] = [];
    timeBlocksWithChildren.forEach(({ block, children }) => {
      items.push({
        type: "bracket",
        block,
        children,
        sortTime: new Date(block.start_at).getTime(),
      });
    });

    standaloneEntries.forEach((entry) => {
      items.push({
        type: "standalone",
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
    (a, b) => new Date(a).getTime() - new Date(b).getTime(),
  );

  // Scrolling into selected day separator in Timeline mode
  useEffect(() => {
    if (
      viewMode === "timeline" &&
      sortedTimelineDays.includes(activeDayString)
    ) {
      const elementId = `spine-day-${activeDayString}`;
      const element = document.getElementById(elementId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightedDay(activeDayString);
        const timer = setTimeout(() => {
          setHighlightedDay(null);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [viewMode, activeDate]);

  // Parse YYYY-MM-DD back to readable label
  const formatDateStringLabel = (dayStr: string): string => {
    const parts = dayStr.split("-");
    const parsedDate = new Date(
      parseInt(parts[0]),
      parseInt(parts[1]) - 1,
      parseInt(parts[2]),
    );
    return parsedDate.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div
      className="flex-1 overflow-y-auto px-2 md:px-6 py-4 md:py-6"
      id="timeline-journal-scrollable"
      ref={containerRef}
    >
      <div className="w-full md:max-w-3xl md:mx-auto space-y-8">
        {viewMode === "records" ? (
          <RecordsView
            entries={entries}
            deletingId={deletingId}
            onDeleteEntry={handleDeleteEntry}
            onOpenDetail={handleOpenDetail}
            formatTime={formatTime}
            formatDateStringLabel={formatDateStringLabel}
          />
        ) : viewMode === "day" ? (
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
            handleRevertCarry={handleRevertCarry}
            formatTime={formatTime}
            formatDateStringLabel={formatDateStringLabel}
          />
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
            handleRevertCarry={handleRevertCarry}
            formatTime={formatTime}
            formatDateStringLabel={formatDateStringLabel}
          />
        )}
      </div>

      {/* GENERALIZED DETAIL SHEET — EDIT ANY ENTRY TYPE */}
      <DetailSheet
        open={isDetailOpen && selectedEntry !== null}
        onClose={handleCloseDetail}
        label={
          selectedEntry?.type === "task"
            ? "Edit Task"
            : selectedEntry?.type === "event"
              ? "Edit Event"
              : selectedEntry?.type === "note"
                ? "Note Details"
                : selectedEntry?.type === "time-block"
                  ? "Edit Time Block"
                  : "Edit Entry"
        }
        labelColor={
          selectedEntry?.type === "task"
            ? "emerald"
            : selectedEntry?.type === "event"
              ? "indigo"
              : selectedEntry?.type === "note"
                ? "blue"
                : selectedEntry?.type === "time-block"
                  ? "amber"
                  : "blue"
        }
        isMobile={isMobile}
      >
        {selectedEntry && (
          <>
            {/* Common: Title field for ALL entry types */}
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder={
                selectedEntry.type === "task"
                  ? "Task Title"
                  : selectedEntry.type === "event"
                    ? "Event Title"
                    : selectedEntry.type === "time-block"
                      ? "Time Block Title"
                      : "Note Title"
              }
              className="w-full bg-transparent text-stone-100 font-serif font-bold text-xl focus:outline-none placeholder-stone-700 pb-2 border-b border-stone-900/60"
            />

            {/* Note: timestamp (readonly) */}
            {selectedEntry.type === "note" && (
              <div className="text-[10px] font-mono text-stone-500 flex items-center gap-1">
                <span>
                  Logged: {formatTime((selectedEntry as Note).timestamp)}
                </span>
                <span>•</span>
                <span>
                  {new Date(
                    (selectedEntry as Note).timestamp,
                  ).toLocaleDateString()}
                </span>
              </div>
            )}

            {/* Note & Event: content textarea */}
            {(selectedEntry.type === "note" ||
              selectedEntry.type === "event") && (
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder={
                  selectedEntry.type === "event"
                    ? "Event description, notes, or details..."
                    : "Tap to start typing your thoughts..."
                }
                className="w-full bg-transparent text-stone-300 font-serif text-sm focus:outline-none resize-none leading-relaxed placeholder-stone-700 min-h-[200px]"
              />
            )}

            {/* Task: readonly meta preview */}
            {selectedEntry.type === "task" && (
              <div className="space-y-2">
                <div className="text-[10px] font-mono text-stone-500 flex items-center gap-1 flex-wrap">
                  <span>
                    Created: {formatTime((selectedEntry as Task).created_at)}
                  </span>
                  <span>•</span>
                  <span>
                    {new Date(
                      (selectedEntry as Task).created_at,
                    ).toLocaleDateString()}
                  </span>
                  {(selectedEntry as Task).scheduled_at && (
                    <>
                      <span>•</span>
                      <span className="text-indigo-400">
                        Scheduled:{" "}
                        {formatTime((selectedEntry as Task).scheduled_at!)}
                      </span>
                    </>
                  )}
                  <span>•</span>
                  <span className="bg-[#121212] border border-stone-800 text-stone-400 rounded px-2 py-0.5">
                    {(selectedEntry as Task).status === "done"
                      ? "✓ Done"
                      : "○ To Do"}
                  </span>
                </div>

                {(selectedEntry as Task).time_spent > 0 && (
                  <div className="text-[10px] font-mono text-stone-500">
                    Time Tracked:{" "}
                    {formatDuration((selectedEntry as Task).time_spent)}
                  </div>
                )}

                {(selectedEntry as Task).completed_at && (
                  <div className="text-[10px] font-mono text-emerald-500">
                    Completed:{" "}
                    {formatTime((selectedEntry as Task).completed_at!)},{" "}
                    {new Date(
                      (selectedEntry as Task).completed_at!,
                    ).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}

            {/* Event: editable timestamp */}
            {selectedEntry.type === "event" && (
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block">
                  Date &amp; Time
                </label>
                <input
                  type="datetime-local"
                  value={editTimestamp}
                  onChange={(e) => setEditTimestamp(e.target.value)}
                  className="w-full bg-[#0a0a0a] border border-stone-800 rounded-lg px-3 py-2.5 text-stone-200 font-mono text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                />
              </div>
            )}

            {/* Time Block: editable start_at + end_at */}
            {selectedEntry.type === "time-block" && (
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block mb-1">
                    Start
                  </label>
                  <input
                    type="datetime-local"
                    value={editStartAt}
                    onChange={(e) => setEditStartAt(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-stone-800 rounded-lg px-3 py-2.5 text-stone-200 font-mono text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-stone-500 uppercase tracking-wider block mb-1">
                    End
                  </label>
                  <input
                    type="datetime-local"
                    value={editEndAt}
                    onChange={(e) => setEditEndAt(e.target.value)}
                    className="w-full bg-[#0a0a0a] border border-stone-800 rounded-lg px-3 py-2.5 text-stone-200 font-mono text-sm focus:outline-none focus:border-amber-500/50 transition-colors"
                  />
                </div>
              </div>
            )}
          </>
        )}
      </DetailSheet>
    </div>
  );
}
