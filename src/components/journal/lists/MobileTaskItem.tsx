/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Play,
  Calendar,
  ListTodo,
  FolderInput,
  Trash2,
  Check,
  CircleDashed,
  X,
  HelpCircle,
  Trophy,
  FileText,
  Clock,
} from 'lucide-react';
import { db } from '../../../db';
import { Task, Category, ListFolder, TimelineEntry } from '../../../types';
import { formatDuration } from '../../../utils';
import SortableRow from '../../SortableRow';
import CategoryIcon from '../../CategoryIcon';
import { CATEGORY_COLORS } from './TrophyView';

interface MobileTaskItemProps {
  task: Task;
  activeTaskId: string | null;
  deletingId: string | null;
  taskLists: Category[];
  selectedListId?: string;
  availableFolders?: ListFolder[];
  isSwiped?: boolean;
  isSelected?: boolean;
  onClickCard?: (task: Task, e: React.MouseEvent) => void;
  onSetSwiped?: (swiped: boolean) => void;
  onDeleteEntry: (id: string) => void;
  onOpenDetail: (entry: TimelineEntry) => void;
  onToggleTaskStatus: (task: Task) => void;
  onOpenStatusModal: (task: Task) => void;
  onActivateTask: (taskId: string) => void;
  onOpenScheduleModal: (task: Task) => void;
  onOpenListPicker: (task: Task) => void;
  onOpenFolderPicker?: (task: Task) => void;
  onToggleAccomplishment?: (task: Task) => void;
  onContextMenu?: (task: Task, e: React.MouseEvent) => void;
}

export default function MobileTaskItem({
  task,
  activeTaskId,
  deletingId,
  taskLists,
  selectedListId,
  availableFolders,
  isSwiped,
  isSelected = false,
  onClickCard,
  onSetSwiped,
  onDeleteEntry,
  onOpenDetail,
  onToggleTaskStatus,
  onOpenStatusModal,
  onActivateTask,
  onOpenScheduleModal,
  onOpenListPicker,
  onOpenFolderPicker,
  onToggleAccomplishment,
  onContextMenu,
}: MobileTaskItemProps) {
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

  const [localSwiped, setLocalSwiped] = useState(false);
  const isMobileSwiped = isSwiped !== undefined ? isSwiped : localSwiped;
  const setIsMobileSwiped = (swiped: boolean) => {
    if (onSetSwiped) {
      onSetSwiped(swiped);
    } else {
      setLocalSwiped(swiped);
    }
  };

  const isDraggingSwipe = useRef(false);
  const isSwipeDisabled = isDone || isDropped;
  const hasFolders = !!(
    availableFolders &&
    availableFolders.length > 0 &&
    onOpenFolderPicker
  );

  // ── Status control: tap toggles complete, press-and-hold picks any status ──
  const LONG_PRESS_MS = 450;
  const MOVE_TOLERANCE_PX = 8;
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const longPressFiredRef = useRef(false);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pressStartRef.current = null;
  };

  const handleStatusPointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    longPressFiredRef.current = false;
    clearLongPress();
    pressStartRef.current = { x: e.clientX, y: e.clientY };
    longPressTimerRef.current = setTimeout(() => {
      longPressFiredRef.current = true;
      onOpenStatusModal(task);
    }, LONG_PRESS_MS);
  };

  const handleStatusPointerMove = (e: React.PointerEvent) => {
    const start = pressStartRef.current;
    if (!start) return;
    if (
      Math.abs(e.clientX - start.x) > MOVE_TOLERANCE_PX ||
      Math.abs(e.clientY - start.y) > MOVE_TOLERANCE_PX
    ) {
      clearLongPress();
    }
  };

  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    clearLongPress();
    if (longPressFiredRef.current) {
      longPressFiredRef.current = false;
      return;
    }
    onToggleTaskStatus(task);
  };

  let buttonCount = 2; // Schedule + Delete
  if (!isActive && !isDone && !isDropped) buttonCount += 1; // Activate
  if (taskLists.length > 0) buttonCount += 1; // List Picker
  if (hasFolders) buttonCount += 1; // Folder Picker
  const maxSwipeLeft = isSwipeDisabled ? 0 : -(buttonCount * 42 + 8);

  const hasTimeSpent = (task.time_spent ?? 0) > 0;
  const achievementsCount = task.achievements?.length ?? 0;
  const hasMetadata = !!(
    hasTimeSpent ||
    achievementsCount > 0 ||
    (task.content && task.content.trim()) ||
    task.scheduled_at ||
    taskCategories.length > 0
  );

  return (
    <SortableRow id={task.id} disabled={false} hideHandle={false}>
      <div className="relative overflow-hidden rounded-xl">
        {/* Underlying Mobile Action Tray */}
        {!isSwipeDisabled && (
          <div
            aria-hidden={!isMobileSwiped}
            className={`absolute inset-y-0 right-0 flex flex-row-reverse items-center pr-2 pl-1 gap-1.5 bg-transparent z-0 transition-opacity duration-200 ${
              isMobileSwiped
                ? 'opacity-100 visible'
                : 'opacity-0 invisible pointer-events-none'
            }`}
          >
            {!isDone && !isDropped && !isActive && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMobileSwiped(false);
                  onActivateTask(task.id);
                }}
                className="p-2.5 rounded-xl text-amber-400 bg-stone-900 border border-amber-500/30 hover:bg-stone-800 transition-colors cursor-pointer shadow-md"
                title="Start tracking time"
                aria-label={`Start tracking time on "${task.title}"`}
              >
                <Play className="w-4 h-4 fill-current" />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsMobileSwiped(false);
                onOpenScheduleModal(task);
              }}
              className="p-2.5 rounded-xl text-stone-300 hover:text-amber-400 bg-stone-900 border border-stone-800 hover:border-stone-700 transition-colors cursor-pointer shadow-md"
              title="Schedule date"
              aria-label={`Schedule "${task.title}"`}
            >
              <Calendar className="w-4 h-4" />
            </button>

            {taskLists.length > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMobileSwiped(false);
                  onOpenListPicker(task);
                }}
                className="p-2.5 rounded-xl text-stone-300 hover:text-violet-400 bg-stone-900 border border-stone-800 hover:border-stone-700 transition-colors cursor-pointer shadow-md"
                title="Assign to lists"
                aria-label={`Assign "${task.title}" to lists`}
              >
                <ListTodo className="w-4 h-4" />
              </button>
            )}

            {/* Move to Folder */}
            {hasFolders && onOpenFolderPicker && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMobileSwiped(false);
                  onOpenFolderPicker(task);
                }}
                className="p-2.5 rounded-xl text-stone-300 hover:text-amber-300 bg-stone-900 border border-stone-800 hover:border-stone-700 transition-colors cursor-pointer shadow-md"
                title="Move to folder"
                aria-label={`Move "${task.title}" to a folder`}
              >
                <FolderInput className="w-4 h-4" />
              </button>
            )}

            {/* Divider isolates the destructive action from the safe ones */}
            <span className="w-px h-6 bg-stone-700/60 mr-0.5 ml-1.5" aria-hidden="true" />

            {/* Delete — rendered at the far end of the swipe track (row-reverse):
                a partial swipe never reaches it, a full swipe does. */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEntry(task.id);
              }}
              className={`p-2.5 rounded-xl transition-all cursor-pointer shadow-md ${
                deletingId === task.id
                  ? 'bg-rose-500 text-stone-950 border border-rose-300 animate-pulse'
                  : 'bg-rose-950/60 text-rose-300 border border-rose-800/70 hover:bg-rose-900/70'
              }`}
              title={
                deletingId === task.id
                  ? 'Tap again to confirm delete'
                  : `Delete "${task.title}"`
              }
              aria-label={
                deletingId === task.id
                  ? `Confirm delete "${task.title}"`
                  : `Delete "${task.title}"`
              }
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Mobile Row Card */}
        <motion.div
          drag={isSwipeDisabled ? false : 'x'}
          dragDirectionLock={true}
          dragConstraints={
            isSwipeDisabled ? { left: 0, right: 0 } : { left: maxSwipeLeft, right: 0 }
          }
          dragElastic={0.05}
          animate={{ x: !isSwipeDisabled && isMobileSwiped ? maxSwipeLeft : 0 }}
          style={{ willChange: 'transform' }}
          onDragStart={() => {
            if (!isSwipeDisabled) {
              isDraggingSwipe.current = true;
            }
          }}
          onDragEnd={(_, info) => {
            if (isSwipeDisabled) return;
            setTimeout(() => {
              isDraggingSwipe.current = false;
            }, 100);
            if (
              info.offset.x < -35 ||
              (info.offset.x < -15 && info.velocity.x < -80)
            ) {
              setIsMobileSwiped(true);
            } else if (info.offset.x > 15 || info.velocity.x > 80) {
              setIsMobileSwiped(false);
            }
          }}
          onClick={(e) => {
            if (isDraggingSwipe.current) return;
            if (isMobileSwiped) {
              setIsMobileSwiped(false);
            } else if (onClickCard) {
              onClickCard(task, e);
            } else {
              onOpenDetail(task);
            }
          }}
          onContextMenu={(e) => {
            if (onContextMenu) {
              e.preventDefault();
              onContextMenu(task, e);
            }
          }}
          className={`relative z-10 flex flex-col gap-1 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer select-none touch-pan-y ${
            isSelected
              ? 'bg-violet-500/15 border-violet-500/60 ring-2 ring-violet-500/40 shadow-[0_0_15px_rgba(139,92,246,0.15)]'
              : isActive
                ? 'bg-[#1c1608] border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                : isDone
                  ? isAccomplishment
                    ? 'bg-[#161410] border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-[#111111] border-stone-800/40 opacity-70 hover:opacity-100 hover:border-stone-700'
                  : isDropped
                    ? 'bg-[#181111] border-rose-900/30 opacity-60'
                    : isMaybe
                      ? 'bg-[#141422] border-indigo-900/40 opacity-90 hover:opacity-100'
                      : 'bg-[#131313] border-stone-800/80 hover:border-stone-700 hover:bg-[#171717]'
          }`}
        >
          {/* Line 1: Checkbox + Full Width Title + Trophy */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onPointerDown={handleStatusPointerDown}
              onPointerMove={handleStatusPointerMove}
              onPointerUp={clearLongPress}
              onPointerLeave={clearLongPress}
              onPointerCancel={clearLongPress}
              onClick={handleStatusClick}
              className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95 ${
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
              title={
                isDone
                  ? 'Tap to reopen — hold for all statuses'
                  : 'Tap to complete — hold for all statuses'
              }
              aria-label={
                isDone
                  ? `Mark "${task.title}" as to-do`
                  : `Mark "${task.title}" as completed`
              }
              aria-pressed={isDone}
            >
              {isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
              {isInProgress && (
                <CircleDashed className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
              )}
              {isDropped && <X className="w-3.5 h-3.5 stroke-[2.5]" />}
              {isMaybe && <HelpCircle className="w-3.5 h-3.5 stroke-[2.5]" />}
            </button>

            <div className="flex-1 min-w-0">
              <span
                className={`text-xs font-serif font-medium leading-snug line-clamp-2 transition-colors ${
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
            </div>

            {/* Right Actions for Completed / Dropped Tasks */}
            {(isDone || isDropped) && (
              <div className="flex items-center gap-1 shrink-0">
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
                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                      task.is_accomplishment
                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]'
                        : 'bg-stone-900/40 border-stone-800 text-stone-600 hover:text-amber-400'
                    }`}
                    title="Toggle accomplishment"
                    aria-label={
                      task.is_accomplishment
                        ? `Remove accomplishment flag from "${task.title}"`
                        : `Mark "${task.title}" as an accomplishment`
                    }
                  >
                    <Trophy
                      className={`w-3.5 h-3.5 ${
                        task.is_accomplishment ? 'fill-amber-400' : ''
                      }`}
                    />
                  </button>
                )}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteEntry(task.id);
                  }}
                  className={`p-2 rounded-lg border transition-all cursor-pointer ${
                    deletingId === task.id
                      ? 'bg-rose-500 border-rose-300 text-stone-950 animate-pulse'
                      : 'bg-stone-900/40 border-stone-800 text-stone-500 hover:text-rose-300 hover:bg-rose-950/30'
                  }`}
                  title={
                    deletingId === task.id
                      ? 'Tap again to confirm delete'
                      : `Delete "${task.title}"`
                  }
                  aria-label={
                    deletingId === task.id
                      ? `Confirm delete "${task.title}"`
                      : `Delete "${task.title}"`
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Line 2: Indented Metadata Sub-line */}
          {hasMetadata && (
            <div className="flex items-center gap-1.5 flex-wrap pl-[30px] pt-0.5">
              {/* Tracked Time Badge */}
              {hasTimeSpent && (
                <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider border shrink-0 ${
                    isActive
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.2)] animate-pulse'
                      : 'bg-stone-900/80 border-stone-800 text-stone-400'
                  }`}
                >
                  <Clock className="w-2.5 h-2.5 text-amber-400" />
                  <span>{formatDuration(task.time_spent)}</span>
                </span>
              )}

              {/* Achievements Pill */}
              {achievementsCount > 0 && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0"
                >
                  <span>🏆 {achievementsCount}</span>
                </span>
              )}

              {task.content && task.content.trim() && (
                <span
                  className="inline-flex items-center justify-center p-0.5 rounded bg-stone-900/80 border border-stone-800 text-stone-400 shrink-0"
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
          )}
        </motion.div>
      </div>
    </SortableRow>
  );
}
