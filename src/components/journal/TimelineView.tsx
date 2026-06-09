/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import DayTimeline, { RenderItem } from "./DayTimeline";
import { TimelineEntry, Task } from "../../types";
import { Calendar } from "lucide-react";

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
}: TimelineViewProps) {
  if (sortedTimelineDays.length > 0) {
    return (
      <div className="space-y-6">
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
            />
          );
        })}
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
        Start capturing entries using the input engine below. Switch back
        to "Day View" to log your tasks and build an offline productivity
        timeline easily.
      </p>
    </div>
  );
}
