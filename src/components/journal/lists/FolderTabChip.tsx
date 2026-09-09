/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
	Folder,
	MoreHorizontal,
	Edit2,
	Palette,
	Trash2,
	Check,
} from "lucide-react";
import { ListFolder } from "../../../types";
import { AnimatePresence, motion } from "motion/react";

const FOLDER_COLOR_MAP: Record<
	string,
	{ dot: string; border: string; text: string; bgActive: string }
> = {
	amber: {
		dot: "bg-amber-400",
		border: "border-amber-500/40",
		text: "text-amber-300",
		bgActive:
			"bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
	},
	emerald: {
		dot: "bg-emerald-400",
		border: "border-emerald-500/40",
		text: "text-emerald-300",
		bgActive:
			"bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
	},
	sky: {
		dot: "bg-sky-400",
		border: "border-sky-500/40",
		text: "text-sky-300",
		bgActive:
			"bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.15)]",
	},
	violet: {
		dot: "bg-violet-400",
		border: "border-violet-500/40",
		text: "text-violet-300",
		bgActive:
			"bg-violet-500/15 border-violet-500/40 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.15)]",
	},
	rose: {
		dot: "bg-rose-400",
		border: "border-rose-500/40",
		text: "text-rose-300",
		bgActive:
			"bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]",
	},
	teal: {
		dot: "bg-teal-400",
		border: "border-teal-500/40",
		text: "text-teal-300",
		bgActive:
			"bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.15)]",
	},
	orange: {
		dot: "bg-orange-400",
		border: "border-orange-500/40",
		text: "text-orange-300",
		bgActive:
			"bg-orange-500/15 border-orange-500/40 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.15)]",
	},
	indigo: {
		dot: "bg-indigo-400",
		border: "border-indigo-500/40",
		text: "text-indigo-300",
		bgActive:
			"bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]",
	},
};

const COLOR_OPTIONS = [
	"amber",
	"emerald",
	"sky",
	"violet",
	"rose",
	"teal",
	"orange",
	"indigo",
];

interface FolderTabChipProps {
	folder: ListFolder;
	isActive: boolean;
	count: number;
	onSelect: () => void;
	onRename: (folderId: string, newName: string) => void;
	onChangeColor: (folderId: string, newColor: string) => void;
	onDelete: (folderId: string) => void;
}

export default function FolderTabChip({
	folder,
	isActive,
	count,
	onSelect,
	onRename,
	onChangeColor,
	onDelete,
}: FolderTabChipProps) {
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
	const [isEditing, setIsEditing] = useState(false);
	const [nameDraft, setNameDraft] = useState(folder.name);
	const [showColorPicker, setShowColorPicker] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const chipRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);

	const { setNodeRef, isOver } = useDroppable({
		id: `folder-tab-drop-${folder.id}`,
		data: { folderId: folder.id },
	});

	const colorKey = folder.color || "amber";
	const colorTheme = FOLDER_COLOR_MAP[colorKey] ?? FOLDER_COLOR_MAP.amber;

	useEffect(() => {
		if (isEditing) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isEditing]);

	// Close menu on outside click
	useEffect(() => {
		if (!isMenuOpen) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setIsMenuOpen(false);
				setShowColorPicker(false);
				setConfirmDelete(false);
			}
		};
		window.addEventListener("mousedown", handleClickOutside);
		return () => window.removeEventListener("mousedown", handleClickOutside);
	}, [isMenuOpen]);

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setMenuPos({ x: e.clientX, y: e.clientY });
		setIsMenuOpen(true);
		setShowColorPicker(false);
		setConfirmDelete(false);
	};

	const handleOpenMenuBtn = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		if (chipRef.current) {
			const rect = chipRef.current.getBoundingClientRect();
			setMenuPos({ x: rect.left, y: rect.bottom + 6 });
		}
		setIsMenuOpen((prev) => !prev);
		setShowColorPicker(false);
		setConfirmDelete(false);
	};

	const commitRename = () => {
		setIsEditing(false);
		const trimmed = nameDraft.trim();
		if (trimmed && trimmed !== folder.name) {
			onRename(folder.id, trimmed);
		} else {
			setNameDraft(folder.name);
		}
	};

	return (
		<div
			ref={(node) => {
				setNodeRef(node);
				(chipRef as any).current = node;
			}}
			onContextMenu={handleContextMenu}
			className={`relative group inline-flex items-center rounded-xl transition-all duration-150 select-none shrink-0 ${
				isOver
					? "ring-2 ring-amber-400 bg-amber-500/25 scale-[1.03] shadow-lg shadow-amber-500/20"
					: ""
			}`}
		>
			{isEditing ? (
				<div className="flex items-center gap-1.5 px-2 py-1 bg-[#141414] border border-amber-500/60 rounded-xl">
					<Folder className={`w-3.5 h-3.5 ${colorTheme.text}`} />
					<input
						ref={inputRef}
						type="text"
						value={nameDraft}
						onChange={(e) => setNameDraft(e.target.value)}
						onBlur={commitRename}
						onKeyDown={(e) => {
							if (e.key === "Enter" || e.key === "Escape") commitRename();
						}}
						className="bg-transparent text-[11px] font-mono font-bold text-stone-100 focus:outline-none w-28"
					/>
				</div>
			) : (
				<button
					type="button"
					onClick={onSelect}
					className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-semibold transition-all cursor-pointer border ${
						isActive
							? colorTheme.bgActive
							: "bg-white/[0.03] border-white/[0.08] text-stone-400 hover:text-stone-200 hover:bg-white/[0.06] hover:border-white/[0.15]"
					}`}
					title={`${folder.name} (${count} items) — Right-click to manage`}
				>
					<span className={`w-1.5 h-1.5 rounded-full ${colorTheme.dot} shrink-0`} />
					<Folder className={`w-3 h-3 ${isActive ? colorTheme.text : "text-stone-400"} shrink-0`} />
					{isOver ? (
						<span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-500/35 px-1.5 py-0.2 rounded animate-pulse">
							+ Move
						</span>
					) : (
						<span
							className={`text-[9px] font-mono font-bold tabular-nums ml-0.5 px-1 py-0.2 rounded-md ${
								isActive
									? "bg-white/10 text-white"
									: "bg-stone-800 text-stone-400"
							}`}
						>
							{count}
						</span>
					)}

					{/* Hover Trigger for Menu */}
					<span
						onClick={handleOpenMenuBtn}
						className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-stone-700/60 text-stone-400 hover:text-stone-100 transition-opacity ml-0.5"
						title="Folder options"
					>
						<MoreHorizontal className="w-3 h-3" />
					</span>
				</button>
			)}

			{/* Floating Context Menu */}
			<AnimatePresence>
				{isMenuOpen && menuPos && (
					<motion.div
						ref={menuRef}
						initial={{ opacity: 0, scale: 0.95, y: -4 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: -4 }}
						transition={{ duration: 0.12 }}
						style={{
							position: "fixed",
							top: Math.min(menuPos.y, window.innerHeight - 220),
							left: Math.min(menuPos.x, window.innerWidth - 200),
							zIndex: 1200,
						}}
						className="w-48 bg-[#141414]/95 border border-stone-800 rounded-xl shadow-2xl p-1.5 backdrop-blur-xl font-mono text-xs select-none"
					>
						<div className="px-2 py-1 border-b border-stone-800/80 mb-1">
							<span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider truncate block">
								{folder.name}
							</span>
						</div>

						{/* Rename */}
						<button
							type="button"
							onClick={() => {
								setIsMenuOpen(false);
								setNameDraft(folder.name);
								setIsEditing(true);
							}}
							className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-stone-300 hover:bg-stone-800 hover:text-white transition-colors cursor-pointer text-left text-[11px]"
						>
							<Edit2 className="w-3.5 h-3.5 text-stone-400" />
							<span>Rename Folder</span>
						</button>

						{/* Color Picker Toggle */}
						<button
							type="button"
							onClick={() => setShowColorPicker(!showColorPicker)}
							className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-stone-300 hover:bg-stone-800 hover:text-white transition-colors cursor-pointer text-left text-[11px]"
						>
							<div className="flex items-center gap-2">
								<Palette className="w-3.5 h-3.5 text-stone-400" />
								<span>Change Color</span>
							</div>
							<span className={`w-2.5 h-2.5 rounded-full ${colorTheme.dot}`} />
						</button>

						{/* Palette list */}
						{showColorPicker && (
							<div className="grid grid-cols-4 gap-1 p-1.5 my-1 bg-stone-900/90 rounded-lg border border-stone-800">
								{COLOR_OPTIONS.map((c) => {
									const itemTheme = FOLDER_COLOR_MAP[c];
									const isCurrent = colorKey === c;
									return (
										<button
											key={c}
											type="button"
											onClick={() => {
												onChangeColor(folder.id, c);
												setShowColorPicker(false);
												setIsMenuOpen(false);
											}}
											className={`h-6 rounded flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${
												itemTheme.dot
											} ${isCurrent ? "ring-2 ring-white ring-offset-1 ring-offset-stone-900" : ""}`}
											title={c}
										>
											{isCurrent && <Check className="w-3 h-3 text-stone-950 stroke-[3]" />}
										</button>
									);
								})}
							</div>
						)}

						{/* Delete */}
						<div className="pt-1 border-t border-stone-800/80 mt-1">
							{confirmDelete ? (
								<div className="flex items-center gap-1 p-1 bg-red-950/60 border border-red-900/50 rounded-lg">
									<button
										type="button"
										onClick={() => {
											onDelete(folder.id);
											setIsMenuOpen(false);
										}}
										className="flex-1 px-2 py-1 rounded bg-red-500 text-stone-950 text-[10px] font-bold uppercase hover:bg-red-400 transition-colors cursor-pointer text-center"
									>
										Confirm Delete
									</button>
									<button
										type="button"
										onClick={() => setConfirmDelete(false)}
										className="px-1.5 py-1 text-stone-400 hover:text-white text-[10px] cursor-pointer"
									>
										Cancel
									</button>
								</div>
							) : (
								<button
									type="button"
									onClick={() => setConfirmDelete(true)}
									className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-red-400 hover:bg-red-950/40 hover:text-red-300 transition-colors cursor-pointer text-left text-[11px]"
								>
									<Trash2 className="w-3.5 h-3.5" />
									<span>Delete Folder</span>
								</button>
							)}
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}
