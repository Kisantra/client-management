<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Support\Attachments;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * What was said, and the evidence behind it.
 *
 * A note may be text, files, or both — a forwarded screenshot is a record even
 * with nothing typed next to it.
 */
class LeadNoteController extends Controller
{
    public function store(Request $request, Lead $lead)
    {
        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:2000', 'required_without:files'],
            'files' => ['nullable', 'array', 'max:10'],
            'files.*' => ['file', 'max:10240', 'mimes:jpg,jpeg,png,webp,pdf'],
        ], [
            'body.required_without' => 'Tulis catatannya, atau lampirkan berkas.',
            'files.*.max' => 'Ukuran berkas maksimal 10 MB.',
            'files.*.mimes' => 'Berkas harus JPG, PNG, WebP, atau PDF.',
        ]);

        $files = $request->file('files', []);

        DB::transaction(function () use ($lead, $validated, $files, $request) {
            $note = $lead->notes()->create([
                'author' => $request->user()->name,
                'body' => trim((string) ($validated['body'] ?? '')),
            ]);

            Attachments::store($lead, $files, $note);
        });

        $this->toast(
            'Catatan tersimpan',
            $files === [] ? null : count($files).' berkas ikut dilampirkan.',
        );

        return back();
    }
}
