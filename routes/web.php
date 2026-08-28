<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LeadClosureController;
use App\Http\Controllers\LeadController;
use App\Http\Controllers\LeadFollowUpController;
use App\Http\Controllers\LeadNoteController;
use App\Http\Controllers\LeadStageController;
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

    Route::inertia('clients', 'clients')->name('clients');
    Route::inertia('content', 'content')->name('content');
    Route::inertia('performance', 'performance')->name('performance');
    Route::inertia('tasks', 'tasks')->name('tasks');
    Route::inertia('team', 'team')->name('team');
});

require __DIR__.'/settings.php';
