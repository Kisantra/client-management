<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Handoff;
use App\Models\Lead;
use App\Models\LeadStageEvent;
use App\Support\Pipeline;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Project Management saying the tax team has processed the client: checked
 * it, made or linked the client, and opened its project.
 *
 * A lead still at Deal moves to Client aktif on the spot: the project exists,
 * so the work has started. The marketer can still move it by hand before this
 * arrives; then this only records who processed it. A deal that came off in
 * the meantime is not revived by it.
 */
class HandoffCompletionController extends Controller
{
    public function store(Request $request, Lead $lead): JsonResponse
    {
        $handoff = $lead->handoff;

        abort_if($handoff === null, 404);

        $data = $request->validate([
            'status' => ['required', Rule::in(['completed'])],
            'pm_client_id' => ['nullable', 'integer'],
            'completed_by' => ['nullable', 'string', 'max:120'],
            'completed_at' => ['nullable', 'date'],
            'client_url' => ['nullable', 'url', 'max:255'],
            'matched' => ['nullable', 'boolean'],
            'project_name' => ['nullable', 'string', 'max:255'],
            'project_url' => ['nullable', 'url', 'max:255'],
        ]);

        DB::transaction(function () use ($lead, $handoff, $data) {
            $handoff->update([
                'status' => $lead->isSigned() ? Handoff::COMPLETED : $handoff->status,
                // Project Management sends its own offset; the column holds this app's time.
                'completed_at' => isset($data['completed_at'])
                    ? Carbon::parse($data['completed_at'])->setTimezone(config('app.timezone'))
                    : now(),
                'completed_by' => $data['completed_by'] ?? null,
                'pm_client_id' => $data['pm_client_id'] ?? $handoff->pm_client_id,
                'pm_client_url' => $data['client_url'] ?? $handoff->pm_client_url,
                'matched' => (bool) ($data['matched'] ?? $handoff->matched),
                'pm_project_name' => $data['project_name'] ?? $handoff->pm_project_name,
                'pm_project_url' => $data['project_url'] ?? $handoff->pm_project_url,
                'error' => null,
            ]);

            if ($lead->isClosed() || $lead->stage !== 'deal') {
                return;
            }

            $lead->update([
                'stage' => 'client',
                'stage_changed_at' => Carbon::today(),
            ]);

            LeadStageEvent::create([
                'lead_id' => $lead->id,
                'stage' => 'client',
                'entered_at' => Carbon::today(),
            ]);

            $project = filled($data['project_name'] ?? null) ? ' Proyek "'.$data['project_name'].'" sudah dibuat' : ' Client sudah diproses';

            $lead->notes()->create([
                'author' => 'Project Management',
                'body' => 'Pindah otomatis ke '.Pipeline::label('client').'.'.$project.' di Project Management'
                    .(filled($data['completed_by'] ?? null) ? ' oleh '.$data['completed_by'] : '').'.',
            ]);
        });

        return response()->json(['ok' => true, 'stage' => $lead->stage]);
    }
}
