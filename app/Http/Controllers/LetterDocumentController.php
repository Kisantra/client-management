<?php

namespace App\Http\Controllers;

use App\Models\Letter;
use App\Models\LetterRequestedDocument;
use App\Models\RequestedDocumentType;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * The documents a letter asks the client for.
 *
 * Adding, annotating and removing them is writing the letter, so it happens
 * only while the letter is a draft. Marking one received is keeping track of
 * what came back, so it goes on after the letter is issued — it changes the
 * register, not the page that was sent.
 */
class LetterDocumentController extends Controller
{
    public function store(Request $request, Letter $letter)
    {
        $this->editable($letter);

        $validated = $request->validate([
            'field' => ['required', 'string', Rule::in($letter->template->checklistKeys())],
            'type_id' => ['nullable', 'integer', Rule::exists('requested_document_types', 'id')->where('is_active', true)],
            'name' => ['required_without:type_id', 'nullable', 'string', 'min:2', 'max:200'],
            'note' => ['nullable', 'string', 'max:200'],
        ], [
            'name.required_without' => 'Pilih dari daftar atau tulis nama dokumennya.',
            'name.min' => 'Nama dokumen minimal 2 huruf.',
        ]);

        $type = isset($validated['type_id']) ? RequestedDocumentType::query()->find((int) $validated['type_id']) : null;
        $name = trim((string) ($type instanceof RequestedDocumentType ? $type->name : $validated['name']));

        $duplicate = $letter->requestedDocuments()
            ->where('field_key', $validated['field'])
            ->where(fn ($query) => $type
                ? $query->where('requested_document_type_id', $type->id)->orWhere('name', $name)
                : $query->where('name', $name))
            ->exists();

        if ($duplicate) {
            throw ValidationException::withMessages(['name' => '"'.$name.'" sudah ada di daftar.']);
        }

        $letter->requestedDocuments()->create([
            'field_key' => $validated['field'],
            'requested_document_type_id' => $type?->id,
            'name' => $name,
            'note' => filled($validated['note'] ?? null) ? trim($validated['note']) : null,
            'order' => (int) $letter->requestedDocuments()->where('field_key', $validated['field'])->max('order') + 1,
        ]);

        return back();
    }

    /** The qualifier printed after the name: "Januari–Desember 2025". */
    public function update(Request $request, Letter $letter, LetterRequestedDocument $document)
    {
        $this->owned($letter, $document);
        $this->editable($letter);

        $validated = $request->validate([
            'note' => ['nullable', 'string', 'max:200'],
        ]);

        $document->update(['note' => filled($validated['note'] ?? null) ? trim($validated['note']) : null]);

        return back();
    }

    public function destroy(Letter $letter, LetterRequestedDocument $document)
    {
        $this->owned($letter, $document);
        $this->editable($letter);

        $document->delete();

        return back();
    }

    /** Received, or back to awaited: whoever ticks it is recorded with the date. */
    public function receive(Request $request, Letter $letter, LetterRequestedDocument $document)
    {
        $this->owned($letter, $document);

        if ($letter->isCanceled()) {
            $this->toast('Surat ini sudah dibatalkan', 'Dokumennya tidak perlu dilacak lagi.', 'warning');

            return back();
        }

        $document->update($document->isReceived()
            ? ['received_at' => null, 'received_by' => null]
            : ['received_at' => Carbon::now(), 'received_by' => $request->user()->id]);

        return back();
    }

    private function owned(Letter $letter, LetterRequestedDocument $document): void
    {
        abort_unless($document->letter_id === $letter->id, 404);
    }

    private function editable(Letter $letter): void
    {
        if (! $letter->isDraft()) {
            throw ValidationException::withMessages([
                'name' => 'Daftar dokumen hanya bisa diubah selama surat masih draft. Tarik dulu ke draft.',
            ]);
        }
    }
}
