/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Task, Objective, Goal, TimerState, TaskAchievement, ViewMode } from '../types';
import { formatDuration } from '../utils';
import {
  Search,
  Play,
  Pause,
  CheckCircle,
  Trash2,
  ChevronDown,
  Check,
  Plus,
  Target,
  Flag,
  RotateCcw,
  Square,
  CheckIcon,
  UploadCloud,
  DownloadCloud,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Settings from './Settings';
import { useGistSync } from '../hooks/useGistSync';
import ObjectivePickerSheet from './ObjectivePickerSheet';
import GoalPickerSheet from './GoalPickerSheet';

interface TimerBarProps {
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
  viewMode?: ViewMode;
  activeDate?: Date;
}

const TIMER_STORAGE_KEY = 'timerbar_state_v1';

function loadTimerState(): TimerState | null {
  try {
    const raw = localStorage.getItem(TIMER_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TimerState;
  } catch {
    return null;
  }
}

function saveTimerState(state: TimerState) {
  try {
    localStorage.setItem(TIMER_STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

function clearTimerState() {
  localStorage.removeItem(TIMER_STORAGE_KEY);
}

export default function TimerBar({
  activeTaskId,
  setActiveTaskId,
  viewMode,
  activeDate,
}: TimerBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [localTimeSpent, setLocalTimeSpent] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const [achievementInput, setAchievementInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isGoalPickerOpen, setIsGoalPickerOpen] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Gist sync — quick-access push/pull buttons in the search bar
  const {
    isConfigured: isSyncConfigured,
    pushToCloud,
    pullFromCloud,
    status: syncStatus,
    statusMsg: syncStatusMsg,
    isDirty: isSyncDirty,
  } = useGistSync();
  const [isPushConfirming, setIsPushConfirming] = useState(false);
  const [isPullConfirming, setIsPullConfirming] = useState(false);

  const handleQuickPush = async () => {
    setIsPullConfirming(false);
    if (!isPushConfirming) {
      setIsPushConfirming(true);
      setTimeout(() => setIsPushConfirming(false), 3500);
      return;
    }
    setIsPushConfirming(false);
    await pushToCloud();
  };

  const handleQuickPull = async () => {
    setIsPushConfirming(false);
    if (!isPullConfirming) {
      setIsPullConfirming(true);
      setTimeout(() => setIsPullConfirming(false), 3500);
      return;
    }
    setIsPullConfirming(false);
    await pullFromCloud();
  };

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const elapsedBeforeRef = useRef<number>(0);
  // Tracks working milliseconds accumulated ONLY during the current active session
  const sessionWorkedMsRef = useRef<number>(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const restoredTaskIdRef = useRef<string | null>(null);
  // RESTORE from localStorage — fires once on mount
  useEffect(() => {
    const saved = loadTimerState();
    if (!saved?.taskId) return;

    const wallElapsed =
      saved.startTime !== null
        ? saved.elapsedAtStart + (Date.now() - saved.startTime)
        : saved.elapsedAtStart;

    // Mark this taskId as "restored" so the sync effect skips it
    restoredTaskIdRef.current = saved.taskId;

    elapsedBeforeRef.current = wallElapsed;
    setLocalTimeSpent(wallElapsed);
    sessionStartRef.current = Date.now();
    sessionWorkedMsRef.current = 0;
    setIsRunning(true);
    setActiveTaskId(saved.taskId);
  }, []); // intentionally empty — one-time mount only

  // Helper: accumulate time_spent to the linked objective (and its parent goal)
  const accumulateLinkedObjective = async (taskId: string, timeToAdd: number) => {
    if (timeToAdd <= 0) return;
    const task = tasks.find((t) => t.id === taskId) as Task | undefined;
    if (!task?.objective_id) return;
    const objective = (await db.entries.get(task.objective_id)) as Objective | undefined;
    if (!objective) return;
    const newObjectiveTime = (objective.time_spent || 0) + timeToAdd;
    await db.entries.update(task.objective_id, {
      time_spent: newObjectiveTime,
    } as any);

    // Also roll up to the parent goal
    if (objective.goal_id) {
      const goal = (await db.entries.get(objective.goal_id)) as any;
      if (goal) {
        const newGoalTime = (goal.time_spent || 0) + timeToAdd;
        await db.entries.update(objective.goal_id, {
          time_spent: newGoalTime,
        } as any);
      }
    }
  };

  const handleLogAchievement = async () => {
    if (!achievementInput.trim() || !activeTaskId) return;
    const task = tasks.find((t) => t.id === activeTaskId) as Task | undefined;
    if (!task) return;
    const entry: TaskAchievement = {
      id: crypto.randomUUID(),
      text: achievementInput.trim(),
      created_at: new Date(),
    };
    const updated = [...(task.achievements ?? []), entry];
    await db.entries.update(activeTaskId, { achievements: updated } as any);
    setAchievementInput('');
  };

  // Fetch active task directly by ID (fast indexed lookup)
  const activeTask = useLiveQuery(
    () => (activeTaskId ? (db.entries.get(activeTaskId) as Promise<Task | undefined>) : undefined),
    [activeTaskId],
  );

  // Fetch only incomplete tasks for the search dropdown
  const todoTasks =
    (useLiveQuery(() =>
      db.entries
        .where('type')
        .equals('task')
        .filter(
          (t) =>
            t.status !== 'done' &&
            t.status !== 'dropped' &&
            t.status !== 'maybe',
        )
        .toArray() as Promise<Task[]>,
    ) || []) as Task[];

  // Fetch linked objective (if any) directly by ID
  const linkedObjective = useLiveQuery(
    () =>
      activeTask?.objective_id
        ? (db.entries.get(activeTask.objective_id) as Promise<Objective | undefined>)
        : undefined,
    [activeTask?.objective_id],
  );

  // Fetch linked goal (if any) directly by ID
  const linkedGoal = useLiveQuery(
    () =>
      linkedObjective?.goal_id
        ? (db.entries.get(linkedObjective.goal_id) as Promise<Goal | undefined>)
        : undefined,
    [linkedObjective?.goal_id],
  );

  // Track clicks outside dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setSelectedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Synchronize with active task changes
  useEffect(() => {
    // Case 1: this task was restored from localStorage — skip DB-sync entirely
    if (activeTaskId && activeTaskId === restoredTaskIdRef.current) {
      restoredTaskIdRef.current = null;
      return;
    }

    // Case 2: no active task — reset everything
    if (!activeTaskId) {
      if (restoredTaskIdRef.current) return; // restore in flight, don't touch refs
      setIsRunning(false);
      setLocalTimeSpent(0);
      sessionStartRef.current = null;
      elapsedBeforeRef.current = 0;
      sessionWorkedMsRef.current = 0;
      return;
    }

    // Case 3: new task selected by user — but only proceed once Dexie has it
    if (!activeTask) return;

    elapsedBeforeRef.current = activeTask.time_spent;
    setLocalTimeSpent(activeTask.time_spent);
    sessionWorkedMsRef.current = 0;
    setIsRunning(true);
    sessionStartRef.current = Date.now();

    saveTimerState({
      taskId: activeTask.id,
      isRunning: true,
      startTime: Date.now(),
      elapsedAtStart: activeTask.time_spent,
    });
  }, [activeTaskId]);

  // Timer interval engine
  useEffect(() => {
    if (isRunning && activeTaskId) {
      timerRef.current = setInterval(() => {
        if (sessionStartRef.current !== null) {
          const delta = Date.now() - sessionStartRef.current;
          setLocalTimeSpent(elapsedBeforeRef.current + delta);
          saveTimerState({
            taskId: activeTaskId,
            isRunning: true,
            startTime: sessionStartRef.current,
            elapsedAtStart: elapsedBeforeRef.current,
          });
        }
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning, activeTaskId]);

  // Pause the running timer session, shifting the elapsed delta to base
  const handlePause = async () => {
    if (!activeTaskId || !isRunning) return;

    if (sessionStartRef.current !== null) {
      const delta = Date.now() - sessionStartRef.current;
      const updatedTime = elapsedBeforeRef.current + delta;

      elapsedBeforeRef.current = updatedTime;
      sessionWorkedMsRef.current += delta;
      setLocalTimeSpent(updatedTime);

      // Update IndexedDB to avoid loss
      await db.entries.update(activeTaskId, { time_spent: updatedTime } as any);
      // Also accumulate to linked objective
      await accumulateLinkedObjective(activeTaskId, delta);
    }

    setIsRunning(false);
    sessionStartRef.current = null;
    saveTimerState({
      taskId: activeTaskId,
      isRunning: false,
      startTime: null,
      elapsedAtStart: elapsedBeforeRef.current,
    });
  };

  // Resume the timer on active task
  const handlePlay = () => {
    if (!activeTaskId || isRunning) return;
    setIsRunning(true);
    sessionStartRef.current = Date.now();

    saveTimerState({
      taskId: activeTaskId,
      isRunning: true,
      startTime: Date.now(),
      elapsedAtStart: elapsedBeforeRef.current,
    });
  };

  // Helper: auto-create a timeline log entry for this session
  // Rule 1: Never create log entry for dated tasks (they already exist on the Day timeline)
  // Rule 2: Only create for dateless tasks when working session >= 5 minutes (300,000 ms)
  const logWorkingSession = async (task: Task, sessionDurationMs: number) => {
    if (task.scheduled_at) return;
    const FIVE_MINUTES_MS = 5 * 60 * 1000;
    if (sessionDurationMs < FIVE_MINUTES_MS) return;

    const end = new Date();
    const start = new Date(end.getTime() - sessionDurationMs);

    await db.entries.add({
      id: crypto.randomUUID(),
      type: 'log',
      title: task.title,
      timestamp: start,
      end_timestamp: end,
      category_ids: task.category_ids,
      created_at: new Date(),
    } as any);
  };

  // Stop working session, save progress, log session if applicable, and deactivate
  const handleStop = async () => {
    if (!activeTaskId) return;

    const now = Date.now();
    let finalTimeSpent = elapsedBeforeRef.current;
    let addedSessionSlice = 0;

    if (isRunning && sessionStartRef.current !== null) {
      addedSessionSlice = now - sessionStartRef.current;
      finalTimeSpent = elapsedBeforeRef.current + addedSessionSlice;
    }

    const totalSessionDuration = sessionWorkedMsRef.current + addedSessionSlice;

    await db.entries.update(activeTaskId, {
      time_spent: finalTimeSpent,
    } as any);

    if (activeTask) {
      await logWorkingSession(activeTask, totalSessionDuration);
    }

    if (addedSessionSlice > 0) {
      await accumulateLinkedObjective(activeTaskId, addedSessionSlice);
    }

    sessionWorkedMsRef.current = 0;
    sessionStartRef.current = null;
    setActiveTaskId(null);
    clearTimerState();
  };

  // Finish session: saves session, completes task (status: 'done', completed_at), and deactivates
  const handleFinish = async () => {
    if (!activeTaskId) return;

    const now = Date.now();
    let finalTimeSpent = elapsedBeforeRef.current;
    let addedSessionSlice = 0;

    if (isRunning && sessionStartRef.current !== null) {
      addedSessionSlice = now - sessionStartRef.current;
      finalTimeSpent = elapsedBeforeRef.current + addedSessionSlice;
    }

    const totalSessionDuration = sessionWorkedMsRef.current + addedSessionSlice;

    await db.entries.update(activeTaskId, {
      time_spent: finalTimeSpent,
      status: 'done',
      completed_at: new Date(),
    } as any);

    if (activeTask) {
      await logWorkingSession(activeTask, totalSessionDuration);
    }

    if (addedSessionSlice > 0) {
      await accumulateLinkedObjective(activeTaskId, addedSessionSlice);
    }

    sessionWorkedMsRef.current = 0;
    sessionStartRef.current = null;
    setActiveTaskId(null);
    clearTimerState();
  };

  const [isDeletingActiveTask, setIsDeletingActiveTask] = useState(false);

  // Delete working task entirely
  const handleDelete = async () => {
    if (!activeTaskId) return;
    if (isDeletingActiveTask) {
      await db.entries.delete(activeTaskId);
      setActiveTaskId(null);
      setIsDeletingActiveTask(false);
    } else {
      setIsDeletingActiveTask(true);
      // Auto-reset after 3 seconds if not confirmed
      setTimeout(() => {
        setIsDeletingActiveTask(false);
      }, 3000);
    }

    clearTimerState();
  };

  // Reset timer for the active task
  const handleResetTime = async () => {
    if (!activeTaskId) return;
    setLocalTimeSpent(0);
    elapsedBeforeRef.current = 0;
    sessionWorkedMsRef.current = 0;
    sessionStartRef.current = Date.now();
    await db.entries.update(activeTaskId, {
      time_spent: 0,
    } as any);

    saveTimerState({
      taskId: activeTaskId,
      isRunning: true,
      startTime: Date.now(),
      elapsedAtStart: 0,
    });
  };

  // Select task and set active
  const handleSelectTask = (taskId: string) => {
    setActiveTaskId(taskId);
    setIsDropdownOpen(false);
    setSelectedIndex(-1);
    setSearchQuery('');
  };

  // Link/unlink a goal on the current linked objective
  const handleGoalSelect = async (goalId: string | undefined) => {
    if (!activeTask?.objective_id) return;
    await db.entries.update(activeTask.objective_id, {
      goal_id: goalId,
    } as any);
    setIsGoalPickerOpen(false);
  };

  // Create a new task directly from search input with view-awareness
  const handleCreateNewTask = async () => {
    if (!searchQuery.trim()) return;
    const newId = crypto.randomUUID();

    // View-aware scheduling:
    // If in Day view, attach scheduled_at to activeDate (or today).
    // If in Lists (or other views), leave scheduled_at undefined so it appears in Lists view.
    const scheduledDate = viewMode === 'day' && activeDate ? activeDate : undefined;

    const newTask: Task = {
      id: newId,
      type: 'task',
      title: searchQuery.trim(),
      status: 'todo',
      time_spent: 0,
      ...(scheduledDate ? { scheduled_at: scheduledDate } : {}),
      created_at: new Date(),
    };

    await db.entries.add(newTask);
    handleSelectTask(newId);
  };

  // Filter tasks based on query
  const filteredTasks = todoTasks.filter((task) =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const hasCreateOption = searchQuery.trim() !== '';
  const totalOptionsCount = filteredTasks.length + (hasCreateOption ? 1 : 0);

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isDropdownOpen && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setIsDropdownOpen(true);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1 < totalOptionsCount ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 >= 0 ? prev - 1 : totalOptionsCount - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < filteredTasks.length) {
        handleSelectTask(filteredTasks[selectedIndex].id);
      } else if (hasCreateOption) {
        handleCreateNewTask();
      }
    } else if (e.key === 'Escape') {
      setIsDropdownOpen(false);
      setSelectedIndex(-1);
    }
  };

  return (
    <div
      className="w-full relative px-4 md:px-6 py-2 bg-[#111111] border-b border-stone-850"
      id="timer-bar-container"
    >
      <div className="md:max-w-9xl max-md:max-w-4xl mx-auto relative" ref={dropdownRef}>
        <AnimatePresence mode="wait">
          {!activeTaskId ? (
            /* IDLE SEARCH STATE */
            <motion.div
              key="search-mode"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.18 }}
              className="w-full relative"
            >
              <div className="w-full flex items-center gap-2">
                <div className="relative flex-1 max-w-3xl">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    id="task-search-input"
                    type="text"
                    placeholder={
                      isMobile ? 'Search or create a task...' : 'Search or quick-create a working task...'
                    }
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      setSelectedIndex(-1);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onKeyDown={handleSearchKeyDown}
                    className="w-full h-10 pl-10 pr-4 py-2 bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/50 border border-stone-800 rounded-xl text-xs placeholder-stone-600 focus:outline-none focus:border-amber-500/40 focus:bg-stone-950 transition-all shadow-inner font-mono"
                  />
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-[#181818] border border-stone-800 rounded-xl shadow-2xl z-55">
                      {filteredTasks.length > 0 ? (
                        filteredTasks.map((task, index) => {
                          const isSelected = selectedIndex === index;
                          return (
                            <button
                              key={task.id}
                              id={`task-select-btn-${task.id}`}
                              onClick={() => handleSelectTask(task.id)}
                              className={`w-full text-left px-4 py-2.5 text-xs border-b border-stone-850/60 flex justify-between items-center transition-colors cursor-pointer ${
                                isSelected
                                  ? 'bg-stone-850 text-amber-400'
                                  : 'text-stone-300 hover:bg-stone-900/50 hover:text-amber-500'
                              }`}
                            >
                              <span className="truncate font-medium">{task.title}</span>
                              <span className="text-[10px] font-mono text-stone-500 bg-stone-950/40 px-2 py-0.5 rounded border border-stone-900/60 shrink-0">
                                {formatDuration(task.time_spent)}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-4 py-4 text-stone-500 text-xs italic text-center">
                          No matching tasks found
                        </div>
                      )}

                      {hasCreateOption && (
                        <button
                          id="create-task-btn"
                          onClick={handleCreateNewTask}
                          className={`w-full text-left px-4 py-2.5 border-t border-stone-850 flex items-center gap-2 font-mono font-bold uppercase tracking-wider text-[10px] cursor-pointer ${
                            selectedIndex === filteredTasks.length
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-stone-900/60 hover:bg-stone-900 text-amber-500'
                          }`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create and Start: "{searchQuery.trim()}"
                          {viewMode === 'day' && (
                            <span className="ml-auto text-[9px] text-stone-500 lowercase font-normal">
                              (Day view)
                            </span>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Quick-access sync buttons — only shown when Gist credentials are configured */}
                {isSyncConfigured && (
                  <div className="flex items-center gap-1 shrink-0">
                    {/* Push button — with inline confirmation */}
                    {isPushConfirming ? (
                      <button
                        id="quick-push-confirm-btn"
                        type="button"
                        onClick={handleQuickPush}
                        title="Confirm: upload and backup local data to cloud"
                        className="px-2.5 h-10 flex items-center text-[10px] font-mono font-bold text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 bg-emerald-500/10 rounded-xl animate-pulse transition-all cursor-pointer shrink-0 select-none"
                      >
                        Sure?
                      </button>
                    ) : (
                      <button
                        id="quick-push-btn"
                        type="button"
                        onClick={handleQuickPush}
                        disabled={syncStatus === 'loading'}
                        title={
                          isSyncDirty
                            ? 'You have unpushed changes — click to back up'
                            : 'Push to Cloud (backup local data)'
                        }
                        className={
                          `px-2.5 bg-transparent active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all h-10 flex items-center justify-center cursor-pointer shrink-0 select-none ` +
                          (syncStatus === 'idle' && isSyncDirty
                            ? 'text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)] hover:text-amber-300'
                            : 'text-stone-400 hover:text-amber-400')
                        }
                      >
                        {syncStatus === 'loading' ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : syncStatus === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : syncStatus === 'error' ? (
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                        ) : (
                          <UploadCloud className="w-4 h-4 shrink-0" />
                        )}
                      </button>
                    )}

                    {/* Pull button — with inline "Sure?" confirmation */}
                    {isPullConfirming ? (
                      <button
                        id="quick-pull-confirm-btn"
                        type="button"
                        onClick={handleQuickPull}
                        title="Confirm: overwrite local data from cloud"
                        className="px-2.5 h-10 flex items-center text-[10px] font-mono font-bold text-amber-400 hover:text-amber-300 border border-amber-500/30 bg-amber-500/10 rounded-xl animate-pulse transition-all cursor-pointer shrink-0 select-none"
                      >
                        Sure?
                      </button>
                    ) : (
                      <button
                        id="quick-pull-btn"
                        type="button"
                        onClick={handleQuickPull}
                        disabled={syncStatus === 'loading'}
                        title="Pull from Cloud (restore to this device)"
                        className="px-2.5 bg-transparent text-stone-400 hover:text-sky-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all h-10 flex items-center justify-center cursor-pointer shrink-0 select-none"
                      >
                        <DownloadCloud className="w-4 h-4 shrink-0" />
                      </button>
                    )}
                  </div>
                )}

                <div className="ml-auto">
                  <Settings />
                </div>
              </div>
            </motion.div>
          ) : (
            /* ACTIVE TIMER COCKPIT */
            <motion.div
              key="timer-mode"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
              className="w-full"
            >
              {isMobile ? (
                /* MOBILE 2-ROW COMPACT HUD */
                <div className="w-full flex flex-col gap-2 py-0.5">
                  {/* Row 1: Status Dot, Title, Objective Pill, & Live Clock */}
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isRunning ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]' : 'bg-stone-600'
                        }`}
                      />
                      <h3
                        className="text-stone-100 text-xs font-serif font-bold truncate"
                        id="active-task-title"
                        title={activeTask?.title}
                      >
                        {activeTask?.title || 'Unknown Task'}
                      </h3>

                      {linkedObjective && (
                        <button
                          onClick={() => setIsPickerOpen(true)}
                          className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[9px] font-mono text-rose-400 font-semibold truncate max-w-[90px]"
                        >
                          <Target className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{linkedObjective.title}</span>
                        </button>
                      )}
                    </div>

                    {/* Live Clock */}
                    <div
                      className="font-mono text-sm font-semibold text-stone-100 tracking-tight tabular-nums select-none shrink-0 bg-stone-900/80 border border-stone-800 px-2 py-0.5 rounded-lg"
                      id="live-timer-clock"
                    >
                      {(() => {
                        const s = formatDuration(localTimeSpent);
                        const p = s.split(':');
                        if (p.length === 3)
                          return (
                            <>
                              <span>{p[0]}</span>
                              <span className="text-stone-600 px-0.5">:</span>
                              <span>{p[1]}</span>
                              <span className="text-stone-600 px-0.5">:</span>
                              <span className="text-amber-400 font-bold">{p[2]}</span>
                            </>
                          );
                        return s;
                      })()}
                    </div>
                  </div>

                  {/* Row 2: Inline Mini-Achievement Input + Compact Action Button Pod */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={achievementInput}
                        onChange={(e) => setAchievementInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleLogAchievement();
                        }}
                        placeholder="Log note/milestone..."
                        className="w-full bg-[#0a0a0a] border border-stone-850 rounded-lg pl-2.5 pr-7 py-1 text-[11px] text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/30 transition-colors font-mono h-8"
                      />
                      {achievementInput.trim() && (
                        <button
                          onClick={handleLogAchievement}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {/* Compact Mobile Control Pod */}
                    <div className="flex items-center gap-1 bg-stone-900/80 p-0.5 rounded-lg border border-stone-800 shrink-0">
                      {isRunning ? (
                        <button
                          onClick={handlePause}
                          className="w-7 h-7 bg-stone-850 hover:bg-stone-800 text-stone-300 rounded-md transition-colors cursor-pointer flex items-center justify-center"
                          title="Pause"
                        >
                          <Pause className="w-3 h-3 fill-stone-300" />
                        </button>
                      ) : (
                        <button
                          onClick={handlePlay}
                          className="w-7 h-7 bg-amber-500/20 text-amber-400 rounded-md transition-colors cursor-pointer flex items-center justify-center"
                          title="Play"
                        >
                          <Play className="w-3 h-3 fill-amber-400" />
                        </button>
                      )}

                      <button
                        onClick={handleStop}
                        className="w-7 h-7 hover:bg-stone-800 text-stone-400 rounded-md transition-colors cursor-pointer flex items-center justify-center"
                        title="Stop"
                      >
                        <Square className="w-2.5 h-2.5 fill-red-400 text-red-400" />
                      </button>

                      <button
                        onClick={handleFinish}
                        className="w-7 h-7 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-md transition-colors cursor-pointer flex items-center justify-center"
                        title="Complete Task"
                      >
                        <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                      </button>

                      <button
                        onClick={handleResetTime}
                        className="w-7 h-7 hover:bg-stone-800 text-stone-500 hover:text-stone-300 rounded-md transition-colors cursor-pointer flex items-center justify-center"
                        title="Reset time"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>

                      {isDeletingActiveTask ? (
                        <button
                          onClick={handleDelete}
                          className="px-2 text-[9px] bg-red-950/90 border border-red-800 rounded-md text-red-400 font-mono font-bold hover:bg-red-900 cursor-pointer h-7"
                        >
                          Del?
                        </button>
                      ) : (
                        <button
                          onClick={handleDelete}
                          className="w-7 h-7 hover:bg-red-950/40 text-stone-600 hover:text-red-400 rounded-md transition-colors cursor-pointer flex items-center justify-center"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                /* DESKTOP SINGLE INTEGRATED COMMAND ROW */
                <div className="w-full flex items-center justify-between gap-4 h-10">
                  {/* Left: Pulse Dot, Task Title, Digital Clock, & Objective/Goal Pills */}
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                        isRunning ? 'bg-amber-500 animate-pulse shadow-[0_0_10px_#f59e0b]' : 'bg-stone-700'
                      }`}
                    />

                    {/* Task Title */}
                    <h3
                      className="text-stone-100 text-sm font-serif font-bold tracking-tight truncate max-w-xs xl:max-w-md select-all"
                      id="active-task-title"
                      title={activeTask?.title}
                    >
                      {activeTask?.title || 'Unknown Task'}
                    </h3>

                    {/* Integrated Digital Timer Clock */}
                    <div
                      className="font-mono text-xs font-semibold text-stone-100 tabular-nums select-none shrink-0 bg-[#0a0a0a] border border-stone-800 px-2.5 py-1 rounded-lg flex items-center gap-0.5 shadow-inner"
                      id="live-timer-clock"
                    >
                      {(() => {
                        const s = formatDuration(localTimeSpent);
                        const p = s.split(':');
                        if (p.length === 3)
                          return (
                            <>
                              <span className="text-stone-300">{p[0]}</span>
                              <span className="text-stone-600 px-0.5">:</span>
                              <span className="text-stone-300">{p[1]}</span>
                              <span className="text-stone-600 px-0.5">:</span>
                              <span className="text-amber-400 font-bold">{p[2]}</span>
                            </>
                          );
                        return s;
                      })()}
                    </div>

                    {/* Objective / Goal Pills */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {linkedObjective ? (
                        <>
                          <button
                            onClick={() => setIsPickerOpen(true)}
                            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-mono text-rose-400 hover:bg-rose-500/20 transition-all cursor-pointer font-semibold"
                            title="Change Objective"
                          >
                            <Target className="w-3 h-3 text-rose-400" />
                            <span className="max-w-[120px] truncate">{linkedObjective.title}</span>
                          </button>
                          {linkedGoal ? (
                            <button
                              onClick={() => setIsGoalPickerOpen(true)}
                              className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-sky-500/10 border border-sky-500/20 text-[10px] font-mono text-sky-400 hover:bg-sky-500/20 transition-all cursor-pointer font-semibold"
                              title="Change Goal"
                            >
                              <Flag className="w-3 h-3 text-sky-400" />
                              <span className="max-w-[120px] truncate">{linkedGoal.title}</span>
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <button
                          onClick={() => setIsPickerOpen(true)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-stone-900 border border-stone-800 text-[10px] font-mono text-stone-500 hover:text-rose-400 hover:border-rose-900/60 transition-all cursor-pointer"
                          title="Link Objective"
                        >
                          <Target className="w-2.5 h-2.5" /> Link
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Middle: Compact Inline Achievement Input */}
                  <div className="flex items-center gap-2 max-w-sm w-full">
                    <div className="relative w-full">
                      <input
                        type="text"
                        value={achievementInput}
                        onChange={(e) => setAchievementInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleLogAchievement();
                        }}
                        onFocus={() => setIsInputFocused(true)}
                        onBlur={() => setIsInputFocused(false)}
                        placeholder="Log achievement or milestone..."
                        className="w-full bg-[#0a0a0a] border border-stone-850 rounded-xl pl-3 pr-8 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/35 focus:bg-stone-950 transition-all font-mono h-9 shadow-inner"
                      />
                      {achievementInput.trim() && (
                        <button
                          onClick={handleLogAchievement}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-amber-400 hover:text-amber-300 font-mono text-[10px] font-bold uppercase transition-colors cursor-pointer"
                        >
                          Log
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right: Unified Segmented Action Controls */}
                  <div className="flex items-center gap-1 bg-stone-900/60 p-1 rounded-xl border border-stone-850 shrink-0 shadow-sm">
                    {isRunning ? (
                      <button
                        onClick={handlePause}
                        className="p-1.5 bg-stone-850 hover:bg-stone-800 border border-stone-750 rounded-lg text-stone-200 transition-all cursor-pointer flex items-center justify-center w-8 h-8 shadow-sm"
                        title="Pause Timer"
                      >
                        <Pause className="w-3.5 h-3.5 fill-stone-200" />
                      </button>
                    ) : (
                      <button
                        onClick={handlePlay}
                        className="p-1.5 bg-amber-500/15 border border-amber-500/30 hover:bg-amber-500/25 rounded-lg text-amber-400 transition-all cursor-pointer flex items-center justify-center w-8 h-8 shadow-sm"
                        title="Resume Timer"
                      >
                        <Play className="w-3.5 h-3.5 fill-amber-400" />
                      </button>
                    )}

                    <button
                      onClick={handleStop}
                      className="p-1.5 bg-stone-900 hover:bg-stone-850 border border-stone-800 rounded-lg text-stone-400 hover:text-red-400 transition-all cursor-pointer w-8 h-8 flex items-center justify-center"
                      title="Stop Timer & Save Duration"
                    >
                      <Square className="w-3 h-3 fill-red-500 text-red-500" />
                    </button>

                    <button
                      onClick={handleFinish}
                      className="px-2.5 bg-amber-500 hover:bg-amber-400 active:scale-95 text-stone-950 font-mono font-bold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer h-8 flex items-center gap-1 shadow-sm"
                      title="Mark Task as Done"
                    >
                      <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                      <span>Done</span>
                    </button>

                    <div className="w-px h-5 bg-stone-800 mx-0.5" />

                    <button
                      onClick={handleResetTime}
                      className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-500 hover:text-stone-300 transition-all cursor-pointer w-8 h-8 flex items-center justify-center"
                      title="Reset elapsed time"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    {isDeletingActiveTask ? (
                      <button
                        onClick={handleDelete}
                        className="px-2 text-[10px] bg-red-950 border border-red-800 rounded-lg text-red-400 font-mono font-bold hover:bg-red-900 cursor-pointer h-8 flex items-center justify-center animate-pulse"
                      >
                        Sure?
                      </button>
                    ) : (
                      <button
                        onClick={handleDelete}
                        className="p-1.5 hover:bg-red-950/30 text-stone-600 hover:text-red-400 rounded-lg transition-all cursor-pointer w-8 h-8 flex items-center justify-center"
                        title="Delete active task"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* OBJECTIVE PICKER SHEET */}
      <ObjectivePickerSheet
        open={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        activeTaskId={activeTaskId}
        currentObjectiveId={activeTask?.objective_id}
        isMobile={isMobile}
      />

      {/* GOAL PICKER SHEET */}
      <GoalPickerSheet
        open={isGoalPickerOpen}
        onClose={() => setIsGoalPickerOpen(false)}
        currentGoalId={linkedObjective?.goal_id}
        onSelect={handleGoalSelect}
        isMobile={isMobile}
      />
    </div>
  );
}
