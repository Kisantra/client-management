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
        return [
            'title' => ['required', 'string', 'max:140'],
            // One piece, one or more channels.
            'channels' => ['required', 'array', 'min:1'],
            'channels.*' => [Rule::in(ContentPlan::channelKeys())],
            'pillar' => ['nullable', Rule::in(array_keys(ContentPlan::pillars()))],
            'type' => ['required', Rule::in(array_keys(ContentPlan::types()))],
            'scheduled_for' => ['required', 'date'],
            // Optional: a date can be fixed before the hour is.
            'scheduled_time' => ['nullable', 'date_format:H:i'],
            'status' => ['required', Rule::in(ContentPlan::keys())],
            'published_at' => ['nullable', 'date'],
            'owner' => ['nullable', 'string', 'max:80'],
            'brief' => ['nullable', 'string', 'max:3000'],
            'reference_url' => ['nullable', 'url', 'max:255'],
            'caption' => ['nullable', 'string', 'max:8000'],
            'url' => ['nullable', 'url', 'max:255'],
        ];
    }

    public function messages(): array
    {
        return [
            'title.required' => 'Judul konten wajib diisi.',
            'channels.required' => 'Pilih minimal satu channel tempat konten ini tayang.',
            'channels.min' => 'Pilih minimal satu channel tempat konten ini tayang.',
            'channels.*.in' => 'Ada channel yang tidak dikenal.',
            'type.required' => 'Pilih jenis kontennya.',
            'type.in' => 'Jenis konten itu tidak tersedia.',
            'pillar.in' => 'Pillar itu tidak dikenal.',
            'scheduled_for.required' => 'Tentukan tanggal tayangnya.',
            'scheduled_time.date_format' => 'Jam tayang harus dalam format 24 jam, misalnya 09:00.',
            'url.url' => 'Tautan harus berupa alamat lengkap, diawali https://.',
            'reference_url.url' => 'Referensi harus berupa alamat lengkap, diawali https://.',
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
