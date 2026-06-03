# Phase 00: PAM Dashboard & Project Management Tooling — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-03
**Phase:** 00-PAM Dashboard & Project Management Tooling
**Areas discussed:** Data storage, Remove clocking, Task abstraction model, Card display, Sub-board/drill-down, Information architecture, Progress metrics, Comments system

---

## Data Storage

| Option | Description | Selected |
|--------|-------------|----------|
| JSON files (current) | Already in use — `.pam/state.json`, `.pam/tasks.json`. Server-side disk storage, NOT localStorage. | ✓ |
| SQLite | Add `better-sqlite3` dependency for proper query support | |
| Hybrid | Use SQLite for task data, JSON for comments | |

**User's choice:** JSON files are fine — keep current approach. No SQLite needed.
**Notes:** User thought data was in localStorage (a "noob-level" concern). Clarified that it's actually server-side JSON files, so data survives browser wipes. User approved keeping JSON files.

---

## Remove Clocking Feature

| Option | Description | Selected |
|--------|-------------|----------|
| Keep clocking | Current system with clock-in/clock-out, session tracking | |
| Remove, replace with inline hours | Type hours when marking tasks done — no start/stop friction | ✓ |
| Keep but simplify | Remove modal, keep simple timer | |

**User's choice:** Remove it — redundant for solo project.
**Notes:** User explicitly said "Remove the clocking feature as it's redundant."

---

## Task Abstraction Model

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 3 levels (Phase→Task→Subtask), fix display | Current data structure is fine. Fix is to STOP flattening subtasks into cards on the board. | ✓ |
| Add 4th level (Phase→Epic→Task→Subtask) | More granular, but requires restructuring all tasks.json data | |
| Flatten to 2 levels (Phase→Task, no subtasks) | Merge subtasks into task descriptions | |

**Agent's choice:** Keep 3 levels, fix display only.
**Rationale:** Jira's standard hierarchy is Epic → Story/Task → Subtask (3 levels). Jira explicitly blocks subtask-of-subtask. Current data already fits. Going deeper means rewriting data without real benefit. The problem is display, not structure — 128 subtasks shown as cards is the bug, not 128 tasks.

---

## Card Display — Like Jira

| Option | Description | Selected |
|--------|-------------|----------|
| Current display | Shows all subtasks as individual cards with name/hours/deadline | |
| Jira-style | Card shows: name, progress bar, rollup stats (X/Y done), hours, priority, deadline. Subtasks hidden inside detail panel. | ✓ |
| Minimal | Show only name and status badge. Click for everything else. | |

**User's choice:** Like Jira.
**Notes:** User explicitly said "as i said before, it should be like Jira."

---

## Sub-board / Drill-down — Like Jira

| Option | Description | Selected |
|--------|-------------|----------|
| Current subtask modal | Flat list with done/undo buttons | |
| Full task detail panel | Right-side panel with subtask checkboxes, hours entry, comments, description | ✓ |
| Separate page per task | Route-based navigation (/task/:id) | |

**User's choice:** Like Jira — detail panel approach.

---

## Information Architecture

| Option | Description | Selected |
|--------|-------------|----------|
| Current tab-based | Phase tabs only, no global view | |
| Global overview + phase tabs | Default landing page shows all phases. Tabs filter to specific phase. | ✓ |
| Single scrollable page | Everything on one page, no tabs | |

**User's choice:** Global overview + same per-phase tab view. "Yes we need a global view across phases."

---

## Progress & Velocity Metrics

| Option | Description | Selected |
|--------|-------------|----------|
| Burndown + hours + weekly trend | Three simple charts for solo dev. No team metrics. | ✓ |
| Full Jira suite | Velocity, cycle time, CFD, control chart | |
| Bare minimum | Just percentages and hours — no charts | |

**Agent's choice:** Burndown + hours comparison + weekly trend.
**Rationale:** Velocity and cycle time are team-oriented metrics designed for sprint-based work with story points. For a solo developer with fixed deadlines, burndown (remaining hours vs remaining days) is the single most useful chart. Hours comparison improves estimation over time. Weekly trend keeps accountability without clocking.

---

## Comments System

| Option | Description | Selected |
|--------|-------------|----------|
| No comments | No user → agent communication channel | |
| Separate comments.json file | Independent from tasks.json. Easy for agents to find. Read/unread status. Categories. | ✓ |
| Inline comments in tasks.json | Comments embedded inside each task object. Harder for agents to query. | |

**Agent's choice (designed from user concern):** Separate `comments.json` file with read/unread status.
**Notes:** User wanted: (1) ability to input notes on cards, (2) read/unread status for agent, (3) easy for agent to query (separate bucket/collection). This design satisfies all three. Agent is responsible for checking at session start.

---

## the agent's Discretion

- **Chart library:** Use Chart.js + vue-chartjs, or draw SVG inline. Both are fine — Chart.js is easier for interactive charts, SVG keeps zero-dependency ethos.
- **CSS approach:** Keep raw CSS or adopt Tailwind. Raw CSS means no new dep. Tailwind matches the Next.js frontend pattern.
- **Hours entry UX:** Small inline input per subtask, or one field per task. Keep it simple either way.

## Deferred Ideas

- SQLite migration — not needed now
- Real-time collaboration — not needed
- External tool integration — future
- Mobile app/PWA — future
- Automated agent comment-check reminders — user decided agent should remember

---

*Phase: 00-PAM Dashboard & Project Management Tooling*
*Discussion logged: 2026-06-03*
