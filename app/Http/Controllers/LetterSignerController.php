<?php

namespace App\Http\Controllers;

use App\Models\LetterSigner;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * The people who sign for the office, and their signature images.
 *
 * A signer is never deleted, only switched off: letters already issued
 * name them. A new image is stored beside the old one rather than over it,
 * because an issued letter froze the path it was signed with.
 */
class LetterSignerController extends Controller
{
    public function store(Request $request)
    {
        $validated = $this->validated($request);

        DB::transaction(function () use ($validated, $request) {
            $signer = LetterSigner::create([
                'name' => trim($validated['name']),
                'title' => trim($validated['title']),
                'signature_path' => $this->storeImage($request->file('signature')),
                'is_default' => (bool) ($validated['is_default'] ?? false),
                'is_active' => true,
                'sort_order' => (int) LetterSigner::query()->max('sort_order') + 1,
            ]);

            $this->keepOneDefault($signer);
        });

        $this->toast('Penanda tangan ditambahkan', trim($validated['name']));

        return back();
    }

    public function update(Request $request, LetterSigner $signer)
    {
        $validated = $this->validated($request, updating: true);

        DB::transaction(function () use ($validated, $request, $signer) {
            $path = $request->hasFile('signature')
                ? $this->storeImage($request->file('signature'))
                : ($request->boolean('remove_signature') ? null : $signer->signature_path);

            $signer->update([
                'name' => trim($validated['name']),
                'title' => trim($validated['title']),
                'signature_path' => $path,
                'is_default' => (bool) ($validated['is_default'] ?? false),
                'is_active' => (bool) ($validated['is_active'] ?? true),
            ]);

            $this->keepOneDefault($signer);
        });

        $this->toast('Penanda tangan disimpan', 'Draft yang memakainya ikut berubah; surat yang sudah terbit tidak.');

        return back();
    }

    /** The image itself, for the settings page; it is not on the public disk. */
    public function image(LetterSigner $signer): BinaryFileResponse
    {
        $file = LetterSigner::fileFor($signer->signature_path);

        abort_if($file === null, 404);

        return response()->file($file, ['Cache-Control' => 'private, max-age=300']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, bool $updating = false): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'title' => ['required', 'string', 'max:120'],
            'signature' => ['nullable', 'image', 'mimes:png,jpg,jpeg', 'max:1024'],
            'is_default' => ['sometimes', 'boolean'],
            'is_active' => [$updating ? 'sometimes' : 'prohibited', 'boolean'],
            'remove_signature' => ['sometimes', 'boolean'],
        ], [
            'name.required' => 'Tulis nama penanda tangan.',
            'title.required' => 'Tulis jabatannya, misalnya Direktur.',
            'signature.image' => 'Tanda tangan harus berupa gambar PNG atau JPG.',
            'signature.max' => 'Ukuran gambar maksimal 1 MB.',
        ]);
    }

    private function storeImage(?UploadedFile $file): ?string
    {
        return $file?->store(LetterSigner::DIR, LetterSigner::DISK) ?: null;
    }

    /** One default at most, and a switched-off signer is never it. */
    private function keepOneDefault(LetterSigner $signer): void
    {
        if (! $signer->is_active && $signer->is_default) {
            $signer->update(['is_default' => false]);
        }

        if ($signer->is_default) {
            LetterSigner::query()->whereKeyNot($signer->id)->where('is_default', true)->update(['is_default' => false]);
        }
    }
}
