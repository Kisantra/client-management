<?php

namespace App\Http\Controllers;

use App\Support\SocialPlatform;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Keeping one video, when somebody asks to watch it.
 *
 * Both platforms serve their files from signed URLs that stop working within
 * days, so a post whose only video is a link is a post that will not play next
 * month. Copying the file makes the archive an archive.
 *
 * One at a time, on request, rather than sixty during a scrape: sixty videos
 * is half a gigabyte and ten minutes of wall time, and the refresh already
 * runs inside a request the team is standing in front of. Asking to watch is
 * also the only moment anyone has said this particular video is worth the
 * disk.
 */
class SocialVideoController extends Controller
{
    /** A video this size is a scrape gone wrong, not a post. */
    private const MAX_BYTES = 200 * 1024 * 1024;

    public function store(Request $request, string $platform, string $code)
    {
        $reader = SocialPlatform::for(
            in_array($platform, SocialPlatform::KEYS, true) ? $platform : 'instagram',
        );

        $profile = $reader->profile();
        $post = $profile?->posts()
            ->where($reader->key() === 'tiktok' ? 'post_id' : 'short_code', $code)
            ->first();

        if (! $post) {
            $this->toast('Konten tidak ditemukan', 'Coba perbarui datanya dulu.', 'error');

            return back();
        }

        if ($post->videoUrl()) {
            /* Already here. Saying so beats fetching six megabytes twice. */
            return back();
        }

        if (! $post->videoSource()) {
            $this->toast(
                'Belum ada tautan videonya',
                $reader->key() === 'tiktok'
                    ? 'Tekan Perbarui data sekali lagi — pengambilan terakhir belum meminta file videonya.'
                    : 'Konten ini bukan video, atau tautannya tidak ikut tersimpan.',
                'error',
            );

            return back();
        }

        $path = $this->fetch($reader, $profile, $post);

        if (! $path) {
            $this->toast(
                'Video gagal diunduh',
                'Tautannya mungkin sudah kedaluwarsa. Perbarui data, lalu coba lagi.',
                'error',
            );

            return back();
        }

        $post->update(['video_path' => $path]);

        $this->toast(
            'Video tersimpan',
            'Sekarang diputar dari salinan sendiri, bukan dari tautan yang bisa kedaluwarsa.',
        );

        return back();
    }

    /**
     * Copy the file across, or say plainly that it did not arrive.
     *
     * Streamed to disk rather than held in memory: a sixty-second video is
     * several megabytes, and reading it into a string to write it out again
     * costs that twice for no reason.
     */
    private function fetch(SocialPlatform $reader, Model $profile, Model $post): ?string
    {
        $path = "{$reader->key()}/{$profile->id}/videos/{$post->key()}.mp4";
        $disk = Storage::disk('public');

        try {
            $response = Http::timeout(180)->connectTimeout(20)->get($post->videoSource());
        } catch (ConnectionException $e) {
            Log::warning('Video tidak bisa diunduh', [
                'platform' => $reader->key(),
                'post' => $post->key(),
                'error' => $e->getMessage(),
            ]);

            return null;
        }

        if ($response->failed()) {
            return null;
        }

        $body = $response->body();

        /* An HTML error page is not a video, however healthy its status was. */
        if ($body === '' || strlen($body) > self::MAX_BYTES) {
            return null;
        }

        $disk->put($path, $body);

        return $path;
    }
}
