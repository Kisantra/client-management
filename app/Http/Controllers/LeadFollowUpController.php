<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\LeadFollowUp;
use App\Support\Pipeline;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * Contact scheduled between stage moves.
 *
 * A follow-up does not move the lead — it is the reason it will move later, and
 * marking one done is the only thing that updates when the client was last
 * spoken to.
 */
class LeadFollowUpController extends Controller
{
    public function store(Request $request, Lead $lead)
    {
        // Nothing is scheduled for a lead that has stopped.
        abort_if($lead->isClosed(), 409);

        $validated = $request->validate([
            'scheduled_for' => ['required', 'date', 'after_or_equal:today'],
            'via' => ['required', Rule::in(Pipeline::followUpVia())],
            'note' => ['nullable', 'string', 'max:500'],
        ], [
            'scheduled_for.after_or_equal' => 'Follow-up dijadwalkan untuk hari ini atau setelahnya.',
            'via.in' => 'Cara follow-up itu tidak dikenal.',
        ]);

        $lead->followUps()->create([
            'scheduled_for' => $validated['scheduled_for'],
            'via' => $validated['via'],
            'note' => trim((string) ($validated['note'] ?? '')) ?: 'Follow-up terjadwal.',
            'done' => false,
        ]);

        $this->toast(
            'Follow-up dijadwalkan',
            Carbon::parse($validated['scheduled_for'])->translatedFormat('j F Y').' lewat '.$validated['via'].'.',
        );

        return back();
    }

    public function update(Request $request, Lead $lead, LeadFollowUp $followUp)
    {
        abort_unless($followUp->lead_id === $lead->id, 404);

        $done = $request->boolean('done');

        $followUp->update(['done' => $done]);

        // A follow-up carried out is the freshest contact this lead has had.
        if ($done && $followUp->scheduled_for->lte(Carbon::today())) {
            $lead->update(['last_contact_at' => Carbon::today()]);
        }

        $this->toast($done ? 'Follow-up ditandai selesai' : 'Follow-up dibuka lagi');

        return back();
    }

    public function destroy(Lead $lead, LeadFollowUp $followUp)
    {
        abort_unless($followUp->lead_id === $lead->id, 404);

        $followUp->delete();

        $this->toast('Follow-up dihapus');

        return back();
    }
}
