<?php

namespace App\Support;

use App\Models\InstagramPost;
use App\Models\InstagramProfile;
use App\Models\TiktokPost;
use App\Models\TiktokProfile;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

/**
 * Which account the Performa pages are looking at.
 *
 * The two platforms are stored apart because they are counted in different
 * currencies — Instagram reports plays and reach and carousel slides, TikTok
 * reports shares and saves and the track a video used — and folding them into
 * one table would mean a row half of whose columns are structurally null.
 *
 * They meet here instead: everything that differs between them is named once
 * in this file, and the statistics behind it are written for neither. Adding
 * LinkedIn later means another subclass, not another page.
 */
abstract class SocialPlatform
{
    /** Every platform the Performa pages offer, in the order they offer them. */
    public const KEYS = ['instagram', 'tiktok'];

    public static function for(?string $key): self
    {
        return $key === 'tiktok' ? new TiktokPlatform : new InstagramPlatform;
    }

    abstract public function key(): string;

    abstract public function label(): string;

    abstract public function handle(): string;

    abstract public function configured(): bool;

    /** Runs the scrapers. @return array{posts: int, followers: int} */
    abstract public function refresh(): array;

    abstract public function profile(): ?Model;

    /** The account as the header band reads it. @return array<string, mixed> */
    abstract public function account(Model $profile): array;

    /** The shapes a post can take here, key to label. @return array<string, string> */
    abstract public function formats(): array;

    abstract public function whereFormat(Builder $query, string $format): Builder;

    /**
     * What a rate is measured against here, and what to call it.
     *
     * Instagram shows a post to its followers; TikTok shows it to whoever the
     * For You page decides. Dividing by the same denominator on both would
     * report a rate over a thousand per cent on one of them.
     *
     * @param  Collection<int, Model>  $posts
     * @return array{value: int, noun: string}
     */
    abstract public function rateBasis(Model $profile, Collection $posts): array;

    /** The column the "most played" sort orders by. */
    abstract public function playsColumn(): string;

    /**
     * Interactions in SQL, matching what the model counts in PHP.
     *
     * The list sorts in the database and the figures are computed on the
     * model, so these two have to agree: TikTok counts shares and saves as
     * interactions and Instagram cannot, and a sort written for one of them
     * silently ranks the other by the wrong thing.
     */
    abstract public function interactionsSql(): string;

    /**
     * The fourth tile: the one figure this platform has that the other's
     * three shared ones do not cover.
     *
     * @param  Collection<int, Model>  $posts
     * @return array<string, mixed>
     */
    abstract public function highlight(Collection $posts): array;

    /** Extra facts the detail panel shows only for this platform. */
    abstract public function extras(Model $post): array;

    /** @return array<int, array{key: string, label: string}> */
    public static function all(): array
    {
        return collect(self::KEYS)
            ->map(fn (string $key) => [
                'key' => $key,
                'label' => self::for($key)->label(),
            ])
            ->all();
    }
}

/** @internal */
class InstagramPlatform extends SocialPlatform
{
    public function key(): string
    {
        return 'instagram';
    }

    public function label(): string
    {
        return 'Instagram';
    }

    public function handle(): string
    {
        return ApifyInstagram::make()->username();
    }

    public function configured(): bool
    {
        return ApifyInstagram::make()->configured();
    }

    public function refresh(): array
    {
        return ApifyInstagram::make()->refresh();
    }

    public function profile(): ?Model
    {
        return InstagramProfile::with('snapshots')
            ->where('username', $this->handle())
            ->first();
    }

    public function account(Model $profile): array
    {
        return [
            'platform' => 'instagram',
            'username' => $profile->username,
            'name' => $profile->full_name,
            'biography' => $profile->biography,
            'url' => 'https://www.instagram.com/'.$profile->username.'/',
            'externalUrl' => $profile->external_url,
            'avatar' => $profile->avatarUrl(),
            'verified' => $profile->verified,
            'business' => $profile->is_business,
            'follows' => $profile->follows,
            'postsOnAccount' => $profile->posts_count,
            'fetchedAt' => $profile->fetched_at?->toIso8601String(),
        ];
    }

    public function formats(): array
    {
        return [
            'reel' => 'Reel',
            'carousel' => 'Carousel',
            'foto' => 'Foto',
            'video' => 'Video',
        ];
    }

    public function whereFormat(Builder $query, string $format): Builder
    {
        return match ($format) {
            'reel' => $query->where('product_type', 'clips'),
            'video' => $query->where('type', 'Video')
                ->where(fn (Builder $inner) => $inner
                    ->whereNull('product_type')
                    ->orWhere('product_type', '!=', 'clips')),
            'carousel' => $query->where('type', 'Sidecar'),
            default => $query->where('type', 'Image'),
        };
    }

    public function rateBasis(Model $profile, Collection $posts): array
    {
        return ['value' => $profile->followers, 'noun' => 'pengikut'];
    }

    public function playsColumn(): string
    {
        return 'video_plays';
    }

    public function interactionsSql(): string
    {
        return '(likes + comments)';
    }

    public function highlight(Collection $posts): array
    {
        $reels = $posts->filter(fn (InstagramPost $post) => $post->isReel());

        return [
            'label' => 'Pemutaran Reel',
            'hint' => 'Rata-rata pemutaran tiap Reel. Format lain tidak dihitung karena tidak punya angka ini.',
            'value' => (int) round($reels->avg('video_plays') ?? 0),
            'note' => $reels->count().' reel · '
                .(int) round($reels->avg('video_views') ?? 0).' view rata-rata',
        ];
    }

    public function extras(Model $post): array
    {
        return [
            'slides' => $post->slides,
            'views' => $post->video_views,
            'alt' => $post->alt,
            'taggedUsers' => $post->tagged_users ?? [],
            'firstComment' => $post->first_comment ?: null,
            'paidPartnership' => $post->paid_partnership,
            'commentsDisabled' => $post->comments_disabled,
        ];
    }
}

/** @internal */
class TiktokPlatform extends SocialPlatform
{
    public function key(): string
    {
        return 'tiktok';
    }

    public function label(): string
    {
        return 'TikTok';
    }

    public function handle(): string
    {
        return ApifyTiktok::make()->username();
    }

    public function configured(): bool
    {
        return ApifyTiktok::make()->configured();
    }

    public function refresh(): array
    {
        return ApifyTiktok::make()->refresh();
    }

    public function profile(): ?Model
    {
        return TiktokProfile::with('snapshots')
            ->where('username', $this->handle())
            ->first();
    }

    public function account(Model $profile): array
    {
        return [
            'platform' => 'tiktok',
            'username' => $profile->username,
            'name' => $profile->nickname,
            'biography' => $profile->signature,
            'url' => $profile->profile_url ?: 'https://www.tiktok.com/@'.$profile->username,
            'externalUrl' => $profile->bio_link,
            'avatar' => $profile->avatarUrl(),
            'verified' => $profile->verified,
            'business' => false,
            'follows' => $profile->following,
            'postsOnAccount' => $profile->videos_count,
            'fetchedAt' => $profile->fetched_at?->toIso8601String(),
        ];
    }

    public function formats(): array
    {
        return [
            'video' => 'Video',
            'slideshow' => 'Slideshow',
        ];
    }

    public function whereFormat(Builder $query, string $format): Builder
    {
        return $query->where('is_slideshow', $format === 'slideshow');
    }

    public function rateBasis(Model $profile, Collection $posts): array
    {
        /* The typical video's plays, for the same reason every other figure
           on the page is a median: one video reached a hundred times what the
           rest did, and a mean would describe none of them. */
        $plays = $posts->map(fn (TiktokPost $post) => $post->plays)->filter()->sort()->values();

        $typical = $plays->isEmpty()
            ? 0
            : (int) round(
                $plays->count() % 2 === 1
                    ? $plays[intdiv($plays->count(), 2)]
                    : ($plays[intdiv($plays->count(), 2) - 1] + $plays[intdiv($plays->count(), 2)]) / 2
            );

        return $typical > 0
            ? ['value' => $typical, 'noun' => 'pemutaran']
            : ['value' => $profile->followers, 'noun' => 'pengikut'];
    }

    public function playsColumn(): string
    {
        return 'plays';
    }

    public function interactionsSql(): string
    {
        return '(likes + comments + shares + saves)';
    }

    /**
     * Saves, not plays.
     *
     * Plays are already the biggest number on the page and the one TikTok
     * hands out most freely; a save is the viewer deciding to come back to it,
     * which for tax advice is the strongest thing they can do short of asking.
     */
    public function highlight(Collection $posts): array
    {
        $saves = $posts->sum(fn (TiktokPost $post) => $post->saves);

        return [
            'label' => 'Disimpan',
            'hint' => 'Berapa kali konten disimpan penonton untuk dibuka lagi. Sinyal terkuat yang bisa diberikan sebuah konten edukasi.',
            'value' => $saves,
            'note' => $posts->sum(fn (TiktokPost $post) => $post->shares).' dibagikan · '
                .(int) round($posts->avg('plays') ?? 0).' pemutaran rata-rata',
        ];
    }

    public function extras(Model $post): array
    {
        return [
            'slides' => 1,
            'views' => null,
            'alt' => null,
            'taggedUsers' => [],
            'firstComment' => null,
            'paidPartnership' => $post->is_ad,
            'commentsDisabled' => false,
        ];
    }
}
