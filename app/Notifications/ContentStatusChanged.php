<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

/**
 * A piece moved along the QA flow.
 *
 * The move into Review is the one that summons a reviewer; the move to
 * Published is the one the planner is waiting on. Everyone but the mover
 * hears about it, carried as plain values so the queued copy cannot break.
 *
 * Deliberately not queued: the database copy is written in the same request,
 * so the bell is always right even when no queue worker is running. Only the
 * realtime push rides the queue — Laravel broadcasts the notification as an
 * event, and broadcast events are queued on their own.
 */
class ContentStatusChanged extends Notification
{
    public function __construct(
        public string $actor,
        public int $contentId,
        public string $contentTitle,
        public string $fromLabel,
        public string $toLabel,
    ) {}

    /** @return array<int, string> */
    public function via(object $notifiable): array
    {
        return ['database', 'broadcast'];
    }

    /** @return array<string, string> */
    public function toArray(object $notifiable): array
    {
        return [
            'kind' => 'status',
            'title' => $this->actor.' memindahkan konten ke '.$this->toLabel,
            'body' => $this->contentTitle.' — '.$this->fromLabel.' → '.$this->toLabel,
            'url' => route('content', ['konten' => $this->contentId], false),
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
