<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            /*
             | The hour a piece is meant to go out, kept beside the date rather
             | than folded into it. The date is where a piece sits in the
             | calendar and every month and day query reads it as one; the time
             | is a detail of the plan, and a piece may legitimately not have
             | one decided yet.
             */
            $table->time('scheduled_time')->nullable()->after('scheduled_for');
        });
    }

    public function down(): void
    {
        Schema::table('contents', function (Blueprint $table) {
            $table->dropColumn('scheduled_time');
        });
    }
};
