<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;

/**
 * The bell's two verbs. Reading happens by clicking through, so marking is
 * all that is left: one, on the way to what it points at, or all at once.
 */
class NotificationController extends Controller
{
    public function read(Request $request, string $id)
    {
        $request->user()
            ->notifications()
            ->whereKey($id)
            ->firstOrFail()
            ->markAsRead();

        return back();
    }

    public function readAll(Request $request)
    {
        $request->user()->unreadNotifications->markAsRead();

        $this->toast('Semua notifikasi ditandai dibaca');

        return back();
    }
}
