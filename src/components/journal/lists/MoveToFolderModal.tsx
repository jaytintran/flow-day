/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check, Layers, Folder } from 'lucide-react';
import { Task, ListFolder } from '../../../types';

interface MoveToFolderModalProps {
  task: Task;
  folders: ListFolder[];
  onClose: () => void;
  onSelectFolder: (taskId: string, folderId: string | undefined) => void;
}

export default function MoveToFolderModal({
  task,
  folders,
  onClose,
  onSelectFolder,
}: MoveToFolderModalProps) {
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
                !task.folder_id
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
                  : 'bg-transparent border-transparent text-stone-400 hover:bg-stone-800/60 hover:text-stone-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5 text-stone-400 shrink-0" />
              <span className="flex-1 min-w-0 text-xs font-mono truncate">
                General Tasks (No Folder)
              </span>
              {!task.folder_id && (
                <Check className="w-3.5 h-3.5 text-amber-400 shrink-0 stroke-[3]" />
              )}
            </button>

            {folders.map((folder) => {
              const isSelected = task.folder_id === folder.id;
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
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
