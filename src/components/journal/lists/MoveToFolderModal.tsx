/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Layers, Folder, FolderPlus } from 'lucide-react';
import { Task, ListFolder } from '../../../types';

interface MoveToFolderModalProps {
  task: Task;
  folders: ListFolder[];
  currentListId?: string;
  onClose: () => void;
  onSelectFolder: (taskId: string, folderId: string | undefined) => void;
  onCreateFolder?: () => void;
}

export default function MoveToFolderModal({
  task,
  folders,
  currentListId,
  onClose,
  onSelectFolder,
  onCreateFolder,
}: MoveToFolderModalProps) {
  const effectiveFolderId =
    (currentListId && task.folder_ids?.[currentListId]) ?? task.folder_id;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs bg-[#141414] border border-stone-800 rounded-2xl shadow-2xl overflow-hidden font-sans"
        >
          <div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-stone-800/60">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400">
                Move to Folder
              </p>
              <p className="text-xs font-serif font-semibold text-stone-200 line-clamp-1 mt-0.5">
                {task.title}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-1 text-stone-500 hover:text-stone-300 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 flex flex-col gap-1 max-h-60 overflow-y-auto">
            {/* Option: General / No Folder */}
            <button
              type="button"
              onClick={() => {
                onSelectFolder(task.id, undefined);
                onClose();
              }}
              className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left transition-all cursor-pointer border ${
                !effectiveFolderId
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-transparent border-transparent text-stone-400 hover:bg-stone-800/60 hover:text-stone-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span className="flex-1 min-w-0 text-xs font-mono truncate">
                General Items (No Folder)
              </span>
              {!effectiveFolderId && (
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 stroke-[3]" />
              )}
            </button>

            {folders.map((folder) => {
              const isSelected = effectiveFolderId === folder.id;
              return (
                <button
                  key={folder.id}
                  type="button"
                  onClick={() => {
                    onSelectFolder(task.id, folder.id);
                    onClose();
                  }}
                  className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                      : 'bg-transparent border-transparent text-stone-400 hover:bg-stone-800/60 hover:text-stone-200'
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="flex-1 min-w-0 text-xs font-mono truncate">
                    {folder.name}
                  </span>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 stroke-[3]" />
                  )}
                </button>
              );
            })}

            {folders.length === 0 && onCreateFolder && (
              <div className="pt-2 pb-1 border-t border-stone-850 mt-1 flex flex-col items-center gap-1.5 text-center">
                <span className="text-[11px] font-mono text-stone-500">
                  No folders in this list yet
                </span>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onCreateFolder();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-stone-850 hover:bg-stone-800 text-amber-400 text-xs font-mono font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                  <span>Create Folder</span>
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
