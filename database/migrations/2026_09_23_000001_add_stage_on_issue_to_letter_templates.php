<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        /*
         | Some letters are the document a pipeline stage stands for: an offer
         | is the proposal, a contract is the deal. Issuing such a letter moves
         | the lead there by itself, with the PDF attached as the evidence.
         */
        Schema::table('letter_templates', function (Blueprint $table) {
            $table->string('stage_on_issue', 32)->nullable()->after('recipient');
        });

        DB::table('letter_templates')
            ->where('code', 'penawaran-jasa')
            ->update(['stage_on_issue' => 'proposal']);
    }

    public function down(): void
    {
        Schema::table('letter_templates', function (Blueprint $table) {
            $table->dropColumn('stage_on_issue');
        });
    }
};
