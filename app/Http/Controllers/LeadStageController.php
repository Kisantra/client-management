<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\LeadStageEvent;
use App\Support\Attachments;
use App\Support\Pipeline;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Moving a lead from one stage to the next.
 *
 * Stages that stand for a document — a proposal sent, a contract agreed —
 * cannot be entered without it. The rule is enforced here, not in the screen
 * that offers the move, so neither the board nor the detail page can slip past
 * it.
 */
class LeadStageController extends Controller
{
    public function store(Request $request, Lead $lead)
    {
        // A closed lead has to be reopened before it can move anywhere.
        abort_if($lead->isClosed(), 409);

        $requirement = Pipeline::requirement((string) $request->input('stage'));

        $validated = $request->validate([
            'stage' => ['required', Rule::in(Pipeline::keys()), Rule::notIn([$lead->stage])],
            'files' => [$requirement ? 'required' : 'nullable', 'array', 'max:10'],
            'files.*' => ['file', 'max:10240', 'mimes:jpg,jpeg,png,webp,pdf'],
        ], [
            'stage.not_in' => 'Lead ini sudah ada di tahap tersebut.',
            'files.required' => $requirement
                ? $requirement['label'].' wajib dilampirkan sebelum pindah ke tahap ini.'
                : '',
            'files.*.max' => 'Ukuran berkas maksimal 10 MB.',
            'files.*.mimes' => 'Berkas harus JPG, PNG, WebP, atau PDF.',
        ]);

        $from = Pipeline::label($lead->stage);

        DB::transaction(function () use ($lead, $validated, $requirement, $request) {
            $lead->update([
                'stage' => $validated['stage'],
                'stage_changed_at' => Carbon::today(),
            ]);

            LeadStageEvent::create([
                'lead_id' => $lead->id,
                'stage' => $lead->stage,
                'entered_at' => Carbon::today(),
            ]);

            $files = $request->file('files', []);

            // The evidence needs somewhere to live and something to explain it.
            if ($files !== []) {
                $note = $lead->notes()->create([
                    'author' => $request->user()->name,
                    'body' => 'Pindah ke '.Pipeline::label($lead->stage).'.'
                        .($requirement ? ' '.$requirement['label'].' dilampirkan.' : ''),
                ]);

                Attachments::store($lead, $files, $note, $lead->stage);
            }
        });

        $this->toast(
            $lead->displayName().' pindah ke '.Pipeline::label($lead->stage),
            'Sebelumnya di '.$from.'.',
        );

        return back();
    }
}
