<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\BroadcastMessage;
use Illuminate\Notifications\Notification;

/**
 * A review note landed on a piece of content.
 *
 * Sent to everyone but the writer: whoever owns the piece needs to act on
 * it, and nobody is assigned reviewer by role yet, so the whole team is the
 * audience. Carried as plain values, not models, so nothing here can break when
 * the comment it describes is later deleted.
 *
 * Deliberately not queued: the database copy is written in the same request,
 * so the bell is always right even when no queue worker is running. Only the
 * realtime push rides the queue — Laravel broadcasts the notification as an
 * event, and broadcast events are queued on their own.
 */
class ContentCommentAdded extends Notification
{
    public function __construct(
        public string $actor,
        public int $contentId,
        public string $contentTitle,
        public string $excerpt,
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
            'kind' => 'komentar',
            'title' => $this->actor.' menambahkan catatan review',
            'body' => $this->contentTitle.' — "'.$this->excerpt.'"',
            'url' => route('content', ['konten' => $this->contentId], false),
        ];
    }

    public function toBroadcast(object $notifiable): BroadcastMessage
    {
        return new BroadcastMessage($this->toArray($notifiable));
    }
}
