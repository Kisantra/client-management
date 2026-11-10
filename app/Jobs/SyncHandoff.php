<?php

namespace App\Jobs;

use App\Models\Handoff;
use App\Models\Lead;
use App\Support\ProjectManagement;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\RequestException;
use Illuminate\Support\Str;

/**
 * Makes Project Management agree with the lead as it stands now.
 *
 * It reads the lead when it runs, not when it was queued: a deal closed a
 * minute after it was signed sends one call-off, not a handover followed by a
 * call-off. So queuing it twice is harmless, and "Kirim ulang" is just this
 * job again.
 *
 * Failures are caught rather than thrown. A stage move must never fail because
 * the other app is down, and a refusal — a wrong token, data it rejects — is
 * not retried, because waiting will not change the answer.
 */
class SyncHandoff implements ShouldQueue
{
    use Queueable;

    public int $tries = Handoff::TRIES;

    /** Seconds before the second and third tries. */
    private const BACKOFF = [60, 300];

    public function __construct(public int $leadId) {}

    public function handle(): void
    {
        $lead = Lead::with('handoff')->find($this->leadId);
        $handoff = $lead?->handoff;

        if ($lead === null || $handoff === null || ! ProjectManagement::enabled()) {
            return;
        }

        $handoff->increment('attempts');

        try {
            $lead->isSigned() ? $this->send($lead, $handoff) : $this->withdraw($lead, $handoff);
        } catch (ConnectionException|RequestException $e) {
            $refused = $e instanceof RequestException && $e->response->clientError();

            $handoff->update([
                'status' => Handoff::FAILED,
                'error' => $this->explain($e),
                // A refusal spends the remaining tries: only a person can fix it.
                ...($refused ? ['attempts' => Handoff::TRIES] : []),
            ]);

            if (! $refused && $handoff->attempts < Handoff::TRIES) {
                $this->release(self::BACKOFF[$handoff->attempts - 1]);
            }
        }
    }

    private function send(Lead $lead, Handoff $handoff): void
    {
        $reply = ProjectManagement::intake($lead);

        // Whether it joined an existing client is decided when the tax team
        // processes it, and arrives with the completion, not here.
        $handoff->update([
            'status' => ($reply['completed'] ?? false) ? Handoff::COMPLETED : Handoff::SENT,
            'pm_client_id' => $reply['pm_client_id'] ?? $handoff->pm_client_id,
            'pm_client_url' => $reply['client_url'] ?? $handoff->pm_client_url,
            'sent_at' => now(),
            'withdrawn_at' => null,
            'error' => null,
        ]);
    }

    private function withdraw(Lead $lead, Handoff $handoff): void
    {
        ProjectManagement::withdraw($lead);

        $handoff->update([
            'status' => Handoff::WITHDRAWN,
            'withdrawn_at' => now(),
            'error' => null,
        ]);
    }

    /** One line a marketer can read, not a stack trace. */
    private function explain(ConnectionException|RequestException $e): string
    {
        if ($e instanceof ConnectionException) {
            return 'Project Management tidak bisa dihubungi.';
        }

        $status = $e->response->status();
        $message = $e->response->json('message');

        $line = match (true) {
            $status === 401, $status === 403 => 'Project Management menolak tokennya. Samakan PROJECT_MANAGEMENT_TOKEN di kedua aplikasi.',
            $status === 422 => 'Project Management menolak datanya'.(is_string($message) ? ': '.$message : '.'),
            $status >= 500 => 'Project Management sedang bermasalah (galat '.$status.').',
            default => 'Project Management menjawab '.$status.'.',
        };

        return Str::limit($line, 250);
    }
}
