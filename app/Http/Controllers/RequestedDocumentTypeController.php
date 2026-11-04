<?php

namespace App\Http\Controllers;

use App\Models\RequestedDocumentType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * The list a letter's document checklist picks from. An entry is switched
 * off rather than deleted, because letters already sent copied its name.
 */
class RequestedDocumentTypeController extends Controller
{
    public function store(Request $request)
    {
        $validated = $this->validated($request);

        RequestedDocumentType::create([
            'name' => trim($validated['name']),
            'category' => $validated['category'],
            'description' => filled($validated['description'] ?? null) ? trim($validated['description']) : null,
            'sort_order' => (int) RequestedDocumentType::query()->where('category', $validated['category'])->max('sort_order') + 1,
            'is_active' => true,
        ]);

        $this->toast('Jenis dokumen ditambahkan', trim($validated['name']));

        return back();
    }

    public function update(Request $request, RequestedDocumentType $type)
    {
        $validated = $this->validated($request, $type);

        $type->update([
            'name' => trim($validated['name']),
            'category' => $validated['category'],
            'description' => filled($validated['description'] ?? null) ? trim($validated['description']) : null,
            'is_active' => (bool) ($validated['is_active'] ?? $type->is_active),
        ]);

        return back();
    }

    /** Writes whichever starter entries are missing. */
    public function seed()
    {
        $written = RequestedDocumentType::seedDefaults();

        $this->toast(
            $written > 0 ? 'Daftar bawaan dipasang' : 'Semua jenis dokumen bawaan sudah ada',
            $written > 0 ? $written.' jenis dokumen ditambahkan.' : null,
        );

        return back();
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?RequestedDocumentType $type = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:200', Rule::unique('requested_document_types', 'name')->ignore($type?->id)],
            'category' => ['required', Rule::in(array_keys(RequestedDocumentType::CATEGORIES))],
            'description' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ], [
            'name.required' => 'Tulis nama dokumennya.',
            'name.unique' => 'Dokumen dengan nama ini sudah ada.',
        ]);
    }
}
