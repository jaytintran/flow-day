import Dexie, { type Table } from 'dexie';
import {
  TimelineEntry,
  Habit,
  Category,
  Purpose,
  Domain,
  ListFolder,
  EntityTypeDefinition,
  UnifiedEntity,
} from './types';

export class PersonalTimelineDB extends Dexie {
  entries!: Table<TimelineEntry>;
  habits!: Table<Habit>;
  categories!: Table<Category>;
  purposes!: Table<Purpose>;
  domains!: Table<Domain>;
  list_folders!: Table<ListFolder>;
  entities!: Table<UnifiedEntity>;
  entity_types!: Table<EntityTypeDefinition>;

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
    this.version(11).stores({
      entries:
        'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id, scheduled_at, habit_id, *category_ids, sort_order, *purpose_ids',
      habits: 'id, status, sort_order, *purpose_ids',
      categories: 'id, name, scope, [scope+name]',
      purposes: 'id, sort_order, *domain_ids',
      domains: 'id, sort_order',
    });
    this.version(12).stores({
      entries:
        'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id, scheduled_at, habit_id, *category_ids, sort_order, *purpose_ids, *domain_ids',
      habits: 'id, status, sort_order, *purpose_ids, *domain_ids',
      categories: 'id, name, scope, [scope+name]',
      purposes: 'id, sort_order, *domain_ids',
      domains: 'id, sort_order',
    });
    this.version(13).stores({
      entries:
        'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id, scheduled_at, habit_id, *category_ids, sort_order, *purpose_ids, *domain_ids, starred',
      habits: 'id, status, sort_order, *purpose_ids, *domain_ids',
      categories: 'id, name, scope, [scope+name]',
      purposes: 'id, sort_order, *domain_ids',
      domains: 'id, sort_order',
    });
    this.version(14).stores({
      entries:
        'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id, scheduled_at, habit_id, *category_ids, sort_order, *purpose_ids, *domain_ids, starred, folder_id, is_accomplishment',
      habits: 'id, status, sort_order, *purpose_ids, *domain_ids',
      categories: 'id, name, scope, [scope+name]',
      purposes: 'id, sort_order, *domain_ids',
      domains: 'id, sort_order',
      list_folders: 'id, list_id, sort_order, created_at',
    });
    this.version(15)
      .stores({
        entries:
          'id, type, created_at, status, timestamp, start_at, end_at, title, carried_to, objective_id, goal_id, scheduled_at, habit_id, *category_ids, sort_order, *purpose_ids, *domain_ids, starred, folder_id, is_accomplishment',
        habits: 'id, status, sort_order, *purpose_ids, *domain_ids',
        categories: 'id, name, scope, [scope+name]',
        purposes: 'id, sort_order, *domain_ids',
        domains: 'id, sort_order',
        list_folders: 'id, list_id, sort_order, created_at',
        entities: 'id, entity_type, status, created_at, scheduled_at, *parent_ids, sort_order',
        entity_types: 'id, name, is_system, sort_order',
      })
      .upgrade(async (tx) => {
        // 1. Seed Built-in System Entity Types
        const defaultEntityTypes: EntityTypeDefinition[] = [
          {
            id: 'purpose',
            name: 'Purpose',
            plural_name: 'Purposes',
            color: 'indigo',
            icon: 'Compass',
            is_system: true,
            has_status: false,
            has_time_tracking: false,
            is_schedulable: false,
            sort_order: 0,
          },
          {
            id: 'domain',
            name: 'Domain',
            plural_name: 'Domains',
            color: 'sky',
            icon: 'Layers',
            is_system: true,
            has_status: false,
            has_time_tracking: false,
            is_schedulable: false,
            sort_order: 1,
          },
          {
            id: 'goal',
            name: 'Goal',
            plural_name: 'Goals',
            color: 'amber',
            icon: 'Target',
            is_system: true,
            has_status: true,
            has_time_tracking: true,
            is_schedulable: true,
            sort_order: 2,
          },
          {
            id: 'objective',
            name: 'Objective',
            plural_name: 'Objectives',
            color: 'emerald',
            icon: 'CheckCircle2',
            is_system: true,
            has_status: true,
            has_time_tracking: true,
            is_schedulable: true,
            sort_order: 3,
          },
          {
            id: 'habit',
            name: 'Habit',
            plural_name: 'Habits',
            color: 'rose',
            icon: 'Repeat2',
            is_system: true,
            has_status: true,
            has_time_tracking: false,
            is_schedulable: false,
            sort_order: 4,
          },
        ];

        for (const typeDef of defaultEntityTypes) {
          const existing = await tx.table('entity_types').get(typeDef.id);
          if (!existing) {
            await tx.table('entity_types').add(typeDef);
          }
        }

        // 2. Migrate existing Purposes
        const oldPurposes = await tx.table('purposes').toArray();
        for (const p of oldPurposes) {
          const existing = await tx.table('entities').get(p.id);
          if (!existing) {
            await tx.table('entities').add({
              id: p.id,
              entity_type: 'purpose',
              title: p.title || 'Untitled Purpose',
              icon: p.icon || 'Compass',
              content: p.description || p.content || '',
              color: 'indigo',
              parent_ids: p.domain_ids || [],
              sort_order: p.sort_order || 0,
              created_at: p.created_at || new Date(),
            });
          }
        }

        // 3. Migrate existing Domains
        const oldDomains = await tx.table('domains').toArray();
        for (const d of oldDomains) {
          const existing = await tx.table('entities').get(d.id);
          if (!existing) {
            await tx.table('entities').add({
              id: d.id,
              entity_type: 'domain',
              title: d.name || d.title || 'Untitled Domain',
              icon: d.icon || 'Layers',
              color: 'sky',
              content: d.description || d.content || '',
              parent_ids: [],
              sort_order: d.sort_order || 0,
              created_at: d.created_at || new Date(),
            });
          }
        }

        // 4. Migrate existing Habits
        const oldHabits = await tx.table('habits').toArray();
        for (const h of oldHabits) {
          const existing = await tx.table('entities').get(h.id);
          if (!existing) {
            await tx.table('entities').add({
              id: h.id,
              entity_type: 'habit',
              title: h.title || 'Untitled Habit',
              icon: h.icon || 'Repeat2',
              status: h.status || 'active',
              color: 'rose',
              content: h.description || h.content || '',
              parent_ids: h.purpose_ids || [],
              sort_order: h.sort_order || 0,
              created_at: h.created_at || new Date(),
            });
          }
        }

        // 5. Migrate existing Goals & Objectives
        const oldEntries = await tx.table('entries').toArray();
        for (const e of oldEntries) {
          if (e.type === 'goal' || e.type === 'objective') {
            const existing = await tx.table('entities').get(e.id);
            if (!existing) {
              const parentIds: string[] = [];
              if (e.goal_id) parentIds.push(e.goal_id);
              if (e.purpose_ids) parentIds.push(...e.purpose_ids);
              if (e.domain_ids) parentIds.push(...e.domain_ids);

              await tx.table('entities').add({
                id: e.id,
                entity_type: e.type,
                title: e.title || `Untitled ${e.type}`,
                content: e.content || '',
                status: e.status || (e.type === 'goal' ? 'active' : 'todo'),
                icon: e.icon || (e.type === 'goal' ? 'Target' : 'CheckCircle2'),
                color: e.type === 'goal' ? 'amber' : 'emerald',
                time_spent: e.time_spent || 0,
                parent_ids: parentIds,
                sort_order: e.sort_order || 0,
                created_at: e.created_at || new Date(),
                scheduled_at: e.scheduled_at,
                completed_at: e.completed_at,
                achieved_at: e.achieved_at,
              });
            }
          }
        }
      });
  }
}

export const db = new PersonalTimelineDB();
