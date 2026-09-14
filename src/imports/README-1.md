# Bolt.new handoff — 1CG Job Site Tool

## How to use
1. Go to [bolt.new](https://bolt.new), start a new chat.
2. Open `PROMPT.md`, copy its full contents, paste as your first message.
3. Attach `reference/all-screens.png` to that same message (drag-and-drop into the Bolt chat) so it scaffolds against real visuals, not just text — it's all 7 screens stacked and labeled in order.
4. Once it scaffolds, open `reference/1CG-Job-Site-Tool-bundled.html` in a browser tab side-by-side to check interaction behavior (drag-and-drop, recurring task advance, popovers, modals) against what Bolt builds — ask it to fix specific mismatches in follow-up messages.

## What's in here
- `PROMPT.md` — the ready-to-paste build prompt (tech stack, brand tokens, data model, full screen specs).
- `reference/all-screens.png` — all 7 screens, stacked and labeled, in one image.
- `reference/1CG-Job-Site-Tool-bundled.html` — the working prototype, self-contained, open directly in a browser.
- `reference/1cg-logo.png` — header wordmark asset; upload it into the Bolt project's `public/` or `assets/` folder once scaffolded.

## Notes
- This ships a **placeholder multi-user layer** (hardcoded roster) and **localStorage-only state** — call this out to whoever picks it up if the target is a real multi-tenant website; it'll need real auth and a backend/database behind these same data shapes.
- Recurring tasks are **rolling single-instance**, not batch-generated — this is called out explicitly in the prompt since it's easy to default to the wrong model.
