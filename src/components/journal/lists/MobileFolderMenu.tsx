/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Folder,
  Palette,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { ListFolder } from "../../../types";
import { FOLDER_COLOR_OPTIONS, getFolderTheme } from "./folderColors";

interface MobileFolderMenuProps {
  folders: ListFolder[];
  selectedFolderTab: string;
  /** folderId -> item count */
  counts: Record<string, number>;
  onSelectFolderTab: (tabId: string) => void;
  onCreateFolder: () => void;
  onRenameFolder: (folderId: string, newName: string) => void;
  onChangeFolderColor: (folderId: string, newColor: string) => void;
  onDeleteFolder: (folderId: string) => void;
  /** Reorder inside the folder strip (-1 = earlier, 1 = later) */
  onMoveFolder: (folderId: string, direction: -1 | 1) => void;
  onClose: () => void;
}

/**
 * Mobile folder manager surfaced from the folder strip dropdown.
 * Everything a desktop user can do — filter, rename, recolor, reorder, delete —
 * is reachable here with 44px tap targets and an explicit delete confirmation.
 */
export default function MobileFolderMenu({
  folders,
  selectedFolderTab,
  counts,
  onSelectFolderTab,
  onCreateFolder,
  onRenameFolder,
  onChangeFolderColor,
  onDeleteFolder,
  onMoveFolder,
  onClose,
}: MobileFolderMenuProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [paletteId, setPaletteId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const startRename = (folder: ListFolder) => {
    setPaletteId(null);
    setConfirmDeleteId(null);
    setDraftName(folder.name);
    setRenamingId(folder.id);
  };

  const commitRename = (folder: ListFolder) => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== folder.name) {
      onRenameFolder(folder.id, trimmed);
    }
    setRenamingId(null);
  };

  return (
    <div className="font-mono select-none">
      {/* Header */}
      <div className="px-2.5 py-2 border-b border-stone-800/80 flex items-center justify-between">
        <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider">
          Folders ({folders.length})
        </span>
        <button
          type="button"
          onClick={onCreateFolder}
          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-amber-400 hover:text-amber-300 bg-amber-500/10 border border-amber-500/30 font-bold cursor-pointer"
          aria-label="Create new folder"
        >
          <Plus className="w-3 h-3" />
          <span>New</span>
        </button>
      </div>

      <div className="py-1 space-y-0.5">
        {folders.map((folder, index) => {
          const theme = getFolderTheme(folder.color);
          const isSelected = selectedFolderTab === folder.id;
          const isExpanded = expandedId === folder.id;
          const isRenaming = renamingId === folder.id;
          const isDeleteArmed = confirmDeleteId === folder.id;
          const count = counts[folder.id] ?? 0;

          return (
            <div
              key={folder.id}
              className={`rounded-xl border transition-colors ${
                isSelected
                  ? "border-white/15 bg-white/[0.06]"
                  : "border-transparent"
              }`}
            >

              {/* Row 1: select + manage */}
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    onSelectFolderTab(folder.id);
                    onClose();
                  }}
                  className={`flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2.5 rounded-l-xl text-left text-xs cursor-pointer ${
                    isSelected
                      ? `${theme.text} font-bold`
                      : "text-stone-300 hover:bg-stone-800/70 hover:text-white"
                  }`}
                  aria-current={isSelected ? "true" : undefined}
                  aria-label={`Show folder ${folder.name}, ${count} items`}
                >
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${theme.dot}`}
                  />
                  <Folder className={`w-3.5 h-3.5 shrink-0 ${theme.text}`} />
                  <span className="truncate flex-1">{folder.name}</span>
                  <span
                    className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-md ${
                      isSelected
                        ? "bg-white/15 text-white"
                        : "bg-stone-800 text-stone-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((prev) =>
                      prev === folder.id ? null : folder.id,
                    )
                  }
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-r-xl text-stone-400 hover:text-white hover:bg-stone-800/70 cursor-pointer"
                  title={`Manage ${folder.name}`}
                  aria-label={`Manage folder ${folder.name}`}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              </div>
              {/* Row 2: management panel */}
              {isExpanded && (
                <div className="px-2.5 pb-2.5 pt-1.5 space-y-2 border-t border-stone-800/60">
                  {/* Rename */}
                  {isRenaming ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        autoFocus
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename(folder);
                          if (e.key === "Escape") {
                            e.preventDefault();
                            e.stopPropagation();
                            setRenamingId(null);
                          }
                        }}
                        className="flex-1 min-w-0 min-h-[40px] bg-[#0a0a0a] border border-stone-700 rounded-lg px-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500/60"
                        aria-label={`Rename folder ${folder.name}`}
                      />
                      <button
                        type="button"
                        onClick={() => commitRename(folder)}
                        className="min-w-[44px] min-h-[40px] flex items-center justify-center rounded-lg bg-amber-500 text-stone-950 hover:bg-amber-400 cursor-pointer"
                        aria-label="Save folder name"
                      >
                        <Check className="w-4 h-4 stroke-[3]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenamingId(null)}
                        className="min-w-[44px] min-h-[40px] flex items-center justify-center rounded-lg border border-stone-700 text-stone-400 hover:text-white cursor-pointer"
                        aria-label="Cancel rename"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => startRename(folder)}
                      className="w-full min-h-[40px] flex items-center gap-2 px-2.5 rounded-lg bg-stone-900/70 border border-stone-800 text-stone-300 hover:text-white hover:border-stone-700 text-[11px] cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5 text-stone-400" />
                      <span>Rename folder</span>
                    </button>
                  )}

                  {/* Color */}
                  <button
                    type="button"
                    onClick={() =>
                      setPaletteId((prev) =>
                        prev === folder.id ? null : folder.id,
                      )
                    }
                    className="w-full min-h-[40px] flex items-center justify-between px-2.5 rounded-lg bg-stone-900/70 border border-stone-800 text-stone-300 hover:text-white hover:border-stone-700 text-[11px] cursor-pointer"
                    aria-expanded={paletteId === folder.id}
                  >
                    <span className="flex items-center gap-2">
                      <Palette className="w-3.5 h-3.5 text-stone-400" />
                      <span>Folder color</span>
                    </span>
                    <span
                      className={`w-3 h-3 rounded-full ${theme.dot} ring-1 ring-white/20`}
                    />
                  </button>


                  {paletteId === folder.id && (
                    <div className="grid grid-cols-4 gap-1.5 p-1.5 bg-stone-950/70 rounded-lg border border-stone-800">
                      {FOLDER_COLOR_OPTIONS.map((c) => {
                        const isCurrent = (folder.color || "amber") === c;
                        return (
                          <button
                            key={c}
                            type="button"
                            onClick={() => onChangeFolderColor(folder.id, c)}
                            className={`min-h-[36px] rounded-md flex items-center justify-center cursor-pointer ${
                              getFolderTheme(c).dot
                            } ${
                              isCurrent
                                ? "ring-2 ring-white ring-offset-1 ring-offset-stone-900"
                                : ""
                            }`}
                            title={c}
                            aria-label={`Set folder color: ${c}`}
                            aria-pressed={isCurrent}
                          >
                            {isCurrent && (
                              <Check className="w-3.5 h-3.5 text-stone-950 stroke-[3]" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* Reorder */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => onMoveFolder(folder.id, -1)}
                      className="min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg bg-stone-900/70 border border-stone-800 text-[11px] text-stone-300 hover:text-white hover:border-stone-700 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                      aria-label={`Move folder ${folder.name} earlier`}
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                      <span>Move up</span>
                    </button>
                    <button
                      type="button"
                      disabled={index === folders.length - 1}
                      onClick={() => onMoveFolder(folder.id, 1)}
                      className="min-h-[40px] flex items-center justify-center gap-1.5 rounded-lg bg-stone-900/70 border border-stone-800 text-[11px] text-stone-300 hover:text-white hover:border-stone-700 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
                      aria-label={`Move folder ${folder.name} later`}
                    >
                      <ChevronDown className="w-3.5 h-3.5" />
                      <span>Move down</span>
                    </button>
                  </div>

                  {/* Delete — destructive, isolated, explicit confirm */}
                  <div className="pt-1.5 border-t border-stone-800/70">
                    {isDeleteArmed ? (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-rose-300/90 leading-snug">
                          Delete "{folder.name}"? Its items move back to General.
                        </p>
                        <div className="grid grid-cols-2 gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteFolder(folder.id);
                              setConfirmDeleteId(null);
                              setExpandedId(null);
                            }}
                            className="min-h-[40px] rounded-lg bg-rose-500 text-stone-950 text-[11px] font-bold uppercase tracking-wider hover:bg-rose-400 cursor-pointer"
                            aria-label={`Confirm delete folder ${folder.name}`}
                          >
                            Confirm Delete
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(null)}
                            className="min-h-[40px] rounded-lg border border-stone-700 text-stone-300 hover:text-white text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setPaletteId(null);
                          setConfirmDeleteId(folder.id);
                        }}
                        className="w-full min-h-[40px] flex items-center gap-2 px-2.5 rounded-lg bg-rose-950/40 border border-rose-900/50 text-rose-300 hover:bg-rose-900/50 hover:text-rose-200 text-[11px] cursor-pointer"
                        aria-label={`Delete folder ${folder.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete folder</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-2.5 py-2 border-t border-stone-800/80">
        <p className="text-[10px] text-stone-600 leading-snug">
          Tap a folder to filter by it. Use the arrow to rename, recolor, reorder
          or delete.
        </p>
      </div>
    </div>
  );
}

