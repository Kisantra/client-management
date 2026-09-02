<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Support\ContentPlan;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * Setting one field on a piece of content, from the board.
 *
 * The board can be grouped by any single-valued field, and a card dropped in
 * another column means exactly one thing: that field now holds that column's
 * value. It is the same edit the form makes, reached by moving the card
 * instead of opening it.
 *
 * Status is deliberately not one of these. A status change is a step in a
 * flow that gets recorded in the piece's history, so it keeps its own
 * controller; this one only writes a value.
 *
 * Channel is not one either. A piece goes out on several channels at once, so
 * it stands in several of those columns, and dropping it in one more says
 * nothing about the others — the board leaves those columns unmoveable and
 * the form does the editing.
 */
class ContentFieldController extends Controller
{
    /** Field key to the word the toast uses for it. */
    private const LABELS = [
        'pillar' => 'Pillar',
        'type' => 'Jenis konten',
        'owner' => 'Submitted by',
    ];

    public function store(Request $request, Content $content)
    {
        $field = (string) $request->input('field');

        $validated = $request->validate([
            'field' => ['required', Rule::in(array_keys(self::LABELS))],
            'value' => match ($field) {
                'pillar' => ['nullable', Rule::in(array_keys(ContentPlan::pillars()))],
                'type' => ['required', Rule::in(array_keys(ContentPlan::types()))],
                'owner' => ['nullable', 'string', 'max:80'],
                default => ['nullable'],
            },
        ], [
            'value.required' => 'Konten harus punya jenis.',
            'value.in' => 'Pilihan itu tidak dikenal.',
        ]);

        $value = is_string($validated['value'] ?? null)
            ? (trim($validated['value']) ?: null)
            : null;

        $content->update([$field => $value]);

        $this->toast(
            $content->title.' diperbarui',
            self::LABELS[$field].': '.($value === null
                ? 'belum ditentukan'
                : $this->wordFor($field, $value)).'.',
        );

        return back();
    }

    /** The value as a person reads it, not as the column stores it. */
    private function wordFor(string $field, string $value): string
    {
        return match ($field) {
            'pillar' => ContentPlan::pillarLabel($value) ?? $value,
            'type' => ContentPlan::typeLabel($value),
            default => $value,
        };
    }
}
