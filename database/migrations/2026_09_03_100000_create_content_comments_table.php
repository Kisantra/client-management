<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('content_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('content_id')->constrained()->cascadeOnDelete();

            // No user roles exist yet, so the name is the signature.
            $table->string('author');
            $table->text('body');

            /*
             | A review note is a task in disguise — "perbaiki angka di slide
             | 3" — so it can be checked off, and the checking is signed:
             | "selesai" without "oleh siapa" answers nothing in a review
             | that goes back and forth.
             */
            $table->string('resolved_by')->nullable();
            $table->timestamp('resolved_at')->nullable();

            $table->timestamps();

            $table->index(['content_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('content_comments');
    }
};
