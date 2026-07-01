/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type EntryType =
  | 'task'
  | 'log'
  | 'event'
  | 'note'
  | 'time-block'
  | 'objective'
  | 'goal'
  | 'habit-log';

export interface BaseEntry {
  id: string;
  type: EntryType;
  created_at: Date;
  scheduled_at?: Date;
}

export interface TaskAchievement {
  id: string;
  text: string;
  created_at: Date;
}

export interface Task extends BaseEntry {
  type: 'task';
  title: string;
  status: 'todo' | 'done';
  time_spent: number; // milliseconds
  completed_at?: Date; // the timestamp when completed
  objective_id?: string; // link to an objective
  achievements?: TaskAchievement[];
  content?: string;
  sort_order?: number; // display ordering (used by TasksView DnD)
  category_ids?: string[]; // add this
  starred?: boolean;
}

export interface Event extends BaseEntry {
  type: 'event';
  title: string;
  content: string;
  timestamp: Date;
}

export interface Note extends BaseEntry {
  type: 'note';
  title: string;
  content: string;
  timestamp: Date;
}

export interface Log extends BaseEntry {
  type: 'log';
  title: string;
  timestamp: Date;
}

export interface TimeBlock extends BaseEntry {
  type: 'time-block';
  title: string;
  start_at: Date;
  end_at: Date;
}

export interface Objective extends BaseEntry {
  type: 'objective';
  title: string;
  time_spent: number; // milliseconds, accumulated from linked tasks
  status: 'todo' | 'done' | 'archived';
  completed_at?: Date;
  goal_id?: string; // link to a goal/project
  category_ids?: string[]; // links to categories
  purpose_ids?: string[];
  domain_ids?: string[];
  sort_order?: number; // display ordering
}

export interface Goal extends BaseEntry {
  type: 'goal';
  title: string;
  time_spent: number; // milliseconds, accumulated from linked objectives
  status: 'active' | 'achieved' | 'archived';
  achieved_at?: Date;
  category_ids?: string[]; // links to categories
  purpose_ids?: string[];
  domain_ids?: string[];
  sort_order?: number; // display ordering
}

export type TimelineEntry = Task | Log | Event | Note | TimeBlock | Objective | Goal | HabitLog;

// Habit template — stored in the `habits` Dexie table, NOT a TimelineEntry
export interface Habit {
  id: string;
  title: string;
  created_at: Date;
  status: 'active' | 'archived';
  color?: 'emerald' | 'sky' | 'violet' | 'rose' | 'amber';
  sort_order?: number; // display ordering
  purpose_ids?: string[];
  domain_ids?: string[];
}

// One log per tick — IS a TimelineEntry (appears in the daily timeline)
export interface HabitLog extends BaseEntry {
  type: 'habit-log';
  habit_id: string;
  title: string; // copied from Habit.title at log time
  timestamp: Date; // exact completion time (shown in time gutter)
}

export type CategoryScope = 'goal' | 'objective' | 'task-list';

// Category — tags for goals or objectives
export interface Category {
  id: string;
  name: string;
  color: 'emerald' | 'sky' | 'violet' | 'rose' | 'amber' | 'indigo' | 'teal' | 'orange';
  scope: CategoryScope;
  created_at: Date;
}

export interface Purpose {
  id: string;
  title: string;
  domain_ids?: string[];
  created_at: Date;
  sort_order?: number;
}

export interface Domain {
  id: string;
  title: string;
  created_at: Date;
  sort_order?: number;
}

export interface TimerState {
  taskId: string | null;
  isRunning: boolean;
  startTime: number | null; // Date.now() when started or resumed
  elapsedAtStart: number; // accumulated time before this run session
}
