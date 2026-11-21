<?php

use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;
use Illuminate\Broadcasting\BroadcastManager;
use Illuminate\Broadcasting\Channel;

/**
 * The address, without its signed query, that the Reverb connection posts one
 * broadcast to, with the connection built by config/broadcasting.php from
 * these environment values. The request is captured, not sent.
 *
 * @param  array<string, string>  $env
 */
function reverbBroadcastUrl(array $env): string
{
    $previous = [];

    foreach ($env as $key => $value) {
        $previous[$key] = [$_ENV[$key] ?? null, $_SERVER[$key] ?? null];
        $_ENV[$key] = $_SERVER[$key] = $value;
    }

    try {
        $config = (require base_path('config/broadcasting.php'))['connections']['reverb'];
    } finally {
        foreach ($previous as $key => [$env, $server]) {
            if ($env === null) {
                unset($_ENV[$key]);
            } else {
                $_ENV[$key] = $env;
            }

            if ($server === null) {
                unset($_SERVER[$key]);
            } else {
                $_SERVER[$key] = $server;
            }
        }
    }

    $sent = [];
    $handler = HandlerStack::create(new MockHandler([new Response(200, [], '{}')]));
    $handler->push(Middleware::history($sent));

    config(['broadcasting.connections.reverb' => [...$config, 'client_options' => ['handler' => $handler]]]);

    $manager = app(BroadcastManager::class);
    $manager->purge('reverb');
    $manager->connection('reverb')->broadcast([new Channel('contents')], 'ContentCommentAdded', []);

    expect($sent)->toHaveCount(1);

    return (string) $sent[0]['request']->getUri()->withQuery('');
}

it('broadcasts over https when Reverb sits on port 443, whatever the scheme says', function () {
    // Production: Reverb behind Cloudflare on 443 with REVERB_SCHEME=http.
    // Plain http there is answered "400 The plain HTTP request was sent to
    // HTTPS port" (Watchpost #4).
    $url = reverbBroadcastUrl([
        'REVERB_APP_ID' => '722663166',
        'REVERB_APP_KEY' => 'key',
        'REVERB_APP_SECRET' => 'secret',
        'REVERB_HOST' => 'marketing.kisantra.com',
        'REVERB_PORT' => '443',
        'REVERB_SCHEME' => 'http',
    ]);

    expect($url)->toBe('https://marketing.kisantra.com/apps/722663166/events');
});

it('keeps a local Reverb on plain http', function () {
    $url = reverbBroadcastUrl([
        'REVERB_APP_ID' => '1',
        'REVERB_APP_KEY' => 'key',
        'REVERB_APP_SECRET' => 'secret',
        'REVERB_HOST' => 'localhost',
        'REVERB_PORT' => '8080',
        'REVERB_SCHEME' => 'http',
    ]);

    expect($url)->toBe('http://localhost:8080/apps/1/events');
});
