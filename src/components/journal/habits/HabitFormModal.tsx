/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Sun, Zap, Moon, Clock, Calendar, Check, Compass, Globe } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db';
import { Habit, RoutineSlot, HabitFrequencyType, Purpose, Domain } from '../../../types';
import { HABIT_THEMES, ROUTINE_SLOTS } from '../../../lib/habitUtils';

interface HabitFormModalProps {
  open: boolean;
  onClose: () => void;
  habitToEdit?: Habit | null;
}

const WEEKDAYS = [
  { id: 0, label: 'Su', full: 'Sunday' },
  { id: 1, label: 'Mo', full: 'Monday' },
  { id: 2, label: 'Tu', full: 'Tuesday' },
  { id: 3, label: 'We', full: 'Wednesday' },
  { id: 4, label: 'Th', full: 'Thursday' },
  { id: 5, label: 'Fr', full: 'Friday' },
  { id: 6, label: 'Sa', full: 'Saturday' },
];

export default function HabitFormModal({ open, onClose, habitToEdit }: HabitFormModalProps) {
  const isEditing = !!habitToEdit;

  const [title, setTitle] = useState('');
  const [color, setColor] = useState<Habit['color']>('emerald');
  const [routineSlot, setRoutineSlot] = useState<RoutineSlot>('anytime');
  const [frequencyType, setFrequencyType] = useState<HabitFrequencyType>('daily');
  const [targetDaysPerWeek, setTargetDaysPerWeek] = useState(3);
  const [targetWeekdays, setTargetWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [isMeasurable, setIsMeasurable] = useState(false);
  const [targetValue, setTargetValue] = useState<number>(10);
  const [unit, setUnit] = useState('mins');
  const [selectedPurposes, setSelectedPurposes] = useState<string[]>([]);
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);

  const purposes = (useLiveQuery(() => db.purposes.toArray()) || []) as Purpose[];
  const domains = (useLiveQuery(() => db.domains.toArray()) || []) as Domain[];

  useEffect(() => {
    if (habitToEdit) {
      setTitle(habitToEdit.title);
      setColor(habitToEdit.color || 'emerald');
      setRoutineSlot(habitToEdit.routine_slot || 'anytime');
      setFrequencyType(habitToEdit.frequency_type || 'daily');
      setTargetDaysPerWeek(habitToEdit.target_days_per_week || 3);
      setTargetWeekdays(habitToEdit.target_weekdays || [1, 2, 3, 4, 5]);
      setIsMeasurable(Boolean(habitToEdit.target_value && habitToEdit.target_value > 0));
      setTargetValue(habitToEdit.target_value || 10);
      setUnit(habitToEdit.unit || 'mins');
      setSelectedPurposes(habitToEdit.purpose_ids || []);
      setSelectedDomains(habitToEdit.domain_ids || []);
    } else {
      setTitle('');
      setColor('emerald');
      setRoutineSlot('anytime');
      setFrequencyType('daily');
      setTargetDaysPerWeek(3);
      setTargetWeekdays([1, 2, 3, 4, 5]);
      setIsMeasurable(false);
      setTargetValue(10);
      setUnit('mins');
      setSelectedPurposes([]);
      setSelectedDomains([]);
    }
  }, [habitToEdit, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    if (isEditing && habitToEdit) {
      await db.habits.update(habitToEdit.id, {
        title: cleanTitle,
        color,
        routine_slot: routineSlot,
        frequency_type: frequencyType,
        target_days_per_week: frequencyType === 'weekly_target' ? targetDaysPerWeek : undefined,
        target_weekdays: frequencyType === 'specific_days' ? targetWeekdays : undefined,
        target_value: isMeasurable ? Number(targetValue) : undefined,
        unit: isMeasurable ? unit.trim() : undefined,
        purpose_ids: selectedPurposes,
        domain_ids: selectedDomains,
      });
    } else {
      const newHabit: Habit = {
        id: crypto.randomUUID(),
        title: cleanTitle,
        created_at: new Date(),
        status: 'active',
        color,
        routine_slot: routineSlot,
        frequency_type: frequencyType,
        target_days_per_week: frequencyType === 'weekly_target' ? targetDaysPerWeek : undefined,
        target_weekdays: frequencyType === 'specific_days' ? targetWeekdays : undefined,
        target_value: isMeasurable ? Number(targetValue) : undefined,
        unit: isMeasurable ? unit.trim() : undefined,
        purpose_ids: selectedPurposes,
        domain_ids: selectedDomains,
      };
      await db.habits.add(newHabit);
    }
    onClose();
  };

  const toggleWeekday = (dayId: number) => {
    setTargetWeekdays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId].sort(),
    );
  };

  const togglePurpose = (pid: string) => {
    setSelectedPurposes((prev) =>
      prev.includes(pid) ? prev.filter((id) => id !== pid) : [...prev, pid],
    );
  };

  const toggleDomain = (did: string) => {
    setSelectedDomains((prev) =>
      prev.includes(did) ? prev.filter((id) => id !== did) : [...prev, did],
    );
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 md:p-4 font-sans">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="relative w-full max-w-lg bg-[#121212] border border-stone-800 rounded-2xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-stone-850 bg-[#151515]">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-stone-100">
                    {isEditing ? 'Edit Habit & Routine' : 'Create New Habit'}
                  </h3>
                  <p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest">
                    Flow Day Routines Engine
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Title & Color */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
                  Habit Title
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    required
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Morning 20m Meditation, Drink Water, Read 30m..."
                    className="flex-1 bg-[#0a0a0a] text-stone-100 border border-stone-800 focus:border-emerald-500/60 rounded-xl px-3.5 py-2.5 text-sm placeholder-stone-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/30 transition-all shadow-inner"
                  />
                  {/* Color dots */}
                  <div className="flex items-center gap-1.5 bg-[#0a0a0a] p-1.5 rounded-xl border border-stone-800">
                    {Object.values(HABIT_THEMES).map((theme) => (
                      <button
                        key={theme.key}
                        type="button"
                        onClick={() => setColor(theme.key)}
                        className={`w-4 h-4 rounded-full ${theme.dot} transition-all cursor-pointer ${
                          color === theme.key
                            ? `ring-2 ring-offset-2 ring-offset-[#121212] ${theme.ring} scale-110`
                            : 'opacity-40 hover:opacity-80'
                        }`}
                        title={theme.label}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Circadian Routine Slot */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
                  Routine Slot (Circadian Timing)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {ROUTINE_SLOTS.map((slot) => {
                    const isSelected = routineSlot === slot.id;
                    const Icon =
                      slot.id === 'morning'
                        ? Sun
                        : slot.id === 'afternoon'
                          ? Zap
                          : slot.id === 'evening'
                            ? Moon
                            : Clock;
                    return (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setRoutineSlot(slot.id)}
                        className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-stone-800/90 border-emerald-500/50 text-stone-100 shadow-md ring-1 ring-emerald-500/30'
                            : 'bg-[#0a0a0a] border-stone-850 text-stone-400 hover:border-stone-750 hover:text-stone-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1.5 ${slot.color}`} />
                        <span className="text-xs font-semibold">{slot.label}</span>
                        <span className="text-[9px] font-mono text-stone-500 mt-0.5">{slot.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Frequency Schedule */}
              <div className="space-y-2">
                <label className="text-[11px] font-mono uppercase tracking-wider text-stone-400">
                  Frequency Target
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'daily', label: 'Every Day' },
                    { id: 'weekly_target', label: 'Days / Week' },
                    { id: 'specific_days', label: 'Specific Days' },
                  ].map((freq) => (
                    <button
                      key={freq.id}
                      type="button"
                      onClick={() => setFrequencyType(freq.id as HabitFrequencyType)}
                      className={`py-2 px-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer text-center ${
                        frequencyType === freq.id
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                          : 'bg-[#0a0a0a] border-stone-850 text-stone-400 hover:border-stone-750'
                      }`}
                    >
                      {freq.label}
                    </button>
                  ))}
                </div>

                {/* Sub-options based on frequency type */}
                {frequencyType === 'weekly_target' && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0a] border border-stone-850 mt-2">
                    <span className="text-xs text-stone-300 font-medium">Target repetitions per week:</span>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5, 6].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setTargetDaysPerWeek(num)}
                          className={`w-7 h-7 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                            targetDaysPerWeek === num
                              ? 'bg-emerald-500 text-black shadow-md'
                              : 'bg-stone-850 text-stone-400 hover:bg-stone-750'
                          }`}
                        >
                          {num}×
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {frequencyType === 'specific_days' && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-[#0a0a0a] border border-stone-850 mt-2">
                    <div className="flex items-center gap-1.5 w-full justify-between">
                      {WEEKDAYS.map((w) => {
                        const active = targetWeekdays.includes(w.id);
                        return (
                          <button
                            key={w.id}
                            type="button"
                            onClick={() => toggleWeekday(w.id)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all cursor-pointer ${
                              active
                                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                                : 'bg-stone-900 border border-stone-800 text-stone-500 hover:text-stone-300'
                            }`}
                            title={w.full}
                          >
                            {w.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Numeric / Measurable Target */}
              <div className="p-3.5 rounded-xl bg-[#0a0a0a] border border-stone-850 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-stone-200">Measurable / Quantitative Goal</p>
                    <p className="text-[10px] text-stone-500">Track numeric amounts (water, pages, minutes)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsMeasurable(!isMeasurable)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isMeasurable ? 'bg-emerald-500' : 'bg-stone-800'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        isMeasurable ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {isMeasurable && (
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-850">
                    <div className="flex-1">
                      <label className="text-[10px] font-mono uppercase text-stone-500 block mb-1">
                        Daily Target Value
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={targetValue}
                        onChange={(e) => setTargetValue(Number(e.target.value))}
                        className="w-full bg-[#141414] border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div className="w-28">
                      <label className="text-[10px] font-mono uppercase text-stone-500 block mb-1">
                        Unit
                      </label>
                      <input
                        type="text"
                        value={unit}
                        onChange={(e) => setUnit(e.target.value)}
                        placeholder="e.g. ml, pages, min"
                        className="w-full bg-[#141414] border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-100 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Purpose & Domain Connections */}
              <div className="space-y-3 pt-2">
                {purposes.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                      <Compass className="w-3 h-3 text-indigo-400" /> Link to Purpose
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {purposes.map((p) => {
                        const selected = selectedPurposes.includes(p.id);
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => togglePurpose(p.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer border flex items-center gap-1.5 ${
                              selected
                                ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                                : 'bg-[#0a0a0a] border-stone-800 text-stone-500 hover:text-stone-300'
                            }`}
                          >
                            {selected && <Check className="w-3 h-3" />}
                            {p.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {domains.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                      <Globe className="w-3 h-3 text-teal-400" /> Link to Domain
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {domains.map((d) => {
                        const selected = selectedDomains.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            onClick={() => toggleDomain(d.id)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all cursor-pointer border flex items-center gap-1.5 ${
                              selected
                                ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                                : 'bg-[#0a0a0a] border-stone-800 text-stone-500 hover:text-stone-300'
                            }`}
                          >
                            {selected && <Check className="w-3 h-3" />}
                            {d.title}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Submit / Cancel Footer */}
              <div className="pt-4 border-t border-stone-850 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider bg-emerald-500 text-black hover:bg-emerald-400 transition-all active:scale-95 shadow-lg shadow-emerald-950/40 cursor-pointer flex items-center gap-1.5"
                >
                  {isEditing ? 'Save Changes' : 'Create Habit'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
