{{--
  | The letter itself, laid out as the office's template is: date line on the
  | right, Nomor and Perihal, the addressee, the body, and "Hormat kami" with
  | one signature column per signer. A document list marked as an attachment
  | follows on its own LAMPIRAN page. Shared by the preview and the PDF, so it
  | uses the plain classes from letters/style and nothing else.
--}}
@php
    $columns = count($signatures) + ($counterSign ? 1 : 0);
    $width = (int) floor(100 / max(1, $columns));
    $roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
@endphp
<div class="ltr-doc {{ $forPdf ?? false ? 'ltr-doc--pdf' : '' }}">
    <div class="ltr-page">
        <p class="ltr-dateline">{{ $dateLine }}</p>

        <table class="ltr-meta">
            <tr><td class="ltr-meta-k">Nomor</td><td class="ltr-meta-c">:</td><td>{{ $letter->number ?? '…' }}</td></tr>
            @if ($attachments !== [])
                <tr><td class="ltr-meta-k">Lampiran</td><td class="ltr-meta-c">:</td><td>Satu set</td></tr>
            @endif
            <tr><td class="ltr-meta-k">Perihal</td><td class="ltr-meta-c">:</td><td>{{ $letter->subject }}</td></tr>
        </table>

        {{-- A berita acara or a statement is addressed to nobody: no block at all. --}}
        @if ($recipient !== null)
            <div class="ltr-addr">
                <div>Kepada</div>
                <div>Yth. <span class="ltr-addr-name">{!! $recipient !!}</span></div>
            </div>
        @endif

        <div class="ltr-body">{!! $body !!}</div>

        <table class="ltr-sign">
            <tr>
                @foreach ($signatures as $signature)
                    <td style="width: {{ $width }}%">
                        @if ($loop->first)
                            <p class="ltr-sign-salute">Hormat kami,</p>
                            <p class="ltr-sign-for">{{ $legalName }}</p>
                        @else
                            <p class="ltr-sign-salute">&nbsp;</p>
                            <p class="ltr-sign-for">&nbsp;</p>
                        @endif
                        <div class="ltr-sign-space">
                            @if ($signature['src'])
                                <img class="ltr-sign-img" src="{{ $signature['src'] }}" alt="">
                            @endif
                        </div>
                        <p class="ltr-sign-name">{{ $signature['name'] ?: '…………………………' }}</p>
                        <p class="ltr-sign-role">{{ $signature['title'] ?: $signature['label'] }}</p>
                    </td>
                @endforeach
                @if ($counterSign)
                    <td style="width: {{ $width }}%">
                        <p class="ltr-sign-salute">Menyetujui,</p>
                        <p class="ltr-sign-for">{{ $counterSign['for'] }}</p>
                        <div class="ltr-sign-space"></div>
                        <p class="ltr-sign-name">{{ $counterSign['name'] }}</p>
                        <p class="ltr-sign-role">Wakil klien</p>
                    </td>
                @endif
            </tr>
        </table>
    </div>

    @foreach ($attachments as $i => $attachment)
        <div class="ltr-page ltr-page--attachment">
            <p class="ltr-attach-title">LAMPIRAN {{ $roman[$i] ?? $i + 1 }}</p>
            <table class="ltr-meta">
                <tr><td class="ltr-meta-k">Nomor</td><td class="ltr-meta-c">:</td><td>{{ $letter->number ?? '…' }}</td></tr>
                <tr><td class="ltr-meta-k">Tanggal</td><td class="ltr-meta-c">:</td><td>{{ $longDate }}</td></tr>
                <tr><td class="ltr-meta-k">Perihal</td><td class="ltr-meta-c">:</td><td>Daftar {{ $attachment['label'] }}</td></tr>
            </table>
            <table class="ltr-attach">
                <thead>
                    <tr>
                        <th class="ltr-col-no">NO</th>
                        <th class="ltr-col-doc">DOKUMEN</th>
                        <th>RINCIAN YANG DIMINTA</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach ($attachment['items'] as $n => $doc)
                        <tr>
                            <td class="ltr-col-no">{{ $n + 1 }}</td>
                            <td class="ltr-col-doc">{{ $doc->name }}</td>
                            <td>{{ $doc->note ?: ($doc->type?->description ?: '—') }}</td>
                        </tr>
                    @endforeach
                </tbody>
            </table>
        </div>
    @endforeach
</div>
