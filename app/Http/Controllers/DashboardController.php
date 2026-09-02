<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\Lead;
use App\Models\LeadStageEvent;
use App\Support\Month;
use App\Support\Pipeline;
use Illuminate\Database\Eloquent\Builder;
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
    /** Rows the queue shows before it points at the calendar for the rest. */
    private const QUEUE_SHOWN = 7;

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
            'queue' => $this->queue(),
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
        $range = Month::bounds($month);

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

    /**
     * What the content calendar owes this week.
     *
     * The dashboard's job at nine in the morning is to say what is due and
     * what has slipped, and this is the half of that the app actually knows:
     * every piece is a real row with a real date, a real owner and a real
     * status. Late work is included whatever week it was meant for, because a
     * piece that slipped in March is still owed today.
     *
     * @return array<string, mixed>
     */
    private function queue(): array
    {
        $today = Carbon::today();
        $week = [$today->copy()->startOfWeek(), $today->copy()->endOfWeek()];
        /*
         | A thin week would leave the panel half empty beside the chart it
         | stands next to, so the queue reaches into the following one and
         | says where the line is. Filler would be dishonest; the next week's
         | work is the same question asked one week further out.
         */
        $ahead = [$today->copy()->startOfWeek(), $today->copy()->endOfWeek()->addWeek()];

        $items = Content::query()
            ->where(fn (Builder $query) => $query
                ->whereBetween('scheduled_for', $ahead)
                ->orWhere(fn (Builder $late) => $late
                    ->where('scheduled_for', '<', $today)
                    ->where('status', '!=', Content::PUBLISHED)))
            ->orderBy('scheduled_for')
            ->orderByRaw('scheduled_time is null, scheduled_time')
            ->orderBy('id')
            ->get()
            ->map(fn (Content $content) => [
                ...$content->toRow(),
                /*
                 | Urgency, not clock order: what is already breached reads
                 | before what is merely coming, and what is done reads last.
                 */
                'rank' => match (true) {
                    $content->isLate() => 0,
                    $content->isStuck() => 1,
                    $content->isPublished() => 4,
                    $content->scheduled_for->gt($week[1]) => 3,
                    default => 2,
                },
            ])
            ->sortBy('rank')
            ->values();

        $planned = Content::whereBetween('scheduled_for', $week)->count();

        return [
            'items' => $items->take(self::QUEUE_SHOWN)->all(),
            'rest' => max($items->count() - self::QUEUE_SHOWN, 0),
            'weekLabel' => self::MONTHS[$week[0]->month - 1],
            'planned' => $planned,
            'published' => Content::published()->whereBetween('scheduled_for', $week)->count(),
            'late' => $items->where('late', true)->count(),
            'stuck' => $items->where('stuck', true)->where('late', false)->count(),
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
            ->whereBetween('closed_at', Month::bounds($month))
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
        return Lead::whereBetween('entered_at', Month::bounds($month))->count();
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
