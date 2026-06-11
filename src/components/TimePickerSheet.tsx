/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Picker from 'react-mobile-picker';

interface TimePickerSheetProps {
  open: boolean;
  onClose: () => void;
  initialDate: Date;
  onConfirm: (updatedDate: Date) => void;
  minuteStep?: number;
}

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'));
const AM_PM = ['AM', 'PM'] as const;

function roundToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export default function TimePickerSheet({
  open,
  onClose,
  initialDate,
  onConfirm,
  minuteStep: initialStep = 5,
}: TimePickerSheetProps) {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [minuteStep, setMinuteStep] = useState(() => {
    try {
      const stored = localStorage.getItem('timePickerMinuteStep');
      return stored ? parseInt(stored, 10) : initialStep;
    } catch {
      return initialStep;
    }
  });

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Init picker value from initialDate (snapped to minuteStep)
  const [pickerValue, setPickerValue] = useState<{
    hour: string;
    minute: string;
    ampm: string;
  }>(() => {
    const h = initialDate.getHours();
    const m = roundToStep(initialDate.getMinutes(), minuteStep);
    return {
      hour: String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0'),
      minute: String(Math.min(m, 60 - minuteStep)).padStart(2, '0'),
      ampm: h >= 12 ? 'PM' : 'AM',
    };
  });

  // Sync when the sheet opens with a new date
  useEffect(() => {
    if (open) {
      const h = initialDate.getHours();
      const m = roundToStep(initialDate.getMinutes(), minuteStep);
      setPickerValue({
        hour: String(h % 12 === 0 ? 12 : h % 12).padStart(2, '0'),
        minute: String(Math.min(m, 60 - minuteStep)).padStart(2, '0'),
        ampm: h >= 12 ? 'PM' : 'AM',
      });
    }
  }, [open, initialDate, minuteStep]);

  const handleChange = (newValue: { hour: string; minute: string; ampm: string }, _key: string) => {
    setPickerValue(newValue);
  };

  const handleConfirm = () => {
    // Convert 12-hour to 24-hour
    let hour24 = parseInt(pickerValue.hour, 10);
    if (pickerValue.ampm === 'PM' && hour24 !== 12) hour24 += 12;
    if (pickerValue.ampm === 'AM' && hour24 === 12) hour24 = 0;

    // Preserve date part from initialDate
    const d = new Date(initialDate);
    d.setHours(hour24);
    d.setMinutes(parseInt(pickerValue.minute, 10));
    d.setSeconds(0);
    d.setMilliseconds(0);

    onConfirm(d);
    onClose();
  };

  const content = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-5 pt-4 pb-2">
        <button
          onClick={onClose}
          className="text-sm font-sans text-stone-400 hover:text-stone-200 transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <span className="text-sm font-sans font-semibold text-stone-200">Edit Time</span>
        <button
          onClick={handleConfirm}
          className="text-sm font-sans font-semibold text-sky-400 hover:text-sky-300 transition-colors cursor-pointer"
        >
          Confirm
        </button>
      </div>

      {/* Step Toggle */}
      <div className="flex-none flex items-center justify-center gap-2 pb-2 px-5">
        <span className="text-[10px] font-mono text-stone-500">Step:</span>
        {[1, 5, 10, 15, 30].map((s) => (
          <button
            key={s}
            onClick={() => {
              setMinuteStep(s);
              try { localStorage.setItem('timePickerMinuteStep', String(s)); } catch {}
              // Snap current minute to new step
              setPickerValue((prev) => {
                const snapped = roundToStep(parseInt(prev.minute, 10), s);
                return {
                  ...prev,
                  minute: String(Math.min(snapped, 60 - s)).padStart(2, '0'),
                };
              });
            }}
            className={`px-2.5 py-1 rounded text-[11px] font-mono border transition-colors cursor-pointer ${
              minuteStep === s
                ? 'bg-sky-500/15 border-sky-500/30 text-sky-400'
                : 'border-stone-800 text-stone-500 hover:border-stone-600 hover:text-stone-300'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Picker */}
      <div className="flex-1 flex items-center justify-center px-6 pb-6">
        <Picker
          value={pickerValue}
          onChange={handleChange}
          height={180}
          itemHeight={36}
          wheelMode="natural"
          className="w-full max-w-xs"
        >
          <Picker.Column name="hour">
            {HOURS.map((h) => (
              <Picker.Item key={h} value={h}>
                {({ selected }) => (
                  <div
                    className={`text-lg font-mono tracking-wide transition-colors ${
                      selected ? 'text-stone-100 font-semibold' : 'text-stone-600'
                    }`}
                  >
                    {h}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>

          <Picker.Column name="minute">
            {Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) =>
              String(i * minuteStep).padStart(2, '0'),
            ).map((m) => (
              <Picker.Item key={m} value={m}>
                {({ selected }) => (
                  <div
                    className={`text-lg font-mono tracking-wide transition-colors ${
                      selected ? 'text-stone-100 font-semibold' : 'text-stone-600'
                    }`}
                  >
                    {m}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>

          <Picker.Column name="ampm">
            {AM_PM.map((ap) => (
              <Picker.Item key={ap} value={ap}>
                {({ selected }) => (
                  <div
                    className={`text-lg font-mono tracking-wide transition-colors ${
                      selected ? 'text-stone-100 font-semibold' : 'text-stone-600'
                    }`}
                  >
                    {ap}
                  </div>
                )}
              </Picker.Item>
            ))}
          </Picker.Column>
        </Picker>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999]"
          />

          {isMobile ? (
            <div className="fixed inset-0 z-[999] flex items-end justify-center font-sans pointer-events-none">
              <div className="relative w-full h-[55vh] bg-[#121212] border-t border-stone-850 rounded-t-2xl shadow-2xl z-10 flex flex-col overflow-hidden pointer-events-auto animate-slide-up">
                <div className="flex-none flex justify-center pt-3 pb-0">
                  <button
                    onClick={onClose}
                    className="w-12 h-1 bg-stone-700 hover:bg-stone-500 rounded-full transition-colors cursor-pointer"
                  />
                </div>
                <div className="flex-1 overflow-hidden flex flex-col">{content}</div>
              </div>
            </div>
          ) : (
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center z-[999] p-4 font-sans pointer-events-none">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#121212] border border-stone-800 rounded-2xl overflow-hidden shadow-2xl pointer-events-auto w-full max-w-sm"
              >
                {content}
              </motion.div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
