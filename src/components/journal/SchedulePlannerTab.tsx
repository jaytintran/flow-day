/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../../db';
import { TimeBlock } from '../../types';
import { AnchorItem, TodayPadData } from './DayScratchpad';
import {
  Clock,
  Plus,
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  GripVertical,
  Zap,
} from 'lucide-react';

interface SchedulePlannerTabProps {
  scratchpadDate: Date;
  onScratchpadDateChange: (date: Date) => void;
  todayPad: TodayPadData;
  onUpdateTodayPad: (data: TodayPadData) => void;
  isMobile?: boolean;
  showDateNav?: boolean;
}

const HOUR_HEIGHT = 60; // 60px per hour -> 1px = 1 minute
const TOTAL_MINUTES = 24 * 60; // 1440 minutes
const SNAP_MINUTES = 15;

function snapToMinutes(minutes: number): number {
  return Math.min(TOTAL_MINUTES, Math.max(0, Math.round(minutes / SNAP_MINUTES) * SNAP_MINUTES));
}

function formatMinutesToTime(totalMins: number): string {
  const normalized = Math.min(TOTAL_MINUTES - 1, Math.max(0, totalMins));
  const hours = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 === 0 ? 12 : hours % 12;
  const displayMins = String(mins).padStart(2, '0');
  return `${displayHours}:${displayMins} ${period}`;
}

function formatHourLabel(hour: number): string {
  if (hour === 0) return '12 AM';
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return '12 PM';
  return `${hour - 12} PM`;
}

interface PositionedBlock {
  block: TimeBlock;
  startMin: number;
  endMin: number;
  top: number;
  height: number;
  colIndex: number;
  totalCols: number;
  isCompleted: boolean;
}

export default function SchedulePlannerTab({
  scratchpadDate,
  onScratchpadDateChange,
  todayPad,
  onUpdateTodayPad,
  isMobile,
  showDateNav = true,
}: SchedulePlannerTabProps) {
  const activeDateKeyStr = scratchpadDate.toISOString().slice(0, 10);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const gridCanvasRef = useRef<HTMLDivElement>(null);

  // Ghost block state when user is dragging to create
  const [dragCreation, setDragCreation] = useState<{
    isCreating: boolean;
    startMin: number;
    currentMin: number;
  } | null>(null);

  // New block inline title input modal / prompt
  const [pendingBlock, setPendingBlock] = useState<{
    startMin: number;
    endMin: number;
    title: string;
  } | null>(null);

  // Editing block title inline
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');

  // Moving or resizing an existing block
  const [activeInteraction, setActiveInteraction] = useState<{
    type: 'move' | 'resize-top' | 'resize-bottom';
    blockId: string;
    origStartMin: number;
    origEndMin: number;
    anchorPointerY: number;
  } | null>(null);

  // Mobile long-press timer
  const mobileLongPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Query time blocks for the selected day from Dexie
  const dayBlocks = useLiveQuery(async () => {
    const startOfDay = new Date(scratchpadDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(scratchpadDate);
    endOfDay.setHours(23, 59, 59, 999);

    const entries = await db.entries.where('type').equals('time-block').toArray();
    return (entries as TimeBlock[])
      .filter((b) => {
        const bStart = new Date(b.start_at);
        return bStart >= startOfDay && bStart <= endOfDay;
      })
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [activeDateKeyStr]) || [];

  // Map anchors for completion state
  const linkedAnchorMap = useMemo(() => {
    const map = new Map<string, AnchorItem>();
    (todayPad.anchors || []).forEach((anchor) => {
      if (anchor.linkedEntryId) {
        map.set(anchor.linkedEntryId, anchor);
      }
    });
    return map;
  }, [todayPad.anchors]);

  // Active 5-slot tasks (available for quick scheduling into grid)
  const todayActiveTasks = useMemo(() => {
    return todayPad.items.filter(
      (i) => !i.isCompleted && (i.dateKey === activeDateKeyStr || !i.dateKey) && i.text.trim(),
    );
  }, [todayPad.items, activeDateKeyStr]);

  // Current wall-clock time in minutes
  const [currentMinuteNow, setCurrentMinuteNow] = useState(() => {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  });

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentMinuteNow(now.getHours() * 60 + now.getMinutes());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const isToday = useMemo(() => {
    return activeDateKeyStr === new Date().toISOString().slice(0, 10);
  }, [activeDateKeyStr]);

  // Auto-scroll to current time on mount / date change
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!scrollContainerRef.current) return;
      const targetMin = isToday ? currentMinuteNow : 8 * 60; // 8:00 AM on other days
      const targetScroll = Math.max(0, targetMin * (HOUR_HEIGHT / 60) - 180);
      scrollContainerRef.current.scrollTo({ top: targetScroll, behavior: 'smooth' });
    }, 100);
    return () => clearTimeout(timer);
  }, [activeDateKeyStr, isToday]);

  // Day navigation
  const shiftDay = (delta: number) => {
    const next = new Date(scratchpadDate);
    next.setDate(next.getDate() + delta);
    onScratchpadDateChange(next);
  };

  // Google Calendar Side-by-Side Overlap Layout Algorithm
  const positionedBlocks = useMemo<PositionedBlock[]>(() => {
    if (dayBlocks.length === 0) return [];

    const parsed = dayBlocks.map((b) => {
      const s = new Date(b.start_at);
      const e = new Date(b.end_at);
      const startMin = s.getHours() * 60 + s.getMinutes();
      const endMin = Math.max(startMin + 15, e.getHours() * 60 + e.getMinutes());
      const linkedAnchor = linkedAnchorMap.get(b.id);
      return {
        block: b,
        startMin,
        endMin,
        top: startMin * (HOUR_HEIGHT / 60),
        height: Math.max(20, (endMin - startMin) * (HOUR_HEIGHT / 60)),
        colIndex: 0,
        totalCols: 1,
        isCompleted: !!linkedAnchor?.isCompleted,
      };
    });

    // Partition into overlap clusters
    const clusters: typeof parsed[] = [];
    let currentCluster: typeof parsed = [];
    let clusterEnd = -1;

    parsed.forEach((item) => {
      if (currentCluster.length === 0) {
        currentCluster.push(item);
        clusterEnd = item.endMin;
      } else if (item.startMin < clusterEnd) {
        currentCluster.push(item);
        clusterEnd = Math.max(clusterEnd, item.endMin);
      } else {
        clusters.push(currentCluster);
        currentCluster = [item];
        clusterEnd = item.endMin;
      }
    });
    if (currentCluster.length > 0) {
      clusters.push(currentCluster);
    }

    // Allocate columns within each cluster
    clusters.forEach((cluster) => {
      const colEnds: number[] = [];
      cluster.forEach((item) => {
        let placedCol = -1;
        for (let c = 0; c < colEnds.length; c++) {
          if (colEnds[c] <= item.startMin) {
            placedCol = c;
            colEnds[c] = item.endMin;
            break;
          }
        }
        if (placedCol === -1) {
          placedCol = colEnds.length;
          colEnds.push(item.endMin);
        }
        item.colIndex = placedCol;
      });
      const totalCols = Math.max(1, colEnds.length);
      cluster.forEach((item) => {
        item.totalCols = totalCols;
      });
    });

    return parsed;
  }, [dayBlocks, linkedAnchorMap]);

  // ── Database & Anchor Sync Helpers ──────────────────────────────────────────

  const createTimeBlockWithAnchor = async (title: string, startMin: number, endMin: number) => {
    const cleanTitle = title.trim() || 'Untitled Block';
    const blockId = crypto.randomUUID();

    const startDate = new Date(scratchpadDate);
    startDate.setHours(Math.floor(startMin / 60), startMin % 60, 0, 0);

    const endDate = new Date(scratchpadDate);
    endDate.setHours(Math.floor(endMin / 60), endMin % 60, 0, 0);

    const timeStr = `${formatMinutesToTime(startMin)} - ${formatMinutesToTime(endMin)}`;

    const newBlock: TimeBlock = {
      id: blockId,
      type: 'time-block',
      title: cleanTitle,
      start_at: startDate,
      end_at: endDate,
      created_at: new Date(),
    };

    try {
      await db.entries.add(newBlock);
    } catch (e) {
      console.error('Failed to save time-block to db', e);
    }

    // Create corresponding AnchorItem
    const newAnchor: AnchorItem = {
      id: crypto.randomUUID(),
      text: cleanTitle,
      timeStr,
      isCompleted: false,
      dateKey: activeDateKeyStr,
      linkedEntryId: blockId,
    };

    const currentAnchors = todayPad.anchors || [];
    onUpdateTodayPad({
      ...todayPad,
      anchors: [...currentAnchors, newAnchor],
    });
  };

  const handleUpdateBlockTimes = async (blockId: string, newStartMin: number, newEndMin: number) => {
    const startDate = new Date(scratchpadDate);
    startDate.setHours(Math.floor(newStartMin / 60), newStartMin % 60, 0, 0);

    const endDate = new Date(scratchpadDate);
    endDate.setHours(Math.floor(newEndMin / 60), newEndMin % 60, 0, 0);

    const timeStr = `${formatMinutesToTime(newStartMin)} - ${formatMinutesToTime(newEndMin)}`;

    try {
      await db.entries.update(blockId, {
        start_at: startDate,
        end_at: endDate,
      } as any);
    } catch {}

    // Synchronize linked anchor
    const currentAnchors = todayPad.anchors || [];
    const updatedAnchors = currentAnchors.map((a) =>
      a.linkedEntryId === blockId ? { ...a, timeStr } : a,
    );
    onUpdateTodayPad({ ...todayPad, anchors: updatedAnchors });
  };

  const handleUpdateBlockTitle = async (blockId: string, newTitle: string) => {
    const finalTitle = newTitle.trim() || 'Untitled Block';
    try {
      await db.entries.update(blockId, { title: finalTitle } as any);
    } catch {}

    const currentAnchors = todayPad.anchors || [];
    const updatedAnchors = currentAnchors.map((a) =>
      a.linkedEntryId === blockId ? { ...a, text: finalTitle } : a,
    );
    onUpdateTodayPad({ ...todayPad, anchors: updatedAnchors });
    setEditingBlockId(null);
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      await db.entries.delete(blockId);
    } catch {}

    const currentAnchors = todayPad.anchors || [];
    onUpdateTodayPad({
      ...todayPad,
      anchors: currentAnchors.filter((a) => a.linkedEntryId !== blockId),
    });
  };

  const handleToggleBlockComplete = (blockId: string) => {
    const linkedAnchor = linkedAnchorMap.get(blockId);
    const nextCompleted = !linkedAnchor?.isCompleted;

    const currentAnchors = todayPad.anchors || [];
    let updatedAnchors: AnchorItem[];

    if (linkedAnchor) {
      updatedAnchors = currentAnchors.map((a) =>
        a.id === linkedAnchor.id
          ? {
              ...a,
              isCompleted: nextCompleted,
              completedAt: nextCompleted ? new Date().toISOString() : undefined,
            }
          : a,
      );
    } else {
      const block = dayBlocks.find((b) => b.id === blockId);
      if (!block) return;
      const s = new Date(block.start_at);
      const e = new Date(block.end_at);
      const sMin = s.getHours() * 60 + s.getMinutes();
      const eMin = e.getHours() * 60 + e.getMinutes();
      const newAnchor: AnchorItem = {
        id: crypto.randomUUID(),
        text: block.title,
        timeStr: `${formatMinutesToTime(sMin)} - ${formatMinutesToTime(eMin)}`,
        isCompleted: true,
        completedAt: new Date().toISOString(),
        dateKey: activeDateKeyStr,
        linkedEntryId: blockId,
      };
      updatedAnchors = [...currentAnchors, newAnchor];
    }

    onUpdateTodayPad({ ...todayPad, anchors: updatedAnchors });
  };

  // ── Drag to Create Interaction (Desktop Pointer) ───────────────────────────

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target !== gridCanvasRef.current && (e.target as HTMLElement).dataset.emptyGrid !== 'true') {
      return;
    }
    if (!gridCanvasRef.current) return;

    const rect = gridCanvasRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const startMin = snapToMinutes(offsetY / (HOUR_HEIGHT / 60));

    gridCanvasRef.current.setPointerCapture(e.pointerId);
    setDragCreation({
      isCreating: true,
      startMin,
      currentMin: Math.min(TOTAL_MINUTES, startMin + 30),
    });
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragCreation?.isCreating || !gridCanvasRef.current) return;
    const rect = gridCanvasRef.current.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const currentMin = snapToMinutes(offsetY / (HOUR_HEIGHT / 60));
    setDragCreation((prev) => (prev ? { ...prev, currentMin } : null));
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragCreation?.isCreating) return;
    if (gridCanvasRef.current) {
      try {
        gridCanvasRef.current.releasePointerCapture(e.pointerId);
      } catch {}
    }

    const { startMin, currentMin } = dragCreation;
    setDragCreation(null);

    const actualStart = Math.min(startMin, currentMin);
    const actualEnd = Math.max(startMin, currentMin);
    const duration = actualEnd - actualStart;

    if (duration >= 15) {
      setPendingBlock({
        startMin: actualStart,
        endMin: actualEnd,
        title: '',
      });
    }
  };

  // ── Mobile Touch Long-Press Gestures ───────────────────────────────────────

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    touchStartPosRef.current = { x: touch.clientX, y: touch.clientY };

    if (mobileLongPressTimerRef.current) clearTimeout(mobileLongPressTimerRef.current);

    mobileLongPressTimerRef.current = setTimeout(() => {
      if (!gridCanvasRef.current) return;
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(40);
      }
      const rect = gridCanvasRef.current.getBoundingClientRect();
      const offsetY = touch.clientY - rect.top;
      const startMin = snapToMinutes(offsetY / (HOUR_HEIGHT / 60));
      setDragCreation({
        isCreating: true,
        startMin,
        currentMin: Math.min(TOTAL_MINUTES, startMin + 30),
      });
    }, 250);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!touchStartPosRef.current) return;
    const touch = e.touches[0];
    const diffX = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const diffY = Math.abs(touch.clientY - touchStartPosRef.current.y);

    if (!dragCreation?.isCreating && (diffX > 10 || diffY > 10)) {
      if (mobileLongPressTimerRef.current) clearTimeout(mobileLongPressTimerRef.current);
    }

    if (dragCreation?.isCreating && gridCanvasRef.current) {
      e.preventDefault();
      const rect = gridCanvasRef.current.getBoundingClientRect();
      const offsetY = touch.clientY - rect.top;
      const currentMin = snapToMinutes(offsetY / (HOUR_HEIGHT / 60));
      setDragCreation((prev) => (prev ? { ...prev, currentMin } : null));
    }
  };

  const handleTouchEnd = () => {
    if (mobileLongPressTimerRef.current) clearTimeout(mobileLongPressTimerRef.current);
    if (dragCreation?.isCreating) {
      const { startMin, currentMin } = dragCreation;
      setDragCreation(null);
      const actualStart = Math.min(startMin, currentMin);
      const actualEnd = Math.max(startMin, currentMin);
      if (actualEnd - actualStart >= 15) {
        setPendingBlock({
          startMin: actualStart,
          endMin: actualEnd,
          title: '',
        });
      }
    }
  };

  // ── Move & Resize Handling for Existing Blocks ─────────────────────────────

  const handleInteractionPointerDown = (
    e: React.PointerEvent,
    type: 'move' | 'resize-top' | 'resize-bottom',
    blockId: string,
    startMin: number,
    endMin: number,
  ) => {
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setActiveInteraction({
      type,
      blockId,
      origStartMin: startMin,
      origEndMin: endMin,
      anchorPointerY: e.clientY,
    });
  };

  const handleInteractionPointerMove = (e: React.PointerEvent) => {
    if (!activeInteraction) return;
    const deltaPixels = e.clientY - activeInteraction.anchorPointerY;
    const deltaMinutes = snapToMinutes(deltaPixels / (HOUR_HEIGHT / 60));

    if (activeInteraction.type === 'move') {
      const duration = activeInteraction.origEndMin - activeInteraction.origStartMin;
      const newStart = Math.min(
        TOTAL_MINUTES - duration,
        Math.max(0, activeInteraction.origStartMin + deltaMinutes),
      );
      const newEnd = newStart + duration;
      handleUpdateBlockTimes(activeInteraction.blockId, newStart, newEnd);
    } else if (activeInteraction.type === 'resize-bottom') {
      const newEnd = Math.min(
        TOTAL_MINUTES,
        Math.max(activeInteraction.origStartMin + 15, activeInteraction.origEndMin + deltaMinutes),
      );
      handleUpdateBlockTimes(activeInteraction.blockId, activeInteraction.origStartMin, newEnd);
    } else if (activeInteraction.type === 'resize-top') {
      const newStart = Math.max(
        0,
        Math.min(activeInteraction.origEndMin - 15, activeInteraction.origStartMin + deltaMinutes),
      );
      handleUpdateBlockTimes(activeInteraction.blockId, newStart, activeInteraction.origEndMin);
    }
  };

  const handleInteractionPointerUp = (e: React.PointerEvent) => {
    if (!activeInteraction) return;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
    setActiveInteraction(null);
  };

  // Commit pending block
  const commitPendingBlock = () => {
    if (!pendingBlock) return;
    createTimeBlockWithAnchor(pendingBlock.title, pendingBlock.startMin, pendingBlock.endMin);
    setPendingBlock(null);
  };

  // Quick Schedule from 5-Slot Active Engine
  const handleQuickScheduleTask = (taskText: string) => {
    const nextStart = snapToMinutes(currentMinuteNow);
    const nextEnd = Math.min(TOTAL_MINUTES, nextStart + 45);
    createTimeBlockWithAnchor(taskText, nextStart, nextEnd);
  };

  return (
    <div className="flex flex-col h-full select-none font-sans overflow-hidden">
      {/* ── Top Header Toolbar ── */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800/80 px-1 shrink-0">
        {showDateNav ? (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftDay(-1)}
              className="p-1 rounded-md text-stone-500 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono font-bold text-stone-200 min-w-[100px] text-center">
              {scratchpadDate.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
              })}
            </span>
            <button
              type="button"
              onClick={() => shiftDay(1)}
              className="p-1 rounded-md text-stone-500 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            {!isToday && (
              <button
                type="button"
                onClick={() => onScratchpadDateChange(new Date())}
                className="text-[10px] font-mono text-amber-500 hover:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 transition-colors cursor-pointer ml-1"
              >
                Today
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-500" />
            <span className="text-xs font-mono font-bold text-stone-200 tracking-wider uppercase">
              Schedule Planner
            </span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-stone-500">
            {dayBlocks.length} block{dayBlocks.length === 1 ? '' : 's'}
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 bg-stone-900 border border-stone-800 rounded text-amber-500/80">
            15m Snap
          </span>
        </div>
      </div>

      {/* ── Quick-Schedule 5-Slot Active Drawer / Tray ── */}
      {todayActiveTasks.length > 0 && (
        <div className="mb-2 px-1 flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-none">
          <div className="flex items-center gap-1 text-[10px] font-mono text-amber-500/80 shrink-0 mr-1">
            <Zap className="w-3 h-3 text-amber-500" />
            <span>5-Slot:</span>
          </div>
          {todayActiveTasks.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleQuickScheduleTask(item.text)}
              className="group flex items-center gap-1 text-[10px] font-mono bg-stone-900/80 hover:bg-amber-500/15 border border-stone-800 hover:border-amber-500/40 text-stone-300 hover:text-amber-300 px-2 py-0.5 rounded-full transition-colors shrink-0 cursor-pointer"
              title="Click to schedule into timeline"
            >
              <Plus className="w-2.5 h-2.5 text-stone-500 group-hover:text-amber-400" />
              <span className="truncate max-w-[120px]">{item.text}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Main Vertical 24-Hour Time Grid ── */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto relative border border-stone-800/80 rounded-xl bg-stone-950/40"
      >
        <div
          ref={gridCanvasRef}
          onPointerDown={handleCanvasPointerDown}
          onPointerMove={handleCanvasPointerMove}
          onPointerUp={handleCanvasPointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative w-full flex"
          style={{ height: `${24 * HOUR_HEIGHT}px` }}
        >
          {/* Left Hour Gutter */}
          <div className="w-14 shrink-0 border-r border-stone-800/60 bg-stone-900/30 select-none">
            {Array.from({ length: 24 }).map((_, hour) => (
              <div
                key={hour}
                style={{ height: `${HOUR_HEIGHT}px` }}
                className="relative border-b border-stone-800/40 text-[10px] font-mono text-stone-500 text-right pr-2 pt-1"
              >
                <span>{formatHourLabel(hour)}</span>
              </div>
            ))}
          </div>

          {/* Interactive Schedule Canvas */}
          <div data-empty-grid="true" className="flex-1 relative h-full">
            {/* Horizontal Hour Lines & 30-min dashed guides */}
            {Array.from({ length: 24 }).map((_, hour) => (
              <div
                key={hour}
                data-empty-grid="true"
                style={{ top: `${hour * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                className="absolute left-0 right-0 border-b border-stone-800/40 pointer-events-none"
              >
                {/* 30-min dashed line */}
                <div
                  style={{ top: `${HOUR_HEIGHT / 2}px` }}
                  className="absolute left-0 right-0 border-b border-dashed border-stone-850/60"
                />
              </div>
            ))}

            {/* Live Red "Now" Needle Indicator */}
            {isToday && (
              <div
                style={{ top: `${currentMinuteNow * (HOUR_HEIGHT / 60)}px` }}
                className="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
              >
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm shadow-rose-500/80 -ml-1.5 shrink-0" />
                <div className="h-0.5 flex-1 bg-rose-500/80" />
                <span className="text-[9px] font-mono text-rose-400 bg-stone-950/90 border border-rose-500/40 px-1 py-0.2 rounded mr-1">
                  {formatMinutesToTime(currentMinuteNow)}
                </span>
              </div>
            )}

            {/* Ghost Drag-to-Create Preview Box */}
            {dragCreation?.isCreating && (
              <div
                style={{
                  top: `${Math.min(dragCreation.startMin, dragCreation.currentMin) * (HOUR_HEIGHT / 60)}px`,
                  height: `${Math.max(15, Math.abs(dragCreation.currentMin - dragCreation.startMin)) * (HOUR_HEIGHT / 60)}px`,
                  left: '4px',
                  right: '4px',
                }}
                className="absolute z-20 bg-amber-500/20 border-2 border-dashed border-amber-400 rounded-lg pointer-events-none flex flex-col justify-between p-2 shadow-lg"
              >
                <div className="flex items-center gap-1 text-[11px] font-mono font-bold text-amber-300">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {formatMinutesToTime(Math.min(dragCreation.startMin, dragCreation.currentMin))} –{' '}
                    {formatMinutesToTime(Math.max(dragCreation.startMin, dragCreation.currentMin))}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-amber-400/80">
                  Release to name block
                </span>
              </div>
            )}

            {/* Render Positioned Time Blocks */}
            {positionedBlocks.map(({ block, top, height, colIndex, totalCols, startMin, endMin, isCompleted }) => {
              const widthPct = 100 / totalCols;
              const leftPct = colIndex * widthPct;
              const isEditing = editingBlockId === block.id;

              return (
                <div
                  key={block.id}
                  style={{
                    top: `${top}px`,
                    height: `${height}px`,
                    left: `calc(${leftPct}% + 4px)`,
                    width: `calc(${widthPct}% - 8px)`,
                  }}
                  className={`group absolute z-10 rounded-lg border transition-all flex flex-col justify-between overflow-hidden shadow-xs ${
                    isCompleted
                      ? 'bg-stone-900/50 border-stone-800 text-stone-500 opacity-60'
                      : 'bg-amber-500/15 hover:bg-amber-500/20 border-amber-500/40 hover:border-amber-400/80 text-stone-200'
                  }`}
                  onPointerMove={handleInteractionPointerMove}
                  onPointerUp={handleInteractionPointerUp}
                >
                  {/* Top Resize Handle */}
                  <div
                    onPointerDown={(e) =>
                      handleInteractionPointerDown(e, 'resize-top', block.id, startMin, endMin)
                    }
                    className="h-2 w-full cursor-ns-resize shrink-0 hover:bg-amber-400/30 transition-colors"
                    title="Drag to resize start time"
                  />

                  {/* Block Content Body */}
                  <div className="flex-1 px-2 py-0.5 flex items-start justify-between gap-1 min-w-0">
                    <div className="flex items-start gap-1.5 flex-1 min-w-0">
                      {/* Completion checkmark */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleBlockComplete(block.id);
                        }}
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 cursor-pointer transition-colors ${
                          isCompleted
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-500'
                            : 'border-stone-600 hover:border-emerald-400 text-transparent hover:text-emerald-400'
                        }`}
                      >
                        <Check className="w-2 h-2 stroke-[3]" />
                      </button>

                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <input
                            autoFocus
                            type="text"
                            value={editingTitle}
                            onChange={(e) => setEditingTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleUpdateBlockTitle(block.id, editingTitle);
                              if (e.key === 'Escape') setEditingBlockId(null);
                            }}
                            onBlur={() => handleUpdateBlockTitle(block.id, editingTitle)}
                            className="w-full bg-stone-950 border border-amber-500/60 rounded px-1 text-xs text-amber-300 focus:outline-none font-mono"
                          />
                        ) : (
                          <div
                            onClick={() => {
                              setEditingBlockId(block.id);
                              setEditingTitle(block.title);
                            }}
                            className={`text-xs font-mono font-bold truncate cursor-pointer ${
                              isCompleted ? 'line-through text-stone-500' : 'text-stone-100 hover:text-amber-300'
                            }`}
                            title="Click to rename"
                          >
                            {block.title}
                          </div>
                        )}

                        <div className="text-[10px] font-mono text-amber-500/90 truncate">
                          {formatMinutesToTime(startMin)} – {formatMinutesToTime(endMin)}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Move Drag Handle & Delete */}
                    <div className="flex items-center gap-0.5 shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <div
                        onPointerDown={(e) =>
                          handleInteractionPointerDown(e, 'move', block.id, startMin, endMin)
                        }
                        className="p-1 text-stone-500 hover:text-amber-400 cursor-grab active:cursor-grabbing touch-none"
                        title="Drag to reschedule"
                      >
                        <GripVertical className="w-3 h-3" />
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteBlock(block.id);
                        }}
                        className="p-1 text-stone-500 hover:text-rose-400 cursor-pointer"
                        title="Delete block"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Bottom Resize Handle */}
                  <div
                    onPointerDown={(e) =>
                      handleInteractionPointerDown(e, 'resize-bottom', block.id, startMin, endMin)
                    }
                    className="h-2 w-full cursor-ns-resize shrink-0 hover:bg-amber-400/30 transition-colors"
                    title="Drag to resize end time"
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Pending Block Name Modal / Popover ── */}
      <AnimatePresence>
        {pendingBlock && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 backdrop-blur-xs"
          >
            <div className="bg-stone-900 border border-stone-700 rounded-xl p-4 w-full max-w-sm shadow-2xl space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wide">
                  New Time Block
                </span>
                <span className="text-[10px] text-stone-400">
                  {formatMinutesToTime(pendingBlock.startMin)} –{' '}
                  {formatMinutesToTime(pendingBlock.endMin)}
                </span>
              </div>

              <input
                autoFocus
                type="text"
                value={pendingBlock.title}
                onChange={(e) =>
                  setPendingBlock((prev) => (prev ? { ...prev, title: e.target.value } : null))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitPendingBlock();
                  if (e.key === 'Escape') setPendingBlock(null);
                }}
                placeholder="Title (e.g. Deep Work, Team Sync)..."
                className="w-full bg-stone-950 border border-amber-500/50 rounded-lg px-3 py-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPendingBlock(null)}
                  className="px-3 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={commitPendingBlock}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-stone-950 hover:bg-amber-400 transition-colors cursor-pointer shadow-xs"
                >
                  Save Block
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
