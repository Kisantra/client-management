<?php

namespace App\Http\Requests;

use App\Support\ContentPlan;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * What a piece of content must carry to be saved: a title, where it goes,
 * in what shape, and when. The brief and the rest can follow.
 */
class ContentRequest extends FormRequest
{
    public function rules(): array
    {
        $channel = (string) $this->input('channel');

        return [
            'title' => ['required', 'string', 'max:140'],
            'channel' => ['required', Rule::in(ContentPlan::channels())],
            // A format only exists inside its channel: no Reels on LinkedIn.
            'format' => ['required', Rule::in(array_keys(ContentPlan::formats($channel)))],
            'scheduled_for' => ['required', 'date'],
            'status' => ['required', Rule::in(ContentPlan::keys())],
            'published_at' => ['nullable', 'date'],
            'owner' => ['nullable', 'string', 'max:80'],
            'brief' => ['nullable', 'string', 'max:3000'],
            'url' => ['nullable', 'url', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Judul konten wajib diisi.',
            'channel.required' => 'Pilih channel tempat konten ini tayang.',
            'channel.in' => 'Channel itu tidak menerbitkan konten.',
            'format.required' => 'Pilih format kontennya.',
            'format.in' => 'Format itu tidak tersedia di channel yang dipilih.',
            'scheduled_for.required' => 'Tentukan tanggal tayangnya.',
            'url.url' => 'Tautan harus berupa alamat lengkap, diawali https://.',
        ];
    }

    /** @return array<string, mixed> */
    public function columns(): array
    {
        return collect($this->validated())
            ->map(fn ($value) => is_string($value) ? trim($value) : $value)
            ->all();
    }
}
