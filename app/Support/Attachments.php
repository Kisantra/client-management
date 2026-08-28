<?php

namespace App\Support;

use App\Models\Lead;
use App\Models\LeadAttachment;
use App\Models\LeadNote;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

/**
 * Where uploaded evidence goes.
 *
 * Files are kept under the lead they belong to and keep their original name for
 * display only — the stored name is generated, so two people uploading
 * "proposal.pdf" never overwrite each other.
 */
class Attachments
{
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

            $path = $file->store('leads/'.$lead->id, 'public');

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

    /** The shape the detail page renders a file chip from. */
    public static function toArray(LeadAttachment $attachment): array
    {
        return [
            'id' => $attachment->id,
            'name' => $attachment->name,
            'url' => Storage::disk('public')->url($attachment->path),
            'size' => $attachment->size,
        ];
    }
}
