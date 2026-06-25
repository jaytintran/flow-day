# ⓿ Flow Day

> **One Stop for Daily Personal Productivity** — Offline-first timeline journal, task tracker with Pomodoro timer, habit builder, and Goals/Objectives planner.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss)](https://tailwindcss.com/)
[![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor)](https://capacitorjs.com/)
[![Dexie.js](https://img.shields.io/badge/Dexie-4-4B32C3?)](https://dexie.org/)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue)](LICENSE)

## 🧘 Productivity Philosophy

Flow Day is built on a hybrid productivity design that bridges the gap between structured time management and cognitive flexibility:

1. **Capturing vs. Scheduling (Temporal Separation)**
   * Strict calendar/timeline tools create anxiety when a schedule slips, leading to "overdue task fatigue."
   * Flow Day implements **Dateless (Transient) Tasks** inside the **Inbox** view. You capture tasks based on *what* needs to be done, leaving them untethered from dates until you are ready to schedule.
2. **The Starred Focus (Rule of 3 / WIP Limits)**
   * To combat choice paralysis, you can "Star" up to **3 dateless tasks**.
   * These tasks are promoted into premium visual focus cards, complete with inline achievement logging, direct click-to-detail views, and integrated play buttons to track timespent.
3. **Execution Pipeline**
   * **Capture** (NLP Input Bar) $\rightarrow$ **Prioritize** (Inbox Starred Cards) $\rightarrow$ **Schedule** (Assign Date to Timeline) $\rightarrow$ **Execute** (Top Pomodoro Tracker Bar).

---

## ✨ Features

### 📖 Timeline Journal — Three View Modes

| View | Description |
|------|-------------|
| **Day View** | Focused single-day timeline with a vertical time spine. Entries sorted chronologically. |
| **Timeline View** | Multi-day continuous scrollable timeline with collapsible day groups. Auto-scrolls to the active date. |
| **Records View** | Catalog of all Events and Notes, grouped by date, with search and type filtering (All / Events / Notes). |

### 🧠 Smart Natural Language Input Bar

Quick-capture anything with plain English — the built-in NLP parser extracts dates, times, and durations automatically:

- **`task`** — "Review engineering specs tomorrow at 11am" → creates a todo task scheduled for tomorrow at 11:00.
- **`event`** — "Sprint planning today at 3pm" → creates a timeline event. Pencil button opens a modal for adding a full description.
- **`note`** — "Brainstorming notes today" → creates a timestamped journal note. Modal support for rich body content.
- **`time-block`** — "Deep work from 2pm to 4pm" or "Focus session at 9am 1h30" → creates a scheduled time span.

**Parser capabilities:**

| Input | Example | Parsed |
|-------|---------|--------|
| Relative dates | `today`, `tomorrow`, `in 3 days` | ✓ |
| Exact dates | `24/6`, `2/5/2026` | ✓ |
| Times | `at 3:45pm`, `at 20:15` | ✓ |
| Time ranges | `from 6pm to 7pm` | ✓ |
| Durations | `1h30`, `45m` | ✓ |
| Manual datetime picker | Clock icon button | ✓ (Events, Notes, Time Blocks) |

### ⏱️ Task Timer with Pomodoro-Style Controls

A persistent timer bar sits at the top of the app. Search or quick-create a task, then control it:

- ▶️ **Play / ⏸️ Pause / ⏹️ Stop / ✅ Finish** — Full lifecycle controls.
- ⏱️ **Live HH:MM:SS clock** — high-precision, persists across page reloads via `localStorage`.
- 🔗 **Link to Objective** — attach a task to an Objective (and optionally a parent Goal); tracked time rolls upward automatically.
- 🔄 **Reset timer** — clear the accumulated time for the current task.
- 🗑️ **Delete** — confirmation-before-delete protection (3-second window).
- 📋 **Search & quick-create** — dropdown with live search; type a title and hit Enter to create-and-start a new task.

### 🏆 Goals / Projects System

Define high-level goals with colored category tags. Each goal tracks:

- Number of linked Objectives
- Total linked task count
- Accumulated tracked time (from tasks → objectives → goals)
- Status: `active`, `achieved`, `archived`
- Filterable by Category tags

### 🎯 Objectives System

Break goals down into measurable objectives. Each objective:

- Can be linked to a parent Goal
- Tracks accumulated time from linked tasks
- Has statuses: `todo`, `done`, `archived`
- Can be tagged with Categories for organization

### 🔄 Task Carry-Over

Incomplete tasks can be **carried** to a future date via the `carried_to` field. A "Carry" button on each task row opens a date picker — the task then appears under the new date in all views. A "Revert" option moves it back to its original date.

### 🔁 Habit Tracking

Create and maintain daily habits with visual consistency tracking:

- **5 color themes**: emerald, sky, violet, rose, amber
- **Quick-tick strip** in the DayNavigator header — one-tap to log a habit for today.
- **Habit Consistency Modal** — see a 7-day or longer calendar grid showing which days were ticked.
- Each tick creates a `habit-log` entry in the timeline with an exact timestamp.
- Statuses: `active` / `archived`

### 🏷️ Categories (Tags)

Color-coded category tags scoped to Goals or Objectives:

- **8 colors**: emerald, sky, violet, rose, amber, indigo, teal, orange
- Create, edit, and manage categories from dedicated sheet UI.
- Filter Goals and Objectives by category.

### ☁️ Cloud Sync via GitHub Gist

Backup and restore your entire database across devices using GitHub's Gist API:

| Action | Description |
|--------|-------------|
| **Push to Cloud** | Uploads your local database (entries, habits, categories) to a private GitHub Gist. |
| **Pull from Cloud** | Downloads and restores data from a Gist — overwrites local data. |
| **Auto-Create Gist** | Generates a new private Gist for you (requires a PAT with the `gist` scope). |
| **Test Connection** | Verifies your PAT and Gist ID are valid. |
| **Save Credentials** | Persists PAT and Gist ID to local storage. |

**Setup:** Generate a [GitHub Personal Access Token](https://github.com/settings/tokens) (classic, with `gist` scope), enter it alongside a Gist ID (or auto-create one), then push.

### 🎨 UI / UX

- **Dark mode** design with a premium monochrome palette (`#0a0a0a` / `#121212`).
- **Grid-pattern background** — subtle radial gradient overlay (`16px` grid).
- **Safe-area-aware** — uses `env(safe-area-inset-*)` for notched devices.
- **Responsive** — dedicated mobile and desktop layouts for the timer bar and sheets.
- **Animated** — entrance/exit transitions via **Motion** (Framer Motion API v12).
- **Segmented type selector** — tab-bar UI for switching between Task / Event / Note / Time Block input modes.

### 📱 Cross-Platform

- **Web** — Progressive Web App (PWA-ready via Vite).
- **Android** — Native wrapper via **Capacitor 8** (minSdkVersion 24, targetSdkVersion 36).

---

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 19 with TypeScript |
| **Build Tool** | Vite 6 |
| **Styling** | Tailwind CSS v4 (`@tailwindcss/vite` plugin) |
| **Animation** | Motion v12 (Framer Motion API) |
| **Icons** | Lucide React (`lucide-react` 0.546) |
| **Storage** | Dexie.js v4 (IndexedDB wrapper, fully offline) |
| **Reactive Queries** | `dexie-react-hooks` |
| **Mobile** | Capacitor 8 (Android) |
| **AI SDK** | Google Gemini API (`@google/genai` v2.4) |
| **Cloud Sync** | GitHub Gist API (REST) |
| **Server** | Express 4 (for AI Studio deployment) |

### Why Dexie.js / IndexedDB?

All data lives in the browser's IndexedDB via Dexie.js — **no backend required**. Your data is always available offline and never leaves your device unless you explicitly push to GitHub Gist for cross-device sync.

---

## 🗄️ Data Model (9 Schema Migrations)

The database (`PersonalTimelineDB`) has evolved through 9 indexed-versions, currently storing:

**`entries` table** — unified timeline (union type: Task, Event, Note, Time Block, Objective, Goal, Habit Log):
- Indexed fields: `id`, `type`, `created_at`, `status`, `timestamp`, `start_at`, `end_at`, `title`, `carried_to`, `objective_id`, `goal_id`, `scheduled_at`, `habit_id`, `category_ids`

**`habits` table** — habit templates:
- Indexed: `id`, `status`; fields: `title`, `color`, `created_at`

**`categories` table** — scoped tags:
- Indexed: `id`, `name`, `scope`, `[scope+name]`; fields: `color`, `created_at`

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** (or pnpm / yarn)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/your-username/flow-day.git
cd flow-day

# 2. Install dependencies
npm install

# 3. (Optional) Set up Gemini API key for AI features
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# 4. Start the development server
npm run dev
```

The app runs at **http://localhost:3000**.

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | For AI features | Google Gemini API key (configured via AI Studio Secrets panel) |
| `APP_URL` | For self-referential links | URL where the app is hosted (auto-injected by AI Studio Cloud Run) |

### Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server on port 3000, host 0.0.0.0 |
| `npm run build` | Production build via Vite |
| `npm run preview` | Preview production build |
| `npm run lint` | TypeScript type-check (`tsc --noEmit`) |
| `npm run clean` | Remove `dist` and `server.js` |
| `npm run cap:sync` | Sync Capacitor native project |
| `npm run cap:open` | Open Android Studio for the Capacitor project |
| `npm run build:android` | Build web app + sync Capacitor |

---

## 📱 Building for Android

```bash
npm run build:android
# Opens Android Studio — connect a device or emulator and run.
```

The Android app uses **Capacitor 8** with `appId: com.flowday.app` and `appName: Flow Day`. Internet permission is enabled in the manifest for Gist sync.

---

## 🧭 Architecture Overview

```
src/
├── main.tsx                  # App entry point
├── App.tsx                   # Root component — 3-zone layout
│   ├── TimerBar              # Task timer & search (Zone 1)
│   ├── DayNavigator          # Date nav, calendar, view mode switcher
│   └── Journal               # Timeline journal (Zone 2, scrollable)
│       ├── DayView           # Single-day timeline
│       ├── TimelineView      # Multi-day continuous view
│       └── RecordsView       # Searchable records catalog
│   └── InputBar              # NLP smart input (Zone 3, fixed bottom)
│
├── components/
│   ├── TimerBar.tsx           # Pomodoro timer with Objective/Goal linking
│   ├── DayNavigator.tsx      # Calendar, view mode, quick-habit strip
│   ├── InputBar.tsx          # Smart NLP input with 4 entry types
│   ├── DetailSheet.tsx       # Universal edit modal for any entry
│   ├── GoalsSheet.tsx        # CRUD for Goals/Projects
│   ├── ObjectivesSheet.tsx   # CRUD for Objectives
│   ├── GoalsPickerSheet.tsx  # Goal picker for linking
│   ├── ObjectivePickerSheet.tsx # Objective picker for linking
│   ├── HabitsSheet.tsx       # CRUD for Habits
│   ├── HabitConsistencyModal.tsx # Habit calendar grid
│   ├── CategoryStrip.tsx     # Color-coded category badges
│   ├── CategoryManagementSheet.tsx # CRUD for Categories
│   └── Settings.tsx          # GitHub Gist sync configuration
│
├── db.ts                    # Dexie database with 9 schema versions
├── types.ts                 # TypeScript types (union TimelineEntry)
├── utils.ts                 # Date formatting/duration helpers
└── index.css                # Global styles + Tailwind
```

---

## 🔧 Configuration

### GitHub Gist Sync

1. Create a [GitHub Personal Access Token](https://github.com/settings/tokens) (classic) with the `gist` scope.
2. Click the **Settings** gear icon (top-right of the timer bar).
3. Paste your PAT, then click **Auto-Create Gist** (or paste an existing Gist ID).
4. Click **Save Credentials**, then **Push to Cloud** to upload your data.
5. On another device, enter the same PAT and Gist ID, then **Pull from Cloud**.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or PR for any improvements.

---

## 📄 License

Apache 2.0 — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with ❤️ for daily productivity
</p>
