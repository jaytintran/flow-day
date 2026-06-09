/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { motion, AnimatePresence } from "motion/react";
import { db } from "../db";
import { Objective } from "../types";
import { formatDuration } from "../utils";
import { Target, X, Clock, Link2, Unlink2 } from "lucide-react";

interface ObjectivePickerSheetProps {
  open: boolean;
  onClose: () => void;
  activeTaskId: string | null;
  currentObjectiveId: string | undefined;
  isMobile: boolean;
}

export default function ObjectivePickerSheet({
  open,
  onClose,
  activeTaskId,
  currentObjectiveId,
  isMobile,
}: ObjectivePickerSheetProps) {
  const objectives =
    useLiveQuery(
      () =>
        db.entries
          .where("type")
          .equals("objective")
          .filter((o) => (o as Objective).status !== "archived")
          .toArray(),
    ) || [];
  const typedObjectives = objectives as Objective[];

  const handleLink = async (objectiveId: string) => {
    if (!activeTaskId) return;
    await db.entries.update(activeTaskId, { objective_id: objectiveId } as any);
    onClose();
  };

  const handleUnlink = async () => {
    if (!activeTaskId) return;
    await db.entries.update(activeTaskId, { objective_id: undefined } as any);
    onClose();
  };

  const renderContent = () => (
    <>
      {/* Current link */}
      {currentObjectiveId && (
        <div className="pt-1 pb-2">
          <button
            onClick={handleUnlink}
            className="flex items-center gap-2 w-full px-3 py-2 bg-rose-950/20 border border-rose-800/30 rounded-lg text-[10px] font-mono text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <Unlink2 className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">
              Unlink current objective
            </span>
          </button>
        </div>
      )}

      {/* List */}
      <div className="space-y-1">
        {typedObjectives.length === 0 ? (
          <div className="py-8 text-center text-stone-600">
            <Target className="w-6 h-6 mx-auto mb-2 text-stone-700" />
            <p className="text-xs font-sans">No active objectives</p>
            <p className="text-[10px] font-sans text-stone-700 mt-1">
              Create objectives from the <br />
              objectives panel in the header.
            </p>
          </div>
        ) : (
          typedObjectives.map((obj) => (
            <button
              key={obj.id}
              onClick={() => handleLink(obj.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left ${
                currentObjectiveId === obj.id
                  ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                  : "bg-[#0a0a0a] border-stone-800 hover:border-stone-700 text-stone-300 hover:text-stone-100"
              }`}
            >
              <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center shrink-0">
                {currentObjectiveId === obj.id && (
                  <div className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-serif block truncate">
                  {obj.title}
                </span>
                <span
                  className={`text-[9px] font-mono flex items-center gap-1 ${
                    currentObjectiveId === obj.id
                      ? "text-rose-500/70"
                      : "text-stone-600"
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  {formatDuration(obj.time_spent)}
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
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border text-rose-400 bg-rose-500/10 border-rose-500/20 flex items-center gap-1.5">
                    <Target className="w-3 h-3" />
                    Link to Objective
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
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border text-rose-400 bg-rose-500/10 border-rose-500/20 flex items-center gap-1.5">
                  <Target className="w-3 h-3" />
                  Link to Objective
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
