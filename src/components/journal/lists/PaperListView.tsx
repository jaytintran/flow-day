/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { ClipboardList, Printer, Check } from 'lucide-react';
import { Task, TimelineEntry } from '../../../types';

interface PaperListViewProps {
  tasks: Task[];
  onToggleTaskStatus: (task: Task) => void;
  onOpenDetail: (entry: TimelineEntry) => void;
  onContextMenu?: (task: Task, e: React.MouseEvent) => void;
}

export default function PaperListView({
  tasks,
  onToggleTaskStatus,
  onOpenDetail,
  onContextMenu,
}: PaperListViewProps) {
  const activeTasks = tasks.filter((t) => t.status !== 'done');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0e0e0e] border border-stone-800/80 rounded-2xl">
      {/* Clean Compact Bar */}
      <div className="px-5 py-2.5 border-b border-stone-800/60 flex items-center justify-between gap-3 shrink-0 bg-[#141414]/80">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-amber-400" />
          <span className="font-mono text-xs font-bold text-stone-200">
            Paper List
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] text-stone-400 bg-stone-900 border border-stone-800 px-2.5 py-0.5 rounded-lg">
            {activeTasks.length} pending · {doneTasks.length} done
          </span>
          <button
            onClick={() => window.print()}
            className="p-1 rounded-lg border border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
            title="Print Paper List"
          >
            <Printer className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* List Body */}
      <div
        className="flex-1 overflow-y-auto p-6 space-y-6 font-mono text-xs"
        style={{ scrollbarWidth: 'thin' }}
      >
        {activeTasks.length === 0 && doneTasks.length === 0 && (
          <p className="text-stone-600 text-center py-20">
            No tasks in your backlog.
          </p>
        )}

        {activeTasks.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-amber-500/90 mb-3">
              To Do ({activeTasks.length})
            </h4>
            {activeTasks.map((t) => (
              <div
                key={t.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (onContextMenu) onContextMenu(t, e);
                }}
                className="flex items-start gap-3 py-2 border-b border-stone-800/50 group hover:border-stone-700 transition-colors cursor-pointer"
              >
                <button
                  onClick={() => onToggleTaskStatus(t)}
                  className="w-4 h-4 mt-0.5 rounded border border-stone-600 hover:border-amber-400 flex items-center justify-center shrink-0 cursor-pointer"
                />
                <span
                  onClick={() => onOpenDetail(t)}
                  className="text-stone-200 flex-1 min-w-0 cursor-pointer hover:text-amber-300 transition-colors"
                >
                  {t.title}
                </span>
              </div>
            ))}
          </div>
        )}

        {doneTasks.length > 0 && (
          <div className="space-y-2 pt-6">
            <h4 className="text-[10px] uppercase font-bold tracking-widest text-emerald-500/80 mb-3">
              Completed ({doneTasks.length})
            </h4>
            {doneTasks.map((t) => (
              <div
                key={t.id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (onContextMenu) onContextMenu(t, e);
                }}
                className="flex items-start gap-3 py-1.5 border-b border-stone-900/40 opacity-50 line-through group cursor-pointer"
              >
                <button
                  onClick={() => onToggleTaskStatus(t)}
                  className="w-4 h-4 mt-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 cursor-pointer"
                >
                  <Check className="w-2.5 h-2.5 stroke-[3]" />
                </button>
                <span
                  onClick={() => onOpenDetail(t)}
                  className="text-stone-400 flex-1 min-w-0 cursor-pointer"
                >
                  {t.title}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
