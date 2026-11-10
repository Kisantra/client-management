<?php

use App\Http\Controllers\Api\HandoffCompletionController;
use App\Http\Controllers\Api\HandoffDocumentController;
use App\Http\Middleware\VerifyProjectManagementToken;
use Illuminate\Support\Facades\Route;

/*
 | What Project Management may ask of this app, and nothing more. Every call
 | carries the shared token, except opening a file: that link is signed and
 | expires, so it can go straight into the browser's frame.
 */
Route::prefix('pm')->name('pm.')->group(function () {
    Route::middleware(VerifyProjectManagementToken::class)->group(function () {
        Route::get('leads/{lead}/documents', [HandoffDocumentController::class, 'index'])
            ->whereNumber('lead')
            ->name('documents');
        Route::post('leads/{lead}/handoff', [HandoffCompletionController::class, 'store'])
            ->whereNumber('lead')
            ->name('handoff');
    });

    Route::get('lampiran/{attachment}', [HandoffDocumentController::class, 'show'])
        ->middleware('signed')
        ->whereNumber('attachment')
        ->name('attachments.show');
});
