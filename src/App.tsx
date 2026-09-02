/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import TimerBar from './components/TimerBar';
import DayNavigator from './components/DayNavigator';
import Journal from './components/journal/Journal';
import InputBar from './components/InputBar';
import DayScratchpad from './components/journal/DayScratchpad';
import DayHighlights from './components/journal/DayHighlights';

import { DayRange } from './types';

type ViewMode = 'day' | 'timeline' | 'records' | 'lists' | 'hub';
const VALID_MODES: ViewMode[] = ['day', 'timeline', 'records', 'lists', 'hub'];

function getInitialViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem('flowday-view-mode');
    if (stored === 'tasks') return 'lists';
    if (stored && VALID_MODES.includes(stored as ViewMode)) return stored as ViewMode;
  } catch {}
  return 'day';
}

function getInitialDayRange(): DayRange {
  try {
    const stored = localStorage.getItem('flowday-dayview-range');
    if (stored === '1D' || stored === '3D' || stored === '4D' || stored === '1W') return stored;
  } catch {}
  return '1D';
}

export default function App() {
  const [activeDate, setActiveDate] = useState<Date>(new Date());
  const [viewMode, setViewModeRaw] = useState<ViewMode>(getInitialViewMode);
  const [dayRange, setDayRangeRaw] = useState<DayRange>(getInitialDayRange);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeRaw(mode);
    try {
      localStorage.setItem('flowday-view-mode', mode);
    } catch {}
  }, []);

  const setDayRange = useCallback((range: DayRange) => {
    setDayRangeRaw(range);
    try {
      localStorage.setItem('flowday-dayview-range', range);
    } catch {}
  }, []);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeHubTab, setActiveHubTab] = useState<'focus' | 'goals' | 'objectives' | 'habits'>(
    'goals',
  );

  const [isScratchpadOpen, setIsScratchpadOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flowday_day_scratchpad_is_open') === 'true';
    } catch {
      return false;
    }
  });

  const toggleScratchpad = useCallback(() => {
    setIsScratchpadOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('flowday_day_scratchpad_is_open', String(next));
      } catch {}
      return next;
    });
  }, []);

  const [isHighlightsOpen, setIsHighlightsOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem('flowday_day_highlights_is_open') === 'true';
    } catch {
      return false;
    }
  });

  const toggleHighlights = useCallback(() => {
    setIsHighlightsOpen((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('flowday_day_highlights_is_open', String(next));
      } catch {}
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0a] text-stone-200 font-sans selection:bg-stone-800 selection:text-stone-100 relative select-none">
      {/* ZONE 1 — HEADER (FIXED TOP) */}
      <header
        className="flex-none relative z-40 bg-[#121212]"
        id="app-fixed-header"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Task Timer Bar Row */}
        <TimerBar
          activeTaskId={activeTaskId}
          setActiveTaskId={setActiveTaskId}
          viewMode={viewMode}
          activeDate={activeDate}
        />

        {/* Day Navigator, Calendar and Switcher Control Row */}
        <DayNavigator
          activeDate={activeDate}
          setActiveDate={setActiveDate}
          viewMode={viewMode}
          setViewMode={setViewMode}
          dayRange={dayRange}
          setDayRange={setDayRange}
          activeHubTab={activeHubTab}
          setActiveHubTab={setActiveHubTab}
          isScratchpadOpen={isScratchpadOpen}
          toggleScratchpad={toggleScratchpad}
          isHighlightsOpen={isHighlightsOpen}
          toggleHighlights={toggleHighlights}
        />
      </header>

      {/* ZONE 2 — MAIN TIMELINE (SCROLLABLE AREA) */}
      <main
        className="flex-1 min-h-0 overflow-hidden flex flex-col relative bg-[#0a0a0a]"
        id="app-scrollable-main"
      >
        {/* Subtle grid lines background overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <Journal
          activeDate={activeDate}
          setActiveDate={setActiveDate}
          viewMode={viewMode}
          dayRange={dayRange}
          setDayRange={setDayRange}
          activeTaskId={activeTaskId}
          setActiveTaskId={setActiveTaskId}
          activeHubTab={activeHubTab}
          setActiveHubTab={setActiveHubTab}
        />
      </main>

      {/* ZONE 3 — INPUT BAR (FIXED BOTTOM) */}
      {viewMode !== 'hub' && (
        <footer
          className="flex-none relative z-35 bg-[#121212]"
          id="app-fixed-input"
          style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        >
          <InputBar activeDate={activeDate} viewMode={viewMode} />
        </footer>
      )}

      {/* GLOBAL PERSISTENT SCRATCHPAD */}
      <DayScratchpad
        activeDate={activeDate}
        viewMode={viewMode}
        isOpen={isScratchpadOpen}
        onToggle={toggleScratchpad}
      />

      {/* GLOBAL PERSISTENT DAY HIGHLIGHTS */}
      <DayHighlights
        isOpen={isHighlightsOpen}
        onToggle={toggleHighlights}
      />
    </div>
  );
}
