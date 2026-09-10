/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  X,
  BookOpen,
  Layers,
  Compass,
  Zap,
  Sparkles,
  Calendar,
  Clock,
  Star,
  Tag,
  CheckCircle,
  FileText,
  Activity,
  Flame,
  ArrowRight,
  ListTodo,
  Smile,
  ShieldCheck,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type PhilosophyTab = 'philosophy' | 'types' | 'rules' | 'syntax';

interface PhilosophyModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  initialTab?: PhilosophyTab;
}

export default function PhilosophyModal({
  isOpen: externalIsOpen,
  onClose: externalOnClose,
  initialTab = 'philosophy',
}: PhilosophyModalProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;

  const [activeTab, setActiveTab] = useState<PhilosophyTab>(initialTab);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Update active tab if initialTab prop changes
  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  // Listen to custom event and '?' shortcut key
  useEffect(() => {
    const handleOpenEvent = (e: CustomEvent<{ tab?: PhilosophyTab }>) => {
      if (e.detail?.tab) {
        setActiveTab(e.detail.tab);
      }
      setInternalIsOpen(true);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '?' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes(
          (e.target as HTMLElement)?.tagName || '',
        ) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        setInternalIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    window.addEventListener(
      'flowday-open-philosophy' as any,
      handleOpenEvent,
    );
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener(
        'flowday-open-philosophy' as any,
        handleOpenEvent,
      );
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleClose = () => {
    if (externalOnClose) {
      externalOnClose();
    } else {
      setInternalIsOpen(false);
    }
  };

  const handleOpen = () => {
    setInternalIsOpen(true);
  };

  return (
    <>
      {externalIsOpen === undefined && (
        <button
          id="philosophy-guide-btn"
          type="button"
          onClick={handleOpen}
          className="p-2 bg-transparent text-stone-400 hover:text-amber-400 active:scale-95 transition-all h-9 w-9 rounded-xl hover:bg-stone-850 flex items-center justify-center cursor-pointer shrink-0 select-none"
          title="Guide & Product Philosophy (?)"
        >
          <HelpCircle className="w-4.5 h-4.5 shrink-0" />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <div
            className={`fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex font-sans ${
              isMobile
                ? 'items-end justify-center'
                : 'items-center justify-center p-4'
            }`}
            onClick={handleClose}
          >
            <motion.div
              initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
              animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1 }}
              exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className={`bg-stone-900 border border-stone-800 shadow-2xl relative flex flex-col overflow-hidden w-full ${
                isMobile
                  ? 'max-h-[88vh] rounded-t-3xl border-b-0 pb-6'
                  : 'max-w-2xl max-h-[85vh] rounded-2xl'
              }`}
              style={
                isMobile
                  ? {
                      paddingBottom:
                        'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))',
                    }
                  : undefined
              }
            >
              {/* Mobile Grab Handle */}
              {isMobile && (
                <div className="w-10 h-1 bg-stone-750 rounded-full self-center mt-3 shrink-0" />
              )}

              {/* Modal Header & Segmented Tabs */}
              <div className="flex flex-col border-b border-stone-800 shrink-0 bg-stone-900/90 backdrop-blur-sm pt-3 px-4 md:px-6">
                <div className="flex items-center justify-between pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold uppercase tracking-widest text-amber-500">
                      FlowDay
                    </span>
                    <span className="text-xs text-stone-500 font-mono">/</span>
                    <h2 className="text-stone-100 font-serif font-bold text-base flex items-center gap-1.5">
                      <span>Guide & Philosophy</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-normal">
                        ?
                      </span>
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={handleClose}
                    className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-xl transition-colors cursor-pointer"
                  >
                    <X className="w-4.5 h-4.5" />
                  </button>
                </div>

                {/* Tab Navigation Strip */}
                <div className="flex items-center gap-1 overflow-x-auto pb-2 scrollbar-none">
                  <button
                    type="button"
                    onClick={() => setActiveTab('philosophy')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'philosophy'
                        ? 'bg-stone-800 text-stone-100 shadow-xs border border-stone-700/60'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850/60 border border-transparent'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-500" />
                    <span>Philosophy</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('types')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'types'
                        ? 'bg-stone-800 text-stone-100 shadow-xs border border-stone-700/60'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850/60 border border-transparent'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Entry Types</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('rules')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'rules'
                        ? 'bg-stone-800 text-stone-100 shadow-xs border border-stone-700/60'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850/60 border border-transparent'
                    }`}
                  >
                    <Compass className="w-3.5 h-3.5 text-emerald-400" />
                    <span>4 Golden Rules</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('syntax')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
                      activeTab === 'syntax'
                        ? 'bg-stone-800 text-stone-100 shadow-xs border border-stone-700/60'
                        : 'text-stone-400 hover:text-stone-200 hover:bg-stone-850/60 border border-transparent'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-sky-400" />
                    <span>Syntax & Tips</span>
                  </button>
                </div>
              </div>

              {/* Modal Body / Scrollable Content */}
              <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 text-sm text-stone-300">
                {/* ── TAB 1: PHILOSOPHY ────────────────────────────────────── */}
                {activeTab === 'philosophy' && (
                  <div className="space-y-5 animate-in fade-in duration-200">
                    {/* Core Quote Banner */}
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30">
                      <p className="font-serif italic text-base md:text-lg text-amber-200 leading-relaxed mb-1">
                        &ldquo;Plan with light brushstrokes; record with honest precision.&rdquo;
                      </p>
                      <span className="text-[11px] font-mono text-amber-400/80 uppercase tracking-widest font-bold">
                        The Core Manifesto of FlowDay
                      </span>
                    </div>

                    {/* The Problem with Traditional Apps */}
                    <div className="space-y-2">
                      <h3 className="text-stone-100 font-serif font-bold text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-400" />
                        <span>The Trap of Micro-Management</span>
                      </h3>
                      <p className="text-xs text-stone-400 leading-relaxed">
                        Traditional productivity software pushes us into two extremes:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                        <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/80">
                          <span className="text-xs font-mono font-bold text-rose-400 block mb-1">
                            ❌ Hyper-Prescription
                          </span>
                          <p className="text-[11px] text-stone-400 leading-normal">
                            Specifying every 15-minute slice in rigid detail. The moment reality deviates, schedule guilt and overdue task fatigue collapse your momentum.
                          </p>
                        </div>
                        <div className="p-3 rounded-xl bg-stone-950/60 border border-stone-800/80">
                          <span className="text-xs font-mono font-bold text-stone-400 block mb-1">
                            💤 Passive Retro-Logging
                          </span>
                          <p className="text-[11px] text-stone-400 leading-normal">
                            Merely recording history after it unfolds. Without intentional containers, you lose the clarity and focus required for deep output.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Principle of Light Brushstrokes */}
                    <div className="space-y-3 pt-2">
                      <h3 className="text-stone-100 font-serif font-bold text-sm">
                        The Principle of &ldquo;Light Brushstrokes&rdquo;
                      </h3>
                      <p className="text-xs text-stone-300 leading-relaxed">
                        Flow Day bridges this divide through <strong>Directional Intent + Frictionless Reality Capture</strong>:
                      </p>
                      <ul className="space-y-2 text-xs text-stone-400">
                        <li className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold mt-0.5">•</span>
                          <span>
                            <strong className="text-stone-200">Time Blocks are intentional arenas</strong>, not rigid prisons. Titles like <code className="text-amber-300 bg-stone-800/80 px-1 py-0.5 rounded">Deep Work: Auth Module</code> establish cognitive boundaries without dictating every breath.
                          </span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-amber-400 font-bold mt-0.5">•</span>
                          <span>
                            <strong className="text-stone-200">Tasks are milestones of intent</strong>, not microscopic manuals. Keeping titles lightweight lowers activation friction and stops perfectionist dread before you start.
                          </span>
                        </li>
                      </ul>

                      {/* Code comparison box */}
                      <div className="p-3.5 rounded-xl bg-stone-950/90 border border-stone-800 font-mono text-[11px] space-y-2">
                        <div className="text-rose-400 flex items-center gap-2">
                          <span className="font-bold">❌ Over-Prescriptive:</span>
                          <span className="text-stone-400 truncate">&ldquo;Refactor lines 40-120 of auth.ts and write 4 test cases for expired JWTs&rdquo;</span>
                        </div>
                        <div className="text-emerald-400 flex items-center gap-2">
                          <span className="font-bold">✅ Focused Intent:</span>
                          <span className="text-stone-200">&ldquo;Auth token refresh logic&rdquo;</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 2: ENTRY TYPES ───────────────────────────────────── */}
                {activeTab === 'types' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <p className="text-xs text-stone-400 leading-relaxed">
                      Rather than forcing everything into a simple checklist, Flow Day separates your day into distinct cognitive layers:
                    </p>

                    <div className="space-y-2.5">
                      {/* Time Block */}
                      <div className="p-3.5 rounded-xl bg-stone-950/60 border border-amber-500/20 hover:border-amber-500/40 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-lg bg-amber-500/15 text-amber-400">
                              <Clock className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-mono font-bold text-xs text-amber-300 uppercase tracking-wider">
                              Time Block (Container)
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-stone-500">
                            Broad Scheduled Span
                          </span>
                        </div>
                        <p className="text-xs text-stone-300 mb-1">
                          Strategic arenas dedicated to deep focus sessions. Creates psychological space for uninterrupted work.
                        </p>
                        <div className="text-[11px] font-mono text-stone-400 bg-stone-900/80 px-2 py-1 rounded-md">
                          Example: <span className="text-amber-200">&ldquo;Deep Work (2:00 PM – 4:30 PM)&rdquo;</span>
                        </div>
                      </div>

                      {/* Task */}
                      <div className="p-3.5 rounded-xl bg-stone-950/60 border border-indigo-500/20 hover:border-indigo-500/40 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-lg bg-indigo-500/15 text-indigo-400">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-mono font-bold text-xs text-indigo-300 uppercase tracking-wider">
                              Task (Milestone)
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-stone-500">
                            Milestone of Intent
                          </span>
                        </div>
                        <p className="text-xs text-stone-300 mb-1">
                          Clear target you set out to accomplish. Can be scheduled to today or kept flexible in your backlog lists.
                        </p>
                        <div className="text-[11px] font-mono text-stone-400 bg-stone-900/80 px-2 py-1 rounded-md">
                          Example: <span className="text-indigo-200">&ldquo;Fix cache invalidation bug&rdquo;</span>
                        </div>
                      </div>

                      {/* Log */}
                      <div className="p-3.5 rounded-xl bg-stone-950/60 border border-emerald-500/20 hover:border-emerald-500/40 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-lg bg-emerald-500/15 text-emerald-400">
                              <Activity className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-mono font-bold text-xs text-emerald-300 uppercase tracking-wider">
                              Log (Factual Reality)
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-stone-500">
                            Timestamped Record
                          </span>
                        </div>
                        <p className="text-xs text-stone-300 mb-1">
                          Factual breadcrumb of what actually unfolded along the way (discoveries, micro-milestones, troubleshooting).
                        </p>
                        <div className="text-[11px] font-mono text-stone-400 bg-stone-900/80 px-2 py-1 rounded-md">
                          Example: <span className="text-emerald-200">&ldquo;Found memory leak in socket connection pool&rdquo;</span>
                        </div>
                      </div>

                      {/* Note */}
                      <div className="p-3.5 rounded-xl bg-stone-950/60 border border-sky-500/20 hover:border-sky-500/40 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-lg bg-sky-500/15 text-sky-400">
                              <FileText className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-mono font-bold text-xs text-sky-300 uppercase tracking-wider">
                              Note (Reflection & Idea)
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-stone-500">
                            Point-in-Time Synthesis
                          </span>
                        </div>
                        <p className="text-xs text-stone-300 mb-1">
                          Quick insights, sudden brainstorms, or retrospective summaries captured right in the flow of your day.
                        </p>
                        <div className="text-[11px] font-mono text-stone-400 bg-stone-900/80 px-2 py-1 rounded-md">
                          Example: <span className="text-sky-200">&ldquo;Idea: Use Redis hash sets for user sessions&rdquo;</span>
                        </div>
                      </div>

                      {/* Habit Log */}
                      <div className="p-3.5 rounded-xl bg-stone-950/60 border border-rose-500/20 hover:border-rose-500/40 transition-colors">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="p-1 rounded-lg bg-rose-500/15 text-rose-400">
                              <Flame className="w-3.5 h-3.5" />
                            </span>
                            <span className="font-mono font-bold text-xs text-rose-300 uppercase tracking-wider">
                              Habit Pulse (Consistency)
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-stone-500">
                            Daily Rituals
                          </span>
                        </div>
                        <p className="text-xs text-stone-300 mb-1">
                          Daily non-negotiable rituals and health commitments tracked effortlessly with visual streaks and heatmaps.
                        </p>
                        <div className="text-[11px] font-mono text-stone-400 bg-stone-900/80 px-2 py-1 rounded-md">
                          Example: <span className="text-rose-200">&ldquo;Zone 2 Cardio / Hydration completed&rdquo;</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 3: 4 GOLDEN RULES ────────────────────────────────── */}
                {activeTab === 'rules' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div className="grid grid-cols-1 gap-3">
                      {/* Rule 1 */}
                      <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                            I
                          </span>
                          <h4 className="font-serif font-bold text-stone-100 text-sm">
                            Capture Instantly, Schedule Deliberately
                          </h4>
                        </div>
                        <p className="text-xs text-stone-400 leading-relaxed pl-8">
                          Drop thoughts and tasks into the Day or Lists View without forcing an exact hour upfront. Use natural language (<code className="text-amber-300">@today</code>, <code className="text-amber-300">@tomorrow 2pm</code>) when timing is critical; leave them untethered when it is not.
                        </p>
                      </div>

                      {/* Rule 2 */}
                      <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                            II
                          </span>
                          <h4 className="font-serif font-bold text-stone-100 text-sm">
                            Respect the 3-Task Horizon
                          </h4>
                        </div>
                        <p className="text-xs text-stone-400 leading-relaxed pl-8">
                          Do not overwhelm today with 25 open items. Star your top 1–3 focus tasks to create visual priority cards. Protect your working memory from decision fatigue.
                        </p>
                      </div>

                      {/* Rule 3 */}
                      <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                            III
                          </span>
                          <h4 className="font-serif font-bold text-stone-100 text-sm">
                            Let Reality Shape the Timeline
                          </h4>
                        </div>
                        <p className="text-xs text-stone-400 leading-relaxed pl-8">
                          If a session took longer or wrapped up early, Flow Day&apos;s dynamic blocks let you adjust without guilt. Completed tasks automatically anchor to their true completion time, creating an authentic timeline of your output.
                        </p>
                      </div>

                      {/* Rule 4 */}
                      <div className="p-4 rounded-xl bg-stone-950/60 border border-stone-800 space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 text-xs font-mono font-bold flex items-center justify-center shrink-0">
                            IV
                          </span>
                          <h4 className="font-serif font-bold text-stone-100 text-sm">
                            Journal As You Work
                          </h4>
                        </div>
                        <p className="text-xs text-stone-400 leading-relaxed pl-8">
                          Productivity is not just crossing boxes off a list; it is building clarity. Offload granular discoveries and reflections into real-time logs and notes, preserving valuable context for your future self.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── TAB 4: SYNTAX & CHEATSHEET ───────────────────────────── */}
                {activeTab === 'syntax' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    <div>
                      <h3 className="text-stone-100 font-serif font-bold text-sm mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-sky-400" />
                        <span>Natural Language Input Bar Magic</span>
                      </h3>
                      <p className="text-xs text-stone-400 mb-3">
                        Type naturally in any input bar to instantly parse time, date, duration, and categories:
                      </p>

                      <div className="space-y-2 font-mono text-xs">
                        <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-amber-300">@today</span>
                            <span className="text-stone-500">or</span>
                            <span className="text-amber-300">@tomorrow 2pm</span>
                          </div>
                          <span className="text-stone-400 text-[11px]">Schedule Date & Time</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-emerald-300">!45m</span>
                            <span className="text-stone-500">or</span>
                            <span className="text-emerald-300">!1h30m</span>
                          </div>
                          <span className="text-stone-400 text-[11px]">Duration Estimate</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Tag className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-indigo-300">#work</span>
                            <span className="text-stone-500">or</span>
                            <span className="text-indigo-300">#health</span>
                          </div>
                          <span className="text-stone-400 text-[11px]">Category Assignment</span>
                        </div>

                        <div className="p-2.5 rounded-xl bg-stone-950/80 border border-stone-800 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-amber-300">*</span>
                            <span className="text-stone-500">or</span>
                            <span className="text-amber-300">paper</span>
                          </div>
                          <span className="text-stone-400 text-[11px]">Star / Priority Focus Card</span>
                        </div>
                      </div>
                    </div>

                    {/* Navigation & Shortcuts */}
                    <div className="pt-2">
                      <h3 className="text-stone-100 font-serif font-bold text-sm mb-2">
                        View Hotkeys & Gestures
                      </h3>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800 flex items-center justify-between">
                          <span className="text-stone-300">Day View</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-amber-400 font-bold">1</kbd>
                        </div>
                        <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800 flex items-center justify-between">
                          <span className="text-stone-300">Timeline</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-amber-400 font-bold">2</kbd>
                        </div>
                        <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800 flex items-center justify-between">
                          <span className="text-stone-300">Backlog Lists</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-amber-400 font-bold">3</kbd>
                        </div>
                        <div className="p-2.5 rounded-xl bg-stone-950/60 border border-stone-800 flex items-center justify-between">
                          <span className="text-stone-300">Habits View</span>
                          <kbd className="px-1.5 py-0.5 rounded bg-stone-800 border border-stone-700 text-amber-400 font-bold">4</kbd>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-stone-800/80 bg-stone-900/60 flex items-center justify-between text-xs font-mono shrink-0">
                <span className="text-stone-500">
                  Press <kbd className="px-1 py-0.5 rounded bg-stone-800 text-stone-300">?</kbd> to toggle guide anytime
                </span>
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold transition-all cursor-pointer shadow-sm active:scale-95"
                >
                  Got It
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
