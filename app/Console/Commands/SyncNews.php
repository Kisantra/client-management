<?php

namespace App\Console\Commands;

use App\Models\BriefIdea;
use App\Models\NewsBrief;
use App\Models\NewsItem;
use App\Support\BriefSheet;
use App\Support\NewsSheet;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/**
 * Reads the team's pipeline sheet: the scored news log and the morning brief.
 *
 * One command for two tabs, because they are one artifact from one pipeline —
 * syncing half of it on a schedule and the other half by hand is how the two
 * halves start disagreeing about what day it is.
 *
 * The news log is an archive by default, so it only ever grows; clearing
 * happens only where NEWS_SHEET_DAYS puts a window back, and even then a story
 * somebody turned into an idea is kept, because that row is what the idea
 * remembers it came from. Briefs are never cleared.
 */
class SyncNews extends Command
{
    protected $signature = 'news:sync {--dry-run : Report what would change and write nothing}';

    protected $description = 'Tarik berita dan brief harian dari sheet tim';

    public function handle(): int
    {
        $news = $this->news();
        $briefs = $this->briefs();

        return $news && $briefs ? self::SUCCESS : self::FAILURE;
    }

    /** The scored news log. */
    private function news(): bool
    {
        $sheet = NewsSheet::make();

        if (! $sheet->configured()) {
            $this->error('NEWS_SHEET_ID belum diisi.');

            return false;
        }

        try {
            $rows = $sheet->rows();
        } catch (RuntimeException $e) {
            $this->error('Berita: '.$e->getMessage());

            return false;
        }

        $since = $sheet->since();
        $scope = $since === null ? 'seluruh sheet' : 'sejak '.$since->toDateString();

        if ($rows->isEmpty()) {
            $this->warn('Berita: tidak ada yang lolos saringan di '.$scope.'.');

            return true;
        }

        $known = NewsItem::query()->pluck('id', 'fingerprint');
        $fresh = $rows->reject(fn (array $row) => $known->has($row['fingerprint']))->count();

        /*
         | With no window there is nothing to fall out of, and the sheet is a
         | log that only ever grows — so a row missing from today's read is a
         | row this sync simply did not see, not one to throw away.
         */
        $stale = $since === null
            ? null
            : NewsItem::query()
                ->whereNull('content_idea_id')
                ->where(fn ($q) => $q->where('published_at', '<', $since)
                    ->orWhereNotIn('fingerprint', $rows->pluck('fingerprint'))
                    ->orWhereNull('fingerprint'));

        if ($this->option('dry-run')) {
            $this->line(sprintf(
                'Berita: %d lolos saringan (%d baru), %d baris akan dibuang.',
                $rows->count(),
                $fresh,
                $stale?->count() ?? 0,
            ));

            return true;
        }

        $dropped = DB::transaction(function () use ($rows, $stale) {
            /*
             | Upsert rather than insert: the pipeline re-scores a story every
             | morning, so a row already held may carry a stale score, category
             | or summary. The fingerprint is what says it is the same story.
             */
            NewsItem::query()->upsert(
                $rows->map(fn (array $row) => $row + [
                    'created_at' => now(),
                    'updated_at' => now(),
                ])->all(),
                ['fingerprint'],
                ['title', 'source', 'category', 'score', 'url', 'summary', 'published_at', 'updated_at'],
            );

            return $stale?->delete() ?? 0;
        });

        $this->info(sprintf(
            'Berita: %d dari %s — %d baru, %d diperbarui, %d dibuang.',
            $rows->count(),
            $scope,
            $fresh,
            $rows->count() - $fresh,
            $dropped,
        ));

        return true;
    }

    /** The written morning brief. */
    private function briefs(): bool
    {
        $sheet = BriefSheet::make();

        if (! $sheet->configured()) {
            $this->error('NEWS_SHEET_BRIEF_GID belum diisi.');

            return false;
        }

        try {
            $briefs = $sheet->briefs();
        } catch (RuntimeException $e) {
            $this->error('Brief: '.$e->getMessage());

            return false;
        }

        if ($briefs->isEmpty()) {
            $this->warn('Brief: tidak ada brief yang terbaca di tab itu.');

            return true;
        }

        $known = NewsBrief::query()->pluck('id', 'fingerprint');
        $fresh = $briefs->reject(fn (array $b) => $known->has($b['fingerprint']))->count();

        if ($this->option('dry-run')) {
            $this->line(sprintf(
                'Brief: %d terbaca (%d baru), %d ide di dalamnya.',
                $briefs->count(),
                $fresh,
                $briefs->sum(fn (array $b) => count($b['ideas'])),
            ));

            return true;
        }

        $ideas = DB::transaction(fn () => $this->write($briefs));

        $this->info(sprintf(
            'Brief: %d terbaca — %d baru, %d diperbarui, %d ide.',
            $briefs->count(),
            $fresh,
            $briefs->count() - $fresh,
            $ideas,
        ));

        return true;
    }

    /**
     * @param  Collection<int, array<string, mixed>>  $briefs
     */
    private function write(Collection $briefs): int
    {
        $written = 0;

        foreach ($briefs as $brief) {
            $row = NewsBrief::updateOrCreate(
                ['fingerprint' => $brief['fingerprint']],
                [
                    'published_at' => $brief['published_at'],
                    'raw' => $brief['raw'],
                    'topics' => $brief['topics'],
                    'extras' => $brief['extras'],
                ],
            );

            foreach ($brief['ideas'] as $position => $idea) {
                BriefIdea::updateOrCreate(
                    /* Scoped to its own brief: the same headline suggested
                       again weeks later is a second idea, not the same one
                       arriving twice, and pressing one must not mark the
                       other as already taken. */
                    ['fingerprint' => sha1($brief['fingerprint'].'|'.$idea['title'])],
                    [
                        'news_brief_id' => $row->id,
                        'position' => $position,
                        'title' => mb_substr($idea['title'], 0, 512),
                        'body' => $idea['body'],
                        'url' => $idea['url'],
                    ],
                );

                $written++;
            }
        }

        return $written;
    }
}
