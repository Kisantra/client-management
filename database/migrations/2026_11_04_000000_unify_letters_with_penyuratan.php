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
         | One register for every letter the office sends. The tax team's
         | letters — SP2DK replies, berita acara, document requests — move in
         | beside the offers, so a template now also says what kind of
         | document it is, who signs it, and whether its document list prints
         | as a separate attachment page.
         */
        Schema::table('letter_templates', function (Blueprint $table) {
            $table->string('category', 32)->default('surat')->after('description'); // surat | berita_acara | pengingat | pemberitahuan
            $table->json('signers')->nullable()->after('stage_on_issue');            // [{label}] in print order
            $table->boolean('checklist_as_attachment')->default(false)->after('signers');
        });

        /* A berita acara is addressed to nobody, and a letter to the tax
           office carries its own addressee: an empty Yth. prints no block. */
        Schema::table('letter_templates', function (Blueprint $table) {
            $table->string('recipient')->nullable()->change();
        });

        Schema::table('letters', function (Blueprint $table) {
            $table->string('recipient')->nullable()->change();
            // Typed per letter, offered from the common services; not a relation.
            $table->string('project')->nullable()->after('recipient');
            // [{label, signer_id, name, title, image}] per template slot, frozen at issue.
            $table->json('signers')->nullable()->after('values');
        });

        /* The single signer each letter carried becomes the first entry of
           the list, so a letter already issued keeps the name it went out
           under. */
        DB::table('letters')->orderBy('id')->each(function (object $letter) {
            DB::table('letters')->where('id', $letter->id)->update([
                'signers' => json_encode([[
                    'label' => 'Penanda tangan',
                    'signer_id' => null,
                    'name' => $letter->signer_name,
                    'title' => $letter->signer_title,
                    'image' => null,
                ]]),
            ]);
        });

        Schema::table('letters', function (Blueprint $table) {
            $table->dropColumn(['signer_name', 'signer_title']);
        });

        /*
         | The people who sign for the office, with their signature image. Not
         | user accounts: a director who never logs in still signs, and the
         | image is kept off the public disk so it cannot be fetched by URL.
         */
        Schema::create('letter_signers', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('title');                       // printed under the name: "Direktur", "Tax Manager"
            $table->string('signature_path')->nullable();  // on the local disk
            $table->boolean('is_default')->default(false); // preferred when several signers share a title
            $table->boolean('is_active')->default(true);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();
        });

        DB::table('letter_signers')->insert([
            'name' => config('letter.signer.name', 'Iqal Azhari'),
            'title' => config('letter.signer.title', 'Direktur'),
            'is_default' => true,
            'is_active' => true,
            'sort_order' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // The documents the office commonly asks a client for.
        Schema::create('requested_document_types', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('category', 32)->default('lainnya'); // keuangan | perpajakan | legal | kepegawaian | lainnya
            $table->string('description')->nullable();          // printed in the attachment table when an item has no note
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        /*
         | One document a letter asks for. Kept in its own table rather than
         | in the letter's values because it lives on after issue: the team
         | ticks off what has arrived, which never reopens the letter.
         */
        Schema::create('letter_requested_documents', function (Blueprint $table) {
            $table->id();
            $table->foreignId('letter_id')->constrained()->cascadeOnDelete();
            $table->string('field_key', 64);
            $table->foreignId('requested_document_type_id')->nullable()->constrained()->nullOnDelete();
            $table->string('name');                // copied, so renaming the master entry rewrites no letter
            $table->string('note')->nullable();    // "Januari–Desember 2025"
            $table->unsignedSmallInteger('order')->default(0);
            $table->timestamp('received_at')->nullable();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['letter_id', 'field_key', 'order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('letter_requested_documents');
        Schema::dropIfExists('requested_document_types');
        Schema::dropIfExists('letter_signers');

        Schema::table('letters', function (Blueprint $table) {
            $table->string('signer_name')->default('');
            $table->string('signer_title')->default('');
        });

        DB::table('letters')->orderBy('id')->each(function (object $letter) {
            $first = json_decode((string) $letter->signers, true)[0] ?? [];

            DB::table('letters')->where('id', $letter->id)->update([
                'signer_name' => (string) ($first['name'] ?? ''),
                'signer_title' => (string) ($first['title'] ?? ''),
            ]);
        });

        Schema::table('letters', function (Blueprint $table) {
            $table->dropColumn(['signers', 'project']);
        });

        Schema::table('letter_templates', function (Blueprint $table) {
            $table->dropColumn(['category', 'signers', 'checklist_as_attachment']);
        });
    }
};
