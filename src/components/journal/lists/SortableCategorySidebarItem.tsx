/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	GripVertical,
	MoreHorizontal,
	Palette,
	Edit2,
	Trash2,
} from "lucide-react";
import { Category } from "../../../types";
import CategoryIcon from "../../CategoryIcon";
import InlineIconColorPopover from "../../InlineIconColorPopover";

interface SortableCategorySidebarItemProps {
	category: Category;
	isActive: boolean;
	colorStyle: { active: string; dot: string; glow: string };
	count: number;
	isEditing: boolean;
	editingName: string;
	onStartRename: () => void;
	onRenameChange: (val: string) => void;
	onCommitRename: () => void;
	onCancelRename: () => void;
	onSelect: () => void;
	onUpdateIcon: (icon: string) => void;
	onUpdateColor: (color: Category["color"]) => void;
	onDelete: () => void;
}

export default function SortableCategorySidebarItem({
	category,
	isActive,
	colorStyle,
	count,
	isEditing,
	editingName,
	onStartRename,
	onRenameChange,
	onCommitRename,
	onCancelRename,
	onSelect,
	onUpdateIcon,
	onUpdateColor,
	onDelete,
}: SortableCategorySidebarItemProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({
		id: category.id,
	});

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.35 : 1,
		zIndex: isDragging ? 50 : undefined,
	};

	const [isPopoverOpen, setIsPopoverOpen] = useState(false);
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
	const menuRef = useRef<HTMLDivElement>(null);

	// Close menu on click outside
	useEffect(() => {
		if (!isMenuOpen) return;
		const handleClickOutside = (e: MouseEvent) => {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				setIsMenuOpen(false);
				setIsConfirmingDelete(false);
			}
		};
		document.addEventListener("mousedown", handleClickOutside, true);
		return () => {
			document.removeEventListener("mousedown", handleClickOutside, true);
		};
	}, [isMenuOpen]);

	return (
		<div ref={setNodeRef} style={style} className="flex flex-col relative group/item">
			<div
				onClick={onSelect}
				className={`group relative w-full flex items-center gap-2 px-2.5 py-2 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
					isActive
						? colorStyle.active
						: "bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:border-stone-800 hover:text-stone-200"
				}`}
			>
				{/* Drag Handle on hover */}
				<button
					type="button"
					{...attributes}
					{...listeners}
					onClick={(e) => e.stopPropagation()}
					className="p-0.5 -ml-1 text-stone-600 hover:text-stone-300 opacity-0 group-hover/item:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0"
					title="Drag to reorder category"
				>
					<GripVertical className="w-3.5 h-3.5" />
				</button>

				{/* Icon Button (Opens inline icon + color popover on click) */}
				<div className="relative shrink-0">
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							setIsPopoverOpen(!isPopoverOpen);
						}}
						className="p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex items-center justify-center"
						title="Change icon & color"
					>
						<CategoryIcon
							name={category.icon}
							color={category.color}
							className="w-4 h-4"
							fallback="Tag"
						/>
					</button>

					<InlineIconColorPopover
						isOpen={isPopoverOpen}
						onClose={() => setIsPopoverOpen(false)}
						currentIcon={category.icon}
						currentColor={category.color}
						fallbackIcon="Tag"
						onSelectIcon={onUpdateIcon}
						onSelectColor={onUpdateColor}
					/>
				</div>

				{/* Category Name / Inline Input */}
				<div className="flex-1 min-w-0">
					{isEditing ? (
						<input
							type="text"
							autoFocus
							value={editingName}
							onChange={(e) => onRenameChange(e.target.value)}
							onClick={(e) => e.stopPropagation()}
							onKeyDown={(e) => {
								if (e.key === "Enter") onCommitRename();
								if (e.key === "Escape") onCancelRename();
							}}
							onBlur={onCommitRename}
							className="w-full bg-[#181818] text-[13px] font-medium text-stone-100 border border-stone-600 rounded-md px-1.5 py-0.5 focus:outline-none focus:border-amber-500 shadow-inner"
						/>
					) : (
						<span
							onDoubleClick={(e) => {
								e.stopPropagation();
								onStartRename();
							}}
							className="block text-[13px] font-medium truncate select-none"
							title="Double-click to rename"
						>
							{category.name}
						</span>
					)}
				</div>

				{/* Badge Count & Actions Menu */}
				{!isEditing && (
					<span className="flex items-center gap-1.5 shrink-0">
						{count > 0 && (
							<span
								className={`text-[11px] font-mono font-semibold tabular-nums min-w-[14px] text-center ${
									isActive
										? "text-current opacity-90"
										: "text-stone-500 group-hover:text-stone-400"
								}`}
							>
								{count}
							</span>
						)}

						{/* Action menu trigger (...) */}
						<div className="relative" ref={menuRef}>
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setIsMenuOpen(!isMenuOpen);
									setIsConfirmingDelete(false);
								}}
								className="p-1 rounded-md text-stone-500 hover:text-stone-200 hover:bg-stone-800 opacity-0 group-hover/item:opacity-100 transition-all cursor-pointer"
								title="Category options"
							>
								<MoreHorizontal className="w-3.5 h-3.5" />
							</button>

							{/* Dropdown Menu */}
							{isMenuOpen && (
								<div
									onClick={(e) => e.stopPropagation()}
									className="absolute right-0 top-full mt-1 w-44 bg-[#181818] border border-stone-800 rounded-xl shadow-2xl p-1 z-50 flex flex-col font-sans"
								>
									{!isConfirmingDelete ? (
										<>
											<button
												type="button"
												onClick={() => {
													setIsMenuOpen(false);
													setIsPopoverOpen(true);
												}}
												className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-mono text-stone-300 hover:bg-stone-800 hover:text-stone-100 transition-colors cursor-pointer"
											>
												<Palette className="w-3.5 h-3.5 text-stone-400" />
												<span>Icon & Color</span>
											</button>
											<button
												type="button"
												onClick={() => {
													setIsMenuOpen(false);
													onStartRename();
												}}
												className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-mono text-stone-300 hover:bg-stone-800 hover:text-stone-100 transition-colors cursor-pointer"
											>
												<Edit2 className="w-3.5 h-3.5 text-stone-400" />
												<span>Rename Category</span>
											</button>
											<div className="h-px bg-stone-800 my-1" />
											<button
												type="button"
												onClick={() => setIsConfirmingDelete(true)}
												className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-mono text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
											>
												<Trash2 className="w-3.5 h-3.5" />
												<span>Delete Category</span>
											</button>
										</>
									) : (
										<div className="p-1 space-y-1.5">
											<span className="text-[10px] font-mono text-stone-400 block px-1">
												Delete "{category.name}"? Records become uncategorized.
											</span>
											<div className="flex items-center gap-1.5 pt-0.5">
												<button
													type="button"
													onClick={() => {
														setIsMenuOpen(false);
														setIsConfirmingDelete(false);
														onDelete();
													}}
													className="flex-1 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-mono font-bold uppercase transition-colors cursor-pointer text-center"
												>
													Delete
												</button>
												<button
													type="button"
													onClick={() => setIsConfirmingDelete(false)}
													className="px-2 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-mono transition-colors cursor-pointer"
												>
													Cancel
												</button>
											</div>
										</div>
									)}
								</div>
							)}
						</div>
					</span>
				)}
			</div>
		</div>
	);
}
