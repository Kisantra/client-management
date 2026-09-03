<?php

use App\Http\Controllers\ClientController;
use App\Http\Controllers\ContentController;
use App\Http\Controllers\ContentFieldController;
use App\Http\Controllers\ContentIdeaController;
use App\Http\Controllers\ContentStatusController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LeadClosureController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\LeadFollowUpController;
use App\Http\Controllers\LeadNoteController;
use App\Http\Controllers\LeadStageController;
use App\Http\Controllers\NewsController;
use App\Http\Controllers\PerformanceController;
use App\Http\Controllers\SocialVideoController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', DashboardController::class)->name('dashboard');

    Route::get('leads', [LeadController::class, 'index'])->name('leads');
    Route::post('leads', [LeadController::class, 'store'])->name('leads.store');
    Route::get('leads/create', [LeadController::class, 'create'])->name('leads.create');

    Route::prefix('leads/{lead}')->whereNumber('lead')->group(function () {
        Route::get('/', [LeadController::class, 'show'])->name('leads.show');
        Route::get('edit', [LeadController::class, 'edit'])->name('leads.edit');
        Route::post('/', [LeadController::class, 'update'])->name('leads.update');

        Route::post('stage', [LeadStageController::class, 'store'])->name('leads.stage.store');

        Route::post('closure', [LeadClosureController::class, 'store'])->name('leads.closure.store');
        Route::delete('closure', [LeadClosureController::class, 'destroy'])->name('leads.closure.destroy');
        Route::post('notes', [LeadNoteController::class, 'store'])->name('leads.notes.store');

        Route::post('follow-ups', [LeadFollowUpController::class, 'store'])
            ->name('leads.follow-ups.store');
        Route::patch('follow-ups/{followUp}', [LeadFollowUpController::class, 'update'])
            ->whereNumber('followUp')
            ->name('leads.follow-ups.update');
        Route::delete('follow-ups/{followUp}', [LeadFollowUpController::class, 'destroy'])
            ->whereNumber('followUp')
            ->name('leads.follow-ups.destroy');
    });

    Route::get('clients', [ClientController::class, 'index'])->name('clients');
    Route::get('content', [ContentController::class, 'index'])->name('content');
    Route::post('content', [ContentController::class, 'store'])->name('content.store');
    Route::get('content/create', [ContentController::class, 'create'])->name('content.create');

    Route::get('content/ide', [ContentIdeaController::class, 'index'])->name('content.ideas');
    Route::post('content/ide', [ContentIdeaController::class, 'store'])->name('content.ideas.store');
    Route::delete('content/ide/{idea}', [ContentIdeaController::class, 'destroy'])
        ->whereNumber('idea')
        ->name('content.ideas.destroy');

    Route::get('content/berita', [NewsController::class, 'index'])->name('content.news');
    Route::post('content/berita/{news}/ide', [NewsController::class, 'idea'])
        ->whereNumber('news')
        ->name('content.news.idea');

    Route::prefix('content/{content}')->whereNumber('content')->group(function () {
        Route::get('/', [ContentController::class, 'show'])->name('content.show');
        Route::get('edit', [ContentController::class, 'edit'])->name('content.edit');
        Route::post('/', [ContentController::class, 'update'])->name('content.update');
        Route::delete('/', [ContentController::class, 'destroy'])->name('content.destroy');

        Route::post('status', [ContentStatusController::class, 'store'])->name('content.status.store');
        Route::post('field', [ContentFieldController::class, 'store'])->name('content.field.store');
    });
    Route::get('performance', PerformanceController::class)->name('performance');
    Route::get('performance/konten', [PerformanceController::class, 'content'])
        ->name('performance.content');
    /* One video, copied when somebody asks to watch it. */
    Route::post('performance/{platform}/{code}/video', [SocialVideoController::class, 'store'])
        ->whereIn('platform', ['instagram', 'tiktok'])
        ->name('performance.video');

    Route::post('performance/refresh', [PerformanceController::class, 'refresh'])
        ->name('performance.refresh');
    Route::inertia('tasks', 'tasks')->name('tasks');
    Route::inertia('team', 'team')->name('team');
});

require __DIR__.'/settings.php';
