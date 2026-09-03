<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The dates the calendar plans around.
 *
 * A tax firm's content year is not evenly spread: it bunches around the two
 * annual filing deadlines, the monthly ones, and the national days everyone
 * else is posting about. Holding them as rows means the calendar can show what
 * a week is really up against instead of the team remembering it.
 *
 * `confirmed` is the important column. Fixed-date holidays and the deadlines
 * written into law are certain. Everything on the lunar and Hindu calendars —
 * Idul Fitri, Nyepi, Waisak, cuti bersama — is set each year by a joint
 * ministerial decree, and a date guessed at is worse than a date missing. Only
 * what can be relied on is seeded, and the column stays so an unconfirmed row
 * can be told apart from a settled one when the team adds the rest.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('key_dates', function (Blueprint $table) {
            $table->id();
            $table->date('date')->index();
            $table->string('title');

            /** 'libur' for a national day, 'pajak' for a tax date. */
            $table->string('kind')->index();

            /** What it means for the team, and why it is worth a post. */
            $table->text('note')->nullable();

            /** Where the date comes from, so it can be checked. */
            $table->string('source')->nullable();

            /*
             | False for anything that moves year to year and has not been
             | read off the official decree yet.
             */
            $table->boolean('confirmed')->default(true);

            $table->timestamps();

            $table->unique(['date', 'title']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('key_dates');
    }
};
