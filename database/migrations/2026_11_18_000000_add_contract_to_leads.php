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
             | A signed client either runs on a contract of so many months or
             | is engaged on the spot for one job. No duration means on spot.
             | The end date is derived on save, like stalled_at, so the list
             | can sort by it without date arithmetic in SQL.
             */
            $table->unsignedSmallInteger('contract_months')->nullable()->after('value');
            $table->date('contract_start')->nullable()->after('contract_months');
            $table->date('contract_ends_at')->nullable()->after('contract_start');

            $table->index('contract_ends_at');
        });
    }

    public function down(): void
    {
        Schema::table('leads', function (Blueprint $table) {
            $table->dropIndex(['contract_ends_at']);
            $table->dropColumn(['contract_months', 'contract_start', 'contract_ends_at']);
        });
    }
};
