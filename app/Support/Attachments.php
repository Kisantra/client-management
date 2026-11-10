<?php

namespace App\Support;

use App\Models\Lead;
use App\Models\LeadAttachment;
use App\Models\LeadNote;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Where uploaded evidence goes.
 *
 * Files are kept under the lead they belong to and keep their original name for
 * display only — the stored name is generated, so two people uploading
 * "proposal.pdf" never overwrite each other.
 *
 * The disk is the private one. These are contracts, proposals and NPWP
 * photos: they are opened through a signed-in route, or by Project Management
 * through a link that expires, never from a public folder.
 */
class Attachments
{
    public const DISK = 'local';

    /**
     * @param  array<int, UploadedFile>  $files
     * @return array<int, LeadAttachment>
     */
    public static function store(Lead $lead, array $files, ?LeadNote $note = null, ?string $stage = null): array
    {
        $stored = [];

        foreach ($files as $file) {
            if (! $file instanceof UploadedFile) {
                continue;
            }

            $path = $file->store('leads/'.$lead->id, self::DISK);

            $stored[] = LeadAttachment::create([
                'lead_id' => $lead->id,
                'lead_note_id' => $note?->id,
                'stage' => $stage,
                'name' => $file->getClientOriginalName(),
                'path' => $path,
                'mime' => $file->getClientMimeType(),
                'size' => $file->getSize(),
            ]);
        }

        return $stored;
    }

    /** The file as a response that opens in the browser rather than downloading. */
    public static function inline(LeadAttachment $attachment): StreamedResponse
    {
        $disk = Storage::disk(self::DISK);

        abort_unless($disk->exists($attachment->path), 404);

        return $disk->response(
            $attachment->path,
            $attachment->name,
            array_filter(['Content-Type' => $attachment->mime]),
            'inline',
        );
    }

    /** The shape the detail page renders a file chip from. */
    public static function toArray(LeadAttachment $attachment): array
    {
        return [
            'id' => $attachment->id,
            'name' => $attachment->name,
            'url' => $attachment->url(),
            'size' => $attachment->size,
        ];
    }
}
