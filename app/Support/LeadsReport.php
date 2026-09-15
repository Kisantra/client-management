<?php

namespace App\Support;

use App\Models\Lead;
use App\Models\LeadFollowUp;
use App\Models\LeadStageEvent;
use Carbon\CarbonImmutable;
use Illuminate\Support\Collection;

/**
 * What the pipeline did over a stretch of months.
 *
 * The other half of the quarterly document. Reach is a means; this is the end
 * it is a means to, and the two are bound into one report so that a quarter of
 * good numbers on the accounts can never be presented without the quarter of
 * business underneath it.
 *
 * Every figure is read from the leads themselves and from the stage history
 * they carry, so "became a client in August" means the move was recorded in
 * August — not that the lead happens to sit at Client today. A lead won in
 * March is not this quarter's work, and the lead row alone cannot tell the
 * difference.
 *
 * The funnel is a cohort, not a snapshot: it follows the leads that arrived in
 * this window and asks how far each of them got. A snapshot of who stands
 * where today mixes this quarter's arrivals with last year's, and the drop
 * between two stages then measures nothing at all.
 */
final class LeadsReport
{
    private function __construct(
        private readonly CarbonImmutable $from,
        private readonly CarbonImmutable $to,
    ) {}

    public static function between(CarbonImmutable $from, CarbonImmutable $to): self
    {
        return new self($from, $to);
    }

    /**
     * Everything Part I states, in the order it states it.
     *
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        $arrived = $this->arrived();
        $won = $this->wonInWindow();

        return [
            'summary' => $this->summary($arrived, $won),
            'funnel' => $this->funnel($arrived),
            'sources' => $this->sources($arrived, $won),
            'speed' => $this->speed($arrived, $won),
            'owners' => $this->owners($arrived, $won),
            'closed' => $this->closed($arrived),
            'followUps' => $this->followUps(),
            'months' => $this->months($arrived, $won),
        ];
    }

    /**
     * The leads that came in during the window.
     *
     * @return Collection<int, Lead>
     */
    private function arrived(): Collection
    {
        return Lead::query()
            ->with('stageEvents')
            ->whereBetween('entered_at', [$this->from->toDateString(), $this->to->toDateString()])
            ->get();
    }

    /**
     * The leads whose move to Client was recorded inside the window.
     *
     * Read from the stage history rather than from the stage a lead sits at
     * today: those two answer different questions, and only one of them is
     * about this quarter.
     *
     * @return Collection<int, Lead>
     */
    private function wonInWindow(): Collection
    {
        $ids = LeadStageEvent::query()
            ->where('stage', 'client')
            ->whereBetween('entered_at', [$this->from->toDateString(), $this->to->toDateString()])
            ->pluck('lead_id')
            ->unique();

        return $ids->isEmpty()
            ? collect()
            : Lead::query()->whereIn('id', $ids)->get();
    }

    /**
     * @param  Collection<int, Lead>  $arrived
     * @param  Collection<int, Lead>  $won
     * @return array<string, mixed>
     */
    private function summary(Collection $arrived, Collection $won): array
    {
        $closed = $arrived->filter(fn (Lead $lead) => $lead->isClosed());

        return [
            'arrived' => $arrived->count(),
            /* Two different questions, both worth asking: how many of this
               window's arrivals were won, and how many wins happened in it —
               some of which were leads from before. */
            'wonFromCohort' => $arrived->filter(fn (Lead $lead) => $this->reached($lead) >= Pipeline::index('client'))->count(),
            'wonInWindow' => $won->count(),
            'closed' => $closed->count(),
            'stillOpen' => $arrived->count() - $closed->count()
                - $arrived->filter(fn (Lead $lead) => $lead->stage === 'client')->count(),
            'value' => (int) $arrived->sum('value'),
            'wonValue' => (int) $won->sum('value'),
            'typicalValue' => (int) round(PerformanceReport::median($arrived->pluck('value'))),
            'conversion' => $arrived->isEmpty()
                ? null
                : round(($arrived->filter(fn (Lead $lead) => $this->reached($lead) >= Pipeline::index('client'))->count() / $arrived->count()) * 100, 1),
        ];
    }

    /**
     * How far this window's arrivals got, stage by stage.
     *
     * @param  Collection<int, Lead>  $arrived
     * @return array<int, array<string, mixed>>
     */
    private function funnel(Collection $arrived): array
    {
        $total = $arrived->count();
        $reached = $arrived->map(fn (Lead $lead) => $this->reached($lead));

        $previous = null;

        return collect(Pipeline::stages())
            ->map(function (array $stage, int $at) use ($reached, $total, &$previous) {
                $count = $reached->filter(fn (int $far) => $far >= $at)->count();

                $row = [
                    'key' => $stage['key'],
                    'label' => $stage['label'],
                    'count' => $count,
                    'share' => $total > 0 ? round(($count / $total) * 100, 1) : 0,
                    /* What fell away since the stage before it. The first
                       stage has nothing behind it and reports none. */
                    'dropped' => $previous === null ? null : $previous - $count,
                    'kept' => $previous === null || $previous === 0
                        ? null
                        : round(($count / $previous) * 100),
                ];

                $previous = $count;

                return $row;
            })
            ->all();
    }

    /**
     * Where the leads came from, and where the new clients came from.
     *
     * Two populations, deliberately not divided into one another. The leads
     * are the ones that arrived in this window; the clients are the ones won
     * in it, most of whom arrived long before. A conversion rate across those
     * two would be this quarter's wins over this quarter's arrivals — a ratio
     * between a numerator and a denominator that describe different people.
     *
     * @param  Collection<int, Lead>  $arrived
     * @param  Collection<int, Lead>  $won
     * @return array<int, array<string, mixed>>
     */
    private function sources(Collection $arrived, Collection $won): array
    {
        return collect(Pipeline::channels())
            ->map(function (string $label, string $key) use ($arrived, $won) {
                $group = $arrived->where('channel', $key);
                $wins = $won->where('channel', $key);

                return [
                    'key' => $key,
                    'label' => $label,
                    'leads' => $group->count(),
                    'share' => $arrived->isEmpty() ? 0 : (int) round(($group->count() / $arrived->count()) * 100),
                    'value' => (int) $group->sum('value'),
                    'clients' => $wins->count(),
                    'wonValue' => (int) $wins->sum('value'),
                ];
            })
            ->filter(fn (array $row) => $row['leads'] > 0 || $row['clients'] > 0)
            ->sortByDesc('leads')
            ->values()
            ->all();
    }

    /**
     * How long the pipeline takes, and where it is standing still.
     *
     * Medians again: one lead that took eight months to sign would drag a mean
     * far past anything the team recognises.
     *
     * @param  Collection<int, Lead>  $arrived
     * @param  Collection<int, Lead>  $won
     * @return array<string, mixed>
     */
    private function speed(Collection $arrived, Collection $won): array
    {
        $stalled = Lead::query()->active()->stalled()->get();

        $worst = $stalled
            ->groupBy('stage')
            ->map->count()
            ->sortDesc();

        return [
            'toContact' => $this->daysTo($arrived, 'kontak'),
            'toProposal' => $this->daysTo($arrived, 'proposal'),
            'toClient' => $this->daysTo($arrived, 'client'),
            'stalledNow' => $stalled->count(),
            'worstStage' => $worst->isEmpty() ? null : [
                'label' => Pipeline::label((string) $worst->keys()->first()),
                'count' => $worst->first(),
                'afterDays' => Pipeline::threshold((string) $worst->keys()->first()),
            ],
            'wonCount' => $won->count(),
        ];
    }

    /**
     * The middle number of days from arriving to reaching a stage.
     *
     * Null when nobody in this window has reached it — which is a real answer
     * and reads better than a zero.
     *
     * @param  Collection<int, Lead>  $arrived
     */
    private function daysTo(Collection $arrived, string $stage): ?float
    {
        $spans = $arrived
            ->map(function (Lead $lead) use ($stage) {
                $event = $lead->stageEvents->firstWhere('stage', $stage);

                return $event ? (int) round($lead->entered_at->diffInDays($event->entered_at)) : null;
            })
            ->filter(fn (?int $days) => $days !== null && $days >= 0);

        return $spans->isEmpty() ? null : round(PerformanceReport::median($spans), 1);
    }

    /**
     * Who is carrying what, and who closed something.
     *
     * The same two populations as the sources table, and for the same reason
     * they are not divided into one another.
     *
     * @param  Collection<int, Lead>  $arrived
     * @param  Collection<int, Lead>  $won
     * @return array<int, array<string, mixed>>
     */
    private function owners(Collection $arrived, Collection $won): array
    {
        $wins = $won->groupBy(fn (Lead $lead) => $lead->owner ?: 'Belum ditentukan');

        return $arrived
            ->groupBy(fn (Lead $lead) => $lead->owner ?: 'Belum ditentukan')
            ->map(function (Collection $group, string $name) use ($wins) {
                $closed = $group->filter(fn (Lead $lead) => $lead->isClosed());
                $mine = $wins->get($name, collect());

                return [
                    'name' => $name,
                    'leads' => $group->count(),
                    'value' => (int) $group->sum('value'),
                    'closed' => $closed->count(),
                    'clients' => $mine->count(),
                    'wonValue' => (int) $mine->sum('value'),
                ];
            })
            ->sortByDesc('leads')
            ->values()
            ->all();
    }

    /**
     * The ones that stopped, and the diagnosis each carries.
     *
     * A closed lead keeps the stage it died at, because "gugur di Proposal"
     * and "gugur di Kontak" are two different problems.
     *
     * @param  Collection<int, Lead>  $arrived
     * @return array<string, mixed>
     */
    private function closed(Collection $arrived): array
    {
        $closed = $arrived->filter(fn (Lead $lead) => $lead->isClosed());

        $reasons = collect(Pipeline::closeReasons())
            ->map(fn (array $reason, string $key) => [
                'key' => $key,
                'label' => $reason['label'],
                'count' => $closed->where('closed_reason', $key)->count(),
            ])
            ->filter(fn (array $row) => $row['count'] > 0)
            ->sortByDesc('count')
            ->map(fn (array $row) => [
                ...$row,
                'share' => $closed->isEmpty() ? 0 : (int) round(($row['count'] / $closed->count()) * 100),
            ])
            ->values()
            ->all();

        $stages = $closed->groupBy('stage')->map->count()->sortDesc();

        return [
            'total' => $closed->count(),
            'share' => $arrived->isEmpty() ? 0 : (int) round(($closed->count() / $arrived->count()) * 100),
            'reasons' => $reasons,
            'worstStage' => $stages->isEmpty() ? null : [
                'label' => Pipeline::label((string) $stages->keys()->first()),
                'count' => $stages->first(),
            ],
            'lostValue' => (int) $closed->sum('value'),
        ];
    }

    /**
     * The promises to call back, kept and broken.
     *
     * Not scoped to the window: a follow-up owed is owed today regardless of
     * when the lead arrived, and a report that hid the overdue ones because
     * their lead is old would be hiding exactly the wrong ones.
     *
     * @return array<string, mixed>
     */
    private function followUps(): array
    {
        $inWindow = LeadFollowUp::query()
            ->whereBetween('scheduled_for', [$this->from->toDateString(), $this->to->toDateString()])
            ->get();

        $owed = LeadFollowUp::query()
            ->where('done', false)
            ->whereDate('scheduled_for', '<=', CarbonImmutable::now()->toDateString())
            ->count();

        return [
            'scheduled' => $inWindow->count(),
            'done' => $inWindow->where('done', true)->count(),
            'kept' => $inWindow->isEmpty()
                ? null
                : (int) round(($inWindow->where('done', true)->count() / $inWindow->count()) * 100),
            'overdueNow' => $owed,
        ];
    }

    /**
     * Month by month: who arrived, and who was won.
     *
     * @param  Collection<int, Lead>  $arrived
     * @param  Collection<int, Lead>  $won
     * @return array<int, array<string, mixed>>
     */
    private function months(Collection $arrived, Collection $won): array
    {
        $byArrival = $arrived->groupBy(fn (Lead $lead) => $lead->entered_at->format('Y-m'));

        /* A win is dated by the move, not by the lead: the month it was signed
           is the month it belongs to. */
        $wins = LeadStageEvent::query()
            ->where('stage', 'client')
            ->whereBetween('entered_at', [$this->from->toDateString(), $this->to->toDateString()])
            ->get()
            ->groupBy(fn (LeadStageEvent $event) => $event->entered_at->format('Y-m'));

        $out = [];

        for ($at = $this->from; $at->lessThanOrEqualTo($this->to); $at = $at->addMonth()) {
            $key = $at->format('Y-m');
            $group = $byArrival->get($key, collect());

            $out[] = [
                'key' => $key,
                'label' => Dates::shortMonthName($at->month),
                'year' => $at->year,
                'arrived' => $group->count(),
                'clients' => $wins->get($key, collect())->pluck('lead_id')->unique()->count(),
                'value' => (int) $group->sum('value'),
                'partial' => $at->isSameMonth(CarbonImmutable::now()) && $this->to->isFuture(),
            ];
        }

        return $out;
    }

    /**
     * The furthest stage a lead ever reached, as an index into the pipeline.
     *
     * Read from the history and from where it stands now, because a lead can
     * be closed at Proposal — the row says Proposal, and the history says it
     * got there.
     */
    private function reached(Lead $lead): int
    {
        $fromEvents = $lead->stageEvents
            ->map(fn (LeadStageEvent $event) => Pipeline::index($event->stage))
            ->max() ?? 0;

        return max(Pipeline::index($lead->stage), $fromEvents);
    }
}
