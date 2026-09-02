<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    /*
    | Apify runs the Instagram scrapers. The actor ids are the ones the team
    | subscribed to; the account below is the firm's own, and the only one this
    | app is allowed to read.
    */
    'apify' => [
        'token' => env('APIFY_TOKEN'),
        'instagram' => [
            'username' => env('APIFY_IG_USERNAME', 'kisantra.official'),
            'profile_actor' => env('APIFY_IG_PROFILE_ACTOR', 'dSCLg0C3YEZ83HzYX'),
            'posts_actor' => env('APIFY_IG_POSTS_ACTOR', 'nH2AHrwxeTRJoN5hX'),
            /* How many posts each refresh pulls. Every one is a paid result. */
            'posts_limit' => (int) env('APIFY_IG_POSTS_LIMIT', 60),
            /* Seconds to wait on a run. The two scrapers take ~25-40s each. */
            'timeout' => (int) env('APIFY_TIMEOUT', 180),
        ],
        'tiktok' => [
            'username' => env('APIFY_TT_USERNAME', 'kisantra.official'),
            /* One actor: asked for a profile's videos, it returns the account
               attached to every one of them. */
            'actor' => env('APIFY_TT_ACTOR', '0FXVyOXXEmdGcV88a'),
            /* How many videos each refresh pulls. Every one is a paid result. */
            'posts_limit' => (int) env('APIFY_TT_POSTS_LIMIT', 60),
            /* A named store, so the video links outlive the run that made
               them; an unnamed one is swept after a few days. */
            'video_store' => env('APIFY_TT_VIDEO_STORE', 'kisantra-tiktok-videos'),
            'timeout' => (int) env('APIFY_TIMEOUT', 300),
        ],
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

];
