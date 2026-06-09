/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "motion/react";
import { db } from "../db";
import { Goal } from "../types";
import { formatDuration } from "../utils";
import { Flag, X, Clock, Link2, Unlink2 } from "lucide-react";

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
  const goals =
    useLiveQuery(
      () =>
        db.entries
          .where("type")
          .equals("goal")
          .filter((o) => (o as Goal).status !== "archived")
          .toArray(),
    ) || [];
  const typedGoals = goals as Goal[];

  const handleLink = (goalId: string) => {
    onSelect(goalId);
  };

  const handleUnlink = () => {
    onSelect(undefined);
  };

  const renderContent = () => (
    <>
      {/* Current link */}
      {currentGoalId && (
        <div className="pt-1 pb-2">
          <button
            onClick={handleUnlink}
            className="flex items-center gap-2 w-full px-3 py-2 bg-sky-950/20 border border-sky-800/30 rounded-lg text-[10px] font-mono text-sky-400 hover:bg-sky-950/30 transition-colors cursor-pointer"
          >
            <Unlink2 className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">
              Unlink current goal
            </span>
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-1">
        {typedGoals.length === 0 ? (
          <div className="py-8 text-center text-stone-600">
            <Flag className="w-6 h-6 mx-auto mb-2 text-stone-700" />
            <p className="text-xs font-sans">No goals yet</p>
            <p className="text-[10px] font-sans text-stone-700 mt-1">
              Create a goal from the goals panel.
            </p>
          </div>
        ) : (
          typedGoals.map((g) => (
            <button
              key={g.id}
              onClick={() => handleLink(g.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                currentGoalId === g.id
                  ? "bg-sky-500/10 border-sky-500/30 text-sky-300"
                  : "bg-[#0a0a0a] border-stone-800 hover:border-stone-700 text-stone-300 hover:text-stone-100"
              }`}
            >
              <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center shrink-0">
                {currentGoalId === g.id && (
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-serif block truncate">
                  {g.title}
                </span>
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
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/60 backdrop-blur-xs"
            />
            {/* Sheet container */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className="relative w-full max-h-[85vh] bg-[#121212] border-t border-stone-850 rounded-t-2xl shadow-2xl z-10 flex flex-col overflow-hidden pb-6"
            >
              {/* Drag Handle & Close header */}
              <div className="flex-none flex flex-col items-center pt-3 pb-2 border-b border-stone-850/60 relative">
                <div className="w-12 h-1 bg-stone-800 rounded-full mb-3" />
                <div className="w-full px-5 flex justify-between items-center">
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
              </div>

              {/* Sheet content area */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-[200px]">
                {renderContent()}
              </div>
            </motion.div>
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
              <div className="flex-1 overflow-y-auto p-4 space-y-1">
                {renderContent()}
              </div>
            </motion.div>
          </div>
        ))}
    </AnimatePresence>
  );
}
