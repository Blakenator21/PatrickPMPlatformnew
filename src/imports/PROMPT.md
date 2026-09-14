# Bolt.new build prompt — 1CG Job Site Tool

Paste everything below into a fresh Bolt.new chat to scaffold the app.

---

Build a construction job-site management web app called "1CG Job Site Tool" as a React + TypeScript + Vite app styled with Tailwind CSS. No backend — persist all state to `localStorage` (single key `onecg-job-site-tool-v1`, whole state tree serialized on every change).

## Brand
- Primary/brand red: `#EC2027`. Pressed/active gradient: `#f4474d → #EC2027 → #cf1a20`.
- Amber (important/warning): `#F5A623`. Overdue solid fill: `#7A0C11` with white text.
- Page background gradient: `#fbfbfc → #f2f2f4 → #eeeef1`. Card borders `#dddddd`. Muted text `#8a8a90`. Body text `#1c1c1e`.
- Job color palette (12, auto-assigned to new jobs, red/orange excluded): `#1976D2 #0277BD #00838F #00796B #2E7D32 #558B2F #7B1FA2 #512DA8 #303F9F #C2185B #5D4037 #455A64`. If exhausted, generate a new distinct hue algorithmically rather than reuse one.
- Font: `'Century Gothic', Futura, 'Segoe UI', sans-serif` (system fallbacks only, no webfont). Section labels: uppercase, 10.5–11px, 700 weight, letter-spacing ~0.9–1.1px. Body 13–15px.
- Shape: 7–12px corner radius everywhere, 2px borders on primary cards/columns, soft layered shadows (inset highlight + outer drop shadow), not flat.

## Layout shell
Slim top bar spanning full width with the logo (left-aligned, `height:auto`, keep its ~8.5:1 aspect ratio — use `reference/1cg-logo.png`). Left sidebar, sticky/full-height: job selector, user switcher, global search box, vertical nav tabs (drag-and-drop reorderable, order persisted). Content area to the right renders the active tab.

## Data model
- **Job**: id, name, color, turnoverDate, checklist (map of `sectionKey-itemIndex` → boolean), draftReport (map of field key → value), reports (array of `{id, data}` snapshots), tasks (array of Task), files, archived (bool).
- **Task**: id, text, column (`todo`/`inprogress`/`done`), dueDate, urgent (bool), important (bool), pinned (bool), assignee (user id), repeat (`none`/`daily`/`weekdays`/`weekly`/`monthly`/`yearly`/`custom`), customInterval, customUnit (`day`/`week`/`month`), repeatLabel (derived display string).
- **User** (hardcoded placeholder roster, not real auth): id, name, role (`Master`/`Member`). Master can additionally filter by other users (checkboxes) across every module and search. Flag in a code comment that this whole layer must be replaced with real auth before production.

Derived logic to implement exactly:
- Overdue = has dueDate, column ≠ done, dueDate < today.
- Dashboard job ranking = sort by overdue count desc, then completion % asc.
- **Recurring tasks use a rolling single-instance model** — never generate one row per occurrence. A recurring task is always exactly one record. Marking it Done doesn't archive it: it snaps back to `todo` with dueDate advanced to the next occurrence per its repeat rule. Show a repeat badge (↻ + human label, e.g. "Weekly", "Every 2 weeks") on any card with an active rule.

## Screens (tabs)
1. **Milestone Checklist** (default landing tab) — per-job checklist grouped into dated section cards (Week 1, Week 2…), each header showing a date range computed off the job's Turnover Date. Each section: title + range + checkbox items; checking persists per job. Progress readout (completed/total, %) per section and per job.
2. **Weekly Status Report** — New / Archive tabs. New: inline short-text fields + multi-line text fields, editable inline. "Auto-fill" drafts specific fields from live job data (checklist completion %, overdue/upcoming tasks), only filling blank fields, marking which it touched (dismissible per field). "Save to Archive" snapshots the draft (each archive entry date-stamped, expandable to label/value rows, with "Duplicate" opening a new draft pre-filled from it minus the date). "Start blank" clears the draft with a confirm dialog. "Copy report as text" serializes all fields to plain text.
3. **Task Board** — composer bar (text, due date, Repeat, Column, Job — can target a different job than the open one, Assignee, Urgent/Important toggles, Add). Three drag-and-drop kanban columns (To Do / In Progress / Done), scoped by This Job/All Jobs/Choose Jobs and All Tasks/This Week/Choose Week. Cards: text, assignee initials badge, pin toggle, delete, due-date picker, OVERDUE flag, repeat badge, Urgent/Important toggles, "reassign to job" dropdown, native HTML5 drag handle. Sort: overdue first, then pinned.
4. **Calendar** — month grid, same scoping as Task Board. Each day lists due tasks as colored chips (color = job), capped at 4 + "+N more" fixed-position popover. Sticky legend (Overdue/Due-today + one swatch per job in scope). Clicking a chip opens an edit modal, or jumps to and flashes the task on the Task Board if visible there.
5. **Dashboard** — same scoping. Headline: Overdue count first (risk-first), then overall completion. Per-job list sorted by overdue desc, ties by completion % asc. Segmented progress bars per checklist section, aggregated.
6. **By Job** — one card per job, side-by-side with horizontal scroll, each card a **fixed height with its own internal scrollbar** (row height never grows). Cards drag-reorderable by header, order persists. Hides Done tasks. Inline "Add a task" input (always adds to To Do), open tasks sorted overdue/pinned first, each showing status, due date, OVERDUE flag, repeat badge, pin/delete.
7. **Tools** — grid-of-cards page (not a dropdown) for small utilities, laid out to scale as more are added. Include a **Tick Counter** (tally counter: increment/decrement/reset) and a placeholder **Glass Tag Extractor** card (screenshot-to-table utility — stub the UI, note that it calls an AI vision API to extract a table from an uploaded image).

## Cross-cutting
- Global search in the top bar matches task text across all jobs/users, shows each result's job + column, jumps to and flashes the task on Task Board when clicked.
- Sticky top bar during scroll.

Use the reference screenshots in `reference/all-screens.png` (all 7 screens, stacked and labeled) for exact visual layout, spacing, and color per screen, and `reference/1CG-Job-Site-Tool-bundled.html` (open directly in a browser) as the live interaction reference — replicate its behavior, not its markup.
