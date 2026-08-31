<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            /*
             | The chain, as a real link. `source` keeps the title as text so a
             | lead from content that predates the calendar still says where it
             | came from; this points at the piece itself when there is one.
             | Deleting the piece leaves the lead and its text alone.
             */
            $table->foreignId('content_id')
                ->nullable()
                ->after('source')
                ->constrained('contents')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropConstrainedForeignId('content_id');
        });
    }
};
