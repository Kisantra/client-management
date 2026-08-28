<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->id();

            // Client
            $table->string('entity')->default('PT');
            $table->string('company');
            $table->string('pic');
            $table->string('pic_role')->nullable();
            $table->string('phone')->nullable();
            $table->string('email')->nullable();
            $table->string('npwp')->nullable();

            // Office
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->decimal('office_lat', 10, 6)->nullable();
            $table->decimal('office_lng', 10, 6)->nullable();

            // Where it came from — the chain this product exists for.
            $table->string('channel');
            $table->string('source')->nullable();

            // What they want
            $table->string('service');
            $table->unsignedBigInteger('value')->default(0);
            $table->text('note')->nullable();

            // Handling
            $table->string('stage')->index();
            $table->string('owner')->nullable();

            /*
             | Dates rather than counters: "days in stage" must keep counting
             | while nobody touches the record.
             */
            $table->date('entered_at');
            $table->date('stage_changed_at');
            $table->date('last_contact_at')->nullable();

            /*
             | The day this lead starts counting as stalled: stage_changed_at
             | plus the stage's own tolerance. Stored rather than computed so
             | "mandek" is one portable date comparison — filterable, sortable,
             | and still true tomorrow without anyone touching the row.
             */
            $table->date('stalled_at');

            $table->timestamps();

            $table->index(['stage', 'stage_changed_at']);
            $table->index('stalled_at');
            $table->index('entered_at');
        });

        Schema::create('lead_stage_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->string('stage');
            $table->date('entered_at');
            $table->timestamps();

            $table->index(['lead_id', 'entered_at']);
        });

        Schema::create('lead_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->string('author');
            $table->text('body');
            $table->timestamps();

            $table->index(['lead_id', 'created_at']);
        });

        Schema::create('lead_follow_ups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->date('scheduled_for');
            $table->string('via');
            $table->text('note')->nullable();
            $table->boolean('done')->default(false);
            $table->timestamps();

            $table->index(['lead_id', 'scheduled_for']);
        });

        Schema::create('lead_attachments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lead_note_id')->nullable()->constrained()->cascadeOnDelete();
            /** Which stage move this file proves, when it proves one. */
            $table->string('stage')->nullable();
            $table->string('name');
            $table->string('path');
            $table->string('mime')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->timestamps();

            $table->index('lead_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_attachments');
        Schema::dropIfExists('lead_follow_ups');
        Schema::dropIfExists('lead_notes');
        Schema::dropIfExists('lead_stage_events');
        Schema::dropIfExists('leads');
    }
};
