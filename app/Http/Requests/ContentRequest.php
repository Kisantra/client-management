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

            /*
             | Where it went live, one address per channel. Keyed by channel
             | because a piece on Instagram and TikTok has two addresses and
             | "the link" is otherwise a question with two answers. The key
             | list is the rule: an address filed under a channel that does not
             | exist is a typo, not a value.
             */
            'links' => ['nullable', 'array:'.implode(',', ContentPlan::channelKeys())],
            'links.*' => ['nullable', 'url', 'max:255'],

            // The backlog entry this piece grew out of, when it did.
            'idea_id' => ['nullable', 'integer', Rule::exists('content_ideas', 'id')],
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
            'links.array' => 'Ada channel yang tidak dikenal di daftar tautan.',
            'links.*.url' => 'Tautan harus berupa alamat lengkap, diawali https://.',
            'reference_url.url' => 'Referensi harus berupa alamat lengkap, diawali https://.',
        ];
    }

    /**
     * The addresses, cleaned: blanks dropped rather than stored as empty rows.
     *
     * Clearing a field means the piece has no link on that channel, and the
     * honest record of that is no row at all.
     *
     * @return array<string, string>
     */
    public function links(): array
    {
        return collect($this->validated('links') ?? [])
            ->map(fn (?string $url) => trim((string) $url))
            ->filter()
            ->all();
    }

    /** @return array<string, mixed> */
    public function columns(): array
    {
        return collect($this->validated())
            ->except(['idea_id', 'links'])
            ->map(fn ($value) => is_string($value) ? trim($value) : $value)
            ->all();
    }
}
