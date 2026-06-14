/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Dexie, { type Table } from 'dexie';
import { TimelineEntry, Habit, Category } from './types';

export class PersonalTimelineDB extends Dexie {
  entries!: Table<TimelineEntry>;
  habits!: Table<Habit>;
  categories!: Table<Category>;

  constructor() {
    super('PersonalTimelineDB');
    this.version(1).stores({
      entries: 'id, type, created_at, status, timestamp, start_at, end_at, title',
    });
    this.version(2).stores({
      entries: 'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to',
    });
    this.version(3).stores({
      entries:
        'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id',
    });
    this.version(4).stores({
      entries:
        'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id',
    });
    this.version(5).stores({
      entries:
        'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id, scheduled_at',
    });
    this.version(6).stores({
      entries:
        'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id, scheduled_at, habit_id',
      habits: 'id, status',
    });
    this.version(7).stores({
      entries:
        'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id, scheduled_at, habit_id, category_id',
      habits: 'id, status',
    });
    this.version(8).stores({
      entries:
        'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id, scheduled_at, habit_id, category_id',
      habits: 'id, status',
      categories: 'id, name, scope, [scope+name]',
    });
    this.version(9).stores({
      entries:
        'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id, scheduled_at, habit_id, *category_ids',
      habits: 'id, status',
      categories: 'id, name, scope, [scope+name]',
    });
    this.version(10)
      .stores({
        entries:
          'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id, scheduled_at, habit_id, *category_ids, sort_order',
        habits: 'id, status, sort_order',
        categories: 'id, name, scope, [scope+name]',
      })
      .upgrade(async (tx) => {
        // Assign sort_order to existing goals, objectives, and habits that lack it
        const entries = await tx.table('entries').toArray();
        const goals = entries.filter((e: any) => e.type === 'goal' && e.sort_order === undefined);
        const objectives = entries.filter(
          (e: any) => e.type === 'objective' && e.sort_order === undefined,
        );
        for (let i = 0; i < goals.length; i++) {
          await tx.table('entries').update(goals[i].id, { sort_order: i });
        }
        for (let i = 0; i < objectives.length; i++) {
          await tx.table('entries').update(objectives[i].id, { sort_order: i });
        }
        const habits = await tx.table('habits').toArray();
        const unparented = habits.filter((h: any) => h.sort_order === undefined);
        for (let i = 0; i < unparented.length; i++) {
          await tx.table('habits').update(unparented[i].id, { sort_order: i });
        }
      });
  }
}

export const db = new PersonalTimelineDB();
