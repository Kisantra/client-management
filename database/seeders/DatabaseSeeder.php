<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        /*
         | The local sign-in the team asked for while the app is still on this
         | machine. Change the password before this is served anywhere else.
         */
        User::firstOrCreate(
            ['email' => 'admin@gmail.com'],
            [
                'name' => 'Admin',
                'password' => Hash::make('password'),
                'email_verified_at' => now(),
            ],
        );

        /* Real dates, not samples: the tax deadlines and fixed national days
           the content calendar has to plan around. */
        $this->call(KeyDateSeeder::class);

        // $this->call(LeadSeeder::class);
        // $this->call(ContentSeeder::class);
        // $this->call(ContentIdeaSeeder::class);
    }
}
