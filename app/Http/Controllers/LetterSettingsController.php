<?php

namespace App\Http\Controllers;

use App\Models\LetterNumberCounter;
use App\Models\LetterSigner;
use App\Models\LetterTemplate;
use App\Models\RequestedDocumentType;
use App\Support\LetterNumber;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * What every letter draws on and nobody edits per letter: who signs, the
 * documents the office asks for, and where each number sequence stands.
 */
class LetterSettingsController extends Controller
{
    public function index(): Response
    {
        $year = Carbon::today()->year;
        $counters = LetterNumberCounter::query()->where('year', $year)->pluck('last_sequence', 'prefix');

        return Inertia::render('letter-settings', [
            'signers' => LetterSigner::query()->ordered()->get()
                ->map(fn (LetterSigner $signer) => [
                    'id' => $signer->id,
                    'name' => $signer->name,
                    'title' => $signer->title,
                    'isDefault' => $signer->is_default,
                    'active' => $signer->is_active,
                    'hasSignature' => $signer->hasSignature(),
                    'imageVersion' => $signer->updated_at?->timestamp,
                ])
                ->all(),
            'documentTypes' => RequestedDocumentType::query()->ordered()->withCount('requestedDocuments')->get()
                ->map(fn (RequestedDocumentType $type) => [
                    'id' => $type->id,
                    'name' => $type->name,
                    'category' => $type->category,
                    'description' => $type->description,
                    'active' => $type->is_active,
                    'used' => $type->requested_documents_count,
                ])
                ->all(),
            'documentCategories' => RequestedDocumentType::CATEGORIES,
            'missingDocumentTypes' => collect(RequestedDocumentType::defaults())->flatten()
                ->diff(RequestedDocumentType::query()->pluck('name'))
                ->count(),
            /* One row per prefix the templates number with, for this year:
               where the counter stands, and the floor it cannot go below. */
            'counters' => LetterTemplate::query()->ordered()->get()
                ->groupBy('number_prefix')
                ->map(function ($templates, string $prefix) use ($counters, $year) {
                    $highest = LetterNumber::highestIssued($prefix, $year);
                    $last = max((int) ($counters[$prefix] ?? 0), $highest);

                    return [
                        'prefix' => $prefix,
                        'year' => $year,
                        'last' => $last,
                        'highest' => $highest,
                        // The client's initials are only known per letter.
                        'next' => LetterNumber::format($prefix, $last + 1, Carbon::today(), '…'),
                        'templates' => $templates->pluck('name')->all(),
                    ];
                })
                ->values()
                ->all(),
            'numberFormat' => config('letter.number.format'),
        ]);
    }
}
