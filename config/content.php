<?php

/*
|--------------------------------------------------------------------------
| Content production
|--------------------------------------------------------------------------
|
| The channels the team publishes to, what each of them can carry, and the
| statuses a piece moves through before it is live. This is the single
| source of truth: the form offers exactly these, the rule checks exactly
| these, and no screen keeps its own copy.
|
| WhatsApp is deliberately absent. It brings leads in, so it is a lead
| channel in config/pipeline.php, but nothing is published there.
|
*/

return [

    'channels' => ['instagram', 'tiktok', 'linkedin', 'web'],

    'formats' => [
        'instagram' => [
            'feed' => 'Feed',
            'carousel' => 'Carousel',
            'reels' => 'Reels',
            'story' => 'Story',
        ],
        'tiktok' => [
            'video' => 'Video',
            'story' => 'Story',
        ],
        'linkedin' => [
            'post' => 'Post',
            'artikel' => 'Artikel',
            'dokumen' => 'Dokumen',
        ],
        'web' => [
            'artikel' => 'Artikel',
            'halaman' => 'Halaman layanan',
            'update' => 'Update regulasi',
        ],
    ],

    /*
    | In order. Review and approval are internal: nobody outside the firm
    | ever holds a piece up.
    */
    'statuses' => [
        ['key' => 'draft', 'label' => 'Draft', 'hint' => 'Sedang ditulis atau dibuat.'],
        ['key' => 'review', 'label' => 'Review', 'hint' => 'Menunggu dicek rekan atau lead tim.'],
        ['key' => 'approved', 'label' => 'Approved', 'hint' => 'Lolos review, tinggal ditayangkan.'],
        ['key' => 'published', 'label' => 'Published', 'hint' => 'Sudah tayang di channel-nya.'],
    ],

    /*
    | Days a piece may sit in a status before it counts as stuck
    | ("tertahan"). Published is the end of the road, so it has no limit.
    */
    'stuck_after_days' => [
        'draft' => 7,
        'review' => 3,
        'approved' => 5,
    ],

];
