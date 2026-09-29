/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../db';
import { TimelineEntry } from '../types';
import {
  HardDrive,
  Database,
  Calendar,
  Trash2,
  Download,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Zap,
  Layers,
  FileText,
  Clock,
  CheckSquare,
  CircleDot,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface StorageManagerProps {
  isMobile?: boolean;
}

interface TypeBreakdown {
  type: string;
  count: number;
  sizeBytes: number;
  entryIds: string[];
}

interface MonthData {
  monthKey: string; // YYYY-MM
  label: string; // e.g. "Sep 2026"
  totalCount: number;
  totalSizeBytes: number;
  typeMap: Record<string, TypeBreakdown>;
}

interface CategoryMetric {
  name: string;
  count: number;
  bytes: number;
  color: string;
}

export default function StorageManager({ isMobile }: StorageManagerProps) {
  const [loading, setLoading] = useState(true);
  const [totalAppBytes, setTotalAppBytes] = useState(0);
  const [idbBytes, setIdbBytes] = useState(0);
  const [localStorageBytes, setLocalStorageBytes] = useState(0);
  const [quotaBytes, setQuotaBytes] = useState<number>(50 * 1024 * 1024); // fallback 50MB

  const [categories, setCategories] = useState<CategoryMetric[]>([]);
  const [months, setMonths] = useState<MonthData[]>([]);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    actionLabel: string;
    onConfirm: () => Promise<void>;
  } | null>(null);

  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Load & calculate all storage data
  const calculateStorage = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Quota estimation from Navigator Storage API if available
      if (navigator.storage && navigator.storage.estimate) {
        try {
          const est = await navigator.storage.estimate();
          if (est.quota) {
            setQuotaBytes(est.quota);
          }
        } catch {}
      }

      // 2. Measure localStorage
      let lsBytes = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k) {
          const v = localStorage.getItem(k) || '';
          lsBytes += (k.length + v.length) * 2; // UTF-16 approximate
        }
      }
      setLocalStorageBytes(lsBytes);

      // 3. Query all IndexedDB tables
      const entries = await db.entries.toArray();
      const habits = await db.habits.toArray();
      const dbCategories = await db.categories.toArray();
      const purposes = await db.purposes.toArray();
      const domains = await db.domains.toArray();
      const listFolders = await db.list_folders.toArray();
      const entities = await db.entities.toArray();
      const entityTypes = await db.entity_types.toArray();

      const entriesBytes = JSON.stringify(entries).length * 2;
      const entitiesBytes = JSON.stringify([...entities, ...entityTypes, ...purposes, ...domains]).length * 2;
      const habitsBytes = JSON.stringify(habits).length * 2;
      const foldersBytes = JSON.stringify([...dbCategories, ...listFolders]).length * 2;

      // Scratchpad localStorage size
      let scratchpadBytes = 0;
      let scratchpadCount = 0;
      const rawToday = localStorage.getItem('flowday_today_pad_v1');
      if (rawToday) {
        scratchpadBytes += rawToday.length * 2;
        try {
          const parsed = JSON.parse(rawToday);
          scratchpadCount += (parsed.items?.length || 0) + (parsed.anchors?.length || 0);
        } catch {}
      }
      const rawPads = localStorage.getItem('flowday_scratchpad_pads_v1');
      if (rawPads) {
        scratchpadBytes += rawPads.length * 2;
        try {
          const parsed = JSON.parse(rawPads);
          parsed.forEach((p: any) => { scratchpadCount += p.items?.length || 0; });
        } catch {}
      }

      const totalIdb = entriesBytes + entitiesBytes + habitsBytes + foldersBytes;
      setIdbBytes(totalIdb);
      setTotalAppBytes(totalIdb + lsBytes);

      // Category metrics for progress bar
      setCategories([
        { name: 'Timeline Entries', count: entries.length, bytes: entriesBytes, color: 'bg-emerald-500' },
        { name: 'Entities & Goals', count: entities.length + purposes.length + domains.length, bytes: entitiesBytes, color: 'bg-amber-500' },
        { name: 'Habits & Logs', count: habits.length, bytes: habitsBytes, color: 'bg-rose-500' },
        { name: 'Scratchpads', count: scratchpadCount, bytes: scratchpadBytes, color: 'bg-sky-500' },
        { name: 'Folders & Config', count: dbCategories.length + listFolders.length, bytes: foldersBytes + (lsBytes - scratchpadBytes), color: 'bg-indigo-500' },
      ]);

      // 4. Group Timeline Entries by Month (YYYY-MM)
      const monthMap: Record<string, MonthData> = {};

      entries.forEach((entry) => {
        const dateObj = entry.scheduled_at || entry.timestamp || entry.created_at || new Date();
        const d = new Date(dateObj);
        if (isNaN(d.getTime())) return;

        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const monthKey = `${year}-${month}`;
        const monthLabel = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

        if (!monthMap[monthKey]) {
          monthMap[monthKey] = {
            monthKey,
            label: monthLabel,
            totalCount: 0,
            totalSizeBytes: 0,
            typeMap: {},
          };
        }

        const mData = monthMap[monthKey];
        const entryType = entry.type || 'other';
        const entrySize = JSON.stringify(entry).length * 2;

        mData.totalCount += 1;
        mData.totalSizeBytes += entrySize;

        if (!mData.typeMap[entryType]) {
          mData.typeMap[entryType] = {
            type: entryType,
            count: 0,
            sizeBytes: 0,
            entryIds: [],
          };
        }

        mData.typeMap[entryType].count += 1;
        mData.typeMap[entryType].sizeBytes += entrySize;
        mData.typeMap[entryType].entryIds.push(entry.id);
      });

      // Sort months descending
      const sortedMonths = Object.values(monthMap).sort((a, b) => (a.monthKey > b.monthKey ? -1 : 1));
      setMonths(sortedMonths);

      // Auto-expand most recent month if available
      if (sortedMonths.length > 0 && expandedMonths.size === 0) {
        setExpandedMonths(new Set([sortedMonths[0].monthKey]));
      }
    } catch (err) {
      console.error('Failed to calculate storage metrics:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    calculateStorage();
  }, [calculateStorage]);

  const formatMB = (bytes: number) => (bytes / (1024 * 1024)).toFixed(2);
  const formatKB = (bytes: number) => (bytes / 1024).toFixed(1);

  const toggleMonth = (mKey: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(mKey)) next.delete(mKey);
      else next.add(mKey);
      return next;
    });
  };

  const showToastMsg = (msg: string) => {
    setActionMessage(msg);
    setTimeout(() => setActionMessage(null), 3500);
  };

  // ─── Actions ─────────────────────────────────────────────────────────────

  // Export specific Month JSON
  const handleExportMonth = async (month: MonthData) => {
    try {
      const allIds = Object.values(month.typeMap).flatMap((t) => t.entryIds);
      const entries = await db.entries.where('id').anyOf(allIds).toArray();

      const payload = {
        exportedMonth: month.monthKey,
        exportedAt: new Date().toISOString(),
        count: entries.length,
        entries,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowday-backup-${month.monthKey}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToastMsg(`Exported ${entries.length} entries for ${month.label}`);
    } catch (err) {
      console.error('Failed to export month data:', err);
    }
  };

  // Export single type within a month
  const handleExportMonthType = async (monthLabel: string, typeInfo: TypeBreakdown) => {
    try {
      const entries = await db.entries.where('id').anyOf(typeInfo.entryIds).toArray();
      const payload = {
        exportedMonth: monthLabel,
        type: typeInfo.type,
        exportedAt: new Date().toISOString(),
        count: entries.length,
        entries,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flowday-${typeInfo.type}s-${monthLabel.replace(/\s+/g, '-')}.json`;
      a.click();
      URL.revokeObjectURL(url);

      showToastMsg(`Exported ${entries.length} ${typeInfo.type}s for ${monthLabel}`);
    } catch (err) {
      console.error('Failed to export type data:', err);
    }
  };

  // Delete specific type in a month
  const handleDeleteMonthType = (monthLabel: string, typeInfo: TypeBreakdown) => {
    setConfirmModal({
      isOpen: true,
      title: `Delete ${typeInfo.type.toUpperCase()} entries from ${monthLabel}?`,
      description: `This will permanently delete ${typeInfo.count} ${typeInfo.type} entry(ies) from ${monthLabel}. This action cannot be undone.`,
      actionLabel: `Delete ${typeInfo.count} Entries`,
      onConfirm: async () => {
        await db.entries.bulkDelete(typeInfo.entryIds);
        showToastMsg(`Deleted ${typeInfo.count} ${typeInfo.type} entries from ${monthLabel}`);
        calculateStorage();
      },
    });
  };

  // Delete entire Month
  const handleDeleteMonth = (month: MonthData) => {
    const allIds = Object.values(month.typeMap).flatMap((t) => t.entryIds);
    setConfirmModal({
      isOpen: true,
      title: `Purge all entries from ${month.label}?`,
      description: `This will permanently delete all ${month.totalCount} entry(ies) logged during ${month.label}. Consider exporting first.`,
      actionLabel: `Purge ${month.label}`,
      onConfirm: async () => {
        await db.entries.bulkDelete(allIds);
        showToastMsg(`Purged all entries for ${month.label}`);
        calculateStorage();
      },
    });
  };

  // Quick Action 1: Clear Logs older than 90 days
  const handleClearLogsOlderThan90 = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Log entries older than 90 days?',
      description: 'Delete all "log" type timeline entries older than 90 days. Tasks, Notes, Events, and Habits will be kept.',
      actionLabel: 'Clear Old Logs',
      onConfirm: async () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);

        const logs = await db.entries.where('type').equals('log').toArray();
        const oldLogs = logs.filter((l) => {
          const d = l.timestamp || l.created_at || new Date();
          return new Date(d) < cutoff;
        });

        if (oldLogs.length === 0) {
          showToastMsg('No log entries older than 90 days found.');
          return;
        }

        const ids = oldLogs.map((l) => l.id);
        await db.entries.bulkDelete(ids);
        showToastMsg(`Cleared ${ids.length} log entries older than 90 days.`);
        calculateStorage();
      },
    });
  };

  // Quick Action 2: Clear Habit Records older than 90 days
  const handleClearHabitLogsOlderThan90 = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear Habit records older than 90 days?',
      description: 'Delete all "habit-log" entries older than 90 days. Your habit templates will be preserved.',
      actionLabel: 'Clear Old Habit Logs',
      onConfirm: async () => {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 90);

        const habitLogs = await db.entries.where('type').equals('habit-log').toArray();
        const oldHabitLogs = habitLogs.filter((h) => {
          const d = h.timestamp || h.created_at || new Date();
          return new Date(d) < cutoff;
        });

        if (oldHabitLogs.length === 0) {
          showToastMsg('No habit records older than 90 days found.');
          return;
        }

        const ids = oldHabitLogs.map((h) => h.id);
        await db.entries.bulkDelete(ids);
        showToastMsg(`Cleared ${ids.length} habit records older than 90 days.`);
        calculateStorage();
      },
    });
  };

  // Quick Action 3: Clear Day Pad Data (Day Pad tab active items & history only)
  const handleClearDayPadData = () => {
    setConfirmModal({
      isOpen: true,
      title: "Clear Day Pad's Data?",
      description: "Resets active items and completed history in the Day Pad tab. Free-form tabs will remain untouched.",
      actionLabel: 'Clear Day Pad Data',
      onConfirm: async () => {
        try {
          const raw = localStorage.getItem('flowday_today_pad_v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            const resetData = { ...parsed, items: [] };
            localStorage.setItem('flowday_today_pad_v1', JSON.stringify(resetData));
            window.dispatchEvent(new CustomEvent('scratchpad_sync_update'));
          }
          showToastMsg("Cleared Day Pad items & history.");
          calculateStorage();
        } catch {}
      },
    });
  };

  // Quick Action 4: Clear All Anchors
  const handleClearAllAnchors = () => {
    setConfirmModal({
      isOpen: true,
      title: 'Clear All Anchors?',
      description: 'Deletes all time-specific Anchors set across all dates in the Scratchpad. Active tasks and free-form pads will remain intact.',
      actionLabel: 'Clear Anchors',
      onConfirm: async () => {
        try {
          const raw = localStorage.getItem('flowday_today_pad_v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            const resetData = { ...parsed, anchors: [] };
            localStorage.setItem('flowday_today_pad_v1', JSON.stringify(resetData));
            window.dispatchEvent(new CustomEvent('scratchpad_sync_update'));
          }
          showToastMsg('Cleared all Scratchpad Anchors.');
          calculateStorage();
        } catch {}
      },
    });
  };

  const totalUsedMB = formatMB(totalAppBytes);
  const quotaMB = (quotaBytes / (1024 * 1024)).toFixed(0);
  const percentUsed = Math.min(100, Math.max(1, (totalAppBytes / quotaBytes) * 100)).toFixed(1);

  return (
    <div className="space-y-5 font-sans">
      {/* Live Toast Feedback */}
      <AnimatePresence>
        {actionMessage && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-400 text-xs font-mono flex items-center gap-2 shadow-lg"
          >
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{actionMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── SECTION 1: TOP METRIC CARDS ─────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {/* Card 1: Total App Storage */}
        <div className="p-4 bg-stone-950/60 border border-stone-850 rounded-2xl flex flex-col justify-between gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-500" />
              <span className="text-xs font-mono font-bold text-stone-200 uppercase tracking-wide">
                Total App Storage
              </span>
            </div>
            <button
              type="button"
              onClick={calculateStorage}
              className="p-1 text-stone-500 hover:text-stone-300 hover:bg-stone-850 rounded-lg transition-colors cursor-pointer"
              title="Refresh Storage Metrics"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="space-y-1">
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-mono font-bold text-stone-100">
                {totalUsedMB} <span className="text-xs font-normal text-stone-400">MB</span>
              </span>
              <span className="text-[11px] font-mono text-stone-500">
                / ~{quotaMB} MB quota
              </span>
            </div>
            {/* Storage Progress Bar */}
            <div className="h-2 w-full bg-stone-900 border border-stone-800 rounded-full overflow-hidden flex">
              <div
                className="bg-amber-500 h-full transition-all duration-500"
                style={{ width: `${percentUsed}%` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-stone-500 pt-1 border-t border-stone-850/60">
            <span>IndexedDB: {formatMB(idbBytes)} MB</span>
            <span>localStorage: {formatMB(localStorageBytes)} MB</span>
          </div>
        </div>

        {/* Card 2: Breakdown Bar */}
        <div className="p-4 bg-stone-950/60 border border-stone-850 rounded-2xl flex flex-col justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-mono font-bold text-stone-200 uppercase tracking-wide">
              Storage Distribution
            </span>
          </div>

          {/* Segmented Stacked Bar */}
          <div className="h-2.5 w-full bg-stone-900 border border-stone-800 rounded-full overflow-hidden flex">
            {categories.map((cat, idx) => {
              const p = totalAppBytes > 0 ? (cat.bytes / totalAppBytes) * 100 : 0;
              if (p <= 0) return null;
              return (
                <div
                  key={idx}
                  className={`${cat.color} h-full transition-all duration-300`}
                  style={{ width: `${p}%` }}
                  title={`${cat.name}: ${formatMB(cat.bytes)} MB (${cat.count} items)`}
                />
              );
            })}
          </div>

          {/* Category Chips */}
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            {categories.map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-[10px] font-mono">
                <div className="flex items-center gap-1.5 truncate">
                  <span className={`w-2 h-2 rounded-full ${cat.color} shrink-0`} />
                  <span className="text-stone-400 truncate">{cat.name}</span>
                </div>
                <span className="text-stone-300 font-bold shrink-0">{formatMB(cat.bytes)}MB</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SECTION 2: QUICK ACTIONS ────────────────────────────────────── */}
      <div className="p-4 bg-stone-950/60 border border-stone-850 rounded-2xl space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-mono font-bold text-stone-200 uppercase tracking-wide">
            Quick Actions &amp; Auto-Prune
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleClearLogsOlderThan90}
            className="flex items-center justify-between px-3 py-2.5 bg-stone-900 hover:bg-stone-850 border border-stone-800/80 hover:border-amber-500/30 rounded-xl text-stone-300 hover:text-amber-400 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <CircleDot className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0" />
              <span className="text-xs font-mono truncate">Clear Logs older than 90 days</span>
            </div>
            <Trash2 className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0 opacity-80" />
          </button>

          <button
            type="button"
            onClick={handleClearHabitLogsOlderThan90}
            className="flex items-center justify-between px-3 py-2.5 bg-stone-900 hover:bg-stone-850 border border-stone-800/80 hover:border-amber-500/30 rounded-xl text-stone-300 hover:text-amber-400 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0" />
              <span className="text-xs font-mono truncate">Clear Habit Records older than 90 days</span>
            </div>
            <Trash2 className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0 opacity-80" />
          </button>

          <button
            type="button"
            onClick={handleClearDayPadData}
            className="flex items-center justify-between px-3 py-2.5 bg-stone-900 hover:bg-stone-850 border border-stone-800/80 hover:border-amber-500/30 rounded-xl text-stone-300 hover:text-amber-400 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Layers className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0" />
              <span className="text-xs font-mono truncate">Clear Day Pad's Data</span>
            </div>
            <Trash2 className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0 opacity-80" />
          </button>

          <button
            type="button"
            onClick={handleClearAllAnchors}
            className="flex items-center justify-between px-3 py-2.5 bg-stone-900 hover:bg-stone-850 border border-stone-800/80 hover:border-amber-500/30 rounded-xl text-stone-300 hover:text-amber-400 transition-all cursor-pointer group text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Clock className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0" />
              <span className="text-xs font-mono truncate">Clear All Anchors</span>
            </div>
            <Trash2 className="w-3.5 h-3.5 text-stone-500 group-hover:text-amber-400 shrink-0 opacity-80" />
          </button>
        </div>
      </div>

      {/* ─── SECTION 3: MONTHLY BREAKDOWN ACCORDION ─────────────────────── */}
      <div className="p-4 bg-stone-950/60 border border-stone-850 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-mono font-bold text-stone-200 uppercase tracking-wide">
              Monthly Timeline Breakdown
            </h3>
          </div>
          <span className="text-[10px] font-mono text-stone-500">
            {months.length} Month{months.length !== 1 ? 's' : ''} recorded
          </span>
        </div>

        {months.length === 0 ? (
          <div className="py-8 text-center text-stone-500 text-xs font-mono border border-dashed border-stone-850 rounded-xl">
            No timeline entries recorded yet.
          </div>
        ) : (
          <div className="space-y-2">
            {months.map((m) => {
              const isExpanded = expandedMonths.has(m.monthKey);
              const typeList = Object.values(m.typeMap);

              return (
                <div
                  key={m.monthKey}
                  className="bg-stone-900/60 border border-stone-850 rounded-xl overflow-hidden transition-colors"
                >
                  {/* Month Accordion Header */}
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() => toggleMonth(m.monthKey)}
                      className="flex items-center gap-2 text-xs font-mono font-bold text-stone-200 hover:text-amber-400 transition-colors cursor-pointer select-none"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-stone-500" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-stone-500" />
                      )}
                      <span>{m.label}</span>
                      <span className="text-[10px] font-normal text-stone-500 bg-stone-950 px-2 py-0.5 rounded-full border border-stone-800">
                        {m.totalCount} entries • {formatMB(m.totalSizeBytes)} MB
                      </span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleExportMonth(m)}
                        className="p-1 px-2 text-[10px] font-mono font-bold text-stone-400 hover:text-stone-100 bg-stone-950 hover:bg-stone-800 border border-stone-800 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                        title={`Export ${m.label} to JSON`}
                      >
                        <Download className="w-3 h-3 text-sky-400" />
                        <span>Export</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMonth(m)}
                        className="p-1 text-stone-500 hover:text-rose-400 hover:bg-stone-950 rounded-lg transition-colors cursor-pointer"
                        title={`Purge all entries from ${m.label}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Month Type Breakdown Sub-items */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-stone-850/80 bg-stone-950/40 px-3 py-2 space-y-1.5"
                      >
                        {typeList.map((tInfo) => (
                          <div
                            key={tInfo.type}
                            className="flex items-center justify-between text-xs font-mono py-1 px-2 rounded-lg bg-stone-900/40 border border-stone-850/60"
                          >
                            <div className="flex items-center gap-2">
                              {tInfo.type === 'task' && <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />}
                              {tInfo.type === 'log' && <CircleDot className="w-3.5 h-3.5 text-stone-400" />}
                              {tInfo.type === 'event' && <Calendar className="w-3.5 h-3.5 text-amber-400" />}
                              {tInfo.type === 'note' && <FileText className="w-3.5 h-3.5 text-blue-400" />}
                              {tInfo.type === 'time-block' && <Clock className="w-3.5 h-3.5 text-indigo-400" />}
                              {tInfo.type === 'habit-log' && <Clock className="w-3.5 h-3.5 text-rose-400" />}
                              <span className="capitalize text-stone-300 font-semibold">{tInfo.type}s</span>
                              <span className="text-[10px] text-stone-500">
                                ({tInfo.count} items • {formatKB(tInfo.sizeBytes)} KB)
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleExportMonthType(m.label, tInfo)}
                                className="p-1 text-stone-500 hover:text-sky-400 rounded cursor-pointer"
                                title={`Export ${tInfo.type}s from ${m.label}`}
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteMonthType(m.label, tInfo)}
                                className="p-1 text-stone-500 hover:text-rose-400 rounded cursor-pointer"
                                title={`Delete ${tInfo.type}s from ${m.label}`}
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ─── CONFIRMATION MODAL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {confirmModal?.isOpen && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-stone-900 border border-stone-800 rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4 font-sans"
            >
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div className="space-y-1 min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-stone-100 font-serif">
                    {confirmModal.title}
                  </h3>
                  <p className="text-xs text-stone-400 font-mono leading-relaxed">
                    {confirmModal.description}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-800">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  className="px-3.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl text-xs font-mono font-bold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await confirmModal.onConfirm();
                    setConfirmModal(null);
                  }}
                  className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-mono font-bold cursor-pointer transition-colors shadow-sm"
                >
                  {confirmModal.actionLabel}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
