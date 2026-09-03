import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { UnifiedEntity } from '../../../../../types';

interface MindmapInspectorProps {
  inspectNode: UnifiedEntity | null;
  onClose: () => void;
  onSave: (id: string, updates: { title: string; status: string; content: string }) => Promise<void>;
  onDelete: (entity: UnifiedEntity) => void;
}

export function MindmapInspector({
  inspectNode,
  onClose,
  onSave,
  onDelete,
}: MindmapInspectorProps) {
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editStatus, setEditStatus] = useState('active');

  useEffect(() => {
    if (inspectNode) {
      setEditTitle(inspectNode.title || '');
      setEditContent(inspectNode.content || '');
      setEditStatus(inspectNode.status || 'active');
    }
  }, [inspectNode]);

  if (!inspectNode) return null;

  const handleSave = async () => {
    const trimmed = editTitle.trim();
    if (!trimmed) return;
    await onSave(inspectNode.id, {
      title: trimmed,
      status: editStatus,
      content: editContent,
    });
    onClose();
  };

  return (
    <div className="fixed top-0 right-0 bottom-0 z-50 w-80 sm:w-96 bg-[#121214]/98 backdrop-blur-2xl border-l border-stone-800 shadow-2xl p-5 flex flex-col gap-4 animate-in slide-in-from-right duration-200">
      <div className="flex items-center justify-between border-b border-stone-850 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono uppercase tracking-widest text-amber-400 font-bold">
            {inspectNode.entity_type} Details
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-100 flex items-center justify-center cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto pr-1">
        <div>
          <label className="text-[10px] font-mono uppercase text-stone-400 font-bold block mb-1">
            Title
          </label>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full bg-[#1c1c20] border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-100 focus:border-amber-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase text-stone-400 font-bold block mb-1">
            Status
          </label>
          <select
            value={editStatus}
            onChange={(e) => setEditStatus(e.target.value)}
            className="w-full bg-[#1c1c20] border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none"
          >
            <option value="active">Active</option>
            <option value="todo">Todo</option>
            <option value="done">Done</option>
            <option value="achieved">Achieved</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        <div>
          <label className="text-[10px] font-mono uppercase text-stone-400 font-bold block mb-1">
            Notes & Strategy (Markdown)
          </label>
          <textarea
            rows={8}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            placeholder="Type notes, links, bullet points..."
            className="w-full bg-[#1c1c20] border border-stone-800 rounded-xl p-3 text-xs text-stone-200 font-mono focus:border-amber-500 focus:outline-none resize-none leading-relaxed"
          />
        </div>
      </div>

      <div className="border-t border-stone-850 pt-3 flex items-center justify-between">
        <button
          onClick={() => onDelete(inspectNode)}
          className="text-xs font-mono text-rose-400 hover:text-rose-300 cursor-pointer"
        >
          Delete
        </button>
        <button
          onClick={handleSave}
          className="px-4 py-1.5 rounded-xl text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-black shadow-lg cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );
}
