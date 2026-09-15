{{--
  | Laporan Kuartalan, as a printed document, in two parts.
  |
  | Part I is the pipeline, Part II is the accounts. They are bound together on
  | purpose: reach is a means, and a quarter of good numbers on the accounts
  | should never be presentable without the quarter of business underneath it.
  | Each part opens on a divider carrying its own contents and its own headline
  | figures, so the document can be read whole or opened at the half somebody
  | actually came for.
  |
  | Written for dompdf, which is a 2004 browser: no flexbox, no grid, no gap.
  | Everything below is tables and percentages on purpose, because that is the
  | only layout language this renderer speaks fluently. Fighting it produces
  | pages that look right in Chrome and collapse in the PDF nobody checked.
  |
  | The charts are HTML too — a track and a fill, sized by percentage. A chart
  | drawn in divs is not a compromise here: it prints at whatever DPI the page
  | is rendered at, where a rasterised one would arrive soft, and it cannot
  | disagree with the number printed beside it because it is that number.
--}}
@php
    /** Indonesian figures: 12.345,6 */
    $n = fn ($value, int $decimals = 0) => $value === null
        ? '–'
        : number_format((float) $value, $decimals, ',', '.');

    /** Rupiah as the app writes it everywhere else: Rp 1,2 m · Rp 450 jt. */
    $rp = function ($value) {
        if (! $value) {
            return 'Rp 0';
        }

        return $value >= 1_000_000_000
            ? 'Rp '.number_format($value / 1_000_000_000, 1, ',', '.').' m'
            : 'Rp '.number_format(round($value / 1_000_000), 0, ',', '.').' jt';
    };

    /** A bar's width, floored so a non-zero value never renders as nothing. */
    $bar = fn ($value, $max) => $max > 0 ? max(1.2, ($value / $max) * 100) : 0;

    $tone = ['instagram' => '#0b7a6c', 'tiktok' => '#2f5c88'];
    $wash = ['instagram' => '#e8f6f3', 'tiktok' => '#edf3fb'];

    $leads = $report['leads'];
    $live = collect($report['platforms'])->filter(fn ($p) => $p['measured'] > 0);
    $monthMax = collect($report['months'])->max('interactions') ?: 1;
    $leadMax = collect($leads['months'])->max('arrived') ?: 1;
@endphp
    <!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="utf-8">
    <title>Laporan Kuartalan {{ $report['period']['label'] }} · Kisantra</title>
    <style>
        @page { margin: 22mm 16mm 20mm 16mm; }

        * { box-sizing: border-box; }

        body {
            margin: 0;
            font-family: 'Manrope', 'DejaVu Sans', sans-serif;
            font-size: 9.5pt;
            line-height: 1.55;
            color: #101a17;
        }

        /* Repeated on every page by dompdf, which renders fixed boxes per page. */
        .running-head {
            position: fixed;
            top: -14mm; left: 0; right: 0;
            font-size: 7.5pt;
            color: #64716d;
            border-bottom: 0.4pt solid #e6ecea;
            padding-bottom: 2mm;
        }
        .running-head .right { float: right; }

        .running-foot {
            position: fixed;
            bottom: -12mm; left: 0; right: 0;
            font-size: 7.5pt;
            color: #64716d;
            border-top: 0.4pt solid #e6ecea;
            padding-top: 2mm;
        }
        .running-foot .right { float: right; }
        .running-foot .page:after { content: counter(page); }

        h1, h2, h3 { margin: 0; font-weight: 800; letter-spacing: -0.01em; }
        h1 { font-size: 26pt; line-height: 1.15; }
        h2 { font-size: 14pt; line-height: 1.25; }
        h3 { font-size: 10.5pt; }
        p { margin: 0 0 2.6mm 0; }

        .muted { color: #64716d; }
        .tiny { font-size: 7.5pt; line-height: 1.45; }
        .small { font-size: 8.5pt; }
        .num { font-weight: 800; }
        .alarm { color: #c1381f; }

        /* A section always opens a page: the reader looks up "Corong konversi"
           in the contents and turns to it, rather than hunting mid-page. */
        .section { page-break-before: always; }
        .section-head { margin-bottom: 6mm; }
        .section-head .kicker {
            font-size: 7.5pt; font-weight: 800; letter-spacing: 0.14em;
            text-transform: uppercase; color: #0b7a6c; margin-bottom: 1.5mm;
        }
        .section-head .lede { font-size: 9pt; color: #33413d; max-width: 128mm; margin-top: 2mm; }

        /*
         | The divider that opens a part. The numeral is the whole design: at
         | this size it is a landmark you can find by riffling the paper, which
         | is the one navigation a printed document actually has.
         */
        .divider { page-break-before: always; padding-top: 8mm; }
        .divider .numeral {
            font-size: 64pt; font-weight: 800; line-height: 0.9;
            color: #b7e2da; letter-spacing: -0.04em;
        }
        .divider .part {
            font-size: 7.5pt; font-weight: 800; letter-spacing: 0.18em;
            text-transform: uppercase; color: #0b7a6c;
        }
        .divider h2 { font-size: 21pt; margin-top: 2mm; }
        .divider .lede { font-size: 10pt; color: #33413d; max-width: 126mm; margin-top: 3mm; }

        .block { margin-bottom: 7mm; }
        /* Held whole: a callout split across a fold loses its point, and a
           chart whose bars are on two pages is not a chart. Long tables are
           deliberately not in this list — a table may break, and forcing one
           onto the next page leaves half a page of nothing behind it. */
        .keep { page-break-inside: avoid; }

        table { width: 100%; border-collapse: collapse; }
        td, th { vertical-align: top; }

        .data th {
            text-align: left; font-size: 7.5pt; font-weight: 800;
            letter-spacing: 0.08em; text-transform: uppercase; color: #64716d;
            border-bottom: 0.8pt solid #dde5e3; padding: 0 2mm 1.6mm 0;
        }
        .data td { padding: 2mm 2mm 2mm 0; border-bottom: 0.4pt solid #eef2f1; font-size: 9pt; }
        .data td:last-child, .data th:last-child { padding-right: 0; }
        .data .r { text-align: right; }
        .data tr.total td { border-bottom: none; border-top: 0.8pt solid #dde5e3; font-weight: 800; }

        /* Figure tiles. Table cells, because four divs in a row is a flexbox
           and there is no flexbox here. */
        .tiles td {
            width: 25%; padding: 3.5mm 3mm; border: 0.5pt solid #e6ecea;
            border-radius: 2.5mm; background: #ffffff;
        }
        .tiles .spacer { width: 2.5mm; padding: 0; border: none; background: none; }
        .tiles .label {
            font-size: 7.5pt; font-weight: 800; letter-spacing: 0.06em;
            text-transform: uppercase; color: #64716d;
        }
        .tiles .value { font-size: 17pt; font-weight: 800; line-height: 1.1; margin-top: 1.5mm; }
        .tiles .note { font-size: 7.5pt; color: #64716d; margin-top: 1mm; }
        .tiles.tinted td { background: #f7f9f8; border-color: #dde5e3; }

        /* The chart: a track, and a fill sized by percentage. */
        .chart td { padding: 1.4mm 0; font-size: 8.5pt; }
        .chart .axis { width: 30mm; padding-right: 3mm; color: #33413d; }
        .chart .track { background: #f1f5f4; border-radius: 1mm; height: 4.6mm; }
        .chart .fill { height: 4.6mm; border-radius: 1mm; }
        .chart .figure { width: 30mm; text-align: right; padding-left: 3mm; font-weight: 800; }
        .chart .sub { font-weight: 400; color: #64716d; }

        .legend { font-size: 8pt; color: #33413d; margin-bottom: 3mm; }
        .swatch {
            display: inline-block; width: 2.6mm; height: 2.6mm;
            border-radius: 0.7mm; margin-right: 1.4mm;
        }

        .callout {
            border: 0.5pt solid #e6ecea; border-radius: 2.5mm;
            padding: 4mm 4.5mm; background: #f7f9f8;
        }
        .callout.warn { border-color: #f7cdc4; background: #fdece9; }
        .callout.teal { border-color: #b7e2da; background: #e8f6f3; }
        .callout h3 { margin-bottom: 1.5mm; }

        .pill {
            display: inline-block; padding: 0.6mm 2mm; border-radius: 6mm;
            font-size: 7.5pt; font-weight: 800;
        }

        .finding { padding: 0 0 3.5mm 0; }
        .finding .n { font-size: 8pt; font-weight: 800; color: #0b7a6c; }
        .finding h3 { margin: 0.6mm 0 1mm 0; }

        .rule { border: none; border-top: 0.5pt solid #e6ecea; margin: 5mm 0; }
    </style>
</head>
<body>

<div class="running-head">
    Laporan Kuartalan · Kisantra
    <span class="right">{{ $report['period']['label'] }}</span>
</div>

<div class="running-foot">
    Dihasilkan {{ $report['period']['generatedAt'] }} · angka dihitung dari basis data, bukan estimasi
    <span class="right">Halaman <span class="page"></span></span>
</div>

{{-- ═════════════════════════════  Sampul  ═════════════════════════════ --}}

<div style="padding-top: 4mm;">
    <div class="tiny" style="font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; color: #0b7a6c;">
        Kisantra · Tim Digital Marketing
    </div>

    <h1 style="margin-top: 3mm;">Laporan Kuartalan<br>Leads &amp; Media Sosial</h1>

    <p style="font-size: 12pt; color: #33413d; margin-top: 3mm;">
        {{ $report['period']['label'] }}
        <span class="muted">· {{ $report['period']['months'] }} bulan</span>
    </p>

    @if ($report['period']['open'])
        <div class="callout warn keep" style="margin-top: 5mm;">
            <h3 class="alarm">{{ $report['period']['lastMonth'] }} belum selesai</h3>
            <p class="small" style="margin: 0;">
                Laporan diambil pada hari ke-{{ $report['period']['elapsed']['days'] }}
                dari {{ $report['period']['elapsed']['of'] }} hari
                {{ $report['period']['lastMonth'] }}. Kolom terakhir di setiap grafik
                adalah bulan berjalan, bukan bulan yang jatuh — jangan dibaca sebagai penurunan.
            </p>
        </div>
    @endif

    <hr class="rule">

    {{-- The two halves, each carrying the one number that names it. --}}
    <table class="keep">
        <tr>
            <td style="width: 48%; padding: 4.5mm 4mm; border: 0.5pt solid #b7e2da; border-radius: 2.5mm; background: #e8f6f3;">
                <div style="font-size: 7.5pt; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #06564c;">
                    Bagian I
                </div>
                <div style="font-size: 13pt; font-weight: 800; margin-top: 1mm;">Leads &amp; Pipeline</div>
                <div style="font-size: 20pt; font-weight: 800; margin-top: 2.5mm;">
                    {{ $n($leads['summary']['arrived']) }}
                    <span style="font-size: 9pt; font-weight: 400; color: #06564c;">lead masuk</span>
                </div>
                <div class="tiny" style="color: #06564c; margin-top: 1mm;">
                    {{ $n($leads['summary']['wonInWindow']) }} jadi client ·
                    {{ $rp($leads['summary']['wonValue']) }} nilai
                </div>
            </td>
            <td style="width: 4%;"></td>
            <td style="width: 48%; padding: 4.5mm 4mm; border: 0.5pt solid #e6ecea; border-radius: 2.5mm; background: #f7f9f8;">
                <div style="font-size: 7.5pt; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; color: #0b7a6c;">
                    Bagian II
                </div>
                <div style="font-size: 13pt; font-weight: 800; margin-top: 1mm;">Performa Media Sosial</div>
                <div style="font-size: 20pt; font-weight: 800; margin-top: 2.5mm;">
                    {{ $n($report['combined']['posts']) }}
                    <span style="font-size: 9pt; font-weight: 400; color: #64716d;">post terukur</span>
                </div>
                <div class="tiny muted" style="margin-top: 1mm;">
                    {{ $n($report['combined']['interactions']) }} interaksi ·
                    {{ $n($report['combined']['plays']) }} pemutaran
                </div>
            </td>
        </tr>
    </table>

    <hr class="rule">

    <h3 style="margin-bottom: 2.5mm;">Isi laporan</h3>
    <table class="data small">
        @foreach ([
            ['Ringkasan eksekutif', 'Pembacaan atas kedua bagian: apa yang terjadi dan apa artinya.'],
            ['Bagian I · Leads &amp; Pipeline', 'Corong, sumber, kecepatan, penanggung jawab, dan yang berhenti.'],
            ['Bagian II · Performa Media Sosial', 'Dua akun, tren bulanan, bauran format, dan konten teratas.'],
            ['Temuan &amp; rekomendasi', 'Yang perlu diputuskan, dan langkah minggu depan.'],
            ['Catatan metode', 'Definisi tiap angka dan batas datanya.'],
        ] as $row)
            <tr>
                <td style="width: 62mm; font-weight: 800;">{!! $row[0] !!}</td>
                <td class="muted">{!! $row[1] !!}</td>
            </tr>
        @endforeach
    </table>
</div>

{{-- ══════════════════════  Ringkasan eksekutif  ═══════════════════════ --}}

<div class="section">
    <div class="section-head">
        <div class="kicker">Pembuka</div>
        <h2>Ringkasan eksekutif</h2>
        <p class="lede">
            Pembacaan atas angka di kedua bagian. Setiap angka yang dikutip di sini
            dihitung oleh aplikasi, bukan oleh penulis ringkasan.
        </p>
    </div>

    @if ($analysis)
        <div class="callout teal block keep">
            <p style="font-size: 10.5pt; line-height: 1.6; margin: 0;">{{ $analysis['ringkasan'] }}</p>
        </div>

        @if ($analysis['risiko'])
            <div class="callout warn block keep">
                <h3 class="alarm">Yang perlu diwaspadai</h3>
                <p style="margin: 0;">{{ $analysis['risiko'] }}</p>
            </div>
        @endif
    @else
        <div class="callout block keep">
            <h3>Ringkasan tidak tersedia</h3>
            <p class="small" style="margin: 0;">
                Pembacaan naratif dibuat oleh layanan analisis luar dan kali ini tidak
                bisa dihubungi. Seluruh angka di laporan ini tetap lengkap dan dihitung
                di dalam aplikasi — hanya kalimat penafsirnya yang absen.
            </p>
        </div>
    @endif

    <div class="block">
        <h3 style="margin-bottom: 2.5mm;">Angka pokok kedua bagian</h3>
        <table class="data">
            <tr>
                <th>Ukuran</th>
                <th class="r">Periode ini</th>
                <th>Catatan</th>
            </tr>
            <tr>
                <td>Lead masuk</td>
                <td class="r num">{{ $n($leads['summary']['arrived']) }}</td>
                <td class="muted small">nilai pipeline {{ $rp($leads['summary']['value']) }}</td>
            </tr>
            <tr>
                <td>Client baru</td>
                <td class="r num">{{ $n($leads['summary']['wonInWindow']) }}</td>
                <td class="muted small">senilai {{ $rp($leads['summary']['wonValue']) }}</td>
            </tr>
            <tr>
                <td>Lead berhenti</td>
                <td class="r num">{{ $n($leads['closed']['total']) }}</td>
                <td class="muted small">{{ $leads['closed']['share'] }}% dari yang masuk</td>
            </tr>
            <tr>
                <td>Lead mandek sekarang</td>
                <td class="r num {{ $leads['speed']['stalledNow'] > 0 ? 'alarm' : '' }}">{{ $n($leads['speed']['stalledNow']) }}</td>
                <td class="muted small">
                    @if ($leads['speed']['worstStage'])
                        terbanyak di {{ $leads['speed']['worstStage']['label'] }}
                        ({{ $leads['speed']['worstStage']['count'] }})
                    @endif
                </td>
            </tr>
            <tr>
                <td>Post terukur</td>
                <td class="r num">{{ $n($report['combined']['posts']) }}</td>
                <td class="muted small">{{ $live->count() }} akun</td>
            </tr>
            <tr>
                <td>Interaksi</td>
                <td class="r num">{{ $n($report['combined']['interactions']) }}</td>
                <td class="muted small">
                    {{ $n($report['combined']['likes']) }} suka ·
                    {{ $n($report['combined']['comments']) }} komentar
                </td>
            </tr>
            <tr class="total">
                <td>Konten tayang</td>
                <td class="r">{{ $n($report['business']['publishedContent']) }}</td>
                <td class="muted small">dari {{ $n($report['business']['plannedContent']) }} yang terjadwal</td>
            </tr>
        </table>
    </div>
</div>

{{-- ═══════════════════  BAGIAN I · Leads & Pipeline  ══════════════════ --}}

<div class="divider">
    <div class="numeral">I</div>
    <div class="part">Bagian Satu</div>
    <h2>Leads &amp; Pipeline</h2>
    <p class="lede">
        Siapa yang datang, sejauh mana mereka melangkah, dan berapa yang berakhir jadi
        client. Bagian ini membaca lead dari riwayat tahapannya — bukan dari posisi
        mereka hari ini — sehingga "jadi client bulan Agustus" berarti perpindahannya
        memang tercatat di Agustus.
    </p>

    <table class="tiles tinted keep" style="margin-top: 6mm;">
        <tr>
            <td>
                <div class="label">Lead masuk</div>
                <div class="value">{{ $n($leads['summary']['arrived']) }}</div>
                <div class="note">{{ $rp($leads['summary']['value']) }} nilai pipeline</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="label">Client baru</div>
                <div class="value">{{ $n($leads['summary']['wonInWindow']) }}</div>
                <div class="note">{{ $rp($leads['summary']['wonValue']) }}</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="label">Berhenti</div>
                <div class="value">{{ $n($leads['closed']['total']) }}</div>
                <div class="note">{{ $leads['closed']['share'] }}% dari yang masuk</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="label">Mandek sekarang</div>
                <div class="value">{{ $n($leads['speed']['stalledNow']) }}</div>
                <div class="note">lewat batas tahapannya</div>
            </td>
        </tr>
    </table>

    <hr class="rule">

    <table class="data small">
        @foreach ([
            ['I.1 Corong konversi', 'Sejauh mana lead periode ini melangkah, tahap demi tahap.'],
            ['I.2 Sumber lead', 'Dari mana mereka datang, dan dari mana client baru datang.'],
            ['I.3 Kecepatan &amp; kemandekan', 'Berapa lama tiap langkah, dan di mana antreannya menumpuk.'],
            ['I.4 Penanggung jawab', 'Siapa memegang berapa, dan siapa menutup berapa.'],
            ['I.5 Lead yang berhenti', 'Alasan berhenti dan tahap tempat mereka gugur.'],
            ['I.6 Bulan demi bulan', 'Lead masuk dan client baru per bulan.'],
        ] as $row)
            <tr>
                <td style="width: 58mm; font-weight: 800;">{!! $row[0] !!}</td>
                <td class="muted">{!! $row[1] !!}</td>
            </tr>
        @endforeach
    </table>
</div>

{{-- ── I.1 Corong ── --}}

<div class="section">
    <div class="section-head">
        <div class="kicker">Bagian I.1</div>
        <h2>Corong konversi</h2>
        <p class="lede">
            Dari {{ $n($leads['summary']['arrived']) }} lead yang masuk di
            {{ $report['period']['label'] }}, sejauh mana masing-masing melangkah.
            Ini satu rombongan yang diikuti — bukan potret siapa berdiri di mana hari ini,
            karena potret mencampur lead kuartal ini dengan lead tahun lalu.
        </p>
    </div>

    <div class="block keep">
        <table class="chart">
            @foreach ($leads['funnel'] as $stage)
                <tr>
                    <td class="axis">
                        {{ $stage['label'] }}
                        @if ($stage['kept'] !== null)
                            <span class="tiny muted">{{ $stage['kept'] }}% lanjut</span>
                        @endif
                    </td>
                    <td>
                        <div class="track">
                            <div class="fill" style="width: {{ $bar($stage['count'], $leads['summary']['arrived'] ?: 1) }}%; background: #0b7a6c;"></div>
                        </div>
                    </td>
                    <td class="figure">
                        {{ $n($stage['count']) }}
                        <span class="sub tiny">{{ $n($stage['share'], 1) }}%</span>
                    </td>
                </tr>
            @endforeach
        </table>
    </div>

    <div class="block">
        <table class="data">
            <tr>
                <th>Tahap</th>
                <th class="r">Pernah sampai</th>
                <th class="r">Porsi</th>
                <th class="r">Gugur di sini</th>
                <th class="r">Lanjut dari tahap sebelumnya</th>
            </tr>
            @foreach ($leads['funnel'] as $stage)
                <tr>
                    <td>{{ $stage['label'] }}</td>
                    <td class="r num">{{ $n($stage['count']) }}</td>
                    <td class="r">{{ $n($stage['share'], 1) }}%</td>
                    <td class="r {{ ($stage['dropped'] ?? 0) > 0 ? 'alarm' : '' }}">{{ $n($stage['dropped']) }}</td>
                    <td class="r">{{ $stage['kept'] === null ? '–' : $stage['kept'].'%' }}</td>
                </tr>
            @endforeach
        </table>
    </div>

    <div class="callout warn block keep">
        <h3 class="alarm">Rombongan ini belum matang</h3>
        <p class="small" style="margin: 0;">
            Lead yang baru masuk bulan lalu belum punya waktu untuk sampai ke Client,
            jadi angka di tahap-tahap akhir corong ini akan naik sendiri seiring waktu.
            Yang bisa dibaca sekarang adalah kebocoran di tahap awal — dan di sana
            {{ $n($leads['funnel'][1]['dropped'] ?? 0) }} lead gugur sebelum sempat dikontak.
            Jumlah client baru yang benar-benar ditutup di periode ini ada di ikhtisar:
            {{ $n($leads['summary']['wonInWindow']) }}.
        </p>
    </div>
</div>

{{-- ── I.2 Sumber ── --}}

<div class="section">
    <div class="section-head">
        <div class="kicker">Bagian I.2</div>
        <h2>Sumber lead</h2>
        <p class="lede">
            Dua populasi berbeda dalam satu tabel, sengaja tidak dibagi satu sama lain.
            "Lead masuk" adalah yang datang di periode ini; "client baru" adalah yang
            ditutup di periode ini, dan sebagian besar dari mereka datang jauh sebelumnya.
        </p>
    </div>

    <div class="block keep">
        @php $sourceMax = collect($leads['sources'])->max('leads') ?: 1; @endphp
        <h3 style="margin-bottom: 2.5mm;">Lead masuk per channel</h3>
        <table class="chart">
            @foreach ($leads['sources'] as $source)
                <tr>
                    <td class="axis">
                        {{ $source['label'] }}
                        <span class="tiny muted">{{ $source['share'] }}%</span>
                    </td>
                    <td>
                        <div class="track">
                            <div class="fill" style="width: {{ $bar($source['leads'], $sourceMax) }}%; background: #0b7a6c;"></div>
                        </div>
                    </td>
                    <td class="figure">{{ $n($source['leads']) }}</td>
                </tr>
            @endforeach
        </table>
    </div>

    <div class="block">
        <table class="data">
            <tr>
                <th>Channel</th>
                <th class="r">Lead masuk</th>
                <th class="r">Nilai pipeline</th>
                <th class="r">Client baru</th>
                <th class="r">Nilai client baru</th>
            </tr>
            @foreach ($leads['sources'] as $source)
                <tr>
                    <td>{{ $source['label'] }}</td>
                    <td class="r num">{{ $n($source['leads']) }}</td>
                    <td class="r">{{ $rp($source['value']) }}</td>
                    <td class="r num">{{ $n($source['clients']) }}</td>
                    <td class="r">{{ $rp($source['wonValue']) }}</td>
                </tr>
            @endforeach
            <tr class="total">
                <td>Total</td>
                <td class="r">{{ $n(collect($leads['sources'])->sum('leads')) }}</td>
                <td class="r">{{ $rp(collect($leads['sources'])->sum('value')) }}</td>
                <td class="r">{{ $n(collect($leads['sources'])->sum('clients')) }}</td>
                <td class="r">{{ $rp(collect($leads['sources'])->sum('wonValue')) }}</td>
            </tr>
        </table>
        <p class="tiny muted" style="margin-top: 2mm;">
            Channel di sini adalah channel yang tercatat di lead-nya, bukan hasil
            penelusuran otomatis. Ketepatannya bergantung pada siapa yang mengisi
            formulir lead dan seberapa teliti.
        </p>
    </div>
</div>

{{-- ── I.3 Kecepatan ── --}}

<div class="section">
    <div class="section-head">
        <div class="kicker">Bagian I.3</div>
        <h2>Kecepatan &amp; kemandekan</h2>
        <p class="lede">
            Berapa hari sebuah lead butuh untuk sampai ke tiap tahap, dan berapa yang
            berhenti bergerak sama sekali. Angka hari adalah nilai tengah: satu lead
            yang butuh delapan bulan akan menyeret rata-rata jauh dari kenyataan.
        </p>
    </div>

    <table class="tiles block keep">
        <tr>
            <td>
                <div class="label">Masuk → Kontak</div>
                <div class="value">{{ $n($leads['speed']['toContact'], 1) }}</div>
                <div class="note">hari, nilai tengah</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="label">Masuk → Proposal</div>
                <div class="value">{{ $n($leads['speed']['toProposal'], 1) }}</div>
                <div class="note">hari, nilai tengah</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="label">Masuk → Client</div>
                <div class="value">{{ $n($leads['speed']['toClient'], 1) }}</div>
                <div class="note">
                    @if ($leads['speed']['toClient'] === null)
                        belum ada yang sampai
                    @else
                        hari, nilai tengah
                    @endif
                </div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="label">Mandek sekarang</div>
                <div class="value">{{ $n($leads['speed']['stalledNow']) }}</div>
                <div class="note">seluruh pipeline, bukan periode ini</div>
            </td>
        </tr>
    </table>

    @if ($leads['speed']['worstStage'])
        <div class="callout warn block keep">
            <h3 class="alarm">Antrean menumpuk di {{ $leads['speed']['worstStage']['label'] }}</h3>
            <p class="small" style="margin: 0;">
                {{ $n($leads['speed']['worstStage']['count']) }} lead aktif sudah lewat
                batas {{ $leads['speed']['worstStage']['afterDays'] }} hari di tahap
                {{ $leads['speed']['worstStage']['label'] }} tanpa bergerak. Ini bukan
                angka periode ini — ini keadaan pipeline hari laporan dibuat, dan tiap
                hari yang lewat menambahnya.
            </p>
        </div>
    @endif

    <div class="block keep">
        <h3 style="margin-bottom: 2.5mm;">Janji hubungi</h3>
        <table class="data">
            <tr>
                <th>Ukuran</th>
                <th class="r">Jumlah</th>
                <th>Catatan</th>
            </tr>
            <tr>
                <td>Dijadwalkan di periode ini</td>
                <td class="r num">{{ $n($leads['followUps']['scheduled']) }}</td>
                <td class="muted small">follow-up dengan tanggal di rentang laporan</td>
            </tr>
            <tr>
                <td>Sudah dikerjakan</td>
                <td class="r num">{{ $n($leads['followUps']['done']) }}</td>
                <td class="muted small">
                    {{ $leads['followUps']['kept'] === null ? '–' : $leads['followUps']['kept'].'% ditepati' }}
                </td>
            </tr>
            <tr class="total">
                <td class="alarm">Jatuh tempo &amp; belum dikerjakan</td>
                <td class="r alarm">{{ $n($leads['followUps']['overdueNow']) }}</td>
                <td class="muted small">seluruh pipeline hari ini, termasuk di luar periode laporan</td>
            </tr>
        </table>
    </div>
</div>

{{-- ── I.4 Penanggung jawab ── --}}

<div class="section">
    <div class="section-head">
        <div class="kicker">Bagian I.4</div>
        <h2>Penanggung jawab</h2>
        <p class="lede">
            Siapa memegang berapa lead, dan berapa yang berhasil ditutup. Sama seperti
            tabel sumber: jumlah lead adalah yang masuk di periode ini, jumlah client
            adalah yang ditutup di periode ini — keduanya tidak dibagi satu sama lain.
        </p>
    </div>

    <div class="block keep">
        @php $ownerMax = collect($leads['owners'])->max('leads') ?: 1; @endphp
        <table class="chart">
            @foreach ($leads['owners'] as $owner)
                <tr>
                    <td class="axis">{{ $owner['name'] }}</td>
                    <td>
                        <div class="track">
                            <div class="fill" style="width: {{ $bar($owner['leads'], $ownerMax) }}%; background: #0b7a6c;"></div>
                        </div>
                    </td>
                    <td class="figure">
                        {{ $n($owner['leads']) }}
                        <span class="sub tiny">lead</span>
                    </td>
                </tr>
            @endforeach
        </table>
    </div>

    <div class="block">
        <table class="data">
            <tr>
                <th>Nama</th>
                <th class="r">Lead dipegang</th>
                <th class="r">Nilai pipeline</th>
                <th class="r">Berhenti</th>
                <th class="r">Client baru</th>
                <th class="r">Nilai ditutup</th>
            </tr>
            @foreach ($leads['owners'] as $owner)
                <tr>
                    <td>{{ $owner['name'] }}</td>
                    <td class="r num">{{ $n($owner['leads']) }}</td>
                    <td class="r">{{ $rp($owner['value']) }}</td>
                    <td class="r">{{ $n($owner['closed']) }}</td>
                    <td class="r num">{{ $n($owner['clients']) }}</td>
                    <td class="r">{{ $rp($owner['wonValue']) }}</td>
                </tr>
            @endforeach
        </table>
        <p class="tiny muted" style="margin-top: 2mm;">
            Tabel ini menggambarkan beban dan hasil, bukan penilaian kinerja: seseorang
            yang memegang lead paling banyak belum tentu memegang lead paling matang,
            dan lead yang ditutup bulan ini sering dikerjakan oleh beberapa orang.
        </p>
    </div>
</div>

{{-- ── I.5 Yang berhenti ── --}}

<div class="section">
    <div class="section-head">
        <div class="kicker">Bagian I.5</div>
        <h2>Lead yang berhenti</h2>
        <p class="lede">
            {{ $n($leads['closed']['total']) }} dari {{ $n($leads['summary']['arrived']) }}
            lead periode ini sudah ditutup — {{ $leads['closed']['share'] }}%, senilai
            {{ $rp($leads['closed']['lostValue']) }}. Sebuah lead yang ditutup tetap
            memegang tahap tempat ia gugur, karena "gugur di Proposal" dan "gugur di
            Kontak" adalah dua diagnosis yang berbeda.
        </p>
    </div>

    @if ($leads['closed']['reasons'])
        <div class="block keep">
            @php $reasonMax = collect($leads['closed']['reasons'])->max('count') ?: 1; @endphp
            <h3 style="margin-bottom: 2.5mm;">Alasan berhenti</h3>
            <table class="chart">
                @foreach ($leads['closed']['reasons'] as $reason)
                    <tr>
                        <td class="axis">{{ $reason['label'] }}</td>
                        <td>
                            <div class="track">
                                <div class="fill" style="width: {{ $bar($reason['count'], $reasonMax) }}%; background: #c1381f;"></div>
                            </div>
                        </td>
                        <td class="figure">
                            {{ $n($reason['count']) }}
                            <span class="sub tiny">{{ $reason['share'] }}%</span>
                        </td>
                    </tr>
                @endforeach
            </table>
        </div>
    @endif

    @if ($leads['closed']['worstStage'])
        <div class="callout block keep">
            <h3>Paling banyak gugur di {{ $leads['closed']['worstStage']['label'] }}</h3>
            <p class="small" style="margin: 0;">
                {{ $n($leads['closed']['worstStage']['count']) }} lead berhenti di tahap
                {{ $leads['closed']['worstStage']['label'] }}. Tahap tempat kebocoran
                terbesar terjadi menentukan perbaikannya: gugur di awal adalah soal
                kualitas lead atau kecepatan merespons, gugur di akhir adalah soal harga
                dan penawaran.
            </p>
        </div>
    @endif
</div>

{{-- ── I.6 Bulan demi bulan ── --}}

<div class="section">
    <div class="section-head">
        <div class="kicker">Bagian I.6</div>
        <h2>Bulan demi bulan</h2>
        <p class="lede">
            Lead yang masuk dan client yang ditutup tiap bulan. Keduanya jarang naik
            bersamaan di bulan yang sama — lead butuh waktu untuk matang, dan itulah
            sebabnya kedua angka ini tidak dibagi satu sama lain.
        </p>
    </div>

    <div class="block keep">
        <table class="chart">
            @foreach ($leads['months'] as $month)
                <tr>
                    <td class="axis">
                        {{ $month['label'] }} {{ $month['year'] }}
                        @if ($month['partial'])
                            <span class="tiny alarm">berjalan</span>
                        @endif
                    </td>
                    <td>
                        <div class="track">
                            <div class="fill" style="width: {{ $bar($month['arrived'], $leadMax) }}%; background: #0b7a6c;"></div>
                        </div>
                    </td>
                    <td class="figure">
                        {{ $n($month['arrived']) }}
                        <span class="sub tiny">lead</span>
                    </td>
                </tr>
            @endforeach
        </table>
    </div>

    <div class="block">
        <table class="data">
            <tr>
                <th>Bulan</th>
                <th class="r">Lead masuk</th>
                <th class="r">Nilai pipeline</th>
                <th class="r">Client baru</th>
            </tr>
            @foreach ($leads['months'] as $month)
                <tr>
                    <td>
                        {{ $month['label'] }} {{ $month['year'] }}
                        @if ($month['partial'])
                            <span class="tiny alarm">· berjalan</span>
                        @endif
                    </td>
                    <td class="r num">{{ $n($month['arrived']) }}</td>
                    <td class="r">{{ $rp($month['value']) }}</td>
                    <td class="r num">{{ $n($month['clients']) }}</td>
                </tr>
            @endforeach
            <tr class="total">
                <td>Total</td>
                <td class="r">{{ $n($leads['summary']['arrived']) }}</td>
                <td class="r">{{ $rp($leads['summary']['value']) }}</td>
                <td class="r">{{ $n($leads['summary']['wonInWindow']) }}</td>
            </tr>
        </table>
    </div>
</div>

{{-- ══════════════════  BAGIAN II · Performa Media Sosial  ═════════════ --}}

<div class="divider">
    <div class="numeral">II</div>
    <div class="part">Bagian Dua</div>
    <h2>Performa Media Sosial</h2>
    <p class="lede">
        Apa yang terbit di dua akun, berapa yang menonton, dan apa yang mereka lakukan
        sesudahnya. Instagram dan TikTok dihitung dalam mata uang yang berbeda, jadi
        angka mereka berdampingan tetapi tidak pernah dijumlahkan menjadi satu rasio.
    </p>

    <table class="tiles tinted keep" style="margin-top: 6mm;">
        <tr>
            <td>
                <div class="label">Post terukur</div>
                <div class="value">{{ $n($report['combined']['posts']) }}</div>
                <div class="note">{{ $live->count() }} platform</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="label">Interaksi</div>
                <div class="value">{{ $n($report['combined']['interactions']) }}</div>
                <div class="note">suka + komentar</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="label">Pemutaran</div>
                <div class="value">{{ $n($report['combined']['plays']) }}</div>
                <div class="note">video &amp; reel saja</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="label">Pengikut</div>
                <div class="value">{{ $n($report['combined']['followers']) }}</div>
                <div class="note">gabungan dua akun</div>
            </td>
        </tr>
    </table>

    <hr class="rule">

    <table class="data small">
        @foreach ([
            ['II.1 Ikhtisar dua akun', 'Angka pokok tiap platform, berdampingan.'],
            ['II.2 Tren bulanan', 'Interaksi dan jumlah post per bulan.'],
            ['II.3 Rincian per platform', 'Bauran format, konsentrasi, dan konten teratas.'],
            ['II.4 Kaitan ke konten', 'Konten terbit dan celah penautannya.'],
        ] as $row)
            <tr>
                <td style="width: 58mm; font-weight: 800;">{!! $row[0] !!}</td>
                <td class="muted">{!! $row[1] !!}</td>
            </tr>
        @endforeach
    </table>
</div>

{{-- ── II.1 Ikhtisar ── --}}

<div class="section">
    <div class="section-head">
        <div class="kicker">Bagian II.1</div>
        <h2>Ikhtisar dua akun</h2>
        <p class="lede">
            Angka di baris yang sama boleh dibaca berdampingan; angka engagement tidak —
            pembaginya beda. Instagram menayangkan ke pengikut, TikTok ke For You page.
        </p>
    </div>

    @foreach ($report['platforms'] as $p)
        <div class="block">
            <table>
                <tr>
                    <td style="width: 60%;">
                        <span class="pill" style="background: {{ $wash[$p['key']] }}; color: {{ $tone[$p['key']] }};">
                            {{ $p['label'] }}
                        </span>
                        <span class="muted small">{{ '@'.$p['handle'] }}</span>
                    </td>
                    <td class="tiny muted" style="text-align: right;">
                        @if ($p['syncedAt'])
                            Data ditarik {{ $p['syncedAt'] }}
                        @endif
                    </td>
                </tr>
            </table>

            @if ($p['measured'] === 0)
                <div class="callout keep" style="margin-top: 3mm;">
                    <p class="small" style="margin: 0;">
                        Tidak ada post yang tercatat di periode ini. Bisa berarti akunnya
                        memang tidak terbit, atau Performa belum disinkronkan sejak terakhir terbit.
                    </p>
                </div>
            @else
                <table class="tiles keep" style="margin-top: 3mm;">
                    <tr>
                        <td>
                            <div class="label">Post terbit</div>
                            <div class="value">{{ $n($p['measured']) }}</div>
                            <div class="note">{{ $n($p['cadence']['perWeek'], 1) }}/minggu · {{ $p['cadence']['activeDays'] }} hari aktif</div>
                        </td>
                        <td class="spacer"></td>
                        <td>
                            <div class="label">Interaksi khas</div>
                            <div class="value">{{ $n($p['typical']['interactions'], 1) }}</div>
                            <div class="note">rata-rata {{ $n($p['average']['interactions'], 1) }}</div>
                        </td>
                        <td class="spacer"></td>
                        <td>
                            <div class="label">Engagement</div>
                            <div class="value">{{ $p['engagement']['rate'] === null ? '–' : $n($p['engagement']['rate'], 2) . '%' }}</div>
                            <div class="note">per {{ $p['engagement']['basis'] }} ({{ $n($p['engagement']['basisValue']) }})</div>
                        </td>
                        <td class="spacer"></td>
                        <td>
                            <div class="label">Pengikut</div>
                            <div class="value">{{ $n($p['followers']) }}</div>
                            <div class="note">total interaksi {{ $n($p['totals']['interactions']) }}</div>
                        </td>
                    </tr>
                </table>

                @if ($p['average']['skew'] && $p['average']['skew'] >= 2)
                    <div class="callout warn keep" style="margin-top: 3mm;">
                        <p class="small" style="margin: 0;">
                            <strong>Rata-rata {{ $n($p['average']['skew'], 2) }}× lebih tinggi dari post khas.</strong>
                            Sebarannya sangat timpang: memakai rata-rata sebagai target akan
                            menetapkan sasaran yang tidak pernah dicapai oleh post biasa.
                            Pakai angka khas ({{ $n($p['typical']['interactions'], 1) }}) sebagai patokan.
                        </p>
                    </div>
                @endif
            @endif
        </div>
    @endforeach
</div>

{{-- ── II.2 Tren bulanan ── --}}

<div class="section">
    <div class="section-head">
        <div class="kicker">Bagian II.2</div>
        <h2>Tren bulanan</h2>
        <p class="lede">
            Interaksi tiap bulan, dipecah per platform, berdampingan dengan jumlah post
            yang menghasilkannya. Dua baris ini harus dibaca bersama: interaksi yang turun
            karena post yang turun bukan penurunan performa.
        </p>
    </div>

    <div class="legend">
        @foreach ($report['platforms'] as $p)
            <span style="margin-right: 6mm;">
                <span class="swatch" style="background: {{ $tone[$p['key']] }};"></span>{{ $p['label'] }}
            </span>
        @endforeach
    </div>

    <div class="block keep">
        <h3 style="margin-bottom: 2.5mm;">Interaksi per bulan</h3>
        <table class="chart">
            @foreach ($report['months'] as $month)
                <tr>
                    <td class="axis">
                        {{ $month['label'] }} {{ $month['year'] }}
                        @if ($month['partial'])
                            <span class="tiny alarm">berjalan</span>
                        @endif
                    </td>
                    <td>
                        <table>
                            @foreach ($report['platforms'] as $p)
                                @php $value = $month['by'][$p['key']]['interactions'] ?? 0; @endphp
                                <tr>
                                    <td style="padding: 0.5mm 0;">
                                        <div class="track">
                                            <div class="fill" style="width: {{ $value > 0 ? $bar($value, $monthMax) : 0 }}%; background: {{ $tone[$p['key']] }};"></div>
                                        </div>
                                    </td>
                                    <td style="width: 20mm; padding: 0.5mm 0 0.5mm 3mm; text-align: right;">
                                        <span class="{{ $value > 0 ? 'num' : 'muted' }}">{{ $n($value) }}</span>
                                    </td>
                                </tr>
                            @endforeach
                        </table>
                    </td>
                </tr>
            @endforeach
        </table>
    </div>

    <div class="block">
        <h3 style="margin-bottom: 2.5mm;">Post terbit per bulan</h3>
        <table class="data">
            <tr>
                <th>Bulan</th>
                @foreach ($report['platforms'] as $p)
                    <th class="r">{{ $p['label'] }}</th>
                @endforeach
                <th class="r">Total post</th>
                <th class="r">Interaksi</th>
                <th class="r">Per post</th>
            </tr>
            @foreach ($report['months'] as $month)
                <tr>
                    <td>
                        {{ $month['label'] }} {{ $month['year'] }}
                        @if ($month['partial'])
                            <span class="tiny alarm">· berjalan</span>
                        @endif
                    </td>
                    @foreach ($report['platforms'] as $p)
                        <td class="r">{{ $n($month['by'][$p['key']]['posts'] ?? 0) }}</td>
                    @endforeach
                    <td class="r num">{{ $n($month['posts']) }}</td>
                    <td class="r num">{{ $n($month['interactions']) }}</td>
                    <td class="r">{{ $month['posts'] > 0 ? $n($month['interactions'] / $month['posts'], 1) : '–' }}</td>
                </tr>
            @endforeach
        </table>
        <p class="tiny muted" style="margin-top: 2mm;">
            Kolom "per post" adalah rata-rata sederhana dan ikut terseret oleh satu post
            besar. Angka khas per platform ada di Bagian II.1.
        </p>
    </div>
</div>

{{-- ── II.3 Rincian per platform ── --}}

@foreach ($live as $p)
    <div class="section">
        <div class="section-head">
            <div class="kicker">Bagian II.3{{ $loop->first ? 'a' : 'b' }}</div>
            <h2>{{ $p['label'] }} · rincian</h2>
            <p class="lede">
                {{ $n($p['measured']) }} post di {{ $report['period']['label'] }},
                {{ $n($p['cadence']['perWeek'], 1) }} post per minggu, jeda terpanjang
                {{ $p['cadence']['longestGap'] ?? '–' }} hari.
            </p>
        </div>

        <div class="block keep">
            <h3 style="margin-bottom: 2.5mm;">Bauran format</h3>
            @php $formatMax = collect($p['formats'])->max('typical') ?: 1; @endphp
            <table class="chart">
                @foreach ($p['formats'] as $format)
                    <tr>
                        <td class="axis">
                            {{ $format['label'] }}
                            <span class="tiny muted">{{ $format['count'] }} post · {{ $format['share'] }}%</span>
                        </td>
                        <td>
                            <div class="track">
                                <div class="fill" style="width: {{ $bar($format['typical'], $formatMax) }}%; background: {{ $tone[$p['key']] }};"></div>
                            </div>
                        </td>
                        <td class="figure">
                            {{ $n($format['typical'], 1) }}
                            <span class="sub tiny">khas</span>
                        </td>
                    </tr>
                @endforeach
            </table>
            <p class="tiny muted" style="margin-top: 2mm;">
                Panjang batang = interaksi post khas untuk format itu, bukan totalnya.
                Format dengan 2 post dan format dengan 40 post berdiri di sumbu yang sama,
                jadi baca jumlah postnya juga.
            </p>
        </div>

        @if ($p['formats'])
            <div class="block">
                <table class="data">
                    <tr>
                        <th>Format</th>
                        <th class="r">Post</th>
                        <th class="r">Porsi</th>
                        <th class="r">Interaksi khas</th>
                        <th class="r">Pemutaran khas</th>
                        <th class="r">Total interaksi</th>
                    </tr>
                    @foreach ($p['formats'] as $format)
                        <tr>
                            <td>{{ $format['label'] }}</td>
                            <td class="r">{{ $n($format['count']) }}</td>
                            <td class="r">{{ $format['share'] }}%</td>
                            <td class="r num">{{ $n($format['typical'], 1) }}</td>
                            <td class="r">{{ $n($format['plays']) }}</td>
                            <td class="r">{{ $n($format['total']) }}</td>
                        </tr>
                    @endforeach
                </table>
            </div>
        @endif

        @if ($p['concentration'])
            <div class="block keep">
                <h3 style="margin-bottom: 2.5mm;">Konsentrasi</h3>
                <table class="chart">
                    <tr>
                        <td class="axis">5 post teratas</td>
                        <td>
                            <div class="track">
                                <div class="fill" style="width: {{ $p['concentration']['topFiveShare'] }}%; background: {{ $tone[$p['key']] }};"></div>
                            </div>
                        </td>
                        <td class="figure">{{ $p['concentration']['topFiveShare'] }}%</td>
                    </tr>
                    <tr>
                        <td class="axis">20% post teratas</td>
                        <td>
                            <div class="track">
                                <div class="fill" style="width: {{ $p['concentration']['topFifthShare'] }}%; background: {{ $tone[$p['key']] }};"></div>
                            </div>
                        </td>
                        <td class="figure">{{ $p['concentration']['topFifthShare'] }}%</td>
                    </tr>
                </table>
                <p class="tiny muted" style="margin-top: 2mm;">
                    Porsi seluruh interaksi {{ $p['label'] }} periode ini yang datang dari
                    segelintir post, dari {{ $p['concentration']['posts'] }} post terukur.
                </p>
            </div>
        @endif

        @if ($p['outlier'])
            <div class="callout warn block keep">
                <h3 class="alarm">Satu post membengkokkan seluruh angka</h3>
                <p class="small" style="margin: 0;">
                    {{ ucfirst($p['outlier']['format']) }} tanggal {{ $p['outlier']['postedAt'] }}
                    ({{ $p['outlier']['key'] }}) meraih {{ $n($p['outlier']['interactions']) }} interaksi
                    — {{ $n($p['outlier']['times'], 1) }}× post khas dan {{ $p['outlier']['share'] }}%
                    dari seluruh interaksi {{ $p['label'] }} periode ini. Selama post ini ikut
                    dihitung, rata-rata apa pun di halaman ini menggambarkan post tersebut,
                    bukan pekerjaan sehari-hari tim.
                </p>
            </div>
        @endif

        <div class="block">
            <h3 style="margin-bottom: 2.5mm;">Lima konten teratas</h3>
            <table class="data">
                <tr>
                    <th style="width: 6mm;">#</th>
                    <th>Konten</th>
                    <th class="r">Suka</th>
                    <th class="r">Komentar</th>
                    <th class="r">Putar</th>
                    <th class="r">Interaksi</th>
                </tr>
                @foreach ($p['top'] as $post)
                    <tr>
                        <td class="num">{{ $post['rank'] }}</td>
                        <td>
                            <div style="font-weight: 700;">
                                {{ $post['caption'] ? \Illuminate\Support\Str::limit($post['caption'], 78) : 'Tanpa keterangan' }}
                            </div>
                            <div class="tiny muted">
                                {{ ucfirst($post['format']) }} · {{ $post['postedAt'] }} · {{ $post['key'] }}
                            </div>
                        </td>
                        <td class="r">{{ $n($post['likes']) }}</td>
                        <td class="r">{{ $n($post['comments']) }}</td>
                        <td class="r">{{ $n($post['plays']) }}</td>
                        <td class="r num">{{ $n($post['interactions']) }}</td>
                    </tr>
                @endforeach
            </table>
        </div>
    </div>
@endforeach

{{-- ── II.4 Kaitan ke konten ── --}}

<div class="section">
    <div class="section-head">
        <div class="kicker">Bagian II.4</div>
        <h2>Kaitan ke konten</h2>
        <p class="lede">
            Apa yang direncanakan di kalender konten, berapa yang benar-benar terbit, dan
            seberapa jauh kedua bagian laporan ini bisa dihubungkan satu sama lain.
        </p>
    </div>

    <table class="tiles block keep">
        <tr>
            <td>
                <div class="label">Konten terjadwal</div>
                <div class="value">{{ $n($report['business']['plannedContent']) }}</div>
                <div class="note">di kalender periode ini</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="label">Konten tayang</div>
                <div class="value">{{ $n($report['business']['publishedContent']) }}</div>
                <div class="note">
                    @if ($report['business']['publishedShare'] !== null)
                        {{ $report['business']['publishedShare'] }}% dari yang terjadwal
                    @else
                        berstatus published
                    @endif
                </div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="label">Konten teratas tertaut</div>
                <div class="value">{{ $n($report['business']['topLinked']) }}</div>
                <div class="note">dari {{ $n($report['business']['topTotal']) }} konten teratas</div>
            </td>
            <td class="spacer"></td>
            <td>
                <div class="label">Lead per konten</div>
                <div class="value">{{ $n($report['business']['leadsPerPost'], 1) }}</div>
                <div class="note">pembagian sederhana</div>
            </td>
        </tr>
    </table>

    <div class="callout warn block keep">
        <h3 class="alarm">Kedua bagian belum bisa dihubungkan</h3>
        <p class="small">
            <strong>Angka lead di Bagian I adalah lead pada periode yang sama, bukan lead
            yang terbukti datang dari post-post di Bagian II.</strong> Keduanya berdiri
            berdampingan karena memang terjadi bersamaan — itu saja.
        </p>
        <p class="small" style="margin: 0;">
            Untuk membuktikannya, konten di kalender harus ditautkan ke post yang tayang
            lewat kolom Tautan. Dari {{ $report['business']['topTotal'] }} konten teratas
            di periode ini, {{ $report['business']['topLinked'] }} yang sudah tertaut.
            Sampai angka itu naik, "Lead per konten" adalah pembagian sederhana, bukan
            sebab-akibat.
        </p>
    </div>
</div>

{{-- ═══════════════════  Temuan & rekomendasi  ════════════════════════ --}}

@if ($analysis && ($analysis['temuan'] || $analysis['rekomendasi']))
    <div class="section">
        <div class="section-head">
            <div class="kicker">Penutup</div>
            <h2>Temuan &amp; rekomendasi</h2>
            <p class="lede">
                Dibaca dari angka di kedua bagian. Rekomendasi ditulis agar bisa
                dikerjakan minggu depan, bukan sebagai prinsip umum.
            </p>
        </div>

        @if ($analysis['temuan'])
            <div class="block">
                <h3 style="margin-bottom: 3mm;">Temuan</h3>
                @foreach ($analysis['temuan'] as $i => $item)
                    <div class="finding keep">
                        <div class="n">Temuan {{ $i + 1 }}</div>
                        <h3>{{ $item['judul'] }}</h3>
                        <p style="margin: 0;">{{ $item['isi'] }}</p>
                    </div>
                @endforeach
            </div>
        @endif

        @if ($analysis['rekomendasi'])
            <div class="block">
                <hr class="rule">
                <h3 style="margin-bottom: 3mm;">Rekomendasi</h3>
                @foreach ($analysis['rekomendasi'] as $i => $item)
                    <div class="finding keep">
                        <div class="n">Langkah {{ $i + 1 }}</div>
                        <h3>{{ $item['judul'] }}</h3>
                        <p style="margin: 0;">{{ $item['isi'] }}</p>
                    </div>
                @endforeach
            </div>
        @endif

        <p class="tiny muted">
            Bagian ini disusun oleh model bahasa ({{ $analysis['model'] }}) dari angka yang
            dihitung aplikasi. Model tidak menghitung apa pun dan tidak diberi akses ke data
            mentah; angka yang dikutipnya berasal dari halaman-halaman di atas.
        </p>
    </div>
@endif

{{-- ══════════════════════  Catatan metode  ═══════════════════════════ --}}

<div class="section">
    <div class="section-head">
        <div class="kicker">Lampiran</div>
        <h2>Catatan metode</h2>
        <p class="lede">Apa arti tiap angka, dan sejauh mana ia boleh dipercaya.</p>
    </div>

    <div class="block">
        <h3 style="margin-bottom: 2.5mm;">Bagian I · Leads</h3>
        <table class="data">
            <tr>
                <th style="width: 42mm;">Istilah</th>
                <th>Definisi</th>
            </tr>
            <tr>
                <td class="num">Lead masuk</td>
                <td>Lead dengan tanggal masuk di dalam rentang laporan. Satu rombongan yang diikuti sampai akhir laporan.</td>
            </tr>
            <tr>
                <td class="num">Client baru</td>
                <td>
                    Lead yang perpindahannya ke tahap Client tercatat di dalam rentang laporan —
                    berapa pun lamanya ia sudah ada di pipeline. Sebagian besar berasal dari
                    lead yang masuk sebelum periode ini.
                </td>
            </tr>
            <tr>
                <td class="num">Corong</td>
                <td>
                    Sejauh mana lead yang masuk periode ini pernah melangkah, dibaca dari
                    riwayat tahapan tiap lead. Bukan potret siapa berdiri di mana hari ini.
                </td>
            </tr>
            <tr>
                <td class="num">Mandek</td>
                <td>
                    Lead aktif yang sudah melewati batas hari tahapnya tanpa bergerak. Batasnya
                    ditetapkan per tahap di pengaturan pipeline, bukan angka umum.
                </td>
            </tr>
            <tr>
                <td class="num">Nilai</td>
                <td>Nilai yang diisikan pada lead. Ini perkiraan tim saat lead dibuat, bukan nilai kontrak yang ditandatangani.</td>
            </tr>
        </table>
    </div>

    <div class="block">
        <h3 style="margin-bottom: 2.5mm;">Bagian II · Media sosial</h3>
        <table class="data">
            <tr>
                <th style="width: 42mm;">Istilah</th>
                <th>Definisi</th>
            </tr>
            <tr>
                <td class="num">Interaksi</td>
                <td>
                    Instagram: suka + komentar. TikTok: suka + komentar + bagikan + simpan.
                    Kedua platform tidak melaporkan hal yang sama, jadi total interaksinya
                    tidak setara satu lawan satu.
                </td>
            </tr>
            <tr>
                <td class="num">Khas <span class="muted tiny">median</span></td>
                <td>
                    Nilai tengah: separuh post di atasnya, separuh di bawahnya. Dipakai sebagai
                    angka utama karena satu post viral bisa membawa lebih banyak interaksi
                    daripada lima puluh post di sekitarnya digabung.
                </td>
            </tr>
            <tr>
                <td class="num">Rata-rata <span class="muted tiny">mean</span></td>
                <td>
                    Total dibagi jumlah post. Dicantumkan berdampingan dengan khas karena
                    jarak antara keduanya adalah temuannya sendiri.
                </td>
            </tr>
            <tr>
                <td class="num">Engagement rate</td>
                <td>
                    Interaksi post khas dibagi audiens yang bisa memberikannya.
                    Instagram memakai jumlah pengikut; TikTok memakai pemutaran khas, karena
                    TikTok menayangkan ke For You page, bukan ke pengikut.
                    <strong>Angka kedua platform tidak boleh dibandingkan.</strong>
                </td>
            </tr>
            <tr>
                <td class="num">Post terukur</td>
                <td>
                    Post yang tersimpan di aplikasi hasil sinkronisasi Performa, bukan seluruh
                    isi akun. Tiap platform mencantumkan waktu tarik datanya di Bagian II.1.
                </td>
            </tr>
        </table>
    </div>

    <div class="callout warn block keep">
        <h3 class="alarm">Batas data</h3>
        <p class="small">
            <strong>Sampel, bukan sensus.</strong> Sinkronisasi Performa menarik sejumlah
            post terakhir tiap akun. Post yang lebih lama dari itu tidak ada di laporan ini.
        </p>
        <p class="small">
            <strong>Angka bergerak.</strong> Suka dan komentar dihitung pada saat data
            ditarik. Post yang baru terbit masih akan naik angkanya, jadi bulan terakhir
            selalu terlihat lebih lemah daripada nanti.
        </p>
        <p class="small">
            <strong>Rombongan lead belum matang.</strong> Lead yang masuk di bulan terakhir
            periode belum punya waktu untuk sampai ke Client, jadi corong di Bagian I.1
            akan terus terisi sesudah laporan ini dicetak.
        </p>
        <p class="small">
            <strong>Pertumbuhan pengikut tidak dilaporkan.</strong> Aplikasi baru menyimpan
            sedikit potret jumlah pengikut, dan grafik pertumbuhan dari dua titik akan
            menggambar garis yang tidak berhak digambar.
        </p>
        <p class="small" style="margin: 0;">
            <strong>Tanpa data pembanding industri.</strong> Laporan ini membandingkan
            perusahaan dengan dirinya sendiri di bulan-bulan sebelumnya, tidak dengan
            perusahaan lain.
        </p>
    </div>

    <p class="tiny muted">
        Dihasilkan {{ $report['period']['generatedAt'] }} dari basis data Kisantra ·
        Periode {{ $report['period']['from'] }} sampai {{ $report['period']['to'] }} ·
        Seluruh angka dihitung ulang setiap laporan dibuat.
    </p>
</div>

</body>
</html>
