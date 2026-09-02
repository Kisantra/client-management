<?php

/*
|--------------------------------------------------------------------------
| Content production
|--------------------------------------------------------------------------
|
| The channels the team publishes to, the pillar a piece belongs to, the
| shape it takes, and the QA stages it moves through. This is the single
| source of truth: the form offers exactly these, the rule checks exactly
| these, and no screen keeps its own copy.
|
| WhatsApp is deliberately absent. It brings leads in, so it is a lead
| channel in config/pipeline.php, but nothing is published there.
|
*/

return [

    /*
    | A piece can go out on several at once — the same cut posted to
    | Instagram, Facebook and TikTok is one piece of work, not three.
    */
    'channels' => [
        'instagram' => 'Instagram',
        'facebook' => 'Facebook',
        'twitter' => 'Twitter',
        'linkedin' => 'LinkedIn',
        'tiktok' => 'TikTok',
        'web' => 'Web/SEO',
    ],

    /*
    | What the piece is for. One pillar per piece: a post that is trying to
    | do three things at once is usually doing none of them.
    */
    'pillars' => [
        'informasi' => 'Informasi',
        'edukasi' => 'Edukasi',
        'interaksi' => 'Interaksi',
        'tips' => 'Tips',
        'meet_the_team' => 'Meet the Team',
        'greetings' => 'Greetings',
        'employee_engagement' => 'Employee Engagement',
        'testimonial' => 'Testimonial',
    ],

    /*
    | The shape it takes. Flat rather than per-channel: once a piece can go
    | to several channels at once, a format that belongs to only one of them
    | has nothing to attach to.
    */
    'types' => [
        'single_photo' => 'Single Photo',
        'carousel' => 'Carousel',
        'videos' => 'Videos',
        'story' => 'Story',
        'short_video' => 'Short Video',
        'motion' => 'Motion',
        'artikel' => 'Artikel',
    ],

    /*
    | The QA stages, in order. Review and approval are internal: nobody
    | outside the firm ever holds a piece up.
    */
    'statuses' => [
        ['key' => 'draft', 'label' => 'Draft', 'hint' => 'Sedang ditulis atau dibuat.'],
        ['key' => 'review', 'label' => 'Review', 'hint' => 'Menunggu dicek rekan atau lead tim.'],
        ['key' => 'approved', 'label' => 'Approved', 'hint' => 'Lolos review, tinggal ditayangkan.'],
        ['key' => 'published', 'label' => 'Published', 'hint' => 'Sudah tayang di channel-nya.'],
    ],

    /*
    | Days a piece may sit in a QA stage before it counts as stuck
    | ("tertahan"). Published is the end of the road, so it has no limit.
    */
    'stuck_after_days' => [
        'draft' => 7,
        'review' => 3,
        'approved' => 5,
    ],

];
