<?php

namespace Database\Seeders;

use App\Models\RequestedDocumentType;
use Illuminate\Database\Seeder;

/**
 * The documents the office commonly asks clients for.
 *
 * The list lives on the model so the Pengaturan page can install it too;
 * this seeder only writes what is missing and never touches an entry the
 * office has since renamed or switched off.
 */
class RequestedDocumentTypeSeeder extends Seeder
{
    public function run(): void
    {
        RequestedDocumentType::seedDefaults();
    }
}
