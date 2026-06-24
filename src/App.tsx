/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback } from 'react';
import TimerBar from './components/TimerBar';
import DayNavigator from './components/DayNavigator';
import Journal from './components/journal/Journal';
import InputBar from './components/InputBar';

type ViewMode = 'day' | 'timeline' | 'records' | 'tasks' | 'hub';
const VALID_MODES: ViewMode[] = ['day', 'timeline', 'records', 'tasks', 'hub'];

function getInitialViewMode(): ViewMode {
  try {
    const stored = localStorage.getItem('flowday-view-mode');
    if (stored && VALID_MODES.includes(stored as ViewMode)) return stored as ViewMode;
  } catch {}
  return 'day';
}

export default function App() {
  const [activeDate, setActiveDate] = useState<Date>(new Date());
  const [viewMode, setViewModeRaw] = useState<ViewMode>(getInitialViewMode);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeRaw(mode);
    try { localStorage.setItem('flowday-view-mode', mode); } catch {}
  }, []);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeHubTab, setActiveHubTab] = useState<'focus' | 'goals' | 'objectives' | 'habits'>(
    'goals',
  );

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#0a0a0a] text-stone-200 font-sans selection:bg-stone-800 selection:text-stone-100 relative select-none">
      {/* ZONE 1 — HEADER (FIXED TOP) */}
      <header
        className="flex-none relative z-40 bg-[#121212]"
        id="app-fixed-header"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        {/* Task Timer Bar Row */}
        <TimerBar activeTaskId={activeTaskId} setActiveTaskId={setActiveTaskId} />

        {/* Day Navigator, Calendar and Switcher Control Row */}
        <DayNavigator
          activeDate={activeDate}
          setActiveDate={setActiveDate}
          viewMode={viewMode}
          setViewMode={setViewMode}
          activeHubTab={activeHubTab}
          setActiveHubTab={setActiveHubTab}
        />
      </header>

      {/* ZONE 2 — MAIN TIMELINE (SCROLLABLE AREA) */}
      <main
        className="flex-1 overflow-hidden flex flex-col relative bg-[#0a0a0a]"
        id="app-scrollable-main"
      >
        {/* Subtle grid lines background overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <Journal
          activeDate={activeDate}
          setActiveDate={setActiveDate}
          viewMode={viewMode}
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
    </div>
  );
}
