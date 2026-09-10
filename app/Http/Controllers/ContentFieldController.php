<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Support\ContentPlan;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Setting one field on a piece of content.
 *
 * Two callers, one door. The board sets a single-valued field by dropping a
 * card in another column — the same edit the form makes, reached by moving the
 * card instead of opening it. The panel sets any of them from the record's own
 * line, so correcting one hour no longer costs opening a form over nine fields
 * and replacing the record you were reading.
 *
 * Status is deliberately not one of these. A status change is a step in a flow
 * that gets written into the piece's history, so it keeps its own controller;
 * this one only writes a value.
 *
 * Channel is a field here but never a drop target on the board. A piece goes
 * out on several channels at once and so stands in several of those columns,
 * and dropping it in one more says nothing about the rest — the board leaves
 * those columns read-only, while the panel offers the whole set at once and so
 * can say what it means.
 */
class ContentFieldController extends Controller
{
    /** Field key to the word the toast uses for it. */
    private const LABELS = [
        'pillar' => 'Pillar',
        'type' => 'Jenis konten',
        'owner' => 'Submitted by',
        'channels' => 'Channel',
        'schedule' => 'Jadwal tayang',
        'reference_url' => 'Referensi',
        'url' => 'Tautan',
    ];

    public function store(Request $request, Content $content)
    {
        $field = (string) $request->input('field');

        $validated = $request->validate(
            ['field' => ['required', Rule::in(array_keys(self::LABELS))]] + $this->rulesFor($field),
            $this->messagesFor($field),
        );

        $columns = $this->columnsFor($field, $validated['value'] ?? null);
        $wasMonth = $content->scheduled_for->format('Y-m');

        $content->update($columns);

        $this->toast(
            $content->title.' diperbarui',
            self::LABELS[$field].': '.$this->wordFor($field, $columns).'.',
        );

        /*
         | Moving the date out of the month on screen has to take the calendar
         | with it, or the piece drops off a grid whose panel is still open on
         | it. Every other field leaves you exactly where you were, filters and
         | scroll included.
         */
        return $content->scheduled_for->format('Y-m') === $wasMonth
            ? back()
            : to_route('content', [
                'bulan' => $content->scheduled_for->format('Y-m'),
                'konten' => $content->id,
            ]);
    }

    /**
     * What each field will accept, in the shape the field actually has.
     *
     * The same rules the form checks: two doors into one record must never
     * disagree about what it will take.
     *
     * @return array<string, array<int, mixed>>
     */
    private function rulesFor(string $field): array
    {
        return match ($field) {
            'pillar' => ['value' => ['nullable', Rule::in(array_keys(ContentPlan::pillars()))]],
            'type' => ['value' => ['required', Rule::in(array_keys(ContentPlan::types()))]],
            'owner' => ['value' => ['nullable', 'string', 'max:80']],
            'channels' => [
                'value' => ['required', 'array', 'min:1'],
                'value.*' => [Rule::in(ContentPlan::channelKeys())],
            ],
            /* One line on the record, so one field here: the day, and the hour
               when somebody has settled on one. Sent apart, a cleared hour and
               a moved day would be two edits and two entries in the log for a
               single decision. */
            'schedule' => [
                'value.date' => ['required', 'date'],
                'value.time' => ['nullable', 'date_format:H:i'],
            ],
            'reference_url', 'url' => ['value' => ['nullable', 'url', 'max:255']],
            default => ['value' => ['nullable']],
        };
    }

    /** @return array<string, string> */
    private function messagesFor(string $field): array
    {
        return match ($field) {
            'type' => [
                'value.required' => 'Konten harus punya jenis.',
                'value.in' => 'Jenis konten itu tidak tersedia.',
            ],
            'channels' => [
                'value.required' => 'Pilih minimal satu channel tempat konten ini tayang.',
                'value.min' => 'Pilih minimal satu channel tempat konten ini tayang.',
                'value.*.in' => 'Ada channel yang tidak dikenal.',
            ],
            'schedule' => [
                'value.date.required' => 'Tentukan tanggal tayangnya.',
                'value.date.date' => 'Tanggal tayangnya tidak terbaca.',
                'value.time.date_format' => 'Jam tayang harus dalam format 24 jam, misalnya 09:00.',
            ],
            'reference_url' => ['value.url' => 'Referensi harus berupa alamat lengkap, diawali https://.'],
            'url' => ['value.url' => 'Tautan harus berupa alamat lengkap, diawali https://.'],
            default => ['value.in' => 'Pilihan itu tidak dikenal.'],
        };
    }

    /**
     * The columns one field writes to.
     *
     * @return array<string, mixed>
     */
    private function columnsFor(string $field, mixed $value): array
    {
        return match ($field) {
            'channels' => ['channels' => $value],
            'schedule' => [
                'scheduled_for' => $value['date'],
                'scheduled_time' => ($value['time'] ?? null) ?: null,
            ],
            default => [$field => is_string($value) ? (trim($value) ?: null) : null],
        };
    }

    /** The value as a person reads it, not as the column stores it. */
    private function wordFor(string $field, array $columns): string
    {
        return match ($field) {
            'pillar' => ContentPlan::pillarLabel($columns['pillar']) ?? 'belum ditentukan',
            'type' => ContentPlan::typeLabel($columns['type']),
            'owner' => $columns['owner'] ?? 'belum ditentukan',
            'channels' => collect($columns['channels'])
                ->map(fn (string $channel) => ContentPlan::channelLabel($channel))
                ->join(', '),
            'schedule' => Carbon::parse($columns['scheduled_for'])->format('j/n/Y')
                .($columns['scheduled_time'] ? ', '.str_replace(':', '.', $columns['scheduled_time']) : ''),
            default => $columns[$field] ?? 'belum ada',
        };
    }
}
