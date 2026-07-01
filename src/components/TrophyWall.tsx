/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useMemo } from 'react';
import { Trophy, Star, Clock } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Task } from '../types';
import { formatDuration, toLocalDateString } from '../utils';

interface MonthGroup {
  key: string; // "2026-07"
  label: string; // "July 2026"
  year: number;
  tasks: Task[];
}

export default function TrophyWall() {
  // Fetch all completed tasks, then filter client-side for starred ones
  const doneTasks = useLiveQuery(
    () =>
      db.entries
        .where('type')
        .equals('task')
        .and((e) => (e as Task).status === 'done')
        .toArray() as Promise<Task[]>,
  );

  const starredTasks = useMemo(() => {
    if (!doneTasks) return [];
    return doneTasks.filter(
      (t) => t.is_starred === true || (t.achievements && t.achievements.length > 0),
    );
  }, [doneTasks]);

  // Group by month/year, sorted newest first
  const monthGroups = useMemo(() => {
    const map = new Map<string, MonthGroup>();

    for (const task of starredTasks) {
      const date = task.completed_at ? new Date(task.completed_at) : new Date(task.created_at);
      const year = date.getFullYear();
      const month = date.getMonth(); // 0-11
      const key = `${year}-${String(month).padStart(2, '0')}`;

      if (!map.has(key)) {
        const label = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
        map.set(key, { key, label, year, tasks: [] });
      }
      map.get(key)!.tasks.push(task);
    }

    // Sort groups newest first
    const groups = Array.from(map.values()).sort((a, b) => b.key.localeCompare(a.key));

    // Sort tasks within each group newest first
    for (const group of groups) {
      group.tasks.sort((a, b) => {
        const dateA = a.completed_at ? new Date(a.completed_at).getTime() : new Date(a.created_at).getTime();
        const dateB = b.completed_at ? new Date(b.completed_at).getTime() : new Date(b.created_at).getTime();
        return dateB - dateA;
      });
    }

    return groups;
  }, [starredTasks]);

  const totalCount = starredTasks.length;

  // Format a completion date nicely
  const formatCompletionDate = (task: Task): string => {
    const date = task.completed_at ? new Date(task.completed_at) : new Date(task.created_at);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Empty state
  if (doneTasks && starredTasks.length === 0) {
    return (
      <div className="bg-[#0e0e0e] rounded-xl border border-stone-800 p-8">
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <Trophy className="w-10 h-10 text-stone-700" />
          <p className="text-stone-500 text-xs font-mono leading-relaxed max-w-xs">
            No starred achievements yet. Complete tasks and star them to build your trophy wall!
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (!doneTasks) {
    return (
      <div className="bg-[#0e0e0e] rounded-xl border border-stone-800 p-8">
        <div className="flex items-center justify-center py-8">
          <span className="text-stone-600 text-xs font-mono">Loading...</span>
        </div>
      </div>
    );
  }

  // Track displayed years for year separator headers
  let lastDisplayedYear: number | null = null;

  return (
    <div className="bg-[#0e0e0e] rounded-xl border border-stone-800">
      {/* Header with total count and golden glow */}
      <div className="px-5 py-4 border-b border-stone-800 flex items-center gap-3">
        <Trophy className="w-4 h-4 text-amber-500" />
        <span className="font-mono text-xs text-stone-300 uppercase tracking-widest font-bold">
          Trophy Wall
        </span>
        <span
          className="ml-auto font-mono text-xs font-bold text-amber-400"
          style={{ textShadow: '0 0 8px rgba(245, 158, 11, 0.5), 0 0 16px rgba(245, 158, 11, 0.25)' }}
        >
          {totalCount} {totalCount === 1 ? 'star' : 'stars'}
        </span>
      </div>

      {/* Scrollable content */}
      <div className="max-h-[60vh] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-5 py-4">
        <div className="flex flex-col gap-5">
          {monthGroups.map((group) => {
            // Show year header when year changes
            let yearHeader = null;
            if (lastDisplayedYear !== group.year) {
              lastDisplayedYear = group.year;
              yearHeader = (
                <div className="flex items-center gap-2 mb-1" key={`year-${group.year}`}>
                  <span className="font-mono text-[10px] text-stone-600 uppercase tracking-[0.2em] font-bold">
                    {group.year}
                  </span>
                  <div className="flex-1 h-px bg-stone-800/60" />
                </div>
              );
            }

            return (
              <div key={group.key}>
                {yearHeader}

                {/* Month header with count */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[11px] text-stone-400 uppercase tracking-widest font-semibold">
                    {group.label}
                  </span>
                  <span className="font-mono text-[10px] text-stone-600">
                    {group.tasks.length} {group.tasks.length === 1 ? 'task' : 'tasks'}
                  </span>
                </div>

                {/* Task list */}
                <div className="flex flex-col gap-2">
                  {group.tasks.map((task) => (
                    <div
                      key={task.id}
                      className="bg-stone-900/40 border border-stone-800/60 rounded-lg px-3.5 py-2.5 group hover:border-stone-700/60 transition-colors"
                    >
                      {/* Main task row */}
                      <div className="flex items-start gap-2.5">
                        {/* Star icon */}
                        <Star
                          className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0 fill-amber-500/30"
                        />

                        {/* Task info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-xs text-stone-200 leading-relaxed break-words">
                              {task.title}
                            </span>

                            {/* Achievement count badge */}
                            {task.achievements && task.achievements.length > 0 && (
                              <span className="shrink-0 flex items-center gap-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-1.5 py-0.5 text-[9px] font-mono font-bold">
                                🏆 {task.achievements.length}
                              </span>
                            )}
                          </div>

                          {/* Meta row: date + time spent */}
                          <div className="flex items-center gap-3 mt-1.5">
                            <span className="text-[10px] text-stone-500 font-mono">
                              {formatCompletionDate(task)}
                            </span>
                            {task.time_spent > 0 && (
                              <span className="flex items-center gap-1 text-[10px] text-stone-600 font-mono">
                                <Clock className="w-2.5 h-2.5" />
                                {formatDuration(task.time_spent)}
                              </span>
                            )}
                          </div>

                          {/* Achievement list */}
                          {task.achievements && task.achievements.length > 0 && (
                            <div className="mt-2 pl-1 border-l border-stone-800 ml-0.5">
                              {task.achievements.map((achievement) => (
                                <div
                                  key={achievement.id}
                                  className="flex items-start gap-1.5 py-0.5"
                                >
                                  <span className="text-amber-500/60 text-[9px] mt-px">▸</span>
                                  <span className="text-[10px] text-stone-500 leading-relaxed">
                                    {achievement.text}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
