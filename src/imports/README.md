# Figma Handoff — 1CG Job Site Tool

## What this is
A working prototype of a construction job-site management tool (checklist, weekly report, task board, calendar, dashboard, "By Job" view, small tools). Built in HTML/CSS/JS as a functional reference — not production code. Use this package to recreate the screens in Figma, then build the real front end from the Figma file.

## How to bring it into Figma
1. **Screenshots** (`screens/`) — one full-resolution PNG per screen, pixel-accurate. Drag straight into a Figma page as image frames to trace/rebuild over, or hand to a "screenshot → layers" plugin (e.g. html.to.design's image mode).
2. **Live HTML** (`1CG-Job-Site-Tool-bundled.html`) — a single self-contained file with the real DOM/CSS. Open it in a browser and point a plugin like **html.to.design** at the page (its "import from URL" or browser-extension capture mode) for an editable layer structure instead of a flat image. Ask me for a fresh temporary link to this file if the plugin needs a URL — the one used to build this package expires quickly.
3. **This README** — colors, type, spacing, and component notes below, for whoever rebuilds it (in Figma or straight into code).

## Screens
| File | Screen |
|---|---|
| `01-milestone-checklist.png` | Milestone Checklist — default landing tab, dated section cards with checkboxes + progress bar |
| `02-weekly-status-report.png` | Weekly Status Report — New/Archive tabs, auto-fill, save-to-archive |
| `03-task-board.png` | Task Board — composer + To Do/In Progress/Done kanban columns |
| `04-calendar.png` | Calendar — month grid, task chips, legend |
| `05-dashboard.png` | Dashboard — overdue count, milestone progress ring, per-section bars |
| `06-by-job.png` | By Job — one fixed-height card per job site, side-by-side, own scrollbar |
| `07-tools.png` | Tools — grid of small utilities (Tick Counter, Glass Tag Extractor) |

All screens share the same shell: full-width top bar with logo, left sidebar (job selector, user switcher, search, nav tabs), content area to the right.

## Design tokens
- **Brand red**: `#EC2027` — primary buttons, active nav tab, overdue accents. Pressed/active gradient: `#f4474d → #EC2027 → #cf1a20`.
- **Amber (important/warning)**: `#F5A623`.
- **Overdue fill**: `#7A0C11` (dark red card background, white text).
- **Page background**: gradient `#fbfbfc → #f2f2f4 → #eeeef1`.
- **Neutrals**: card borders `#dddddd`; muted/label text `#8a8a90`; body text `#1c1c1e`.
- **Job color palette** (12, red/orange reserved for status): `#1976D2 #0277BD #00838F #00796B #2E7D32 #558B2F #7B1FA2 #512DA8 #303F9F #C2185B #5D4037 #455A64`.
- **Type**: `Century Gothic` / `Futura` (fallback `Segoe UI`, sans-serif) throughout. Section labels: uppercase, 10.5–11px, 700 weight, letter-spacing ~0.9–1.1px. Body 13–15px.
- **Shape**: 7–12px corner radius everywhere; 2px borders on primary cards/columns; soft layered shadows (inset highlight + outer drop shadow), not flat shadows.

## Components to recreate as reusable Figma components / code components
- Nav tab (default / active / hover states)
- Primary button (red), secondary button (outline), ghost/text button
- Task card (default, overdue, pinned, with repeat badge, with assignee initials badge)
- Job color swatch / chip
- Section/card container with header bar
- Search result row, dropdown/popover panel
- Progress bar (linear) and progress ring (circular, Dashboard)
- Modal (job management, task edit)

## Assets
- `assets/1cg-logo.png` — header wordmark. Rendered full-bleed height in the top bar (`height: auto`, left-aligned, `object-fit: contain`); keep its ~8.5:1 aspect ratio.

## Notes for the person rebuilding this
- This is a **design/behavior reference**, not code to lift as-is — no backend, state is local-only, multi-user is a hardcoded placeholder (flag this to whoever wires up real auth).
- Recurring tasks use a **rolling single-instance model**: completing a repeating task advances its due date instead of creating a new row. Preserve this behavior, don't batch-generate dated instances.
- If anything in a screenshot is ambiguous (hover/open states, drag interactions), ask — I can generate more reference states from the live prototype.
