/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import DayTimeline, { RenderItem } from './DayTimeline';
import { TimelineEntry, Task } from '../../types';

interface DayViewProps {
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
  handleRevertCarry: (taskId: string) => void;
  formatTime: (dateInput: Date | string) => string;
  formatDateStringLabel: (dayStr: string) => string;
  onTimePickerConfirm: (entry: TimelineEntry, newDate: Date) => void;
}

export default function DayView({
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
  handleRevertCarry,
  formatTime,
  formatDateStringLabel,
  onTimePickerConfirm,
}: DayViewProps) {
  return (
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
      handleRevertCarry={handleRevertCarry}
      formatTime={formatTime}
      formatDateStringLabel={formatDateStringLabel}
      onTimePickerConfirm={onTimePickerConfirm}
    />
  );
}
