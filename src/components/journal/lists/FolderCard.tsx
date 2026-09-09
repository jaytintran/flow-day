/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import {
  ChevronDown,
  Folder,
  FolderOpen,
  Plus,
  Trash2,
} from 'lucide-react';
import { Task, Category, ListFolder, TimelineEntry } from '../../../types';
import { STATUS_GROUPS } from '../ListsView';
import DesktopTaskCard from './DesktopTaskCard';
import DesktopTaskRow from './DesktopTaskRow';
import MobileTaskItem from './MobileTaskItem';

interface FolderCardProps {
  folder: ListFolder;
  tasks: Task[];
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onDeleteFolder: (folderId: string) => void;
  activeTaskId: string | null;
  deletingId: string | null;
  taskLists: Category[];
  selectedListId?: string;
  availableFolders?: ListFolder[];
  selectedTaskIds?: Set<string>;
  activeDragTaskIds?: Set<string>;
  onClickCard?: (task: Task, e: React.MouseEvent) => void;
  activeSwipedTaskId?: string | null;
  onSetSwipedTaskId?: (taskId: string | null) => void;
  onDeleteEntry: (id: string) => void;
  onOpenDetail: (entry: TimelineEntry) => void;
  onToggleTaskStatus: (task: Task) => void;
  onOpenStatusModal: (task: Task) => void;
  onActivateTask: (taskId: string) => void;
  onOpenScheduleModal: (task: Task) => void;
  onOpenListPicker: (task: Task) => void;
  onOpenFolderPicker?: (task: Task) => void;
  onAddTaskToFolder: (folderId: string) => void;
  onToggleAccomplishment?: (task: Task) => void;
  isDesktop?: boolean;
  viewLayout?: 'grid' | 'list';
  gridClass?: string;
  showContent?: boolean;
  statusFilter?: "all" | "todo" | "in_progress" | "done" | "dropped" | "maybe";
  onContextMenu?: (task: Task, e: React.MouseEvent) => void;
}

export default function FolderCard({
  folder,
  tasks,
  isCollapsed,
  onToggleCollapse,
  onRenameFolder,
  onDeleteFolder,
  activeTaskId,
  deletingId,
  taskLists,
  selectedListId,
  availableFolders,
  selectedTaskIds,
  activeDragTaskIds,
  onClickCard,
  activeSwipedTaskId,
  onSetSwipedTaskId,
  onDeleteEntry,
  onOpenDetail,
  onToggleTaskStatus,
  onOpenStatusModal,
  onActivateTask,
  onOpenScheduleModal,
  onOpenListPicker,
  onOpenFolderPicker,
  onAddTaskToFolder,
  onToggleAccomplishment,
  isDesktop = false,
  viewLayout = 'grid',
  gridClass = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5',
  showContent = true,
  statusFilter = 'all',
  onContextMenu,
}: FolderCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);
  const autoExpandTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [collapsedStatusGroups, setCollapsedStatusGroups] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const saved = localStorage.getItem(
        `flowday_folder_${folder.id}_collapsed_status_groups`
      );
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleStatusGroup = (groupKey: string) => {
    setCollapsedStatusGroups((prev) => {
      const next = { ...prev, [groupKey]: !prev[groupKey] };
      try {
        localStorage.setItem(
          `flowday_folder_${folder.id}_collapsed_status_groups`,
          JSON.stringify(next)
        );
      } catch {
        // ignore
      }
      return next;
    });
  };

  const { setNodeRef, isOver } = useDroppable({
    id: `folder-drop-${folder.id}`,
    data: { folderId: folder.id },
  });

  // Auto-expand collapsed folder after 600ms hovering with dragged item
  useEffect(() => {
    if (isOver && isCollapsed) {
      autoExpandTimeoutRef.current = setTimeout(() => {
        onToggleCollapse();
      }, 600);
    } else {
      if (autoExpandTimeoutRef.current) {
        clearTimeout(autoExpandTimeoutRef.current);
        autoExpandTimeoutRef.current = null;
      }
    }
    return () => {
      if (autoExpandTimeoutRef.current) {
        clearTimeout(autoExpandTimeoutRef.current);
      }
    };
  }, [isOver, isCollapsed, onToggleCollapse]);

  useEffect(() => {
    if (isEditingTitle) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isEditingTitle]);

  const commitRename = () => {
    setIsEditingTitle(false);
    const trimmed = titleDraft.trim();
    if (trimmed && trimmed !== folder.name) {
      onRenameFolder(folder.id, trimmed);
    } else {
      setTitleDraft(folder.name);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      commitRename();
    }
  };

  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      id={`folder-${folder.id}`}
      ref={setNodeRef}
      className={`rounded-2xl border transition-all duration-200 scroll-mt-4 ${
        isOver
          ? 'border-amber-500/60 bg-amber-500/[0.04] shadow-[0_0_20px_rgba(245,158,11,0.1)]'
          : 'border-stone-800/80 bg-[#101010]'
      }`}
    >
      {/* Folder Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-stone-800/60 bg-[#141414]/90 rounded-t-2xl">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-transform cursor-pointer"
          >
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-200 ${
                isCollapsed ? '-rotate-90' : 'rotate-0'
              }`}
            />
          </button>

          {isCollapsed ? (
            <Folder className="w-4 h-4 text-amber-400 shrink-0" />
          ) : (
            <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
          )}

          {isEditingTitle ? (
            <input
              ref={inputRef}
              type="text"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleKeyDown}
              className="bg-[#0a0a0a] border border-amber-500/50 rounded px-2 py-0.5 text-xs font-mono font-bold text-amber-300 focus:outline-none flex-1 max-w-sm"
            />
          ) : (
            <span
              onClick={() => {
                setTitleDraft(folder.name);
                setIsEditingTitle(true);
              }}
              className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200 hover:text-amber-300 transition-colors cursor-text truncate"
              title="Click to rename"
            >
              {folder.name}
            </span>
          )}

          <span className="text-[10px] font-mono text-stone-500 font-bold ml-1 tabular-nums">
            ({tasks.length})
          </span>
        </div>

        {/* Action buttons on right */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAddTaskToFolder(folder.id)}
            className="p-1 rounded-lg text-stone-500 hover:text-amber-400 hover:bg-stone-800 transition-colors cursor-pointer"
            title={`Add item to ${folder.name}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onDeleteFolder(folder.id)}
                className="px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-1.5 py-0.5 rounded-lg text-stone-400 hover:text-stone-200 text-[10px] font-mono transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="p-1 rounded-lg text-stone-600 hover:text-rose-400 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Delete folder"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Active Drop Landing Zone Banner */}
      {isOver && (
        <div className="mx-3.5 my-2.5 px-3 py-2 rounded-xl bg-amber-500/10 border-2 border-dashed border-amber-500/50 flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.2)] animate-pulse">
          <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-mono font-bold text-amber-300">
            Drop to move into "{folder.name}"
          </span>
        </div>
      )}

      {/* Folder Content: Tasks List / Grid (when expanded) */}
      {!isCollapsed && (
        <div className="p-3.5">
          {statusFilter === 'all' ? (
            <div className="space-y-4">
              {STATUS_GROUPS.map((group) => {
                const groupTasks = tasks.filter((t) => t.status === group.key);
                if (groupTasks.length === 0) return null;
                const isGroupCollapsed = !!collapsedStatusGroups[group.key];

                return (
                  <div key={group.key} className="space-y-2">
                    <button
                      type="button"
                      onClick={() => toggleStatusGroup(group.key)}
                      className="w-full flex items-center justify-between py-1 px-1.5 rounded-lg text-left hover:bg-stone-900/40 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-2">
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-stone-500 transition-transform duration-200 ${
                            isGroupCollapsed ? '-rotate-90' : 'rotate-0'
                          }`}
                        />
                        <span
                          className={`w-2 h-2 rounded-full ${group.dotColor}`}
                        />
                        <span
                          className={`text-[11px] font-mono font-bold uppercase tracking-wider ${group.textColor}`}
                        >
                          {group.label}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono font-bold text-stone-500 tabular-nums">
                        {groupTasks.length}
                      </span>
                    </button>

                    {!isGroupCollapsed && (
                      <SortableContext
                        items={groupTasks.map((t) => t.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {isDesktop ? (
                          viewLayout === 'list' ? (
                            <div className="space-y-1.5">
                              {groupTasks.map((task) => (
                                <DesktopTaskRow
                                  key={task.id}
                                  task={task}
                                  activeTaskId={activeTaskId}
                                  deletingId={deletingId}
                                  taskLists={taskLists}
                                  selectedListId={selectedListId}
                                  availableFolders={availableFolders}
                                  isSelected={selectedTaskIds?.has(task.id)}
                                  isGhost={activeDragTaskIds?.has(task.id)}
                                  onClickCard={onClickCard}
                                  onDeleteEntry={onDeleteEntry}
                                  onOpenDetail={onOpenDetail}
                                  onToggleTaskStatus={onToggleTaskStatus}
                                  onOpenStatusModal={onOpenStatusModal}
                                  onActivateTask={onActivateTask}
                                  onOpenScheduleModal={onOpenScheduleModal}
                                  onOpenListPicker={onOpenListPicker}
                                  onOpenFolderPicker={onOpenFolderPicker}
                                  onToggleAccomplishment={onToggleAccomplishment}
                                  showContent={showContent}
                                  onContextMenu={onContextMenu}
                                />
                              ))}
                            </div>
                          ) : (
                            <div className={gridClass}>
                              {groupTasks.map((task) => (
                                <DesktopTaskCard
                                  key={task.id}
                                  task={task}
                                  activeTaskId={activeTaskId}
                                  deletingId={deletingId}
                                  taskLists={taskLists}
                                  selectedListId={selectedListId}
                                  availableFolders={availableFolders}
                                  isSelected={selectedTaskIds?.has(task.id)}
                                  isGhost={activeDragTaskIds?.has(task.id)}
                                  onClickCard={onClickCard}
                                  onDeleteEntry={onDeleteEntry}
                                  onOpenDetail={onOpenDetail}
                                  onToggleTaskStatus={onToggleTaskStatus}
                                  onOpenStatusModal={onOpenStatusModal}
                                  onActivateTask={onActivateTask}
                                  onOpenScheduleModal={onOpenScheduleModal}
                                  onOpenListPicker={onOpenListPicker}
                                  onOpenFolderPicker={onOpenFolderPicker}
                                  onToggleAccomplishment={onToggleAccomplishment}
                                  showContent={showContent}
                                  onContextMenu={onContextMenu}
                                />
                              ))}
                            </div>
                          )
                        ) : (
                          <div className="space-y-1.5">
                            {groupTasks.map((task) => (
                              <MobileTaskItem
                                key={task.id}
                                task={task}
                                activeTaskId={activeTaskId}
                                deletingId={deletingId}
                                taskLists={taskLists}
                                selectedListId={selectedListId}
                                availableFolders={availableFolders}
                                isSelected={selectedTaskIds?.has(task.id)}
                                isGhost={activeDragTaskIds?.has(task.id)}
                                onClickCard={onClickCard}
                                isSwiped={activeSwipedTaskId === task.id}
                                onSetSwiped={(swiped) =>
                                  onSetSwipedTaskId?.(swiped ? task.id : null)
                                }
                                onDeleteEntry={onDeleteEntry}
                                onOpenDetail={onOpenDetail}
                                onToggleTaskStatus={onToggleTaskStatus}
                                onOpenStatusModal={onOpenStatusModal}
                                onActivateTask={onActivateTask}
                                onOpenScheduleModal={onOpenScheduleModal}
                                onOpenListPicker={onOpenListPicker}
                                onOpenFolderPicker={onOpenFolderPicker}
                                onToggleAccomplishment={onToggleAccomplishment}
                                showContent={showContent}
                                onContextMenu={onContextMenu}
                              />
                            ))}
                          </div>
                        )}
                      </SortableContext>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <SortableContext
              items={tasks.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {isDesktop ? (
                viewLayout === 'list' ? (
                  <div className="space-y-1.5">
                    {tasks.map((task) => (
                      <DesktopTaskRow
                        key={task.id}
                        task={task}
                        activeTaskId={activeTaskId}
                        deletingId={deletingId}
                        taskLists={taskLists}
                        selectedListId={selectedListId}
                        availableFolders={availableFolders}
                        isSelected={selectedTaskIds?.has(task.id)}
                        isGhost={activeDragTaskIds?.has(task.id)}
                        onClickCard={onClickCard}
                        onDeleteEntry={onDeleteEntry}
                        onOpenDetail={onOpenDetail}
                        onToggleTaskStatus={onToggleTaskStatus}
                        onOpenStatusModal={onOpenStatusModal}
                        onActivateTask={onActivateTask}
                        onOpenScheduleModal={onOpenScheduleModal}
                        onOpenListPicker={onOpenListPicker}
                        onOpenFolderPicker={onOpenFolderPicker}
                        onToggleAccomplishment={onToggleAccomplishment}
                        showContent={showContent}
                        onContextMenu={onContextMenu}
                      />
                    ))}
                  </div>
                ) : (
                  <div className={gridClass}>
                    {tasks.map((task) => (
                      <DesktopTaskCard
                        key={task.id}
                        task={task}
                        activeTaskId={activeTaskId}
                        deletingId={deletingId}
                        taskLists={taskLists}
                        selectedListId={selectedListId}
                        availableFolders={availableFolders}
                        isSelected={selectedTaskIds?.has(task.id)}
                        isGhost={activeDragTaskIds?.has(task.id)}
                        onClickCard={onClickCard}
                        onDeleteEntry={onDeleteEntry}
                        onOpenDetail={onOpenDetail}
                        onToggleTaskStatus={onToggleTaskStatus}
                        onOpenStatusModal={onOpenStatusModal}
                        onActivateTask={onActivateTask}
                        onOpenScheduleModal={onOpenScheduleModal}
                        onOpenListPicker={onOpenListPicker}
                        onOpenFolderPicker={onOpenFolderPicker}
                        onToggleAccomplishment={onToggleAccomplishment}
                        showContent={showContent}
                        onContextMenu={onContextMenu}
                      />
                    ))}
                  </div>
                )
              ) : (
                <div className="space-y-1.5">
                  {tasks.map((task) => (
                    <MobileTaskItem
                      key={task.id}
                      task={task}
                      activeTaskId={activeTaskId}
                      deletingId={deletingId}
                      taskLists={taskLists}
                      selectedListId={selectedListId}
                      availableFolders={availableFolders}
                      isSelected={selectedTaskIds?.has(task.id)}
                      onClickCard={onClickCard}
                      isSwiped={activeSwipedTaskId === task.id}
                      onSetSwiped={(swiped) =>
                        onSetSwipedTaskId?.(swiped ? task.id : null)
                      }
                      onDeleteEntry={onDeleteEntry}
                      onOpenDetail={onOpenDetail}
                      onToggleTaskStatus={onToggleTaskStatus}
                      onOpenStatusModal={onOpenStatusModal}
                      onActivateTask={onActivateTask}
                      onOpenScheduleModal={onOpenScheduleModal}
                      onOpenListPicker={onOpenListPicker}
                      onOpenFolderPicker={onOpenFolderPicker}
                      onToggleAccomplishment={onToggleAccomplishment}
                      showContent={showContent}
                      onContextMenu={onContextMenu}
                    />
                  ))}
                </div>
              )}
            </SortableContext>
          )}

          {tasks.length === 0 && (
            <div
              onClick={() => onAddTaskToFolder(folder.id)}
              className="py-4 border border-dashed border-stone-800/70 rounded-xl text-center text-[11px] font-mono text-stone-600 hover:text-stone-400 hover:border-stone-700 transition-colors cursor-pointer select-none"
            >
              + Add or drag items into {folder.name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
