<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\LeadStageEvent;
use App\Support\Pipeline;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Stopping a lead, and starting it again.
 *
 * Closing does not move the lead: it keeps the stage it died at, so the funnel
 * can still say where leads are lost. What changes is that its clock stops and
 * it leaves the board.
 */
class LeadClosureController extends Controller
{
    public function store(Request $request, Lead $lead)
    {
        abort_if($lead->isClosed(), 409);

        $validated = $request->validate([
            'reason' => ['required', Rule::in(array_keys(Pipeline::closeReasons()))],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'reason.required' => 'Pilih alasan lead ini tidak dilanjutkan.',
            'reason.in' => 'Alasan itu tidak dikenal.',
        ]);

        $lead->update([
            'status' => Lead::CLOSED,
            'closed_reason' => $validated['reason'],
            'closed_note' => trim((string) ($validated['note'] ?? '')) ?: null,
            'closed_at' => Carbon::today(),
        ]);

        $this->toast(
            $lead->displayName().' ditutup',
            Pipeline::closeReasonLabel($validated['reason'])
                .' · terakhir di tahap '.Pipeline::label($lead->stage).'.',
        );

        return back();
    }

    public function destroy(Request $request, Lead $lead)
    {
        abort_unless($lead->isClosed(), 409);

        $was = Pipeline::closeReasonLabel($lead->closed_reason);

        DB::transaction(function () use ($lead, $request, $was) {
            /*
             | Reopening restarts the clock. A lead parked for three months was
             | not being ignored, so it must not come back already stalled — and
             | the stage gets a fresh entry so its history stays readable.
             */
            $lead->update([
                'status' => Lead::ACTIVE,
                'closed_reason' => null,
                'closed_note' => null,
                'closed_at' => null,
                'stage_changed_at' => Carbon::today(),
            ]);

            LeadStageEvent::create([
                'lead_id' => $lead->id,
                'stage' => $lead->stage,
                'entered_at' => Carbon::today(),
            ]);

            // The only trace the closure leaves once its columns are cleared.
            $lead->notes()->create([
                'author' => $request->user()->name,
                'body' => 'Dibuka lagi. Sebelumnya ditutup dengan alasan: '.strtolower((string) $was).'.',
            ]);
        });

        $this->toast(
            $lead->displayName().' dibuka lagi',
            'Kembali ke tahap '.Pipeline::label($lead->stage).', hitungan harinya mulai dari hari ini.',
        );

        return back();
    }
}
