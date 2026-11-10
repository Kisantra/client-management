<?php

namespace App\Http\Controllers;

use App\Models\Handoff;
use App\Models\Lead;
use App\Support\ProjectManagement;
use Illuminate\Http\RedirectResponse;

/**
 * "Kirim ke Project Management", pressed by hand.
 *
 * For a send that ran out of tries, and for deals signed before the two apps
 * were connected, which never had a reason to be sent. The job decides what to
 * say from the lead as it stands, so this never needs to know which it is.
 */
class LeadHandoffController extends Controller
{
    public function store(Lead $lead): RedirectResponse
    {
        abort_unless(ProjectManagement::enabled(), 404);
        abort_unless($lead->isSigned() || $lead->handoff()->exists(), 409);

        $again = $lead->handoff()->exists();

        Handoff::queue($lead);

        $this->toast(
            $again ? 'Dikirim ulang ke Project Management' : 'Dikirim ke Project Management',
            'Statusnya diperbarui di panel Project Management begitu ada jawaban.',
        );

        return back();
    }
}
