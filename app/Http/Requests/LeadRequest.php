<?php

namespace App\Http\Requests;

use App\Support\Pipeline;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * What a lead must carry to be saved.
 *
 * Only the four facts the form calls mandatory are required here too — name,
 * PIC, where it came from, and what it wants — so a lead taken down mid-call
 * never has to wait for details nobody has yet.
 */
class LeadRequest extends FormRequest
{
    public function rules(): array
    {
        return [
            'entity' => ['required', Rule::in(['PT', 'CV', 'UD', 'Koperasi', 'Perorangan'])],
            'company' => ['required', 'string', 'max:120'],
            'pic' => ['required', 'string', 'max:80'],
            'pic_role' => ['nullable', 'string', 'max:80'],
            'phone' => ['nullable', 'string', 'max:40'],
            'email' => ['nullable', 'email', 'max:120'],
            'npwp' => ['nullable', 'string', 'max:30'],

            'address' => ['nullable', 'string', 'max:200'],
            'city' => ['nullable', 'string', 'max:80'],
            'office_lat' => ['nullable', 'numeric', 'between:-90,90', 'required_with:office_lng'],
            'office_lng' => ['nullable', 'numeric', 'between:-180,180', 'required_with:office_lat'],

            'channel' => ['required', Rule::in(array_keys(Pipeline::channels()))],
            'source' => ['nullable', 'string', 'max:120'],
            'entered_at' => ['required', 'date', 'before_or_equal:today'],

            'service' => ['required', 'string', 'max:80'],
            'value' => ['nullable', 'integer', 'min:0', 'max:1000000000000'],
            'note' => ['nullable', 'string', 'max:2000'],

            'stage' => ['required', Rule::in(Pipeline::keys())],
            'owner' => ['nullable', 'string', 'max:80'],

            'files' => ['nullable', 'array', 'max:10'],
            'files.*' => ['file', 'max:10240', 'mimes:jpg,jpeg,png,webp,pdf'],
        ];
    }

    public function messages(): array
    {
        return [
            'company.required' => 'Nama client wajib diisi.',
            'pic.required' => 'Sebutkan siapa yang dihubungi di sisi client.',
            'channel.required' => 'Pilih dari mana lead ini datang.',
            'channel.in' => 'Channel itu tidak dikenal.',
            'service.required' => 'Pilih layanan yang ditanyakan.',
            'email.email' => 'Format email belum benar.',
            'entered_at.before_or_equal' => 'Tanggal masuk tidak boleh di masa depan.',
            'files.*.max' => 'Ukuran berkas maksimal 10 MB.',
            'files.*.mimes' => 'Berkas harus JPG, PNG, WebP, atau PDF.',
        ];
    }

    /** The lead's own columns, without the pieces that are stored elsewhere. */
    public function columns(): array
    {
        return collect($this->validated())
            ->except(['files', 'note'])
            ->put('value', (int) $this->input('value', 0))
            ->all();
    }
}
