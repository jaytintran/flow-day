/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo } from 'react';
import { Trophy, Sparkles, Calendar, Star } from 'lucide-react';
import { db } from '../../../db';
import { Task, Category, TimelineEntry } from '../../../types';
import CategoryIcon from '../../CategoryIcon';

export const CATEGORY_COLORS: Record<string, string> = {
  emerald: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
  sky: 'border-sky-500/30 text-sky-400 bg-sky-500/10',
  violet: 'border-violet-500/30 text-violet-400 bg-violet-500/10',
  rose: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
  amber: 'border-amber-500/30 text-amber-400 bg-amber-500/10',
  teal: 'border-teal-500/30 text-teal-400 bg-teal-500/10',
  indigo: 'border-indigo-500/30 text-indigo-400 bg-indigo-500/10',
  orange: 'border-orange-500/30 text-orange-400 bg-orange-500/10',
};

interface TrophyViewProps {
  tasks: Task[];
  taskLists: Category[];
  onOpenDetail: (entry: TimelineEntry) => void;
  onToggleAccomplishment: (task: Task) => void;
  onContextMenu?: (task: Task, e: React.MouseEvent) => void;
}

export default function TrophyView({
  tasks,
  taskLists,
  onOpenDetail,
  onToggleAccomplishment,
  onContextMenu,
}: TrophyViewProps) {
  const accomplishmentTasks = useMemo(() => {
    return tasks.filter(
      (t) => t.status === 'done' && t.is_accomplishment === true,
    );
  }, [tasks]);

  const monthGroups = useMemo(() => {
    const map = new Map<
      string,
      { key: string; label: string; year: number; tasks: Task[] }
    >();

    for (const task of accomplishmentTasks) {
      const date = task.completed_at
        ? new Date(task.completed_at)
        : new Date(task.created_at);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${String(month).padStart(2, '0')}`;

      if (!map.has(key)) {
        const label = date.toLocaleString('en-US', {
          month: 'long',
          year: 'numeric',
        });
        map.set(key, { key, label, year, tasks: [] });
      }
      map.get(key)!.tasks.push(task);
    }

    const groups = Array.from(map.values()).sort((a, b) =>
      b.key.localeCompare(a.key),
    );

    for (const group of groups) {
      group.tasks.sort((a, b) => {
        const dateA = a.completed_at
          ? new Date(a.completed_at).getTime()
          : new Date(a.created_at).getTime();
        const dateB = b.completed_at
          ? new Date(b.completed_at).getTime()
          : new Date(b.created_at).getTime();
        return dateB - dateA;
      });
    }

    return groups;
  }, [accomplishmentTasks]);

  let lastDisplayedYear: number | null = null;

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0c0c0c] border border-stone-800/80 rounded-2xl">
      {/* Clean Compact Bar */}
      <div className="px-5 py-2.5 border-b border-stone-800/60 flex items-center justify-between gap-3 shrink-0 bg-[#121212]/80">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-400 fill-amber-400" />
          <span className="font-mono text-xs font-bold text-amber-400">
            Accomplishments
          </span>
        </div>
        <span
          className="font-mono text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-lg"
          style={{
            textShadow:
              '0 0 8px rgba(245, 158, 11, 0.5), 0 0 16px rgba(245, 158, 11, 0.25)',
          }}
        >
          {accomplishmentTasks.length} total
        </span>
      </div>

      {/* Content */}
      <div
        className="flex-1 overflow-y-auto px-5 py-4 space-y-6 scrollbar-none"
        style={{ scrollbarWidth: 'none' }}
      >
        {accomplishmentTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <Trophy className="w-12 h-12 text-stone-800" />
            <h4 className="font-mono font-medium text-xs text-stone-400">
              No accomplishments marked yet.
            </h4>
            <p className="text-stone-600 text-xs font-mono max-w-sm">
              In the Completed status view, click the Trophy icon on any task to add it here.
            </p>
          </div>
        ) : (
          monthGroups.map((group) => {
            let yearHeader = null;
            if (lastDisplayedYear !== group.year) {
              lastDisplayedYear = group.year;
              yearHeader = (
                <div
                  className="flex items-center gap-2 mb-2"
                  key={`year-${group.year}`}
                >
                  <span className="font-mono text-[10px] text-amber-500/80 uppercase tracking-[0.2em] font-bold">
                    {group.year}
                  </span>
                  <div className="flex-1 h-px bg-amber-500/20" />
                </div>
              );
            }

            return (
              <div key={group.key}>
                {yearHeader}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-[11px] text-stone-400 uppercase tracking-widest font-semibold">
                    {group.label}
                  </span>
                  <span className="font-mono text-[10px] text-stone-600 font-mono">
                    {group.tasks.length}{' '}
                    {group.tasks.length === 1 ? 'win' : 'wins'}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                  {group.tasks.map((task) => {
                    const taskCategories = (task.category_ids ?? [])
                      .map((id) => taskLists.find((list) => list.id === id))
                      .filter((list): list is Category => !!list);

                    const completedDateObj = task.completed_at
                      ? new Date(task.completed_at)
                      : new Date(task.created_at);
                    const completedFormatted = completedDateObj.toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: '2-digit',
                      year: '2-digit',
                    });

                    return (
                      <div
                        key={task.id}
                        onClick={() => onOpenDetail(task)}
                        onContextMenu={(e) => {
                          if (onContextMenu) {
                            e.preventDefault();
                            onContextMenu(task, e);
                          }
                        }}
                        className="bg-[#121212] border border-amber-500/30 hover:border-amber-500/60 rounded-xl p-3 flex flex-col justify-between gap-2.5 transition-all cursor-pointer group shadow-[0_0_12px_rgba(245,158,11,0.06)]"
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_6px_rgba(245,158,11,0.2)]">
                            <Trophy className="w-3 h-3 fill-current" />
                          </div>

                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-serif font-semibold text-stone-200 group-hover:text-amber-200 leading-snug line-clamp-2 transition-colors">
                              {task.title}
                            </span>
                            {task.content && task.content.trim() && (
                              <p className="text-[10px] font-mono text-stone-500 mt-1 line-clamp-2 leading-relaxed">
                                {task.content}
                              </p>
                            )}

                            {(() => {
                              const wins =
                                task.micro_wins || task.achievements || [];
                              if (wins.length === 0) return null;
                              return (
                                <div className="flex flex-col gap-1 mt-2 pt-2 border-t border-stone-850/60">
                                  {wins.slice(0, 2).map((w: any) => (
                                    <span
                                      key={w.id}
                                      className="text-[10px] font-mono text-stone-400 flex items-center gap-1.5 truncate"
                                    >
                                      <Sparkles className="w-2.5 h-2.5 text-amber-500/80 shrink-0" />
                                      <span className="truncate">{w.text}</span>
                                    </span>
                                  ))}
                                  {wins.length > 2 && (
                                    <span className="text-[9px] font-mono text-stone-600 pl-4">
                                      +{wins.length - 2} more outcome
                                      {wins.length - 2 > 1 ? 's' : ''}
                                    </span>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="flex items-center justify-between flex-wrap gap-1 pt-2 border-t border-stone-800/80 mt-auto">
                          <div className="flex items-center flex-wrap gap-1">
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider bg-stone-900 border border-stone-800 text-stone-400">
                              <Calendar className="w-2.5 h-2.5 text-amber-500/70" />
                              {completedFormatted}
                            </span>

                            {taskCategories.map((cat) => {
                              const colorClass =
                                CATEGORY_COLORS[cat.color] ??
                                CATEGORY_COLORS.violet;
                              return (
                                <span
                                  key={cat.id}
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border shrink-0 ${colorClass}`}
                                >
                                  <CategoryIcon
                                    name={cat.icon}
                                    color={cat.color}
                                    className="w-2.5 h-2.5"
                                    fallback="ListTodo"
                                  />
                                  {cat.name}
                                </span>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                await db.entries.update(task.id, {
                                  starred: !task.starred,
                                } as any);
                              }}
                              className={`p-1 rounded transition-colors ${
                                task.starred
                                  ? 'text-amber-400 hover:text-amber-300'
                                  : 'text-stone-500 hover:text-amber-400'
                              }`}
                              title={task.starred ? 'Remove from Day Highlights' : 'Add to Day Highlights'}
                            >
                              <Star
                                className={`w-3 h-3 ${task.starred ? 'fill-amber-400' : ''}`}
                              />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onToggleAccomplishment(task);
                              }}
                              className="text-[9px] font-mono text-stone-500 hover:text-red-400 transition-colors px-1"
                              title="Remove from accomplishments"
                            >
                              Unmark
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
