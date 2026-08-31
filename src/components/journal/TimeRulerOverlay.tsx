/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { X, Clock } from 'lucide-react';
import { TimelineEntry } from '../../types';

interface TimeRulerOverlayProps {
  entry: TimelineEntry | any;
  initialDate: Date;
  initialEndDate?: Date;
  mode?: 'start' | 'end' | 'span';
  originY: number;
  originX: number;
  formatTime: (date: Date | string) => string;
  onConfirm: (newDate: Date) => void;
  onConfirmSpan?: (newStart: Date, newEnd?: Date) => void;
  onCancel: () => void;
}

export default function TimeRulerOverlay({
  entry,
  initialDate,
  initialEndDate,
  mode = 'start',
  originY,
  originX,
  formatTime,
  onConfirm,
  onConfirmSpan,
  onCancel,
}: TimeRulerOverlayProps) {
  const [currentY, setCurrentY] = useState(originY);
  const [isOverCancel, setIsOverCancel] = useState(false);
  const cancelBtnRef = useRef<HTMLDivElement>(null);
  const lastVibratedMinuteRef = useRef<number | null>(null);

  // Ruler dimensions & calculation bounds
  // We place the ruler in the viewport between TOP_PADDING and (window.innerHeight - BOTTOM_PADDING)
  const TOP_PADDING = 80;
  const BOTTOM_PADDING = 90;
  const rulerHeight = Math.max(300, window.innerHeight - TOP_PADDING - BOTTOM_PADDING);

  const durationMs = useMemo(() => {
    if (initialEndDate && initialEndDate.getTime() > initialDate.getTime()) {
      return initialEndDate.getTime() - initialDate.getTime();
    }
    return 0;
  }, [initialDate, initialEndDate]);

  // Map pointer Y to minutes of day (0 to 1439) with 15-minute / 5-minute magnetic snapping
  const { calculatedDate, calculatedEndDate, formattedTime, diffLabel, isSnapped } = useMemo(() => {
    // Clamp Y within ruler bounds
    const clampedY = Math.max(TOP_PADDING, Math.min(TOP_PADDING + rulerHeight, currentY));
    const ratio = (clampedY - TOP_PADDING) / rulerHeight;

    // Total minutes in day = 24 * 60 = 1440
    let totalMinutes = Math.round(ratio * 1440);
    // Magnetic snap to nearest 15-minute mark (or 5m if fine)
    const snappedMinutes = Math.round(totalMinutes / 15) * 15;
    const finalMinutes = Math.min(1439, Math.max(0, snappedMinutes));

    const hours = Math.floor(finalMinutes / 60);
    const mins = finalMinutes % 60;

    const baseReferenceDate = mode === 'end' && initialEndDate ? initialEndDate : initialDate;
    const newDate = new Date(baseReferenceDate);
    newDate.setHours(hours, mins, 0, 0);

    let newEndDate: Date | undefined = undefined;
    if (mode === 'span' && durationMs > 0) {
      newEndDate = new Date(newDate.getTime() + durationMs);
    } else if (mode === 'end') {
      newEndDate = newDate;
    } else if (mode === 'start' && initialEndDate) {
      newEndDate = initialEndDate;
    }

    const diffMinutes = Math.round((newDate.getTime() - baseReferenceDate.getTime()) / 60000);
    let diffStr = '';
    if (diffMinutes === 0) {
      diffStr = 'Same time';
    } else {
      const absDiff = Math.abs(diffMinutes);
      const sign = diffMinutes > 0 ? '+' : '-';
      if (absDiff < 60) {
        diffStr = `${sign}${absDiff}m`;
      } else {
        const h = Math.floor(absDiff / 60);
        const m = absDiff % 60;
        diffStr = `${sign}${h}h${m > 0 ? ` ${m}m` : ''}`;
      }
    }

    let timeDisplay = formatTime(newDate);
    if (mode === 'span' && newEndDate) {
      timeDisplay = `${formatTime(newDate)} – ${formatTime(newEndDate)}`;
    }

    return {
      calculatedDate: newDate,
      calculatedEndDate: newEndDate,
      formattedTime: timeDisplay,
      diffLabel: diffStr,
      isSnapped: true,
      finalMinutes,
    };
  }, [currentY, initialDate, initialEndDate, mode, durationMs, rulerHeight, formatTime]);

  // Haptic feedback when crossing into a new 15-minute slot
  useEffect(() => {
    const slot = Math.floor(calculatedDate.getMinutes() / 15) + calculatedDate.getHours() * 4;
    if (lastVibratedMinuteRef.current !== null && lastVibratedMinuteRef.current !== slot) {
      try {
        if ('vibrate' in navigator) navigator.vibrate(8);
      } catch {}
    }
    lastVibratedMinuteRef.current = slot;
  }, [calculatedDate]);

  // Check collision with cancel circle button
  const checkCancelCollision = useCallback((x: number, y: number): boolean => {
    if (!cancelBtnRef.current) return false;
    const rect = cancelBtnRef.current.getBoundingClientRect();
    // Circular radius check with generous threshold (expand radius by 20px for easy drop)
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const radius = rect.width / 2 + 20;
    const dist = Math.hypot(x - centerX, y - centerY);
    return dist <= radius;
  }, []);

  // Global pointer & touch listeners
  useEffect(() => {
    let isFinished = false;

    const handlePointerMove = (e: PointerEvent) => {
      if (isFinished) return;
      setCurrentY(e.clientY);
      const overCancel = checkCancelCollision(e.clientX, e.clientY);
      setIsOverCancel(overCancel);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (isFinished) return;
      if (e.cancelable) e.preventDefault();
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        setCurrentY(touch.clientY);
        const overCancel = checkCancelCollision(touch.clientX, touch.clientY);
        setIsOverCancel(overCancel);
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isFinished) return;
      isFinished = true;
      const overCancel = checkCancelCollision(e.clientX, e.clientY);
      if (overCancel) {
        onCancel();
      } else {
        if (onConfirmSpan) {
          onConfirmSpan(calculatedDate, calculatedEndDate);
        } else {
          onConfirm(calculatedDate);
        }
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (isFinished) return;
      isFinished = true;
      if (e.changedTouches.length > 0) {
        const touch = e.changedTouches[0];
        const overCancel = checkCancelCollision(touch.clientX, touch.clientY);
        if (overCancel) {
          onCancel();
        } else {
          if (onConfirmSpan) {
            onConfirmSpan(calculatedDate, calculatedEndDate);
          } else {
            onConfirm(calculatedDate);
          }
        }
      } else {
        if (onConfirmSpan) {
          onConfirmSpan(calculatedDate, calculatedEndDate);
        } else {
          onConfirm(calculatedDate);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFinished) return;
        isFinished = true;
        onCancel();
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd, { passive: false });
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [calculatedDate, checkCancelCollision, onCancel, onConfirm]);

  // Generate hour markers (0 to 24)
  const hourTicks = useMemo(() => {
    const ticks = [];
    for (let h = 0; h <= 24; h += 2) {
      const topPct = (h / 24) * 100;
      const displayHour = h === 0 ? '12 AM' : h === 12 ? '12 PM' : h === 24 ? '12 AM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
      ticks.push({ hour: h, topPct, label: displayHour });
    }
    return ticks;
  }, []);

  // Calculate indicator position percentage
  const currentMinutes = calculatedDate.getHours() * 60 + calculatedDate.getMinutes();
  const indicatorPct = (currentMinutes / 1440) * 100;

  return (
    <div
      className="fixed inset-0 z-50 select-none cursor-ns-resize backdrop-blur-[2px] bg-black/40 animate-fade-in touch-none"
      style={{ touchAction: 'none' }}
    >
      {/* 1. Header guide prompt */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-1.5 rounded-full bg-stone-900/90 border border-stone-800 text-stone-300 text-xs font-mono shadow-2xl pointer-events-none">
        <Clock className="w-3.5 h-3.5 text-amber-400" />
        <span>Drag vertically to adjust time · Drop onto (X) to cancel</span>
      </div>

      {/* 2. Vertical Time Ruler Track */}
      <div
        className="absolute left-6 md:left-16 w-20 flex flex-col items-end pointer-events-none"
        style={{
          top: `${TOP_PADDING}px`,
          height: `${rulerHeight}px`,
        }}
      >
        {/* Continuous vertical spine */}
        <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-stone-800/80 rounded-full" />

        {/* Hour marks */}
        {hourTicks.map((tick) => (
          <div
            key={tick.hour}
            className="absolute right-0 flex items-center gap-2 -translate-y-1/2"
            style={{ top: `${tick.topPct}%` }}
          >
            <span className="text-[10px] font-mono text-stone-400 font-medium tracking-tight">
              {tick.label}
            </span>
            <div className="w-3 h-[1.5px] bg-stone-700" />
          </div>
        ))}

        {/* 1-Hour intermediate subtle ticks */}
        {Array.from({ length: 25 }, (_, i) => i).map((h) => {
          if (h % 2 === 0) return null; // already rendered
          return (
            <div
              key={`odd-${h}`}
              className="absolute right-0 flex items-center -translate-y-1/2"
              style={{ top: `${(h / 24) * 100}%` }}
            >
              <div className="w-2 h-[1px] bg-stone-800" />
            </div>
          );
        })}

        {/* Active time indicator line on the ruler */}
        <div
          className="absolute -right-2 left-0 h-[2px] bg-amber-400 shadow-[0_0_10px_#f59e0b] -translate-y-1/2 flex items-center justify-end"
          style={{ top: `${indicatorPct}%` }}
        >
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 ring-4 ring-amber-400/20 -mr-1" />
        </div>
      </div>

      {/* 3. Floating Preview Badge tracking cursor Y */}
      <div
        className={`fixed left-28 md:left-44 flex items-center gap-2.5 pointer-events-none will-change-transform ${
          isOverCancel ? 'opacity-30 scale-95' : 'opacity-100 scale-100'
        }`}
        style={{
          top: 0,
          transform: `translate3d(0, ${Math.max(TOP_PADDING, Math.min(TOP_PADDING + rulerHeight, currentY)) - 24}px, 0)`,
        }}
      >
        {/* Horizontal connector guide line */}
        <div className="w-6 md:w-8 h-[1.5px] bg-amber-400/80 shadow-[0_0_8px_#f59e0b]" />

        {/* Floating Time Pill */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-[#121212] border border-amber-500/50 text-stone-100 shadow-[0_8px_30px_rgba(0,0,0,0.85)] backdrop-blur-md">
          <span className="text-base md:text-lg font-mono font-bold text-amber-400 tracking-tight">
            {formattedTime}
          </span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
              diffLabel === 'Same time'
                ? 'bg-stone-800 text-stone-400'
                : diffLabel.startsWith('+')
                  ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}
          >
            {diffLabel}
          </span>
        </div>
      </div>

      {/* 4. Circular (X) Cancel Drop Zone Target */}
      <div
        ref={cancelBtnRef}
        className={`fixed bottom-10 right-10 md:bottom-14 md:right-16 flex flex-col items-center gap-2 transition-all duration-200 pointer-events-auto ${
          isOverCancel ? 'scale-125' : 'scale-100 hover:scale-105'
        }`}
      >
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-200 cursor-pointer ${
            isOverCancel
              ? 'bg-red-950/90 border-red-500 text-red-300 shadow-[0_0_30px_rgba(239,68,68,0.6)] animate-pulse'
              : 'bg-stone-900/80 border-stone-700 text-stone-400 shadow-xl backdrop-blur-sm'
          }`}
        >
          <X className={`transition-transform duration-200 ${isOverCancel ? 'w-8 h-8 rotate-90 stroke-[2.5]' : 'w-6 h-6 stroke-[2]'}`} />
        </div>
        <span
          className={`text-[10px] font-mono font-bold tracking-wider uppercase transition-colors ${
            isOverCancel ? 'text-red-400' : 'text-stone-500'
          }`}
        >
          {isOverCancel ? 'Release to cancel' : 'Drop here to cancel'}
        </span>
      </div>
    </div>
  );
}
