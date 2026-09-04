/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Check, CircleDashed, X, HelpCircle } from 'lucide-react';
import { db } from '../../../db';
import { Task, TaskStatus } from '../../../types';
import { playCompleteSound } from '../../../services/audio';

interface TaskStatusPickerPopoverProps {
  task: Task;
  onClose: () => void;
}

export default function TaskStatusPickerPopover({
  task,
  onClose,
}: TaskStatusPickerPopoverProps) {
  const currentStatus = task.status ?? 'todo';

  const handleSelectStatus = async (status: TaskStatus) => {
    const isDone = status === 'done';
    if (isDone && currentStatus !== 'done') {
      playCompleteSound();
    }
    await db.entries.update(task.id, {
      status,
      completed_at: isDone ? new Date() : undefined,
    } as any);
    onClose();
  };

  const STATUS_OPTIONS: {
    status: TaskStatus;
    label: string;
    description: string;
    icon: React.ReactNode;
    colorClasses: string;
    activeClasses: string;
  }[] = [
    {
      status: 'todo',
      label: 'To Do',
      description: 'Backlog / not started',
      icon: (
        <span className="w-3.5 h-3.5 rounded-full border border-stone-500 shrink-0" />
      ),
      colorClasses: 'text-stone-300 hover:bg-stone-800/80',
      activeClasses: 'bg-stone-800 text-stone-100 border-stone-700',
    },
    {
      status: 'in_progress',
      label: 'In Progress',
      description: 'Currently working on this',
      icon: <CircleDashed className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
      colorClasses: 'text-amber-300 hover:bg-amber-500/10',
      activeClasses: 'bg-amber-500/20 text-amber-200 border-amber-500/40',
    },
    {
      status: 'done',
      label: 'Completed',
      description: 'Finished task',
      icon: (
        <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3] shrink-0" />
      ),
      colorClasses: 'text-emerald-300 hover:bg-emerald-500/10',
      activeClasses: 'bg-emerald-500/20 text-emerald-200 border-emerald-500/40',
    },
    {
      status: 'dropped',
      label: 'Dropped',
      description: 'Cancelled or abandoned',
      icon: <X className="w-3.5 h-3.5 text-rose-400 stroke-[2.5] shrink-0" />,
      colorClasses: 'text-rose-300 hover:bg-rose-500/10',
      activeClasses: 'bg-rose-500/20 text-rose-200 border-rose-500/40',
    },
    {
      status: 'maybe',
      label: 'Maybe / Later',
      description: 'Parked for later or undecided',
      icon: (
        <HelpCircle className="w-3.5 h-3.5 text-indigo-400 stroke-[2.5] shrink-0" />
      ),
      colorClasses: 'text-indigo-300 hover:bg-indigo-500/10',
      activeClasses: 'bg-indigo-500/20 text-indigo-200 border-indigo-500/40',
    },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1100] flex items-center justify-center p-4 font-sans"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.93, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.93, y: 12 }}
          transition={{ type: 'spring', damping: 26, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-xs bg-[#131313] border border-stone-800 rounded-2xl shadow-2xl overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-stone-800/60">
            <div>
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400">
                Change Status
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

          <div className="p-3 flex flex-col gap-1.5">
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = currentStatus === opt.status;
              return (
                <button
                  key={opt.status}
                  onClick={() => handleSelectStatus(opt.status)}
                  className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                    isSelected
                      ? opt.activeClasses
                      : `${opt.colorClasses} border-transparent`
                  }`}
                >
                  <div className="w-5 h-5 flex items-center justify-center shrink-0">
                    {opt.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono font-bold leading-tight">
                      {opt.label}
                    </p>
                    <p className="text-[10px] font-mono text-stone-500 leading-tight mt-0.5">
                      {opt.description}
                    </p>
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />
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
