<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Lead files leave the public disk.
 *
 * Contracts, proposals and NPWP photos sat under /storage, readable by anyone
 * holding the link. They now live on the private disk and are served behind
 * sign-in, or to Project Management through a short-lived signed link.
 *
 * Moves only what is still on the public disk, so running it twice — or after
 * a partial run — does no harm. The paths in the table stay the same.
 */
return new class extends Migration
{
    public function up(): void
    {
        $this->move(from: 'public', to: 'local');
    }

    public function down(): void
    {
        $this->move(from: 'local', to: 'public');
    }

    private function move(string $from, string $to): void
    {
        $source = Storage::disk($from);
        $target = Storage::disk($to);

        DB::table('lead_attachments')->orderBy('id')->each(function (object $row) use ($source, $target) {
            if (! $source->exists($row->path) || $target->exists($row->path)) {
                return;
            }

            $stream = $source->readStream($row->path);
            $written = $target->writeStream($row->path, $stream);

            if (is_resource($stream)) {
                fclose($stream);
            }

            // Only drop the original once the copy is known to be there.
            if ($written && $target->exists($row->path)) {
                $source->delete($row->path);
            }
        });
    }
};
