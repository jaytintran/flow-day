/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

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
  const [isMaximized, setIsMaximized] = useState(false);

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
              transition={{ duration: 0.18 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/75 backdrop-blur-[2px]"
            />
            {/* Sheet container */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              drag="y"
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (info.offset.y > 100 || info.velocity.y > 300) {
                  onClose();
                }
              }}
              transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.7 }}
              style={{ willChange: 'transform' }}
              className="relative w-full h-[90vh] bg-[#121212] border-t border-stone-800 rounded-t-3xl shadow-2xl z-10 flex flex-col overflow-hidden pb-6"
            >
              {/* Drag Handle & Header */}
              <div className="flex-none flex flex-col items-center pt-3 pb-2.5 border-b border-stone-850/70 relative bg-stone-950/40">
                {/* Drag Handle Pill with accessible touch padding & click-to-close */}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close sheet"
                  className="p-2 -my-2 flex items-center justify-center cursor-pointer group"
                >
                  <div className="w-12 h-1.5 bg-stone-700 group-hover:bg-stone-500 rounded-full transition-colors" />
                </button>
                <div className="w-full px-5 flex justify-between items-center mt-1.5">
                  <span
                    className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border ${chipClass}`}
                  >
                    {label}
                  </span>
                  <button
                    type="button"
                    onClick={onClose}
                    title="Close"
                    aria-label="Close"
                    className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Sheet content area */}
              <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col">{children}</div>
            </motion.div>
          </div>
        ) : (
          /* MODAL FOR DESKTOP */
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm flex flex-1 overflow-y-auto items-center justify-center z-[999] p-4 font-sans"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className={`bg-[#121212] border border-stone-800 rounded-2xl w-full overflow-hidden shadow-2xl relative flex flex-col transition-all duration-200 ${
                isMaximized
                  ? 'max-w-6xl w-[95vw] h-[92vh] max-h-[95vh]'
                  : 'max-w-4xl h-full max-h-[88vh]'
              }`}
            >
              {/* Header section */}
              <div className="flex items-center justify-between border-b border-stone-850/80 px-6 sm:px-8 py-3.5 relative bg-stone-950/40 shrink-0">
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border ${chipClass}`}
                >
                  {label}
                </span>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsMaximized(!isMaximized)}
                    title={isMaximized ? 'Restore normal view' : 'Maximize to full view'}
                    aria-label={isMaximized ? 'Restore normal view' : 'Maximize to full view'}
                    className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
                  >
                    {isMaximized ? (
                      <Minimize2 className="w-4 h-4" />
                    ) : (
                      <Maximize2 className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    title="Close"
                    aria-label="Close"
                    className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content area */}
              <div className="px-6 sm:px-10 py-6 sm:py-8 overflow-y-auto flex-1 flex flex-col">
                {children}
              </div>
            </motion.div>
          </div>
        ))}
    </AnimatePresence>
  );
}
