/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Task, Objective, Goal, TimerState, TaskAchievement } from '../types';
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
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Settings from './Settings';
import ObjectivePickerSheet from './ObjectivePickerSheet';
import GoalPickerSheet from './GoalPickerSheet';

interface TimerBarProps {
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
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

export default function TimerBar({ activeTaskId, setActiveTaskId }: TimerBarProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [localTimeSpent, setLocalTimeSpent] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  const [achievementInput, setAchievementInput] = useState('');

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isGoalPickerOpen, setIsGoalPickerOpen] = useState(false);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number | null>(null);
  const elapsedBeforeRef = useRef<number>(0);
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

  // Fetch active task and all incomplete tasks
  const tasks = useLiveQuery(() => db.entries.where('type').equals('task').toArray()) || [];
  const todoTasks = tasks.filter((t) => t.type === 'task' && t.status === 'todo') as Task[];
  const activeTask = tasks.find((t) => t.id === activeTaskId) as Task | undefined;

  // Fetch objectives separately for linked-objective display
  const allObjectives =
    useLiveQuery(() => db.entries.where('type').equals('objective').toArray()) || [];
  const typedObjectives = allObjectives as Objective[];

  // Fetch goals for linked-goal display
  const allGoals = useLiveQuery(() => db.entries.where('type').equals('goal').toArray()) || [];
  const typedGoals = allGoals as Goal[];

  // Find the linked objective (if any) for the active task
  const linkedObjective = activeTask?.objective_id
    ? typedObjectives.find((o) => o.id === activeTask.objective_id)
    : undefined;

  // Find the linked goal (if any) for the linked objective
  const linkedGoal = linkedObjective?.goal_id
    ? typedGoals.find((g) => g.id === linkedObjective.goal_id)
    : undefined;

  // Track clicks outside dropdown to close it
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
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
      return;
    }

    // Case 3: new task selected by user — but only proceed once Dexie has it
    // If activeTask is still undefined, Dexie hasn't resolved yet — do nothing,
    // the effect will NOT re-fire (activeTaskId didn't change), so we wait.
    if (!activeTask) return;

    elapsedBeforeRef.current = activeTask.time_spent;
    setLocalTimeSpent(activeTask.time_spent);
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

  // Stop timer, save progress, and deactivate the working state
  const handleStop = async () => {
    if (!activeTaskId) return;

    let finalTimeSpent = localTimeSpent;
    if (isRunning && sessionStartRef.current !== null) {
      const delta = Date.now() - sessionStartRef.current;
      finalTimeSpent = elapsedBeforeRef.current + delta;
    }

    await db.entries.update(activeTaskId, {
      time_spent: finalTimeSpent,
    } as any);
    // Also accumulate to linked objective
    const stopDelta = finalTimeSpent - (elapsedBeforeRef.current || 0);
    await accumulateLinkedObjective(activeTaskId, stopDelta);
    setActiveTaskId(null);

    clearTimerState();
  };

  // Finish task: save time, complete task, and deactivate
  const handleFinish = async () => {
    if (!activeTaskId) return;

    let finalTimeSpent = localTimeSpent;
    if (isRunning && sessionStartRef.current !== null) {
      const delta = Date.now() - sessionStartRef.current;
      finalTimeSpent = elapsedBeforeRef.current + delta;
    }

    await db.entries.update(activeTaskId, {
      status: 'done',
      time_spent: finalTimeSpent,
      completed_at: new Date(),
    } as any);
    // Also accumulate to linked objective
    const finishDelta = finalTimeSpent - (elapsedBeforeRef.current || 0);
    await accumulateLinkedObjective(activeTaskId, finishDelta);

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

  // Create a new task directly from search input
  const handleCreateNewTask = async () => {
    if (!searchQuery.trim()) return;
    const newId = crypto.randomUUID();
    const newTask: Task = {
      id: newId,
      type: 'task',
      title: searchQuery.trim(),
      status: 'todo',
      time_spent: 0,
      created_at: new Date(),
    };
    await db.entries.add(newTask);
    handleSelectTask(newId);
  };

  // Filter tasks based on query
  const filteredTasks = todoTasks.filter((task) =>
    task.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div
      className="w-full relative px-4 md:px-6 py-2.5 md:py-3.5 bg-[#121212] border-b border-stone-800/60"
      id="timer-bar-container"
    >
      <div className="max-w-4xl mx-auto relative" ref={dropdownRef}>
        <AnimatePresence mode="wait">
          {!activeTaskId ? (
            /* IDLE SEARCH STATE */
            <motion.div
              key="search-mode"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="w-full relative"
            >
              <div className="w-full flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
                  <input
                    id="task-search-input"
                    type="text"
                    placeholder={
                      isMobile ? 'Find/create task...' : 'Search or quick-create a working task...'
                    }
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim() !== '') {
                        handleCreateNewTask();
                      }
                    }}
                    className="w-full h-[46px] pl-10 pr-4 py-3 bg-[#0a0a0a] text-stone-100 hover:bg-[#080808]/50 border border-stone-850 rounded-xl text-sm placeholder-stone-600 focus:outline-none focus:border-amber-500/35 focus:bg-stone-950 transition-all shadow-inner"
                  />
                  {isDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 max-h-60 overflow-y-auto bg-[#181818] border border-stone-800 rounded-xl shadow-2xl z-55">
                      {filteredTasks.length > 0 ? (
                        filteredTasks.map((task) => (
                          <button
                            key={task.id}
                            id={`task-select-btn-${task.id}`}
                            onClick={() => handleSelectTask(task.id)}
                            className="w-full text-left px-4 py-3 text-xs sm:text-sm border-b border-stone-850/60 hover:bg-stone-900/50 flex justify-between items-center text-stone-300 hover:text-amber-500 transition-colors"
                          >
                            <span className="truncate font-medium">{task.title}</span>
                            <span className="text-[10px] font-mono text-stone-550 bg-stone-950/40 px-2 py-0.5 rounded border border-stone-900/60 shrink-0">
                              {formatDuration(task.time_spent)}
                            </span>
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-4 text-stone-500 text-xs sm:text-sm italic text-center">
                          No matching tasks found
                        </div>
                      )}

                      {searchQuery.trim() !== '' && (
                        <button
                          id="create-task-btn"
                          onClick={handleCreateNewTask}
                          className="w-full text-left px-4 py-3 bg-stone-900/60 border-t border-stone-850 hover:bg-stone-900 flex items-center gap-2 text-amber-500 font-mono font-bold uppercase tracking-wider text-[10px]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          Create and Start: "{searchQuery.trim()}"
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <Settings />
              </div>
            </motion.div>
          ) : (
            /* ACTIVE RUNNING TIMER STATE */
            <motion.div
              key="timer-mode"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              {isMobile ? (
                /* MOBILE ACTIVE TIMER VIEW - Redesigned Premium 3-Row Layout */
                <div className="w-full space-y-1 p-1">
                  {/* Row 1: Title & Live Clock */}
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {/* <span
                        className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${isRunning ? "bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]" : "bg-stone-700"}`}
                      /> */}
                      <h3
                        className="text-stone-100 text-sm font-serif font-bold leading-snug break-words max-w-[200px]"
                        id="active-task-title"
                      >
                        {activeTask?.title || 'Unknown Task'}
                      </h3>
                    </div>

                    <div
                      className="font-mono text-xl font-light text-stone-100 tracking-tighter tabular-nums select-none shrink-0"
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
                              <span className="text-amber-500 font-semibold">{p[2]}</span>
                            </>
                          );
                        return s;
                      })()}
                    </div>
                  </div>

                  {/* Row 2: Objective & Goal Badges */}
                  <div className="flex items-center gap-2 flex-wrap justify-start">
                    {linkedObjective ? (
                      <>
                        <button
                          onClick={() => setIsPickerOpen(true)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[10px] font-mono text-rose-400 font-semibold hover:bg-rose-500/20 transition-colors cursor-pointer"
                        >
                          <Target className="w-3 h-3" />
                          <span className="max-w-[120px] truncate">{linkedObjective.title}</span>
                        </button>
                        {linkedGoal ? (
                          <button
                            onClick={() => setIsGoalPickerOpen(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-500/10 border border-sky-500/20 text-[10px] font-mono text-sky-400 font-semibold hover:bg-sky-500/20 transition-colors cursor-pointer"
                          >
                            <Flag className="w-3 h-3" />
                            <span className="max-w-[120px] truncate">{linkedGoal.title}</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setIsGoalPickerOpen(true)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-900 border border-stone-800 text-[10px] font-mono text-stone-500 hover:text-sky-400 transition-colors cursor-pointer"
                          >
                            <Flag className="w-3 h-3" /> Link Goal
                          </button>
                        )}
                      </>
                    ) : (
                      <button
                        onClick={() => setIsPickerOpen(true)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-900 border border-stone-800 text-[10px] font-mono text-stone-500 hover:text-rose-400 transition-colors cursor-pointer"
                      >
                        <Target className="w-3 h-3" /> Link Objective
                      </button>
                    )}
                  </div>

                  {/* Row 3: Action controls */}
                  <div className="flex items-center justify-between border-t border-stone-900 gap-2 mt-3">
                    <div className="flex items-center gap-2">
                      {isRunning ? (
                        <button
                          onClick={handlePause}
                          className="p-2 bg-stone-900 border border-stone-800 rounded-xl text-stone-300 hover:border-stone-700 transition-colors cursor-pointer flex items-center justify-center w-10 h-10"
                        >
                          <Pause className="w-3 h-3 fill-stone-300" />
                        </button>
                      ) : (
                        <button
                          onClick={handlePlay}
                          className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500/20 transition-colors cursor-pointer flex items-center justify-center w-10 h-10"
                        >
                          <Play className="w-3 h-3 fill-amber-500" />
                        </button>
                      )}
                      <button
                        onClick={handleStop}
                        className="p-2 bg-stone-900 border border-stone-800 rounded-xl text-stone-400 text-[10px] font-mono uppercase font-bold tracking-widest hover:text-stone-200 transition-colors cursor-pointer flex items-center justify-center w-10 h-10"
                      >
                        <Square className="w-3 h-3 fill-red-500 text-red-500" />
                      </button>
                      <button
                        onClick={handleFinish}
                        className="p-2 bg-amber-500 hover:bg-amber-400 text-stone-950 text-[10px] font-mono font-bold uppercase tracking-widest rounded-xl transition-colors cursor-pointer h-10 flex items-center flex items-center justify-center w-10 h-10"
                      >
                        <CheckIcon className="w-3 h-3" />
                      </button>
                      <button
                        onClick={handleResetTime}
                        className="p-2 border border-stone-800 rounded-xl text-stone-500 hover:text-stone-300 hover:border-stone-700 transition-colors cursor-pointer w-10 h-10 flex items-center justify-center"
                        title="Reset timer"
                      >
                        <RotateCcw className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="flex items-center">
                      {isDeletingActiveTask ? (
                        <button
                          onClick={handleDelete}
                          className="px-3 py-2 text-[10px] bg-red-950/80 border border-red-800/80 rounded-xl text-red-400 font-mono font-bold hover:bg-red-900 cursor-pointer h-10"
                        >
                          Sure?
                        </button>
                      ) : (
                        <button
                          onClick={handleDelete}
                          className="p-2.5 border border-transparent hover:border-red-950/60 hover:bg-red-950/25 text-stone-600 hover:text-red-400 rounded-xl transition-colors cursor-pointer w-10 h-10 flex items-center justify-center"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Row 4: Achievement quick-log */}
                  <div className="flex items-center gap-2 border-t border-stone-900 pt-2">
                    <input
                      type="text"
                      value={achievementInput}
                      onChange={(e) => setAchievementInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleLogAchievement();
                      }}
                      placeholder="Log an achievement..."
                      className="flex-1 bg-[#0a0a0a] border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/30 transition-colors font-mono"
                    />
                    <button
                      onClick={handleLogAchievement}
                      className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-all cursor-pointer shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                /* DESKTOP ACTIVE TIMER VIEW */
                <div className="w-full flex items-stretch gap-6">
                  {/* Left: Task info */}
                  <div className="flex-1 min-w-0 flex items-center gap-4">
                    <span
                      className={`w-3 h-3 rounded-full shrink-0 ${isRunning ? 'bg-amber-500 animate-pulse shadow-[0_0_8px_#f59e0b]' : 'bg-stone-700'}`}
                    />
                    <div className="min-w-0">
                      <h3
                        className="text-stone-100 text-base font-serif font-bold leading-snug select-all"
                        id="active-task-title"
                      >
                        {activeTask?.title || 'Unknown Task'}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px] font-mono text-stone-500 flex-wrap">
                        {linkedObjective ? (
                          <>
                            <button
                              onClick={() => setIsPickerOpen(true)}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-500/10 border border-rose-500/20 text-rose-400/80 hover:bg-rose-500/20 transition-colors cursor-pointer"
                            >
                              <Target className="w-3 h-3" />
                              <span className="max-w-[140px] truncate">
                                {linkedObjective.title}
                              </span>
                            </button>
                            {linkedGoal ? (
                              <button
                                onClick={() => setIsGoalPickerOpen(true)}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-500/10 border border-sky-500/20 text-sky-400/80 hover:bg-sky-500/20 transition-colors cursor-pointer"
                              >
                                <Flag className="w-3 h-3" />
                                <span className="max-w-[140px] truncate">{linkedGoal.title}</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => setIsGoalPickerOpen(true)}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-500 hover:text-sky-400 hover:border-sky-700/50 transition-colors cursor-pointer"
                              >
                                <Flag className="w-3 h-3" /> Link Goal
                              </button>
                            )}
                          </>
                        ) : (
                          <button
                            onClick={() => setIsPickerOpen(true)}
                            className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-500 hover:text-rose-400 hover:border-rose-700/50 transition-colors cursor-pointer"
                          >
                            <Target className="w-3 h-3" /> Link Objective
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Achievement quick-log */}
                  <div className="flex items-center gap-2 w-56 shrink-0">
                    <input
                      type="text"
                      value={achievementInput}
                      onChange={(e) => setAchievementInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleLogAchievement();
                      }}
                      placeholder="Log achievement..."
                      className="flex-1 bg-[#0a0a0a] border border-stone-800 rounded-lg px-3 py-2 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/30 transition-colors font-mono h-10"
                    />
                    <button
                      onClick={handleLogAchievement}
                      className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 rounded-lg transition-all cursor-pointer shrink-0 h-10 w-10 flex items-center justify-center"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Right: clock + controls */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div
                      className="font-mono text-2xl font-light text-stone-100 tracking-tighter tabular-nums select-none"
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
                              <span className="text-amber-500 font-normal">{p[2]}</span>
                            </>
                          );
                        return s;
                      })()}
                    </div>

                    <div className="flex items-center gap-2">
                      {isRunning ? (
                        <button
                          onClick={handlePause}
                          className="p-2.5 bg-stone-900 border border-stone-800 rounded-xl text-stone-300 hover:border-stone-700 transition-colors cursor-pointer flex items-center justify-center w-10 h-10"
                        >
                          <Pause className="w-4 h-4 fill-stone-300" />
                        </button>
                      ) : (
                        <button
                          onClick={handlePlay}
                          className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-500 hover:bg-amber-500/20 transition-colors cursor-pointer flex items-center justify-center w-10 h-10"
                        >
                          <Play className="w-4 h-4 fill-amber-500" />
                        </button>
                      )}
                      <button
                        onClick={handleStop}
                        className="px-4 py-2.5 bg-stone-900 border border-stone-800 rounded-xl text-stone-400 text-[10px] font-mono uppercase font-bold tracking-widest hover:text-stone-200 transition-colors cursor-pointer h-10"
                      >
                        Stop
                      </button>
                      <button
                        onClick={handleFinish}
                        className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-950 text-[10px] font-mono font-bold uppercase tracking-widest rounded-xl transition-colors cursor-pointer h-10 flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Finish
                      </button>
                      <button
                        onClick={handleResetTime}
                        className="p-2.5 border border-stone-800 rounded-xl text-stone-500 hover:text-stone-300 hover:border-stone-700 transition-colors cursor-pointer w-10 h-10 flex items-center justify-center"
                        title="Reset timer"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                      <div className="w-px h-6 bg-stone-800/60 shrink-0" />
                      {isDeletingActiveTask ? (
                        <button
                          onClick={handleDelete}
                          className="px-3 py-2 text-[10px] bg-red-950/80 border border-red-800/80 rounded-xl text-red-400 font-mono font-bold hover:bg-red-900 cursor-pointer h-10"
                        >
                          Sure?
                        </button>
                      ) : (
                        <button
                          onClick={handleDelete}
                          className="p-2.5 border border-transparent hover:border-red-950/60 hover:bg-red-950/25 text-stone-600 hover:text-red-400 rounded-xl transition-colors cursor-pointer w-10 h-10 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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
