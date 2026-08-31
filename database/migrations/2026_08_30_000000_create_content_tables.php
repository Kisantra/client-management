<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('contents', function (Blueprint $table) {
            $table->id();
            $table->string('title');

            // Where it goes and in what shape. Both keyed to config/content.php.
            $table->string('channel')->index();
            $table->string('format');

            // Where it stands: draft → review → approved → published.
            $table->string('status')->index();

            /*
             | Dates rather than flags: "late" is the scheduled date against
             | today, "stuck" is the status date against config, and both stay
             | true tomorrow without anyone touching the row.
             */
            $table->date('scheduled_for')->index();
            $table->date('published_at')->nullable();
            $table->date('status_changed_at');

            $table->string('owner')->nullable();
            $table->text('brief')->nullable();
            $table->string('url')->nullable();

            /*
             | Room for the platform integration PRODUCT.md defers: the id the
             | platform knows this piece by, so metrics can be pulled against
             | it later without touching this table again.
             */
            $table->string('external_id')->nullable();

            $table->timestamps();

            $table->index(['status', 'scheduled_for']);
            $table->index(['channel', 'scheduled_for']);
        });

        Schema::create('content_status_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_id')->constrained()->cascadeOnDelete();
            $table->string('status');
            $table->string('author')->nullable();
            $table->text('note')->nullable();
            $table->date('at');
            $table->timestamps();

            $table->index(['content_id', 'at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_status_events');
        Schema::dropIfExists('contents');
    }
};
