/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  Check,
  CircleDashed,
  X,
  HelpCircle,
  Trophy,
  FileText,
  Calendar,
  Play,
  ListTodo,
  FolderInput,
  Trash2,
} from 'lucide-react';
import { db } from '../../../db';
import { Task, Category, ListFolder, TimelineEntry } from '../../../types';
import SortableRow from '../../SortableRow';
import CategoryIcon from '../../CategoryIcon';
import { CATEGORY_COLORS } from './TrophyView';

interface DesktopTaskCardProps {
  task: Task;
  activeTaskId: string | null;
  deletingId: string | null;
  taskLists: Category[];
  selectedListId?: string;
  availableFolders?: ListFolder[];
  onDeleteEntry: (id: string) => void;
  onOpenDetail: (entry: TimelineEntry) => void;
  onToggleTaskStatus: (task: Task) => void;
  onOpenStatusModal: (task: Task) => void;
  onActivateTask: (taskId: string) => void;
  onOpenScheduleModal: (task: Task) => void;
  onOpenListPicker: (task: Task) => void;
  onOpenFolderPicker?: (task: Task) => void;
  onToggleAccomplishment?: (task: Task) => void;
  showContent?: boolean;
  onContextMenu?: (task: Task, e: React.MouseEvent) => void;
}

export default function DesktopTaskCard({
  task,
  activeTaskId,
  deletingId,
  taskLists,
  selectedListId,
  availableFolders,
  onDeleteEntry,
  onOpenDetail,
  onToggleTaskStatus,
  onOpenStatusModal,
  onActivateTask,
  onOpenScheduleModal,
  onOpenListPicker,
  onOpenFolderPicker,
  onToggleAccomplishment,
  showContent = true,
  onContextMenu,
}: DesktopTaskCardProps) {
  const isActive = activeTaskId === task.id;
  const isDone = task.status === 'done';
  const isDropped = task.status === 'dropped';
  const isInProgress = task.status === 'in_progress';
  const isMaybe = task.status === 'maybe';
  const isAccomplishment =
    task.is_accomplishment ||
    task.starred ||
    (task.achievements && task.achievements.length > 0);

  const taskCategories = (task.category_ids ?? [])
    .map((id) => taskLists.find((list) => list.id === id))
    .filter((list): list is Category => !!list && list.id !== selectedListId);

  return (
    <SortableRow id={task.id} hideHandle>
      <div
        onClick={() => onOpenDetail(task)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (onContextMenu) onContextMenu(task, e);
        }}
        className={`group relative flex flex-col justify-between gap-2.5 p-3 rounded-xl border transition-all cursor-pointer select-none min-h-[90px] ${
          isActive
            ? 'bg-amber-500/10 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
            : isDone
              ? isAccomplishment
                ? 'bg-[#161410] border-amber-500/30 hover:border-amber-500/50'
                : 'bg-[#111]/40 border-stone-850 opacity-70 hover:opacity-100 hover:border-stone-700'
              : isDropped
                ? 'bg-rose-950/10 border-rose-900/30 opacity-60'
                : isMaybe
                  ? 'bg-indigo-950/10 border-indigo-900/30 opacity-80'
                  : 'bg-[#131313] border-stone-800/80 hover:border-stone-700 hover:bg-[#161616]'
        }`}
      >
        {/* Top Row: Checkbox + Title + Trophy */}
        <div className="flex items-start gap-2.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenStatusModal(task);
            }}
            className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95 ${
              isDone
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]'
                : isInProgress
                  ? 'border-amber-500/50 bg-amber-500/10 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                  : isDropped
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                    : isMaybe
                      ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                      : 'border-stone-700 hover:border-stone-500 bg-stone-900/80 text-stone-400 hover:text-stone-200'
            }`}
            title="Click to change status"
          >
            {isDone && <Check className="w-2.5 h-2.5 stroke-[3]" />}
            {isInProgress && (
              <CircleDashed className="w-2.5 h-2.5 text-amber-400 stroke-[2.5]" />
            )}
            {isDropped && <X className="w-2.5 h-2.5 stroke-[2.5]" />}
            {isMaybe && <HelpCircle className="w-2.5 h-2.5 stroke-[2.5]" />}
          </button>

          <div className="flex-1 min-w-0">
            <span
              className={`text-xs font-serif font-semibold leading-snug line-clamp-2 transition-colors ${
                isDone
                  ? isAccomplishment
                    ? 'text-stone-300'
                    : 'line-through text-stone-500'
                  : isDropped
                    ? 'line-through text-stone-500'
                    : 'text-stone-200 group-hover:text-amber-200'
              }`}
            >
              {isAccomplishment && <span className="mr-1">🏆</span>}
              {task.title}
            </span>
          </div>

          {isDone && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onToggleAccomplishment) {
                  onToggleAccomplishment(task);
                } else {
                  db.entries.update(task.id, {
                    is_accomplishment: !task.is_accomplishment,
                  } as any);
                }
              }}
              className={`p-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
                task.is_accomplishment
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.25)]'
                  : 'bg-stone-900/40 border-stone-800 text-stone-600 hover:text-amber-400'
              }`}
              title="Toggle Accomplishment"
            >
              <Trophy
                className={`w-3 h-3 ${
                  task.is_accomplishment ? 'fill-amber-400' : ''
                }`}
              />
            </button>
          )}
        </div>

        {/* Bottom Row: Badges on Left, Actions on Right */}
        <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-stone-850/60 mt-auto min-h-[26px]">
          {/* Badges on Left */}
          <div className="flex items-center gap-1 flex-wrap min-w-0">
            {task.content && task.content.trim() && (
              <span
                className="inline-flex items-center justify-center p-0.5 rounded bg-stone-900/80 border border-stone-800 text-stone-400 hover:text-amber-300 transition-colors shrink-0"
                title="Has description"
              >
                <FileText className="w-2.5 h-2.5 text-stone-400" />
              </span>
            )}

            {task.scheduled_at && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
                <Calendar className="w-2.5 h-2.5" />
                {new Date(task.scheduled_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            )}

            {taskCategories.map((cat) => (
              <span
                key={cat.id}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider border shrink-0 ${
                  CATEGORY_COLORS[cat.color] ?? CATEGORY_COLORS.violet
                }`}
              >
                <CategoryIcon
                  name={cat.icon}
                  color={cat.color}
                  className="w-2.5 h-2.5"
                  fallback="ListTodo"
                />
                {cat.name}
              </span>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStatusModal(task);
              }}
              className="p-1 rounded text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Change status"
            >
              <CircleDashed className="w-3 h-3" />
            </button>

            {!isDone && !isDropped && !isActive && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onActivateTask(task.id);
                }}
                className="p-1 rounded text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition-colors cursor-pointer"
                title="Activate timer"
              >
                <Play className="w-3 h-3 fill-current" />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenScheduleModal(task);
              }}
              className="p-1 rounded text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Schedule date"
            >
              <Calendar className="w-3 h-3" />
            </button>

            {taskLists.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenListPicker(task);
                }}
                className="p-1 rounded text-stone-400 hover:text-violet-400 hover:bg-stone-800 transition-colors cursor-pointer"
                title="Assign to list"
              >
                <ListTodo className="w-3 h-3" />
              </button>
            )}

            {/* Move to Folder */}
            {availableFolders && availableFolders.length > 0 && onOpenFolderPicker && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFolderPicker(task);
                }}
                className="p-1 rounded text-stone-400 hover:text-amber-300 hover:bg-stone-800 transition-colors cursor-pointer"
                title="Move to folder"
              >
                <FolderInput className="w-3 h-3" />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEntry(task.id);
              }}
              className={`p-1 rounded transition-colors cursor-pointer ${
                deletingId === task.id
                  ? 'text-red-400 bg-red-950/80 border border-red-800'
                  : 'text-stone-400 hover:text-red-400 hover:bg-stone-800'
              }`}
              title={
                deletingId === task.id ? 'Click again to confirm' : 'Delete'
              }
            >
              {deletingId === task.id ? (
                <span className="text-[8px] font-mono font-bold">Sure?</span>
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>
    </SortableRow>
  );
}
