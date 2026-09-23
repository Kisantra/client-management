<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>{{ $letter->number ?? 'Draft' }} - {{ $letter->subject }}</title>
    <style>{!! $styles !!}</style>
    <style>
        /* The content is inset by the page margins; the letterhead is drawn
           full-bleed behind every page, which dompdf does for fixed boxes. */
        @page { margin: {{ $margins['top'] }} {{ $margins['right'] }} {{ $margins['bottom'] }} {{ $margins['left'] }}; }
        body { margin: 0; }
        .ltr-letterhead {
            position: fixed;
            top: -{{ $margins['top'] }}; left: -{{ $margins['left'] }};
            width: 210mm; height: 297mm;
            z-index: -1;
        }
    </style>
</head>
<body>
    @if ($letterhead)
        <img class="ltr-letterhead" src="{{ $letterhead }}" alt="">
    @endif
    {!! $document !!}
</body>
</html>
