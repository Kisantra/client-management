<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A signed client handed over to Project Management.
 *
 * One row per lead, kept apart from `leads` so the sync's own bookkeeping —
 * attempts, errors, the other app's ids — never shows up in the activity log
 * as somebody editing the client.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('handoffs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lead_id')->unique()->constrained()->cascadeOnDelete();

            /** antre, terkirim, lengkap, batal, gagal — see App\Models\Handoff. */
            $table->string('status');

            $table->unsignedBigInteger('pm_client_id')->nullable();
            $table->string('pm_client_url')->nullable();
            /** Project Management already had this client; the deal joined it. */
            $table->boolean('matched')->default(false);
            /** The project the tax team opened for this deal. */
            $table->string('pm_project_name')->nullable();
            $table->string('pm_project_url')->nullable();

            $table->unsignedTinyInteger('attempts')->default(0);
            $table->string('error')->nullable();

            $table->timestamp('sent_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('completed_by')->nullable();
            $table->timestamp('withdrawn_at')->nullable();

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('handoffs');
    }
};
