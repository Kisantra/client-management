<?php

namespace App\Http\Middleware;

use App\Models\Content;
use App\Models\Lead;
use App\Support\ContentPlan;
use App\Support\Pipeline;
use Closure;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Middleware;
use Inertia\Support\SessionKey;
use Symfony\Component\HttpFoundation\Response;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Keep a flashed message alive through a prefetch.
     *
     * Rendering a page consumes the flash, and a prefetch renders a page the
     * user has not asked for yet — hovering a link after saving would eat the
     * confirmation before the real visit could show it. A guess must not spend
     * what the next visit is owed.
     */
    public function handle(Request $request, Closure $next, ...$args): Response
    {
        $flashed = $request->prefetch() ? Inertia::getFlashed($request) : [];

        $response = parent::handle($request, $next, ...$args);

        if ($flashed !== [] && $request->hasSession()) {
            $request->session()->flash(SessionKey::FLASH_DATA, $flashed);
        }

        return $response;
    }

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'auth' => [
                'user' => $request->user(),
            ],
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',

            /*
             | The pipeline itself, so no screen keeps its own copy of the
             | stages, their tolerances, or which of them cannot be entered
             | without a document. config/pipeline.php is the only source.
             */
            'pipeline' => [
                'stages' => Pipeline::forClient(),
                'requirements' => (object) config('pipeline.requires_document'),
                'channels' => (object) Pipeline::channels(),
                'followUpVia' => Pipeline::followUpVia(),
                'services' => Pipeline::services(),
                'closeReasons' => Pipeline::closeReasons(),
            ],

            /*
             | config/content.php, the same way. Named apart from the `content`
             | prop a page may carry, so a piece's own record can never shadow
             | the plan it is read against.
             */
            'contentPlan' => ContentPlan::forClient(),

            // Sidebar badges: what each module actually holds right now.
            'counts' => fn () => $request->user() ? [
                'leads' => Lead::active()->count(),
                'clients' => Lead::active()->where('stage', 'client')->count(),
                // Still in production: everything not yet live.
                'content' => Content::where('status', '!=', Content::PUBLISHED)->count(),
            ] : null,
        ];
    }
}
