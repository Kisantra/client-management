<?php

namespace App\Support;

use App\Models\InstagramPost;
use App\Models\InstagramProfile;
use App\Models\InstagramSnapshot;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Reads the firm's own Instagram account through Apify.
 *
 * Instagram has no public API for this, so two rented scrapers stand in: one
 * for the account, one for its posts. Both are paid per run, so a refresh is
 * something a person asks for — never a poll — and everything it returns is
 * written down, because these numbers only exist in the moment they are read.
 */
class ApifyInstagram
{
    private const ENDPOINT = 'https://api.apify.com/v2/acts/%s/run-sync-get-dataset-items';

    public function __construct(private readonly array $config) {}

    public static function make(): self
    {
        return new self(config('services.apify'));
    }

    public function configured(): bool
    {
        return filled($this->config['token'] ?? null);
    }

    public function username(): string
    {
        return $this->config['instagram']['username'];
    }

    /**
     * Pull the account and its recent posts, and record what came back.
     *
     * @return array{posts: int, followers: int}
     */
    public function refresh(): array
    {
        if (! $this->configured()) {
            throw new RuntimeException('Token Apify belum diisi di .env.');
        }

        $username = $this->username();
        $settings = $this->config['instagram'];

        $account = $this->run($settings['profile_actor'], [
            'usernames' => [$username],
            'includeAboutSection' => false,
        ])[0] ?? null;

        if (! $account) {
            throw new RuntimeException("Akun @{$username} tidak ditemukan di Instagram.");
        }

        $posts = $this->run($settings['posts_actor'], [
            'username' => [$username],
            'resultsLimit' => $settings['posts_limit'],
            'skipPinnedPosts' => false,
            'dataDetailLevel' => 'detailedData',
        ]);

        return DB::transaction(function () use ($account, $posts, $username) {
            $profile = $this->storeProfile($username, $account);

            foreach ($posts as $post) {
                $this->storePost($profile, $post);
            }

            return [
                'posts' => count($posts),
                'followers' => $profile->followers,
            ];
        });
    }

    /** @return array<int, array<string, mixed>> */
    private function run(string $actor, array $input): array
    {
        try {
            $response = Http::timeout($this->config['instagram']['timeout'])
                ->connectTimeout(20)
                ->withQueryParameters(['token' => $this->config['token']])
                ->acceptJson()
                ->post(sprintf(self::ENDPOINT, $actor), $input);
        } catch (ConnectionException $e) {
            Log::warning('Apify tidak bisa dihubungi', ['actor' => $actor, 'error' => $e->getMessage()]);

            throw new RuntimeException('Apify tidak menjawab. Coba lagi sebentar lagi.');
        }

        if ($response->failed()) {
            Log::warning('Apify menolak permintaan', [
                'actor' => $actor,
                'status' => $response->status(),
                'body' => mb_substr($response->body(), 0, 500),
            ]);

            throw new RuntimeException(
                $response->status() === 401
                    ? 'Token Apify ditolak. Periksa APIFY_TOKEN di .env.'
                    : "Apify gagal menjalankan scraper (HTTP {$response->status()}).",
            );
        }

        return $response->json() ?? [];
    }

    private function storeProfile(string $username, array $data): InstagramProfile
    {
        $profile = InstagramProfile::firstOrNew(['username' => $username]);

        $profile->fill([
            'ig_id' => $data['id'] ?? null,
            'full_name' => $data['fullName'] ?? null,
            'biography' => $data['biography'] ?? null,
            'external_url' => $data['externalUrl'] ?? null,
            'followers' => (int) ($data['followersCount'] ?? 0),
            'follows' => (int) ($data['followsCount'] ?? 0),
            'posts_count' => (int) ($data['postsCount'] ?? 0),
            'verified' => (bool) ($data['verified'] ?? false),
            'is_business' => (bool) ($data['isBusinessAccount'] ?? false),
            'fetched_at' => now(),
        ]);

        $profile->save();

        $avatar = $this->mirror(
            $data['profilePicUrlHD'] ?? $data['profilePicUrl'] ?? null,
            "instagram/{$profile->id}/avatar.jpg",
            $profile->avatar_path,
        );

        if ($avatar !== $profile->avatar_path) {
            $profile->update(['avatar_path' => $avatar]);
        }

        /*
         | One snapshot per day, overwritten if the day is refreshed again: the
         | chart plots where the account stood, not how often someone looked.
         */
        InstagramSnapshot::updateOrCreate(
            [
                'instagram_profile_id' => $profile->id,
                'captured_on' => Carbon::today(),
            ],
            [
                'followers' => $profile->followers,
                'follows' => $profile->follows,
                'posts_count' => $profile->posts_count,
            ],
        );

        return $profile;
    }

    private function storePost(InstagramProfile $profile, array $data): void
    {
        $shortCode = $data['shortCode'] ?? null;

        if (! $shortCode) {
            return;
        }

        $post = InstagramPost::firstOrNew(['short_code' => $shortCode]);

        $post->fill([
            'instagram_profile_id' => $profile->id,
            'ig_id' => $data['id'] ?? null,
            'owner_username' => $data['ownerUsername'] ?? $profile->username,
            'type' => $data['type'] ?? 'Image',
            'product_type' => $data['productType'] ?? null,
            'caption' => $data['caption'] ?? null,
            'url' => $data['url'] ?? "https://www.instagram.com/p/{$shortCode}/",
            'likes' => max((int) ($data['likesCount'] ?? 0), 0),
            'comments' => max((int) ($data['commentsCount'] ?? 0), 0),
            'video_views' => isset($data['videoViewCount']) ? (int) $data['videoViewCount'] : null,
            'video_plays' => isset($data['videoPlayCount']) ? (int) $data['videoPlayCount'] : null,
            'video_duration' => isset($data['videoDuration']) ? (int) round($data['videoDuration']) : null,
            'music' => $data['musicInfo'] ?? null,
            'video_url' => $data['videoUrl'] ?? null,
            'hashtags' => $data['hashtags'] ?? [],
            'mentions' => $data['mentions'] ?? [],
            'tagged_users' => $this->taggedUsers($data),
            'slides' => max(count($data['childPosts'] ?? []), 1),
            'width' => isset($data['dimensionsWidth']) ? (int) $data['dimensionsWidth'] : null,
            'height' => isset($data['dimensionsHeight']) ? (int) $data['dimensionsHeight'] : null,
            'alt' => $data['alt'] ?? null,
            'location_name' => $data['locationName'] ?? null,
            'location_id' => $data['locationId'] ?? null,
            'first_comment' => ($data['firstComment'] ?? null) ?: null,
            'is_pinned' => (bool) ($data['isPinned'] ?? false),
            'paid_partnership' => (bool) ($data['paidPartnership'] ?? false),
            'comments_disabled' => (bool) ($data['isCommentsDisabled'] ?? false),
            /* Kept whole so a field this app does not read yet is not lost. */
            'payload' => $data,
            'posted_at' => isset($data['timestamp']) ? Carbon::parse($data['timestamp']) : now(),
            'fetched_at' => now(),
        ]);

        $post->save();

        $thumbnail = $this->mirror(
            $data['displayUrl'] ?? null,
            "instagram/{$profile->id}/posts/{$shortCode}.jpg",
            $post->thumbnail_path,
        );

        if ($thumbnail !== $post->thumbnail_path) {
            $post->update(['thumbnail_path' => $thumbnail]);
        }
    }

    /**
     * Who is tagged in the picture, as usernames.
     *
     * @return array<int, string>
     */
    private function taggedUsers(array $data): array
    {
        return collect($data['taggedUsers'] ?? [])
            ->map(fn ($user) => is_array($user) ? ($user['username'] ?? null) : $user)
            ->filter()
            ->values()
            ->all();
    }

    /**
     * Copy an Instagram image into this app's storage.
     *
     * Their URLs are signed and expire, so a stored link would show a broken
     * frame within days. A copy already held is kept: the picture does not
     * change, and refetching it on every refresh would cost 24 downloads for
     * nothing.
     */
    private function mirror(?string $url, string $path, ?string $existing): ?string
    {
        if (! $url) {
            return $existing;
        }

        $disk = Storage::disk('public');

        if ($existing && $disk->exists($existing)) {
            return $existing;
        }

        try {
            $response = Http::timeout(20)->get($url);

            if ($response->failed()) {
                return $existing;
            }

            $disk->put($path, $response->body());

            return $path;
        } catch (ConnectionException) {
            return $existing;
        }
    }
}
