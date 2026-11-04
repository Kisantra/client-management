<?php

use App\Http\Controllers\ActivityController;
use App\Http\Controllers\BriefController;
use App\Http\Controllers\ClientController;
use App\Http\Controllers\ContentCommentController;
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
use App\Http\Controllers\LetterCancelController;
use App\Http\Controllers\LetterController;
use App\Http\Controllers\LetterCounterController;
use App\Http\Controllers\LetterDocumentController;
use App\Http\Controllers\LetterIssueController;
use App\Http\Controllers\LetterPdfController;
use App\Http\Controllers\LetterSettingsController;
use App\Http\Controllers\LetterSignerController;
use App\Http\Controllers\LetterTemplateController;
use App\Http\Controllers\NewsController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\PerformanceController;
use App\Http\Controllers\PerformanceReportController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RequestedDocumentTypeController;
use App\Http\Controllers\SocialVideoController;
use App\Http\Controllers\TeamController;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;

/*
 | The front door. This is an in-house tool with nothing to show a stranger,
 | so the root is a doorway rather than a page: it sends you to the work if you
 | are signed in, and to the sign-in screen if you are not.
 */
Route::get('/', fn () => redirect()->route(Auth::check() ? 'dashboard' : 'login'))
    ->name('home');

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

    /* The idea route sits above {brief} so a press is never read as a date. */
    Route::post('content/brief/ide/{briefIdea}', [BriefController::class, 'idea'])
        ->whereNumber('briefIdea')
        ->name('content.brief.idea');
    Route::get('content/brief/{brief?}', [BriefController::class, 'index'])
        ->whereNumber('brief')
        ->name('content.brief');
    Route::post('content/berita/{news}/ide', [NewsController::class, 'idea'])
        ->whereNumber('news')
        ->name('content.news.idea');

    Route::prefix('content/{content}')->whereNumber('content')->group(function () {
        Route::get('/', [ContentController::class, 'show'])->name('content.show');
        Route::get('edit', [ContentController::class, 'edit'])->name('content.edit');
        Route::post('/', [ContentController::class, 'update'])->name('content.update');
        Route::delete('/', [ContentController::class, 'destroy'])->name('content.destroy');

        Route::post('status', [ContentStatusController::class, 'store'])->name('content.status.store');

        Route::post('comments', [ContentCommentController::class, 'store'])
            ->name('content.comments.store');
        Route::patch('comments/{comment}', [ContentCommentController::class, 'update'])
            ->whereNumber('comment')
            ->name('content.comments.update');
        Route::delete('comments/{comment}', [ContentCommentController::class, 'destroy'])
            ->whereNumber('comment')
            ->name('content.comments.destroy');
        Route::post('field', [ContentFieldController::class, 'store'])->name('content.field.store');
    });
    Route::post('notifications/baca-semua', [NotificationController::class, 'readAll'])
        ->name('notifications.read-all');
    Route::post('notifications/{id}/baca', [NotificationController::class, 'read'])
        ->name('notifications.read');

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

    /* The month and the week, counted rather than typed up by hand. The rows
       behind each table leave as CSV; the sheet itself prints. */
    Route::get('laporan', ReportController::class)->name('report');
    Route::get('laporan/ekspor/{part}', [ReportController::class, 'export'])
        ->whereIn('part', ['konten', 'lead'])
        ->name('report.export');

    /* The quarter on the accounts, as a document: read on screen, sent as a
       PDF. Both come from one computation. */
    Route::get('laporan/performa', PerformanceReportController::class)
        ->name('report.performance');
    Route::get('laporan/performa/pdf', [PerformanceReportController::class, 'download'])
        ->name('report.performance.pdf');

    /* The log of what the team did, read as a page of its own rather than a
       panel bolted onto each record. */
    Route::get('aktivitas', ActivityController::class)->name('activity');

    /* Letters written here, on the letterhead: drafted from a template
       against a lead, issued with a number, sent as the PDF. The fixed
       paths sit above {letter} so "baru" and "template" are never read as
       an id. */
    Route::get('surat', [LetterController::class, 'index'])->name('letters');
    Route::post('surat', [LetterController::class, 'store'])->name('letters.store');
    Route::get('surat/baru', [LetterController::class, 'create'])->name('letters.create');

    Route::get('surat/template', [LetterTemplateController::class, 'index'])->name('letters.templates');
    Route::post('surat/template/pasang', [LetterTemplateController::class, 'seed'])->name('letters.templates.seed');
    Route::get('surat/template/{template}', [LetterTemplateController::class, 'edit'])
        ->whereNumber('template')
        ->name('letters.templates.edit');
    Route::patch('surat/template/{template}', [LetterTemplateController::class, 'update'])
        ->whereNumber('template')
        ->name('letters.templates.update');
    Route::post('surat/template/{template}/pulihkan', [LetterTemplateController::class, 'restore'])
        ->whereNumber('template')
        ->name('letters.templates.restore');

    /* Who signs, the documents a checklist picks from, and where each
       number sequence stands. A signer is updated by POST because the
       form carries an image. */
    Route::get('surat/pengaturan', [LetterSettingsController::class, 'index'])->name('letters.settings');
    Route::post('surat/pengaturan/penanda-tangan', [LetterSignerController::class, 'store'])->name('letters.signers.store');
    Route::post('surat/pengaturan/penanda-tangan/{signer}', [LetterSignerController::class, 'update'])
        ->whereNumber('signer')
        ->name('letters.signers.update');
    Route::get('surat/pengaturan/penanda-tangan/{signer}/ttd', [LetterSignerController::class, 'image'])
        ->whereNumber('signer')
        ->name('letters.signers.image');
    Route::post('surat/pengaturan/dokumen', [RequestedDocumentTypeController::class, 'store'])->name('letters.types.store');
    Route::post('surat/pengaturan/dokumen/pasang', [RequestedDocumentTypeController::class, 'seed'])->name('letters.types.seed');
    Route::patch('surat/pengaturan/dokumen/{type}', [RequestedDocumentTypeController::class, 'update'])
        ->whereNumber('type')
        ->name('letters.types.update');
    Route::patch('surat/pengaturan/nomor', [LetterCounterController::class, 'update'])->name('letters.counters.update');

    Route::prefix('surat/{letter}')->whereNumber('letter')->group(function () {
        Route::get('/', [LetterController::class, 'show'])->name('letters.show');
        Route::patch('/', [LetterController::class, 'update'])->name('letters.update');
        Route::delete('/', [LetterController::class, 'destroy'])->name('letters.destroy');

        Route::post('terbit', [LetterIssueController::class, 'store'])->name('letters.issue.store');
        Route::delete('terbit', [LetterIssueController::class, 'destroy'])->name('letters.issue.destroy');
        Route::post('batal', LetterCancelController::class)->name('letters.cancel');
        Route::get('pdf', LetterPdfController::class)->name('letters.pdf');

        Route::post('dokumen', [LetterDocumentController::class, 'store'])->name('letters.documents.store');
        Route::patch('dokumen/{document}', [LetterDocumentController::class, 'update'])
            ->whereNumber('document')
            ->name('letters.documents.update');
        Route::delete('dokumen/{document}', [LetterDocumentController::class, 'destroy'])
            ->whereNumber('document')
            ->name('letters.documents.destroy');
        Route::post('dokumen/{document}/terima', [LetterDocumentController::class, 'receive'])
            ->whereNumber('document')
            ->name('letters.documents.receive');
    });

    Route::get('team', [TeamController::class, 'index'])->name('team');
    Route::post('team', [TeamController::class, 'store'])->name('team.store');
    Route::patch('team/{user}', [TeamController::class, 'update'])
        ->whereNumber('user')
        ->name('team.update');
    Route::delete('team/{user}', [TeamController::class, 'destroy'])
        ->whereNumber('user')
        ->name('team.destroy');
    /* A PJ without an account has no id to address, so the name travels in
       the request body instead. */
    Route::patch('team/pj', [TeamController::class, 'renameName'])->name('team.pj.update');
    Route::delete('team/pj', [TeamController::class, 'destroyName'])->name('team.pj.destroy');
});

require __DIR__.'/settings.php';
