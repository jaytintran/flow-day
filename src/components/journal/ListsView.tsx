/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, {
	useState,
	useMemo,
	useEffect,
	useRef,
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
	CircleDashed,
	Calendar,
	Trash2,
	CheckSquare,
	Plus,
	Palette,
	Edit2,
	Star,
	LayoutGrid,
	List,
	FolderMinus,
	FolderTree,
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
	TaskStatus,
} from "../../types";
import { useLiveQuery } from "dexie-react-hooks";
import CategoryIcon from "../CategoryIcon";
import EntryContextMenu from "../EntryContextMenu";
import InlineIconColorPopover from "../InlineIconColorPopover";
import {
	createTaskList,
	migrateTasksOnListDelete,
	TASK_LIST_SCOPE,
} from "../../utils";

// Subcomponents
import TaskStatusPickerPopover from "./lists/TaskStatusPickerPopover";
import ScheduleCalendarModal from "./lists/ScheduleCalendarModal";
import ListPickerPopover from "./lists/ListPickerPopover";
import MoveToFolderModal from "./lists/MoveToFolderModal";
import MobileTaskItem from "./lists/MobileTaskItem";
import DesktopTaskCard from "./lists/DesktopTaskCard";
import DesktopTaskRow from "./lists/DesktopTaskRow";
import FolderCard from "./lists/FolderCard";
import FolderTabChip from "./lists/FolderTabChip";
import TrophyView from "./lists/TrophyView";
import PaperListView from "./lists/PaperListView";
import SortableSidebarListItem from "./lists/SortableSidebarListItem";

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

export const STATUS_GROUPS: Array<{
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

	// Per-List Active Folder Tab Filter: 'all' | 'unfiled' | folderId
	const [selectedFolderTab, setSelectedFolderTab] = useState<string>(() => {
		const initialList = localStorage.getItem("flowday-tasks-selected-list") ?? "all";
		return localStorage.getItem(`flowday-tasks-folder-tab-${initialList}`) ?? "all";
	});

	const handleSelectFolderTab = (tabId: string) => {
		setSelectedFolderTab(tabId);
		localStorage.setItem(`flowday-tasks-folder-tab-${selectedView}`, tabId);
	};

	// Desktop Workspace Layout Mode: 'grid' (cards) | 'list' (compact rows)
	const [viewLayout, setViewLayout] = useState<"grid" | "list">(() => {
		try {
			return (
				(localStorage.getItem("flowday_lists_view_layout") as "grid" | "list") ||
				"grid"
			);
		} catch {
			return "grid";
		}
	});

	const handleToggleViewLayout = (layout: "grid" | "list") => {
		setViewLayout(layout);
		try {
			localStorage.setItem("flowday_lists_view_layout", layout);
		} catch {}
	};

	// Sidebar Direct List Creation State
	const [isCreatingList, setIsCreatingList] = useState(false);
	const [newListName, setNewListName] = useState("");
	const [newListColor, setNewListColor] = useState<Category["color"]>("violet");
	const [newListIcon, setNewListIcon] = useState("ListTodo");
	const [isNewListPopoverOpen, setIsNewListPopoverOpen] = useState(false);

	// Sidebar Direct List Inline Rename State
	const [editingListId, setEditingListId] = useState<string | null>(null);
	const [editingListName, setEditingListName] = useState("");

	// Dedicated Quick Task Input State in Lists View
	const [quickTaskTitle, setQuickTaskTitle] = useState("");
	const [quickTaskStatus, setQuickTaskStatus] = useState<TaskStatus>("todo");
	const [quickTaskStarred, setQuickTaskStarred] = useState(false);
	const quickTaskInputRef = useRef<HTMLInputElement>(null);

	const handleQuickCreateTask = async (e?: React.FormEvent) => {
		if (e) e.preventDefault();
		const trimmed = quickTaskTitle.trim();
		if (!trimmed) return;

		const targetCategoryIds: string[] = [];
		if (
			selectedView &&
			selectedView !== "all" &&
			selectedView !== "unassigned" &&
			selectedView !== "paper" &&
			selectedView !== "trophy"
		) {
			targetCategoryIds.push(selectedView);
		}

		// Contextual folder assignment: if viewing a specific folder tab, default to it
		const contextualFolderId =
			targetFolderId ??
			(selectedFolderTab !== "all" &&
			selectedFolderTab !== "unfiled" &&
			selectedFolderTab !== "flat"
				? selectedFolderTab
				: undefined);

		const newTaskId = crypto.randomUUID();
		const newTask: Task = {
			id: newTaskId,
			type: "task",
			title: trimmed,
			status: quickTaskStatus,
			time_spent: 0,
			created_at: new Date(),
			starred: quickTaskStarred || selectedView === "paper",
			...(targetCategoryIds.length > 0
				? { category_ids: targetCategoryIds }
				: {}),
			...(contextualFolderId ? { folder_id: contextualFolderId } : {}),
		};

		await db.entries.add(newTask);
		setQuickTaskTitle("");
		quickTaskInputRef.current?.focus();
	};

	// Dedicated Drag Sensor for Custom Lists in Sidebar
	const listSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const handleListDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		const oldIdx = taskLists.findIndex((l) => l.id === active.id);
		const newIdx = taskLists.findIndex((l) => l.id === over.id);
		if (oldIdx !== -1 && newIdx !== -1) {
			const reordered = arrayMove(taskLists, oldIdx, newIdx);
			await db.transaction("rw", db.categories, async () => {
				for (let i = 0; i < reordered.length; i++) {
					await db.categories.update(reordered[i].id, {
						sort_order: i,
					} as any);
				}
			});
		}
	};

	const handleCommitCreateList = async () => {
		const trimmed = newListName.trim();
		if (!trimmed) {
			setIsCreatingList(false);
			return;
		}
		const created = await createTaskList(trimmed, newListColor, newListIcon);
		setIsCreatingList(false);
		setNewListName("");
		setSelectedView(created.id);
		localStorage.setItem("flowday-tasks-selected-list", created.id);
	};

	const handleDeleteList = async (listId: string) => {
		await migrateTasksOnListDelete(listId);
		await db.categories.delete(listId);
		if (selectedView === listId) {
			setSelectedView("all");
			localStorage.setItem("flowday-tasks-selected-list", "all");
		}
	};

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

	// Multi-Selection State & Batch Modals
	const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
	const [lastSelectedTaskId, setLastSelectedTaskId] = useState<string | null>(null);
	const [batchScheduleModalOpen, setBatchScheduleModalOpen] = useState(false);
	const [batchListPickerOpen, setBatchListPickerOpen] = useState(false);
	const [batchFolderPickerOpen, setBatchFolderPickerOpen] = useState(false);
	const [batchStatusPickerOpen, setBatchStatusPickerOpen] = useState(false);

	// Clear selection on Escape key
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "Escape" && selectedTaskIds.size > 0) {
				setSelectedTaskIds(new Set());
			}
		};
		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [selectedTaskIds.size]);

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

	const handleToggleSelect = (taskId: string) => {
		setSelectedTaskIds((prev) => {
			const next = new Set(prev);
			if (next.has(taskId)) {
				next.delete(taskId);
			} else {
				next.add(taskId);
			}
			return next;
		});
		setLastSelectedTaskId(taskId);
	};

	const handleTaskClick = (task: Task, e: React.MouseEvent) => {
		if (e.ctrlKey || e.metaKey) {
			e.preventDefault();
			handleToggleSelect(task.id);
			return;
		}
		if (e.shiftKey && lastSelectedTaskId) {
			e.preventDefault();
			const idx1 = displayedTasks.findIndex((t) => t.id === lastSelectedTaskId);
			const idx2 = displayedTasks.findIndex((t) => t.id === task.id);
			if (idx1 !== -1 && idx2 !== -1) {
				const start = Math.min(idx1, idx2);
				const end = Math.max(idx1, idx2);
				const rangeIds = displayedTasks.slice(start, end + 1).map((t) => t.id);
				setSelectedTaskIds((prev) => {
					const next = new Set(prev);
					rangeIds.forEach((id) => next.add(id));
					return next;
				});
				return;
			}
		}
		if (selectedTaskIds.size > 0) {
			handleToggleSelect(task.id);
			return;
		}
		onOpenDetail(task);
	};

	const handleBatchAssignLists = async (listId: string) => {
		const ids = Array.from(selectedTaskIds);
		if (ids.length === 0) return;
		await db.transaction("rw", db.entries, async () => {
			for (const id of ids) {
				const item = await db.entries.get(id);
				if (item && item.type === "task") {
					const current = item.category_ids ?? [];
					const updated = current.includes(listId)
						? current.filter((cId) => cId !== listId)
						: [...current, listId];
					await db.entries.update(id, { category_ids: updated } as any);
				}
			}
		});
	};

	const handleBatchMoveFolder = async (folderId: string | undefined) => {
		const ids = Array.from(selectedTaskIds);
		if (ids.length === 0) return;
		await db.transaction("rw", db.entries, async () => {
			for (const id of ids) {
				await db.entries.update(id, { folder_id: folderId } as any);
			}
		});
		setBatchFolderPickerOpen(false);
	};

	const handleBatchChangeStatus = async (status: TaskStatus) => {
		const ids = Array.from(selectedTaskIds);
		if (ids.length === 0) return;
		await db.transaction("rw", db.entries, async () => {
			for (const id of ids) {
				if (status === "done") {
					await db.entries.update(id, {
						status: "done",
						completed_at: new Date(),
					} as any);
				} else {
					await db.entries.update(id, {
						status,
						completed_at: undefined,
					} as any);
				}
			}
		});
		setBatchStatusPickerOpen(false);
	};

	const handleBatchSchedule = async (targetDate: Date | null) => {
		const ids = Array.from(selectedTaskIds);
		if (ids.length === 0) return;
		await db.transaction("rw", db.entries, async () => {
			for (const id of ids) {
				if (targetDate === null) {
					await db.entries.update(id, { scheduled_at: undefined } as any);
				} else {
					await db.entries.update(id, { scheduled_at: targetDate } as any);
				}
			}
		});
		setBatchScheduleModalOpen(false);
	};

	const handleBatchDelete = async () => {
		const ids = Array.from(selectedTaskIds);
		if (ids.length === 0) return;
		await db.entries.bulkDelete(ids);
		setSelectedTaskIds(new Set());
	};

	const handleSelectAll = () => {
		const allIds = displayedTasks.map((t) => t.id);
		setSelectedTaskIds(new Set(allIds));
	};

	const handleClearSelection = () => {
		setSelectedTaskIds(new Set());
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
		const savedFolder =
			localStorage.getItem(`flowday-tasks-folder-tab-${view}`) ?? "all";
		setSelectedFolderTab(savedFolder);
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
		handleSelectFolderTab(newFolder.id);
	};

	const handleRenameFolder = async (folderId: string, newName: string) => {
		await db.list_folders.update(folderId, { name: newName });
	};

	const handleChangeFolderColor = async (folderId: string, newColor: string) => {
		await db.list_folders.update(folderId, { color: newColor } as any);
	};

	const handleDeleteFolder = async (folderId: string) => {
		await db.transaction("rw", db.list_folders, db.entries, async () => {
			await db.list_folders.delete(folderId);
			const folderTasks = allTasks.filter((t) => t.folder_id === folderId);
			for (const t of folderTasks) {
				await db.entries.update(t.id, { folder_id: undefined } as any);
			}
		});
		if (selectedFolderTab === folderId) {
			handleSelectFolderTab("all");
		}
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
			activationConstraint: { distance: 8 },
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
		// Dragged onto top tab chips
		if (overIdStr.startsWith("folder-tab-drop-")) {
			const targetTab = overIdStr.replace("folder-tab-drop-", "");
			if (targetTab === "unfiled" || targetTab === "root") {
				if (draggedTask.folder_id !== undefined) {
					await db.entries.update(activeTaskId, { folder_id: undefined } as any);
				}
				return;
			}
			if (targetTab !== "all" && draggedTask.folder_id !== targetTab) {
				await db.entries.update(activeTaskId, { folder_id: targetTab } as any);
				return;
			}
		}

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

	// Droppable refs for All and Unfiled top tabs
	const { setNodeRef: setTabAllNodeRef, isOver: isOverTabAll } = useDroppable({
		id: "folder-tab-drop-all",
		data: { folderId: "all" },
	});

	const { setNodeRef: setTabUnfiledNodeRef, isOver: isOverTabUnfiled } =
		useDroppable({
			id: "folder-tab-drop-unfiled",
			data: { folderId: undefined },
		});

	const { setNodeRef: setTabFlatNodeRef, isOver: isOverTabFlat } =
		useDroppable({
			id: "folder-tab-drop-flat",
			data: { folderId: "flat" },
		});

	// ─── Interactive Folder Tab / Filter Strip Panel ──────────────────────────
	const folderStripPanel = selectedView !== "paper" &&
		selectedView !== "trophy" && (
			<div className="flex items-center gap-1.5 overflow-x-auto py-1.5 scrollbar-none shrink-0 mb-3">
				<button
					type="button"
					onClick={handleCreateFolder}
					className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-all cursor-pointer shrink-0 active:scale-95"
					title="Create new folder"
				>
					<FolderPlus className="w-3.5 h-3.5" />
					<span>+ Folder</span>
				</button>

				{/* All Tasks Tab (Hierarchical with Folders) */}
				<button
					ref={setTabAllNodeRef}
					type="button"
					onClick={() => handleSelectFolderTab("all")}
					className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-semibold transition-all cursor-pointer border shrink-0 ${
						selectedFolderTab === "all"
							? "bg-white/[0.1] border-white/20 text-white shadow-sm font-bold"
							: "bg-white/[0.03] border-white/[0.08] text-stone-400 hover:text-stone-200 hover:bg-white/[0.06]"
					} ${isOverTabAll ? "ring-2 ring-amber-400 bg-amber-500/20" : ""}`}
					title="All Items (Grouped with Folder sections)"
				>
					<FolderTree className="w-3 h-3 text-stone-400 shrink-0" />
					<span>All</span>
					<span className="text-[9px] font-mono text-stone-500 tabular-nums ml-0.5">
						{displayedTasks.length}
					</span>
				</button>

				{/* Unfiled / General Tab (if folders exist) */}
				{currentListFolders.length > 0 && (
					<button
						ref={setTabUnfiledNodeRef}
						type="button"
						onClick={() => handleSelectFolderTab("unfiled")}
						className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-semibold transition-all cursor-pointer border shrink-0 ${
							selectedFolderTab === "unfiled"
								? "bg-white/[0.1] border-white/20 text-white shadow-sm font-bold"
								: "bg-white/[0.03] border-white/[0.08] text-stone-400 hover:text-stone-200 hover:bg-white/[0.06]"
						} ${isOverTabUnfiled ? "ring-2 ring-amber-400 bg-amber-500/20" : ""}`}
						title="General (Unfiled Items only)"
					>
						<span>General</span>
						<span className="text-[9px] font-mono text-stone-500 tabular-nums ml-0.5">
							{rootTasks.length}
						</span>
					</button>
				)}

				{/* No Folders (Flat All Items View) Tab (if folders exist) */}
				{currentListFolders.length > 0 && (
					<button
						ref={setTabFlatNodeRef}
						type="button"
						onClick={() => handleSelectFolderTab("flat")}
						className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-mono font-semibold transition-all cursor-pointer border shrink-0 ${
							selectedFolderTab === "flat"
								? "bg-white/[0.1] border-white/20 text-white shadow-sm font-bold"
								: "bg-white/[0.03] border-white/[0.08] text-stone-400 hover:text-stone-200 hover:bg-white/[0.06]"
						} ${isOverTabFlat ? "ring-2 ring-amber-400 bg-amber-500/20" : ""}`}
						title="All Items (Flat view without folder sections)"
					>
						<FolderMinus className="w-3 h-3 text-stone-400 shrink-0" />
						<span className="text-[9px] font-mono text-stone-500 tabular-nums">
							{displayedTasks.length}
						</span>
					</button>
				)}

				{/* Individual Folder Tabs */}
				{currentListFolders.map((folder) => {
					const fTasks = folderTasksMap[folder.id] ?? [];
					return (
						<FolderTabChip
							key={folder.id}
							folder={folder}
							isActive={selectedFolderTab === folder.id}
							count={fTasks.length}
							onSelect={() => handleSelectFolderTab(folder.id)}
							onRename={handleRenameFolder}
							onChangeColor={handleChangeFolderColor}
							onDelete={handleDeleteFolder}
						/>
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

	const renderTaskGroupList = (tasksToRender: Task[], isDesktop: boolean) => {
		if (statusFilter === "all") {
			return (
				<div className="space-y-4">
					{STATUS_GROUPS.map((group) => {
						const groupTasks = tasksToRender.filter(group.filterFn);
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
											viewLayout === "list" ? (
												<div className="space-y-1.5">
													{groupTasks.map((task) => (
														<DesktopTaskRow
															key={task.id}
															task={task}
															activeTaskId={activeTaskId}
															deletingId={deletingId}
															taskLists={taskLists}
															selectedListId={selectedView}
															availableFolders={availableFoldersForPicker}
															isSelected={selectedTaskIds.has(task.id)}
															onClickCard={handleTaskClick}
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
															isSelected={selectedTaskIds.has(task.id)}
															onClickCard={handleTaskClick}
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
											)
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
														isSelected={selectedTaskIds.has(task.id)}
														onClickCard={handleTaskClick}
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
			);
		}

		return (
			<SortableContext
				items={tasksToRender.map((t) => t.id)}
				strategy={verticalListSortingStrategy}
			>
				{isDesktop ? (
					viewLayout === "list" ? (
						<div className="space-y-1.5">
							{tasksToRender.map((task) => (
								<DesktopTaskRow
									key={task.id}
									task={task}
									activeTaskId={activeTaskId}
									deletingId={deletingId}
									taskLists={taskLists}
									selectedListId={selectedView}
									availableFolders={availableFoldersForPicker}
									isSelected={selectedTaskIds.has(task.id)}
									onClickCard={handleTaskClick}
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
						<div className={gridClass}>
							{tasksToRender.map((task) => (
								<DesktopTaskCard
									key={task.id}
									task={task}
									activeTaskId={activeTaskId}
									deletingId={deletingId}
									taskLists={taskLists}
									selectedListId={selectedView}
									availableFolders={availableFoldersForPicker}
									isSelected={selectedTaskIds.has(task.id)}
									onClickCard={handleTaskClick}
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
					)
				) : (
					<div className="space-y-1.5">
						{tasksToRender.map((task) => (
							<MobileTaskItem
								key={task.id}
								task={task}
								activeTaskId={activeTaskId}
								deletingId={deletingId}
								taskLists={taskLists}
								selectedListId={selectedView}
								availableFolders={availableFoldersForPicker}
								isSelected={selectedTaskIds.has(task.id)}
								onClickCard={handleTaskClick}
								isSwiped={activeSwipedTaskId === task.id}
								onSetSwiped={(swiped) =>
									setActiveSwipedTaskId(swiped ? task.id : null)
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
		);
	};

	const renderTaskContent = (isDesktop: boolean) => {
		// Flat All Items (without Folder sections)
		if (selectedFolderTab === "flat") {
			return (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<div className="space-y-4">
						{displayedTasks.length > 0 ? (
							renderTaskGroupList(displayedTasks, isDesktop)
						) : (
							<div className="py-20 text-center text-stone-500 select-none">
								<ListTodo className="w-10 h-10 text-stone-800 mx-auto mb-3" />
								<h4 className="font-mono font-medium text-xs text-stone-400 mb-1">
									{searchQuery.trim()
										? "No matching items found."
										: "List is empty."}
								</h4>
							</div>
						)}
					</div>
				</DndContext>
			);
		}

		// Specific Folder Tab Active
		if (selectedFolderTab !== "all" && selectedFolderTab !== "unfiled") {
			const activeFolder = currentListFolders.find(
				(f) => f.id === selectedFolderTab,
			);
			const fTasks = folderTasksMap[selectedFolderTab] ?? [];

			return (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<div className="space-y-4">
						{fTasks.length > 0 ? (
							renderTaskGroupList(fTasks, isDesktop)
						) : (
							<div
								onClick={() => {
									const input = document.getElementById("quick-task-input");
									if (input) input.focus();
								}}
								className="py-16 text-center text-stone-500 border border-dashed border-stone-800/80 rounded-2xl hover:border-amber-500/40 hover:text-stone-400 transition-all cursor-pointer select-none"
							>
								<Folder className="w-10 h-10 text-stone-800 mx-auto mb-2" />
								<p className="font-mono text-xs text-stone-300 font-medium">
									"{activeFolder?.name || "Folder"}" is empty
								</p>
								<p className="text-[11px] font-mono text-stone-600 mt-1">
									Type below and press Enter, or drag items into this folder.
								</p>
							</div>
						)}
					</div>
				</DndContext>
			);
		}

		// Unfiled Items Tab Active
		if (selectedFolderTab === "unfiled") {
			return (
				<DndContext
					sensors={sensors}
					collisionDetection={closestCenter}
					onDragEnd={handleDragEnd}
				>
					<div ref={setRootNodeRef} className="space-y-4">
						{rootTasks.length > 0 ? (
							renderTaskGroupList(rootTasks, isDesktop)
						) : (
							<div className="py-16 text-center text-stone-500 border border-dashed border-stone-800/80 rounded-2xl select-none">
								<Layers className="w-10 h-10 text-stone-800 mx-auto mb-2" />
								<p className="font-mono text-xs text-stone-300 font-medium">
									No unfiled items
								</p>
								<p className="text-[11px] font-mono text-stone-600 mt-1">
									All items in this list have been organized into folders.
								</p>
							</div>
						)}
					</div>
				</DndContext>
			);
		}

		// All Items Tab Active
		return (
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
			>
				<div className="space-y-6">
					{/* 1. Root / Unfolderized Items Section */}
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
							<div className="flex items-center justify-between mb-2.5 px-1">
								<span className="text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">
									General Items ({rootTasks.length})
								</span>
							</div>
						)}

						{rootTasks.length > 0 && renderTaskGroupList(rootTasks, isDesktop)}
					</div>

					{/* 2. Folders List Section */}
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
								selectedTaskIds={selectedTaskIds}
								onClickCard={handleTaskClick}
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
								viewLayout={viewLayout}
								gridClass={gridClass}
								showContent={showContent}
								statusFilter={statusFilter}
								onContextMenu={handleTaskContextMenu}
							/>
						);
					})}

					{/* Empty State when no root items and no folders */}
					{rootTasks.length === 0 && currentListFolders.length === 0 && (
						<div className="py-20 text-center text-stone-500 select-none">
							<ListTodo className="w-10 h-10 text-stone-800 mx-auto mb-3" />
							<h4 className="font-mono font-medium text-xs text-stone-400 mb-1">
								{searchQuery.trim()
									? "No matching items found."
									: "List is empty."}
							</h4>
							<p className="text-[11px] font-mono text-stone-600 max-w-sm mx-auto">
								Create an item using the input engine or add a folder to organize your backlog.
							</p>
						</div>
					)}
				</div>
			</DndContext>
		);
	};

	const activeViewInfo = useMemo(() => {
		if (selectedView === "all") {
			return {
				name: "All Items",
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
			name: "Items",
			icon: <ListTodo className="w-3.5 h-3.5" />,
			count: 0,
		};
	}, [selectedView, listTaskCounts, taskLists, listTasks]);

	const activeFolder = targetFolderId
		? allFolders.find((f) => f.id === targetFolderId)
		: selectedFolderTab !== "all" &&
			  selectedFolderTab !== "unfiled" &&
			  selectedFolderTab !== "flat"
			? allFolders.find((f) => f.id === selectedFolderTab)
			: null;

	const quickTaskInputBar = (
		<div className="pt-2 pb-1 shrink-0">
			<form
				onSubmit={handleQuickCreateTask}
				className="flex items-center gap-2 bg-[#121212]/95 backdrop-blur-md border border-stone-800 hover:border-stone-700 focus-within:border-amber-500/50 focus-within:ring-1 focus-within:ring-amber-500/20 rounded-2xl px-3 py-2 shadow-xl transition-all"
			>
				{/* Status selector toggle */}
				<div className="relative shrink-0">
					<button
						type="button"
						onClick={() => {
							setQuickTaskStatus((prev) =>
								prev === "todo"
									? "in_progress"
									: prev === "in_progress"
										? "maybe"
										: "todo",
							);
						}}
						className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-stone-900 border border-stone-800 text-[10px] font-mono font-bold uppercase tracking-wider text-stone-300 hover:text-stone-100 hover:border-stone-700 transition-all cursor-pointer"
						title="Click to toggle initial status (To Do / In Progress / Maybe)"
					>
						<span
							className={`w-2 h-2 rounded-full ${
								quickTaskStatus === "in_progress"
									? "bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]"
									: quickTaskStatus === "maybe"
										? "bg-indigo-400"
										: "bg-stone-400"
							}`}
						/>
						<span>
							{quickTaskStatus === "in_progress"
								? "Active"
								: quickTaskStatus === "maybe"
									? "Maybe"
									: "To Do"}
						</span>
					</button>
				</div>

				{/* Target folder badge if folder is targeted */}
				{activeFolder && (
					<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-[10px] font-mono font-semibold shrink-0">
						<Folder className="w-3 h-3 text-indigo-400" />
						<span className="truncate max-w-[90px]">{activeFolder.name}</span>
						<button
							type="button"
							onClick={() => setTargetFolderId(undefined)}
							className="hover:text-stone-100 cursor-pointer ml-0.5"
							title="Clear target folder"
						>
							<X className="w-3 h-3" />
						</button>
					</span>
				)}

				{/* Text input */}
				<input
					ref={quickTaskInputRef}
					id="quick-task-input"
					type="text"
					value={quickTaskTitle}
					onChange={(e) => setQuickTaskTitle(e.target.value)}
					placeholder={
						activeFolder
							? `Add item to "${activeFolder.name}"... (Press Enter to add)`
							: `Add item to ${activeViewInfo.name}... (Press Enter to add)`
					}
					className="flex-1 min-w-0 bg-transparent text-[13px] text-stone-100 placeholder-stone-500 focus:outline-none"
				/>

				{/* Star / Focus toggle */}
				<button
					type="button"
					onClick={() => setQuickTaskStarred(!quickTaskStarred)}
					className={`p-1.5 rounded-lg border transition-all cursor-pointer shrink-0 ${
						quickTaskStarred || selectedView === "paper"
							? "bg-amber-500/15 border-amber-500/30 text-amber-400"
							: "bg-transparent border-transparent text-stone-500 hover:text-stone-300 hover:bg-stone-800"
					}`}
					title={quickTaskStarred ? "Starred / In Paper List" : "Mark as Starred"}
				>
					<Star
						className={`w-3.5 h-3.5 ${
							quickTaskStarred || selectedView === "paper" ? "fill-current" : ""
						}`}
					/>
				</button>

				{/* Add button */}
				<button
					type="submit"
					disabled={!quickTaskTitle.trim()}
					className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-30 disabled:hover:bg-amber-500 text-stone-950 text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer disabled:cursor-not-allowed flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
				>
					<Plus className="w-3.5 h-3.5" />
					<span>Add</span>
				</button>
			</form>
		</div>
	);

	return (
		<div className="flex flex-col flex-1 h-full min-h-0 overflow-hidden" id="tasks-view-dashboard">
			{/* ── MOBILE: Full Height Flex with Sticky Docked Input ── */}
			<div className="md:hidden flex flex-col flex-1 h-full min-h-0 overflow-hidden">
				{/* Top Controls (Search / View Switcher / Status) */}
				<div className="shrink-0">
					{isMobileSearchOpen ? (
						<div className="flex items-center gap-2 py-1 mb-2">
							<div className="relative flex items-center flex-1">
								<Search className="absolute left-3 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
								<input
									autoFocus
									type="text"
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search items..."
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
									title="Search items"
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
				</div>

				{/* Scrollable Content */}
				<div
					className="flex-1 min-h-0 overflow-y-auto pr-0.5 my-1"
					style={{
						scrollbarWidth: "none",
						msOverflowStyle: "none",
					}}
				>
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

				{/* Sticky Bottom Docked Quick Task Input on Mobile */}
				{selectedView !== "trophy" && (
					<div className="shrink-0 bg-[#0a0a0a]/95 backdrop-blur-md pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)] border-t border-stone-850/80">
						{quickTaskInputBar}
					</div>
				)}
			</div>

			{/* ── DESKTOP: Two-column layout with Redesigned Sidebar ── */}
			<div className="hidden md:flex gap-0 flex-1 h-full min-h-0 overflow-hidden">
				{/* LEFT COLUMN — Sidebar */}
				<div className="w-[220px] lg:w-[270px] h-full overflow-y-auto shrink-0 flex flex-col min-h-0 border-r border-stone-800/60 pr-3 mr-3 font-sans">
					{/* Smart Views */}
					<div className="flex flex-col gap-1 pb-3 shrink-0">
						<span className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-500 px-2 py-0.5">
							Smart Views
						</span>

						<button
							onClick={() => handleSelectView("all")}
							className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
								selectedView === "all"
									? "bg-white/[0.08] border-white/20 text-white shadow-sm font-semibold"
									: "bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:text-stone-200"
							}`}
						>
							<Layers className="w-4 h-4 text-stone-300 shrink-0" />
							<span className="flex-1 min-w-0 text-[13px] font-medium truncate">
								All Items
							</span>
							<span className="text-[11px] font-mono text-stone-500 font-semibold tabular-nums">
								{listTaskCounts["all"]?.active ?? 0}
							</span>
						</button>

						<button
							onClick={() => handleSelectView("unassigned")}
							className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
								selectedView === "unassigned"
									? "bg-white/[0.08] border-white/20 text-white shadow-sm font-semibold"
									: "bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:text-stone-200"
							}`}
						>
							<Inbox className="w-4 h-4 text-stone-300 shrink-0" />
							<span className="flex-1 min-w-0 text-[13px] font-medium truncate">
								Unassigned
							</span>
							<span className="text-[11px] font-mono text-stone-500 font-semibold tabular-nums">
								{listTaskCounts["unassigned"]?.active ?? 0}
							</span>
						</button>

						<button
							onClick={() => handleSelectView("paper")}
							className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
								selectedView === "paper"
									? "bg-amber-500/15 border-amber-500/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)] font-semibold"
									: "bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:text-amber-300"
							}`}
						>
							<ClipboardList className="w-4 h-4 text-amber-400 shrink-0" />
							<span className="flex-1 min-w-0 text-[13px] font-medium truncate">
								Paper List
							</span>
							<span className="text-[9px] font-mono uppercase tracking-wider text-amber-500/80 font-bold">
								Focus
							</span>
						</button>

						<button
							onClick={() => handleSelectView("trophy")}
							className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all duration-150 cursor-pointer border ${
								selectedView === "trophy"
									? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)] font-semibold"
									: "bg-transparent border-transparent text-stone-400 hover:bg-stone-900 hover:text-amber-300"
							}`}
						>
							<Trophy className="w-4 h-4 text-amber-400 fill-amber-400 shrink-0" />
							<span className="flex-1 min-w-0 text-[13px] font-medium truncate">
								Accomplishments
							</span>
							<span className="text-[11px] font-mono text-amber-400 font-semibold tabular-nums">
								{listTaskCounts["trophy"]?.active ?? 0}
							</span>
						</button>
					</div>

					{/* Custom Lists Header */}
					<div className="pt-2.5 border-t border-stone-800/80 flex items-center justify-between px-2 mb-1.5 shrink-0">
						<span className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-500">
							Domains / Areas / Lists
						</span>
						<button
							type="button"
							onClick={() => setIsCreatingList(true)}
							className="p-1 rounded-md text-stone-500 hover:text-amber-400 hover:bg-stone-800 transition-colors cursor-pointer"
							title="Add new domain / list"
						>
							<Plus className="w-3.5 h-3.5" />
						</button>
					</div>

					{/* Custom Lists Sortable Reordering & Sub-Folders */}
					<DndContext
						sensors={listSensors}
						collisionDetection={closestCenter}
						onDragEnd={handleListDragEnd}
					>
						<SortableContext
							items={taskLists.map((l) => l.id)}
							strategy={verticalListSortingStrategy}
						>
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
									const listFolders = allFolders.filter(
										(f) => f.list_id === list.id,
									);

									return (
										<SortableSidebarListItem
											key={list.id}
											list={list}
											isActive={isActive}
											colorStyle={cs}
											counts={counts}
											listFolders={listFolders}
											isEditing={editingListId === list.id}
											editingName={editingListName}
											onStartRename={() => {
												setEditingListId(list.id);
												setEditingListName(list.name);
											}}
											onRenameChange={setEditingListName}
											onCommitRename={async () => {
												const trimmed = editingListName.trim();
												if (trimmed && trimmed !== list.name) {
													await db.categories.update(list.id, {
														name: trimmed,
													});
												}
												setEditingListId(null);
											}}
											onCancelRename={() => setEditingListId(null)}
											onSelect={() => handleSelectView(list.id)}
											onUpdateIcon={async (icon) => {
												await db.categories.update(list.id, { icon });
											}}
											onUpdateColor={async (color) => {
												await db.categories.update(list.id, { color });
											}}
											onDelete={() => handleDeleteList(list.id)}
											onFolderClick={(folderId) => {
												const el = document.getElementById(
													`folder-${folderId}`,
												);
												if (el) {
													el.scrollIntoView({
														behavior: "smooth",
														block: "start",
													});
												}
											}}
										/>
									);
								})}

								{/* Inline New List Creator */}
								{isCreatingList && (
									<div className="flex items-center gap-2 px-2.5 py-1.5 bg-[#141414] border border-amber-500/40 rounded-xl shadow-lg my-1">
										<div className="relative shrink-0">
											<button
												type="button"
												onClick={() =>
													setIsNewListPopoverOpen(!isNewListPopoverOpen)
												}
												className="p-1 rounded-lg bg-stone-900 border border-stone-800 hover:border-stone-700 cursor-pointer flex items-center justify-center"
												title="Change icon & color"
											>
												<CategoryIcon
													name={newListIcon}
													color={newListColor}
													className="w-4 h-4"
													fallback="ListTodo"
												/>
											</button>
											<InlineIconColorPopover
												isOpen={isNewListPopoverOpen}
												onClose={() => setIsNewListPopoverOpen(false)}
												currentIcon={newListIcon}
												currentColor={newListColor}
												fallbackIcon="ListTodo"
												onSelectIcon={setNewListIcon}
												onSelectColor={setNewListColor}
											/>
										</div>
										<input
											type="text"
											autoFocus
											placeholder="List name..."
											value={newListName}
											onChange={(e) => setNewListName(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") handleCommitCreateList();
												if (e.key === "Escape") setIsCreatingList(false);
											}}
											onBlur={handleCommitCreateList}
											className="flex-1 min-w-0 bg-transparent text-[13px] font-medium text-stone-100 placeholder-stone-600 focus:outline-none"
										/>
									</div>
								)}

								{/* Ghost "+ New D/A/L" Button */}
								{!isCreatingList && (
									<button
										type="button"
										onClick={() => setIsCreatingList(true)}
										className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-mono text-stone-500 hover:text-stone-300 hover:bg-stone-900/50 border border-dashed border-stone-800/80 hover:border-stone-700 transition-all cursor-pointer mt-1"
									>
										<Plus className="w-3.5 h-3.5 text-stone-500" />
										<span>+ New D/A/L</span>
									</button>
								)}
							</div>
						</SortableContext>
					</DndContext>
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
								<div className="flex items-center gap-2 flex-1 max-w-[280px] sm:max-w-sm">
									<div className="relative flex items-center flex-1">
										<Search className="absolute left-3 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
										<input
											type="text"
											value={searchQuery}
											onChange={(e) => setSearchQuery(e.target.value)}
											placeholder="Search items..."
											className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-white/[0.03] border border-white/[0.08] rounded-xl text-stone-200 placeholder-stone-500 focus:outline-none focus:border-indigo-400/50 focus:bg-white/[0.05] transition-all"
										/>
									</div>

									{/* Grid vs List View Mode Switcher */}
									<div className="flex items-center bg-white/[0.03] border border-white/[0.08] rounded-xl p-0.5 shrink-0">
										<button
											type="button"
											onClick={() => handleToggleViewLayout("grid")}
											className={`p-1.5 rounded-lg transition-all cursor-pointer ${
												viewLayout === "grid"
													? "bg-white/[0.12] text-white shadow-sm"
													: "text-stone-500 hover:text-stone-300"
											}`}
											title="Grid View (Cards)"
										>
											<LayoutGrid className="w-3.5 h-3.5" />
										</button>
										<button
											type="button"
											onClick={() => handleToggleViewLayout("list")}
											className={`p-1.5 rounded-lg transition-all cursor-pointer ${
												viewLayout === "list"
													? "bg-white/[0.12] text-white shadow-sm"
													: "text-stone-500 hover:text-stone-300"
											}`}
											title="Compact List View"
										>
											<List className="w-3.5 h-3.5" />
										</button>
									</div>
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

							{/* Docked Quick Task Input for Lists View */}
							{quickTaskInputBar}
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

			{/* Batch Modals */}
			{batchScheduleModalOpen && (
				<ScheduleCalendarModal
					task={
						{
							id: "batch",
							title: `${selectedTaskIds.size} Tasks`,
						} as Task
					}
					onClose={() => setBatchScheduleModalOpen(false)}
					onSelectDate={(_, date) => handleBatchSchedule(date)}
					onUnschedule={() => handleBatchSchedule(null)}
				/>
			)}

			{batchFolderPickerOpen && (
				<MoveToFolderModal
					task={
						{
							id: "batch",
							title: `${selectedTaskIds.size} Tasks`,
						} as Task
					}
					folders={availableFoldersForPicker}
					onClose={() => setBatchFolderPickerOpen(false)}
					onSelectFolder={(_, folderId) => handleBatchMoveFolder(folderId)}
				/>
			)}

			{batchListPickerOpen && (
				<AnimatePresence>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => setBatchListPickerOpen(false)}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4"
					>
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 8 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 8 }}
							onClick={(e) => e.stopPropagation()}
							className="w-full max-w-xs bg-[#141414] border border-stone-800 rounded-2xl shadow-2xl overflow-hidden font-sans"
						>
							<div className="flex items-center justify-between px-5 pt-4 pb-2 border-b border-stone-800/60">
								<div>
									<p className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400">
										Assign to Lists
									</p>
									<p className="text-xs font-serif font-semibold text-stone-200 line-clamp-1 mt-0.5">
										{selectedTaskIds.size} Tasks Selected
									</p>
								</div>
								<button
									onClick={() => setBatchListPickerOpen(false)}
									className="p-1 text-stone-500 hover:text-stone-300 rounded-lg transition-colors cursor-pointer"
								>
									<X className="w-4 h-4" />
								</button>
							</div>

							<div className="p-3 flex flex-col gap-1 max-h-60 overflow-y-auto">
								{taskLists.map((list) => {
									return (
										<button
											key={list.id}
											onClick={() => handleBatchAssignLists(list.id)}
											className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left transition-all cursor-pointer border border-transparent text-stone-300 hover:bg-stone-800/60 hover:text-white"
										>
											<CategoryIcon
												name={list.icon}
												color={list.color}
												className="w-3.5 h-3.5"
												fallback="ListTodo"
											/>
											<span className="flex-1 min-w-0 text-xs font-mono truncate">
												{list.name}
											</span>
										</button>
									);
								})}
							</div>
						</motion.div>
					</motion.div>
				</AnimatePresence>
			)}

			{batchStatusPickerOpen && (
				<AnimatePresence>
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => setBatchStatusPickerOpen(false)}
						className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1100] flex items-center justify-center p-4"
					>
						<motion.div
							initial={{ opacity: 0, scale: 0.95, y: 8 }}
							animate={{ opacity: 1, scale: 1, y: 0 }}
							exit={{ opacity: 0, scale: 0.95, y: 8 }}
							onClick={(e) => e.stopPropagation()}
							className="w-full max-w-xs bg-[#141414] border border-stone-800 rounded-2xl shadow-2xl overflow-hidden font-sans p-3 space-y-1"
						>
							<div className="flex items-center justify-between px-2 pt-1 pb-2 border-b border-stone-800/60">
								<p className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400">
									Change Status ({selectedTaskIds.size} Tasks)
								</p>
								<button
									onClick={() => setBatchStatusPickerOpen(false)}
									className="p-1 text-stone-500 hover:text-stone-300 rounded-lg cursor-pointer"
								>
									<X className="w-4 h-4" />
								</button>
							</div>
							{[
								{
									status: "todo",
									label: "To-do",
									icon: <CircleDashed className="w-3.5 h-3.5 text-stone-400" />,
								},
								{
									status: "in_progress",
									label: "In Progress",
									icon: <CircleDashed className="w-3.5 h-3.5 text-amber-400" />,
								},
								{
									status: "done",
									label: "Completed",
									icon: <Check className="w-3.5 h-3.5 text-emerald-400" />,
								},
								{
									status: "maybe",
									label: "Maybe / Later",
									icon: <CircleDashed className="w-3.5 h-3.5 text-indigo-400" />,
								},
								{
									status: "dropped",
									label: "Dropped",
									icon: <X className="w-3.5 h-3.5 text-rose-400" />,
								},
							].map((opt) => (
								<button
									key={opt.status}
									onClick={() =>
										handleBatchChangeStatus(opt.status as TaskStatus)
									}
									className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left text-xs font-mono text-stone-300 hover:bg-stone-800 hover:text-white transition-colors cursor-pointer"
								>
									{opt.icon}
									<span>{opt.label}</span>
								</button>
							))}
						</motion.div>
					</motion.div>
				</AnimatePresence>
			)}

			{/* Floating Multi-Select Action Bar */}
			<AnimatePresence>
				{selectedTaskIds.size > 0 && (
					<motion.div
						initial={{ opacity: 0, y: 30, scale: 0.95 }}
						animate={{ opacity: 1, y: 0, scale: 1 }}
						exit={{ opacity: 0, y: 30, scale: 0.95 }}
						transition={{ type: "spring", damping: 25, stiffness: 350 }}
						className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-[#141414]/95 border border-stone-800/90 rounded-2xl shadow-2xl shadow-black/80 backdrop-blur-xl font-mono text-xs select-none max-w-[95vw] overflow-x-auto"
					>
						<div className="flex items-center gap-2 pr-2 border-r border-stone-800 shrink-0">
							<span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
							<span className="text-stone-200 font-bold whitespace-nowrap">
								{selectedTaskIds.size} selected
							</span>
							<button
								onClick={
									selectedTaskIds.size === displayedTasks.length
										? handleClearSelection
										: handleSelectAll
								}
								className="text-[10px] text-stone-400 hover:text-stone-200 underline cursor-pointer ml-1 whitespace-nowrap"
							>
								{selectedTaskIds.size === displayedTasks.length
									? "Clear"
									: "Select All"}
							</button>
						</div>

						<button
							onClick={() => setBatchStatusPickerOpen(true)}
							className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-white hover:border-stone-700 transition-all cursor-pointer whitespace-nowrap shrink-0"
							title="Change status for selected tasks"
						>
							<CircleDashed className="w-3.5 h-3.5 text-stone-400" />
							<span className="hidden sm:inline">Status</span>
						</button>

						<button
							onClick={() => setBatchListPickerOpen(true)}
							className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-violet-300 hover:border-violet-500/40 transition-all cursor-pointer whitespace-nowrap shrink-0"
							title="Assign selected tasks to lists"
						>
							<ListTodo className="w-3.5 h-3.5 text-violet-400" />
							<span className="hidden sm:inline">Assign Lists</span>
						</button>

						{availableFoldersForPicker.length > 0 && (
							<button
								onClick={() => setBatchFolderPickerOpen(true)}
								className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-amber-300 hover:border-amber-500/40 transition-all cursor-pointer whitespace-nowrap shrink-0"
								title="Move selected tasks to folder"
							>
								<Folder className="w-3.5 h-3.5 text-amber-400" />
								<span className="hidden sm:inline">Folder</span>
							</button>
						)}

						<button
							onClick={() => setBatchScheduleModalOpen(true)}
							className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-stone-900 border border-stone-800 text-stone-300 hover:text-sky-300 hover:border-sky-500/40 transition-all cursor-pointer whitespace-nowrap shrink-0"
							title="Schedule selected tasks"
						>
							<Calendar className="w-3.5 h-3.5 text-sky-400" />
							<span className="hidden sm:inline">Schedule</span>
						</button>

						<button
							onClick={handleBatchDelete}
							className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-red-950/40 border border-red-900/50 text-red-300 hover:bg-red-900/60 transition-all cursor-pointer whitespace-nowrap shrink-0"
							title="Delete selected tasks"
						>
							<Trash2 className="w-3.5 h-3.5 text-red-400" />
							<span className="hidden sm:inline">Delete</span>
						</button>

						<button
							onClick={handleClearSelection}
							className="p-1 rounded-lg text-stone-500 hover:text-stone-300 transition-colors cursor-pointer ml-1 shrink-0"
							title="Clear selection (Esc)"
						>
							<X className="w-4 h-4" />
						</button>
					</motion.div>
				)}
			</AnimatePresence>

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
									<div className="flex items-center justify-between px-2 pb-1">
										<span className="text-[10px] uppercase font-bold tracking-widest text-stone-500">
											Custom Lists
										</span>
										<button
											type="button"
											onClick={() => setIsCreatingList(true)}
											className="p-1 rounded-md text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition-colors"
											title="Add new list"
										>
											<Plus className="w-3.5 h-3.5" />
										</button>
									</div>

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

									{/* Mobile Inline List Creator */}
									{isCreatingList ? (
										<div className="flex items-center gap-2 px-3 py-2 bg-[#141414] border border-amber-500/40 rounded-xl my-1">
											<input
												type="text"
												autoFocus
												placeholder="List name..."
												value={newListName}
												onChange={(e) => setNewListName(e.target.value)}
												onKeyDown={(e) => {
													if (e.key === "Enter") handleCommitCreateList();
													if (e.key === "Escape") setIsCreatingList(false);
												}}
												className="flex-1 min-w-0 bg-transparent text-xs text-stone-100 placeholder-stone-600 focus:outline-none"
											/>
											<button
												type="button"
												onClick={handleCommitCreateList}
												className="px-2.5 py-1 bg-amber-500 text-stone-950 rounded-lg text-[10px] font-bold uppercase"
											>
												Add
											</button>
											<button
												type="button"
												onClick={() => setIsCreatingList(false)}
												className="p-1 text-stone-500 hover:text-stone-300"
											>
												<X className="w-3.5 h-3.5" />
											</button>
										</div>
									) : (
										<button
											type="button"
											onClick={() => setIsCreatingList(true)}
											className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs text-stone-500 hover:text-stone-300 hover:bg-stone-900/50 border border-dashed border-stone-800/80 transition-all cursor-pointer mt-1"
										>
											<Plus className="w-3.5 h-3.5" />
											<span>New List</span>
										</button>
									)}
								</div>
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

			{/* ── Popovers and Modals ── */}
			{statusPickerTask && (
				<TaskStatusPickerPopover
					task={statusPickerTask}
					onClose={() => setStatusPickerTask(null)}
				/>
			)}

			{scheduleModalTask && (
				<ScheduleCalendarModal
					task={scheduleModalTask}
					onClose={() => setScheduleModalTask(null)}
					onSelectDate={(taskId, date) => {
						onCarryTask(taskId, date);
						setScheduleModalTask(null);
					}}
					onUnschedule={async (taskId) => {
						await db.entries.update(taskId, { scheduled_at: undefined } as any);
						setScheduleModalTask(null);
					}}
				/>
			)}

			{listPickerTaskId && (
				(() => {
					const t = allTasks.find((item) => item.id === listPickerTaskId);
					if (!t) return null;
					return (
						<ListPickerPopover
							task={t}
							lists={taskLists}
							onClose={() => setListPickerTaskId(null)}
						/>
					);
				})()
			)}

			{folderPickerTask && (
				<MoveToFolderModal
					task={folderPickerTask}
					folders={availableFoldersForPicker}
					onClose={() => setFolderPickerTask(null)}
					onSelectFolder={async (taskId, folderId) => {
						await handleMoveTaskToFolder(taskId, folderId);
						setFolderPickerTask(null);
					}}
				/>
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
					isSelected={selectedTaskIds.has(contextMenu.entry.id)}
					onToggleSelect={handleToggleSelect}
					selectedTaskIds={Array.from(selectedTaskIds)}
					onBatchDelete={handleBatchDelete}
					onBatchUpdateStatus={(ids, st) => handleBatchChangeStatus(st)}
					onBatchAssignList={(ids, lId) => handleBatchAssignLists(lId)}
					onBatchReschedule={(ids, d) => handleBatchSchedule(d)}
				/>
			)}
		</div>
	);
}
