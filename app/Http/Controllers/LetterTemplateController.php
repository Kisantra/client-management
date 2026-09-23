<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\Letter;
use App\Models\LetterTemplate;
use App\Support\LetterRenderer;
use App\Support\Pipeline;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The wording of each kind of letter, edited in place.
 *
 * What the office changes here is the words: the paragraphs, the default
 * Perihal, who a letter is addressed to, and what each blank is called and
 * starts as. What a blank *is* — a paragraph, a list, a fee table — is set
 * by the built-in template, so a letter's shape cannot be broken from here.
 */
class LetterTemplateController extends Controller
{
    public function index(): Response
    {
        $templates = LetterTemplate::query()
            ->ordered()
            ->withCount('letters')
            ->get()
            ->map(fn (LetterTemplate $template) => [
                'id' => $template->id,
                'code' => $template->code,
                'name' => $template->name,
                'description' => $template->description,
                'prefix' => $template->number_prefix,
                'subject' => $template->subject,
                'active' => $template->is_active,
                'letters' => $template->letters_count,
                'fields' => count($template->fieldDefinitions()),
            ])
            ->all();

        return Inertia::render('letter-templates', [
            'templates' => $templates,
            'missingDefaults' => collect(LetterTemplate::defaults())
                ->pluck('code')
                ->diff(LetterTemplate::query()->pluck('code'))
                ->count(),
        ]);
    }

    public function edit(LetterTemplate $template): Response
    {
        return Inertia::render('letter-template-edit', [
            'template' => [
                'id' => $template->id,
                'code' => $template->code,
                'name' => $template->name,
                'description' => $template->description,
                'prefix' => $template->number_prefix,
                'subject' => $template->subject,
                'recipient' => $template->recipient,
                'stageOnIssue' => $template->stage_on_issue,
                'body' => $template->body,
                'active' => $template->is_active,
                'fields' => array_values($template->fieldDefinitions()),
                'hasDefault' => collect(LetterTemplate::defaults())->contains('code', $template->code),
                'letters' => $template->letters()->count(),
            ],
            'placeholders' => LetterRenderer::placeholderReference($template),
            'fieldTypes' => LetterTemplate::FIELD_TYPES,
            'preview' => [
                'html' => LetterRenderer::document($this->sample($template)),
                'css' => LetterRenderer::styles(),
            ],
        ]);
    }

    public function update(Request $request, LetterTemplate $template)
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'number_prefix' => ['required', 'string', 'max:8', 'regex:/^[A-Za-z]+$/'],
            'subject' => ['required', 'string', 'max:200'],
            'recipient' => ['required', 'string', 'max:200'],
            'stage_on_issue' => ['nullable', Rule::in(Pipeline::keys())],
            'body' => ['required', 'string', 'max:20000'],
            'is_active' => ['required', 'boolean'],
            'fields' => ['present', 'array'],
            'fields.*.key' => ['required', 'string'],
            'fields.*.label' => ['required', 'string', 'max:120'],
            'fields.*.help' => ['nullable', 'string', 'max:300'],
            'fields.*.placeholder' => ['nullable', 'string', 'max:200'],
            'fields.*.required' => ['required', 'boolean'],
            'fields.*.default' => ['nullable'],
        ], [
            'name.required' => 'Beri nama jenis suratnya.',
            'number_prefix.regex' => 'Awalan nomor hanya huruf, misalnya PEN atau S.',
            'body.required' => 'Isi suratnya tidak boleh kosong.',
        ]);

        /*
         | The editor sends back the words of each field; its type, options
         | and wiring come from what is already stored, so nothing here can
         | turn a fee table into a text box.
         */
        $existing = $template->fieldDefinitions();
        $fields = collect($validated['fields'])
            ->filter(fn (array $field) => isset($existing[$field['key']]))
            ->map(fn (array $field) => [
                ...$existing[$field['key']],
                'label' => trim($field['label']),
                'help' => filled($field['help'] ?? null) ? trim($field['help']) : null,
                'placeholder' => filled($field['placeholder'] ?? null) ? trim($field['placeholder']) : null,
                'required' => (bool) $field['required'],
                'default' => $this->defaultFor($existing[$field['key']], $field['default'] ?? null),
            ])
            ->values()
            ->all();

        $template->update([
            'name' => trim($validated['name']),
            'description' => filled($validated['description'] ?? null) ? trim($validated['description']) : null,
            'number_prefix' => strtoupper($validated['number_prefix']),
            'subject' => trim($validated['subject']),
            'recipient' => trim($validated['recipient']),
            'stage_on_issue' => $validated['stage_on_issue'] ?? null,
            'body' => trim($validated['body']),
            'is_active' => $validated['is_active'],
            'fields' => $fields,
        ]);

        $this->toast('Template tersimpan', 'Surat baru memakai redaksi ini; surat yang sudah terbit tidak berubah.');

        return back();
    }

    public function restore(LetterTemplate $template)
    {
        if (! $template->restoreDefault()) {
            $this->toast('Template ini tidak punya redaksi bawaan', null, 'warning');

            return back();
        }

        $this->toast('Redaksi bawaan dipulihkan', $template->name);

        return back();
    }

    /** Writes whichever built-in templates are missing, for a fresh install. */
    public function seed()
    {
        $written = LetterTemplate::seedDefaults();

        $this->toast(
            $written > 0 ? 'Template bawaan dipasang' : 'Semua template bawaan sudah ada',
            $written > 0 ? $written.' template ditambahkan.' : null,
        );

        return back();
    }

    /** A default value in the shape its field stores. */
    private function defaultFor(array $field, mixed $raw): mixed
    {
        return match ($field['type']) {
            'items' => collect((array) $raw)->values()->map(fn ($section) => [
                'title' => trim((string) (is_array($section) ? ($section['title'] ?? '') : '')),
                'rows' => collect((array) (is_array($section) ? ($section['rows'] ?? []) : []))->values()->map(fn ($row) => [
                    'name' => trim((string) (is_array($row) ? ($row['name'] ?? '') : '')),
                    'amount' => (int) preg_replace('/\D+/', '', (string) (is_array($row) ? ($row['amount'] ?? '') : '')),
                ])->all(),
            ])->all(),
            'select' => is_string($raw) && array_key_exists($raw, $field['options']) ? $raw : null,
            default => is_string($raw) && trim($raw) !== '' ? trim($raw) : null,
        };
    }

    /**
     * A letter that exists only to show what the template looks like filled
     * in: the first lead on the books, or a stand-in when there is none.
     */
    private function sample(LetterTemplate $template): Letter
    {
        $lead = Lead::query()->active()->orderBy('company')->first()
            ?? new Lead([
                'entity' => 'PT',
                'company' => 'Contoh Client',
                'pic' => 'Nama PIC',
                'service' => 'Konsultasi Umum',
            ]);

        $letter = new Letter([
            'letter_date' => Carbon::today(),
            'subject' => $template->subject,
            'recipient' => $template->recipient,
            'values' => $template->defaultValues(),
            'signer_name' => config('letter.signer.name'),
            'signer_title' => config('letter.signer.title'),
            'status' => Letter::DRAFT,
        ]);

        $letter->setRelation('template', $template);
        $letter->setRelation('lead', $lead);

        return $letter;
    }
}
