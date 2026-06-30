/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Check } from 'lucide-react';

export type LabelColor = 'blue' | 'indigo' | 'amber' | 'emerald' | 'stone';

interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  onAccept?: () => void;
  onCancel?: () => void;
  label: string;
  labelColor?: LabelColor;
  isMobile: boolean;
  children: ReactNode;
}

const colorClasses: Record<LabelColor, string> = {
  blue: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
  amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  stone: 'text-stone-400 bg-stone-500/10 border-stone-500/20',
};

export default function DetailSheet({
  open,
  onClose,
  onAccept,
  onCancel,
  label,
  labelColor = 'blue',
  isMobile,
  children,
}: DetailSheetProps) {
  const chipClass = colorClasses[labelColor];
  const handleAccept = onAccept || onClose;
  const handleCancel = onCancel || onClose;

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
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-full h-[85vh] bg-[#121212] border-t border-stone-850 rounded-t-2xl shadow-2xl z-10 flex flex-col overflow-hidden pb-6"
            >
              {/* Drag Handle & Close header */}
              <div className="flex-none flex flex-col items-center pt-3 pb-2 border-b border-stone-850/60 relative">
                <button
                  onClick={onClose}
                  className="w-12 h-1 bg-stone-700 hover:bg-stone-500 rounded-full mb-3 transition-colors cursor-pointer"
                />
                <div className="w-full px-5 flex justify-between items-center">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border ${chipClass}`}
                  >
                    {label}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={handleAccept}
                      title="Accept changes"
                      className="p-1 text-emerald-500 hover:text-emerald-400 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleCancel}
                      title="Cancel changes"
                      className="p-1 text-rose-500 hover:text-rose-400 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Sheet content area */}
              <div className="flex-1 overflow-y-auto p-5 flex flex-col">{children}</div>
            </motion.div>
          </div>
        ) : (
          /* MODAL FOR DESKTOP */
          <div
            className="fixed inset-0 bg-black/75 backdrop-blur-sm flex flex-1 overflow-y-auto items-center justify-center z-[999] p-4 font-sans"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#121212] border border-stone-800 rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl relative flex flex-col h-full max-h-[85vh]"
            >
              {/* Header section */}
              <div className="flex items-center justify-between border-b border-stone-850 p-4 relative">
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border ${chipClass}`}
                >
                  {label}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleAccept}
                    title="Accept changes"
                    className="p-1 text-emerald-500 hover:text-emerald-400 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleCancel}
                    title="Cancel changes"
                    className="p-1 text-rose-500 hover:text-rose-400 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content area */}
              <div className="p-5 overflow-y-auto flex-1 flex flex-col">{children}</div>
            </motion.div>
          </div>
        ))}
    </AnimatePresence>
  );
}
