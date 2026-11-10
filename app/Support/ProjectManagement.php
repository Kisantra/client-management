<?php

namespace App\Support;

use App\Models\Lead;
use App\Models\LeadStageEvent;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;

/**
 * The line to Project Management, where the tax team runs client work.
 *
 * What crosses over is what that team needs to set the client and its project
 * up: who the client is, how to reach them, what was sold, for how much, and
 * who sold it. Where the lead came from and the marketing notes stay here —
 * they are this team's working file, not the client's record. Files are not
 * pushed; Project Management fetches them through this app's API when the tax
 * team processes the client, and keeps the ones it wants.
 */
class ProjectManagement
{
    /** Both halves set, or the integration is off and nothing is sent. */
    public static function enabled(): bool
    {
        return filled(config('services.project_management.url'))
            && filled(config('services.project_management.token'));
    }

    /** Whether a request from Project Management carries the shared token. */
    public static function accepts(?string $token): bool
    {
        $expected = (string) config('services.project_management.token');

        return $expected !== '' && $token !== null && hash_equals($expected, $token);
    }

    /**
     * Hands the client over. Project Management queues it for the tax team to
     * check; the client and its project are made there, later. Sending the
     * same lead again is safe: it keys on the lead id and answers with what it
     * already has.
     *
     * @return array<string, mixed> intake_id, status, completed, pm_client_id, client_url
     */
    public static function intake(Lead $lead): array
    {
        return self::http()
            ->post('api/v1/intake/clients', self::payload($lead))
            ->throw()
            ->json();
    }

    /** Tells Project Management the deal is off. Unknown there means nothing to call off. */
    public static function withdraw(Lead $lead): void
    {
        $response = self::http()->post(
            'api/v1/intake/clients/'.$lead->id.'/withdraw',
            self::withdrawal($lead),
        );

        if ($response->notFound()) {
            return;
        }

        $response->throw();
    }

    /** @return array<string, mixed> */
    public static function payload(Lead $lead): array
    {
        $personal = $lead->entity === 'Perorangan';

        return [
            'cm_lead_id' => $lead->id,
            // "Perorangan Budi Santoso" reads as a typo; a person is just their name.
            'name' => $personal ? $lead->company : $lead->displayName(),
            'entity' => $lead->entity,
            'client_type' => $personal ? 'Pribadi' : 'Badan',
            'npwp' => $lead->npwp ?: null,
            'email' => $lead->email ?: null,
            'address' => collect([$lead->address, $lead->city])->filter()->implode(', ') ?: null,
            'contact' => [
                'name' => $lead->pic,
                'position' => $lead->pic_role ?: null,
                'phone' => $lead->phone ?: null,
                'email' => $lead->email ?: null,
            ],
            'service' => $lead->service,
            'value' => $lead->value,
            'marketing_owner' => $lead->owner ?: null,
            'deal_at' => self::dealDate($lead),
            'lead_url' => route('leads.show', $lead),
        ];
    }

    /** @return array{reason: string, detail: string, note: string|null} */
    public static function withdrawal(Lead $lead): array
    {
        if ($lead->isClosed()) {
            return [
                'reason' => 'ditutup',
                'detail' => Pipeline::closeReasonLabel($lead->closed_reason) ?? 'Ditutup',
                'note' => $lead->closed_note,
            ];
        }

        return [
            'reason' => 'mundur',
            'detail' => 'Mundur ke '.Pipeline::label($lead->stage),
            'note' => null,
        ];
    }

    /**
     * The day the deal was struck. A lead that skipped Deal and went straight
     * to Client aktif was signed the day it got there.
     */
    private static function dealDate(Lead $lead): string
    {
        $event = LeadStageEvent::query()
            ->where('lead_id', $lead->id)
            ->where('stage', 'deal')
            ->latest('entered_at')
            ->latest('id')
            ->first();

        return ($event->entered_at ?? $lead->stage_changed_at)->toDateString();
    }

    private static function http(): PendingRequest
    {
        return Http::baseUrl(rtrim((string) config('services.project_management.url'), '/'))
            ->withToken((string) config('services.project_management.token'))
            ->acceptJson()
            ->timeout(config('services.project_management.timeout'));
    }
}
