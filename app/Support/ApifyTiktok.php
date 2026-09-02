<?php

namespace App\Support;

use App\Models\TiktokPost;
use App\Models\TiktokProfile;
use App\Models\TiktokSnapshot;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Reads the firm's own TikTok account through Apify.
 *
 * One rented scraper, not two: asked for a profile's videos, this actor
 * returns each video with the whole account attached to it, so the account is
 * read off the first item rather than paid for separately. It is billed per
 * run either way, so a refresh is something a person asks for — never a poll
 * — and everything it returns is written down, because these numbers only
 * exist in the moment they are read.
 *
 * The account's own numbers are the same on every item, which is exactly why
 * an empty result has to be an error rather than an empty account: a run that
 * returns nothing has told us nothing, and writing zero followers would be
 * this app inventing a fact.
 */
class ApifyTiktok
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
        return $this->config['tiktok']['username'];
    }

    /**
     * Pull the account and its recent videos, and record what came back.
     *
     * @return array{posts: int, followers: int}
     */
    public function refresh(): array
    {
        if (! $this->configured()) {
            throw new RuntimeException('Token Apify belum diisi di .env.');
        }

        $username = $this->username();
        $settings = $this->config['tiktok'];

        $videos = $this->run($settings['actor'], [
            'profiles' => [$username],
            'profileScrapeSections' => ['videos'],
            'profileSorting' => 'latest',
            'resultsPerPage' => $settings['posts_limit'],
            'excludePinnedPosts' => false,
            /*
             | The one thing worth having Apify fetch. TikTok's payload carries
             | no video link at all, so without this the file is unreachable
             | afterwards at any price; with it, each item comes back with a
             | URL into a named key-value store that this app can copy from
             | when somebody asks to watch. Nothing is downloaded here — the
             | copying happens one video at a time, on request.
             */
            'shouldDownloadVideos' => true,
            'videoKvStoreIdOrName' => $settings['video_store'],
            'shouldDownloadCovers' => false,
            'shouldDownloadSlideshowImages' => false,
            'shouldDownloadAvatars' => false,
            'shouldDownloadMusicCovers' => false,
            'downloadSubtitlesOptions' => 'NEVER_DOWNLOAD_SUBTITLES',
            /* Comments are a second, larger bill for something no screen reads. */
            'commentsPerPost' => 0,
            'topLevelCommentsPerPost' => 0,
            'maxRepliesPerComment' => 0,
            'maxFollowersPerProfile' => 0,
            'maxFollowingPerProfile' => 0,
        ]);

        $author = $this->author($videos);

        if (! $author) {
            throw new RuntimeException("Akun @{$username} tidak ditemukan di TikTok, atau belum punya video.");
        }

        return DB::transaction(function () use ($author, $videos, $username) {
            $profile = $this->storeProfile($username, $author);

            foreach ($videos as $video) {
                $this->storePost($profile, $video);
            }

            return [
                'posts' => count($videos),
                'followers' => $profile->followers,
            ];
        });
    }

    /**
     * The account, off whichever item carries it.
     *
     * @param  array<int, array<string, mixed>>  $videos
     * @return array<string, mixed>|null
     */
    private function author(array $videos): ?array
    {
        foreach ($videos as $video) {
            if (filled($video['authorMeta']['name'] ?? null)) {
                return $video['authorMeta'];
            }
        }

        return null;
    }

    /** @return array<int, array<string, mixed>> */
    private function run(string $actor, array $input): array
    {
        try {
            $response = Http::timeout($this->config['tiktok']['timeout'])
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

    private function storeProfile(string $username, array $data): TiktokProfile
    {
        $profile = TiktokProfile::firstOrNew(['username' => $username]);

        $profile->fill([
            'tiktok_id' => $data['id'] ?? null,
            'nickname' => $data['nickName'] ?? null,
            'signature' => $data['signature'] ?? null,
            'bio_link' => $data['bioLink'] ?? null,
            'profile_url' => $data['profileUrl'] ?? "https://www.tiktok.com/@{$username}",
            'followers' => (int) ($data['fans'] ?? 0),
            'following' => (int) ($data['following'] ?? 0),
            'hearts' => (int) ($data['heart'] ?? 0),
            'videos_count' => (int) ($data['video'] ?? 0),
            'verified' => (bool) ($data['verified'] ?? false),
            'private' => (bool) ($data['privateAccount'] ?? false),
            'payload' => $data,
            'fetched_at' => now(),
        ]);

        $profile->save();

        $avatar = $this->mirror(
            $data['originalAvatarUrl'] ?? $data['avatar'] ?? null,
            "tiktok/{$profile->id}/avatar.jpg",
            $profile->avatar_path,
        );

        if ($avatar !== $profile->avatar_path) {
            $profile->update(['avatar_path' => $avatar]);
        }

        /*
         | One snapshot per day, overwritten if the day is refreshed again: the
         | chart plots where the account stood, not how often someone looked.
         */
        TiktokSnapshot::updateOrCreate(
            [
                'tiktok_profile_id' => $profile->id,
                'captured_on' => Carbon::today(),
            ],
            [
                'followers' => $profile->followers,
                'following' => $profile->following,
                'hearts' => $profile->hearts,
                'videos_count' => $profile->videos_count,
            ],
        );

        return $profile;
    }

    private function storePost(TiktokProfile $profile, array $data): void
    {
        $id = $data['id'] ?? null;

        if (! $id) {
            return;
        }

        $meta = $data['videoMeta'] ?? [];
        $post = TiktokPost::firstOrNew(['post_id' => (string) $id]);

        $post->fill([
            'tiktok_profile_id' => $profile->id,
            'caption' => ($data['text'] ?? null) ?: null,
            'text_language' => $data['textLanguage'] ?? null,
            'url' => $data['webVideoUrl'] ?? "https://www.tiktok.com/@{$profile->username}/video/{$id}",
            'likes' => max((int) ($data['diggCount'] ?? 0), 0),
            'comments' => max((int) ($data['commentCount'] ?? 0), 0),
            'plays' => max((int) ($data['playCount'] ?? 0), 0),
            'shares' => max((int) ($data['shareCount'] ?? 0), 0),
            'saves' => max((int) ($data['collectCount'] ?? 0), 0),
            'is_slideshow' => (bool) ($data['isSlideshow'] ?? false),
            'is_pinned' => (bool) ($data['isPinned'] ?? false),
            'is_ad' => (bool) ($data['isAd'] ?? false),
            /* A slideshow reports zeroes for all three; null says "not a video"
               where a nought would say "a video of no length". */
            'duration' => ($meta['duration'] ?? 0) > 0 ? (int) $meta['duration'] : null,
            'width' => ($meta['width'] ?? 0) > 0 ? (int) $meta['width'] : null,
            'height' => ($meta['height'] ?? 0) > 0 ? (int) $meta['height'] : null,
            'definition' => ($meta['definition'] ?? null) ?: null,
            'hashtags' => $this->hashtags($data),
            'mentions' => array_values(array_filter((array) ($data['mentions'] ?? []))),
            'music' => $this->music($data),
            'location_name' => ($data['locationMeta']['locationName'] ?? null) ?: null,
            /* Where the file can still be fetched from, while the link lasts. */
            'video_url' => $this->videoSource($data),
            /* Kept whole so a field this app does not read yet is not lost. */
            'payload' => $data,
            'posted_at' => isset($data['createTimeISO'])
                ? Carbon::parse($data['createTimeISO'])
                : now(),
            'fetched_at' => now(),
        ]);

        $post->save();

        $cover = $this->mirror(
            $meta['originalCoverUrl'] ?? $meta['coverUrl'] ?? null,
            "tiktok/{$profile->id}/posts/{$id}.jpg",
            $post->cover_path,
        );

        if ($cover !== $post->cover_path) {
            $post->update(['cover_path' => $cover]);
        }
    }

    /**
     * The link to the video file, as Apify hands it back.
     *
     * A slideshow has no video and reports an empty list; so does any run made
     * before this app started asking for them, which is why a missing link is
     * a normal state the screens have to be able to show.
     */
    private function videoSource(array $data): ?string
    {
        foreach ((array) ($data['mediaUrls'] ?? []) as $url) {
            if (is_string($url) && str_contains($url, 'http')) {
                return $url;
            }
        }

        return null;
    }

    /**
     * Hashtags as plain words, the way Instagram's already arrive.
     *
     * TikTok sends them as objects; unwrapping here means every screen reads
     * one shape whichever account it is looking at.
     *
     * @return array<int, string>
     */
    private function hashtags(array $data): array
    {
        return collect($data['hashtags'] ?? [])
            ->map(fn ($tag) => is_array($tag) ? ($tag['name'] ?? null) : $tag)
            ->filter()
            ->values()
            ->all();
    }

    /**
     * The track, and whether the account made it.
     *
     * @return array<string, mixed>|null
     */
    private function music(array $data): ?array
    {
        $music = $data['musicMeta'] ?? null;

        if (! is_array($music) || blank($music['musicName'] ?? null)) {
            return null;
        }

        return [
            'song' => $music['musicName'],
            'artist' => $music['musicAuthor'] ?? null,
            'original' => (bool) ($music['musicOriginal'] ?? false),
        ];
    }

    /**
     * Copy a TikTok image into this app's storage.
     *
     * Their URLs are signed and expire, so a stored link would show a broken
     * frame within days. A copy already held is kept: the picture does not
     * change, and refetching it on every refresh would cost sixty downloads
     * for nothing.
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
