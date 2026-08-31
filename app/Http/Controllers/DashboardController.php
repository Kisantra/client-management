<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\Lead;
use App\Models\LeadStageEvent;
use App\Support\Pipeline;
use Illuminate\Support\Carbon;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The dashboard's lead figures, read from the leads themselves.
 *
 * Everything on this screen that concerns a client comes from here. The content
 * and team panels are still sample data, and say so, because those modules do
 * not exist yet — but no number about a lead may disagree with the Leads page.
 */
class DashboardController extends Controller
{
    private const MONTHS = [
        'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
        'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des',
    ];

    public function __invoke(): Response
    {
        $today = Carbon::today();
        $thisMonth = $today->copy()->startOfMonth();
        $lastMonth = $thisMonth->copy()->subMonth();

        $leadsThisMonth = $this->enteredIn($thisMonth);
        $leadsLastMonth = $this->enteredIn($lastMonth);

        $clients = Lead::active()->where('stage', 'client')->count();
        $clientsLastMonth = $this->clientsAtEndOf($lastMonth);

        return Inertia::render('dashboard', [
            'pipeline' => $this->pipeline(),

            'summary' => [
                'leads' => [
                    'value' => $leadsThisMonth,
                    'deltaPercent' => $leadsLastMonth === 0
                        ? null
                        : (int) round((($leadsThisMonth - $leadsLastMonth) / $leadsLastMonth) * 100),
                    'comparedTo' => self::MONTHS[$lastMonth->month - 1],
                ],
                'activeClients' => [
                    'value' => $clients,
                    'delta' => $clients - $clientsLastMonth,
                    'comparedTo' => self::MONTHS[$lastMonth->month - 1],
                ],
                'stalled' => $this->stalled(),
                'published' => $this->published($thisMonth),
            ],

            'monthlyLeads' => $this->monthlyLeads(),
            'monthlyClients' => $this->monthlyClients(),
            'closed' => $this->closed($thisMonth),
        ]);
    }

    /**
     * Content live this month against everything planned for it, plus the
     * working days left to close the gap. The target is the team's own plan,
     * not a number typed in somewhere.
     *
     * @return array{value: int, planned: int, workingDaysLeft: int}
     */
    private function published(Carbon $month): array
    {
        $range = [$month->toDateString(), $month->copy()->endOfMonth()->toDateString()];

        // Weekdays from tomorrow to the month's end, inclusive.
        $left = 0;

        for ($day = Carbon::today()->addDay(); $day->lte($month->copy()->endOfMonth()); $day->addDay()) {
            $left += $day->isWeekday() ? 1 : 0;
        }

        return [
            'value' => Content::published()->whereBetween('scheduled_for', $range)->count(),
            'planned' => Content::whereBetween('scheduled_for', $range)->count(),
            'workingDaysLeft' => $left,
        ];
    }

    /** Stage totals, and how many in each have stopped moving. */
    private function pipeline(): array
    {
        $today = Carbon::today()->toDateString();

        $stats = Lead::query()
            ->active()
            ->selectRaw('stage, count(*) as total')
            ->selectRaw('sum(case when stalled_at < ? then 1 else 0 end) as stalled', [$today])
            ->groupBy('stage')
            ->get()
            ->keyBy('stage');

        return collect(Pipeline::forClient())
            ->map(fn (array $stage) => [
                ...$stage,
                'count' => (int) ($stats[$stage['key']]->total ?? 0),
                'stalled' => (int) ($stats[$stage['key']]->stalled ?? 0),
            ])
            ->all();
    }

    /**
     * The stalled headline, plus the stage that is worst about it — a count on
     * its own says something is wrong without saying where.
     */
    private function stalled(): array
    {
        $stalled = Lead::stalled()->get(['stage', 'stage_changed_at']);

        $worst = collect(Pipeline::stages())
            ->map(fn (array $stage) => [
                'label' => $stage['label'],
                'count' => $stalled->where('stage', $stage['key'])->count(),
                'days' => (int) $stalled->where('stage', $stage['key'])
                    ->max(fn (Lead $lead) => $lead->daysInStage()),
            ])
            ->sortByDesc('count')
            ->first();

        return [
            'value' => $stalled->count(),
            'afterDays' => Pipeline::threshold('lead'),
            'worstStage' => $worst['count'] > 0 ? $worst['label'] : null,
            'worstDays' => $worst['count'] > 0 ? $worst['days'] : null,
        ];
    }

    /**
     * What stopped this month, and at which stage it stopped.
     *
     * The stage is the point: leads lost at Kontak say the enquiries were never
     * a fit, leads lost at Proposal say the offer was.
     */
    private function closed(Carbon $month): array
    {
        $closed = Lead::closed()
            ->whereBetween('closed_at', [
                $month->copy()->startOfMonth()->toDateString(),
                $month->copy()->endOfMonth()->toDateString(),
            ])
            ->get(['stage', 'closed_reason']);

        $worst = collect(Pipeline::stages())
            ->map(fn (array $stage) => [
                'label' => $stage['label'],
                'count' => $closed->where('stage', $stage['key'])->count(),
            ])
            ->sortByDesc('count')
            ->first();

        $reason = collect(Pipeline::closeReasons())
            ->map(fn (array $reason, string $key) => [
                'label' => $reason['label'],
                'count' => $closed->where('closed_reason', $key)->count(),
            ])
            ->sortByDesc('count')
            ->first();

        return [
            'value' => $closed->count(),
            'worstStage' => $worst['count'] > 0 ? $worst['label'] : null,
            'worstStageCount' => $worst['count'],
            'topReason' => $reason['count'] > 0 ? $reason['label'] : null,
        ];
    }

    /** @return array<int, array{month: string, value: int}> */
    private function monthlyLeads(): array
    {
        $start = Carbon::today()->startOfMonth()->subMonths(11);

        return collect(range(0, 11))
            ->map(function (int $offset) use ($start) {
                $month = $start->copy()->addMonths($offset);

                return [
                    'month' => self::MONTHS[$month->month - 1],
                    'value' => $this->enteredIn($month),
                ];
            })
            ->all();
    }

    /** Active clients at the end of each of the last six months. */
    private function monthlyClients(): array
    {
        $start = Carbon::today()->startOfMonth()->subMonths(5);

        return collect(range(0, 5))
            ->map(fn (int $offset) => $this->clientsAtEndOf($start->copy()->addMonths($offset)))
            ->all();
    }

    private function enteredIn(Carbon $month): int
    {
        return Lead::whereBetween('entered_at', [
            $month->copy()->startOfMonth()->toDateString(),
            $month->copy()->endOfMonth()->toDateString(),
        ])->count();
    }

    /**
     * Clients as of a month's end, counted from the moves that made them one.
     * Leaving is not tracked yet, so this only ever climbs.
     */
    private function clientsAtEndOf(Carbon $month): int
    {
        return LeadStageEvent::where('stage', 'client')
            ->whereDate('entered_at', '<=', $month->copy()->endOfMonth()->toDateString())
            ->whereHas('lead', fn ($query) => $query->active())
            ->distinct('lead_id')
            ->count('lead_id');
    }
}
