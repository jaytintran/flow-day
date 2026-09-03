import React, { useState, useEffect } from 'react';
import { Edge } from '@xyflow/react';
import { X, Trash2, Link2 } from 'lucide-react';
import { MindmapEdgeMetadata } from '../types';

interface MindmapEdgeModalProps {
  edge: Edge | null;
  metadata?: MindmapEdgeMetadata;
  onSave: (edgeId: string, metadata: MindmapEdgeMetadata) => void;
  onDelete: (edge: Edge) => void;
  onClose: () => void;
}

export function MindmapEdgeModal({
  edge,
  metadata,
  onSave,
  onDelete,
  onClose,
}: MindmapEdgeModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('');
  const [styleType, setStyleType] = useState<'solid' | 'dashed' | 'dotted' | 'smooth' | 'straight'>('smooth');

  const WIRE_COLORS = [
    { label: 'Amber', value: '#f59e0b' },
    { label: 'Emerald', value: '#10b981' },
    { label: 'Sky', value: '#0284c7' },
    { label: 'Rose', value: '#f43f5e' },
    { label: 'Violet', value: '#8b5cf6' },
    { label: 'Slate', value: '#64748b' },
  ];

  const WIRE_STYLES: Array<{ id: 'smooth' | 'straight' | 'dashed' | 'dotted'; label: string }> = [
    { id: 'smooth', label: 'Smooth Curvy' },
    { id: 'straight', label: 'Straight' },
    { id: 'dashed', label: 'Dashed' },
    { id: 'dotted', label: 'Dotted' },
  ];

  useEffect(() => {
    if (edge) {
      setTitle(metadata?.title || (edge.data as any)?.title || '');
      setDescription(metadata?.description || (edge.data as any)?.description || '');
      setColor(metadata?.color || (edge.data as any)?.strokeColor || '');
      setStyleType(metadata?.styleType || (edge.data as any)?.styleType || 'smooth');
    }
  }, [edge, metadata]);

  if (!edge) return null;

  const handleSave = () => {
    onSave(edge.id, {
      title: title.trim(),
      description: description.trim(),
      color: color || undefined,
      styleType,
    });
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#141417] border border-stone-800 rounded-3xl p-5 w-full max-w-sm shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between border-b border-stone-850 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center">
              <Link2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-stone-100">Connection Wire</h3>
              <p className="text-[10px] font-mono text-stone-400">
                Relationship between branches
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-100 flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-mono uppercase text-stone-400 font-bold block mb-1">
              Connection Label / Title
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Depends on, Contributes to, Part of..."
              className="w-full bg-[#1c1c20] border border-stone-800 focus:border-amber-500 rounded-xl px-3 py-2 text-xs text-stone-100 focus:outline-none shadow-inner"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-stone-400 font-bold block mb-1.5">
              Wire Style
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {WIRE_STYLES.map((ws) => (
                <button
                  key={ws.id}
                  type="button"
                  onClick={() => setStyleType(ws.id)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-mono font-medium border transition-all cursor-pointer ${
                    styleType === ws.id
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300 shadow-sm'
                      : 'bg-[#18181c] border-stone-800 text-stone-400 hover:text-stone-200'
                  }`}
                >
                  {ws.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-stone-400 font-bold block mb-1.5">
              Wire Color
            </label>
            <div className="flex items-center gap-2">
              {WIRE_COLORS.map((wc) => (
                <button
                  key={wc.value}
                  type="button"
                  onClick={() => setColor(wc.value)}
                  style={{ backgroundColor: wc.value }}
                  className={`w-6 h-6 rounded-full cursor-pointer transition-transform ${
                    color === wc.value
                      ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-[#141417]'
                      : 'opacity-70 hover:opacity-100 hover:scale-110'
                  }`}
                  title={wc.label}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] font-mono uppercase text-stone-400 font-bold block mb-1">
              Description / Context
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this connection..."
              className="w-full bg-[#1c1c20] border border-stone-800 focus:border-amber-500 rounded-xl p-2.5 text-xs text-stone-100 focus:outline-none resize-none shadow-inner"
            />
          </div>
        </div>

        <div className="border-t border-stone-850 pt-3 flex items-center justify-between">
          <button
            onClick={() => {
              onDelete(edge);
              onClose();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-bold text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete Wire</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl text-xs font-mono text-stone-400 hover:text-stone-200 cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 rounded-xl text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg cursor-pointer transition-all active:scale-95"
            >
              Save Wire
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
