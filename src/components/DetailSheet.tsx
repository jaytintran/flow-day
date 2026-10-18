/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

export type LabelColor = 'blue' | 'indigo' | 'amber' | 'emerald' | 'stone';

export interface DetailSheetProps {
  open: boolean;
  onClose: () => void;
  onAccept?: () => void;
  onCancel?: () => void;
  label?: string;
  labelColor?: LabelColor;
  headerContent?: ReactNode;
  isMobile?: boolean;
  children: ReactNode;
  disableDrag?: boolean;
  fullScreen?: boolean;
  showMaximizeToggle?: boolean;
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
  headerContent,
  isMobile: isMobileProp,
  children,
  disableDrag = false,
  fullScreen = true,
  showMaximizeToggle = true,
}: DetailSheetProps) {
  const chipClass = colorClasses[labelColor] || colorClasses.blue;

  // Auto-detect mobile if not explicitly provided
  const [internalIsMobile, setInternalIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  );

  useEffect(() => {
    const handleResize = () => setInternalIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = isMobileProp !== undefined ? isMobileProp : internalIsMobile;

  // Full-screen / expanded by default as requested
  const [isMaximized, setIsMaximized] = useState(true);

  // Stable ref for onClose to avoid re-triggering effects
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Keyboard Escape listener
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open]);

  const sheetJSX = (
    <AnimatePresence>
      {open &&
        (isMobile ? (
          /* FULL-SCREEN / BOTTOM SHEET FOR MOBILE */
          <div className="fixed inset-0 z-[9999] flex items-end justify-center font-sans">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={onClose}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />

            {/* Sheet container */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              drag={disableDrag ? false : 'y'}
              dragConstraints={{ top: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={(_, info) => {
                if (!disableDrag && (info.offset.y > 100 || info.velocity.y > 300)) {
                  onClose();
                }
              }}
              transition={{ type: 'spring', damping: 32, stiffness: 340, mass: 0.7 }}
              style={{ willChange: 'transform' }}
              className={`relative w-full bg-[#121212] z-10 flex flex-col overflow-hidden shadow-2xl ${
                fullScreen || isMaximized
                  ? 'h-[100dvh] rounded-none'
                  : 'h-[92vh] border-t border-stone-800 rounded-t-3xl pb-6'
              }`}
            >
              {/* Safe area spacer — pushes content below the phone's status bar / notch on full-screen mode */}
              {(fullScreen || isMaximized) && (
                <div className="flex-none" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
              )}

              {/* Optional Drag Handle Pill (hidden when disableDrag is true) */}
              {!disableDrag && (
                <div className="flex-none flex flex-col items-center pt-2.5 pb-1 bg-stone-950/60 cursor-pointer">
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close sheet"
                    className="p-1.5 flex items-center justify-center group"
                  >
                    <div className="w-12 h-1.5 bg-stone-700 group-hover:bg-stone-500 rounded-full transition-colors" />
                  </button>
                </div>
              )}

              {/* Header */}
              <div className="flex-none flex items-center justify-between px-4 sm:px-6 py-3 border-b border-stone-850/80 bg-stone-950/60">
                <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0 pr-2">
                  {headerContent ? (
                    headerContent
                  ) : (
                    label && (
                      <span
                        className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border ${chipClass}`}
                      >
                        {label}
                      </span>
                    )
                  )}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  title="Close"
                  aria-label="Close"
                  className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Sheet content area */}
              <div
                className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 flex flex-col min-h-0"
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 12px) + 8px)' }}
              >
                {children}
              </div>
            </motion.div>
          </div>
        ) : (
          /* FULL-SCREEN / EXPANDED MODAL FOR DESKTOP */
          <div
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] p-3 sm:p-5 font-sans"
            onClick={onClose}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              className={`bg-[#121212] border border-stone-800 rounded-2xl w-full overflow-hidden shadow-2xl relative flex flex-col transition-all duration-200 ${
                fullScreen || isMaximized
                  ? 'max-w-7xl w-[96vw] h-[94vh] max-h-[96vh]'
                  : 'max-w-4xl h-full max-h-[88vh]'
              }`}
            >
              {/* Header section */}
              <div className="flex items-center justify-between border-b border-stone-850/80 px-6 sm:px-8 py-3.5 relative bg-stone-950/60 shrink-0">
                <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0 pr-2">
                  {headerContent ? (
                    headerContent
                  ) : (
                    label && (
                      <span
                        className={`text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded-md border ${chipClass}`}
                      >
                        {label}
                      </span>
                    )
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {showMaximizeToggle && (
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
                  )}
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
              <div className="px-6 sm:px-8 py-5 overflow-y-auto flex-1 flex flex-col min-h-0">
                {children}
              </div>
            </motion.div>
          </div>
        ))}
    </AnimatePresence>
  );

  return typeof document !== 'undefined' ? createPortal(sheetJSX, document.body) : sheetJSX;
}
