import React, { useEffect, useState, useRef } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "../../db";
import {
	TimelineEntry,
	Task,
	Event,
	Note,
	TimeBlock,
	TaskAchievement,
} from "../../types";
import {
	formatDuration,
	toLocalDateString,
	getEffectiveDate,
} from "../../utils";
import DetailSheet from "../DetailSheet";
import DayView from "./DayView";
import TimelineView from "./TimelineView";
import RecordsView from "./RecordsView";
import ListsView from "./ListsView";
import GoalsSheet from "../GoalsSheet";
import ObjectivesSheet from "../ObjectivesSheet";
import HabitsSheet from "../HabitsSheet";
import HubCanvas from "./hub/HubCanvas";
import GenericEntitySheet from "./hub/GenericEntitySheet";

import FocusSheet from "../FocusSheet";
import { Delete, Trash, Star, Pin, Sparkles, X, Trophy } from "lucide-react";
import MarkdownPreview from "../MarkdownPreview";

interface JournalProps {
	activeDate: Date;
	setActiveDate: (date: Date) => void;
	viewMode: "day" | "timeline" | "records" | "lists" | "hub";
	activeTaskId: string | null;
	setActiveTaskId: (id: string | null) => void;
	activeHubTab?: "goals" | "objectives" | "habits" | "focus" | string;
	setActiveHubTab?: (tab: "goals" | "objectives" | "habits" | "focus" | string) => void;
}

// ─── EditableChip ───────────────────────────────────────────────────────────

function parseDuration(raw: string): number | null {
	const s = raw.trim().toLowerCase();
	if (!s || s === "0") return 0;

	// h:mm:ss or mm:ss
	const colonMatch = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
	if (colonMatch) {
		const a = parseInt(colonMatch[1]);
		const b = parseInt(colonMatch[2]);
		const c = colonMatch[3] ? parseInt(colonMatch[3]) : null;
		if (c !== null) return (a * 3600 + b * 60 + c) * 1000;
		return (a * 60 + b) * 1000;
	}

	// 1h 30m 20s — all parts optional but at least one required
	const unitMatch = s.match(
		/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/,
	);
	if (unitMatch && (unitMatch[1] || unitMatch[2] || unitMatch[3])) {
		const h = parseInt(unitMatch[1] ?? "0");
		const m = parseInt(unitMatch[2] ?? "0");
		const sec = parseInt(unitMatch[3] ?? "0");
		return (h * 3600 + m * 60 + sec) * 1000;
	}

	return null;
}

function formatDurationEditable(ms: number): string {
	const totalSec = Math.floor(ms / 1000);
	const h = Math.floor(totalSec / 3600);
	const m = Math.floor((totalSec % 3600) / 60);
	const s = totalSec % 60;
	if (h > 0) return `${h}h ${m}m ${s}s`;
	if (m > 0) return `${m}m ${s}s`;
	return `${s}s`;
}

interface EditableChipProps {
	label: string;
	value: Date; // the raw Date for datetime mode
	displayValue: string; // human-readable string shown on chip
	mode: "datetime" | "duration";
	durationValue?: number; // ms for duration mode
	chipClass?: string;
	onSave: (d: Date) => Promise<void>; // datetime mode
	onSaveDuration?: (raw: string) => Promise<void>; // duration mode
}

// Human-readable date display: relative for today/yesterday, short format otherwise
function formatChipDate(d: Date): string {
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(today.getTime() - 86400000);
	const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

	const time = d.toLocaleTimeString("en-US", {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	});

	if (targetDay.getTime() === today.getTime()) return `Today ${time}`;
	if (targetDay.getTime() === yesterday.getTime()) return `Yesterday ${time}`;

	const dd = String(d.getDate()).padStart(2, "0");
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	return `${dd}/${mm} ${time}`;
}

function EditableChip({
	label,
	value,
	displayValue,
	mode,
	durationValue,
	chipClass = "",
	onSave,
	onSaveDuration,
}: EditableChipProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [draftDate, setDraftDate] = useState("");
	const [draftTime, setDraftTime] = useState("");
	const [draftDuration, setDraftDuration] = useState("");
	const [invalid, setInvalid] = useState(false);
	const dateRef = useRef<HTMLInputElement>(null);
	const timeRef = useRef<HTMLInputElement>(null);
	const durationRef = useRef<HTMLInputElement>(null);

	const toDateInput = (d: Date) => {
		const yyyy = d.getFullYear();
		const mm = String(d.getMonth() + 1).padStart(2, "0");
		const dd = String(d.getDate()).padStart(2, "0");
		return `${yyyy}-${mm}-${dd}`;
	};

	const toTimeInput = (d: Date) => {
		const hh = String(d.getHours()).padStart(2, "0");
		const mi = String(d.getMinutes()).padStart(2, "0");
		return `${hh}:${mi}`;
	};

	const open = () => {
		if (mode === "datetime") {
			setDraftDate(toDateInput(value));
			setDraftTime(toTimeInput(value));
			setInvalid(false);
			setIsEditing(true);
			setTimeout(() => dateRef.current?.focus(), 0);
		} else {
			setDraftDuration(formatDurationEditable(durationValue ?? 0));
			setInvalid(false);
			setIsEditing(true);
			setTimeout(() => durationRef.current?.focus(), 0);
		}
	};

	const cancel = () => {
		setIsEditing(false);
		setInvalid(false);
	};

	const commitDatetime = async () => {
		if (!draftDate || !draftTime) {
			setInvalid(true);
			return;
		}
		const d = new Date(`${draftDate}T${draftTime}:00`);
		if (isNaN(d.getTime())) {
			setInvalid(true);
			return;
		}
		await onSave(d);
		setIsEditing(false);
		setInvalid(false);
	};

	const commitDuration = async () => {
		if (!onSaveDuration) return;
		if (parseDuration(draftDuration) === null) {
			setInvalid(true);
			return;
		}
		await onSaveDuration(draftDuration);
		setIsEditing(false);
		setInvalid(false);
	};

	if (!isEditing) {
		return (
			<button
				onClick={open}
				className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-mono border transition-colors hover:border-amber-500/40 hover:text-amber-400 cursor-pointer ${chipClass}`}
			>
				<span className="text-stone-500 font-medium">{label}</span>
				<span>{displayValue}</span>
			</button>
		);
	}

	// ── DATE + TIME SPLIT EDIT (datetime mode) ──
	if (mode === "datetime") {
		return (
			<div className="flex items-center gap-1.5">
				<input
					ref={dateRef}
					type="date"
					value={draftDate}
					onChange={(e) => setDraftDate(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Escape") cancel();
					}}
					onBlur={() => {
						// Commit only if the other field isn't focused
						setTimeout(() => {
							if (document.activeElement !== timeRef.current) commitDatetime();
						}, 100);
					}}
					className={`bg-[#0a0a0a] border rounded px-2 py-1 text-xs font-mono focus:outline-none transition-colors ${
						invalid
							? "border-red-500/70 text-red-400 focus:border-red-500"
							: "border-amber-500/40 text-amber-300 focus:border-amber-500"
					}`}
				/>
				<input
					ref={timeRef}
					type="time"
					value={draftTime}
					onChange={(e) => setDraftTime(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") commitDatetime();
						if (e.key === "Escape") cancel();
					}}
					onBlur={() => {
						setTimeout(() => {
							if (document.activeElement !== dateRef.current) commitDatetime();
						}, 100);
					}}
					className={`bg-[#0a0a0a] border rounded px-2 py-1 text-xs font-mono focus:outline-none transition-colors ${
						invalid
							? "border-red-500/70 text-red-400 focus:border-red-500"
							: "border-amber-500/40 text-amber-300 focus:border-amber-500"
					}`}
				/>
				<button
					onMouseDown={(e) => {
						e.preventDefault();
						cancel();
					}}
					className="text-xs font-mono text-stone-500 hover:text-stone-300 px-1 cursor-pointer"
				>
					✕
				</button>
			</div>
		);
	}

	// ── DURATION EDIT ──
	return (
		<div className="flex items-center gap-1">
			<input
				ref={durationRef}
				type="text"
				value={draftDuration}
				onChange={(e) => {
					setDraftDuration(e.target.value);
					setInvalid(parseDuration(e.target.value) === null);
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter") commitDuration();
					if (e.key === "Escape") cancel();
				}}
				onBlur={commitDuration}
				className={`bg-[#0a0a0a] border rounded px-2 py-1 text-xs font-mono focus:outline-none transition-colors w-24 ${
					invalid
						? "border-red-500/70 text-red-400 focus:border-red-500"
						: "border-amber-500/40 text-amber-300 focus:border-amber-500"
				}`}
			/>
			<button
				onMouseDown={(e) => {
					e.preventDefault();
					cancel();
				}}
				className="text-xs font-mono text-stone-500 hover:text-stone-300 px-1 cursor-pointer"
			>
				✕
			</button>
		</div>
	);
}

// ─── MicroWinRow ─────────────────────────────────────────────────────────

interface MicroWinRowProps {
	win: MicroWin;
	formatTime: (d: Date | string) => string;
	onSave: (text: string) => Promise<void>;
	onDelete: () => Promise<void>;
}

function MicroWinRow({
	win,
	formatTime,
	onSave,
	onDelete,
}: MicroWinRowProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(win.text);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const open = () => {
		setDraft(win.text);
		setIsEditing(true);
		setTimeout(() => {
			const el = inputRef.current;
			if (el) {
				el.focus();
			}
		}, 0);
	};

	const commit = async () => {
		const text = draft.trim();
		if (!text) {
			await onDelete();
			setIsEditing(false);
			return;
		}
		if (text === win.text) {
			setIsEditing(false);
			return;
		}
		await onSave(text);
		setIsEditing(false);
	};

	const handleDelete = async () => {
		if (confirmDelete) {
			await onDelete();
			return;
		}
		setConfirmDelete(true);
		setTimeout(() => setConfirmDelete(false), 3000);
	};

	return (
		<div className="group flex items-center gap-2 text-xs font-mono text-stone-300 bg-stone-900/60 border border-stone-850 hover:border-amber-500/20 rounded-lg px-2.5 py-1.5 transition-all">
			<Sparkles className="w-3 h-3 text-amber-500/70 shrink-0 select-none" />
			<div className="flex-1 min-w-0 flex items-center justify-between gap-2">
				<div className="flex-1 min-w-0">
					{isEditing ? (
						<input
							ref={inputRef}
							type="text"
							value={draft}
							onChange={(e) => {
								setDraft(e.target.value);
							}}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									commit();
								}
								if (e.key === "Escape") setIsEditing(false);
							}}
							onBlur={commit}
							className="w-full bg-[#0a0a0a] border border-amber-500/40 rounded px-2 py-0.5 text-xs font-mono text-amber-300 focus:outline-none focus:border-amber-500"
						/>
					) : (
						<p
							className="break-words cursor-text hover:text-amber-300 transition-colors line-clamp-2"
							onClick={open}
						>
							{win.text}
						</p>
					)}
				</div>
				{!isEditing && (
					<div className="flex items-center gap-1 shrink-0">
						<span className="text-[9px] text-stone-600 font-mono hidden sm:inline">
							{formatTime(new Date(win.created_at))}
						</span>
						<button
							onClick={handleDelete}
							className={`text-xs font-mono px-1 transition-colors cursor-pointer ${
								confirmDelete ? "text-red-400" : "text-stone-600 hover:text-red-400"
							}`}
							title={
								confirmDelete ? "Click again to delete" : "Delete outcome"
							}
						>
							{confirmDelete ? "Confirm" : <X className="w-3.5 h-3.5" />}
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

export default function Journal({
	activeDate,
	setActiveDate,
	viewMode,
	activeTaskId,
	setActiveTaskId,
	activeHubTab,
	setActiveHubTab,
}: JournalProps) {
	const [highlightedDay, setHighlightedDay] = useState<string | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	// Selected entry for detail and edit modal
	const [selectedEntry, setSelectedEntry] = useState<TimelineEntry | null>(
		null,
	);
	const [isDetailOpen, setIsDetailOpen] = useState(false);
	const [editTitle, setEditTitle] = useState("");
	const [editContent, setEditContent] = useState("");
	const [isEditingContent, setIsEditingContent] = useState(false);
	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [editTimestamp, setEditTimestamp] = useState("");
	const [editStartAt, setEditStartAt] = useState("");
	const [editEndAt, setEditEndAt] = useState("");

	const [selectedPurposeId, setSelectedPurposeId] = useState<string | null>(
		null,
	);
	const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);

	const allPurposes = (useLiveQuery(() => db.purposes.toArray()) ||
		[]) as Purpose[];

	const highlightPurposeIds = React.useMemo(() => {
		if (selectedPurposeId) return [selectedPurposeId];
		if (selectedDomainId) {
			return allPurposes
				.filter((p) => (p.domain_ids ?? []).includes(selectedDomainId))
				.map((p) => p.id);
		}
		return null;
	}, [selectedPurposeId, selectedDomainId, allPurposes]);
	const highlightDomainId = selectedPurposeId ? null : selectedDomainId;

	// Helper: format a Date to "YYYY-MM-DD" for date input
	const toDateInputValue = (d: Date): string => {
		const yyyy = d.getFullYear();
		const mm = (d.getMonth() + 1).toString().padStart(2, "0");
		const dd = d.getDate().toString().padStart(2, "0");
		return `${yyyy}-${mm}-${dd}`;
	};

	// Helper: format a Date to "HH:MM" for time input
	const toTimeInputValue = (d: Date): string => {
		const hh = d.getHours().toString().padStart(2, "0");
		const mm = d.getMinutes().toString().padStart(2, "0");
		return `${hh}:${mm}`;
	};

	// Sync edit state when selectedEntry changes
	useEffect(() => {
		if (!selectedEntry) return;
		const titleVal =
			selectedEntry.type === "note"
				? (selectedEntry as Note).title || ""
				: selectedEntry.title || "";
		setEditTitle(titleVal);
		setIsEditingTitle(titleVal.trim() === "");

		if (
			selectedEntry.type === "note" ||
			selectedEntry.type === "event" ||
			selectedEntry.type === "task"
		) {
			const contentVal = (selectedEntry as Note | Event | Task).content || "";
			setEditContent(contentVal);
			setIsEditingContent(contentVal.trim() === "");
		} else {
			setEditContent("");
			setIsEditingContent(false);
		}

		if (selectedEntry.type === "event" || selectedEntry.type === "note") {
			const ts = new Date((selectedEntry as Event | Note).timestamp);
			setEditTimestamp(toDateInputValue(ts) + "T" + toTimeInputValue(ts));
		}

		if (selectedEntry.type === "time-block") {
			const tb = selectedEntry as TimeBlock;
			const s = new Date(tb.start_at);
			const e = new Date(tb.end_at);
			setEditStartAt(toDateInputValue(s) + "T" + toTimeInputValue(s));
			setEditEndAt(toDateInputValue(e) + "T" + toTimeInputValue(e));
		}
	}, [selectedEntry]);

	// Open detail sheet for a given entry
	const handleOpenDetail = (entry: TimelineEntry) => {
		setSelectedEntry(entry);
		setIsDetailOpen(true);
	};

	// Close detail sheet and persist changes
	const handleCloseDetail = async () => {
		if (!selectedEntry) return;

		const id = selectedEntry.id;
		const type = selectedEntry.type;

		switch (type) {
			case "note": {
				await db.entries.update(id, {
					title: editTitle.trim(),
					content: editContent.trim(),
				} as any);
				break;
			}
			case "task": {
				await db.entries.update(id, {
					title: editTitle.trim(),
					content: editContent.trim(),
				} as any);
				break;
			}
			case "event": {
				const newTimestamp = editTimestamp
					? new Date(editTimestamp)
					: undefined;
				await db.entries.update(id, {
					title: editTitle.trim(),
					content: editContent.trim(),
					...(newTimestamp ? { timestamp: newTimestamp } : {}),
				} as any);
				break;
			}
			case "time-block": {
				const newStart = editStartAt ? new Date(editStartAt) : undefined;
				const newEnd = editEndAt ? new Date(editEndAt) : undefined;
				await db.entries.update(id, {
					title: editTitle.trim(),
					...(newStart ? { start_at: newStart } : {}),
					...(newEnd ? { end_at: newEnd } : {}),
				} as any);
				break;
			}
		}

		setIsDetailOpen(false);
		setSelectedEntry(null);
	};

	const handleCancelDetail = () => {
		setIsDetailOpen(false);
		setSelectedEntry(null);
	};

	// Mobile detection
	const [isMobile, setIsMobile] = useState(false);
	useEffect(() => {
		const checkMobile = () => setIsMobile(window.innerWidth < 768);
		checkMobile();
		window.addEventListener("resize", checkMobile);
		return () => window.removeEventListener("resize", checkMobile);
	}, []);

	// Track which days are collapsed in timeline view
	const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

	const toggleDayCollapse = (dayStr: string) => {
		setCollapsedDays((prev) => {
			const next = new Set(prev);
			if (next.has(dayStr)) {
				next.delete(dayStr);
			} else {
				next.add(dayStr);
			}
			return next;
		});
	};

	// Read all timeline entries reactive from Dexie.js (filter out objectives & goals — they live in their own sheets)
	const entries = (useLiveQuery(() => db.entries.toArray()) || []).filter(
		(e) => e.type !== "objective" && e.type !== "goal",
	);

	// Group and sort logic for Day View and Timeline View
	const getEntrySortTime = (e: TimelineEntry): number => {
		// For tasks: first available of completed_at → scheduled_at → created_at
		if (e.type === "task") {
			if (e.completed_at) return new Date(e.completed_at).getTime();
			if (e.scheduled_at) return new Date(e.scheduled_at).getTime();
			return new Date(e.created_at).getTime();
		}
		// For non-tasks: carried_to → natural timestamp (events/notes: timestamp, time-blocks: start_at)
		return getEffectiveDate(e).getTime();
	};

	// Strike sounds
	function playStrikeSound() {
		const ctx = new AudioContext();
		const duration = 0.35;
		const sampleRate = ctx.sampleRate;
		const buffer = ctx.createBuffer(1, sampleRate * duration, sampleRate);
		const data = buffer.getChannelData(0);

		for (let i = 0; i < data.length; i++) {
			const t = i / data.length;
			// Slow attack, long sustain, tail fade
			const envelope = Math.pow(t, 0.15) * Math.pow(1 - t, 1.5);
			// Layered noise: fast + slow modulation = pencil texture
			const noise = Math.random() * 2 - 1;
			const scrape = Math.sin(t * 800) * 0.15; // subtle periodic scrape texture
			data[i] = (noise + scrape) * envelope;
		}

		const source = ctx.createBufferSource();
		source.buffer = buffer;

		// Bandpass centered on pencil scratch frequencies
		const filter1 = ctx.createBiquadFilter();
		filter1.type = "bandpass";
		filter1.frequency.value = 4000;
		filter1.Q.value = 0.6;

		// Second filter for that papery hiss on top
		const filter2 = ctx.createBiquadFilter();
		filter2.type = "highpass";
		filter2.frequency.value = 2500;

		// Frequency sweep: starts lower, rises as pencil drags across
		filter1.frequency.setValueAtTime(2000, ctx.currentTime);
		filter1.frequency.linearRampToValueAtTime(5500, ctx.currentTime + 0.35);

		const gain = ctx.createGain();
		gain.gain.value = 0.5;

		source.connect(filter1);
		filter1.connect(filter2);
		filter2.connect(gain);
		gain.connect(ctx.destination);

		source.start();
		source.onended = () => ctx.close();
	}

	// Toggles status of Task
	const handleToggleTaskStatus = async (task: Task) => {
		const isDone = task.status === "done";
		const nextStatus = isDone ? "todo" : "done";

		if (nextStatus === "done") playStrikeSound();

		let completionDate: Date | undefined = undefined;
		if (nextStatus === "done") {
			const now = new Date();
			const target = new Date(activeDate);
			// If activeDate is today, use current real time
			const isToday =
				target.getFullYear() === now.getFullYear() &&
				target.getMonth() === now.getMonth() &&
				target.getDate() === now.getDate();

			if (isToday) {
				completionDate = now;
			} else {
				// Anchor to activeDate using task's scheduled time or midday/evening
				completionDate = new Date(target);
				if (task.scheduled_at) {
					const sched = new Date(task.scheduled_at);
					completionDate.setHours(sched.getHours(), sched.getMinutes(), 0, 0);
				} else {
					completionDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds(), 0);
				}
			}
		}

		await db.entries.update(task.id, {
			status: nextStatus,
			completed_at: completionDate,
		} as any);
	};

	const [deletingId, setDeletingId] = useState<string | null>(null);

	// Delete entry helper
	const handleDeleteEntry = async (id: string) => {
		if (deletingId === id) {
			await db.entries.delete(id);
			if (activeTaskId === id) {
				setActiveTaskId(null);
			}
			setDeletingId(null);
		} else {
			setDeletingId(id);
			setTimeout(() => {
				setDeletingId((prev) => (prev === id ? null : prev));
			}, 3000);
		}
	};

	// Quick activate a task for the timer bar
	const handleActivateTask = async (taskId: string) => {
		setActiveTaskId(taskId);
		const entry = await db.entries.get(taskId);
		if (
			entry &&
			entry.type === "task" &&
			!entry.scheduled_at &&
			entry.status !== "in_progress"
		) {
			await db.entries.update(taskId, { status: "in_progress" } as any);
		}
	};

	// Carry a task to a new date (by updating scheduled_at)
	const handleCarryTask = async (taskId: string, targetDate: Date) => {
		await db.entries.update(taskId, {
			scheduled_at: targetDate,
			carried_to: undefined,
		} as any);
	};

	// Find overdue tasks (todo status, and effective date is prior to activeDate)
	const activeDayStr = toLocalDateString(activeDate);
	const overdueTasks = React.useMemo(() => {
		return entries.filter((e) => {
			if (e.type !== "task" || e.status !== "todo") return false;
			// Exclude dateless tasks from overdue check
			if (!e.scheduled_at) return false;
			const taskDayStr = toLocalDateString(getEffectiveDate(e));
			return taskDayStr < activeDayStr;
		}) as Task[];
	}, [entries, activeDayStr]);

	const handleImportAllOverdue = async () => {
		if (overdueTasks.length === 0) return;
		await db.transaction("rw", db.entries, async () => {
			for (const t of overdueTasks) {
				const oldD = getEffectiveDate(t);
				const newD = new Date(activeDate);
				newD.setHours(
					oldD.getHours(),
					oldD.getMinutes(),
					oldD.getSeconds(),
					oldD.getMilliseconds(),
				);
				await db.entries.update(t.id, {
					scheduled_at: newD,
					carried_to: undefined,
				} as any);
			}
		});
	};

	const handleRescheduleAllOverdue = async (targetDate: Date) => {
		if (overdueTasks.length === 0) return;
		await db.transaction("rw", db.entries, async () => {
			for (const t of overdueTasks) {
				const oldD = getEffectiveDate(t);
				const newD = new Date(targetDate);
				newD.setHours(
					oldD.getHours(),
					oldD.getMinutes(),
					oldD.getSeconds(),
					oldD.getMilliseconds(),
				);
				await db.entries.update(t.id, {
					scheduled_at: newD,
					carried_to: undefined,
				} as any);
			}
		});
	};

	// Time picker: persist updated time to DB
	const handleTimePickerConfirm = async (
		entry: TimelineEntry,
		newDate: Date,
	) => {
		const id = entry.id;
		switch (entry.type) {
			case "task": {
				const task = entry as Task;
				const field = task.status === "done" ? "completed_at" : "scheduled_at";
				await db.entries.update(id, { [field]: newDate } as any);
				break;
			}
			case "event":
			case "note":
			case "log":
			case "habit-log":
				await db.entries.update(id, { timestamp: newDate } as any);
				break;
		}
	};

	// Formats time strings to elegant short format (e.g. 10:45 AM)
	const formatTime = (dateInput: Date | string): string => {
		const d = new Date(dateInput);
		return d.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
	};

	// Group entries of a single day with nested timeblocks logic
	const getDayRenderItems = (dayEntries: TimelineEntry[]) => {
		const blocks = dayEntries.filter(
			(e) => e.type === "time-block",
		) as TimeBlock[];
		const others = dayEntries.filter((e) => e.type !== "time-block");

		// Sort blocks by start_at
		blocks.sort(
			(a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime(),
		);

		// Hold children associated with time blocks
		const assignedIds = new Set<string>();
		const timeBlocksWithChildren = blocks.map((block) => {
			const start = new Date(block.start_at).getTime();
			const end = new Date(block.end_at).getTime();

			const children = others.filter((entry) => {
				if (assignedIds.has(entry.id)) return false;
				const checkTime =
					entry.type === "task"
						? new Date(entry.scheduled_at || entry.created_at).getTime()
						: getEntrySortTime(entry);
				const fits = checkTime >= start && checkTime <= end;
				if (fits) {
					assignedIds.add(entry.id);
				}
				return fits;
			});

			// Sort children chronologically
			children.sort((a, b) => getEntrySortTime(a) - getEntrySortTime(b));

			return { block, children };
		});

		const standaloneEntries = others.filter(
			(entry) => !assignedIds.has(entry.id),
		);

		// Combine into timeline
		const items: any[] = [];
		timeBlocksWithChildren.forEach(({ block, children }) => {
			items.push({
				type: "bracket",
				block,
				children,
				sortTime: new Date(block.start_at).getTime(),
			});
		});

		standaloneEntries.forEach((entry) => {
			items.push({
				type: "standalone",
				entry,
				sortTime: getEntrySortTime(entry),
			});
		});

		// Chronological stack
		return items.sort((a, b) => a.sortTime - b.sortTime);
	};

	// Day View data
	const activeDayString = toLocalDateString(activeDate);
	const activeDayEntries = entries.filter((e) => {
		if (e.type === "task" && !e.scheduled_at) {
			// Include completed dateless tasks anchored to their completion date
			if (e.status !== "done" || !e.completed_at) return false;
			return toLocalDateString(new Date(e.completed_at)) === activeDayString;
		}
		return toLocalDateString(getEffectiveDate(e)) === activeDayString;
	});
	const dayRenderItems = getDayRenderItems(activeDayEntries);

	// Timeline View data: grouped by local day strings, sorted chronologically oldest-to-newest
	const timelineDaysMap: { [key: string]: TimelineEntry[] } = {};
	entries.forEach((e) => {
		if (e.type === "task" && !e.scheduled_at) {
			// Include completed dateless tasks, bucketed by their completion date
			if (e.status !== "done" || !e.completed_at) return;
			const dayStr = toLocalDateString(new Date(e.completed_at));
			if (!timelineDaysMap[dayStr]) timelineDaysMap[dayStr] = [];
			timelineDaysMap[dayStr].push(e);
			return;
		}
		const dayStr = toLocalDateString(getEffectiveDate(e));
		if (!timelineDaysMap[dayStr]) {
			timelineDaysMap[dayStr] = [];
		}
		timelineDaysMap[dayStr].push(e);
	});

	const sortedTimelineDays = Object.keys(timelineDaysMap).sort(
		(a, b) => new Date(b).getTime() - new Date(a).getTime(),
	);

	// Scrolling into selected day separator in Timeline mode
	useEffect(() => {
		if (
			viewMode === "timeline" &&
			sortedTimelineDays.includes(activeDayString)
		) {
			const elementId = `spine-day-${activeDayString}`;
			const element = document.getElementById(elementId);
			if (element) {
				element.scrollIntoView({ behavior: "smooth", block: "center" });
				setHighlightedDay(activeDayString);
				const timer = setTimeout(() => {
					setHighlightedDay(null);
				}, 1500);
				return () => clearTimeout(timer);
			}
		}
	}, [viewMode, activeDate]);

	// Parse YYYY-MM-DD back to readable label with relative markers
	const formatDateStringLabel = (dayStr: string): string => {
		const parts = dayStr.split("-");
		const parsedDate = new Date(
			parseInt(parts[0]),
			parseInt(parts[1]) - 1,
			parseInt(parts[2]),
		);
		const today = new Date();
		const yesterday = new Date();
		yesterday.setDate(today.getDate() - 1);
		const tomorrow = new Date();
		tomorrow.setDate(today.getDate() + 1);
		const yearText =
			parsedDate.getFullYear() !== today.getFullYear()
				? `, ${parsedDate.getFullYear()}`
				: "";

		if (
			parsedDate.getFullYear() === today.getFullYear() &&
			parsedDate.getMonth() === today.getMonth() &&
			parsedDate.getDate() === today.getDate()
		) {
			return `Today · ${parsedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${yearText}`;
		} else if (
			parsedDate.getFullYear() === yesterday.getFullYear() &&
			parsedDate.getMonth() === yesterday.getMonth() &&
			parsedDate.getDate() === yesterday.getDate()
		) {
			return `Yesterday · ${parsedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${yearText}`;
		} else if (
			parsedDate.getFullYear() === tomorrow.getFullYear() &&
			parsedDate.getMonth() === tomorrow.getMonth() &&
			parsedDate.getDate() === tomorrow.getDate()
		) {
			return `Tomorrow · ${parsedDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}${yearText}`;
		}
		return parsedDate.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
			year:
				parsedDate.getFullYear() !== today.getFullYear()
					? "numeric"
					: undefined,
		});
	};

	return (
		<div
			className={`flex-1 px-2 md:px-6 pb-4 md:pb-6 ${
				viewMode === "hub"
					? "overflow-hidden pt-3 flex flex-col h-full"
					: viewMode === "records"
						? "overflow-y-auto pt-4 md:pt-6"
						: viewMode === "lists"
							? "overflow-y-auto pt-4 md:pt-6"
							: viewMode === "timeline"
								? "overflow-y-auto pt-0"
								: "overflow-y-auto pt-4 md:pt-6"
			}`}
			id="timeline-journal-scrollable"
			ref={containerRef}
		>
			<div
				className={`w-full md:mx-auto ${
					viewMode === "hub"
						? "h-full md:max-w-9xl flex flex-col"
						: viewMode === "lists" || viewMode === "records"
							? "md:max-w-9xl "
							: viewMode === "timeline"
								? "md:max-w-4xl space-y-0"
								: "md:max-w-4xl space-y-8"
				}`}
			>
				{viewMode === "records" ? (
					<RecordsView
						entries={entries}
						deletingId={deletingId}
						onDeleteEntry={handleDeleteEntry}
						onOpenDetail={handleOpenDetail}
						formatTime={formatTime}
						formatDateStringLabel={formatDateStringLabel}
					/>
				) : viewMode === "lists" ? (
					<ListsView
						entries={entries}
						deletingId={deletingId}
						activeTaskId={activeTaskId}
						setActiveDate={setActiveDate}
						onDeleteEntry={handleDeleteEntry}
						onOpenDetail={handleOpenDetail}
						onToggleTaskStatus={handleToggleTaskStatus}
						onActivateTask={handleActivateTask}
						onCarryTask={handleCarryTask}
						formatTime={formatTime}
						formatDateStringLabel={formatDateStringLabel}
					/>
				) : viewMode === "day" ? (
					<DayView
						activeDate={activeDate}
						activeDayString={activeDayString}
						dayRenderItems={dayRenderItems}
						collapsedDays={collapsedDays}
						toggleDayCollapse={toggleDayCollapse}
						setActiveDate={setActiveDate}
						deletingId={deletingId}
						activeTaskId={activeTaskId}
						handleDeleteEntry={handleDeleteEntry}
						handleOpenDetail={handleOpenDetail}
						handleToggleTaskStatus={handleToggleTaskStatus}
						handleActivateTask={handleActivateTask}
						handleCarryTask={handleCarryTask}
						formatTime={formatTime}
						formatDateStringLabel={formatDateStringLabel}
						onTimePickerConfirm={handleTimePickerConfirm}
						overdueTasks={overdueTasks}
						handleImportAllOverdue={handleImportAllOverdue}
						handleRescheduleAllOverdue={handleRescheduleAllOverdue}
					/>
				) : viewMode === "hub" ? (
					<div className="w-full flex-1 min-h-0 flex flex-col pt-2 h-[calc(100vh-140px)]">
						{/* Desktop: System Canvas & Habits Studio */}
						<div className="hidden md:flex w-full h-full flex-col">
							{activeHubTab === "habits" ? (
								<div className="w-full h-full max-w-4xl mx-auto overflow-y-auto bg-[#121212] border border-stone-850 rounded-2xl shadow-inner">
									<HabitsSheet
										isInline
										activeDate={activeDate}
										highlightPurposeIds={highlightPurposeIds}
										highlightDomainId={highlightDomainId}
										onSwitchToCanvas={() => setActiveHubTab?.("focus")}
									/>
								</div>
							) : (
								<HubCanvas onSwitchToHabits={() => setActiveHubTab?.("habits")} />
							)}
						</div>

						{/* Mobile: Dynamic Sub-tabs management sheets */}
						<div className="md:hidden h-full flex flex-col pb-2 overflow-y-auto">
							{activeHubTab === "focus" && (
								<FocusSheet
									isInline
									selectedPurposeId={selectedPurposeId}
									selectedDomainId={selectedDomainId}
									onSelectPurpose={setSelectedPurposeId}
									onSelectDomain={setSelectedDomainId}
								/>
							)}
							{activeHubTab === "goals" && (
								<GoalsSheet
									isInline
									highlightPurposeIds={highlightPurposeIds}
									highlightDomainId={highlightDomainId}
								/>
							)}
							{activeHubTab === "objectives" && (
								<ObjectivesSheet
									isInline
									highlightPurposeIds={highlightPurposeIds}
									highlightDomainId={highlightDomainId}
								/>
							)}
							{activeHubTab === "habits" && (
								<HabitsSheet
									isInline
									activeDate={activeDate}
									highlightPurposeIds={highlightPurposeIds}
									highlightDomainId={highlightDomainId}
								/>
							)}
							{/* Dynamic Custom Entity Sheet for User-Defined Types */}
							{activeHubTab &&
								!["focus", "goals", "objectives", "habits"].includes(activeHubTab) && (
									<GenericEntitySheet
										entityTypeId={activeHubTab}
										isInline
									/>
								)}
						</div>
					</div>
				) : (
					<TimelineView
						sortedTimelineDays={sortedTimelineDays}
						timelineDaysMap={timelineDaysMap}
						getDayRenderItems={getDayRenderItems}
						collapsedDays={collapsedDays}
						toggleDayCollapse={toggleDayCollapse}
						setActiveDate={setActiveDate}
						deletingId={deletingId}
						activeTaskId={activeTaskId}
						handleDeleteEntry={handleDeleteEntry}
						handleOpenDetail={handleOpenDetail}
						handleToggleTaskStatus={handleToggleTaskStatus}
						handleActivateTask={handleActivateTask}
						handleCarryTask={handleCarryTask}
						formatTime={formatTime}
						formatDateStringLabel={formatDateStringLabel}
						onTimePickerConfirm={handleTimePickerConfirm}
					/>
				)}
			</div>

			{/* GENERALIZED DETAIL SHEET — EDIT ANY ENTRY TYPE */}
			<DetailSheet
				open={isDetailOpen && selectedEntry !== null}
				onClose={handleCloseDetail}
				onAccept={handleCloseDetail}
				onCancel={handleCancelDetail}
				label={
					selectedEntry?.type === "task"
						? "Edit Task"
						: selectedEntry?.type === "event"
							? "Edit Event"
							: selectedEntry?.type === "note"
								? "Note Details"
								: selectedEntry?.type === "time-block"
									? "Edit Time Block"
									: "Edit Entry"
				}
				labelColor={
					selectedEntry?.type === "task"
						? "emerald"
						: selectedEntry?.type === "event"
							? "indigo"
							: selectedEntry?.type === "note"
								? "blue"
								: selectedEntry?.type === "time-block"
									? "amber"
									: "blue"
				}
				isMobile={isMobile}
			>
				{selectedEntry && (
					<>
						{/* Title Header Container */}
						<div className="border-b border-stone-900/60 pb-2 mb-3">
							{!isEditingTitle ? (
								<div
									onClick={() => setIsEditingTitle(true)}
									className="w-full text-stone-100 font-serif font-bold text-xl cursor-pointer hover:text-stone-300 transition-colors break-words py-0.5"
								>
									{editTitle.trim() || (
										<span className="text-stone-700 italic">
											{selectedEntry.type === "task"
												? "Task Title"
												: selectedEntry.type === "event"
													? "Event Title"
													: selectedEntry.type === "time-block"
														? "Time Block Title"
														: "Note Title"}
										</span>
									)}
								</div>
							) : (
								<input
									type="text"
									autoFocus
									value={editTitle}
									onChange={(e) => setEditTitle(e.target.value)}
									onBlur={() => setIsEditingTitle(false)}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											setIsEditingTitle(false);
										}
									}}
									placeholder={
										selectedEntry.type === "task"
											? "Task Title"
											: selectedEntry.type === "event"
												? "Event Title"
												: selectedEntry.type === "time-block"
													? "Time Block Title"
													: "Note Title"
									}
									className="w-full bg-transparent text-stone-100 font-serif font-bold text-xl focus:outline-none placeholder-stone-700 py-0.5 border-none"
								/>
							)}
						</div>

						{/* ── TASK ── */}
						{selectedEntry.type === "task" && (
							<div className="flex flex-col flex-1 space-y-3">
								<div className="flex items-center gap-1.5 flex-wrap">
									<EditableChip
										label="Created"
										value={new Date((selectedEntry as Task).created_at)}
										displayValue={formatChipDate(
											new Date((selectedEntry as Task).created_at),
										)}
										mode="datetime"
										chipClass="bg-[#121212] border-stone-800 text-stone-400"
										onSave={async (d) => {
											await db.entries.update(selectedEntry.id, {
												created_at: d,
											} as any);
											setSelectedEntry({
												...selectedEntry,
												created_at: d,
											} as Task);
										}}
									/>

									<EditableChip
										label="Spent"
										value={new Date()} // unused for duration
										displayValue={formatDurationEditable(
											(selectedEntry as Task).time_spent,
										)}
										mode="duration"
										durationValue={(selectedEntry as Task).time_spent}
										chipClass="bg-[#121212] border-stone-800 text-stone-400"
										onSaveDuration={async (raw) => {
											const ms = parseDuration(raw)!;
											await db.entries.update(selectedEntry.id, {
												time_spent: ms,
											} as any);
											setSelectedEntry({
												...selectedEntry,
												time_spent: ms,
											} as Task);
										}}
										onSave={async () => {}}
									/>

									{(selectedEntry as Task).scheduled_at && (
										<EditableChip
											label="Scheduled"
											value={new Date((selectedEntry as Task).scheduled_at!)}
											displayValue={formatChipDate(
												new Date((selectedEntry as Task).scheduled_at!),
											)}
											mode="datetime"
											chipClass="bg-[#121212] border-indigo-800/40 text-indigo-400"
											onSave={async (d) => {
												await db.entries.update(selectedEntry.id, {
													scheduled_at: d,
												} as any);
												setSelectedEntry({
													...selectedEntry,
													scheduled_at: d,
												} as Task);
											}}
										/>
									)}
								</div>

								{(selectedEntry as Task).completed_at && (
									<div className="flex items-center gap-1.5 flex-wrap">
										<EditableChip
											label="Completed"
											value={new Date((selectedEntry as Task).completed_at!)}
											displayValue={formatChipDate(
												new Date((selectedEntry as Task).completed_at!),
											)}
											mode="datetime"
											chipClass="bg-[#121212] border-emerald-800/40 text-emerald-500"
											onSave={async (d) => {
												await db.entries.update(selectedEntry.id, {
													completed_at: d,
												} as any);
												setSelectedEntry({
													...selectedEntry,
													completed_at: d,
												} as Task);
											}}
										/>

										<button
											onClick={async () => {
												const task = selectedEntry as Task;
												const nextStarred = !task.starred;
												await db.entries.update(task.id, {
													starred: nextStarred,
												} as any);
												setSelectedEntry({ ...task, starred: nextStarred });
											}}
											className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-widest cursor-pointer transition-all active:scale-95 ${
												(selectedEntry as Task).starred
													? "bg-amber-500/10 border-amber-500/30 text-amber-400"
													: "bg-[#121212] border-stone-800 text-stone-500 hover:text-stone-300 hover:border-stone-750"
											}`}
											title="Toggle Highlight of Days"
										>
											<Star
												className={`w-3 h-3 ${
													(selectedEntry as Task).starred
														? "fill-current text-amber-400"
														: ""
												}`}
											/>
											{(selectedEntry as Task).starred
												? "Highlight"
												: "Highlight"}
										</button>

										<button
											onClick={async () => {
												const task = selectedEntry as Task;
												const nextAccomplishment = !task.is_accomplishment;
												await db.entries.update(task.id, {
													is_accomplishment: nextAccomplishment,
												} as any);
												setSelectedEntry({
													...task,
													is_accomplishment: nextAccomplishment,
												});
											}}
											className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-widest cursor-pointer transition-all active:scale-95 ${
												(selectedEntry as Task).is_accomplishment
													? "bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.15)]"
													: "bg-[#121212] border-stone-800 text-stone-500 hover:text-stone-300 hover:border-stone-750"
											}`}
											title="Toggle Accomplishments wall"
										>
											<Trophy
												className={`w-3 h-3 ${
													(selectedEntry as Task).is_accomplishment
														? "fill-current text-amber-400"
														: ""
												}`}
											/>
											{(selectedEntry as Task).is_accomplishment
												? "Accomplishment"
												: "Accomplishment"}
										</button>
									</div>
								)}

								{/* Content */}

								{isEditingContent ? (
									<textarea
										autoFocus
										value={editContent}
										onChange={(e) => setEditContent(e.target.value)}
										onBlur={() => setIsEditingContent(false)}
										placeholder="Add context, links, notes about this task..."
										className="w-full bg-transparent text-stone-300 font-serif text-sm focus:outline-none resize-none leading-relaxed placeholder-stone-700 flex-1 border-t border-stone-900 pt-3 min-h-[120px]"
									/>
								) : (
									<div className="flex-1 border-t border-stone-900 pt-1 flex flex-col">
										<MarkdownPreview
											text={editContent}
											placeholder="Add context, links, notes about this task..."
											onClick={() => setIsEditingContent(true)}
										/>
										<span className="text-[10px] text-stone-600 font-mono mt-1 select-none">
											Click content to edit
										</span>
									</div>
								)}
							</div>
						)}

						{/* ── NOTE ── */}
						{selectedEntry.type === "note" && (
							<div className="flex flex-col flex-1 space-y-3">
								<div className="flex items-center gap-1.5 flex-wrap">
									<EditableChip
										label="Logged"
										value={new Date((selectedEntry as Note).timestamp)}
										displayValue={formatChipDate(
											new Date((selectedEntry as Note).timestamp),
										)}
										mode="datetime"
										chipClass="bg-[#121212] border-stone-800 text-stone-400"
										onSave={async (d) => {
											await db.entries.update(selectedEntry.id, {
												timestamp: d,
											} as any);
											setSelectedEntry({
												...selectedEntry,
												timestamp: d,
											} as Note);
											setEditTimestamp(
												`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
											);
										}}
									/>
									<button
										type="button"
										onClick={async () => {
											const note = selectedEntry as Note;
											const nextPinned = !note.pinned;
											await db.entries.update(note.id, {
												pinned: nextPinned,
											} as any);
											setSelectedEntry({ ...note, pinned: nextPinned });
										}}
										className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-widest cursor-pointer transition-all active:scale-95 ${
											(selectedEntry as Note).pinned
												? "bg-amber-500/10 border-amber-500/30 text-amber-400"
												: "bg-[#121212] border-stone-800 text-stone-500 hover:text-stone-300 hover:border-stone-750"
										}`}
									>
										<Pin
											className={`w-3 h-3 ${(selectedEntry as Note).pinned ? "fill-current" : ""}`}
										/>
										{(selectedEntry as Note).pinned ? "Pinned" : "Pin"}
									</button>
									<button
										type="button"
										onClick={async () => {
											const note = selectedEntry as Note;
											const nextStarred = !note.starred;
											await db.entries.update(note.id, {
												starred: nextStarred,
											} as any);
											setSelectedEntry({ ...note, starred: nextStarred });
										}}
										className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-widest cursor-pointer transition-all active:scale-95 ${
											(selectedEntry as Note).starred
												? "bg-amber-500/10 border-amber-500/30 text-amber-400"
												: "bg-[#121212] border-stone-800 text-stone-500 hover:text-stone-300 hover:border-stone-750"
										}`}
										title="Toggle Highlight of Days"
									>
										<Star
											className={`w-3 h-3 ${
												(selectedEntry as Note).starred ? "fill-current" : ""
											}`}
										/>
										{(selectedEntry as Note).starred ? "Highlight" : "Highlight"}
									</button>
								</div>
								{isEditingContent ? (
									<textarea
										autoFocus
										value={editContent}
										onChange={(e) => setEditContent(e.target.value)}
										onBlur={() => setIsEditingContent(false)}
										placeholder="Tap to start typing your thoughts..."
										className="w-full bg-transparent text-stone-300 font-serif text-sm focus:outline-none resize-none leading-relaxed placeholder-stone-700 flex-1 min-h-[150px]"
									/>
								) : (
									<div className="flex-1 flex flex-col">
										<MarkdownPreview
											text={editContent}
											placeholder="Tap to start typing your thoughts..."
											onClick={() => setIsEditingContent(true)}
										/>
										<span className="text-[10px] text-stone-600 font-mono mt-1 select-none">
											Click content to edit
										</span>
									</div>
								)}
							</div>
						)}

						{/* ── EVENT ── */}
						{selectedEntry.type === "event" && (
							<div className="flex flex-col flex-1 space-y-3">
								<div className="flex items-center gap-1.5 flex-wrap">
									<EditableChip
										label="At"
										value={new Date((selectedEntry as Event).timestamp)}
										displayValue={formatChipDate(
											new Date((selectedEntry as Event).timestamp),
										)}
										mode="datetime"
										chipClass="bg-[#121212] border-indigo-800/40 text-indigo-400"
										onSave={async (d) => {
											await db.entries.update(selectedEntry.id, {
												timestamp: d,
											} as any);
											setSelectedEntry({
												...selectedEntry,
												timestamp: d,
											} as Event);
											setEditTimestamp(
												`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
											);
										}}
									/>
									<button
										type="button"
										onClick={async () => {
											const evt = selectedEntry as Event;
											const nextPinned = !evt.pinned;
											await db.entries.update(evt.id, {
												pinned: nextPinned,
											} as any);
											setSelectedEntry({ ...evt, pinned: nextPinned });
										}}
										className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-widest cursor-pointer transition-all active:scale-95 ${
											(selectedEntry as Event).pinned
												? "bg-amber-500/10 border-amber-500/30 text-amber-400"
												: "bg-[#121212] border-stone-800 text-stone-500 hover:text-stone-300 hover:border-stone-750"
										}`}
									>
										<Pin
											className={`w-3 h-3 ${(selectedEntry as Event).pinned ? "fill-current" : ""}`}
										/>
										{(selectedEntry as Event).pinned ? "Pinned" : "Pin"}
									</button>
									<button
										type="button"
										onClick={async () => {
											const evt = selectedEntry as Event;
											const nextStarred = !evt.starred;
											await db.entries.update(evt.id, {
												starred: nextStarred,
											} as any);
											setSelectedEntry({ ...evt, starred: nextStarred });
										}}
										className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-widest cursor-pointer transition-all active:scale-95 ${
											(selectedEntry as Event).starred
												? "bg-amber-500/10 border-amber-500/30 text-amber-400"
												: "bg-[#121212] border-stone-800 text-stone-500 hover:text-stone-300 hover:border-stone-750"
										}`}
										title="Toggle Highlight of Days"
									>
										<Star
											className={`w-3 h-3 ${
												(selectedEntry as Event).starred ? "fill-current" : ""
											}`}
										/>
										{(selectedEntry as Event).starred ? "Highlight" : "Highlight"}
									</button>
								</div>
								{isEditingContent ? (
									<textarea
										autoFocus
										value={editContent}
										onChange={(e) => setEditContent(e.target.value)}
										onBlur={() => setIsEditingContent(false)}
										placeholder="Event description, notes, or details..."
										className="w-full bg-transparent text-stone-300 font-serif text-sm focus:outline-none resize-none leading-relaxed placeholder-stone-700 flex-1 min-h-[120px]"
									/>
								) : (
									<div className="flex-1 flex flex-col">
										<MarkdownPreview
											text={editContent}
											placeholder="Event description, notes, or details..."
											onClick={() => setIsEditingContent(true)}
										/>
										<span className="text-[10px] text-stone-600 font-mono mt-1 select-none">
											Click content to edit
										</span>
									</div>
								)}
							</div>
						)}

						{/* ── TIME BLOCK ── */}
						{selectedEntry.type === "time-block" && (
							<div className="flex items-center gap-1.5 flex-wrap">
								<EditableChip
									label="Start"
									value={new Date((selectedEntry as TimeBlock).start_at)}
									displayValue={formatChipDate(
										new Date((selectedEntry as TimeBlock).start_at),
									)}
									mode="datetime"
									chipClass="bg-[#121212] border-amber-800/40 text-amber-400"
									onSave={async (d) => {
										await db.entries.update(selectedEntry.id, {
											start_at: d,
										} as any);
										setSelectedEntry({
											...selectedEntry,
											start_at: d,
										} as TimeBlock);
										setEditStartAt(
											`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
										);
									}}
								/>
								<EditableChip
									label="End"
									value={new Date((selectedEntry as TimeBlock).end_at)}
									displayValue={formatChipDate(
										new Date((selectedEntry as TimeBlock).end_at),
									)}
									mode="datetime"
									chipClass="bg-[#121212] border-amber-800/40 text-amber-400"
									onSave={async (d) => {
										await db.entries.update(selectedEntry.id, {
											end_at: d,
										} as any);
										setSelectedEntry({
											...selectedEntry,
											end_at: d,
										} as TimeBlock);
										setEditEndAt(
											`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
										);
									}}
								/>
								<button
									type="button"
									onClick={async () => {
										const tb = selectedEntry as TimeBlock;
										const nextStarred = !tb.starred;
										await db.entries.update(tb.id, {
											starred: nextStarred,
										} as any);
										setSelectedEntry({ ...tb, starred: nextStarred });
									}}
									className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-widest cursor-pointer transition-all active:scale-95 ${
										(selectedEntry as TimeBlock).starred
											? "bg-amber-500/10 border-amber-500/30 text-amber-400"
											: "bg-[#121212] border-stone-800 text-stone-500 hover:text-stone-300 hover:border-stone-750"
									}`}
									title="Toggle Highlight of Days"
								>
									<Star
										className={`w-3 h-3 ${
											(selectedEntry as TimeBlock).starred ? "fill-current" : ""
										}`}
									/>
									{(selectedEntry as TimeBlock).starred ? "Highlight" : "Highlight"}
								</button>
							</div>
						)}
						{/* ── UNIVERSAL OUTCOMES & MICRO-WINS ── */}
						{selectedEntry && (
							<div className="mt-4 pt-3 border-t border-stone-850/80 space-y-2">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-1.5">
										<Sparkles className="w-3.5 h-3.5 text-amber-400" />
										<span className="text-[11px] font-mono font-bold uppercase tracking-wider text-stone-300">
											Outcomes & Micro-Wins
										</span>
									</div>
									<span className="text-[9px] font-mono text-stone-500">
										{(
											selectedEntry.micro_wins ||
											(selectedEntry as any).achievements ||
											[]
										).length}{" "}
										logged
									</span>
								</div>

								{/* List of Micro-Wins */}
								{(
									selectedEntry.micro_wins ||
									(selectedEntry as any).achievements ||
									[]
								).length > 0 && (
									<div className="space-y-1.5">
										{(
											selectedEntry.micro_wins ||
											(selectedEntry as any).achievements ||
											[]
										).map((w: MicroWin) => (
											<MicroWinRow
												key={w.id}
												win={w}
												formatTime={formatTime}
												onSave={async (text) => {
													const existingWins: MicroWin[] =
														selectedEntry.micro_wins ||
														(selectedEntry as any).achievements ||
														[];
													const updated = existingWins.map((x) =>
														x.id === w.id ? { ...x, text } : x,
													);
													await db.entries.update(selectedEntry.id, {
														micro_wins: updated,
														achievements: updated,
													} as any);
													setSelectedEntry({
														...selectedEntry,
														micro_wins: updated,
														achievements: updated,
													} as any);
												}}
												onDelete={async () => {
													const existingWins: MicroWin[] =
														selectedEntry.micro_wins ||
														(selectedEntry as any).achievements ||
														[];
													const updated = existingWins.filter(
														(x) => x.id !== w.id,
													);
													await db.entries.update(selectedEntry.id, {
														micro_wins: updated,
														achievements: updated,
													} as any);
													setSelectedEntry({
														...selectedEntry,
														micro_wins: updated,
														achievements: updated,
													} as any);
												}}
											/>
										))}
									</div>
								)}

								{/* Add Micro-Win Input */}
								<div className="flex items-center gap-2 pt-1">
									<input
										type="text"
										placeholder="Add a takeaway, outcome or micro-win..."
										className="flex-1 bg-[#0a0a0a] border border-stone-850 hover:border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500/30 transition-colors font-mono"
										onKeyDown={async (e) => {
											if (e.key !== "Enter" || !e.currentTarget.value.trim())
												return;
											const text = e.currentTarget.value.trim();
											const newWin: MicroWin = {
												id: crypto.randomUUID(),
												text,
												created_at: new Date(),
											};
											const existingWins: MicroWin[] =
												selectedEntry.micro_wins ||
												(selectedEntry as any).achievements ||
												[];
											const updated = [...existingWins, newWin];
											await db.entries.update(selectedEntry.id, {
												micro_wins: updated,
												achievements: updated,
											} as any);
											setSelectedEntry({
												...selectedEntry,
												micro_wins: updated,
												achievements: updated,
											} as any);
											e.currentTarget.value = "";
										}}
									/>
								</div>
							</div>
						)}
					</>
				)}
			</DetailSheet>
		</div>
	);
}
