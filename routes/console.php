<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

/*
 | The Berita page shows a rolling week, so it goes stale on its own if nobody
 | refills it. The pipeline finishes writing its sheet in the early morning;
 | this reads it afterwards, before the team opens the app.
 |
 | Inert until something runs the scheduler — `php artisan schedule:work` on
 | this machine, or a cron entry calling `schedule:run` every minute on a
 | server. Overlap is guarded because a slow sheet must not stack up two syncs
 | writing the same rows.
 */
Schedule::command('news:sync')
    ->dailyAt('08:30')
    ->withoutOverlapping()
    ->onFailure(fn () => logger()->warning('news:sync gagal menarik sheet berita.'));
