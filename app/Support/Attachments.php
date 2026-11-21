<?php

namespace App\Support;

use App\Models\Lead;
use App\Models\LeadAttachment;
use App\Models\LeadNote;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use League\Flysystem\FilesystemException;
use League\Flysystem\UnableToWriteFile;
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
        $written = [];

        foreach ($files as $file) {
            if (! $file instanceof UploadedFile) {
                continue;
            }

            $path = self::put($file, 'leads/'.$lead->id, $written);
            $written[] = $path;

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

    /**
     * Writes one file, or turns the whole upload down with a reason.
     *
     * When the server cannot write — a folder that belongs to another user, a
     * full disk — the failure is still reported, the files this upload already
     * wrote are removed, and the form says why instead of showing a 500
     * (Watchpost #14). Every caller stores inside a transaction, so the stage,
     * note and attachment rows roll back with it.
     *
     * @param  array<int, string>  $written
     */
    private static function put(UploadedFile $file, string $folder, array $written): string
    {
        try {
            return $file->store($folder, self::DISK)
                ?: throw UnableToWriteFile::atLocation($folder, 'the disk did not accept '.$file->getClientOriginalName());
        } catch (FilesystemException $e) {
            report($e);
            Storage::disk(self::DISK)->delete($written);

            throw ValidationException::withMessages([
                'files' => 'Lampiran tidak bisa disimpan di server. Tim teknis sudah diberi tahu, coba lagi nanti.',
            ]);
        }
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
