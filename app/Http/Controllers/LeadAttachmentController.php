<?php

namespace App\Http\Controllers;

use App\Models\Lead;
use App\Models\LeadAttachment;
use App\Support\Attachments;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** A lead's file, opened by somebody signed in. */
class LeadAttachmentController extends Controller
{
    public function show(Lead $lead, LeadAttachment $attachment): StreamedResponse
    {
        abort_unless($attachment->lead_id === $lead->id, 404);

        return Attachments::inline($attachment);
    }
}
