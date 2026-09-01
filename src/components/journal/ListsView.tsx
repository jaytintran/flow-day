import React, {
	useState,
	useMemo,
	useRef,
	useEffect,
} from "react";
import {
	Search,
	Play,
	Calendar,
	Trash2,
	ListTodo,
	Check,
	ChevronLeft,
	ChevronRight,
	ChevronDown,
	X,
	ClipboardList,
	CircleDashed,
	Loader2,
	HelpCircle,
	Trophy,
	Folder,
	FolderPlus,
	FolderOpen,
	FolderInput,
	MoreHorizontal,
	Plus,
	Inbox,
	Layers,
	Printer,
	Sparkles,
	FileText,
	Star,
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
import SortableRow from "../SortableRow";
import { db } from "../../db";
import {
	TimelineEntry,
	Task,
	TaskStatus,
	Category,
	ListFolder,
} from "../../types";
import { useLiveQuery } from "dexie-react-hooks";
import TaskListManagerModal from "../TaskListManagerModal";
import CategoryIcon from "../CategoryIcon";
import { TASK_LIST_SCOPE } from "../../utils";

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

const CATEGORY_COLORS: Record<string, string> = {
	emerald: "border-emerald-500/30 text-emerald-400 bg-emerald-500/10",
	sky: "border-sky-500/30 text-sky-400 bg-sky-500/10",
	violet: "border-violet-500/30 text-violet-400 bg-violet-500/10",
	rose: "border-rose-500/30 text-rose-400 bg-rose-500/10",
	amber: "border-amber-500/30 text-amber-400 bg-amber-500/10",
	teal: "border-teal-500/30 text-teal-400 bg-teal-500/10",
	indigo: "border-indigo-500/30 text-indigo-400 bg-indigo-500/10",
	orange: "border-orange-500/30 text-orange-400 bg-orange-500/10",
};

const LIST_COLORS: Record<
	string,
	{ active: string; dot: string; glow: string }
> = {
	violet: {
		active: "bg-violet-500/15 border-violet-500/40 text-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.15)]",
		dot: "bg-violet-500",
		glow: "text-violet-400",
	},
	sky: {
		active: "bg-sky-500/15 border-sky-500/40 text-sky-300 shadow-[0_0_12px_rgba(14,165,233,0.15)]",
		dot: "bg-sky-500",
		glow: "text-sky-400",
	},
	emerald: {
		active: "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
		dot: "bg-emerald-500",
		glow: "text-emerald-400",
	},
	amber: {
		active: "bg-amber-500/15 border-amber-500/40 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
		dot: "bg-amber-500",
		glow: "text-amber-400",
	},
	rose: {
		active: "bg-rose-500/15 border-rose-500/40 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.15)]",
		dot: "bg-rose-500",
		glow: "text-rose-400",
	},
	indigo: {
		active: "bg-indigo-500/15 border-indigo-500/40 text-indigo-300 shadow-[0_0_12px_rgba(99,102,241,0.15)]",
		dot: "bg-indigo-500",
		glow: "text-indigo-400",
	},
	teal: {
		active: "bg-teal-500/15 border-teal-500/40 text-teal-300 shadow-[0_0_12px_rgba(20,184,166,0.15)]",
		dot: "bg-teal-500",
		glow: "text-teal-400",
	},
	orange: {
		active: "bg-orange-500/15 border-orange-500/40 text-orange-300 shadow-[0_0_12px_rgba(249,115,22,0.15)]",
		dot: "bg-orange-500",
		glow: "text-orange-400",
	},
};

function playCompleteSound() {
	try {
		const audioCtx = new (
			window.AudioContext || (window as any).webkitAudioContext
		)();
		const osc = audioCtx.createOscillator();
		const gain = audioCtx.createGain();
		osc.connect(gain);
		gain.connect(audioCtx.destination);
		osc.type = "triangle";
		osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
		osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
		gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.25);
		osc.start();
		osc.stop(audioCtx.currentTime + 0.25);
	} catch {}
}

// ─── Status Picker Popover ──────────────────────────────────────────────────

interface TaskStatusPickerPopoverProps {
	task: Task;
	onClose: () => void;
}

function TaskStatusPickerPopover({
	task,
	onClose,
}: TaskStatusPickerPopoverProps) {
	const currentStatus = task.status ?? "todo";

	const handleSelectStatus = async (status: TaskStatus) => {
		const isDone = status === "done";
		if (isDone && currentStatus !== "done") {
			playCompleteSound();
		}
		await db.entries.update(task.id, {
			status,
			completed_at: isDone ? new Date() : undefined,
		} as any);
		onClose();
	};

	const STATUS_OPTIONS: {
		status: TaskStatus;
		label: string;
		description: string;
		icon: React.ReactNode;
		colorClasses: string;
		activeClasses: string;
	}[] = [
		{
			status: "todo",
			label: "To Do",
			description: "Backlog / not started",
			icon: (
				<span className="w-3.5 h-3.5 rounded-full border border-stone-500 shrink-0" />
			),
			colorClasses: "text-stone-300 hover:bg-stone-800/80",
			activeClasses: "bg-stone-800 text-stone-100 border-stone-700",
		},
		{
			status: "in_progress",
			label: "In Progress",
			description: "Currently working on this",
			icon: <CircleDashed className="w-3.5 h-3.5 text-amber-400 shrink-0" />,
			colorClasses: "text-amber-300 hover:bg-amber-500/10",
			activeClasses: "bg-amber-500/20 text-amber-200 border-amber-500/40",
		},
		{
			status: "done",
			label: "Completed",
			description: "Finished task",
			icon: (
				<Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3] shrink-0" />
			),
			colorClasses: "text-emerald-300 hover:bg-emerald-500/10",
			activeClasses: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
		},
		{
			status: "dropped",
			label: "Dropped",
			description: "Cancelled or abandoned",
			icon: <X className="w-3.5 h-3.5 text-rose-400 stroke-[2.5] shrink-0" />,
			colorClasses: "text-rose-300 hover:bg-rose-500/10",
			activeClasses: "bg-rose-500/20 text-rose-200 border-rose-500/40",
		},
		{
			status: "maybe",
			label: "Maybe / Later",
			description: "Parked for later or undecided",
			icon: (
				<HelpCircle className="w-3.5 h-3.5 text-indigo-400 stroke-[2.5] shrink-0" />
			),
			colorClasses: "text-indigo-300 hover:bg-indigo-500/10",
			activeClasses: "bg-indigo-500/20 text-indigo-200 border-indigo-500/40",
		},
	];

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onClose}
				className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[1100] flex items-center justify-center p-4 font-sans"
			>
				<motion.div
					initial={{ opacity: 0, scale: 0.93, y: 12 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.93, y: 12 }}
					transition={{ type: "spring", damping: 26, stiffness: 260 }}
					onClick={(e) => e.stopPropagation()}
					className="w-full max-w-xs bg-[#131313] border border-stone-800 rounded-2xl shadow-2xl overflow-hidden"
				>
					<div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-stone-800/60">
						<div>
							<p className="text-[10px] font-mono font-bold uppercase tracking-widest text-stone-400">
								Change Status
							</p>
							<p className="text-xs font-serif font-semibold text-stone-200 line-clamp-1 mt-0.5">
								{task.title}
							</p>
						</div>
						<button
							onClick={onClose}
							className="p-1 text-stone-500 hover:text-stone-300 rounded-lg transition-colors cursor-pointer"
						>
							<X className="w-4 h-4" />
						</button>
					</div>

					<div className="p-3 flex flex-col gap-1.5">
						{STATUS_OPTIONS.map((opt) => {
							const isSelected = currentStatus === opt.status;
							return (
								<button
									key={opt.status}
									onClick={() => handleSelectStatus(opt.status)}
									className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl border text-left transition-all cursor-pointer ${
										isSelected
											? opt.activeClasses
											: `${opt.colorClasses} border-transparent`
									}`}
								>
									<div className="w-5 h-5 flex items-center justify-center shrink-0">
										{opt.icon}
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-xs font-mono font-bold leading-tight">
											{opt.label}
										</p>
										<p className="text-[10px] font-mono text-stone-500 leading-tight mt-0.5">
											{opt.description}
										</p>
									</div>
									{isSelected && (
										<Check className="w-3.5 h-3.5 shrink-0 stroke-[3]" />
									)}
								</button>
							);
						})}
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}

// ─── Schedule Calendar Modal ──────────────────────────────────────────────────

interface ScheduleCalendarModalProps {
	task: Task;
	onClose: () => void;
	onSelectDate: (taskId: string, date: Date) => void;
	onUnschedule: (taskId: string) => void;
}

function ScheduleCalendarModal({
	task,
	onClose,
	onSelectDate,
	onUnschedule,
}: ScheduleCalendarModalProps) {
	const today = new Date();
	const initialMonth = task.scheduled_at ? new Date(task.scheduled_at) : today;
	const [displayedMonth, setDisplayedMonth] = useState(
		new Date(initialMonth.getFullYear(), initialMonth.getMonth(), 1),
	);

	const year = displayedMonth.getFullYear();
	const month = displayedMonth.getMonth();
	const firstDayOfWeek = new Date(year, month, 1).getDay();
	const daysInMonth = new Date(year, month + 1, 0).getDate();
	const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

	const dayCells: (number | null)[] = [];
	for (let i = 0; i < firstDayOfWeek; i++) dayCells.push(null);
	for (let d = 1; d <= daysInMonth; d++) dayCells.push(d);

	const monthLabel = displayedMonth.toLocaleString("en-US", {
		month: "long",
		year: "numeric",
	});

	const isSameDay = (a: Date, b: Date) =>
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate();

	const handleDoToday = () => {
		onSelectDate(task.id, new Date());
		onClose();
	};

	const handleSelectDay = (day: number) => {
		const selected = new Date(year, month, day);
		const now = new Date();
		selected.setHours(
			now.getHours(),
			now.getMinutes(),
			now.getSeconds(),
			now.getMilliseconds(),
		);
		onSelectDate(task.id, selected);
		onClose();
	};

	const handleUnschedule = () => {
		onUnschedule(task.id);
		onClose();
	};

	const scheduledDate = task.scheduled_at ? new Date(task.scheduled_at) : null;

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				transition={{ duration: 0.15 }}
				className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
				onMouseDown={(e) => e.stopPropagation()}
				onClick={onClose}
			>
				<motion.div
					initial={{ opacity: 0, scale: 0.95, y: 8 }}
					animate={{ opacity: 1, scale: 1, y: 0 }}
					exit={{ opacity: 0, scale: 0.95, y: 8 }}
					transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
					className="bg-[#141414] border border-stone-800 rounded-2xl shadow-2xl w-[340px] max-w-[90vw] overflow-hidden"
					onClick={(e) => e.stopPropagation()}
				>
					<div className="flex items-center justify-between px-5 pt-4 pb-2">
						<div className="flex-1 min-w-0">
							<p className="text-[10px] font-mono text-stone-500 uppercase tracking-widest mb-1">
								Schedule Task
							</p>
							<p className="text-sm font-serif font-semibold text-stone-200 line-clamp-1">
								{task.title}
							</p>
						</div>
						<button
							onClick={onClose}
							className="p-1.5 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-colors cursor-pointer shrink-0 ml-2"
						>
							<X className="w-4 h-4" />
						</button>
					</div>

					<div className="px-5 pt-2 pb-3">
						<button
							onClick={handleDoToday}
							className="w-full py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-400 text-xs font-mono font-bold uppercase tracking-widest hover:bg-amber-500/20 hover:border-amber-500/40 transition-all cursor-pointer active:scale-[0.98]"
						>
							⚡ Do Today
						</button>
					</div>

					<div className="px-5 pb-4">
						<div className="flex items-center justify-between mb-3">
							<button
								onClick={() => setDisplayedMonth(new Date(year, month - 1, 1))}
								className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-500 hover:text-white transition-colors cursor-pointer"
							>
								<ChevronLeft className="w-3.5 h-3.5" />
							</button>
							<span className="font-mono text-[11px] text-stone-400 uppercase tracking-widest font-semibold">
								{monthLabel}
							</span>
							<button
								onClick={() => setDisplayedMonth(new Date(year, month + 1, 1))}
								className="p-1.5 hover:bg-stone-800 rounded-lg text-stone-500 hover:text-white transition-colors cursor-pointer"
							>
								<ChevronRight className="w-3.5 h-3.5" />
							</button>
						</div>

						<div className="grid grid-cols-7 text-center text-xs gap-1">
							{weekdays.map((wd) => (
								<span
									key={wd}
									className="text-stone-600 font-mono font-semibold py-1 text-[9px] uppercase tracking-widest"
								>
									{wd}
								</span>
							))}
							{dayCells.map((day, dIdx) => {
								if (day === null) return <span key={`blank-${dIdx}`} />;

								const cellDate = new Date(year, month, day);
								const isToday = isSameDay(cellDate, today);
								const isScheduledDay = scheduledDate
									? isSameDay(cellDate, scheduledDate)
									: false;

								return (
									<button
										key={`day-${day}`}
										onClick={() => handleSelectDay(day)}
										className={`py-1.5 text-[11px] font-mono rounded-lg transition-all cursor-pointer active:scale-95 ${
											isScheduledDay
												? "bg-amber-500 text-stone-950 font-bold shadow-[0_0_10px_rgba(245,158,11,0.25)]"
												: isToday
													? "border border-amber-500/30 text-amber-400 font-semibold hover:bg-amber-500/10"
													: "text-stone-400 hover:bg-stone-800/60 hover:text-stone-200"
										}`}
									>
										{day}
									</button>
								);
							})}
						</div>
					</div>

					{scheduledDate && (
						<div className="px-5 pb-4">
							<button
								onClick={handleUnschedule}
								className="w-full py-2 rounded-xl bg-stone-800/40 border border-stone-700/50 text-stone-400 text-[10px] font-mono font-bold uppercase tracking-widest hover:bg-stone-800/70 hover:text-stone-300 transition-all cursor-pointer"
							>
								Clear Scheduled Date
							</button>
						</div>
					)}
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}

// ─── List Picker Popover ────────────────────────────────────────────────────

interface ListPickerPopoverProps {
	task: Task;
	lists: Category[];
	onClose: () => void;
}

function ListPickerPopover({ task, lists, onClose }: ListPickerPopoverProps) {
	const currentListIds = task.category_ids ?? [];

	const handleToggleList = async (listId: string) => {
		const isAssigned = currentListIds.includes(listId);
		let updated: string[];
		if (isAssigned) {
			updated = currentListIds.filter((id) => id !== listId);
		} else {
			updated = [...currentListIds, listId];
		}
		await db.entries.update(task.id, { category_ids: updated } as any);
	};

	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onClose}
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
								{task.title}
							</p>
						</div>
						<button
							onClick={onClose}
							className="p-1 text-stone-500 hover:text-stone-300 rounded-lg transition-colors cursor-pointer"
						>
							<X className="w-4 h-4" />
						</button>
					</div>

					<div className="p-3 flex flex-col gap-1 max-h-60 overflow-y-auto">
						{lists.map((list) => {
							const isSelected = currentListIds.includes(list.id);
							return (
								<button
									key={list.id}
									onClick={() => handleToggleList(list.id)}
									className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left transition-all cursor-pointer border ${
										isSelected
											? "bg-violet-500/15 border-violet-500/30 text-violet-200"
											: "bg-transparent border-transparent text-stone-400 hover:bg-stone-800/60 hover:text-stone-200"
									}`}
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
									{isSelected && (
										<Check className="w-3.5 h-3.5 text-violet-400 shrink-0 stroke-[3]" />
									)}
								</button>
							);
						})}
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}

// ─── Move to Folder Modal ───────────────────────────────────────────────────

interface MoveToFolderModalProps {
	task: Task;
	folders: ListFolder[];
	onClose: () => void;
	onSelectFolder: (taskId: string, folderId: string | undefined) => void;
}

function MoveToFolderModal({
	task,
	folders,
	onClose,
	onSelectFolder,
}: MoveToFolderModalProps) {
	return (
		<AnimatePresence>
			<motion.div
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={onClose}
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
								Move to Folder
							</p>
							<p className="text-xs font-serif font-semibold text-stone-200 line-clamp-1 mt-0.5">
								{task.title}
							</p>
						</div>
						<button
							onClick={onClose}
							className="p-1 text-stone-500 hover:text-stone-300 rounded-lg transition-colors cursor-pointer"
						>
							<X className="w-4 h-4" />
						</button>
					</div>

					<div className="p-3 flex flex-col gap-1 max-h-60 overflow-y-auto">
						{/* Option: General / No Folder */}
						<button
							type="button"
							onClick={() => {
								onSelectFolder(task.id, undefined);
								onClose();
							}}
							className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left transition-all cursor-pointer border ${
								!task.folder_id
									? "bg-amber-500/15 border-amber-500/30 text-amber-300"
									: "bg-transparent border-transparent text-stone-400 hover:bg-stone-800/60 hover:text-stone-200"
							}`}
						>
							<Layers className="w-3.5 h-3.5 text-stone-400 shrink-0" />
							<span className="flex-1 min-w-0 text-xs font-mono truncate">
								General Tasks (No Folder)
							</span>
							{!task.folder_id && (
								<Check className="w-3.5 h-3.5 text-amber-400 shrink-0 stroke-[3]" />
							)}
						</button>

						{folders.map((folder) => {
							const isSelected = task.folder_id === folder.id;
							return (
								<button
									key={folder.id}
									type="button"
									onClick={() => {
										onSelectFolder(task.id, folder.id);
										onClose();
									}}
									className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-left transition-all cursor-pointer border ${
										isSelected
											? "bg-amber-500/15 border-amber-500/30 text-amber-300"
											: "bg-transparent border-transparent text-stone-400 hover:bg-stone-800/60 hover:text-stone-200"
									}`}
								>
									<Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
									<span className="flex-1 min-w-0 text-xs font-mono truncate">
										{folder.name}
									</span>
									{isSelected && (
										<Check className="w-3.5 h-3.5 text-amber-400 shrink-0 stroke-[3]" />
									)}
								</button>
							);
						})}
					</div>
				</motion.div>
			</motion.div>
		</AnimatePresence>
	);
}

// ─── Status Groups Definitions ────────────────────────────────────────────────

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

// ─── Mobile Task Item (Row with Swipe Left Tray) ─────────────────────────────

interface MobileTaskItemProps {
	task: Task;
	activeTaskId: string | null;
	deletingId: string | null;
	taskLists: Category[];
	selectedListId?: string;
	availableFolders?: ListFolder[];
	isSwiped?: boolean;
	onSetSwiped?: (swiped: boolean) => void;
	onDeleteEntry: (id: string) => void;
	onOpenDetail: (entry: TimelineEntry) => void;
	onToggleTaskStatus: (task: Task) => void;
	onOpenStatusModal: (task: Task) => void;
	onActivateTask: (taskId: string) => void;
	onOpenScheduleModal: (task: Task) => void;
	onOpenListPicker: (task: Task) => void;
	onOpenFolderPicker?: (task: Task) => void;
	onToggleAccomplishment?: (task: Task) => void;
	showContent?: boolean;
}

function MobileTaskItem({
	task,
	activeTaskId,
	deletingId,
	taskLists,
	selectedListId,
	availableFolders,
	isSwiped,
	onSetSwiped,
	onDeleteEntry,
	onOpenDetail,
	onToggleTaskStatus,
	onOpenStatusModal,
	onActivateTask,
	onOpenScheduleModal,
	onOpenListPicker,
	onOpenFolderPicker,
	onToggleAccomplishment,
	showContent = true,
}: MobileTaskItemProps) {
	const isActive = activeTaskId === task.id;
	const isDone = task.status === "done";
	const isDropped = task.status === "dropped";
	const isInProgress = task.status === "in_progress";
	const isMaybe = task.status === "maybe";
	const isAccomplishment =
		task.is_accomplishment ||
		task.starred ||
		(task.achievements && task.achievements.length > 0);

	const taskCategories = (task.category_ids ?? [])
		.map((id) => taskLists.find((list) => list.id === id))
		.filter((list): list is Category => !!list && list.id !== selectedListId);

	const [localSwiped, setLocalSwiped] = useState(false);
	const isMobileSwiped = isSwiped !== undefined ? isSwiped : localSwiped;
	const setIsMobileSwiped = (swiped: boolean) => {
		if (onSetSwiped) {
			onSetSwiped(swiped);
		} else {
			setLocalSwiped(swiped);
		}
	};

	const isDraggingSwipe = useRef(false);
	const isSwipeDisabled = isDone || isDropped;
	const hasFolders = !!(
		availableFolders &&
		availableFolders.length > 0 &&
		onOpenFolderPicker
	);

	let buttonCount = 2; // Schedule + Delete
	if (!isActive && !isDone && !isDropped) buttonCount += 1; // Activate
	if (taskLists.length > 0) buttonCount += 1; // List Picker
	if (hasFolders) buttonCount += 1; // Folder Picker
	const maxSwipeLeft = isSwipeDisabled ? 0 : -(buttonCount * 42 + 8);

	const hasMetadata = !!(
		(task.content && task.content.trim()) ||
		task.scheduled_at ||
		taskCategories.length > 0
	);

	return (
		<SortableRow id={task.id} disabled={false} hideHandle={false}>
			<div className="relative overflow-hidden rounded-xl">
				{/* Underlying Mobile Action Tray (Hidden until swiped, fade-in transition) */}
				{!isSwipeDisabled && (
					<div
						className={`absolute inset-y-0 right-0 flex items-center pr-2 gap-1.5 bg-transparent z-0 transition-opacity duration-200 ${
							isMobileSwiped ? "opacity-100" : "opacity-0 pointer-events-none"
						}`}
					>
						{!isDone && !isDropped && !isActive && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setIsMobileSwiped(false);
									onActivateTask(task.id);
								}}
								className="p-2 rounded-xl text-amber-400 bg-stone-900 border border-amber-500/30 hover:bg-stone-800 transition-colors cursor-pointer shadow-md"
								title="Activate timer"
							>
								<Play className="w-4 h-4 fill-current" />
							</button>
						)}

						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								setIsMobileSwiped(false);
								onOpenScheduleModal(task);
							}}
							className="p-2 rounded-xl text-stone-300 hover:text-amber-400 bg-stone-900 border border-stone-800 hover:border-stone-700 transition-colors cursor-pointer shadow-md"
							title="Schedule date"
						>
							<Calendar className="w-4 h-4" />
						</button>

						{taskLists.length > 0 && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setIsMobileSwiped(false);
									onOpenListPicker(task);
								}}
								className="p-2 rounded-xl text-stone-300 hover:text-violet-400 bg-stone-900 border border-stone-800 hover:border-stone-700 transition-colors cursor-pointer shadow-md"
								title="Assign to list"
							>
								<ListTodo className="w-4 h-4" />
							</button>
						)}

						{/* Move to Folder */}
						{hasFolders && onOpenFolderPicker && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									setIsMobileSwiped(false);
									onOpenFolderPicker(task);
								}}
								className="p-2 rounded-xl text-stone-300 hover:text-amber-300 bg-stone-900 border border-stone-800 hover:border-stone-700 transition-colors cursor-pointer shadow-md"
								title="Move to folder"
							>
								<FolderInput className="w-4 h-4" />
							</button>
						)}

						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								setIsMobileSwiped(false);
								onDeleteEntry(task.id);
							}}
							className={`p-2 rounded-xl transition-colors cursor-pointer shadow-md ${
								deletingId === task.id
									? "text-red-400 bg-red-950 border border-red-800"
									: "text-stone-300 hover:text-red-400 bg-stone-900 border border-stone-800 hover:border-stone-700"
							}`}
							title="Delete task"
						>
							<Trash2 className="w-4 h-4" />
						</button>
					</div>
				)}

				{/* Main Mobile Row Card */}
				<motion.div
					drag={isSwipeDisabled ? false : "x"}
					dragDirectionLock={true}
					dragConstraints={isSwipeDisabled ? { left: 0, right: 0 } : { left: maxSwipeLeft, right: 0 }}
					dragElastic={0.05}
					animate={{ x: !isSwipeDisabled && isMobileSwiped ? maxSwipeLeft : 0 }}
					style={{ willChange: "transform" }}
					onDragStart={() => {
						if (!isSwipeDisabled) {
							isDraggingSwipe.current = true;
						}
					}}
					onDragEnd={(_, info) => {
						if (isSwipeDisabled) return;
						setTimeout(() => {
							isDraggingSwipe.current = false;
						}, 100);
						if (info.offset.x < -35 || (info.offset.x < -15 && info.velocity.x < -80)) {
							setIsMobileSwiped(true);
						} else if (info.offset.x > 15 || info.velocity.x > 80) {
							setIsMobileSwiped(false);
						}
					}}
					onClick={() => {
						if (isDraggingSwipe.current) return;
						if (isMobileSwiped) {
							setIsMobileSwiped(false);
						} else {
							onOpenDetail(task);
						}
					}}
					className={`relative z-10 flex flex-col gap-1 px-3 py-2.5 rounded-xl border transition-colors cursor-pointer select-none touch-pan-y ${
						isActive
							? "bg-[#1c1608] border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
							: isDone
								? isAccomplishment
									? "bg-[#161410] border-amber-500/30 hover:border-amber-500/50"
									: "bg-[#111111] border-stone-800/40 opacity-70 hover:opacity-100 hover:border-stone-700"
								: isDropped
									? "bg-[#181111] border-rose-900/30 opacity-60"
									: isMaybe
										? "bg-[#141422] border-indigo-900/40 opacity-90 hover:opacity-100"
										: "bg-[#131313] border-stone-800/80 hover:border-stone-700 hover:bg-[#171717]"
					}`}
				>
					{/* Line 1: Checkbox + Full Width Title + Trophy */}
					<div className="flex items-center gap-2.5">
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onOpenStatusModal(task);
							}}
							className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95 ${
								isDone
									? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
									: isInProgress
										? "border-amber-500/50 bg-amber-500/10 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
										: isDropped
											? "border-rose-500/40 bg-rose-500/10 text-rose-400"
											: isMaybe
												? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400"
												: "border-stone-700 hover:border-stone-500 bg-stone-900/80 text-stone-400 hover:text-stone-200"
							}`}
							title="Click to change status"
						>
							{isDone && <Check className="w-3.5 h-3.5 stroke-[3]" />}
							{isInProgress && (
								<CircleDashed className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
							)}
							{isDropped && <X className="w-3.5 h-3.5 stroke-[2.5]" />}
							{isMaybe && <HelpCircle className="w-3.5 h-3.5 stroke-[2.5]" />}
						</button>

						<div className="flex-1 min-w-0">
							<span
								className={`text-xs font-serif font-medium leading-snug line-clamp-2 transition-colors ${
									isDone
										? isAccomplishment
											? "text-stone-300 font-medium"
											: "line-through text-stone-500"
										: isDropped
											? "line-through text-stone-500"
											: "text-stone-200"
								}`}
							>
								{isAccomplishment && <span className="mr-1">🏆</span>}
								{task.title}
							</span>
						</div>

						{/* Right Actions for Completed / Dropped Tasks */}
						{(isDone || isDropped) && (
							<div className="flex items-center gap-1 shrink-0">
								{isDone && (
									<button
										type="button"
										onClick={(e) => {
											e.stopPropagation();
											if (onToggleAccomplishment) {
												onToggleAccomplishment(task);
											} else {
												db.entries.update(task.id, {
													is_accomplishment: !task.is_accomplishment,
												} as any);
											}
										}}
										className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
											task.is_accomplishment
												? "bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.25)]"
												: "bg-stone-900/40 border-stone-800 text-stone-600 hover:text-amber-400"
										}`}
										title="Toggle Accomplishment"
									>
										<Trophy
											className={`w-3.5 h-3.5 ${
												task.is_accomplishment ? "fill-amber-400" : ""
											}`}
										/>
									</button>
								)}

								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										onDeleteEntry(task.id);
									}}
									className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
										deletingId === task.id
											? "bg-red-950 border-red-800 text-red-400"
											: "bg-stone-900/40 border-stone-800 text-stone-500 hover:text-red-400 hover:bg-stone-850"
									}`}
									title="Delete task"
								>
									<Trash2 className="w-3.5 h-3.5" />
								</button>
							</div>
						)}
					</div>

					{/* Line 2: Indented Metadata Sub-line (Text Pad icon, Scheduled Date, Category Badges) */}
					{hasMetadata && (
						<div className="flex items-center gap-1.5 flex-wrap pl-[30px] pt-0.5">
							{/* Description Text Pad Icon */}
							{task.content && task.content.trim() && (
								<span
									className="inline-flex items-center justify-center p-0.5 rounded bg-stone-900/80 border border-stone-800 text-stone-400 shrink-0"
									title="Has description"
								>
									<FileText className="w-2.5 h-2.5 text-stone-400" />
								</span>
							)}

							{/* Scheduled Date Badge */}
							{task.scheduled_at && (
								<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
									<Calendar className="w-2.5 h-2.5" />
									{new Date(task.scheduled_at).toLocaleDateString("en-US", {
										month: "short",
										day: "numeric",
									})}
								</span>
							)}

							{/* Category List Pills */}
							{taskCategories.map((cat) => (
								<span
									key={cat.id}
									className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider border shrink-0 ${
										CATEGORY_COLORS[cat.color] ?? CATEGORY_COLORS.violet
									}`}
								>
									<CategoryIcon
										name={cat.icon}
										color={cat.color}
										className="w-2.5 h-2.5"
										fallback="ListTodo"
									/>
									{cat.name}
								</span>
							))}
						</div>
					)}
				</motion.div>
			</div>
		</SortableRow>
	);
}

// ─── Desktop Task Card (No Swipe, Card Layout with Grid) ─────────────────────

interface DesktopTaskCardProps {
	task: Task;
	activeTaskId: string | null;
	deletingId: string | null;
	taskLists: Category[];
	selectedListId?: string;
	availableFolders?: ListFolder[];
	onDeleteEntry: (id: string) => void;
	onOpenDetail: (entry: TimelineEntry) => void;
	onToggleTaskStatus: (task: Task) => void;
	onOpenStatusModal: (task: Task) => void;
	onActivateTask: (taskId: string) => void;
	onOpenScheduleModal: (task: Task) => void;
	onOpenListPicker: (task: Task) => void;
	onOpenFolderPicker?: (task: Task) => void;
	onToggleAccomplishment?: (task: Task) => void;
	showContent?: boolean;
}

function DesktopTaskCard({
	task,
	activeTaskId,
	deletingId,
	taskLists,
	selectedListId,
	availableFolders,
	onDeleteEntry,
	onOpenDetail,
	onToggleTaskStatus,
	onOpenStatusModal,
	onActivateTask,
	onOpenScheduleModal,
	onOpenListPicker,
	onOpenFolderPicker,
	onToggleAccomplishment,
	showContent = true,
}: DesktopTaskCardProps) {
	const isActive = activeTaskId === task.id;
	const isDone = task.status === "done";
	const isDropped = task.status === "dropped";
	const isInProgress = task.status === "in_progress";
	const isMaybe = task.status === "maybe";
	const isAccomplishment =
		task.is_accomplishment ||
		task.starred ||
		(task.achievements && task.achievements.length > 0);

	const taskCategories = (task.category_ids ?? [])
		.map((id) => taskLists.find((list) => list.id === id))
		.filter((list): list is Category => !!list && list.id !== selectedListId);

	return (
		<SortableRow id={task.id} hideHandle>
			<div
				onClick={() => onOpenDetail(task)}
				className={`group relative flex flex-col justify-between gap-2.5 p-3 rounded-xl border transition-all cursor-pointer select-none min-h-[90px] ${
					isActive
						? "bg-amber-500/10 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
						: isDone
							? isAccomplishment
								? "bg-[#161410] border-amber-500/30 hover:border-amber-500/50"
								: "bg-[#111]/40 border-stone-850 opacity-70 hover:opacity-100 hover:border-stone-700"
							: isDropped
								? "bg-rose-950/10 border-rose-900/30 opacity-60"
								: isMaybe
									? "bg-indigo-950/10 border-indigo-900/30 opacity-80"
									: "bg-[#131313] border-stone-800/80 hover:border-stone-700 hover:bg-[#161616]"
				}`}
			>
				{/* Top Row: Checkbox + Title + Trophy */}
				<div className="flex items-start gap-2.5">
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onOpenStatusModal(task);
						}}
						className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center shrink-0 transition-all cursor-pointer active:scale-95 ${
							isDone
								? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.2)]"
								: isInProgress
									? "border-amber-500/50 bg-amber-500/10 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.2)]"
									: isDropped
										? "border-rose-500/40 bg-rose-500/10 text-rose-400"
										: isMaybe
											? "border-indigo-500/40 bg-indigo-500/10 text-indigo-400"
											: "border-stone-700 hover:border-stone-500 bg-stone-900/80 text-stone-400 hover:text-stone-200"
						}`}
						title="Click to change status"
					>
						{isDone && <Check className="w-2.5 h-2.5 stroke-[3]" />}
						{isInProgress && (
							<CircleDashed className="w-2.5 h-2.5 text-amber-400 stroke-[2.5]" />
						)}
						{isDropped && <X className="w-2.5 h-2.5 stroke-[2.5]" />}
						{isMaybe && <HelpCircle className="w-2.5 h-2.5 stroke-[2.5]" />}
					</button>

					<div className="flex-1 min-w-0">
						<span
							className={`text-xs font-serif font-semibold leading-snug line-clamp-2 transition-colors ${
								isDone
									? isAccomplishment
										? "text-stone-300"
										: "line-through text-stone-500"
									: isDropped
										? "line-through text-stone-500"
										: "text-stone-200 group-hover:text-amber-200"
							}`}
						>
							{isAccomplishment && <span className="mr-1">🏆</span>}
							{task.title}
						</span>
					</div>

					{isDone && (
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								if (onToggleAccomplishment) {
									onToggleAccomplishment(task);
								} else {
									db.entries.update(task.id, {
										is_accomplishment: !task.is_accomplishment,
									} as any);
								}
							}}
							className={`p-1 rounded-lg border transition-all cursor-pointer shrink-0 ${
								task.is_accomplishment
									? "bg-amber-500/20 border-amber-500/40 text-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.25)]"
									: "bg-stone-900/40 border-stone-800 text-stone-600 hover:text-amber-400"
							}`}
							title="Toggle Accomplishment"
						>
							<Trophy
								className={`w-3 h-3 ${
									task.is_accomplishment ? "fill-amber-400" : ""
								}`}
							/>
						</button>
					)}
				</div>

				{/* Bottom Row: Badges on Left, Always Visible Action Buttons on Right */}
				<div className="flex items-center justify-between gap-1 pt-1.5 border-t border-stone-850/60 mt-auto min-h-[26px]">
					{/* Badges on Left */}
					<div className="flex items-center gap-1 flex-wrap min-w-0">
						{/* Description Text Pad Icon at bottom left */}
						{task.content && task.content.trim() && (
							<span
								className="inline-flex items-center justify-center p-0.5 rounded bg-stone-900/80 border border-stone-800 text-stone-400 hover:text-amber-300 transition-colors shrink-0"
								title="Has description"
							>
								<FileText className="w-2.5 h-2.5 text-stone-400" />
							</span>
						)}

						{task.scheduled_at && (
							<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider bg-amber-500/10 border border-amber-500/30 text-amber-400 shrink-0">
								<Calendar className="w-2.5 h-2.5" />
								{new Date(task.scheduled_at).toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
								})}
							</span>
						)}

						{taskCategories.map((cat) => (
							<span
								key={cat.id}
								className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase tracking-wider border shrink-0 ${
									CATEGORY_COLORS[cat.color] ?? CATEGORY_COLORS.violet
								}`}
							>
								<CategoryIcon
									name={cat.icon}
									color={cat.color}
									className="w-2.5 h-2.5"
									fallback="ListTodo"
								/>
								{cat.name}
							</span>
						))}
					</div>

					{/* Quick Actions (Always visible on Desktop) */}
					<div className="flex items-center gap-0.5 shrink-0">
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onOpenStatusModal(task);
							}}
							className="p-1 rounded text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
							title="Change status"
						>
							<CircleDashed className="w-3 h-3" />
						</button>

						{!isDone && !isDropped && !isActive && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onActivateTask(task.id);
								}}
								className="p-1 rounded text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition-colors cursor-pointer"
								title="Activate timer"
							>
								<Play className="w-3 h-3 fill-current" />
							</button>
						)}

						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onOpenScheduleModal(task);
							}}
							className="p-1 rounded text-stone-400 hover:text-amber-400 hover:bg-stone-800 transition-colors cursor-pointer"
							title="Schedule date"
						>
							<Calendar className="w-3 h-3" />
						</button>

						{taskLists.length > 0 && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onOpenListPicker(task);
								}}
								className="p-1 rounded text-stone-400 hover:text-violet-400 hover:bg-stone-800 transition-colors cursor-pointer"
								title="Assign to list"
							>
								<ListTodo className="w-3 h-3" />
							</button>
						)}

						{/* Move to Folder */}
						{availableFolders && availableFolders.length > 0 && onOpenFolderPicker && (
							<button
								type="button"
								onClick={(e) => {
									e.stopPropagation();
									onOpenFolderPicker(task);
								}}
								className="p-1 rounded text-stone-400 hover:text-amber-300 hover:bg-stone-800 transition-colors cursor-pointer"
								title="Move to folder"
							>
								<FolderInput className="w-3 h-3" />
							</button>
						)}

						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								onDeleteEntry(task.id);
							}}
							className={`p-1 rounded transition-colors cursor-pointer ${
								deletingId === task.id
									? "text-red-400 bg-red-950/80 border border-red-800"
									: "text-stone-400 hover:text-red-400 hover:bg-stone-800"
							}`}
							title={
								deletingId === task.id ? "Click again to confirm" : "Delete"
							}
						>
							{deletingId === task.id ? (
								<span className="text-[8px] font-mono font-bold">Sure?</span>
							) : (
								<Trash2 className="w-3 h-3" />
							)}
						</button>
					</div>
				</div>
			</div>
		</SortableRow>
	);
}

// ─── Droppable Folder Section ────────────────────────────────────────────────

interface FolderCardProps {
	folder: ListFolder;
	tasks: Task[];
	isCollapsed: boolean;
	onToggleCollapse: () => void;
	onRenameFolder: (folderId: string, newName: string) => void;
	onDeleteFolder: (folderId: string) => void;
	activeTaskId: string | null;
	deletingId: string | null;
	taskLists: Category[];
	selectedListId?: string;
	availableFolders?: ListFolder[];
	activeSwipedTaskId?: string | null;
	onSetSwipedTaskId?: (taskId: string | null) => void;
	onDeleteEntry: (id: string) => void;
	onOpenDetail: (entry: TimelineEntry) => void;
	onToggleTaskStatus: (task: Task) => void;
	onOpenStatusModal: (task: Task) => void;
	onActivateTask: (taskId: string) => void;
	onOpenScheduleModal: (task: Task) => void;
	onOpenListPicker: (task: Task) => void;
	onOpenFolderPicker?: (task: Task) => void;
	onAddTaskToFolder: (folderId: string) => void;
	onToggleAccomplishment?: (task: Task) => void;
	isDesktop?: boolean;
	gridClass?: string;
	showContent?: boolean;
}

function FolderCard({
	folder,
	tasks,
	isCollapsed,
	onToggleCollapse,
	onRenameFolder,
	onDeleteFolder,
	activeTaskId,
	deletingId,
	taskLists,
	selectedListId,
	availableFolders,
	activeSwipedTaskId,
	onSetSwipedTaskId,
	onDeleteEntry,
	onOpenDetail,
	onToggleTaskStatus,
	onOpenStatusModal,
	onActivateTask,
	onOpenScheduleModal,
	onOpenListPicker,
	onOpenFolderPicker,
	onAddTaskToFolder,
	onToggleAccomplishment,
	isDesktop = false,
	gridClass = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5",
	showContent = true,
}: FolderCardProps) {
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [titleDraft, setTitleDraft] = useState(folder.name);
	const inputRef = useRef<HTMLInputElement>(null);

	const { setNodeRef, isOver } = useDroppable({
		id: `folder-drop-${folder.id}`,
		data: { folderId: folder.id },
	});

	useEffect(() => {
		if (isEditingTitle) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isEditingTitle]);

	const commitRename = () => {
		setIsEditingTitle(false);
		const trimmed = titleDraft.trim();
		if (trimmed && trimmed !== folder.name) {
			onRenameFolder(folder.id, trimmed);
		} else {
			setTitleDraft(folder.name);
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === "Escape") {
			commitRename();
		}
	};

	const [confirmDelete, setConfirmDelete] = useState(false);

	return (
		<div
			id={`folder-${folder.id}`}
			ref={setNodeRef}
			className={`rounded-2xl border transition-all duration-200 ${
				isOver
					? "border-amber-500/60 bg-amber-500/[0.04] shadow-[0_0_20px_rgba(245,158,11,0.1)]"
					: "border-stone-800/80 bg-[#101010]"
			}`}
		>
			{/* Folder Header */}
			<div className="flex items-center justify-between px-3.5 py-2.5 border-b border-stone-800/60 bg-[#141414]/90 rounded-t-2xl">
				<div className="flex items-center gap-2 flex-1 min-w-0">
					<button
						type="button"
						onClick={onToggleCollapse}
						className="p-1 rounded-lg text-stone-500 hover:text-stone-300 hover:bg-stone-800 transition-transform cursor-pointer"
					>
						<ChevronDown
							className={`w-3.5 h-3.5 transition-transform duration-200 ${
								isCollapsed ? "-rotate-90" : "rotate-0"
							}`}
						/>
					</button>

					{isCollapsed ? (
						<Folder className="w-4 h-4 text-amber-400 shrink-0" />
					) : (
						<FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
					)}

					{isEditingTitle ? (
						<input
							ref={inputRef}
							type="text"
							value={titleDraft}
							onChange={(e) => setTitleDraft(e.target.value)}
							onBlur={commitRename}
							onKeyDown={handleKeyDown}
							className="bg-[#0a0a0a] border border-amber-500/50 rounded px-2 py-0.5 text-xs font-mono font-bold text-amber-300 focus:outline-none flex-1 max-w-sm"
						/>
					) : (
						<span
							onClick={() => {
								setTitleDraft(folder.name);
								setIsEditingTitle(true);
							}}
							className="text-xs font-mono font-bold uppercase tracking-wider text-stone-200 hover:text-amber-300 transition-colors cursor-text truncate"
							title="Click to rename"
						>
							{folder.name}
						</span>
					)}

					<span className="text-[10px] font-mono text-stone-500 tabular-nums ml-1 shrink-0">
						({tasks.length})
					</span>
				</div>

				{/* Folder Actions */}
				<div className="flex items-center gap-1 shrink-0">
					<button
						type="button"
						onClick={() => onAddTaskToFolder(folder.id)}
						className="p-1 rounded-lg text-stone-500 hover:text-amber-300 hover:bg-stone-800 transition-colors cursor-pointer"
						title="Add task in folder"
					>
						<Plus className="w-3.5 h-3.5" />
					</button>

					<button
						type="button"
						onClick={() => {
							if (confirmDelete) {
								onDeleteFolder(folder.id);
							} else {
								setConfirmDelete(true);
								setTimeout(() => setConfirmDelete(false), 3000);
							}
						}}
						className={`p-1 rounded-lg transition-colors cursor-pointer ${
							confirmDelete
								? "text-red-400 bg-red-950/80 border border-red-800"
								: "text-stone-500 hover:text-red-400 hover:bg-stone-800"
						}`}
						title={
							confirmDelete
								? "Click again to confirm deleting folder"
								: "Delete folder"
						}
					>
						{confirmDelete ? (
							<span className="text-[9px] font-mono font-bold px-1">Sure?</span>
						) : (
							<Trash2 className="w-3.5 h-3.5" />
						)}
					</button>
				</div>
			</div>

			{/* Folder Tasks */}
			{!isCollapsed && (
				<div className="p-2.5">
					<SortableContext
						items={tasks.map((t) => t.id)}
						strategy={verticalListSortingStrategy}
					>
						{isDesktop ? (
							<div className={gridClass}>
								{tasks.map((task) => (
									<DesktopTaskCard
										key={task.id}
										task={task}
										activeTaskId={activeTaskId}
										deletingId={deletingId}
										taskLists={taskLists}
										selectedListId={selectedListId}
										availableFolders={availableFolders}
										onDeleteEntry={onDeleteEntry}
										onOpenDetail={onOpenDetail}
										onToggleTaskStatus={onToggleTaskStatus}
										onOpenStatusModal={onOpenStatusModal}
										onActivateTask={onActivateTask}
										onOpenScheduleModal={onOpenScheduleModal}
										onOpenListPicker={onOpenListPicker}
										onOpenFolderPicker={onOpenFolderPicker}
										onToggleAccomplishment={onToggleAccomplishment}
										showContent={showContent}
									/>
								))}
							</div>
						) : (
							<div className="space-y-1.5">
								{tasks.map((task) => (
									<MobileTaskItem
										key={task.id}
										task={task}
										activeTaskId={activeTaskId}
										deletingId={deletingId}
										taskLists={taskLists}
										selectedListId={selectedListId}
										availableFolders={availableFolders}
										isSwiped={activeSwipedTaskId === task.id}
										onSetSwiped={(swiped) =>
											onSetSwipedTaskId?.(swiped ? task.id : null)
										}
										onDeleteEntry={onDeleteEntry}
										onOpenDetail={onOpenDetail}
										onToggleTaskStatus={onToggleTaskStatus}
										onOpenStatusModal={onOpenStatusModal}
										onActivateTask={onActivateTask}
										onOpenScheduleModal={onOpenScheduleModal}
										onOpenListPicker={onOpenListPicker}
										onOpenFolderPicker={onOpenFolderPicker}
										onToggleAccomplishment={onToggleAccomplishment}
										showContent={showContent}
									/>
								))}
							</div>
						)}
					</SortableContext>

					{tasks.length === 0 && (
						<div
							onClick={() => onAddTaskToFolder(folder.id)}
							className="py-4 border border-dashed border-stone-800/70 rounded-xl text-center text-[11px] font-mono text-stone-600 hover:text-stone-400 hover:border-stone-700 transition-colors cursor-pointer select-none"
						>
							+ Add or drag tasks into {folder.name}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

// ─── Trophy View (Full Panel View) ───────────────────────────────────────────

interface TrophyViewProps {
	tasks: Task[];
	taskLists: Category[];
	onOpenDetail: (entry: TimelineEntry) => void;
	onToggleAccomplishment: (task: Task) => void;
}

function TrophyView({
	tasks,
	taskLists,
	onOpenDetail,
	onToggleAccomplishment,
}: TrophyViewProps) {
	const accomplishmentTasks = useMemo(() => {
		return tasks.filter(
			(t) => t.status === "done" && t.is_accomplishment === true,
		);
	}, [tasks]);

	const monthGroups = useMemo(() => {
		const map = new Map<
			string,
			{ key: string; label: string; year: number; tasks: Task[] }
		>();

		for (const task of accomplishmentTasks) {
			const date = task.completed_at
				? new Date(task.completed_at)
				: new Date(task.created_at);
			const year = date.getFullYear();
			const month = date.getMonth();
			const key = `${year}-${String(month).padStart(2, "0")}`;

			if (!map.has(key)) {
				const label = date.toLocaleString("en-US", {
					month: "long",
					year: "numeric",
				});
				map.set(key, { key, label, year, tasks: [] });
			}
			map.get(key)!.tasks.push(task);
		}

		const groups = Array.from(map.values()).sort((a, b) =>
			b.key.localeCompare(a.key),
		);

		for (const group of groups) {
			group.tasks.sort((a, b) => {
				const dateA = a.completed_at
					? new Date(a.completed_at).getTime()
					: new Date(a.created_at).getTime();
				const dateB = b.completed_at
					? new Date(b.completed_at).getTime()
					: new Date(b.created_at).getTime();
				return dateB - dateA;
			});
		}

		return groups;
	}, [accomplishmentTasks]);

	let lastDisplayedYear: number | null = null;

	return (
		<div className="h-full flex flex-col overflow-hidden bg-[#0c0c0c] border border-stone-800/80 rounded-2xl">
			{/* Clean Compact Bar */}
			<div className="px-5 py-2.5 border-b border-stone-800/60 flex items-center justify-between gap-3 shrink-0 bg-[#121212]/80">
				<div className="flex items-center gap-2">
					<Trophy className="w-4 h-4 text-amber-400 fill-amber-400" />
					<span className="font-mono text-xs font-bold text-amber-400">
						Accomplishments
					</span>
				</div>
				<span
					className="font-mono text-[11px] font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-lg"
					style={{
						textShadow:
							"0 0 8px rgba(245, 158, 11, 0.5), 0 0 16px rgba(245, 158, 11, 0.25)",
					}}
				>
					{accomplishmentTasks.length} total
				</span>
			</div>

			{/* Content */}
			<div
				className="flex-1 overflow-y-auto px-5 py-4 space-y-6 scrollbar-none"
				style={{ scrollbarWidth: "none" }}
			>
				{accomplishmentTasks.length === 0 ? (
					<div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
						<Trophy className="w-12 h-12 text-stone-800" />
						<h4 className="font-mono font-medium text-xs text-stone-400">
							No accomplishments marked yet.
						</h4>
						<p className="text-stone-600 text-xs font-mono max-w-sm">
							In the Completed status view, click the Trophy icon on any task to add it here.
						</p>
					</div>
				) : (
					monthGroups.map((group) => {
						let yearHeader = null;
						if (lastDisplayedYear !== group.year) {
							lastDisplayedYear = group.year;
							yearHeader = (
								<div
									className="flex items-center gap-2 mb-2"
									key={`year-${group.year}`}
								>
									<span className="font-mono text-[10px] text-amber-500/80 uppercase tracking-[0.2em] font-bold">
										{group.year}
									</span>
									<div className="flex-1 h-px bg-amber-500/20" />
								</div>
							);
						}

						return (
							<div key={group.key}>
								{yearHeader}
								<div className="flex items-center justify-between mb-3">
									<span className="font-mono text-[11px] text-stone-400 uppercase tracking-widest font-semibold">
										{group.label}
									</span>
									<span className="font-mono text-[10px] text-stone-600 font-mono">
										{group.tasks.length}{" "}
										{group.tasks.length === 1 ? "win" : "wins"}
									</span>
								</div>

								<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
									{group.tasks.map((task) => {
										const taskCategories = (task.category_ids ?? [])
											.map((id) => taskLists.find((list) => list.id === id))
											.filter((list): list is Category => !!list);

										const completedDateObj = task.completed_at
											? new Date(task.completed_at)
											: new Date(task.created_at);
										const completedFormatted = completedDateObj.toLocaleDateString("en-GB", {
											day: "2-digit",
											month: "2-digit",
											year: "2-digit",
										});

										return (
											<div
												key={task.id}
												onClick={() => onOpenDetail(task)}
												className="bg-[#121212] border border-amber-500/30 hover:border-amber-500/60 rounded-xl p-3 flex flex-col justify-between gap-2.5 transition-all cursor-pointer group shadow-[0_0_12px_rgba(245,158,11,0.06)]"
											>
												<div className="flex items-start gap-2.5">
													<div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-400 flex items-center justify-center shrink-0 mt-0.5 shadow-[0_0_6px_rgba(245,158,11,0.2)]">
														<Trophy className="w-3 h-3 fill-current" />
													</div>

													<div className="flex-1 min-w-0">
														<span className="text-xs font-serif font-semibold text-stone-200 group-hover:text-amber-200 leading-snug line-clamp-2 transition-colors">
															{task.title}
														</span>
														{task.content && task.content.trim() && (
															<p className="text-[10px] font-mono text-stone-500 mt-1 line-clamp-2 leading-relaxed">
																{task.content}
															</p>
														)}
													</div>
												</div>

												<div className="flex items-center justify-between flex-wrap gap-1 pt-2 border-t border-stone-800/80 mt-auto">
													<div className="flex items-center flex-wrap gap-1">
														<span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold tracking-wider bg-stone-900 border border-stone-800 text-stone-400">
															<Calendar className="w-2.5 h-2.5 text-amber-500/70" />
															{completedFormatted}
														</span>

														{taskCategories.map((cat) => {
															const colorClass =
																CATEGORY_COLORS[cat.color] ??
																CATEGORY_COLORS.violet;
															return (
																<span
																	key={cat.id}
																	className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider border shrink-0 ${colorClass}`}
																>
																	<CategoryIcon
																		name={cat.icon}
																		color={cat.color}
																		className="w-2.5 h-2.5"
																		fallback="ListTodo"
																	/>
																	{cat.name}
																</span>
															);
														})}
													</div>

													<div className="flex items-center gap-1">
														<button
															type="button"
															onClick={async (e) => {
																e.stopPropagation();
																await db.entries.update(task.id, {
																	starred: !task.starred,
																} as any);
															}}
															className={`p-1 rounded transition-colors ${
																task.starred
																	? "text-amber-400 hover:text-amber-300"
																	: "text-stone-500 hover:text-amber-400"
															}`}
															title={task.starred ? "Remove from Day Highlights" : "Add to Day Highlights"}
														>
															<Star
																className={`w-3 h-3 ${task.starred ? "fill-amber-400" : ""}`}
															/>
														</button>
														<button
															onClick={(e) => {
																e.stopPropagation();
																onToggleAccomplishment(task);
															}}
															className="text-[9px] font-mono text-stone-500 hover:text-red-400 transition-colors px-1"
															title="Remove from accomplishments"
														>
															Unmark
														</button>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						);
					})
				)}
			</div>
		</div>
	);
}

// ─── Paper List View (Full Panel View) ───────────────────────────────────────

interface PaperListViewProps {
	tasks: Task[];
	onToggleTaskStatus: (task: Task) => void;
	onOpenDetail: (entry: TimelineEntry) => void;
}

function PaperListView({
	tasks,
	onToggleTaskStatus,
	onOpenDetail,
}: PaperListViewProps) {
	const activeTasks = tasks.filter((t) => t.status !== "done");
	const doneTasks = tasks.filter((t) => t.status === "done");

	return (
		<div className="h-full flex flex-col overflow-hidden bg-[#0e0e0e] border border-stone-800/80 rounded-2xl">
			{/* Clean Compact Bar */}
			<div className="px-5 py-2.5 border-b border-stone-800/60 flex items-center justify-between gap-3 shrink-0 bg-[#141414]/80">
				<div className="flex items-center gap-2">
					<ClipboardList className="w-4 h-4 text-amber-400" />
					<span className="font-mono text-xs font-bold text-stone-200">
						Paper List
					</span>
				</div>

				<div className="flex items-center gap-3">
					<span className="font-mono text-[11px] text-stone-400 bg-stone-900 border border-stone-800 px-2.5 py-0.5 rounded-lg">
						{activeTasks.length} pending · {doneTasks.length} done
					</span>
					<button
						onClick={() => window.print()}
						className="p-1 rounded-lg border border-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors cursor-pointer"
						title="Print Paper List"
					>
						<Printer className="w-3.5 h-3.5" />
					</button>
				</div>
			</div>

			{/* List Body */}
			<div
				className="flex-1 overflow-y-auto p-6 space-y-6 font-mono text-xs"
				style={{ scrollbarWidth: "thin" }}
			>
				{activeTasks.length === 0 && doneTasks.length === 0 && (
					<p className="text-stone-600 text-center py-20">
						No tasks in your backlog.
					</p>
				)}

				{activeTasks.length > 0 && (
					<div className="space-y-2">
						<h4 className="text-[10px] uppercase font-bold tracking-widest text-amber-500/90 mb-3">
							To Do ({activeTasks.length})
						</h4>
						{activeTasks.map((t) => (
							<div
								key={t.id}
								className="flex items-start gap-3 py-2 border-b border-stone-800/50 group hover:border-stone-700 transition-colors"
							>
								<button
									onClick={() => onToggleTaskStatus(t)}
									className="w-4 h-4 mt-0.5 rounded border border-stone-600 hover:border-amber-400 flex items-center justify-center shrink-0 cursor-pointer"
								/>
								<span
									onClick={() => onOpenDetail(t)}
									className="text-stone-200 flex-1 min-w-0 cursor-pointer hover:text-amber-300 transition-colors"
								>
									{t.title}
								</span>
							</div>
						))}
					</div>
				)}

				{doneTasks.length > 0 && (
					<div className="space-y-2 pt-6">
						<h4 className="text-[10px] uppercase font-bold tracking-widest text-emerald-500/80 mb-3">
							Completed ({doneTasks.length})
						</h4>
						{doneTasks.map((t) => (
							<div
								key={t.id}
								className="flex items-start gap-3 py-1.5 border-b border-stone-900/40 opacity-50 line-through group"
							>
								<button
									onClick={() => onToggleTaskStatus(t)}
									className="w-4 h-4 mt-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center shrink-0 cursor-pointer"
								>
									<Check className="w-2.5 h-2.5 stroke-[3]" />
								</button>
								<span
									onClick={() => onOpenDetail(t)}
									className="text-stone-400 flex-1 min-w-0 cursor-pointer"
								>
									{t.title}
								</span>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}

// ─── Main ListsView Component ───────────────────────────────────────────────

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

	// Available folders to pick when moving a task on mobile/desktop (shows all folders if in 'all' view or list has none)
	const availableFoldersForPicker = useMemo(() => {
		if (selectedView === "all") return allFolders;
		return currentListFolders.length > 0 ? currentListFolders : allFolders;
	}, [selectedView, allFolders, currentListFolders]);

	// Dateless backlog tasks only for ListsView (excludes scheduled tasks, which belong to Day/Timeline views)
	const allTasks = useMemo(
		() =>
			entries.filter(
				(e): e is Task => e.type === "task" && !e.scheduled_at,
			),
		[entries],
	);

	// All completed accomplishment tasks across the entire database (strictly is_accomplishment === true)
	const accomplishmentTasks = useMemo(
		() =>
			entries.filter(
				(e): e is Task =>
					e.type === "task" &&
					e.status === "done" &&
					e.is_accomplishment === true,
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
		let tasks = allTasks;

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
	}, [allTasks, selectedView, searchQuery, taskLists]);

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
	}, [allTasks, taskLists]);

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

	// ─── Tasks Content Container (Folders in all status views) ────────────────

	// Desktop cards per row setting (1, 2, 3, 4)
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

	// ─── Tasks Content Container (Separate for Mobile Rows & Desktop Cards) ──

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
							/* Sectionize all types based on their status within General Tasks under persistent collapsible groups */
							<div className="space-y-4">
								{STATUS_GROUPS.map((group) => {
									const groupTasks = rootTasks.filter(group.filterFn);
									if (groupTasks.length === 0) return null;
									const isGroupCollapsed = !!collapsedStatusGroups[group.key];

									return (
										<div key={group.key} className="space-y-2">
											{/* Status Group Header */}
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

											{/* Status Group Task Items */}
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
							/* Single status filter: render flat grid/list */
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
					/* Expanded Search Bar */
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
					/* Row 1: View Selector on the left & search button | Status Selector on the right */
					<div className="flex items-center justify-between gap-2 py-1 mb-2">
						{/* Left: View Selector + Search Button */}
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

						{/* Right: Status Selector (Only for task lists) */}
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
						/>
					) : selectedView === "paper" ? (
						<PaperListView
							tasks={listTasks}
							onToggleTaskStatus={onToggleTaskStatus}
							onOpenDetail={onOpenDetail}
						/>
					) : (
						renderTaskContent(false)
					)}
				</div>
			</div>

			{/* ── DESKTOP: Two-column layout with Redesigned Sidebar ── */}
			<div className="hidden md:flex gap-0 h-[600px] overflow-hidden">
				{/* LEFT COLUMN — Redesigned Sidebar with Pinned Views & Lists */}
				<div className="w-[210px] lg:w-[270px] h-full overflow-y-auto shrink-0 flex flex-col min-h-0 border-r border-stone-800/60 pr-3 mr-3 font-sans">
					{/* ── Section 1: Pinned / Smart Views ── */}
					<div className="flex flex-col gap-1 pb-3 shrink-0">
						<span className="text-[9px] font-mono font-bold uppercase tracking-widest text-stone-500 px-2 py-0.5">
							Smart Views
						</span>

						{/* All Tasks */}
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

						{/* Unassigned / Inbox */}
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

						{/* Paper List View */}
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

						{/* Accomplishments View */}
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

					{/* ── Divider & Lists Section Header ── */}
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

					{/* ── Section 2: Custom Lists & Sub-Folders ── */}
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

									{/* Indented Folders under active list */}
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

				{/* RIGHT COLUMN — Active Panel (Tasks / Trophy / Paper) */}
				<div className="flex-1 min-w-0 min-h-0 flex flex-col h-full">
					{selectedView === "trophy" ? (
						<TrophyView
							tasks={accomplishmentTasks}
							taskLists={taskLists}
							onOpenDetail={onOpenDetail}
							onToggleAccomplishment={handleToggleAccomplishment}
						/>
					) : selectedView === "paper" ? (
						<PaperListView
							tasks={listTasks}
							onToggleTaskStatus={onToggleTaskStatus}
							onOpenDetail={onOpenDetail}
						/>
					) : (
						<>
							{/* Top Bar for Task Lists: Search + Status Switcher */}
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

							{/* Folder Strip Panel */}
							{folderStripPanel}

							{/* Scrollable Tasks List (Desktop Cards Grid) */}
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

			{/* Schedule Modal */}
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

			{/* Status Picker Popover */}
			{statusPickerTask && (
				<TaskStatusPickerPopover
					task={statusPickerTask}
					onClose={() => setStatusPickerTask(null)}
				/>
			)}

			{/* List Picker Popover */}
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

			{/* Move to Folder Modal */}
			{folderPickerTask && (
				<MoveToFolderModal
					task={folderPickerTask}
					folders={availableFoldersForPicker}
					onClose={() => setFolderPickerTask(null)}
					onSelectFolder={handleMoveTaskToFolder}
				/>
			)}

			{/* Mobile View Picker Bottom Sheet */}
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
							{/* Sheet Header */}
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

							{/* Options List */}
							<div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-xs">
								{/* Smart Views */}
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

								{/* Custom Lists */}
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

							{/* Sheet Footer */}
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

			{/* Mobile Status Selector Bottom Sheet */}
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

			{/* List Manager Modal */}
			{isListManagerOpen && (
				<TaskListManagerModal onClose={() => setIsListManagerOpen(false)} />
			)}
		</div>
	);
}
