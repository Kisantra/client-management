<?php

namespace App\Http\Controllers;

use App\Models\Content;
use App\Models\Lead;
use App\Models\LeadFollowUp;
use App\Models\LeadStageEvent;
use App\Support\Month;
use App\Support\Pipeline;
use App\Support\Team;
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
            'load' => $this->load(),
            'followUps' => $this->followUps(),
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
    /**
     * The conversations the team owes, soonest first.
     *
     * The dashboard's question at nine in the morning is what is due, and it
     * used to answer that for content alone. Half the day is not content: two
     * hundred and thirty-one follow-ups are already past their date, and until
     * now nothing on this page said so — you had to open a lead to find out
     * you were late to it.
     *
     * Only what is owed. A follow-up booked for next Tuesday is not a thing to
     * do today, and putting it here would bury the ones that are.
     *
     * @return array{
     *     items: array<int, array<string, mixed>>,
     *     overdue: int, today: int, rest: int
     * }
     */
    private function followUps(): array
    {
        $today = Carbon::today();

        $owed = LeadFollowUp::query()
            ->where('done', false)
            ->whereDate('scheduled_for', '<=', $today)
            ->with(['lead:id,entity,company,stage,owner,status'])
            ->orderBy('scheduled_for')
            ->orderBy('id')
            ->get()
            /* A follow-up on a lead that has been closed is not owed to
               anybody. The row survives for the record; the reminder does not
               survive the decision. */
            ->filter(fn (LeadFollowUp $item) => $item->lead?->status === Lead::ACTIVE)
            ->values();

        return [
            'items' => $owed->take(self::QUEUE_SHOWN)
                ->map(fn (LeadFollowUp $item) => [
                    'id' => $item->id,
                    'company' => trim($item->lead->entity.' '.$item->lead->company),
                    'leadId' => $item->lead_id,
                    'stage' => $item->lead->stage,
                    'stageLabel' => Pipeline::label($item->lead->stage),
                    'owner' => $item->lead->owner ?: null,
                    'via' => $item->via,
                    'note' => $item->note ?: null,
                    'on' => $item->scheduled_for->toDateString(),
                    'daysLate' => (int) $item->scheduled_for->startOfDay()->diffInDays($today),
                ])
                ->all(),
            'overdue' => $owed->filter(fn (LeadFollowUp $item) => $item->scheduled_for->startOfDay()->lt($today))->count(),
            'today' => $owed->filter(fn (LeadFollowUp $item) => $item->scheduled_for->isToday())->count(),
            'rest' => max($owed->count() - self::QUEUE_SHOWN, 0),
        ];
    }

    /**
     * Who is carrying what this week.
     *
     * The panel used to be five invented names against an invented capacity of
     * eight — every figure in it a literal in a front-end file. It reads the
     * calendar now, and it does not invent a target: nobody has told this app
     * how many pieces a week is one person's fair share, so it says who is
     * carrying most rather than who is over a line that was never drawn.
     *
     * The bar is measured against the busiest person, and the panel says so.
     * A length has to be measured against something stated, and the largest
     * load is the only denominator the data itself can supply.
     *
     * @return array{
     *     window: string, total: int, busiest: int,
     *     members: array<int, array{name: string, initials: string, due: int, late: int}>
     * }
     */
    private function load(): array
    {
        $today = Carbon::today();
        $week = [$today->copy()->startOfWeek(), $today->copy()->endOfWeek()];

        $pieces = Content::query()
            ->whereBetween('scheduled_for', $week)
            ->get(['owner', 'scheduled_for', 'status']);

        $due = $pieces
            ->groupBy(fn (Content $piece) => (string) $piece->owner)
            ->map(fn ($group) => [
                'due' => $group->count(),
                'late' => $group->filter(fn (Content $piece) => $piece->isLate())->count(),
            ]);

        /* The roster, not only the people who happen to have work: a name with
           nothing this week is the reading somebody came here for. */
        $members = collect(Team::members())
            ->map(fn (array $member) => [
                'name' => $member['name'],
                'initials' => self::initials($member['name']),
                'due' => (int) ($due[$member['name']]['due'] ?? 0),
                'late' => (int) ($due[$member['name']]['late'] ?? 0),
            ])
            ->sortBy([['due', 'desc'], ['name', 'asc']])
            ->values();

        return [
            'window' => $week[0]->day.'–'.$week[1]->day.' '.self::MONTHS[$week[1]->month - 1],
            'total' => $pieces->count(),
            'busiest' => (int) $members->max('due'),
            'members' => $members->all(),
        ];
    }

    /** Two letters at most: one name gives one, two or more give the ends. */
    private static function initials(string $name): string
    {
        $parts = preg_split('/\s+/u', trim($name)) ?: [];
        $parts = array_values(array_filter($parts));

        if ($parts === []) {
            return '?';
        }

        $first = mb_substr($parts[0], 0, 1);
        $last = count($parts) > 1 ? mb_substr(end($parts), 0, 1) : '';

        return mb_strtoupper($first.$last);
    }

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
