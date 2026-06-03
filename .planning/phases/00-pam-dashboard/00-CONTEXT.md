# Phase 00: PAM Dashboard & Project Management Tooling — Context

**Gathered:** 2026-06-03
**Status:** Ready for implementation

<domain>
## Phase Boundary

Rebuild the PAM (Project Accountability Manager) dashboard and fix the task abstraction model used across all project phases. This is the project management meta-layer — not a product feature, but the tool that tracks and drives all product work.

**Scope:**
- PAM dashboard UI overhaul (Jira-inspired Kanban board)
- Task abstraction fix (stop flattening subtasks into cards)
- Data storage hardening (JSON files on disk, not localStorage)
- Comments system for user ↔ agent communication
- Progress metrics (burndown chart, hours tracking, weekly trends)
- Removal of redundant clocking feature

**Out of scope (deferred):**
- Multi-user support (solo project)
- Real-time collaboration
- Mobile app
- Integration with external PM tools (Linear, Asana, etc.)

</domain>

<decision_log>
## How These Decisions Were Made

This phase is unusual — it's a meta-layer discussion, not tied to a product phase in the roadmap. Gray areas were identified through codebase inspection of `.pam/` tooling and research into Jira/Atlassian project management patterns. The user explicitly delegated several decisions ("you decide") after research was conducted.

**Decision types:**
- **User-locked:** Explicitly stated preferences (e.g., "like Jira", "remove clocking")
- **Agent-chosen:** Research-backed recommendations user approved ("proceed")
- **Agent discretion:** Areas user delegated — see notes below

</decision_log>

<decisions>
## Implementation Decisions

### A. Data Storage (user concern — clarified)
- **D-01:** Data already persists in server-side JSON files (`.pam/state.json`, `.pam/tasks.json`) — NOT localStorage. The Vue dashboard fetches via `fetch('/api/status')` from the Node.js server. A browser cache/memory wipe does NOT lose data.
- **D-02:** Keep JSON files as the storage format. No SQLite needed — data volume is tiny (KB), zero dependencies, trivially readable by AI agents.
- **D-03:** Add `.pam/comments.json` as a separate file for user notes. Separate file = easy for agents to find without scanning the entire task database.

### B. Remove Clocking Feature (user-locked)
- **D-04:** Remove clock-in/clock-out, session tracking, session modal, session logs from the dashboard.
- **D-05:** Replace with inline hours entry on each task — user types hours spent when marking a task/subtask done. No start/stop friction.
- **D-06:** Remove clocking-related state from `state.json`. Simplify to just track per-task hours.

### C. Task Abstraction Model (agent-chosen)
- **D-07:** Keep the existing 3-level structure: **Phase → Task → Subtask**. No additional levels.
  - **Why:** Jira's standard hierarchy is Epic → Story/Task → Subtask (3 levels). Jira explicitly blocks subtask-of-subtask because it creates confusion. The current data in `tasks.json` already fits this model perfectly — no restructuring needed. Going to 4+ levels would require rewriting all data without benefit.
- **D-08:** The CRITICAL fix is DISPLAY, not structure. Currently the dashboard FLATTENS all subtasks into individual Kanban cards (Phase 1 shows 128 cards instead of 9 tasks). Fix: show only Tasks on the board.
  - **Board shows:** Only Tasks (e.g., "Auth Module", "Cart Module")
  - **Hidden from board:** Subtasks (visible only inside task detail view)
  - **Task card shows:** Name + rollup progress ("8/13 subtasks done") + total hours + deadline
- **D-09:** Each Task card displays a rollup progress bar showing subtask completion percentage.

### D. Card Display — Like Jira (user-locked)
- **D-10:** Redesigned card layout (Jira-inspired):
  ```
  ┌──────────────────────────────────┐
  │ 🔨 Auth Module & RBAC          │  ← Task name (bold, icon by status)
  │ ════════════════════════════════ │
  │ ● ● ● ● ● ● ● ● ○ ○ ○ ○ ○ ○   │  ← Subtask progress bar
  │ 8/13 subtasks done   18h est    │  ← Rollup stats
  │ ⚡ High priority     Jul 12     │  ← Priority + deadline
  │ [▶ Work]  [⊞ Subtasks]  [💬 2] │  ← Action buttons + comment count
  └──────────────────────────────────┘
  ```
- **D-11:** Color coding by status (green = done, yellow = in_progress, dim = pending). No per-priority colors unless user asks later.
- **D-12:** Cards show only 3 field groups: name/status, progress + hours, priority + deadline. Clean, not cluttered.

### E. Sub-board / Drill-down — Like Jira (user-locked)
- **D-13:** Clicking a Task card opens a **task detail panel** (right-side panel, replaces current subtask modal).
- **D-14:** Panel shows:
  - Task description (editable)
  - All subtasks with checkbox status + estimated hours + inline hours entry
  - Comments thread (from comments.json, filtered by task_id)
  - Hours summary (estimated vs logged)
  - Deadline display
- **D-15:** When all subtasks are marked done, show "✓ All subtasks complete" and offer to auto-flip the parent task to Done.

### F. Information Architecture (user-locked + agent-chosen)
- **D-16:** Two views:
  - **Global Overview (default landing page):** All phases in single scrollable view. Shows phase cards with progress bars, deadlines, burndown chart, hours summary. Big picture first.
  - **Phase Board (tab):** Kanban board filtered to one phase (To Do / In Progress / Done columns). Same layout regardless of which phase.
- **D-17:** Phase tabs already exist — keep them. Add the Global Overview as the default tab (or separate section above the tabs).

### G. Progress & Velocity Metrics (agent-chosen)
- **D-18:** Three metrics only (designed for solo developer, not teams):
  - **📉 Burndown chart:** Planned hours remaining vs. actual hours remaining, plotted against deadline. Shows if you're on track.
  - **⏱️ Hours comparison:** Per-task "estimated vs logged" — helps improve estimation over time.
  - **📊 Weekly trend:** Bar chart of hours logged per week vs. 48h target. Simple accountability.
- **D-19:** No velocity tracking (team metric, irrelevant for solo).
- **D-20:** No cycle time (too granular for this workflow).

### H. Comments System (user concern — agent designed)
- **D-21:** New file `.pam/comments.json` — separate from task data, easy for agents to find.
- **D-22:** Schema per comment:
  ```json
  {
    "id": "cmt-001",
    "task_id": "p1-auth-4",
    "phase_id": "phase-1",
    "text": "The validation is too strict — users with + in emails rejected.",
    "category": "bug",
    "created_at": "2026-06-03T14:30:00Z",
    "read": false,
    "resolved": false,
    "resolved_at": null
  }
  ```
- **D-23:** Categories: `bug`, `question`, `suggestion`, `note` (user chooses when creating).
- **D-24:** Agent's responsibility: check `.pam/comments.json` for `read: false` entries at the start of every session. After acting, set `read: true`.
- **D-25:** Dashboard shows comment count bubble (💬 N) on task cards with unread comments. Detail panel shows full thread.

### the agent's Discretion
- **Specific chart library:** The dashboard uses Vue 3 — for charts, use a lightweight library like Chart.js (via `chart.js` + `vue-chartjs`) or draw SVG inline to keep zero-dependency ethos. Agent discretion but prefer zero-dep SVG if feasible.
- **CSS framework:** Current dashboard uses raw CSS. Can continue with raw CSS (consistent, no new dep) or add Tailwind. Agent discretion, but note that the frontend Next.js app will use Tailwind — reusing that pattern could be pragmatic.
- **Inline hours entry UX:** A small input field on each subtask in the detail panel, or a single total field on the task. Either approach works — keep it simple.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Current PAM Tooling
- `.pam/dashboard.html` — Current Vue 3 dashboard SPA (960 lines, to be rewritten)
- `.pam/server.js` — Current Node.js HTTP server (328 lines, to be updated)
- `.pam/tasks.json` — Task data (all phases, tasks, subtasks; display abstraction needed)
- `.pam/state.json` — Session state (clocking data to be removed)
- `.pam/cli.sh` — CLI tool (clock-in/out commands to be removed/updated)
- `.pam/verify_env.sh` — Zero-trust verification script
- `.pam/comments.json` — Does not exist yet. To be created for user ↔ agent notes.

### Existing Patterns
- `.pam/tasks.json` §phase-1 — Current task structure (9 tasks, ~96 subtasks = 128 flattened cards). The exact problem to fix.
- `.pam/tasks.json` §project — Project metadata (total estimated hours, weekly target, target completion)

### Standards Reference (Research)
- [Jira Issue Hierarchy — Epic / Story / Task / Subtask](https://www.atlassian.com/software/jira/guides/issues/overview) — The model this phase follows
- [Jira Card Customization](https://support.atlassian.com/jira-software-cloud/docs/customize-cards) — Card layout reference
- [Jira Agile Metrics — Burndown, Velocity, Cycle Time](https://www.atlassian.com/agile/project-management/metrics) — Metrics reference (used for agent decisions)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Vue 3 SPA pattern:** Current dashboard uses Vue 3 CDN with `createApp`. This pattern is lightweight and works — can be kept or replaced with a build step. Keeping CDN avoids adding a build pipeline.
- **Zero-dep Node.js server:** `server.js` uses only built-in `http`, `fs`, `path`, `child_process` modules. This constraint keeps deployment simple — no `npm install` needed for the dashboard.
- **JSON read/write helpers:** `readJSON()` / `writeJSON()` in `server.js` are reusable. Add similar helpers for `comments.json`.
- **Git integration:** Server already parses `git log`, `git status`, `git diff`. Keep and extend.

### Established Patterns
- **API endpoint pattern:** Routes defined via `route(method, pattern, handler)`. Simple and works.
- **Fetch-based Vue components:** Dashboard uses `fetch()` with async/await to call API. Keep this pattern for comments and new endpoints.
- **60-second auto-refresh:** `setInterval(fetchStatus, 60000)` — keep for live updates.

### Integration Points
- `server.js` — New endpoints needed: `POST /api/comments` (create), `GET /api/comments?task_id=X` (read by task), `PATCH /api/comments/:id/read` (mark read)
- `server.js` — Clocking endpoints to remove: `POST /api/clock-in`, `POST /api/clock-out`, `POST /api/reset-week`
- `server.js` — Simplify: `POST /api/task/update` (keep but add hours field), `POST /api/task/active` (keep for setting active task)
- `dashboard.html` — Full rewrite of the Vue component (layout, card design, chart components)
- `cli.sh` — Remove clock-in/out commands. Add `comments` command to list unread comments in terminal.

</code_context>

<specifics>
## Specific Ideas

- **"Like Jira"** for card display, drill-down, and sub-board — the primary UX reference
- **Comments should be easy for agent to find** — separate `comments.json` file, `read` boolean field. Agent checks at session start.
- **Data should survive browser wipes** — already true (server-side JSON files), but worth calling out explicitly
- **Global view + per-phase tabs** — user wants to see everything at once but also drill into specific phases
- **Steal from how Jira epics work** — parent tasks on the board with progress bars, children hidden inside (exactly how Jira handles epics → stories board)
- **Burndown chart over velocity** — the user has deadlines, not sprints. Burndown tracks remaining work against remaining time, which maps directly to "finish by October 1"

</specifics>

<deferred>
## Deferred Ideas

- **SQLite migration** — considered and rejected. JSON files are sufficient for solo project data volume. Can migrate later if needed.
- **Real-time collaboration** — solo project, no need.
- **External tool integration** (Linear API, GitHub Projects sync) — possible future enhancement, not needed now.
- **Mobile app or PWA** — nice-to-have, deferred indefinitely.
- **Automated agent comment-check reminder** — the user decided it's the agent's responsibility to remember. No automated notification system needed.

</deferred>

---

*Phase: 00-PAM Dashboard & Project Management Tooling*
*Context gathered: 2026-06-03*
