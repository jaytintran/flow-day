/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
	useState,
	useMemo,
	useEffect,
} from "react";
import {
	Search,
	ClipboardList,
	ChevronDown,
	X,
	Trophy,
	Folder,
	FolderPlus,
	MoreHorizontal,
	Inbox,
	Layers,
	ListTodo,
	Check,
} from "lucide-react";
import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
	useDroppable,
} from "@dnd-kit/core";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	verticalListSortingStrategy,
	arrayMove,
} from "@dnd-kit/sortable";
import { AnimatePresence, motion } from "motion/react";
import { db } from "../../db";
import {
	TimelineEntry,
	Task,
	Category,
	ListFolder,
} from "../../types";
import { useLiveQuery } from "dexie-react-hooks";
import TaskListManagerModal from "../TaskListManagerModal";
import CategoryIcon from "../CategoryIcon";
import EntryContextMenu from "../EntryContextMenu";
import { TASK_LIST_SCOPE } from "../../utils";

// Subcomponents
import TaskStatusPickerPopover from "./lists/TaskStatusPickerPopover";
import ScheduleCalendarModal from "./lists/ScheduleCalendarModal";
import ListPickerPopover from "./lists/ListPickerPopover";
import MoveToFolderModal from "./lists/MoveToFolderModal";
import MobileTaskItem from "./lists/MobileTaskItem";
import DesktopTaskCard from "./lists/DesktopTaskCard";
import FolderCard from "./lists/FolderCard";
import TrophyView from "./lists/TrophyView";
import PaperListView from "./lists/PaperListView";

interface ListsViewProps {
	entries: TimelineEntry[];
	deletingId: string | null;
	activeTaskId: string | null;
	setActiveDate: (date: Date) => void;
	onDeleteEntry: (id: string) => void;
	onOpenDetail: (entry: TimelineEntry) => void;
	onToggleTaskStatus: (task: Task) => void;
	onActivateTask: (taskId: string) => void;
	onCarryTask: (taskId: string, targetDate: Date) => void;
	formatTime: (dateInput: Date | string) => string;
	formatDateStringLabel: (dayStr: string) => string;
}

const LIST_COLORS: Record<
	string,
	{ active: string; dot: string; glow: string }
> = {
	violet: {
		active: "bg-violet-500/15 border-violet-500/40 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.15)]",
		dot: "bg-violet-500",
		glow: "text-violet-400",
	},
	emerald: {
		active: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
		dot: "bg-emerald-500",
		glow: "text-emerald-400",
	},
	sky: {
		active: "bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.15)]",
		dot: "bg-sky-500",
		glow: "text-sky-400",
	},
	rose: {
		active: "bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]",
		dot: "bg-rose-500",
		glow: "text-rose-400",
	},
	amber: {
		active: "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
		dot: "bg-amber-500",
		glow: "text-amber-400",
	},
	teal: {
		active: "bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.15)]",
		dot: "bg-teal-500",
		glow: "text-teal-400",
	},
	indigo: {
		active: "bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]",
		dot: "bg-indigo-500",
		glow: "text-indigo-400",
	},
	orange: {
		active: "bg-orange-500/15 border-orange-500/40 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.15)]",
		dot: "bg-orange-500",
		glow: "text-orange-400",
	},
};

const STATUS_GROUPS: Array<{
	key: string;
	label: string;
	dotColor: string;
	textColor: string;
	filterFn: (t: Task) => boolean;
}> = [
	{
		key: "in_progress",
		label: "In Progress",
		dotColor: "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]",
		textColor: "text-amber-300",
		filterFn: (t) => t.status === "in_progress",
	},
	{
		key: "todo",
		label: "To Do",
		dotColor: "bg-stone-400",
		textColor: "text-stone-300",
		filterFn: (t) => t.status === "todo" || !t.status,
	},
	{
		key: "maybe",
		label: "Maybe / Later",
		dotColor: "bg-indigo-400 shadow-[0_0_6px_rgba(129,140,248,0.5)]",
		textColor: "text-indigo-300",
		filterFn: (t) => t.status === "maybe",
	},
	{
		key: "done",
		label: "Completed",
		dotColor: "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]",
		textColor: "text-emerald-300",
		filterFn: (t) => t.status === "done",
	},
	{
		key: "dropped",
		label: "Dropped",
		dotColor: "bg-rose-400 shadow-[0_0_6px_rgba(244,63,94,0.5)]",
		textColor: "text-rose-300",
		filterFn: (t) => t.status === "dropped",
	},
];

export default function ListsView({
	entries,
	deletingId,
	activeTaskId,
	setActiveDate,
	onDeleteEntry,
	onOpenDetail,
	onToggleTaskStatus,
	onActivateTask,
	onCarryTask,
	formatTime,
	formatDateStringLabel,
}: ListsViewProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const showContent =
		localStorage.getItem("flowday_show_note_event_content") !== "false";

	// 6-status switcher: 'all' | 'todo' | 'in_progress' | 'done' | 'dropped' | 'maybe'
	const [statusFilter, setStatusFilter] = useState<
		"all" | "todo" | "in_progress" | "done" | "dropped" | "maybe"
	>(() => {
		const saved = localStorage.getItem("flowday-tasks-status-filter");
		if (
			saved === "all" ||
			saved === "todo" ||
			saved === "in_progress" ||
			saved === "done" ||
			saved === "dropped" ||
			saved === "maybe"
		) {
			return saved;
		}
		return "all";
	});

	// Selected View / List ID: 'all' | 'unassigned' | 'paper' | 'trophy' | categoryId
	const [selectedView, setSelectedView] = useState<string>(() => {
		return localStorage.getItem("flowday-tasks-selected-list") ?? "all";
	});

	const [isListManagerOpen, setIsListManagerOpen] = useState(false);

	// Mobile UI States
	const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
	const [isMobileViewSheetOpen, setIsMobileViewSheetOpen] = useState(false);
	const [isMobileStatusSheetOpen, setIsMobileStatusSheetOpen] = useState(false);

	// Single active swiped task row controller (auto-closes others)
	const [activeSwipedTaskId, setActiveSwipedTaskId] = useState<string | null>(
		null,
	);

	useEffect(() => {
		const handleGlobalClick = () => {
			if (activeSwipedTaskId) setActiveSwipedTaskId(null);
		};
		const handleScroll = () => {
			if (activeSwipedTaskId) setActiveSwipedTaskId(null);
		};
		window.addEventListener("scroll", handleScroll, { passive: true });
		window.addEventListener("click", handleGlobalClick);
		return () => {
			window.removeEventListener("scroll", handleScroll);
			window.removeEventListener("click", handleGlobalClick);
		};
	}, [activeSwipedTaskId]);

	// Modals state
	const [statusPickerTask, setStatusPickerTask] = useState<Task | null>(null);
	const [scheduleModalTask, setScheduleModalTask] = useState<Task | null>(null);
	const [listPickerTaskId, setListPickerTaskId] = useState<string | null>(null);
	const [folderPickerTask, setFolderPickerTask] = useState<Task | null>(null);
	const [contextMenu, setContextMenu] = useState<{
		entry: Task;
		x: number;
		y: number;
	} | null>(null);

	const handleTaskContextMenu = (task: Task, e: React.MouseEvent) => {
		e.preventDefault();
		setContextMenu({
			entry: task,
			x: e.clientX,
			y: e.clientY,
		});
	};

	// Status groups collapsed state (when statusFilter === 'all')
	const [collapsedStatusGroups, setCollapsedStatusGroups] = useState<
		Record<string, boolean>
	>(() => {
		try {
			const saved = localStorage.getItem(
				"flowday_lists_collapsed_status_groups",
			);
			return saved ? JSON.parse(saved) : {};
		} catch {
			return {};
		}
	});

	const toggleStatusGroup = (statusKey: string) => {
		setCollapsedStatusGroups((prev) => {
			const next = { ...prev, [statusKey]: !prev[statusKey] };
			try {
				localStorage.setItem(
					"flowday_lists_collapsed_status_groups",
					JSON.stringify(next),
				);
			} catch {}
			return next;
		});
	};

	const handleMoveTaskToFolder = async (
		taskId: string,
		folderId: string | undefined,
	) => {
		await db.entries.update(taskId, { folder_id: folderId } as any);
	};

	// Folder collapsed state (map of folderId -> boolean)
	const [collapsedFolders, setCollapsedFolders] = useState<
		Record<string, boolean>
	>({});

	// Quick task input in current list/folder
	const [targetFolderId, setTargetFolderId] = useState<string | undefined>(
		undefined,
	);

	// Fetch lists (categories)
	const rawTaskLists = (useLiveQuery(
		() => db.categories.where("scope").equals(TASK_LIST_SCOPE).toArray(),
		[],
	) ?? []) as Category[];

	const taskLists = [...rawTaskLists].sort((a, b) => {
		const aO = (a as any).sort_order ?? Date.parse(a.created_at.toString());
		const bO = (b as any).sort_order ?? Date.parse(b.created_at.toString());
		return aO - bO;
	});

	// Fetch folders from db.list_folders
	const allFolders = (useLiveQuery(
		() => db.list_folders.toArray(),
		[],
	) ?? []) as ListFolder[];

	// Folders belonging to current selectedView
	const currentListFolders = useMemo(() => {
		return allFolders
			.filter((f) => f.list_id === selectedView)
			.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
	}, [allFolders, selectedView]);

	// Available folders to pick when moving a task on mobile/desktop
	const availableFoldersForPicker = useMemo(() => {
		if (selectedView === "all") return allFolders;
		return currentListFolders.length > 0 ? currentListFolders : allFolders;
	}, [selectedView, allFolders, currentListFolders]);

	// Dateless backlog tasks only for ListsView (excludes scheduled tasks)
	const allTasks = useMemo(
		() =>
			entries.filter(
				(e): e is Task => e.type === "task" && !e.scheduled_at,
			),
		[entries],
	);

	// All completed accomplishment tasks & logs across the entire database
	const accomplishmentTasks = useMemo(
		() =>
			entries.filter(
				(e): e is Task =>
					(e.type === "task" && e.status === "done" && e.is_accomplishment === true) ||
					(e.type === "log" && (e as any).is_accomplishment === true),
			),
		[entries],
	);

	const handleStatusFilterChange = (
		filter: "all" | "todo" | "in_progress" | "done" | "dropped" | "maybe",
	) => {
		setStatusFilter(filter);
		localStorage.setItem("flowday-tasks-status-filter", filter);
	};

	const handleSelectView = (view: string) => {
		setSelectedView(view);
		localStorage.setItem("flowday-tasks-selected-list", view);
	};

	// ─── Filter Tasks for the Selected View ──────────────────────────────────
	const listTasks = useMemo(() => {
		let tasks = selectedView === "trophy" ? accomplishmentTasks : allTasks;

		// Filter by list / view
		if (selectedView === "unassigned") {
			tasks = tasks.filter((t) => {
				const ids = t.category_ids ?? [];
				return ids.length === 0 || !taskLists.some((l) => ids.includes(l.id));
			});
		} else if (
			selectedView !== "all" &&
			selectedView !== "paper" &&
			selectedView !== "trophy"
		) {
			tasks = tasks.filter((t) => (t.category_ids ?? []).includes(selectedView));
		}

		// Filter by search query
		if (searchQuery.trim()) {
			const q = searchQuery.toLowerCase();
			tasks = tasks.filter((t) => {
				const title = (t.title || "").toLowerCase();
				const content = (t.content || "").toLowerCase();
				return title.includes(q) || content.includes(q);
			});
		}

		// Sort by sort_order then created_at
		return [...tasks].sort((a, b) => {
			const aSort = a.sort_order ?? Infinity;
			const bSort = b.sort_order ?? Infinity;
			if (aSort !== bSort) return aSort - bSort;
			return (
				new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
			);
		});
	}, [allTasks, accomplishmentTasks, selectedView, searchQuery, taskLists]);

	// Filter tasks further by statusFilter
	const displayedTasks = useMemo(() => {
		if (statusFilter === "all") return listTasks;
		if (statusFilter === "todo") {
			return listTasks.filter((t) => t.status === "todo" || !t.status);
		}
		return listTasks.filter((t) => t.status === statusFilter);
	}, [listTasks, statusFilter]);

	// Split tasks into folders vs root tasks
	const { folderTasksMap, rootTasks } = useMemo(() => {
		const map: Record<string, Task[]> = {};
		const validFolderIds = new Set(currentListFolders.map((f) => f.id));
		currentListFolders.forEach((f) => {
			map[f.id] = [];
		});

		const root: Task[] = [];

		displayedTasks.forEach((task) => {
			if (task.folder_id && validFolderIds.has(task.folder_id)) {
				map[task.folder_id].push(task);
			} else {
				root.push(task);
			}
		});

		return { folderTasksMap: map, rootTasks: root };
	}, [displayedTasks, currentListFolders]);

	// ─── Per-list task counts for sidebar ────────────────────────────────────
	const listTaskCounts = useMemo(() => {
		const counts: Record<string, { active: number; done: number }> = {};

		counts["all"] = {
			active: allTasks.filter(
				(t) =>
					t.status !== "done" && t.status !== "dropped" && t.status !== "maybe",
			).length,
			done: allTasks.filter((t) => t.status === "done").length,
		};

		const unassignedTasks = allTasks.filter((t) => {
			const ids = t.category_ids ?? [];
			return ids.length === 0 || !taskLists.some((l) => ids.includes(l.id));
		});
		counts["unassigned"] = {
			active: unassignedTasks.filter(
				(t) =>
					t.status !== "done" && t.status !== "dropped" && t.status !== "maybe",
			).length,
			done: unassignedTasks.filter((t) => t.status === "done").length,
		};

		counts["trophy"] = {
			active: accomplishmentTasks.length,
			done: accomplishmentTasks.length,
		};

		taskLists.forEach((list) => {
			const lTasks = allTasks.filter((t) =>
				(t.category_ids ?? []).includes(list.id),
			);
			counts[list.id] = {
				active: lTasks.filter(
					(t) =>
						t.status !== "done" &&
						t.status !== "dropped" &&
						t.status !== "maybe",
				).length,
				done: lTasks.filter((t) => t.status === "done").length,
			};
		});

		return counts;
	}, [allTasks, taskLists, accomplishmentTasks]);

	// ─── Folder Operations ────────────────────────────────────────────────────
	const handleCreateFolder = async () => {
		const newFolder: ListFolder = {
			id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
			name: "New Folder",
			list_id: selectedView,
			sort_order: currentListFolders.length,
			created_at: new Date(),
		};
		await db.list_folders.add(newFolder);
	};

	const handleRenameFolder = async (folderId: string, newName: string) => {
		await db.list_folders.update(folderId, { name: newName });
	};

	const handleDeleteFolder = async (folderId: string) => {
		await db.transaction("rw", db.list_folders, db.entries, async () => {
			await db.list_folders.delete(folderId);
			const folderTasks = allTasks.filter((t) => t.folder_id === folderId);
			for (const t of folderTasks) {
				await db.entries.update(t.id, { folder_id: undefined } as any);
			}
		});
	};

	const toggleFolderCollapse = (folderId: string) => {
		setCollapsedFolders((prev) => ({
			...prev,
			[folderId]: !prev[folderId],
		}));
	};

	const handleToggleAccomplishment = async (task: Task) => {
		const nextState = !task.is_accomplishment;
		await db.entries.update(task.id, {
			is_accomplishment: nextState,
		} as any);
	};

	// ─── Drag and Drop Sensor & Handlers ──────────────────────────────────────
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: { delay: 150, tolerance: 5 },
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const { setNodeRef: setRootNodeRef, isOver: isOverRoot } = useDroppable({
		id: "root-tasks-area",
		data: { folderId: undefined },
	});

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over) return;

		const activeTaskId = active.id as string;
		const draggedTask = allTasks.find((t) => t.id === activeTaskId);
		if (!draggedTask) return;

		const overIdStr = String(over.id);
		if (overIdStr.startsWith("folder-drop-")) {
			const targetFolderId = overIdStr.replace("folder-drop-", "");
			if (draggedTask.folder_id !== targetFolderId) {
				await db.entries.update(activeTaskId, {
					folder_id: targetFolderId,
				} as any);
				return;
			}
		}

		if (overIdStr === "root-tasks-area") {
			if (draggedTask.folder_id !== undefined) {
				await db.entries.update(activeTaskId, {
					folder_id: undefined,
				} as any);
				return;
			}
		}

		if (active.id !== over.id) {
			const overTask = allTasks.find((t) => t.id === over.id);
			if (overTask) {
				const sameFolder = draggedTask.folder_id === overTask.folder_id;
				if (!sameFolder) {
					await db.entries.update(activeTaskId, {
						folder_id: overTask.folder_id,
					} as any);
				}

				const containerTasks = displayedTasks.filter(
					(t) => t.folder_id === overTask.folder_id,
				);
				const oldIdx = containerTasks.findIndex((t) => t.id === active.id);
				const newIdx = containerTasks.findIndex((t) => t.id === over.id);
				if (oldIdx !== -1 && newIdx !== -1) {
					const reordered = arrayMove(containerTasks, oldIdx, newIdx);
					await db.transaction("rw", db.entries, async () => {
						for (let i = 0; i < reordered.length; i++) {
							await db.entries.update(reordered[i].id, {
								sort_order: i,
							} as any);
						}
					});
				}
			}
		}
	};

	// ─── Status Switcher Pill Bar ─────────────────────────────────────────────
	const statusSwitcher = (
		<div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.08] backdrop-blur-xl rounded-xl p-1 shrink-0 flex-wrap sm:flex-nowrap">
			{(
				["all", "todo", "in_progress", "done", "dropped", "maybe"] as const
			).map((st) => (
				<button
					key={st}
					onClick={() => handleStatusFilterChange(st)}
					className={`px-2.5 py-1 text-[10px] font-mono font-bold uppercase tracking-wider rounded-lg transition-all cursor-pointer select-none ${
						statusFilter === st
							? st === "in_progress"
								? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]"
								: st === "done"
									? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
									: st === "dropped"
										? "bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]"
										: st === "maybe"
											? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 shadow-[0_0_10px_rgba(139,92,246,0.2)]"
											: "bg-white/[0.12] text-white shadow-sm border border-white/20"
							: "text-stone-400 hover:text-stone-200 hover:bg-white/[0.04] border border-transparent"
					}`}
				>
					{st === "all"
						? "All"
						: st === "todo"
							? "To Do"
							: st === "in_progress"
								? "In Progress"
								: st === "done"
									? "Completed"
									: st === "dropped"
										? "Dropped"
										: "Maybe / Later"}
				</button>
			))}
		</div>
	);

	// ─── Folder Strip Panel ───────────────────────────────────────────────────
	const folderStripPanel = selectedView !== "paper" &&
		selectedView !== "trophy" && (
			<div className="flex items-center gap-1.5 overflow-x-auto py-1.5 scrollbar-none shrink-0 mb-3">
				<button
					onClick={handleCreateFolder}
					className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer shrink-0 active:scale-95"
				>
					<FolderPlus className="w-3.5 h-3.5" />
					<span>+ Folder</span>
				</button>

				{currentListFolders.map((folder) => {
					const fTasks = folderTasksMap[folder.id] ?? [];
					if (statusFilter !== "all" && fTasks.length === 0) return null;

					return (
						<button
							key={folder.id}
							onClick={() => {
								const el = document.getElementById(`folder-${folder.id}`);
								if (el) {
									el.scrollIntoView({ behavior: "smooth", block: "start" });
								}
							}}
							className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-mono font-semibold bg-stone-900/60 border border-stone-800 text-stone-300 hover:border-amber-500/40 hover:text-amber-300 transition-all cursor-pointer shrink-0"
						>
							<Folder className="w-3 h-3 text-amber-400" />
							<span className="truncate max-w-[120px]">{folder.name}</span>
							<span className="text-[9px] font-mono text-stone-500 font-bold tabular-nums">
								{fTasks.length}
							</span>
						</button>
					);
				})}
			</div>
		);

	// Desktop cards per row setting
	const [cardsPerRow, setCardsPerRow] = useState(() => {
		try {
			return localStorage.getItem("flowday_lists_cards_per_row") || "3";
		} catch {
			return "3";
		}
	});

	useEffect(() => {
		const handler = () => {
			try {
				setCardsPerRow(
					localStorage.getItem("flowday_lists_cards_per_row") || "3",
				);
			} catch {}
		};
		window.addEventListener("flowday-settings-change", handler);
		return () => window.removeEventListener("flowday-settings-change", handler);
	}, []);

	const gridClass = useMemo(() => {
		switch (cardsPerRow) {
			case "1":
				return "grid grid-cols-1 gap-2.5";
			case "2":
				return "grid grid-cols-1 lg:grid-cols-2 gap-2.5";
			case "4":
				return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2.5";
			case "3":
			default:
				return "grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5";
		}
	}, [cardsPerRow]);

	const renderTaskContent = (isDesktop: boolean) => (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			onDragEnd={handleDragEnd}
		>
			<div className="space-y-4">
				{/* Folders List */}
				{currentListFolders.map((folder) => {
					const fTasks = folderTasksMap[folder.id] ?? [];
					if (statusFilter !== "all" && fTasks.length === 0) return null;

					return (
						<FolderCard
							key={folder.id}
							folder={folder}
							tasks={fTasks}
							isCollapsed={!!collapsedFolders[folder.id]}
							onToggleCollapse={() => toggleFolderCollapse(folder.id)}
							onRenameFolder={handleRenameFolder}
							onDeleteFolder={handleDeleteFolder}
							activeTaskId={activeTaskId}
							deletingId={deletingId}
							taskLists={taskLists}
							selectedListId={selectedView}
							availableFolders={availableFoldersForPicker}
							activeSwipedTaskId={activeSwipedTaskId}
							onSetSwipedTaskId={setActiveSwipedTaskId}
							onDeleteEntry={onDeleteEntry}
							onOpenDetail={onOpenDetail}
							onToggleTaskStatus={onToggleTaskStatus}
							onOpenStatusModal={setStatusPickerTask}
							onActivateTask={onActivateTask}
							onOpenScheduleModal={setScheduleModalTask}
							onOpenListPicker={(t) => setListPickerTaskId(t.id)}
							onOpenFolderPicker={setFolderPickerTask}
							onAddTaskToFolder={(fId) => {
								setTargetFolderId(fId);
								const input = document.getElementById("quick-task-input");
								if (input) input.focus();
							}}
							onToggleAccomplishment={handleToggleAccomplishment}
							isDesktop={isDesktop}
							gridClass={gridClass}
							showContent={showContent}
							onContextMenu={handleTaskContextMenu}
						/>
					);
				})}

				{/* Root / Unfolderized Tasks Section */}
				<div
					ref={setRootNodeRef}
					className={`rounded-2xl transition-all duration-150 ${
						currentListFolders.length > 0
							? "border border-stone-800/60 bg-[#111]/40 p-3"
							: ""
					} ${
						isOverRoot ? "border-amber-500/50 bg-amber-500/[0.03]" : ""
					}`}
				>
					{currentListFolders.length > 0 && rootTasks.length > 0 && (
						<div className="flex items-center justify-between mb-2 px-1">
							<span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">
								General Tasks ({rootTasks.length})
							</span>
						</div>
					)}

					<div>
						{statusFilter === "all" ? (
							<div className="space-y-4">
								{STATUS_GROUPS.map((group) => {
									const groupTasks = rootTasks.filter(group.filterFn);
									if (groupTasks.length === 0) return null;
									const isGroupCollapsed = !!collapsedStatusGroups[group.key];

									return (
										<div key={group.key} className="space-y-2">
											<button
												type="button"
												onClick={() => toggleStatusGroup(group.key)}
												className="w-full flex items-center justify-between py-1 px-1.5 rounded-lg text-left hover:bg-stone-900/40 transition-colors cursor-pointer group"
											>
												<div className="flex items-center gap-2">
													<ChevronDown
														className={`w-3.5 h-3.5 text-stone-500 transition-transform duration-200 ${
															isGroupCollapsed ? "-rotate-90" : "rotate-0"
														}`}
													/>
													<span
														className={`w-2 h-2 rounded-full ${group.dotColor}`}
													/>
													<span
														className={`text-[11px] font-mono font-bold uppercase tracking-wider ${group.textColor}`}
													>
														{group.label}
													</span>
												</div>
												<span className="text-[10px] font-mono font-bold text-stone-500 tabular-nums">
													{groupTasks.length}
												</span>
											</button>

											{!isGroupCollapsed && (
												<SortableContext
													items={groupTasks.map((t) => t.id)}
													strategy={verticalListSortingStrategy}
												>
													{isDesktop ? (
														<div className={gridClass}>
															{groupTasks.map((task) => (
																<DesktopTaskCard
																	key={task.id}
																	task={task}
																	activeTaskId={activeTaskId}
																	deletingId={deletingId}
																	taskLists={taskLists}
																	selectedListId={selectedView}
																	availableFolders={availableFoldersForPicker}
																	onDeleteEntry={onDeleteEntry}
																	onOpenDetail={onOpenDetail}
																	onToggleTaskStatus={onToggleTaskStatus}
																	onOpenStatusModal={setStatusPickerTask}
																	onActivateTask={onActivateTask}
																	onOpenScheduleModal={setScheduleModalTask}
																	onOpenListPicker={(t) =>
																		setListPickerTaskId(t.id)
																	}
																	onOpenFolderPicker={setFolderPickerTask}
																	onToggleAccomplishment={
																		handleToggleAccomplishment
																	}
																	showContent={showContent}
																	onContextMenu={handleTaskContextMenu}
																/>
															))}
														</div>
													) : (
														<div className="space-y-1.5">
															{groupTasks.map((task) => (
																<MobileTaskItem
																	key={task.id}
																	task={task}
																	activeTaskId={activeTaskId}
																	deletingId={deletingId}
																	taskLists={taskLists}
																	selectedListId={selectedView}
																	availableFolders={availableFoldersForPicker}
																	isSwiped={activeSwipedTaskId === task.id}
																	onSetSwiped={(swiped) =>
																		setActiveSwipedTaskId(
																			swiped ? task.id : null,
																		)
																	}
																	onDeleteEntry={onDeleteEntry}
																	onOpenDetail={onOpenDetail}
																	onToggleTaskStatus={onToggleTaskStatus}
																	onOpenStatusModal={setStatusPickerTask}
																	onActivateTask={onActivateTask}
																	onOpenScheduleModal={setScheduleModalTask}
																	onOpenListPicker={(t) =>
																		setListPickerTaskId(t.id)
																	}
																	onOpenFolderPicker={setFolderPickerTask}
																	onToggleAccomplishment={
																		handleToggleAccomplishment
																	}
																	showContent={showContent}
																	onContextMenu={handleTaskContextMenu}
																/>
															))}
														</div>
													)}
												</SortableContext>
											)}
										</div>
									);
								})}
							</div>
						) : (
							<SortableContext
								items={rootTasks.map((t) => t.id)}
								strategy={verticalListSortingStrategy}
							>
								{isDesktop ? (
									<div className={gridClass}>
										{rootTasks.map((task) => (
											<DesktopTaskCard
												key={task.id}
												task={task}
												activeTaskId={activeTaskId}
												deletingId={deletingId}
												taskLists={taskLists}
												selectedListId={selectedView}
												availableFolders={availableFoldersForPicker}
												onDeleteEntry={onDeleteEntry}
												onOpenDetail={onOpenDetail}
												onToggleTaskStatus={onToggleTaskStatus}
												onOpenStatusModal={setStatusPickerTask}
												onActivateTask={onActivateTask}
												onOpenScheduleModal={setScheduleModalTask}
												onOpenListPicker={(t) => setListPickerTaskId(t.id)}
												onOpenFolderPicker={setFolderPickerTask}
												onToggleAccomplishment={handleToggleAccomplishment}
												showContent={showContent}
												onContextMenu={handleTaskContextMenu}
											/>
										))}
									</div>
								) : (
									<div className="space-y-1.5">
										{rootTasks.map((task) => (
											<MobileTaskItem
												key={task.id}
												task={task}
												activeTaskId={activeTaskId}
												deletingId={deletingId}
												taskLists={taskLists}
												selectedListId={selectedView}
												availableFolders={availableFoldersForPicker}
												isSwiped={activeSwipedTaskId === task.id}
												onSetSwiped={(swiped) =>
													setActiveSwipedTaskId(
														swiped ? task.id : null,
													)
												}
												onDeleteEntry={onDeleteEntry}
												onOpenDetail={onOpenDetail}
												onToggleTaskStatus={onToggleTaskStatus}
												onOpenStatusModal={setStatusPickerTask}
												onActivateTask={onActivateTask}
												onOpenScheduleModal={setScheduleModalTask}
												onOpenListPicker={(t) => setListPickerTaskId(t.id)}
												onOpenFolderPicker={setFolderPickerTask}
												onToggleAccomplishment={handleToggleAccomplishment}
												showContent={showContent}
												onContextMenu={handleTaskContextMenu}
											/>
										))}
									</div>
								)}
							</SortableContext>
						)}

						{rootTasks.length === 0 && currentListFolders.length === 0 && (
							<div className="py-20 text-center text-stone-500 select-none">
								<ListTodo className="w-10 h-10 text-stone-800 mx-auto mb-3" />
								<h4 className="font-mono font-medium text-xs text-stone-400 mb-1">
									{searchQuery.trim()
										? "No matching tasks found."
										: "List is empty."}
								</h4>
								<p className="text-[11px] font-mono text-stone-600 max-w-sm mx-auto">
									Create a task using the input engine or add a folder to organize your backlog.
								</p>
							</div>
						)}
					</div>
				</div>
			</div>
		</DndContext>
	);

	const activeViewInfo = useMemo(() => {
		if (selectedView === "all") {
			return {
				name: "All Tasks",
				icon: <Layers className="w-3.5 h-3.5 text-stone-300" />,
				count: listTaskCounts["all"]?.active ?? 0,
			};
		}
		if (selectedView === "unassigned") {
			return {
				name: "Unassigned",
				icon: <Inbox className="w-3.5 h-3.5 text-stone-300" />,
				count: listTaskCounts["unassigned"]?.active ?? 0,
			};
		}
		if (selectedView === "paper") {
			return {
				name: "Paper List",
				icon: <ClipboardList className="w-3.5 h-3.5 text-amber-400" />,
				count: listTasks.length,
			};
		}
		if (selectedView === "trophy") {
			return {
				name: "Accomplishments",
				icon: <Trophy className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />,
				count: listTaskCounts["trophy"]?.active ?? 0,
			};
		}
		const custom = taskLists.find((l) => l.id === selectedView);
		if (custom) {
			return {
				name: custom.name,
				icon: (
					<CategoryIcon
						name={custom.icon}
						color={custom.color}
						className="w-3.5 h-3.5"
						fallback="ListTodo"
					/>
				),
				count: listTaskCounts[custom.id]?.active ?? 0,
			};
		}
		return {
			name: "Tasks",
			icon: <ListTodo className="w-3.5 h-3.5" />,
			count: 0,
		};
	}, [selectedView, listTaskCounts, taskLists, listTasks]);

	return (
		<div className="space-y-0" id="tasks-view-dashboard">
			{/* ── MOBILE: Row 1 & Row 2 Layout ── */}
			<div className="md:hidden">
				{isMobileSearchOpen ? (
					<div className="flex items-center gap-2 py-1 mb-2">
						<div className="relative flex items-center flex-1">
							<Search className="absolute left-3 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
							<input
								autoFocus
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search tasks..."
								className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-white/[0.05] border border-white/20 rounded-xl text-stone-200 placeholder-stone-500 focus:outline-none focus:border-indigo-400/60 transition-all"
							/>
						</div>
						<button
							onClick={() => {
								setSearchQuery("");
								setIsMobileSearchOpen(false);
							}}
							className="p-1.5 rounded-xl border border-stone-800 text-stone-400 hover:text-stone-200 bg-stone-900 transition-colors cursor-pointer"
							title="Close search"
						>
							<X className="w-4 h-4" />
						</button>
					</div>
				) : (
					<div className="flex items-center justify-between gap-2 py-1 mb-2">
						<div className="flex items-center gap-1.5 min-w-0">
							<button
								onClick={() => setIsMobileViewSheetOpen(true)}
								className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/[0.05] border border-white/[0.1] text-stone-200 text-xs font-mono font-bold uppercase tracking-wider hover:bg-white/[0.08] transition-all cursor-pointer truncate active:scale-95"
							>
								{activeViewInfo.icon}
								<span className="truncate max-w-[130px]">{activeViewInfo.name}</span>
								<ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0 ml-0.5" />
							</button>

							<button
								onClick={() => setIsMobileSearchOpen(true)}
								className="p-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-stone-400 hover:text-stone-200 hover:bg-white/[0.08] transition-all cursor-pointer shrink-0"
								title="Search tasks"
							>
								<Search className="w-3.5 h-3.5" />
							</button>
						</div>

						{selectedView !== "paper" && selectedView !== "trophy" && (
							<button
								onClick={() => setIsMobileStatusSheetOpen(true)}
								className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-stone-300 text-[10px] font-mono font-bold uppercase tracking-wider hover:bg-white/[0.08] transition-all cursor-pointer shrink-0"
							>
								<span
									className={`w-2 h-2 rounded-full ${
										statusFilter === "in_progress"
											? "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]"
											: statusFilter === "done"
												? "bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]"
												: statusFilter === "dropped"
													? "bg-rose-400"
													: statusFilter === "maybe"
														? "bg-indigo-400"
														: "bg-stone-400"
									}`}
								/>
								<span>
									{statusFilter === "all"
										? "All"
										: statusFilter === "todo"
											? "To Do"
											: statusFilter === "in_progress"
												? "Active"
												: statusFilter === "done"
													? "Done"
													: statusFilter === "dropped"
														? "Dropped"
														: "Maybe"}
								</span>
								<ChevronDown className="w-3 h-3 text-stone-500" />
							</button>
						)}
					</div>
				)}

				{/* Row 2: Folder Strip Panel */}
				{folderStripPanel}

				{/* Content */}
				<div className="my-1">
					{selectedView === "trophy" ? (
						<TrophyView
							tasks={accomplishmentTasks}
							taskLists={taskLists}
							onOpenDetail={onOpenDetail}
							onToggleAccomplishment={handleToggleAccomplishment}
							onContextMenu={handleTaskContextMenu}
						/>
					) : selectedView === "paper" ? (
						<PaperListView
							tasks={listTasks}
							onToggleTaskStatus={onToggleTaskStatus}
							onOpenDetail={onOpenDetail}
							onContextMenu={handleTaskContextMenu}
						/>
					) : (
						renderTaskContent(false)
					)}
				</div>
			</div>

			{/* ── DESKTOP: Two-column layout with Redesigned Sidebar ── */}
			<div className="hidden md:flex gap-0 h-[600px] overflow-hidden">
				{/* LEFT COLUMN — Sidebar */}
				<div className="w-[210px] lg:w-[270px] h-full overflow-y-auto shrink-0 flex flex-col min-h-0 border-r border-stone-800/60 pr-3 mr-3 font-sans">
					{/* Smart Views */}
					<div className="flex flex-col gap-1 pb-3 shrink-0">
						<span className="text-[9px] font-mono font-bold uppercase tracking-widest text-stone-500 px-2 py-0.5">
							Smart Views
						</span>

						<button
							onClick={() => handleSelectView("all")}
							className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
								selectedView === "all"
									? "bg-white/[0.08] border-white/20 text-white shadow-sm"
									: "bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:text-stone-200"
							}`}
						>
							<Layers className="w-3.5 h-3.5 text-stone-300" />
							<span className="flex-1 min-w-0 text-xs font-mono font-semibold truncate">
								All Tasks
							</span>
							<span className="text-[10px] font-mono text-stone-500 font-bold tabular-nums">
								{listTaskCounts["all"]?.active ?? 0}
							</span>
						</button>

						<button
							onClick={() => handleSelectView("unassigned")}
							className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
								selectedView === "unassigned"
									? "bg-white/[0.08] border-white/20 text-white shadow-sm"
									: "bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:text-stone-200"
							}`}
						>
							<Inbox className="w-3.5 h-3.5 text-stone-300" />
							<span className="flex-1 min-w-0 text-xs font-mono font-semibold truncate">
								Unassigned
							</span>
							<span className="text-[10px] font-mono text-stone-500 font-bold tabular-nums">
								{listTaskCounts["unassigned"]?.active ?? 0}
							</span>
						</button>

						<button
							onClick={() => handleSelectView("paper")}
							className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
								selectedView === "paper"
									? "bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]"
									: "bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:text-amber-300"
							}`}
						>
							<ClipboardList className="w-3.5 h-3.5 text-amber-400" />
							<span className="flex-1 min-w-0 text-xs font-mono font-semibold truncate">
								Paper List
							</span>
							<span className="text-[9px] font-mono uppercase tracking-wider text-amber-500/80 font-bold">
								Focus
							</span>
						</button>

						<button
							onClick={() => handleSelectView("trophy")}
							className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
								selectedView === "trophy"
									? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
									: "bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:text-amber-300"
							}`}
						>
							<Trophy className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
							<span className="flex-1 min-w-0 text-xs font-mono font-semibold truncate">
								Accomplishments
							</span>
							<span className="text-[10px] font-mono text-amber-400 font-bold tabular-nums">
								{listTaskCounts["trophy"]?.active ?? 0}
							</span>
						</button>
					</div>

					{/* Custom Lists Header */}
					<div className="pt-2 border-t border-stone-800/80 flex items-center justify-between px-2 mb-1 shrink-0">
						<span className="text-[9px] font-mono font-bold uppercase tracking-widest text-stone-500">
							Custom Lists
						</span>
						<button
							onClick={() => setIsListManagerOpen(true)}
							className="p-1 rounded-md text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
							title="Manage lists"
						>
							<MoreHorizontal className="w-3.5 h-3.5" />
						</button>
					</div>

					{/* Custom Lists & Sub-Folders */}
					<div
						className="flex flex-col gap-0.5 overflow-y-auto flex-1 min-h-0"
						style={{ scrollbarWidth: "none" }}
					>
						{taskLists.map((list) => {
							const cs = LIST_COLORS[list.color] ?? LIST_COLORS["violet"];
							const isActive = selectedView === list.id;
							const counts = listTaskCounts[list.id] ?? {
								active: 0,
								done: 0,
							};
							const listFolders = allFolders.filter((f) => f.list_id === list.id);

							return (
								<div key={list.id} className="flex flex-col">
									<button
										onClick={() => handleSelectView(list.id)}
										className={`group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
											isActive
												? cs.active
												: "bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:border-stone-800 hover:text-stone-200"
										}`}
									>
										<CategoryIcon
											name={list.icon}
											color={list.color}
											className="w-3.5 h-3.5"
											fallback="ListTodo"
										/>
										<span className="flex-1 min-w-0 text-xs font-mono font-semibold truncate">
											{list.name}
										</span>
										<span className="flex items-center gap-1.5 shrink-0">
											{counts.active > 0 && (
												<span
													className={`text-[9px] font-mono font-bold tabular-nums min-w-[14px] text-center ${
														isActive
															? "text-current opacity-90"
															: "text-stone-500 group-hover:text-stone-400"
													}`}
												>
													{counts.active}
												</span>
											)}
											{counts.done > 0 && (
												<span
													className={`text-[9px] font-mono font-bold tabular-nums min-w-[14px] text-center opacity-50 ${
														isActive
															? "text-current"
															: "text-stone-600 group-hover:text-stone-500"
													}`}
												>
													✓{counts.done}
												</span>
											)}
										</span>
									</button>

									{isActive && listFolders.length > 0 && (
										<div className="pl-6 pr-1 py-1 space-y-0.5 border-l border-stone-800/80 ml-4 my-0.5">
											{listFolders.map((f) => (
												<button
													key={f.id}
													onClick={() => {
														const el = document.getElementById(
															`folder-${f.id}`,
														);
														if (el) {
															el.scrollIntoView({
																behavior: "smooth",
																block: "start",
															});
														}
													}}
													className="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-left text-[11px] font-mono text-stone-400 hover:text-amber-300 hover:bg-stone-900/60 transition-colors cursor-pointer"
												>
													<Folder className="w-3 h-3 text-amber-400/80 shrink-0" />
													<span className="flex-1 truncate">{f.name}</span>
												</button>
											))}
										</div>
									)}
								</div>
							);
						})}
					</div>
				</div>

				{/* RIGHT COLUMN — Active Panel */}
				<div className="flex-1 min-w-0 min-h-0 flex flex-col h-full">
					{selectedView === "trophy" ? (
						<TrophyView
							tasks={accomplishmentTasks}
							taskLists={taskLists}
							onOpenDetail={onOpenDetail}
							onToggleAccomplishment={handleToggleAccomplishment}
							onContextMenu={handleTaskContextMenu}
						/>
					) : selectedView === "paper" ? (
						<PaperListView
							tasks={listTasks}
							onToggleTaskStatus={onToggleTaskStatus}
							onOpenDetail={onOpenDetail}
							onContextMenu={handleTaskContextMenu}
						/>
					) : (
						<>
							<div className="z-20 pb-2.5 flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap shrink-0">
								<div className="relative flex items-center flex-1 max-w-[200px] sm:max-w-xs">
									<Search className="absolute left-3 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
									<input
										type="text"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										placeholder="Search tasks..."
										className="w-full sm:w-64 pl-8 pr-3 py-1.5 text-xs font-mono bg-white/[0.03] border border-white/[0.08] rounded-xl text-stone-200 placeholder-stone-500 focus:outline-none focus:border-indigo-400/50 focus:bg-white/[0.05] transition-all"
									/>
								</div>

								<div className="flex gap-2 shrink-0">{statusSwitcher}</div>
							</div>

							{folderStripPanel}

							<div
								className="flex-1 min-h-0 overflow-y-auto pr-1"
								style={{
									scrollbarWidth: "thin",
									scrollbarColor: "#3d3d3d transparent",
								}}
							>
								{renderTaskContent(true)}
							</div>
						</>
					)}
				</div>
			</div>

			{/* Modals */}
			{scheduleModalTask && (
				<ScheduleCalendarModal
					task={scheduleModalTask}
					onClose={() => setScheduleModalTask(null)}
					onSelectDate={async (taskId, date) => {
						await onCarryTask(taskId, date);
						setScheduleModalTask(null);
					}}
					onUnschedule={async (taskId) => {
						await db.entries.update(taskId, {
							scheduled_at: undefined,
						} as any);
						setScheduleModalTask(null);
					}}
				/>
			)}

			{statusPickerTask && (
				<TaskStatusPickerPopover
					task={statusPickerTask}
					onClose={() => setStatusPickerTask(null)}
				/>
			)}

			{listPickerTaskId &&
				(() => {
					const task = allTasks.find((t) => t.id === listPickerTaskId);
					if (!task) return null;
					return (
						<ListPickerPopover
							task={task}
							lists={taskLists}
							onClose={() => setListPickerTaskId(null)}
						/>
					);
				})()}

			{folderPickerTask && (
				<MoveToFolderModal
					task={folderPickerTask}
					folders={availableFoldersForPicker}
					onClose={() => setFolderPickerTask(null)}
					onSelectFolder={handleMoveTaskToFolder}
				/>
			)}

			{isMobileViewSheetOpen && (
				<AnimatePresence>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => setIsMobileViewSheetOpen(false)}
						className="fixed inset-0 z-[1200] bg-black/70 backdrop-blur-sm flex flex-col justify-end p-0"
					>
						<motion.div
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "spring", damping: 28, stiffness: 300 }}
							onClick={(e) => e.stopPropagation()}
							className="bg-[#131313] border-t border-stone-800 rounded-t-3xl max-h-[82vh] flex flex-col overflow-hidden shadow-2xl"
						>
							<div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-stone-800/80 shrink-0">
								<span className="text-xs font-mono font-bold uppercase tracking-widest text-stone-300">
									Select View or List
								</span>
								<button
									onClick={() => setIsMobileViewSheetOpen(false)}
									className="p-1 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer"
								>
									<X className="w-4 h-4" />
								</button>
							</div>

							<div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
								<div className="space-y-1">
									<span className="text-[9px] uppercase font-bold tracking-widest text-stone-500 px-2">
										Smart Views
									</span>
									<button
										onClick={() => {
											handleSelectView("all");
											setIsMobileViewSheetOpen(false);
										}}
										className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
											selectedView === "all"
												? "bg-white/[0.1] border border-white/20 text-white font-bold"
												: "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
										}`}
									>
										<Layers className="w-4 h-4 text-stone-300" />
										<span className="flex-1">All Tasks</span>
										<span className="text-[10px] text-stone-500 font-bold tabular-nums">
											{listTaskCounts["all"]?.active ?? 0}
										</span>
									</button>

									<button
										onClick={() => {
											handleSelectView("unassigned");
											setIsMobileViewSheetOpen(false);
										}}
										className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
											selectedView === "unassigned"
												? "bg-white/[0.1] border border-white/20 text-white font-bold"
												: "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
										}`}
									>
										<Inbox className="w-4 h-4 text-stone-300" />
										<span className="flex-1">Unassigned</span>
										<span className="text-[10px] text-stone-500 font-bold tabular-nums">
											{listTaskCounts["unassigned"]?.active ?? 0}
										</span>
									</button>

									<button
										onClick={() => {
											handleSelectView("paper");
											setIsMobileViewSheetOpen(false);
										}}
										className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
											selectedView === "paper"
												? "bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold"
												: "text-stone-400 hover:bg-stone-900 hover:text-amber-300"
										}`}
									>
										<ClipboardList className="w-4 h-4 text-amber-400" />
										<span className="flex-1">Paper List</span>
										<span className="text-[9px] uppercase tracking-wider text-amber-500/80 font-bold">
											Focus
										</span>
									</button>

									<button
										onClick={() => {
											handleSelectView("trophy");
											setIsMobileViewSheetOpen(false);
										}}
										className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
											selectedView === "trophy"
												? "bg-amber-500/20 border-amber-500/40 text-amber-300 font-bold"
												: "text-stone-400 hover:bg-stone-900 hover:text-amber-300"
										}`}
									>
										<Trophy className="w-4 h-4 text-amber-400 fill-amber-400" />
										<span className="flex-1">Accomplishments</span>
										<span className="text-[10px] text-amber-400 font-bold tabular-nums">
											{listTaskCounts["trophy"]?.active ?? 0}
										</span>
									</button>
								</div>

								<div className="space-y-1 pt-2 border-t border-stone-800/80">
									<span className="text-[9px] uppercase font-bold tracking-widest text-stone-500 px-2">
										Custom Lists
									</span>
									{taskLists.map((list) => {
										const isSelected = selectedView === list.id;
										const counts = listTaskCounts[list.id] ?? {
											active: 0,
											done: 0,
										};
										return (
											<button
												key={list.id}
												onClick={() => {
													handleSelectView(list.id);
													setIsMobileViewSheetOpen(false);
												}}
												className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
													isSelected
														? "bg-violet-500/20 border border-violet-500/40 text-violet-300 font-bold"
														: "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
												}`}
											>
												<CategoryIcon
													name={list.icon}
													color={list.color}
													className="w-4 h-4"
													fallback="ListTodo"
												/>
												<span className="flex-1 truncate">{list.name}</span>
												<span className="text-[10px] text-stone-500 font-bold tabular-nums">
													{counts.active}
												</span>
											</button>
										);
									})}
								</div>
							</div>

							<div className="p-3 border-t border-stone-800/80 shrink-0 bg-[#101010]">
								<button
									onClick={() => {
										setIsMobileViewSheetOpen(false);
										setIsListManagerOpen(true);
									}}
									className="w-full py-2.5 rounded-xl bg-stone-800 text-stone-300 hover:text-white hover:bg-stone-700 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
								>
									⚙️ Manage Lists
								</button>
							</div>
						</motion.div>
					</motion.div>
				</AnimatePresence>
			)}

			{isMobileStatusSheetOpen && (
				<AnimatePresence>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => setIsMobileStatusSheetOpen(false)}
						className="fixed inset-0 z-[1200] bg-black/70 backdrop-blur-sm flex flex-col justify-end p-0"
					>
						<motion.div
							initial={{ y: "100%" }}
							animate={{ y: 0 }}
							exit={{ y: "100%" }}
							transition={{ type: "spring", damping: 28, stiffness: 300 }}
							onClick={(e) => e.stopPropagation()}
							className="bg-[#131313] border-t border-stone-800 rounded-t-3xl flex flex-col overflow-hidden shadow-2xl p-4 space-y-2"
						>
							<div className="flex items-center justify-between pb-2 border-b border-stone-800/80">
								<span className="text-xs font-mono font-bold uppercase tracking-widest text-stone-400">
									Filter Status
								</span>
								<button
									onClick={() => setIsMobileStatusSheetOpen(false)}
									className="p-1 rounded-lg text-stone-500 hover:text-stone-300 cursor-pointer"
								>
									<X className="w-4 h-4" />
								</button>
							</div>

							{(
								[
									{ id: "all", label: "All Statuses", color: "bg-stone-400" },
									{ id: "todo", label: "To Do", color: "bg-stone-400" },
									{
										id: "in_progress",
										label: "In Progress",
										color: "bg-amber-400",
									},
									{ id: "done", label: "Completed", color: "bg-emerald-400" },
									{ id: "dropped", label: "Dropped", color: "bg-rose-400" },
									{
										id: "maybe",
										label: "Maybe / Later",
										color: "bg-indigo-400",
									},
								] as const
							).map((st) => (
								<button
									key={st.id}
									onClick={() => {
										handleStatusFilterChange(st.id);
										setIsMobileStatusSheetOpen(false);
									}}
									className={`flex items-center gap-3 w-full px-3.5 py-2.5 rounded-xl text-left font-mono text-xs transition-all cursor-pointer ${
										statusFilter === st.id
											? "bg-white/[0.1] text-white font-bold border border-white/20"
											: "text-stone-400 hover:bg-stone-900 hover:text-stone-200"
									}`}
								>
									<span className={`w-2.5 h-2.5 rounded-full ${st.color}`} />
									<span className="flex-1">{st.label}</span>
									{statusFilter === st.id && (
										<Check className="w-4 h-4 text-white stroke-[2.5]" />
									)}
								</button>
							))}
						</motion.div>
					</motion.div>
				</AnimatePresence>
			)}

			{isListManagerOpen && (
				<TaskListManagerModal onClose={() => setIsListManagerOpen(false)} />
			)}

			{contextMenu && (
				<EntryContextMenu
					entry={contextMenu.entry}
					x={contextMenu.x}
					y={contextMenu.y}
					onClose={() => setContextMenu(null)}
					activeTaskId={activeTaskId}
					onOpenDetail={onOpenDetail}
					onDeleteEntry={onDeleteEntry}
					onActivateTask={onActivateTask}
					onToggleTaskStatus={onToggleTaskStatus}
					onReschedule={async (targetEntry, targetDate) => {
						onCarryTask(targetEntry.id, targetDate);
					}}
				/>
			)}
		</div>
	);
}
