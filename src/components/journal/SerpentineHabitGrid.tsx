import React, { useRef, useState, useLayoutEffect } from 'react';
import { Repeat2 } from 'lucide-react';
import { HabitLog, TimelineEntry } from '../../types';

interface SerpentineHabitGridProps {
  habitItems: { type: 'standalone'; entry: TimelineEntry }[];
  onOpenDetail: (entry: TimelineEntry) => void;
  formatTime: (date: Date | string | number | undefined) => string;
}

export default function SerpentineHabitGrid({
  habitItems,
  onOpenDetail,
  formatTime,
}: SerpentineHabitGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState<HabitLog[][]>([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const measureAndChunkRows = () => {
      const cardNodes = Array.from(
        container.querySelectorAll<HTMLElement>('[data-habit-measure-id]')
      );
      if (cardNodes.length === 0) return;

      const groupedRows: HabitLog[][] = [];
      let currentRow: HabitLog[] = [];
      let currentTop: number | null = null;

      cardNodes.forEach((node, index) => {
        const top = node.offsetTop;
        const entry = (habitItems[index].entry) as HabitLog;

        if (currentTop === null || Math.abs(top - currentTop) < 6) {
          currentRow.push(entry);
          if (currentTop === null) currentTop = top;
        } else {
          groupedRows.push(currentRow);
          currentRow = [entry];
          currentTop = top;
        }
      });

      if (currentRow.length > 0) {
        groupedRows.push(currentRow);
      }

      setRows(groupedRows);
    };

    measureAndChunkRows();

    const resizeObserver = new ResizeObserver(() => {
      measureAndChunkRows();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [habitItems]);

  if (habitItems.length === 0) return null;

  return (
    <div className="pt-2 pb-1 relative z-10 w-full">
      {/* Section Header */}
      <div className="flex items-center justify-between px-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]" />
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400/90">
            Habits Completed ({habitItems.length})
          </span>
        </div>
        {rows.length > 1 && (
          <span className="text-[9px] font-mono text-stone-500 hidden sm:inline">
            Serpentine flow ⮀
          </span>
        )}
      </div>

      {/* Hidden natural flow measurement container */}
      <div
        ref={containerRef}
        aria-hidden="true"
        className="invisible absolute pointer-events-none -z-50 flex flex-wrap gap-2 px-3 w-full"
      >
        {habitItems.map((item) => {
          const entry = item.entry as HabitLog;
          const emojiMatch = entry.title?.match(
            /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u
          );
          const emoji = emojiMatch ? emojiMatch[0] : null;
          const cleanTitle = emoji
            ? entry.title.replace(emoji, '').trim()
            : entry.title;

          return (
            <div
              key={`measure-${entry.id}`}
              data-habit-measure-id={entry.id}
              className="flex items-center gap-2.5 px-3 py-1.5 border rounded-xl select-none shrink-0"
            >
              <div className="w-6 h-6 rounded-full shrink-0" />
              <div className="flex flex-col min-w-0 pr-1">
                <span className="text-xs font-sans font-semibold whitespace-nowrap">
                  {cleanTitle}
                </span>
                <span className="text-[9px] font-mono">
                  ✔ {formatTime(entry.timestamp)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Visible Serpentine (Boustrophedon) Rows */}
      <div className="flex flex-col gap-2 px-3 w-full">
        {(rows.length > 0 ? rows : [habitItems.map((i) => i.entry as HabitLog)]).map(
          (rowItems, rowIndex) => {
            const isReversed = rowIndex % 2 === 1;

            return (
              <div
                key={`serpentine-row-${rowIndex}`}
                className={`flex flex-wrap items-center gap-2 w-full ${
                  isReversed ? 'flex-row-reverse justify-end' : 'flex-row justify-start'
                }`}
              >
                {rowItems.map((entry) => {
                  const emojiMatch = entry.title?.match(
                    /^(\p{Extended_Pictographic}|\p{Emoji_Presentation})/u
                  );
                  const emoji = emojiMatch ? emojiMatch[0] : null;
                  const cleanTitle = emoji
                    ? entry.title.replace(emoji, '').trim()
                    : entry.title;

                  return (
                    <div
                      key={entry.id}
                      onClick={() => onOpenDetail(entry)}
                      className="group/habit flex items-center gap-2.5 px-3 py-1.5 bg-[#121212] hover:bg-[#181818] border border-emerald-500/20 hover:border-emerald-500/40 rounded-xl transition-all cursor-pointer select-none shrink-0 shadow-sm"
                      title="Click to view details"
                    >
                      {/* Circular Habit Icon */}
                      <div className="w-6 h-6 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                        {emoji ? (
                          <span className="text-xs leading-none">{emoji}</span>
                        ) : (
                          <Repeat2 className="w-3 h-3 text-emerald-400" />
                        )}
                      </div>

                      {/* Title & Done Time (compact pill with natural width) */}
                      <div className="flex flex-col min-w-0 pr-1">
                        <span className="text-xs font-sans font-semibold text-stone-200 group-hover/habit:text-white whitespace-nowrap">
                          {cleanTitle}
                        </span>
                        <span className="text-[9px] font-mono text-emerald-400 font-medium leading-tight">
                          ✔ {formatTime(entry.timestamp)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          }
        )}
      </div>
    </div>
  );
}
