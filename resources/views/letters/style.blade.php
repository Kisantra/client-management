{{--
  | The paper. Shared by the on-screen preview and the PDF, so it is plain
  | CSS on plain class names: dompdf reads it too, and dompdf knows nothing
  | of flexbox, grid or custom properties. Rendered without a <style> tag,
  | because each reader wraps it in its own.
  |
  | Arial 11pt, as the office's Word template is set. On screen the page is
  | an A4 box with the letterhead as its background; in the PDF the page is
  | the paper itself and the letterhead is drawn behind it per page.
--}}
@php
    $letterhead = config('letter.letterhead.image');
    $letterheadUrl = $letterhead ? '/'.ltrim($letterhead, '/') : null;
    $m = config('letter.letterhead.margins');
@endphp
.ltr-doc { font-family: Arial, 'Liberation Sans', Helvetica, sans-serif; font-size: 11pt; line-height: 1.15; color: #111111; }

.ltr-page {
    position: relative;
    width: 210mm; min-height: 297mm;
    box-sizing: border-box;
    padding: {{ $m['top'] }} {{ $m['right'] }} {{ $m['bottom'] }} {{ $m['left'] }};
    background-color: #ffffff;
    {!! $letterheadUrl ? "background-image: url('{$letterheadUrl}'); background-repeat: no-repeat; background-position: center top; background-size: 210mm 297mm;" : '' !!}
}
.ltr-doc--pdf .ltr-page { width: auto; min-height: 0; padding: 0; background: none; }
.ltr-page + .ltr-page { margin-top: 16px; }
.ltr-doc--pdf .ltr-page + .ltr-page { margin-top: 0; page-break-before: always; }

.ltr-dateline { margin: 0 0 6px; text-align: right; }
.ltr-meta { border-collapse: collapse; margin: 0 0 8px; }
.ltr-meta td { padding: 0 0 1px; vertical-align: top; }
.ltr-meta-k { width: 18mm; }
.ltr-meta-c { width: 4mm; }

.ltr-addr { margin: 0 0 8px; }
.ltr-addr-name { font-weight: 700; }

.ltr-body p { margin: 0 0 5px; text-align: justify; }
.ltr-body ol { list-style: decimal; margin: 0 0 5px 22px; padding: 0; }
.ltr-body ul { list-style: disc; margin: 0 0 5px 22px; padding: 0; }
.ltr-body li { margin: 0 0 1px; text-align: justify; }
.ltr-blank { color: #9ca3af; font-style: italic; }
.ltr-missing { color: #b91c1c; background: #fee2e2; padding: 0 3px; border-radius: 2px; font-size: 9pt; }

.ltr-section { margin: 0 0 6px 6mm; }
.ltr-section-title { font-weight: 700; margin: 0 0 4px; text-align: left; }
.ltr-items { border-collapse: collapse; width: 100%; margin: 0 0 2px; }
.ltr-items th, .ltr-items td { border: 1px solid #111111; padding: 1px 8px; vertical-align: top; }
.ltr-items th { font-weight: 700; text-align: center; }
.ltr-items td { text-align: left; }
.ltr-col-no { width: 10mm; text-align: center !important; white-space: nowrap; }
.ltr-col-amount { width: 34mm; text-align: right !important; white-space: nowrap; }
.ltr-total { margin: 4px 0 6px; text-align: left !important; }

.ltr-sign { border-collapse: collapse; width: 100%; margin-top: 4px; page-break-inside: avoid; }
.ltr-sign td { vertical-align: top; padding: 0 8mm 0 0; }
.ltr-sign-salute { margin: 0; }
.ltr-sign-for { font-weight: 700; margin: 0 0 2px; }
.ltr-sign-space { height: 12mm; }
.ltr-sign-img { height: 12mm; width: auto; max-width: 60mm; display: block; }
.ltr-sign-name { font-weight: 700; text-decoration: underline; margin: 0; }
.ltr-sign-role { margin: 0; }

.ltr-attach-title { font-weight: 700; text-decoration: underline; margin: 0 0 6px; }
.ltr-attach { border-collapse: collapse; width: 100%; margin: 4px 0 0; font-size: 10pt; }
.ltr-attach th, .ltr-attach td { border: 1px solid #111111; padding: 3px 8px; vertical-align: top; text-align: left; }
.ltr-attach th { font-weight: 700; text-align: center; }
.ltr-attach tr { page-break-inside: avoid; }
.ltr-col-doc { width: 55mm; }
