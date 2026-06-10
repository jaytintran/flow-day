/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../db';
import { Goal } from '../types';
import { formatDuration } from '../utils';
import { Flag, X, Clock, Link2, Unlink2, Search } from 'lucide-react';

interface GoalPickerSheetProps {
  open: boolean;
  onClose: () => void;
  currentGoalId: string | undefined;
  onSelect: (goalId: string | undefined) => void;
  isMobile: boolean;
}

export default function GoalPickerSheet({
  open,
  onClose,
  currentGoalId,
  onSelect,
  isMobile,
}: GoalPickerSheetProps) {
  const [search, setSearch] = useState('');

  const goals =
    useLiveQuery(() =>
      db.entries
        .where('type')
        .equals('goal')
        .filter((o) => (o as Goal).status !== 'archived')
        .toArray(),
    ) || [];
  const typedGoals = goals as Goal[];

  const handleLink = (goalId: string) => {
    onSelect(goalId);
  };

  const handleUnlink = () => {
    onSelect(undefined);
  };

  const filteredGoals = typedGoals.filter((g) =>
    g.title.toLowerCase().includes(search.toLowerCase()),
  );

  const renderContent = () => (
    <>
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search goals..."
          className="w-full bg-[#0a0a0a] border border-stone-800 rounded-lg pl-9 pr-3 py-2 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-sky-500/30 transition-colors font-mono"
        />
      </div>

      {/* Current link */}
      {currentGoalId && (
        <div className="pt-1 pb-2">
          <button
            onClick={handleUnlink}
            className="flex items-center gap-2 w-full px-3 py-2 bg-sky-950/20 border border-sky-800/30 rounded-lg text-[10px] font-mono text-sky-400 hover:bg-sky-950/30 transition-colors cursor-pointer"
          >
            <Unlink2 className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">Unlink current goal</span>
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-1">
        {filteredGoals.length === 0 ? (
          <div className="py-8 text-center text-stone-600">
            <Flag className="w-6 h-6 mx-auto mb-2 text-stone-700" />
            <p className="text-xs font-sans">No goals yet</p>
            <p className="text-[10px] font-sans text-stone-700 mt-1">
              Create a goal from the goals panel.
            </p>
          </div>
        ) : (
          filteredGoals.map((g) => (
            <button
              key={g.id}
              onClick={() => handleLink(g.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                currentGoalId === g.id
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                  : 'bg-[#0a0a0a] border-stone-800 hover:border-stone-700 text-stone-300 hover:text-stone-100'
              }`}
            >
              <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center shrink-0">
                {currentGoalId === g.id && <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-serif block truncate">{g.title}</span>
                <span className="text-[9px] font-mono flex items-center gap-1 text-stone-600">
                  <Clock className="w-3 h-3" />
                  {formatDuration(g.time_spent)}
                </span>
              </div>
              <Link2 className="w-3.5 h-3.5 shrink-0 opacity-50" />
            </button>
          ))
        )}
      </div>
    </>
  );

  return (
    <AnimatePresence>
      {open &&
        (isMobile ? (
          /* BOTTOM SHEET FOR MOBILE */
          <div className="fixed inset-0 z-[999] flex items-end justify-center font-sans">
            <div onClick={onClose} className="absolute inset-0 bg-black/60 backdrop-blur-xs" />
            <div className="relative w-full max-h-[85vh] bg-[#121212] border-t border-stone-850 rounded-t-2xl shadow-2xl z-10 flex flex-col overflow-hidden pb-6 animate-slide-up">
              <div className="flex-none flex flex-col items-center pt-3 pb-2 border-b border-stone-850/60">
                <button
                  onClick={onClose}
                  className="w-12 h-1 bg-stone-700 hover:bg-stone-500 rounded-full mb-3 transition-colors cursor-pointer"
                />
                <div className="w-full px-5 flex justify-between items-center">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border text-sky-400 bg-sky-500/10 border-sky-500/20 flex items-center gap-1.5">
                    <Flag className="w-3 h-3" />
                    Link to Goal
                  </span>
                  <button
                    onClick={onClose}
                    className="p-1 text-stone-500 hover:text-stone-300 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[200px]">
                {renderContent()}
              </div>
            </div>
          </div>
        ) : (
          /* MODAL FOR DESKTOP */
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999] p-4 font-sans"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#121212] border border-stone-800 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl relative flex flex-col max-h-[70vh]"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-stone-850 p-4">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border text-sky-400 bg-sky-500/10 border-sky-500/20 flex items-center gap-1.5">
                  <Flag className="w-3 h-3" />
                  Link to Goal
                </span>
                <button
                  onClick={onClose}
                  className="p-1 text-stone-500 hover:text-stone-300 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-1">{renderContent()}</div>
            </motion.div>
          </div>
        ))}
    </AnimatePresence>
  );
}
