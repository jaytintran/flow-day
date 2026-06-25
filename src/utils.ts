/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { TimelineEntry } from './types';

/**
 * Formats milliseconds into a high-precision digital clock string: HH:MM:SS
 */
export function formatDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}h ${pad(minutes)}m`;
  } else if (minutes > 0) {
    return `${pad(minutes)}m ${pad(seconds)}s`;
  } else {
    return `${pad(seconds)}s`;
  }
}

/**
 * Formats a Date object to a literal label like "Thu, Jun 5, 2026"
 */
export function formatDateLabel(date: Date): string {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  };
  const formatted = d.toLocaleDateString('en-US', options);

  if (isSameDay(d, today)) {
    return `Today, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } else if (isSameDay(d, yesterday)) {
    return `Yesterday, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } else if (isSameDay(d, tomorrow)) {
    return `Tomorrow, ${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }

  // Include year if it's not the current year
  if (d.getFullYear() !== today.getFullYear()) {
    return `${formatted}, ${d.getFullYear()}`;
  }
  return formatted;
}

/**
 * Helper to check if two Date objects fall on the same calendar day (in local time)
 */
export function isSameDay(d1: Date, d2: Date): boolean {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get the effective date for a timeline entry.
 * For tasks: uses `scheduled_at ?? created_at`.
 * For other types: always uses their natural timestamp.
 */
export function getEffectiveDate(entry: TimelineEntry): Date {
  return getPrimaryDate(entry);
}

/**
 * Get the primary date for an entry (ignores carried_to).
 * For tasks: prefers scheduled_at over created_at.
 * For events/notes: uses timestamp.
 * For time-blocks: uses start_at.
 */
export function getPrimaryDate(entry: TimelineEntry): Date {
  switch (entry.type) {
    case 'task':
      return entry.scheduled_at ? new Date(entry.scheduled_at) : new Date(entry.created_at);
    case 'event':
      return new Date(entry.timestamp);
    case 'note':
      return new Date(entry.timestamp);
    case 'log':
      return new Date(entry.timestamp);
    case 'habit-log':
      return new Date(entry.timestamp);
    case 'time-block':
      return new Date(entry.start_at);
    default:
      return new Date();
  }
}

/**
 * Get local date string YYYY-MM-DD
 */
export function toLocalDateString(date: Date): string {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = (d.getMonth() + 1).toString().padStart(2, '0');
  const dd = d.getDate().toString().padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

import { db } from './db';
import { Category } from './types';

export const TASK_LIST_SCOPE = 'task-list' as const;

/** Fetch all task-list categories, sorted by sort_order then created_at */
export async function getTaskLists(): Promise<Category[]> {
  const lists = await db.categories.where('scope').equals(TASK_LIST_SCOPE).toArray();

  return lists.sort((a, b) => {
    const aO = (a as any).sort_order ?? Date.parse(a.created_at.toString());
    const bO = (b as any).sort_order ?? Date.parse(b.created_at.toString());
    return aO - bO;
  });
}

/** Assign a task to a list (toggle: adds if absent, removes if present) */
export async function toggleTaskList(taskId: string, listId: string, currentIds: string[]) {
  const next = currentIds.includes(listId)
    ? currentIds.filter((id) => id !== listId)
    : [...currentIds, listId];
  await db.entries.update(taskId, { category_ids: next } as any);
}

/** When deleting a list, strip its id from all tasks that reference it */
export async function migrateTasksOnListDelete(listId: string) {
  const affected = await db.entries.where('category_ids').equals(listId).toArray();

  await db.transaction('rw', db.entries, async () => {
    for (const entry of affected) {
      const current = (entry as any).category_ids ?? [];
      await db.entries.update(entry.id, {
        category_ids: current.filter((id: string) => id !== listId),
      } as any);
    }
  });
}

/** Create a new task-list category */
export async function createTaskList(name: string, color: Category['color']): Promise<Category> {
  const existing = await getTaskLists();
  const list: Category = {
    id: crypto.randomUUID(),
    name,
    color,
    scope: TASK_LIST_SCOPE,
    created_at: new Date(),
  };
  // store sort_order by casting — Category type doesn't have it but Dexie schema does
  await db.categories.add({ ...list, sort_order: existing.length } as any);
  return list;
}
