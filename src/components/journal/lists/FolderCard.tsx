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
import DesktopTaskCard from './DesktopTaskCard';
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
  gridClass?: string;
  showContent?: boolean;
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
  gridClass = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5',
  showContent = true,
  onContextMenu,
}: FolderCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(folder.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const { setNodeRef, isOver } = useDroppable({
    id: `folder-drop-${folder.id}`,
    data: { folderId: folder.id },
  });

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
      className={`rounded-2xl border transition-all duration-200 ${
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

          <span className="text-[10px] font-mono text-stone-500 tabular-nums ml-1 shrink-0">
            ({tasks.length})
          </span>
        </div>

        {/* Folder Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onAddTaskToFolder(folder.id)}
            className="p-1 rounded-lg text-stone-500 hover:text-amber-300 hover:bg-stone-800 transition-colors cursor-pointer"
            title="Add task in folder"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => {
              if (confirmDelete) {
                onDeleteFolder(folder.id);
              } else {
                setConfirmDelete(true);
                setTimeout(() => setConfirmDelete(false), 3000);
              }
            }}
            className={`p-1 rounded-lg transition-colors cursor-pointer ${
              confirmDelete
                ? 'text-red-400 bg-red-950/80 border border-red-800'
                : 'text-stone-500 hover:text-red-400 hover:bg-stone-800'
            }`}
            title={
              confirmDelete
                ? 'Click again to confirm deleting folder'
                : 'Delete folder'
            }
          >
            {confirmDelete ? (
              <span className="text-[9px] font-mono font-bold px-1">Sure?</span>
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Folder Tasks */}
      {!isCollapsed && (
        <div className="p-2.5">
          <SortableContext
            items={tasks.map((t) => t.id)}
            strategy={verticalListSortingStrategy}
          >
            {isDesktop ? (
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

          {tasks.length === 0 && (
            <div
              onClick={() => onAddTaskToFolder(folder.id)}
              className="py-4 border border-dashed border-stone-800/70 rounded-xl text-center text-[11px] font-mono text-stone-600 hover:text-stone-400 hover:border-stone-700 transition-colors cursor-pointer select-none"
            >
              + Add or drag tasks into {folder.name}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
