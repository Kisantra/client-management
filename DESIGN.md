---
name: Lembut
description: A soft, cool-neutral workspace for an in-house marketing team that keeps content, leads, and active clients on one screen.
colors:
  background: "#f7f9f8"
  foreground: "#101a17"
  card: "#ffffff"
  primary: "#0b7a6c"
  primary-foreground: "#ffffff"
  primary-deep: "#06564c"
  primary-soft: "#e8f6f3"
  primary-bright: "#12a594"
  secondary-foreground: "#33413d"
  muted-foreground: "#64716d"
  neutral-soft: "#f1f5f4"
  border: "#e6ecea"
  input: "#dde5e3"
  ring: "#0b7a6c"
  destructive: "#c1381f"
  destructive-soft: "#fdece9"
  info: "#2f5c88"
  info-soft: "#edf3fb"
  ink-panel: "#0f1a18"
  ink-panel-foreground: "#ffffff"
  chart-2: "#7ecfc3"
  chart-3: "#b7e2da"
  chart-4: "#e2efec"
typography:
  figure:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.035em"
    fontFeature: "tabular-nums"
  headline:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 2vw, 1.5625rem)"
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  row:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8438rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "normal"
  control:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "normal"
  caption:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "normal"
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  sm: "8px"
  md: "11px"
  lg: "14px"
  xl: "18px"
  full: "9999px"
spacing:
  xs: "6px"
  sm: "10px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "rgb(11 122 108 / 0.9)"
    textColor: "{colors.primary-foreground}"
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.control}"
    rounded: "{rounded.md}"
    padding: "0 24px"
    height: "40px"
  button-outline-hover:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-deep}"
  panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "20px"
  stat-tile:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.xl}"
    padding: "18px"
  stat-tile-anchor:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.xl}"
    padding: "18px"
  pill-positive:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-deep}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
  pill-late:
    backgroundColor: "{colors.destructive-soft}"
    textColor: "{colors.destructive}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  pill-quiet:
    backgroundColor: "{colors.neutral-soft}"
    textColor: "{colors.muted-foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
    padding: "0 8px"
    height: "40px"
  nav-item-active:
    backgroundColor: "{colors.primary-soft}"
    textColor: "{colors.primary-deep}"
    rounded: "{rounded.md}"
    height: "40px"
  input-search:
    backgroundColor: "{colors.neutral-soft}"
    textColor: "{colors.foreground}"
    typography: "{typography.row}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
---

# Design System: Lembut

## Overview

**Creative North Star: "The Quiet Ledger"**

Lembut is a workspace that behaves like a well-kept ledger rather than a dashboard: cool paper underneath, white pages laid on it, a hairline ruled between every entry, and one column of ink that means *this matters today*. It is built for a team that opens the app at 9am to find out what it owes and what has already slipped, and it is judged on how pleasant and legible it is at that moment, never on how clever its concept is.

The world refuses the floating card grid on gray where every figure is an island. Figures here are always paired with the quantity they are measured against, panels sit on a cool-neutral ground rather than float above a dead one, and the loudest mass on the screen is a single teal tile that anchors the composition instead of a scattering of colored accents. Density is high — hundreds of leads a month is the normal state, not the extreme — but the rhythm is generous enough that nothing reads as cramped: 14px base radii, 20px panel padding, and 10-12px row gaps do the softening that a smaller radius and tighter gutters would have taken away.

Depth is deliberate and shallow. Surfaces lift by one or two pixels of tinted, offset shadow; nothing glows, nothing floats, and no border ever exceeds a hairline. Color is rationed to two jobs: teal is the product's voice and brick red is the breach signal. Everything else is a cool neutral doing structural work.

**Key Characteristics:**
- Cool-neutral ground with white surfaces and 1px hairline borders — no gray card grid, no heavy rules.
- Two teals with a hard division of labour: the deep one carries text, the bright one never does.
- Red is the breach color — late, stalled, over capacity — and is never decorative.
- Every figure carries its counterweight; a bare number is an unfinished number.
- Manrope from 400 to 800, with tabular figures in every data column.
- Browser surfaces — selection, caret, focus ring, scrollbars, accent-color — are themed from the palette, not inherited from the browser.

## Colors

A cool, slightly green-shifted neutral field carrying one teal voice and one brick-red alarm; nothing else earns a hue. `resources/css/app.css` is the source of truth: the frontmatter above records the light theme, and a fully tokenized dark theme mirrors every entry under `.dark`.

### Primary
- **Deep Teal** (`{colors.primary}`): The product's voice and the only teal permitted to carry text. Every text-bearing teal fill uses it — the primary button, the active nav badge, the anchor stat tile's gradient start, the logo tile, the solid share of a pipeline bar, the newest bar in the twelve-month chart. It clears 4.5:1 against white (5.2:1).
- **Teal Ink** (`{colors.primary-deep}`): The reading weight of teal. Used as text on tinted teal surfaces (soft-teal chips, "Lihat semua" links, module-placeholder icon plates) and as the far end of the anchor tile's 150-degree gradient.
- **Teal Tint** (`{colors.primary-soft}`): The soft teal surface. Backs quiet teal chips, positive delta pills, the running-task avatar, and empty-state icon plates.
- **Bright Teal** (`{colors.primary-bright}`): A data-only teal at 3.07:1 on white. In the shipped build its single use is hover feedback on a chart bar; it never carries text and never becomes a resting fill, so the anchor tile stays the loudest teal mass on the page.

### Secondary
- **Alarm Brick** (`{colors.destructive}`): The breach color. Late task badges, the stalled count on a pipeline row, the stalled segment inside a pipeline bar, over-capacity slots in the team meter, and the "terlambat" count in the page subhead.
- **Alarm Wash** (`{colors.destructive-soft}`): The tinted bed for brick-red text — late badges and negative pills only.

### Tertiary
- **Cool Slate** (`{colors.info}`) and **Slate Wash** (`{colors.info-soft}`): Reserved for the completed and settled state, so "done" reads as resolved rather than as a second success color. Currently used only by the done task badge.
- **Deep Ink Panel** (`{colors.ink-panel}` on `{colors.ink-panel-foreground}`): Stays dark in both themes. It is the ground for the two surfaces that are not part of the page — the closed-lead pill and the video theatre's scrim — and it never appears in the sidebar rail, which carries no chromatic weight of its own.

### Neutral
- **Cool Paper** (`{colors.background}`): The page ground. Also painted on `html` before first paint so the theme never flashes white.
- **Panel White** (`{colors.card}`): Every panel, stat tile, and placeholder card.
- **Deep Pine Ink** (`{colors.foreground}`): Body and heading text, the chart tooltip fill, and the tint source for every neutral shadow.
- **Slate Text** (`{colors.secondary-foreground}`): Row labels, sidebar nav text, and filled slots in the team-load meter.
- **Muted Text** (`{colors.muted-foreground}`): Secondary lines, column heads, metadata — 5.1:1 on white, never lighter.
- **Quiet Surface** (`{colors.neutral-soft}`): The recessed neutral. Search field, header icon buttons, meta chips, unfilled meter slots, and every bar track.
- **Hairline** (`{colors.border}`) and **Field Edge** (`{colors.input}`): 1px separation only.

### Channel Tints
- **Instagram** (`{colors.channel-instagram}` / `{colors.channel-instagram-foreground}`), **Facebook** (`{colors.channel-facebook}` / `-foreground`), **Twitter** (`{colors.channel-twitter}` / `-foreground`), **TikTok** (`{colors.channel-tiktok}` / `-foreground`), **LinkedIn** (`{colors.channel-linkedin}` / `-foreground`), **Web/SEO** (`{colors.channel-web}` / `-foreground`): one soft bed and one reading ink per publishing channel, so the content calendar reads by platform at a glance. They carry identity only, never state: a live piece sits in its channel's bed, one still owed is a dashed white card carrying the channel as a mark in that same ink plus a status dot, and a late one drops the tint for Alarm Wash. The dashed edge is what makes the pair legible without colour — the tints differ too little in grey to carry a state on their own. Each ink clears 4.5:1 on its bed and on Panel White.
- **A channel switch wears its channels.** Where a control chooses between platforms rather than between states, the chosen one sits in that channel's own bed instead of Deep Teal. It is the same tint the calendar uses for a live piece, doing the same job: filled means this one, plain card means not. Deep Teal is left to the controls beside it, so "which account" and "which reading of it" stop looking like one question asked twice.
- **One piece, several channels.** A piece is written once and posted to more than one place, so the channel is a set. The card takes the tint of the first channel chosen — a card striped three ways reads as decoration — and the rest ride along as marks beside it. X is the exception the palette has to allow for: its brand is black, so its bed carries chroma from nowhere and reads as depth alone.

### Chart Ramp
- **`{colors.chart-2}` / `{colors.chart-3}` / `{colors.chart-4}`**: The descending teal steps for non-focal data marks. The twelve-month chart reads as one hue at three depths with the current period in full Deep Teal, so recency is carried by saturation rather than by a second color.

### Named Rules

**The Two Teals Rule.** Deep Teal carries every fill that has text on it and clears 4.5:1. Bright Teal is a data color: it may fill a mark, never a text-bearing surface, and in this build it appears only on hover. If a new surface needs teal behind words, it uses Deep Teal or Teal Ink — never Bright Teal at any opacity.

**The Red Means Breach Rule.** Brick red marks something that has crossed a line: late, stalled, over capacity. It never marks a negative delta, a destructive-looking action, or a decorative accent, and it never fills a whole bar — a pipeline bar shows the stalled share as a red segment *inside* the teal bar so size and trouble read in one glance. The one non-breach use in the build is the 7px unread dot on the notification button; treat that as the exception, not the licence.

**The Stopping Is Not Breach Rule.** A lead that stopped is not late — it is a closed decision, so it never reads in brick red. Deep Ink Panel carries the state instead: the "Tidak lanjut" chip in the filter row, the status chip on the lead's own page, and the button that confirms the closure. Its record on the page sits on Quiet Surface with Slate Text. Red would say "someone is failing to act"; ink says "nobody is meant to act any more". The same rule removes the red legend and the "Hanya mandek" filter from the closed list entirely, because nothing there can be late.

**The Counterweight Rule.** No figure ships alone. Every number is rendered next to the quantity it is measured against — published against target, assigned against capacity, leads against content published, stage count against stalled count. A tile that has only a big number and a label is not finished.

## Typography

**Body & Display Font:** Manrope (with `ui-sans-serif, system-ui, sans-serif`), served through the build's Bunny Fonts pipeline at weights 400, 500, 600, 700, 800.
**Label/Mono Font:** None. Numerals are handled by Manrope's tabular figures, not by a monospace face.

**Character:** One humanist grotesque doing every job, pushed hard at the top end. Manrope's tall x-height keeps 13px rows readable at density, and its 800 weight is heavy enough that hierarchy can be carried by weight and negative tracking instead of by size — which is what keeps a dense operations screen from having a shouting headline on it.

### Hierarchy
- **Figure** (800, 1.875rem, line-height 1, -0.035em, tabular): Stat tile values. The largest type in the system.
- **Headline** (800, 1.5rem rising to 1.5625rem at `sm`, -0.03em): The page greeting and module titles. One per screen.
- **Title** (800, 1rem, -0.02em): Panel headings. Deliberately close to body size; the weight does the separating.
- **Body** (400, 0.875rem, 1.5): Page subhead, descriptions, empty-state copy. Long copy is capped near 34ch in the empty state and never runs wider than a single panel column.
- **Row** (700, 0.8438rem): The primary text of a list row or table cell — task title, channel name, pipeline stage.
- **Control** (500, 0.875rem): Button and control text.
- **Caption** (400, 0.75rem): The secondary line under a row, tile captions, meter status.
- **Label** (700, 0.6875rem, +0.06em to +0.13em, uppercase): Column heads, badges, pills, sidebar group labels, the sample-data chip.

### Named Rules

**The Tight-Ramp Rule.** The whole ramp spans 0.6875rem to 1.875rem — under 3x. Hierarchy comes from weight (800 against 700 against 400) and from negative tracking on the heavy end, not from scale jumps. If a new heading needs to feel bigger, raise its weight before its size.

**The Tabular Column Rule.** Figures in a data surface never reflow as their value changes. `font-variant-numeric: tabular-nums` is applied globally to `table` and to anything marked `[data-numeric]`; every number that sits in a column, a badge, or a stat tile carries that attribute.

**The Uppercase-Is-Structural Rule.** Uppercase with positive tracking is reserved for structural micro-labels — column heads, group labels, state badges. It is never used above a heading as an eyebrow.

## Layout

The shell is a persistent 16rem sidebar (3rem when collapsed to icons, an 18rem sheet on mobile) with an inset content pane, and a 4rem header that tightens to 3.5rem when the sidebar collapses. The header carries breadcrumbs, a search field that becomes a toggling drawer below `md`, and two icon actions.

The dashboard is a single vertical stack at 20px rhythm, padded 16px on mobile and 24px from `sm`. Its three bands are: a four-up stat row, then two panel rows each split `1.5fr / 1fr` at `xl`. Below `xl` every row collapses to one column, and the stat row holds at two columns rather than one, so the tiles stay a block instead of becoming a tower. In the first panel row the DOM order is reversed against the visual order so today's tasks land first on a phone — the ordering promise of the surface, kept at every width.

Spacing rhythm: 20px between page bands, 16px between panels, 12-16px between tiles, 20px inside a panel, 18px inside a stat tile, 10-12px between rows inside a list. Breakpoints in use are `sm` (640px), `md` (768px), and `xl` (1280px); the dashboard grid has no `lg` step.

### Named Rules

**The Measure-Your-Own-Box Rule.** A grid that lives inside a column, a panel, or a sheet asks its own container how much room it has, never the window. A viewport breakpoint describes space the element may not have: the same card list is three across in a full-width panel and two across in two thirds of a row, and `xl:` cannot tell them apart. Container queries carry the form's columns, the post panel's metric row, and the leaderboard's cards.

**A thin list reaches, it does not pad.** A panel whose height is set by a taller neighbour and whose list ends early has two honest answers and one dishonest one. The dishonest one is loosening the rows until they fill. The honest ones are pinning a summary to the foot so the leftover reads as a margin, and reaching further into the same question — a week's queue that runs short takes the next week's work and rules a named line before it. Never filler; the same question asked one step further out.

**The Short-Panel Rule.** Two panels in a row keep the same height whether their content does or not, so the shorter one puts its closing note in the panel's footer slot rather than trailing it after the content. The height the row obliges it to keep then reads as a margin above a footer instead of a hole after a table.

**The No-Sideways-Scroll Rule.** The page never scrolls horizontally. Wide content owns its own scroll: the twelve-month chart and the channel table each sit in an `overflow-x-auto` container with a min-width floor (26rem and 22rem), the content pane is `overflow-x-clip`, and every flex row holding a truncating label carries `min-w-0`.

**The Two-Line Label Rule.** In the stat row below `xl`, the label slot reserves a fixed minimum height so a wrapping two-word label cannot knock its row-mate's figure off the shared baseline.

## Elevation & Depth

Hybrid, and shallow on purpose. Structure comes from tonal layering — cool ground, white surface, quiet recessed fills — and shadow only confirms that a surface is a separate sheet rather than a region of the page. There is no elevation scale beyond "resting" and "teal thing"; nothing in the system rises on hover.

### Shadow Vocabulary
- **Lift** (`box-shadow: 0 1px 2px rgb(16 26 23 / 0.05), 0 1px 3px rgb(16 26 23 / 0.04)`): Every resting white surface — panels, plain stat tiles, the module placeholder card, the chart's hover tooltip. Tinted from Deep Pine Ink, never black.
- **Teal Lift** (`box-shadow: 0 4px 12px rgb(11 122 108 / 0.3)`): Under Deep Teal fills that are small and solid — the primary button, the logo tile. Tinted from `{colors.primary}` itself.
- **Teal Lift Large** (`box-shadow: 0 8px 22px rgb(6 86 76 / 0.34)`): The anchor stat tile only. Tinted from `{colors.primary-deep}`, the darker end of its own gradient.
- **Carry** (`box-shadow: 0 2px 6px rgb(16 26 23 / 0.08), 0 18px 40px rgb(16 26 23 / 0.16)`): The one depth above resting, for the two things actually off the page — a kanban card in transit, and a detached side panel (the content calendar's piece panel, the Instagram post panel). Same ink tint as Lift, pushed far enough that what is underneath reads as a surface rather than a neighbour.

### Named Rules

**The Only Lifted Things Rise Rule.** Nothing lifts on hover, on focus, or to signal importance; the resting sheet is the ceiling. Carry belongs to the two things that are genuinely off the page: a card the pointer is holding — tilted 2.5 degrees and scaled 3%, leaving a dashed hole in the column it came from — and a detached panel laid over the surface, inset from every edge at 14px corners so the page stays visible around it. A panel flush to the viewport edge is part of the frame and takes Lift; one that floats is not, and takes Carry. A static surface may never borrow either.

**The Tinted Shadow Rule.** A shadow is tinted from the thing it falls from — ink under neutral surfaces, the exact teal under teal surfaces — and always carries both an offset and a blur. A zero-offset colored halo is decoration, not depth, and black shadows are never used on this cool ground. When a fill color changes, its shadow tint is re-derived from the new value.

## Shapes

Generously rounded and hairline-ruled. The base radius is 14px, and the family runs 8px (small chips, focus outlines) / 11px (buttons, icon plates, avatars, nav items, search field) / 14px / 18px (panels and stat tiles) / full (pills, badges, meter tracks, scrollbar thumbs).

Bars break the pattern deliberately: chart columns are rounded 14px at the top and barely rounded at the foot, so they read as growing out of the baseline rather than floating as capsules, while every progress track and its fill are fully rounded.

Separation is always a 1px border in Hairline — panel edges, table row rules, task row dividers, the header's bottom edge (at 70% opacity), and the sidebar rail. There is no second rule weight in the system.

### Named Rules

**The Hairline Rule.** One pixel, one color, no exceptions. No rule is thicker than 1px, no card gets a colored left or right edge, and no divider is a shade darker "for emphasis" — if something needs more separation, it gets more space, not a heavier line.

**The Scale Says What It Cut Rule.** A chart may be scaled below its own maximum when one value would flatten every other — but it must then admit it. A bar past the ceiling is drawn full height with a hairline cut across its top in Panel White, the footer counts how many were cut, and the value that caused it is named in words. Silently clipping a bar, or silently letting one spike crush the rest, are the same failure: a chart that cannot be read.

**The Meter Silhouette Rule.** Quantities against a maximum are drawn as a fully-rounded track holding a fully-rounded fill, and that fill is subdivided rather than recolored when part of it is in trouble. Discrete counts (team capacity) use a row of 9x18px slots instead of a continuous bar, so "one task over" is countable rather than estimated.

## Components

### Buttons
- **Shape:** Softly rounded (11px), 40px tall at the page's primary size, 24px horizontal padding.
- **Primary:** Deep Teal fill, white text, Control type (500 weight, 0.875rem), with Teal Lift beneath it. One per screen — the page's single most-wanted action.
- **Hover / Focus:** Hover drops the fill to 90% opacity; focus draws a 3px ring in `{colors.ring}` at 50% and shifts the border to the ring color. Only color and shadow transition; the button never moves.
- **Outline:** Ground-colored fill, Field Edge border, Deep Pine Ink text; hover swaps to Teal Tint with Teal Ink text. Used for the secondary action beside the primary.
- **Link chip:** Panel-header actions ("Lihat semua", "Lihat detail") are a Teal Tint chip with Teal Ink text at 0.8438rem/700, 11px radius, hovering one step deeper — a quiet third tier that never competes with the primary button.

### Chips
- **Positive pill:** Teal Tint bed, Teal Ink text, Label type, fully rounded. Deltas and healthy states.
- **Late pill:** Alarm Wash bed, Alarm Brick text. Late badges and stalled counts. On a late row the badge shows the *time* rather than the word, because the number is the useful part.
- **Quiet pill:** Quiet Surface bed, Muted Text. Panel meta ("12 bulan terakhir"), inactive nav counts, and the sample-data chip.
- **On-anchor pill:** Solid white bed with Deep Teal text — the only pill that inverts, used on the teal anchor tile so the delta stays legible against a gradient.
- **Stopped pill:** Deep Ink Panel bed with white text. The one dark chip outside the sidebar rail, reserved for the closed state so it reads as an exit rather than another stage. Its filter chip is separated from the stage chips by a hairline divider, because the stages are a progression and this is not one of them.

### Cards / Containers
- **Panel** — the workhorse container: 18px corners, Panel White, 1px Hairline border, 20px padding, Lift shadow, clipped overflow, and a flex column so a footer region can pin to the bottom. Header is a Title on the left and either an action chip or a quiet meta pill on the right, with 16px below it. A footer, when present, is separated by a hairline and 16px of padding.
- **Watching is its own surface.** A video small enough to recognise a post is not big enough to watch one, so the frame in a record panel opens into a theatre: the file at the height of the window, over a scrim of Deep Ink Panel, with the same letterbox made of its own cover. It is a surface of ours rather than the browser's fullscreen — the way out, what you are watching, and the way to the original stay where the rest of the app puts them — and a control in the corner still hands it to the operating system for anyone who wants the whole monitor. Nothing is cropped: the video takes its width from its aspect, never from the shape of the screen.
- **A frame fills its own letterbox.** Media in a record panel is centred at its natural aspect, and the space beside it is made of the same image — blown past the edges, blurred out of legibility, and dimmed. A 9:16 cover in a 34rem panel is a sliver: on a plain bed it left more empty field than picture, and the emptiness read as something failing to load. This is the letterbox every video player draws, not decoration, and it makes the surround belong to the post — a cover shot in the dark gets a dark one, one shot against a white wall gets a pale one.
- **No orphan on the last row.** A grid of counts takes the column count that avoids leaving one cell alone: five figures read as three and two, never four and one.
- **Record panel** — a detached panel showing one thing in full is a stack of bands ruled apart by hairlines, 20px padded, one band per question: what it is, what it looks like, what it earned, what it says, what it is made of. Whitespace alone turns a record into a document — a long run of prose with small caps sprinkled through it. Media gets a band of Quiet Surface and the panel's full width, because a Reel cover squeezed beside four figures is too small to recognise and too big to ignore, and a set of counts gets the number of columns it can actually fill: two figures on a four-track grid read as two missing columns rather than as two numbers.
- **Stat tile** — the same shell at 18px padding, with a fixed three-part rhythm: label plus icon plate, then the Figure, then the counterweight caption. The icon plate is a 32px Quiet Surface square at 11px radius holding a 16px Lucide glyph at 1.75 stroke.
- **Anchor tile** — one per stat row. A 150-degree gradient from Deep Teal to Teal Ink, transparent border, white text throughout, a white-at-25% icon plate, and Teal Lift Large beneath. It is the composition's centre of gravity and the only gradient in the system.

### Inputs / Fields
- **Style:** A recessed Quiet Surface block at 11px radius, 10px/14px padding, with a 16px leading Lucide glyph and a transparent-background input. Placeholder in Muted Text.
- **Focus:** `focus-within` raises a 2px ring in `{colors.ring}` at 50% opacity, transitioned as shadow only — the field does not change size or fill.
- **Global focus:** Anything focused by keyboard gets a 2px solid `{colors.ring}` outline with 2px offset and an 8px radius, applied once at the base layer.

### Navigation
- **Sidebar:** White rail on the cool ground, hairline right edge, in three zones closed by hairlines — the brand block, the navigation, and the footer. The rail is taller than the list of places it holds, and the rules are what make the leftover space read as room to spare rather than as something missing. Groups sit under quiet sentence-case headings (0.75rem, 600, Muted Text) in a 20px row that hugs the list beneath it; items are 36px tall at 500 weight with a 1.75-stroke Lucide icon, stacked 2px apart. A heading is a name, not a banner: uppercase with wide tracking made every group announce itself as loudly as the items under it.
- **The Teal Means Here Rule.** Inside the rail, Teal Tint says one thing: this is the page you are on. Hover and press take Quiet Surface, the brand block and the account row included — a rail where the row under the pointer looks like the row you are standing on cannot answer the only question it exists to answer. The current item is also the heaviest line in the rail at 700, never lighter than its neighbours.
- **A section owns what is beneath it.** An item stays lit for its own path and everything under it, so one lead, the second Performa page, or any Pengaturan tab keeps its row marked. The separator is always required — `/leads` owns `/leads/12`, never a future `/leads-import`. An item that links to one page but stands for a whole section names that section explicitly.
- **A count is a size, not an alarm.** Every figure in the rail says how much of something there is, and none of them is asking to be answered, so they are plain tabular numerals on a shared right edge rather than filled pills. The current row's count takes that row's ink, so it is never louder than the row it belongs to. A pill is reserved for a figure that genuinely demands action, and the rail has none.
- **States:** Active items take Teal Tint with Teal Ink text at 700 — the heaviest line in the rail. Collapsed to icons, counts hide and the item label becomes a tooltip.
- **The rail ends at the account.** Nothing sits between the last group and the person signed in. A promotion parked at the foot of a navigation rail is the loudest thing on a surface whose whole job is to be quiet, and it was answering a question nobody had opened the sidebar to ask.

### Measured Strips
A list of things that can be compared is a run of strips, not a table. Each strip keeps its own picture, its own words, and its own counts together, and the one figure that compares fairly across them is drawn as a length on the Pipeline Row's meter — Quiet Surface track, Deep Teal fill, scaled to the strongest item in view with a floor so a small value never draws as none. A table is right only when every column is populated for every row; where one kind of row has a figure another cannot have, the table's promise fails and its empty cells fill with em-dashes. The length also gives the list a shape: a few long bars over a long tail of short ones is a finding no column of digits delivers at a glance.

**The Bar Says What The Sort Says.** Where a list can be reordered, the meter measures whatever it is ordered by, and a line above the list names that in words. Sorting is otherwise an invisible act — the rows move and nothing says why — and tying the two together makes the sort control the axis of the whole page.

### The Window
- **One control, one sentence.** How far back or forward a page is looking lives behind a single button that always reads the window it is standing in — "Bulan ini", "30 hari terakhir", or the two dates of a custom range. Presets answer it nine times out of ten; the tenth is a range nobody could have listed in advance, and both live behind the same button rather than filling the toolbar with chips.
- **The custom range takes the whole panel.** It replaces the preset list rather than unfolding under it: a calendar squeezed beneath a list is a calendar nobody can read, and while two dates are being picked the presets are not the question.
- **A view gets the window it can draw.** The content calendar has no period at all — a calendar *is* a month, so it steps months. The board takes any stretch. One window control is on screen at a time and the view decides which; two would be two answers to the same question.
- **A window says what it actually covered.** Asking for a year of Instagram figures when the store only reaches back two months would report a year the page never saw, so it names the real span underneath and says where the data starts. Presets shorten the question, never the honesty.

### The Board
- **Two boards, one grammar.** The leads pipeline and the content month are the same object: columns of Quiet Surface at 12px radius, a quiet header that names and counts the column, cards on Panel White with Lift, and a card in the hand that tilts 2.5 degrees and leaves a dashed hole behind it. Learning one teaches the other; a third board must not invent a fourth vocabulary.
- **The content board is grouped, not fixed.** Its columns come from whichever field is being asked about — status, channel, pillar, type, or who submitted it — so the same month reads as a production flow, a spread across platforms, or an editorial mix. Every column the vocabulary defines is drawn, empty or not: a month with no Testimonial is a fact about the month, and a column that only appears once something lands in it can never be dropped into.
- **A card never repeats its own column.** Grouped by channel the channel marks come off the card; grouped by status the status dot does. The room goes to what the column cannot already tell you.
- **What a drop is allowed to mean.** A drop writes exactly one field, so a field a piece can hold several of at once takes no cards — channel columns are read-only, because moving a piece into one says nothing about the others. Going live is not a drop either: publishing records a date and a link, and both belong with the piece, so the board refuses it and points there.

### Signature Component: The Pipeline Row
The system's memorable moment and the pattern new data rows should imitate. One row per stage: a fixed-width stage label, a fully-rounded Quiet Surface track whose teal fill is scaled to the *widest* stage (with a 3% floor so a near-empty stage still registers), a red segment nested inside that fill showing the stalled share, then a tabular count and a stalled read-out. Size and trouble are legible in one glance, in one bar. The whole row is a prefetching link into the filtered lead list, and hovering tints the row with Quiet Surface. Below `sm` the stalled column collapses to a bare number with an em-dash for "none", and a persistent uppercase header row keeps that number from reading as an unexplained red figure.

### Motion
One authored moment, and it is an entrance, not an effect: `settle-in` runs 520ms on `cubic-bezier(0.16, 1, 0.3, 1)` from 55% opacity and a 6px offset — already visible at frame one — on the dashboard body and each module placeholder. Everything else is state feedback measured in 150-200ms color transitions: chart bars brightening on hover, the value tooltip fading in, nav and row hover tints, button fills. The one other authored moment is `pick-up`: 160ms on the same curve, rotating a dragged card from flat to 2.5 degrees as it leaves the column, because a page never tilts and a hand does. `prefers-reduced-motion: reduce` removes both animations outright — a card picked up under that setting is still tilted and shadowed, it simply does not animate into it.

### Browser Surfaces
The parts the design did not draw still carry the design. Selection is Deep Teal at 22% with foreground text; the caret is Deep Teal; `accent-color` is Deep Teal; `color-scheme` is declared per theme; scrollbars are themed through both APIs (Firefox's `scrollbar-color` / `scrollbar-width` and the WebKit pseudo-elements — an 11px track with a foreground-at-16% inset thumb that deepens to 28% on hover); link underlines sit 3px off the baseline; and numerals in tables go tabular.

**The Nothing-Ships-Default Rule.** Selection, caret, focus ring, both scrollbar APIs, `accent-color`, `color-scheme`, underline offset, and tabular figures are all set from the palette in the base layer. A new surface inherits them; it never re-specifies them locally, and it never leaves one at the browser default.

## Do's and Don'ts

### Do:
- **Do** put text on Deep Teal (#0b7a6c) or Teal Ink (#06564c) only. Bright Teal (#12a594) is 3.07:1 on white and fills data marks or hover states, nothing else.
- **Do** give every figure its counterweight in the same breath — value against target, assigned against capacity, count against stalled.
- **Do** mark tabular numbers with `[data-numeric]` (or put them in a `table`) so they never reflow as they update.
- **Do** wrap any content wider than its column in its own `overflow-x-auto` container with a min-width floor, and keep `min-w-0` on the flex rows around it.
- **Do** tint shadows from the surface they fall from, with both an offset and a blur; re-derive the tint whenever the fill color changes.
- **Do** separate with one 1px Hairline or with space — those are the only two options.
- **Do** carry hierarchy with weight (400 / 500 / 700 / 800) and negative tracking before reaching for a larger size.
- **Do** label sample data on screen wherever it appears until real data is connected.

### Don't:
- **Don't** turn a whole element red to signal trouble. Red is a segment, a badge, or a word inside an otherwise normal component — the shape of the thing must still show its size.
- **Don't** use red for anything but a breach: not for negative deltas, not for delete affordances styled as alarms, not as an accent.
- **Don't** ship a bare stat: a big number with a small label and nothing to measure it against is the template this world was built to refuse.
- **Don't** float white cards on a gray page. The ground is cool-neutral, surfaces are white, and the shadow is one or two pixels — not a drop-shadow grid.
- **Don't** add a second gradient. The anchor tile is the only one; a second destroys the single centre of gravity.
- **Don't** put a kicker or eyebrow above a heading. Uppercase micro-type is for column heads, group labels, and state badges only.
- **Don't** exceed 1px on any border, and never add a colored left or right edge to a card, row, or callout.
- **Don't** introduce a monospace face for a "technical" feeling; tabular Manrope already handles every number in the product.
- **Don't** substitute a Unicode glyph or emoji for an icon. Icons are Lucide at 1.75 stroke, 16px in dense rows and 20-24px on plates.
- **Don't** re-theme selection, caret, focus ring, or scrollbars per component; they are set once in the base layer.
