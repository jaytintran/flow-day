/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import { Compass, Globe, Check, X } from 'lucide-react';
import { db } from '../db';
import { Purpose, Domain } from '../types';

interface PurposePickerSheetProps {
  open: boolean;
  onClose: () => void;
  currentPurposeIds: string[];
  onToggle: (purposeId: string) => void;
  isMobile: boolean;
}

export default function PurposePickerSheet({
  open,
  onClose,
  currentPurposeIds,
  onToggle,
  isMobile,
}: PurposePickerSheetProps) {
  const purposes = (useLiveQuery(() => db.purposes.toArray()) || []) as Purpose[];
  const domains = (useLiveQuery(() => db.domains.toArray()) || []) as Domain[];

  const domainMap = React.useMemo(() => {
    const map: Record<string, Domain> = {};
    for (const d of domains) map[d.id] = d;
    return map;
  }, [domains]);

  const sortedPurposes = [...purposes].sort(
    (a, b) =>
      (a.sort_order ?? Date.parse(a.created_at.toString())) -
      (b.sort_order ?? Date.parse(b.created_at.toString())),
  );

  // Group purposes by domain for display
  const grouped = React.useMemo(() => {
    const withDomain: { domain: Domain; purposes: Purpose[] }[] = [];
    const unassigned: Purpose[] = [];
    const seen = new Set<string>();

    for (const d of [...domains].sort(
      (a, b) =>
        (a.sort_order ?? Date.parse(a.created_at.toString())) -
        (b.sort_order ?? Date.parse(b.created_at.toString())),
    )) {
      const linked = sortedPurposes.filter((p) => (p.domain_ids ?? []).includes(d.id));
      if (linked.length > 0) {
        withDomain.push({ domain: d, purposes: linked });
        linked.forEach((p) => seen.add(p.id));
      }
    }

    for (const p of sortedPurposes) {
      if (!seen.has(p.id)) unassigned.push(p);
    }

    return { withDomain, unassigned };
  }, [domains, sortedPurposes]);

  const content = (
    <div className="flex flex-col h-full bg-[#121212]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-800/60 px-4 py-3.5 shrink-0">
        <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-1 rounded border text-indigo-400 bg-indigo-500/10 border-indigo-500/20 flex items-center gap-1.5">
          <Compass className="w-3 h-3" />
          Link Purposes
        </span>
        <button
          onClick={onClose}
          className="p-1 text-stone-500 hover:text-stone-300 rounded-lg transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {sortedPurposes.length === 0 ? (
          <div className="py-12 text-center text-stone-600">
            <Compass className="w-8 h-8 mx-auto mb-2 text-stone-700" />
            <p className="text-xs font-sans">No purposes yet</p>
            <p className="text-[10px] font-sans text-stone-700 mt-1">
              Create purposes in the Focus column first.
            </p>
          </div>
        ) : (
          <>
            {/* Grouped under domains */}
            {grouped.withDomain.map(({ domain, purposes: ps }) => (
              <div key={domain.id}>
                <div className="flex items-center gap-1.5 mb-1.5 px-1">
                  <Globe className="w-2.5 h-2.5 text-teal-500" />
                  <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-teal-600">
                    {domain.title}
                  </span>
                </div>
                <div className="space-y-1">{ps.map((p) => renderPurposeRow(p))}</div>
              </div>
            ))}

            {/* Unassigned purposes */}
            {grouped.unassigned.length > 0 && (
              <div>
                {grouped.withDomain.length > 0 && (
                  <div className="flex items-center gap-1.5 mb-1.5 px-1">
                    <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-stone-600">
                      No Domain
                    </span>
                  </div>
                )}
                <div className="space-y-1">
                  {grouped.unassigned.map((p) => renderPurposeRow(p))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 px-4 py-3 border-t border-stone-800 bg-[#121212]">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-stone-500">
            {currentPurposeIds.length} selected
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );

  function renderPurposeRow(p: Purpose) {
    const isActive = currentPurposeIds.includes(p.id);
    return (
      <button
        key={p.id}
        onClick={() => onToggle(p.id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all cursor-pointer text-left ${
          isActive
            ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-200'
            : 'bg-[#0a0a0a] border-stone-800/80 text-stone-300 hover:border-stone-700 hover:text-stone-200'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
            isActive ? 'bg-indigo-500/20 border-indigo-400' : 'border-stone-700'
          }`}
        >
          {isActive && <Check className="w-2.5 h-2.5 text-indigo-400 stroke-[3]" />}
        </div>
        <span className="flex-1 text-sm font-serif truncate">{p.title}</span>
        {(p.domain_ids ?? []).length > 0 && (
          <div className="flex items-center gap-1 shrink-0">
            {(p.domain_ids ?? []).slice(0, 2).map((did) =>
              domainMap[did] ? (
                <span
                  key={did}
                  className="text-[8px] font-mono px-1.5 py-0.5 rounded border border-teal-700/40 text-teal-500 bg-teal-500/10"
                >
                  {domainMap[did].title}
                </span>
              ) : null,
            )}
            {(p.domain_ids ?? []).length > 2 && (
              <span className="text-[8px] font-mono text-stone-600">
                +{(p.domain_ids ?? []).length - 2}
              </span>
            )}
          </div>
        )}
      </button>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <div onClick={onClose} className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[999]" />

          {isMobile ? (
            <div className="fixed inset-0 z-[999] flex items-end justify-center font-sans pointer-events-none">
              <div className="relative w-full h-[70vh] bg-[#121212] border-t border-stone-850 rounded-t-2xl shadow-2xl z-10 flex flex-col overflow-hidden pointer-events-auto animate-slide-up">
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
                className="bg-[#121212] border border-stone-800 rounded-2xl max-w-md w-full overflow-hidden shadow-2xl relative flex flex-col h-[65vh] pointer-events-auto"
              >
                <div className="flex-1 overflow-hidden flex flex-col">{content}</div>
              </motion.div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
