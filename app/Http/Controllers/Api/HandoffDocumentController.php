<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Lead;
use App\Models\LeadAttachment;
use App\Support\Attachments;
use App\Support\Pipeline;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\URL;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * A handed-over client's files, read by Project Management.
 *
 * Project Management asks for the list when the tax team checks the client,
 * and copies the files it keeps into its own client documents. Each file comes
 * with a link that works for five minutes — long enough to look or download,
 * too short to paste into a chat and forget about.
 *
 * Only a lead that was actually handed over can be read this way. Its files
 * come as three kinds: the contract the deal was signed on, the proposal
 * before it, and everything else attached along the way (NPWP, akta, chat
 * screenshots).
 */
class HandoffDocumentController extends Controller
{
    /** The stage a file proved, read as the kind Project Management files it under. */
    private const KINDS = ['deal' => 'kontrak', 'proposal' => 'proposal'];

    /** Contract first, then the proposal it closed, then the rest. */
    private const ORDER = ['kontrak', 'proposal', 'lampiran'];

    private const OTHER_LABEL = 'Lampiran lead';

    private const LINK_MINUTES = 5;

    public function index(Lead $lead): JsonResponse
    {
        abort_unless($lead->handoff()->exists(), 404);

        $documents = $lead->attachments()
            ->latest()
            ->latest('id')
            ->get()
            // Stable, so each kind keeps its newest-first order.
            ->sortBy(fn (LeadAttachment $attachment) => array_search(self::kind($attachment), self::ORDER, true))
            ->map(fn (LeadAttachment $attachment) => [
                'id' => $attachment->id,
                'kind' => self::kind($attachment),
                'label' => self::label($attachment),
                'name' => $attachment->name,
                'mime' => $attachment->mime,
                'size' => $attachment->size,
                'uploaded_at' => $attachment->created_at->toIso8601String(),
                'preview_url' => URL::temporarySignedRoute(
                    'pm.attachments.show',
                    now()->addMinutes(self::LINK_MINUTES),
                    ['attachment' => $attachment->id],
                ),
            ]);

        return response()->json(['data' => $documents->values()]);
    }

    /** The file itself, inline, so it opens in a frame as well as downloads. */
    public function show(LeadAttachment $attachment): StreamedResponse
    {
        abort_unless($attachment->lead->handoff()->exists(), 404);

        return Attachments::inline($attachment);
    }

    private static function kind(LeadAttachment $attachment): string
    {
        return self::KINDS[(string) $attachment->stage] ?? 'lampiran';
    }

    private static function label(LeadAttachment $attachment): string
    {
        return array_key_exists((string) $attachment->stage, self::KINDS)
            ? Pipeline::requirement((string) $attachment->stage)['label'] ?? Pipeline::label((string) $attachment->stage)
            : self::OTHER_LABEL;
    }
}
