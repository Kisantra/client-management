<?php

namespace Database\Seeders;

use App\Models\LetterTemplate;
use Illuminate\Database\Seeder;

/**
 * The office's letter templates, in their own words.
 *
 * The wording lives on the model so the Template page can restore it; this
 * seeder only writes what is missing, and never overwrites a template the
 * office has since edited.
 */
class LetterTemplateSeeder extends Seeder
{
    public function run(): void
    {
        LetterTemplate::seedDefaults();
    }
}
