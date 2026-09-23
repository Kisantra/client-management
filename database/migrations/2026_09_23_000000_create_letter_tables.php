<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
         | A template is the words of one kind of letter: paragraphs with
         | {{placeholders}}, and the fields those placeholders are filled from.
         | The office edits them in place, so they live in the database rather
         | than in a class.
         */
        Schema::create('letter_templates', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();            // stable key, e.g. penawaran-jasa
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('number_prefix', 8);          // PEN in PEN-011/KSN-MS/VIII/2026
            $table->string('subject');                   // default Perihal
            $table->string('recipient');                 // default "Yth." line, may hold placeholders
            $table->json('fields');                      // [{key, label, type, required, default, ...}]
            $table->longText('body');                    // paragraphs with {{placeholders}}
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('letters', function (Blueprint $table) {
            $table->id();
            $table->foreignId('letter_template_id')->constrained()->restrictOnDelete();
            $table->foreignId('lead_id')->constrained()->cascadeOnDelete();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();

            /*
             | The number is drawn when the letter is issued, never while it
             | is a draft, so an abandoned draft burns nothing. Once drawn it
             | stays with the letter through every later edit and cancel.
             */
            $table->string('number')->nullable()->unique();
            $table->unsignedInteger('sequence')->nullable();
            $table->unsignedSmallInteger('year')->nullable();

            $table->date('letter_date');
            $table->string('subject');
            $table->string('recipient');
            $table->json('values');                      // field values keyed by field key
            $table->string('signer_name');
            $table->string('signer_title');

            $table->string('status', 16)->default('draft'); // draft | terbit | batal
            $table->longText('rendered_html')->nullable();  // the body as it read when issued
            $table->timestamp('issued_at')->nullable();
            $table->timestamps();

            $table->index(['status', 'letter_date']);
            $table->index(['lead_id', 'status']);
        });

        /*
         | One row per prefix and year, locked while a number is drawn, so two
         | letters issued in the same second can never share a sequence.
         */
        Schema::create('letter_number_counters', function (Blueprint $table) {
            $table->id();
            $table->string('prefix', 8);
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_sequence')->default(0);
            $table->timestamps();

            $table->unique(['prefix', 'year']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('letter_number_counters');
        Schema::dropIfExists('letters');
        Schema::dropIfExists('letter_templates');
    }
};
