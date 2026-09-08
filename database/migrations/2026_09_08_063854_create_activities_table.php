<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The log of what people did to the records here.
 *
 * Two columns exist only so the log keeps reading after the thing it describes
 * is gone. `actor` holds the name as it stood at the time, so removing an
 * account does not blank out a year of history, and `subject_label` holds the
 * record's own title, so "Andre menghapus PT Bumi Mandiri" still names what was
 * deleted once there is no row left to join to. A log that stops making sense
 * the moment something is removed is a log that fails at the one job it has.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('activities', function (Blueprint $table) {
            $table->id();

            /* Nulled rather than cascaded: the account can go, the history
               stays. `actor` is what the page actually prints. */
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('actor');

            $table->string('action');
            $table->string('subject_type')->index();
            $table->unsignedBigInteger('subject_id')->nullable();
            $table->string('subject_label');

            /*
             | Field-by-field before and after, already worded for reading.
             | Null on a create or a delete, where there is no "from".
             |
             | Not called `changes`: Eloquent's own Model declares a protected
             | $changes, so a column of that name is unreachable as $this->changes
             | from inside the model — it silently reads the framework's
             | property instead of the attribute, and hands back an empty array.
             */
            $table->json('diff')->nullable();

            /* Where to go to see the thing, resolved when it was written —
               a deleted record has no route left to build one from. */
            $table->string('url')->nullable();

            $table->timestamps();

            $table->index('created_at');
            $table->index(['subject_type', 'subject_id']);
            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('activities');
    }
};
