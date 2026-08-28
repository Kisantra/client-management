<?php

namespace App\Http\Controllers;

use Inertia\Inertia;

abstract class Controller
{
    /**
     * Say what just happened, once, on the page the user lands on.
     *
     * Inertia carries this through the redirect and the client turns it into a
     * toast, so a saved change is confirmed by the server that saved it rather
     * than by the browser that asked.
     */
    protected function toast(string $message, ?string $description = null, string $type = 'success'): void
    {
        Inertia::flash('toast', array_filter([
            'type' => $type,
            'message' => $message,
            'description' => $description,
        ]));
    }
}
