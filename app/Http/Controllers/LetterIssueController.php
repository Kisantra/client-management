<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\LeadAttachment;
use App\Models\LeadStageEvent;
use App\Models\Letter;
use App\Support\Attachments;
use App\Support\LetterNumber;
use App\Support\LetterPdf;
use App\Support\LetterRenderer;
use App\Support\Pipeline;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * The moment a draft becomes a letter, and the way back.
 *
 * Issuing draws the number and freezes the words and the signatures, so
 * the PDF downloaded tomorrow is the one sent today. Pulling it back reopens the words for a
 * correction but keeps the number: a number once given is on the register,
 * and the corrected letter goes out under it.
 */
class LetterIssueController extends Controller
{
    public function store(Request $request, Letter $letter)
    {
        if (! $letter->isDraft()) {
            $this->toast('Surat ini sudah '.mb_strtolower($letter->statusLabel()), null, 'warning');

            return back();
        }

        $letter->load(['template', 'lead']);
        $missing = LetterRenderer::missing($letter);

        if ($missing !== []) {
            $this->toast('Belum bisa diterbitkan', 'Lengkapi dulu: '.implode(', ', $missing).'.', 'error');

            return back();
        }

        $moved = DB::transaction(function () use ($letter, $request) {
            LetterNumber::assign($letter);

            $letter->forceFill([
                // Name, title and signature image as they stand now, kept with the letter.
                'signers' => $letter->frozenSigners(),
                'rendered_html' => LetterRenderer::body($letter),
                'status' => Letter::ISSUED,
                'issued_at' => now(),
            ])->save();

            return $this->advanceLead($letter, $request->user()->name);
        });

        $this->toast(
            'Surat terbit',
            'Nomor '.$letter->number.'. PDF-nya siap diunduh.'
                .($moved ? ' '.$letter->lead->displayName().' pindah ke '.Pipeline::label($moved).'.' : ''),
        );

        return back();
    }

    public function destroy(Letter $letter)
    {
        if (! $letter->isIssued()) {
            $this->toast('Hanya surat terbit yang bisa ditarik ke draft', null, 'warning');

            return back();
        }

        $letter->update(['status' => Letter::DRAFT, 'rendered_html' => null]);

        $this->toast(
            'Ditarik ke draft',
            'Nomor '.$letter->number.' tetap dipakai saat diterbitkan lagi.',
        );

        return back();
    }

    /**
     * Moves the lead to the stage this kind of letter stands for, with the
     * PDF attached as the document that stage requires.
     *
     * Only forward, and only while the lead is still being worked: an offer
     * sent to a client already signed changes nothing about where they are,
     * and a closed lead is reopened by a person, not by a letter. Returns the
     * stage moved to, or null.
     */
    private function advanceLead(Letter $letter, string $author): ?string
    {
        $target = $letter->template->stage_on_issue;
        $lead = $letter->lead;

        if (
            $target === null
            || ! in_array($target, Pipeline::keys(), true)
            || $lead->isClosed()
            || Pipeline::index($lead->stage) >= Pipeline::index($target)
        ) {
            return null;
        }

        $lead->update([
            'stage' => $target,
            'stage_changed_at' => Carbon::today(),
            'last_contact_at' => Carbon::today(),
        ]);

        LeadStageEvent::create([
            'lead_id' => $lead->id,
            'stage' => $target,
            'entered_at' => Carbon::today(),
        ]);

        $note = $lead->notes()->create([
            'author' => $author,
            'body' => 'Pindah ke '.Pipeline::label($target).'. '
                .$letter->template->name.' '.$letter->number.' diterbitkan dan dilampirkan.',
        ]);

        $this->attachPdf($letter, $lead, $note->id, $target);

        return $target;
    }

    /** The issued letter, filed with the lead the way an uploaded proposal would be. */
    private function attachPdf(Letter $letter, Lead $lead, int $noteId, string $stage): void
    {
        $pdf = LetterPdf::render($letter);
        $path = 'leads/'.$lead->id.'/'.Str::slug(str_replace('/', '-', (string) $letter->number)).'-'.Str::random(6).'.pdf';

        Storage::disk(Attachments::DISK)->put($path, $pdf);

        LeadAttachment::create([
            'lead_id' => $lead->id,
            'lead_note_id' => $noteId,
            'stage' => $stage,
            'name' => LetterRenderer::fileName($letter),
            'path' => $path,
            'mime' => 'application/pdf',
            'size' => strlen($pdf),
        ]);
    }
}
