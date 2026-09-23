<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\Letter;
use App\Models\LetterTemplate;
use App\Support\LetterNumber;
use App\Support\LetterRenderer;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Surat keluar: letters written here, on the letterhead, from a template.
 *
 * A letter is drafted against a lead, filled in on the left while the page
 * takes shape on the right, then issued — which numbers it and freezes its
 * words — and downloaded as the PDF that actually gets sent. The draft
 * saves itself as it is typed, so nothing is lost to a closed tab and the
 * preview is always of what is on record.
 */
class LetterController extends Controller
{
    private const PER_PAGE = 20;

    public function index(Request $request): Response
    {
        $status = (string) $request->query('status', 'semua');
        $status = array_key_exists($status, Letter::STATUS_LABELS) ? $status : 'semua';
        $q = trim((string) $request->query('q', ''));

        $matching = Letter::query()
            ->with(['template', 'lead', 'creator'])
            ->when($q !== '', fn (Builder $query) => $query->where(function (Builder $where) use ($q) {
                $like = '%'.$q.'%';
                $where->where('subject', 'like', $like)
                    ->orWhere('number', 'like', $like)
                    ->orWhereHas('lead', fn (Builder $lead) => $lead->where('company', 'like', $like));
            }));

        $counts = (clone $matching)
            ->toBase()
            ->selectRaw('status, count(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $page = (clone $matching)
            ->status($status === 'semua' ? null : $status)
            ->orderByDesc('letter_date')
            ->orderByDesc('id')
            ->paginate(self::PER_PAGE)
            ->withQueryString();

        return Inertia::render('letters', [
            'filters' => ['status' => $status, 'q' => $q],
            'statuses' => collect(Letter::STATUS_LABELS)
                ->map(fn (string $label, string $key) => [
                    'key' => $key,
                    'label' => $label,
                    'count' => (int) ($counts[$key] ?? 0),
                ])
                ->values()
                ->all(),
            'total' => (int) $counts->sum(),
            'rows' => [
                'data' => collect($page->items())->map->toRow()->all(),
                'from' => $page->firstItem() ?? 0,
                'to' => $page->lastItem() ?? 0,
                'total' => $page->total(),
                'current' => $page->currentPage(),
                'last' => $page->lastPage(),
            ],
            'hasTemplates' => LetterTemplate::active()->exists(),
        ]);
    }

    public function create(Request $request): Response
    {
        $leadId = (int) $request->query('lead', 0);

        return Inertia::render('letter-create', [
            'templates' => LetterTemplate::active()->ordered()->get()
                ->map(fn (LetterTemplate $template) => [
                    'id' => $template->id,
                    'name' => $template->name,
                    'description' => $template->description,
                    'prefix' => $template->number_prefix,
                    'subject' => $template->subject,
                ])
                ->all(),
            /* Every lead still in play, so a letter can go to a prospect as
               well as to a signed client. A closed lead is not written to. */
            'leads' => Lead::query()->active()->orderBy('company')->get()
                ->map(fn (Lead $lead) => [
                    'id' => $lead->id,
                    'name' => $lead->displayName(),
                    'pic' => $lead->pic,
                    'service' => $lead->service,
                    'stage' => $lead->stage,
                ])
                ->all(),
            'leadId' => $leadId > 0 && Lead::query()->active()->whereKey($leadId)->exists() ? $leadId : null,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'template_id' => ['required', 'integer', Rule::exists('letter_templates', 'id')->where('is_active', true)],
            'lead_id' => ['required', 'integer', Rule::exists('leads', 'id')->where('status', Lead::ACTIVE)],
        ], [
            'template_id.required' => 'Pilih jenis suratnya dulu.',
            'lead_id.required' => 'Pilih client yang dituju.',
        ]);

        $template = LetterTemplate::findOrFail($validated['template_id']);
        $lead = Lead::findOrFail($validated['lead_id']);

        $letter = Letter::create([
            'letter_template_id' => $template->id,
            'lead_id' => $lead->id,
            'created_by' => $request->user()->id,
            'letter_date' => Carbon::today(),
            'subject' => $template->subject,
            'recipient' => $template->recipient,
            'values' => $template->defaultValues(),
            'signer_name' => config('letter.signer.name'),
            'signer_title' => config('letter.signer.title'),
            'status' => Letter::DRAFT,
        ]);

        $this->toast(
            'Draft surat dibuat',
            $template->name.' untuk '.$lead->displayName().'. Isi poin-poinnya, lalu terbitkan.',
        );

        return to_route('letters.show', $letter);
    }

    public function show(Letter $letter): Response
    {
        $letter->load(['template', 'lead', 'creator']);

        return Inertia::render('letter-edit', [
            'letter' => $this->detail($letter),
            'fields' => array_values($letter->template->fieldDefinitions()),
            'preview' => [
                'html' => LetterRenderer::document($letter),
                'css' => LetterRenderer::styles(),
            ],
            'missing' => LetterRenderer::missing($letter),
            'total' => LetterRenderer::total($letter),
            /* What the number will be, so the writer sees it before it is
               spent. Drawn for real only when the letter is issued. */
            'nextNumber' => $letter->number ?? LetterNumber::preview(
                $letter->template->number_prefix,
                $letter->letter_date,
                $letter->lead->company,
            ),
        ]);
    }

    public function update(Request $request, Letter $letter)
    {
        if (! $letter->isDraft()) {
            $this->toast('Surat ini sudah terbit', 'Tarik dulu ke draft kalau masih ada yang mau diubah.', 'warning');

            return back();
        }

        $letter->load('template');
        $fields = $letter->template->fieldDefinitions();

        $validated = $request->validate([
            'subject' => ['required', 'string', 'max:200'],
            'recipient' => ['required', 'string', 'max:200'],
            'letter_date' => ['required', 'date'],
            'signer_name' => ['required', 'string', 'max:120'],
            'signer_title' => ['required', 'string', 'max:120'],
            'values' => ['present', 'array'],
            ...$this->valueRules($fields),
        ], [
            'subject.required' => 'Perihal tidak boleh kosong.',
            'recipient.required' => 'Tujuan surat tidak boleh kosong.',
            'signer_name.required' => 'Sebutkan siapa yang menandatangani.',
        ]);

        $letter->update([
            ...collect($validated)->except('values')->all(),
            'values' => $this->cleanValues($fields, $validated['values']),
        ]);

        return back();
    }

    public function destroy(Letter $letter)
    {
        if (! $letter->canBeDeleted()) {
            $this->toast('Surat bernomor tidak bisa dihapus', 'Batalkan saja, supaya nomornya tetap tercatat.', 'warning');

            return back();
        }

        $subject = $letter->subject;
        $letter->delete();

        $this->toast('Draft dihapus', $subject);

        return to_route('letters');
    }

    /**
     * @return array<string, mixed>
     */
    private function detail(Letter $letter): array
    {
        return [
            'id' => $letter->id,
            'number' => $letter->number,
            'status' => $letter->status,
            'statusLabel' => $letter->statusLabel(),
            'subject' => $letter->subject,
            'recipient' => $letter->recipient,
            'date' => $letter->letter_date->toDateString(),
            'signerName' => $letter->signer_name,
            'signerTitle' => $letter->signer_title,
            'values' => (object) ($letter->values ?? []),
            'issuedAt' => $letter->issued_at?->toDateString(),
            'author' => $letter->creator?->name,
            'canDelete' => $letter->canBeDeleted(),
            'template' => ['id' => $letter->template->id, 'name' => $letter->template->name],
            'client' => [
                'id' => $letter->lead->id,
                'name' => $letter->clientName(),
                'pic' => $letter->lead->pic,
            ],
        ];
    }

    /**
     * Rules for the template's own fields. A draft may be saved half done —
     * required is checked at issue — so these only guard the shape.
     *
     * @param  array<string, array<string, mixed>>  $fields
     * @return array<string, array<int, mixed>>
     */
    private function valueRules(array $fields): array
    {
        $rules = [];

        foreach ($fields as $key => $field) {
            $rules["values.$key"] = match ($field['type']) {
                'items' => ['nullable', 'array', 'max:26'],
                'select' => ['nullable', 'string', Rule::in(array_keys($field['options']))],
                'date' => ['nullable', 'date'],
                'list', 'textarea' => ['nullable', 'string', 'max:5000'],
                default => ['nullable', 'string', 'max:500'],
            };

            if ($field['type'] === 'items') {
                $rules["values.$key.*.title"] = ['nullable', 'string', 'max:160'];
                $rules["values.$key.*.rows"] = ['nullable', 'array', 'max:50'];
                $rules["values.$key.*.rows.*.name"] = ['nullable', 'string', 'max:200'];
                $rules["values.$key.*.rows.*.amount"] = ['nullable'];
            }
        }

        return $rules;
    }

    /**
     * Values as they are stored: strings trimmed, amounts as integers, and
     * nothing the template did not ask for.
     *
     * @param  array<string, array<string, mixed>>  $fields
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function cleanValues(array $fields, array $values): array
    {
        $clean = [];

        foreach ($fields as $key => $field) {
            $value = $values[$key] ?? null;

            $clean[$key] = match ($field['type']) {
                'items' => collect((array) $value)->values()->map(fn ($section) => [
                    'title' => trim((string) ($section['title'] ?? '')),
                    'rows' => collect((array) ($section['rows'] ?? []))->values()->map(fn ($row) => [
                        'name' => trim((string) ($row['name'] ?? '')),
                        'amount' => (int) preg_replace('/\D+/', '', (string) ($row['amount'] ?? '')),
                    ])->all(),
                ])->all(),
                default => is_string($value) ? (trim($value) === '' ? null : trim($value)) : $value,
            };
        }

        return $clean;
    }
}
