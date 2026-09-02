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

export type DayRange = '1D' | '3D' | '4D' | '1W';

export interface MicroWin {
  id: string;
  text: string;
  created_at: Date;
}

export type TaskAchievement = MicroWin;

export interface BaseEntry {
  id: string;
  type: EntryType;
  created_at: Date;
  scheduled_at?: Date;
  starred?: boolean;
  icon?: string;
  micro_wins?: MicroWin[];
  achievements?: MicroWin[]; // Backwards compatibility for legacy tasks
}

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'dropped' | 'maybe';

export interface Task extends BaseEntry {
  type: 'task';
  title: string;
  status: TaskStatus;
  time_spent: number; // milliseconds
  completed_at?: Date; // the timestamp when completed
  scheduled_end_at?: Date; // optional end time for scheduled span
  objective_id?: string; // link to an objective
  achievements?: TaskAchievement[];
  content?: string;
  sort_order?: number; // display ordering (used by ListsView DnD)
  category_ids?: string[]; // add this
  starred?: boolean;
  is_accomplishment?: boolean; // marks a completed task as an accomplishment for the Trophy view
  folder_id?: string; // links to a ListFolder
}

export interface ListFolder {
  id: string;
  name: string;
  list_id: string; // Category ID, 'all', or 'none'
  sort_order?: number;
  color?: string;
  created_at: Date;
}

export interface Event extends BaseEntry {
  type: 'event';
  title: string;
  content: string;
  timestamp: Date;
  end_timestamp?: Date;
  category_ids?: string[];
  pinned?: boolean;
}

export interface Note extends BaseEntry {
  type: 'note';
  title: string;
  content: string;
  timestamp: Date;
  category_ids?: string[];
  pinned?: boolean;
}

export interface Log extends BaseEntry {
  type: 'log';
  title: string;
  timestamp: Date;
  end_timestamp?: Date;
  is_accomplishment?: boolean;
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
  icon?: string;
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

export type CategoryScope = 'goal' | 'objective' | 'task-list' | 'record-category';

export interface Category {
  id: string;
  name: string;
  color: 'emerald' | 'sky' | 'violet' | 'rose' | 'amber' | 'indigo' | 'teal' | 'orange';
  scope: CategoryScope;
  created_at: Date;
  icon?: string;
}

export interface Purpose {
  id: string;
  title: string;
  icon?: string;
  domain_ids?: string[];
  created_at: Date;
  sort_order?: number;
}

export interface Domain {
  id: string;
  title: string;
  name?: string;
  color?: string;
  icon?: string;
  created_at: Date;
  sort_order?: number;
}

export interface TimerState {
  taskId: string | null;
  isRunning: boolean;
  startTime: number | null; // Date.now() when started or resumed
  elapsedAtStart: number; // accumulated time before this run session
}

// ─── Dynamic Unified Entity Architecture ────────────────────────────────────
export type EntityColor =
  | 'indigo'
  | 'sky'
  | 'amber'
  | 'emerald'
  | 'rose'
  | 'violet'
  | 'teal'
  | 'orange'
  | 'cyan'
  | 'fuchsia';

export interface EntityTypeDefinition {
  id: string; // 'purpose' | 'domain' | 'goal' | 'objective' | 'habit' | 'custom-*'
  name: string; // 'Goal', 'Project', 'Skill', 'Book'
  plural_name?: string; // 'Goals', 'Projects'
  color: EntityColor;
  icon: string; // Lucide icon name
  is_system?: boolean; // true for built-in 5 types
  has_status?: boolean; // supports active/achieved/todo/done
  has_time_tracking?: boolean; // supports logged focus time
  is_schedulable?: boolean; // can schedule tasks to today view
  sort_order?: number;
}

export interface UnifiedEntity {
  id: string;
  entity_type: string; // references EntityTypeDefinition.id
  title: string;
  content?: string; // Markdown notes, vision, strategy
  status?: 'active' | 'todo' | 'done' | 'achieved' | 'archived' | string;
  icon?: string;
  color?: EntityColor;
  time_spent?: number; // accumulated milliseconds
  parent_ids?: string[]; // generic multi-parent links across any entity type
  created_at: Date;
  scheduled_at?: Date;
  completed_at?: Date;
  achieved_at?: Date;
  sort_order?: number;
}

