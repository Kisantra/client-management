<?php

namespace App\Http\Middleware;

use App\Support\ProjectManagement;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The door Project Management knocks on. Nobody else has the token, and with
 * no token configured the door stays shut rather than open to anyone.
 */
class VerifyProjectManagementToken
{
    public function handle(Request $request, Closure $next): Response
    {
        if (! ProjectManagement::accepts($request->bearerToken())) {
            return response()->json(['message' => 'Token tidak dikenal.'], 401);
        }

        return $next($request);
    }
}
