/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Check,
  CircleDashed,
  X,
  HelpCircle,
  Trophy,
  FileText,
  Calendar,
  Clock,
  Play,
  Folder,
  Trash2,
} from 'lucide-react';
import { db } from '../../../db';
import { Task, Category, ListFolder, TimelineEntry } from '../../../types';
import { formatDuration } from '../../../utils';
import SortableRow from '../../SortableRow';
import CategoryIcon from '../../CategoryIcon';
import { CATEGORY_COLORS } from './TrophyView';

interface DesktopTaskRowProps {
  task: Task;
  activeTaskId: string | null;
  deletingId: string | null;
  taskLists: Category[];
  selectedListId?: string;
  availableFolders?: ListFolder[];
  isSelected?: boolean;
  onClickCard?: (task: Task, e: React.MouseEvent) => void;
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

export default function DesktopTaskRow({
  task,
  activeTaskId,
  deletingId,
  taskLists,
  selectedListId,
  availableFolders,
  isSelected = false,
  onClickCard,
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
}: DesktopTaskRowProps) {
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

  const taskFolder = task.folder_id
    ? availableFolders?.find((f) => f.id === task.folder_id)
    : null;

  const hasTimeSpent = (task.time_spent ?? 0) > 0;
  const achievementsCount = task.achievements?.length ?? 0;

  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const confirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimeoutRef.current) {
        clearTimeout(confirmTimeoutRef.current);
      }
    };
  }, []);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      confirmTimeoutRef.current = setTimeout(() => {
        setIsConfirmingDelete(false);
      }, 3000);
    } else {
      if (confirmTimeoutRef.current) clearTimeout(confirmTimeoutRef.current);
      setIsConfirmingDelete(false);
      onDeleteEntry(task.id);
    }
  };

  return (
    <SortableRow id={task.id} hideHandle>
      <div
        onClick={(e) => {
          if (onClickCard) {
            onClickCard(task, e);
          } else {
            onOpenDetail(task);
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (onContextMenu) onContextMenu(task, e);
        }}
        className={`group relative flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl border transition-all duration-150 hover:-translate-y-0.5 cursor-pointer select-none min-h-[44px] ${
          isSelected
            ? 'bg-violet-500/15 border-violet-500/60 ring-2 ring-violet-500/40 shadow-[0_0_12px_rgba(139,92,246,0.15)]'
            : isActive
              ? 'bg-[#18140a] border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.15)] ring-1 ring-amber-500/30'
              : isDone
                ? isAccomplishment
                  ? 'bg-[#14120e] border-amber-500/30 hover:border-amber-500/50'
                  : 'bg-[#101010]/60 border-stone-850 opacity-65 hover:opacity-100 hover:border-stone-700'
                : isDropped
                  ? 'bg-rose-950/10 border-rose-900/30 opacity-60'
                  : isMaybe
                    ? 'bg-indigo-950/10 border-indigo-900/30 opacity-80'
                    : 'bg-[#141414] border-stone-800/80 hover:border-stone-700 hover:bg-[#181818]'
        }`}
      >
        {/* Left: Status Toggle + Title */}
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenStatusModal(task);
            }}
            className={`w-4 h-4 rounded-md border flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-90 ${
              isDone
                ? 'bg-emerald-500/20 border-emerald-500/45 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.25)]'
                : isInProgress
                  ? 'border-amber-500/60 bg-amber-500/15 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.25)] animate-pulse'
                  : isDropped
                    ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                    : isMaybe
                      ? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400'
                      : 'border-stone-700 hover:border-stone-500 bg-stone-900/90 text-stone-400 hover:text-stone-200'
            }`}
            title="Click to change status"
          >
            {isDone && <Check className="w-3 h-3 stroke-[2.5]" />}
            {isInProgress && (
              <CircleDashed className="w-3 h-3 text-amber-400 stroke-[2.5]" />
            )}
            {isDropped && <X className="w-3 h-3 stroke-[2.5]" />}
            {isMaybe && <HelpCircle className="w-3 h-3 stroke-[2.5]" />}
          </button>

          <span
            className={`text-xs font-serif font-medium truncate ${
              isDone
                ? isAccomplishment
                  ? 'text-stone-300 font-medium'
                  : 'line-through text-stone-500'
                : isDropped
                  ? 'line-through text-stone-500'
                  : 'text-stone-200'
            }`}
          >
            {isAccomplishment && <span className="mr-1">🏆</span>}
            {task.title}
          </span>

          {/* Note indicator */}
          {task.content && task.content.trim() && (
            <span
              className="inline-flex items-center text-stone-500 shrink-0"
              title="Has notes"
            >
              <FileText className="w-3 h-3" />
            </span>
          )}
        </div>

        {/* Right: Badges & Quick Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Folder Tag / Move Trigger */}
          {taskFolder ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenFolderPicker?.(task);
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono font-semibold bg-stone-900/90 border border-stone-800 text-amber-400/90 hover:border-amber-500/40 hover:text-amber-300 transition-all cursor-pointer shrink-0 max-w-[110px]"
              title={`Folder: ${taskFolder.name} (Click to change)`}
            >
              <Folder className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{taskFolder.name}</span>
            </button>
          ) : (
            availableFolders &&
            availableFolders.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenFolderPicker?.(task);
                }}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono bg-stone-900/60 border border-stone-800/80 text-stone-500 hover:text-stone-300 hover:border-stone-700 hover:bg-stone-850 transition-all cursor-pointer shrink-0"
                title="Move to folder"
              >
                <Folder className="w-2.5 h-2.5" />
                <span className="hidden xl:inline">+ Folder</span>
              </button>
            )
          )}

          {/* Scheduled Date */}
          {task.scheduled_at && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
              <Calendar className="w-2.5 h-2.5" />
              {new Date(task.scheduled_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          )}

          {/* Tracked Time */}
          {hasTimeSpent && (
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono uppercase tracking-wider border shrink-0 ${
                isActive
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse'
                  : 'bg-stone-900/80 border-stone-800 text-stone-400'
              }`}
              title={`Tracked: ${formatDuration(task.time_spent)}`}
            >
              <Clock className="w-2.5 h-2.5 text-amber-400" />
              <span>{formatDuration(task.time_spent)}</span>
            </span>
          )}

          {/* Category Badges */}
          {taskCategories.map((cat) => (
            <span
              key={cat.id}
              className={`hidden lg:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-mono uppercase tracking-wider border shrink-0 ${
                CATEGORY_COLORS[cat.color] ?? CATEGORY_COLORS.violet
              }`}
            >
              <CategoryIcon
                name={cat.icon}
                color={cat.color}
                className="w-2.5 h-2.5"
                fallback="ListTodo"
              />
              <span className="truncate max-w-[80px]">{cat.name}</span>
            </span>
          ))}

          {/* Accomplishment Toggle if Done */}
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
              className={`p-1 rounded-md border transition-all cursor-pointer shrink-0 ${
                task.is_accomplishment
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
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

          {/* Quick Timer Start (Discrete on Hover) */}
          {!isDone && !isDropped && !isActive && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onActivateTask(task.id);
              }}
              className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-900 border border-stone-800 hover:border-amber-500/40 text-stone-400 hover:text-amber-400 transition-all cursor-pointer text-[9px] font-mono shrink-0 active:scale-95"
              title="Start Timer"
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>Track</span>
            </button>
          )}

          {/* Persistent 2-Click Delete Button */}
          <button
            type="button"
            onClick={handleDeleteClick}
            className={`p-1 rounded-md transition-all cursor-pointer shrink-0 ${
              isConfirmingDelete
                ? 'bg-rose-500/25 text-rose-300 border border-rose-500/60 animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.35)]'
                : 'text-stone-500 hover:text-rose-400 hover:bg-stone-850/70 border border-transparent'
            }`}
            title={isConfirmingDelete ? 'Click again to confirm delete' : 'Delete task'}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </SortableRow>
  );
}
