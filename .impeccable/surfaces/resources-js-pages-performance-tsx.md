---
version: 1
slug: "resources-js-pages-performance-tsx"
primary_target: "resources/js/pages/performance.tsx"
related_targets: ["resources/js/pages/performance-content.tsx","resources/js/components/performance","app/Http/Controllers/PerformanceController.php","app/Support/ApifyInstagram.php"]
---

## Scope

The Performa module at `/performance` (statistics) and `/performance/konten` (the full content list), plus the Apify ingest behind both. Visitor mode: **Operate** — the team is evaluating its own work, not being sold to.

## Audience and job

The firm's own marketing team, looking at the accounts they run: `@kisantra.official` on Instagram and on TikTok. Two questions, one per page, and a platform switch in the header that carries the window and the view across.

- **Statistik:** how is the account doing, and is what we publish working at all?
- **Konten:** what exactly did we publish, and how did each piece land?

The split exists because those are different sittings. The first is a five-minute read before a meeting; the second is scrolling, filtering and opening one post to look at it properly.

## What the surface must answer

- How many followers there are, and whether that moved since the last reading.
- What a **typical** post earns — not what the average one earns.
- Whether Reels, Carousels or Photos do better, with the count each average came from.
- Which pieces performed best, and what exactly each piece was.
- When the numbers on screen were read, since none of them are live.

## Chosen direction

Preserved: this is "Lembut" as the rest of the app already is. Nothing new was invented for it — the same anchor tile, panel, hairline table, format chips, and sheet vocabulary the Leads and Konten modules use, so a team that knows one screen knows these.

## Rules this surface holds

- **The typical post, not the average one.** One giveaway carried 70% of every interaction this account earned in two months. A mean over that describes a post nobody published, so every headline figure is a **median**, and the mean travels beside it — the gap between them is the finding, not noise to hide.
- **A scale that cuts says so.** The interaction chart is scaled to the ninetieth percentile, because against one viral post the other fifty-nine flatten into stubs. Bars past the ceiling are drawn full height with a cut across the top, the footer counts them, and the outlier is named in words underneath.
- **Nothing here is live.** Every figure comes from the last refresh and says how long ago that was. The scrapers are paid per run, so refreshing is always something a person asked for.
- **The window says what it actually covered.** Both pages can be scoped — 30 days, 90 days, 6 months, this year, all, or a custom range — and the window travels with you between them. But the store only reaches back as far as the last scrape did, so a window that runs past the data says so in words: "Yang tersimpan hanya sampai 7 Juli 2026." A page scoped to a year while the oldest post kept is two months old would otherwise report a year it never saw.
- **A video is kept when somebody asks to watch it.** Both platforms serve files from signed URLs that stop working within days, so a post whose only video is a link will not play next month. The frame in the panel is the control: pressing it copies the file to this app's storage and plays it from there, once, forever. Not during the scrape — sixty videos is half a gigabyte and ten minutes of wall time, the refresh already runs inside a request the team is standing in front of, and asking to watch is the only moment anyone has said this particular video is worth the disk.
- **A kept video opens into a theatre.** 230 pixels is enough to recognise a post and nowhere near enough to watch one, so the inline frame expands to the height of the window, resuming where the small player had got to, with real fullscreen a button away.
- **Instagram's pictures are copied, not linked.** Their URLs are signed and expire within days; a stored link would be a broken frame by the time anyone looked back.
- **The content list is a run of measured strips, never a table.** A table promises every column is populated and comparable, and neither held here: only Reels carry plays, so two of seven columns were a run of em-dashes and noughts, and a Reel's 2.555 plays was never on one axis with a photo's 5 likes. Each piece now keeps its own counts, and the one thing that does compare is drawn as a length — the Pipeline Row's meter, scaled to the strongest post on the page.
- **The bar measures what the list is ordered by.** Sorting is otherwise invisible: the rows move and nothing says why. Order by plays and the bars become plays; order by date, which has no magnitude, and they fall back to the engagement rate. The legend above the list names it in words, and filtering to one format rescales the bars to that set.
- **Two platforms, one page.** Each account is stored in its own tables, because they are counted in different currencies: Instagram reports plays, reach and carousel slides; TikTok reports shares, saves and the track a video used. They meet at the point the controller answers, not the point the scraper writes — one `SocialPlatform` subclass names everything that differs, and the statistics behind it are written for neither.
- **A rate is divided by what the platform actually reaches.** Instagram shows a post to its followers, so followers are the denominator. TikTok shows it to whoever the For You page decides: this account has 1.644 followers and one video with 296.700 plays, and dividing its 17.913 interactions by the followers reported **1.089%** — arithmetically true and useless. Against the typical video's plays it reads 6%, which is what the rest of the world means by engagement rate on TikTok. The panel names the denominator in words so the figure above it can be read.
- **The fourth tile is the platform's own figure.** Instagram's is Reel plays. TikTok's is saves, not plays: plays are the biggest number on that page and the one TikTok hands out most freely, while a save is the viewer deciding to come back — which for tax advice is the strongest thing they can do short of asking.
- **Everything scraped is kept.** The columns are what the screens read today; the whole payload is stored beside them so a question asked next month does not cost another paid run.

## Memorable moment

The sentence under the chart that names the outlier: "Satu konten menguasai 70% dari seluruh interaksi." The spike stops being a rendering problem and becomes the most useful thing on the page.

## Unresolved

- Drawing the sorts as lengths is what exposed that they had never worked: the posts relation orders by date, and `sortedPosts` added its order after that one, so every sort but the two by date was a no-op that a column of digits hid for months. Fixed with `reorder()`, and the regression test now dates its posts against the answer.
- The window is applied to posts and to the follower line, but the account header still shows followers as of now rather than as of the window's end. Right for "how many do we have", wrong-looking beside a window that ended in June.
- No link yet between an Instagram post and the piece planned for it in the Konten module. Closing that would complete the content → lead → client chain for this channel.
- Only Instagram. TikTok, LinkedIn and Web/SEO are in PRODUCT.md's scope and have no ingest.
- Seeking a video needs a server that answers Range requests. Apache does; `php artisan serve` returns the whole file and ignores the header, so scrubbing does not work under it. Nothing to fix in the app, but it makes the dev server a poor place to judge the player.
- TikTok's video links only exist on runs made after `shouldDownloadVideos` was turned on, so the sixty videos already stored need one more refresh before any of them can be kept.
- The refresh runs inside the request (~2 minutes for 60 posts). Fine behind `artisan serve`; behind PHP-FPM it needs a raised timeout or a queued job.
- Follower growth needs a second day before the line means anything; it builds one reading at a time.
