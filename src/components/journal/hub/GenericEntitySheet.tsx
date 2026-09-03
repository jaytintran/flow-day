import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db';
import { UnifiedEntity, EntityTypeDefinition } from '../../../types';
import {
  renderLucideIcon,
  COLOR_THEMES,
  LUCIDE_ICONS,
} from './MindmapNodes';
import {
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  ChevronRight,
  X,
  FileText,
  Calendar,
} from 'lucide-react';
import { formatDuration } from '../../../utils';
import MarkdownPreview from '../../MarkdownPreview';

interface GenericEntitySheetProps {
  entityTypeId: string;
  isInline?: boolean;
}

export default function GenericEntitySheet({
  entityTypeId,
  isInline = true,
}: GenericEntitySheetProps) {
  // Query entity types and entities of this type
  const typeDef = useLiveQuery(() => db.entity_types.get(entityTypeId));
  const rawEntities = useLiveQuery(() =>
    db.entities.where('entity_type').equals(entityTypeId).toArray(),
  );

  const entities = useMemo(() => rawEntities || [], [rawEntities]);

  // Local state for adding an entity
  const [newTitle, setNewTitle] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'completed'>('all');

  // Inspector Drawer State
  const [selectedEntity, setSelectedEntity] = useState<UnifiedEntity | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editStatus, setEditStatus] = useState('active');
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const theme =
    COLOR_THEMES[typeDef?.color || 'indigo'] || COLOR_THEMES.indigo;

  // Filtered List
  const filteredEntities = useMemo(() => {
    return entities.filter((e) => {
      const isCompleted = e.status === 'done' || e.status === 'achieved';
      if (filterStatus === 'active') return !isCompleted;
      if (filterStatus === 'completed') return isCompleted;
      return true;
    });
  }, [entities, filterStatus]);

  // Create Entity
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTitle.trim();
    if (!trimmed || !typeDef) return;

    const newId = crypto.randomUUID();
    const defaultInitialStatus =
      entityTypeId === 'objective'
        ? 'todo'
        : typeDef.has_status
          ? 'active'
          : undefined;

    await db.entities.add({
      id: newId,
      entity_type: entityTypeId,
      title: trimmed,
      icon: selectedIcon || typeDef.icon || 'Target',
      color: typeDef.color,
      status: defaultInitialStatus,
      time_spent: 0,
      parent_ids: [],
      created_at: new Date(),
    });

    setNewTitle('');
  };

  // Open Drawer
  const openInspector = (entity: UnifiedEntity) => {
    setSelectedEntity(entity);
    setEditTitle(entity.title);
    setEditContent(entity.content || '');
    setEditStatus(entity.status || 'active');
  };

  // Save Edit
  const handleSaveEdit = async () => {
    if (!selectedEntity) return;
    const trimmed = editTitle.trim();
    if (!trimmed) return;

    await db.entities.update(selectedEntity.id, {
      title: trimmed,
      content: editContent,
      status: editStatus,
    });

    setSelectedEntity((prev) =>
      prev ? { ...prev, title: trimmed, content: editContent, status: editStatus } : null,
    );
  };

  // Delete Entity
  const handleDelete = async (id: string) => {
    if (confirm('Delete this item and remove it from your system?')) {
      await db.entities.delete(id);
      if (selectedEntity?.id === id) {
        setSelectedEntity(null);
      }
    }
  };

  if (!typeDef) {
    return (
      <div className="p-8 text-center text-xs font-mono text-stone-500">
        Loading entity workspace...
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col space-y-4 px-3 py-2 max-w-2xl mx-auto">
      {/* Header Info */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-xl flex items-center justify-center border ${theme.iconBg} ${theme.iconBorder} ${theme.iconText}`}
          >
            {renderLucideIcon(typeDef.icon, 'Target', 'w-4 h-4')}
          </div>
          <div>
            <h2 className="text-sm font-bold text-stone-100 flex items-center gap-1.5">
              <span>{typeDef.plural_name || `${typeDef.name}s`}</span>
              <span className="text-xs font-mono text-stone-500 font-normal">
                ({entities.length})
              </span>
            </h2>
            <p className="text-[10px] font-mono text-stone-400">
              {typeDef.is_system ? 'Built-in System Entity' : 'Custom Entity Type'}
            </p>
          </div>
        </div>

        {/* Filter Pills */}
        {typeDef.has_status && (
          <div className="flex items-center gap-1 bg-[#121212] p-1 rounded-xl border border-stone-800 text-[10px] font-mono font-bold">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2 py-0.5 rounded-lg transition-colors ${
                filterStatus === 'all'
                  ? 'bg-stone-800 text-stone-100'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-2 py-0.5 rounded-lg transition-colors ${
                filterStatus === 'active'
                  ? `${theme.badgeBg} ${theme.badgeText}`
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilterStatus('completed')}
              className={`px-2 py-0.5 rounded-lg transition-colors ${
                filterStatus === 'completed'
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-stone-500 hover:text-stone-300'
              }`}
            >
              Done
            </button>
          </div>
        )}
      </div>

      {/* Creation Input Form */}
      <form onSubmit={handleAdd} className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-[#141416] border border-stone-800 focus-within:border-amber-500/50 rounded-xl px-3 py-2 shadow-inner">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder={`Add a new ${typeDef.name.toLowerCase()}...`}
            className="w-full bg-transparent text-xs text-stone-100 placeholder-stone-600 focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={!newTitle.trim()}
          className={`px-3 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${theme.badgeBg} ${theme.badgeText} border ${theme.badgeBorder}`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add</span>
        </button>
      </form>

      {/* List of Entities */}
      <div className="space-y-2 flex-1 overflow-y-auto pr-0.5 pb-8">
        {filteredEntities.length === 0 ? (
          <div className="p-8 text-center border border-dashed border-stone-850 rounded-2xl">
            <p className="text-xs font-mono text-stone-500">
              No {typeDef.name.toLowerCase()} items found.
            </p>
          </div>
        ) : (
          filteredEntities.map((entity) => {
            const isCompleted =
              entity.status === 'done' || entity.status === 'achieved';

            return (
              <div
                key={entity.id}
                onClick={() => openInspector(entity)}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer bg-gradient-to-br ${
                  isCompleted
                    ? 'from-[#0a1510]/60 to-[#060e0a]/60 border-emerald-500/30 opacity-75'
                    : `from-[#141416] to-[#0f0f10] border-stone-800 hover:border-stone-700`
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {typeDef.has_status ? (
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        const nextStatus = isCompleted
                          ? entityTypeId === 'objective'
                            ? 'todo'
                            : 'active'
                          : entityTypeId === 'goal'
                            ? 'achieved'
                            : 'done';
                        await db.entities.update(entity.id, { status: nextStatus });
                      }}
                      className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all cursor-pointer shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                          : 'bg-stone-900 border-stone-750 text-stone-500 hover:border-stone-500'
                      }`}
                    >
                      {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                  ) : (
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center border shrink-0 ${theme.iconBg} ${theme.iconBorder} ${theme.iconText}`}
                    >
                      {renderLucideIcon(entity.icon || typeDef.icon, 'Target', 'w-3 h-3')}
                    </div>
                  )}

                  <div className="min-w-0">
                    <span
                      className={`text-xs font-semibold block leading-relaxed break-words whitespace-normal ${
                        isCompleted ? 'text-stone-400 line-through' : 'text-stone-200'
                      }`}
                    >
                      {entity.title}
                    </span>
                    {entity.content && (
                      <span className="text-[10px] text-stone-500 truncate block mt-0.5">
                        {entity.content.slice(0, 70)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {entity.time_spent ? (
                    <span className="text-[9px] font-mono text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                      ⏳ {formatDuration(entity.time_spent)}
                    </span>
                  ) : null}
                  <ChevronRight className="w-3.5 h-3.5 text-stone-600" />
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Inspector Drawer (Mobile Friendly Bottom Sheet) */}
      {selectedEntity && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm p-0 md:p-4">
          <div className="bg-[#141416] border-t md:border border-stone-800 rounded-t-3xl md:rounded-3xl p-4 w-full max-w-lg max-h-[85vh] flex flex-col shadow-2xl space-y-4 animate-in slide-in-from-bottom duration-200">
            <div className="flex items-center justify-between border-b border-stone-850 pb-3">
              <span
                className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-lg border ${theme.badgeBg} ${theme.badgeText} ${theme.badgeBorder}`}
              >
                {typeDef.name} Details
              </span>
              <button
                onClick={() => setSelectedEntity(null)}
                className="w-7 h-7 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto">
              <div className="space-y-1">
                <label className="text-[9px] font-mono text-stone-400 uppercase font-bold block">
                  Title
                </label>
                <textarea
                  rows={Math.min(4, Math.max(1, Math.ceil((editTitle || '').length / 28)))}
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onBlur={handleSaveEdit}
                  className="w-full bg-[#1a1a1c] border border-stone-800 rounded-xl px-3 py-2 text-xs font-bold text-stone-100 focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed"
                />
              </div>

              {typeDef.has_status && (
                <div className="space-y-1">
                  <label className="text-[9px] font-mono text-stone-400 uppercase font-bold block">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => {
                      setEditStatus(e.target.value);
                      setTimeout(handleSaveEdit, 50);
                    }}
                    className="w-full bg-[#1a1a1c] border border-stone-800 rounded-xl px-3 py-2 text-xs font-mono text-amber-300 focus:outline-none font-bold"
                  >
                    <option value="active">Active</option>
                    <option value="todo">In Progress</option>
                    <option value="done">Done / Completed</option>
                    <option value="achieved">Achieved Milestone</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[9px] font-mono text-stone-400 uppercase font-bold flex items-center gap-1">
                    <FileText className="w-3 h-3 text-amber-400" />
                    <span>Notes & Strategy (Markdown)</span>
                  </label>
                  {isEditingNotes ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingNotes(false);
                        handleSaveEdit();
                      }}
                      className="text-[9px] font-mono text-amber-400 hover:text-amber-300 font-bold"
                    >
                      Done
                    </button>
                  ) : (
                    <span className="text-[9px] font-mono text-stone-500">
                      Tap to edit
                    </span>
                  )}
                </div>

                {isEditingNotes ? (
                  <textarea
                    autoFocus
                    rows={6}
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    onBlur={() => {
                      setIsEditingNotes(false);
                      handleSaveEdit();
                    }}
                    placeholder="Write your notes, strategy, or ideas here..."
                    className="w-full bg-[#1a1a1c] border border-amber-500/50 rounded-xl p-3 text-xs text-stone-200 font-sans focus:outline-none resize-none"
                  />
                ) : (
                  <div
                    onClick={() => setIsEditingNotes(true)}
                    className="w-full bg-[#1a1a1c] border border-stone-800 hover:border-stone-700 rounded-xl p-3 min-h-[6rem] cursor-pointer"
                  >
                    <MarkdownPreview
                      text={editContent}
                      placeholder="Tap to add notes and strategy (Markdown supported)..."
                      onClick={() => setIsEditingNotes(true)}
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-stone-850">
              <button
                type="button"
                onClick={() => handleDelete(selectedEntity.id)}
                className="flex items-center gap-1.5 text-xs font-mono text-rose-400 hover:bg-rose-500/10 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete</span>
              </button>

              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-stone-950 rounded-xl text-xs font-mono font-bold transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
