<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}" @class(['dark' => ($appearance ?? 'system') == 'dark'])>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        {{-- Inline script to detect system dark mode preference and apply it immediately --}}
        <script>
            (function() {
                const appearance = '{{ $appearance ?? "system" }}';

                if (appearance === 'system') {
                    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

                    if (prefersDark) {
                        document.documentElement.classList.add('dark');
                    }
                }
            })();
        </script>

        {{-- Inline style to set the HTML background color based on our theme in app.css --}}
        <style>
            html {
                background-color: #f7f9f8;
            }

            html.dark {
                background-color: #0c1513;
            }
        </style>

        {{-- No SVG icon offered: the mark has no vector master yet, and a
             browser given both prefers the SVG over the .ico. --}}
        <link rel="icon" href="/favicon.ico" sizes="any">
        <link rel="apple-touch-icon" href="/apple-touch-icon.png">

        @fonts

        @viteReactRefresh
        @vite(['resources/css/app.css', 'resources/js/app.tsx', "resources/js/pages/{$page['component']}.tsx"])
        <x-inertia::head>
            <title>{{ config('app.name', 'Laravel') }}</title>
        </x-inertia::head>
    </head>
    <body class="font-sans antialiased">
        <!--
        THESIS: An internal workspace for an in-house marketing team that keeps the
        chain content -> lead -> active client in one place; it refuses the floating
        card grid on gray where every figure is an island with no counterweight.
        OWN-WORLD: Cool-neutral ground (#f7f9f8, as picked by sight), white surfaces,
        hairline borders, generous 14px radii, soft offset shadows. Deep teal carries
        every text-bearing fill and passes 4.5:1; the bright teal is reserved for data
        fills that never carry text; brick red is reserved for lateness alone.
        Manrope throughout, tabular figures in every data column.
        STORY: The team opens this at 9am, sees what they owe today and what is
        already late, then reads which channel is actually producing leads.
        FIRST VIEWPORT: Sidebar left with counts. Greeting and date top-left, primary
        action top-right. Four stat tiles, the lead tile anchored in teal. Below,
        twelve-month bar chart plus pipeline on the left, today's tasks on the right.
        FORM: Candidate 1 of a four-design comparison the user chose by sight;
        seed key 6dfb849f.
        FINISH: unreviewed and undocumented is unfinished; this build ends with the
        finish review, the verdict, DESIGN.md, and every shipping raster carrying its
        provenance.
        -->
        <x-inertia::app />
    </body>
</html>
