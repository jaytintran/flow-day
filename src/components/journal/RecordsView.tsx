/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { FileText, Sparkles, Calendar, Trash2, Search } from 'lucide-react';
import { TimelineEntry, Event, Note } from '../../types';
import { toLocalDateString } from '../../utils';

interface RecordsViewProps {
  entries: TimelineEntry[];
  deletingId: string | null;
  onDeleteEntry: (id: string) => void;
  onOpenDetail: (entry: TimelineEntry) => void;
  formatTime: (dateInput: Date | string) => string;
  formatDateStringLabel: (dayStr: string) => string;
}

export default function RecordsView({
  entries,
  deletingId,
  onDeleteEntry,
  onOpenDetail,
  formatTime,
  formatDateStringLabel,
}: RecordsViewProps) {
  const [filterType, setFilterType] = useState<'all' | 'event' | 'note'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const allRecords = entries.filter((e) => e.type === 'event' || e.type === 'note') as (
    | Event
    | Note
  )[];

  const filteredRecords =
    filterType === 'all' ? allRecords : allRecords.filter((r) => r.type === filterType);

  // Apply search filter
  const searchedRecords = useMemo(() => {
    if (!searchQuery.trim()) return filteredRecords;
    const q = searchQuery.toLowerCase();
    return filteredRecords.filter((r) => {
      const title = (
        (r.type === 'note' ? (r as Note).title : (r as Event).title) || ''
      ).toLowerCase();
      const content = (r.content || '').toLowerCase();
      return title.includes(q) || content.includes(q);
    });
  }, [filteredRecords, searchQuery]);

  // Group all records by day
  const allRecordsGrouped: { [dayStr: string]: (Event | Note)[] } = {};
  searchedRecords.forEach((e) => {
    const dayStr = toLocalDateString(new Date(e.timestamp));
    if (!allRecordsGrouped[dayStr]) {
      allRecordsGrouped[dayStr] = [];
    }
    allRecordsGrouped[dayStr].push(e);
  });

  const sortedAllDays = Object.keys(allRecordsGrouped).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );

  const renderCard = (record: Event | Note) => {
    const isEvent = record.type === 'event';

    return (
      <div
        key={record.id}
        id={`record-card-${record.id}`}
        onClick={() => onOpenDetail(record)}
        className={`group/card relative flex flex-col justify-between p-3.5 bg-[#121212]/90 border rounded-xl shadow-sm transition-all duration-200 hover:border-stone-700 hover:-translate-y-0.5 cursor-pointer ${
          isEvent
            ? 'border-indigo-500/20 hover:bg-indigo-500/5'
            : 'border-stone-850 hover:bg-stone-900/10'
        }`}
      >
        {/* Top Badge header row */}
        <div className="flex items-center justify-between gap-2 mb-2.5">
          <span
            className={`text-[8px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
              isEvent
                ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
                : 'bg-stone-850 text-stone-400 border border-stone-850'
            }`}
          >
            {isEvent ? 'Event' : 'Note'}
          </span>

          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-mono text-stone-500">
              {formatTime(record.timestamp)}
            </span>

            {/* Card Delete action */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEntry(record.id);
              }}
              className="opacity-0 group-hover/card:opacity-100 p-1 rounded text-stone-600 hover:text-red-400 hover:bg-red-950/20 transition-all cursor-pointer flex items-center justify-center"
              title="Delete Record"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Record Contents */}
        <div className="flex-1">
          {isEvent ? (
            <div className="space-y-1.5">
              <h4 className="font-serif font-bold text-sm text-stone-100 tracking-wide break-words leading-snug">
                {(record as Event).title}
              </h4>
              <div className="flex items-center gap-1.5 text-[10px] text-stone-500 font-mono">
                <Calendar className="w-3 h-3 text-indigo-500" />
                <span>Scheduled: {formatTime(record.timestamp)}</span>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <h4 className="font-serif font-semibold text-sm text-stone-100 tracking-wide break-words leading-snug">
                {(record as Note).title || 'Untitled Note'}
              </h4>
              {record.content?.trim() ? (
                <p className="text-[11px] text-stone-400 font-serif leading-relaxed line-clamp-2">
                  {record.content}
                </p>
              ) : (
                <p className="text-[11px] text-stone-600 italic">No description</p>
              )}
              <div className="flex items-center gap-1.5 text-[10px] text-stone-500 font-mono pt-0.5">
                <FileText className="w-3 h-3 text-blue-500" />
                <span>Logged: {formatTime(record.timestamp)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer warning if delete is safety-primed */}
        {deletingId === record.id && (
          <div className="mt-3 pt-2 border-t border-red-950/30 flex items-center justify-between font-mono">
            <span className="text-[8px] text-red-400 font-bold uppercase">Confirm deletion?</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDeleteEntry(record.id);
              }}
              className="px-2 py-0.5 bg-red-950/20 text-red-400 border border-red-800 rounded text-[8px] font-bold hover:bg-red-900 transition-colors cursor-pointer"
            >
              Delete
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5" id="records-view-dashboard">
      {/* Title view boundary header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-stone-900 pb-3">
        <div>
          <h3 className="text-sm uppercase font-mono font-bold tracking-widest text-stone-400 flex items-center gap-2">
            <FileText className="w-4 h-4 text-stone-500" />
            {filterType === 'all'
              ? 'All Notes & Events'
              : filterType === 'event'
                ? 'Events'
                : 'Notes'}
          </h3>
          <p className="text-xs text-stone-500 font-sans mt-0.5">
            {filterType === 'all'
              ? 'Browse all notes and events ever created across all dates.'
              : filterType === 'event'
                ? 'Browse all scheduled events.'
                : 'Browse all recorded notes.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Search Bar */}
          <div className="relative flex items-center">
            <Search className="absolute left-2.5 w-3.5 h-3.5 text-stone-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search events & notes..."
              className="w-48 pl-7 pr-2.5 py-1.5 text-[11px] font-mono bg-[#0a0a0a] border border-stone-800 rounded-lg text-stone-300 placeholder-stone-600 focus:outline-none focus:border-stone-600 transition-colors"
            />
          </div>

          {/* Type Filter Switcher */}
          <div className="flex items-center gap-1 bg-[#0a0a0a] border border-stone-800 rounded-lg p-0.5 w-fit">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                filterType === 'all'
                  ? 'bg-stone-800 text-stone-200 shadow-sm'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterType('event')}
              className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                filterType === 'event'
                  ? 'bg-indigo-900/60 text-indigo-300 shadow-sm'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Events
            </button>
            <button
              onClick={() => setFilterType('note')}
              className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider rounded-md transition-colors cursor-pointer ${
                filterType === 'note'
                  ? 'bg-blue-900/60 text-blue-300 shadow-sm'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Notes
            </button>
          </div>
        </div>
      </div>

      {sortedAllDays.length > 0 ? (
        <div className="space-y-12">
          {sortedAllDays.map((dayStr) => {
            const dayRecords = allRecordsGrouped[dayStr];
            if (!dayRecords || dayRecords.length === 0) return null;

            return (
              <div key={dayStr} className="space-y-4" id={`historic-day-group-${dayStr}`}>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-stone-950/80 border border-stone-900 rounded-lg">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-xs font-mono font-bold text-stone-400 uppercase tracking-widest">
                    {formatDateStringLabel(dayStr)}
                  </span>
                  <span className="text-[10px] font-mono text-stone-600 ml-1">
                    ({dayRecords.length} records)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dayRecords.map((record) => renderCard(record))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-24 px-6 border border-dashed border-stone-850 rounded-2xl text-center text-stone-500">
          <Sparkles className="w-8 h-8 text-stone-800 mx-auto mb-3" />
          <p className="text-sm font-sans font-medium text-stone-400">
            {searchQuery.trim()
              ? 'No matching results'
              : filterType === 'all'
                ? 'Your Records catalog is empty'
                : filterType === 'event'
                  ? 'No events yet'
                  : 'No notes yet'}
          </p>
          <p className="text-xs font-sans text-stone-600 mt-1 max-w-sm mx-auto">
            {searchQuery.trim()
              ? 'Try a different search term.'
              : filterType === 'all'
                ? 'Once you start creating event and note entries with the input engine below, they will show up here nicely organized by date.'
                : filterType === 'event'
                  ? "Use the input engine to capture events and they'll appear here."
                  : "Use the input engine to record notes and they'll appear here."}
          </p>
        </div>
      )}
    </div>
  );
}
