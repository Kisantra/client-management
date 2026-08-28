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
             | Closure runs alongside the stage, not instead of it. A lead that
             | stops keeps the stage it died at, so the funnel still says where
             | it was lost — and its clock stops on the day it closed.
             */
            $table->string('status')->default('aktif')->after('stage');
            $table->string('closed_reason')->nullable()->after('status');
            $table->text('closed_note')->nullable()->after('closed_reason');
            $table->date('closed_at')->nullable()->after('closed_note');

            $table->index(['status', 'stage']);
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropIndex(['status', 'stage']);
            $table->dropColumn(['status', 'closed_reason', 'closed_note', 'closed_at']);
        });
    }
};
