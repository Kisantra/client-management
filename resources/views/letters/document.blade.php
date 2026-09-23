{{--
  | The letter itself, laid out as the office's template is: date line on the
  | right, Nomor and Perihal, the addressee, the body, and "Hormat kami" with
  | the signature. Shared by the preview and the PDF, so it uses the plain
  | classes from letters/style and nothing else.
--}}
<div class="ltr-doc {{ $forPdf ?? false ? 'ltr-doc--pdf' : '' }}">
    <div class="ltr-page">
        <p class="ltr-dateline">{{ $dateLine }}</p>

        <table class="ltr-meta">
            <tr><td class="ltr-meta-k">Nomor</td><td class="ltr-meta-c">:</td><td>{{ $letter->number ?? '…' }}</td></tr>
            <tr><td class="ltr-meta-k">Perihal</td><td class="ltr-meta-c">:</td><td>{{ $letter->subject }}</td></tr>
        </table>

        <div class="ltr-addr">
            <div>Kepada</div>
            <div>Yth. <span class="ltr-addr-name">{!! $recipient !!}</span></div>
        </div>

        <div class="ltr-body">{!! $body !!}</div>

        <table class="ltr-sign">
            <tr>
                <td>
                    <p class="ltr-sign-salute">Hormat kami,</p>
                    <p class="ltr-sign-for">{{ $legalName }}</p>
                    <div class="ltr-sign-space">
                        @if ($signatureSrc)
                            <img class="ltr-sign-img" src="{{ $signatureSrc }}" alt="">
                        @endif
                    </div>
                    <p class="ltr-sign-name">{{ $letter->signer_name }}</p>
                    <p class="ltr-sign-role">{{ $letter->signer_title }}</p>
                </td>
            </tr>
        </table>
    </div>
</div>
