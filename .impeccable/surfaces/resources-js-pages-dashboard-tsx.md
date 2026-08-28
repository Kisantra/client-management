---
version: 1
slug: "resources-js-pages-dashboard-tsx"
primary_target: "resources/js/pages/dashboard.tsx"
related_targets: ["resources/js/components/dashboard","resources/js/components/app-sidebar.tsx"]
---

## Scope

The authenticated dashboard at `/dashboard` plus the app shell it sits in (sidebar, header, navigable module placeholders). Visitor mode: **Operate** — this is a daily workspace, not a marketing surface.

## Audience and job

The firm's own digital marketing team, 8–20 people, opening the app at the start of the working day. The job is two things at once, and the order matters: first "what do I owe today and what is already late", then "how are the pipeline and the content doing". The user chose that order explicitly; today's work sits above the condition read, never below it.

## What the surface must answer

- Which tasks are due today, who owns them, and **which stage a late item is stuck in** — not merely that it is late.
- Where every lead stands across the six confirmed stages, and how many in each stage have stopped moving.
- Which channel actually produces leads per piece of content published.
- Whether the workload is spread or piled on one person.

## Chosen direction

"Lembut", picked by the user from a four-design visual comparison after two concept-led directions were rejected by sight. Light warm-neutral ground, white surfaces, hairline borders, generous radii, soft offset shadows, teal primary with a single anchored gradient tile. The lesson from the rejected rounds is recorded here on purpose: **this surface is judged on how pleasant and legible it is, not on how clever its concept is.**

## Rules this surface holds

- Red means lateness and nothing else. A pipeline bar shows the stalled share as a red segment inside the teal bar, never a fully red bar.
- No figure ships alone. Every number carries the quantity it is measured against (published vs target, assigned vs capacity, leads vs content published).
- Wide content scrolls inside its own container; the page never scrolls sideways.
- Content is dense but never cramped — the density lever the user disliked in earlier rounds is gone.

## Memorable moment

The pipeline row: one glance shows both the size of a stage and the portion of it that has stopped moving, in the same bar.

## Unresolved

- Role and permission split inside the team is undecided, so no per-role view exists yet.
- Metrics are static sample data. The read models must stay shaped so Meta/GA4/TikTok can be attached later without reshaping the surface.
- App name and logo mark are placeholders; the firm supplied no identity.
- "Lihat semua" on today's tasks currently points back at the dashboard until the Task module exists.
