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
    // Version 11: Add updated_at for sync support
    this.version(11)
      .stores({
        entries:
          'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id, scheduled_at, habit_id, *category_ids, sort_order, updated_at',
        habits: 'id, status, sort_order, updated_at',
        categories: 'id, name, scope, [scope+name], updated_at',
      })
      .upgrade(async (tx) => {
        // Backfill updated_at from created_at for all existing records
        const tables = ['entries', 'habits', 'categories'];
        for (const tableName of tables) {
          const records = await tx.table(tableName).toArray();
          for (const record of records) {
            if (!record.updated_at) {
              await tx
                .table(tableName)
                .update(record.id, { updated_at: record.created_at || new Date() });
            }
          }
        }
      });

    // Auto-stamp updated_at and notify sync engine on every mutation
    const triggerSync = (objOrMods?: any) => {
      // Check current transaction context for sync engine imports
      if (Dexie.currentTransaction && (Dexie.currentTransaction as any)._isSyncEngineImport) {
        return;
      }
      if (objOrMods && (objOrMods.__skipUpdatedAt || objOrMods._isSyncEngineImport)) {
        return;
      }
      
      // Trigger out-of-transaction to avoid blocking Dexie transactions
      setTimeout(() => {
        try {
          // Dynamically import to avoid circular dependency loop if syncEngine imports db.ts
          import('./syncEngine').then((module) => {
            module.notifyLocalChange();
          });
        } catch (e) {
          console.error('[DB Hook] Failed to notify change:', e);
        }
      }, 0);
    };

    this.entries.hook('creating', (_primKey, obj) => {
      if (obj.__skipUpdatedAt) return;
      obj.updated_at = new Date();
      if (!obj.created_at) obj.created_at = new Date();
      triggerSync(obj);
    });
    this.entries.hook('updating', (modifications, primKey, obj) => {
      if ((modifications as any).__skipUpdatedAt || (obj as any).__skipUpdatedAt) {
        return;
      }
      triggerSync(modifications);
      return { ...modifications, updated_at: new Date() };
    });
    this.entries.hook('deleting', () => {
      triggerSync();
    });

    this.habits.hook('creating', (_primKey, obj) => {
      if (obj.__skipUpdatedAt) return;
      obj.updated_at = new Date();
      if (!obj.created_at) obj.created_at = new Date();
      triggerSync(obj);
    });
    this.habits.hook('updating', (modifications, primKey, obj) => {
      if ((modifications as any).__skipUpdatedAt || (obj as any).__skipUpdatedAt) {
        return;
      }
      triggerSync(modifications);
      return { ...modifications, updated_at: new Date() };
    });
    this.habits.hook('deleting', () => {
      triggerSync();
    });

    this.categories.hook('creating', (_primKey, obj) => {
      if (obj.__skipUpdatedAt) return;
      obj.updated_at = new Date();
      if (!obj.created_at) obj.created_at = new Date();
      triggerSync(obj);
    });
    this.categories.hook('updating', (modifications, primKey, obj) => {
      if ((modifications as any).__skipUpdatedAt || (obj as any).__skipUpdatedAt) {
        return;
      }
      triggerSync(modifications);
      return { ...modifications, updated_at: new Date() };
    });
    this.categories.hook('deleting', () => {
      triggerSync();
    });
  }
}

export const db = new PersonalTimelineDB();
