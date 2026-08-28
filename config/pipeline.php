<?php

/*
|--------------------------------------------------------------------------
| Client pipeline
|--------------------------------------------------------------------------
|
| The firm's confirmed stages, in order, with the number of days a lead may
| sit in each before it counts as stalled ("mandek"). This is the single
| source of truth: the server computes `stalled` from it and hands the
| threshold to the client, so no screen has to keep its own copy.
|
*/

return [

    'stages' => [
        ['key' => 'lead', 'label' => 'Lead', 'stalled_after_days' => 14],
        ['key' => 'kontak', 'label' => 'Kontak', 'stalled_after_days' => 7],
        ['key' => 'konsultasi', 'label' => 'Konsultasi', 'stalled_after_days' => 10],
        ['key' => 'proposal', 'label' => 'Proposal', 'stalled_after_days' => 21],
        ['key' => 'deal', 'label' => 'Deal', 'stalled_after_days' => 5],
        ['key' => 'client', 'label' => 'Client aktif', 'stalled_after_days' => 30],
    ],

    /*
    | Stages that cannot be entered without evidence. The key is the stage,
    | the value describes the document the move must carry.
    */
    'requires_document' => [
        'proposal' => [
            'label' => 'Dokumen proposal',
            'hint' => 'Lampirkan proposal yang dikirim ke client — PDF hasil ekspor atau foto dokumen yang ditandatangani.',
        ],
        'deal' => [
            'label' => 'Kontrak / surat perjanjian',
            'hint' => 'Lampirkan kontrak atau surat perjanjian yang sudah disepakati kedua pihak.',
        ],
    ],

    'channels' => [
        'instagram' => 'Instagram',
        'tiktok' => 'TikTok',
        'linkedin' => 'LinkedIn',
        'web' => 'Web/SEO',
        'whatsapp' => 'WhatsApp',
    ],

    /*
    | Why a lead stopped, when it stops. Not a stage: a closed lead keeps the
    | stage it died at, because "gugur di Proposal" and "gugur di Kontak" are
    | two different diagnoses. Add a reason here and it appears in the form and
    | in the rule at the same time.
    */
    'close_reasons' => [
        'ditolak' => [
            'label' => 'Ditolak',
            'hint' => 'Client bilang tidak — harga, pilih kompetitor, atau dikerjakan sendiri.',
        ],
        'hilang_kontak' => [
            'label' => 'Hilang kontak',
            'hint' => 'Tidak ada kabar setelah beberapa kali dihubungi.',
        ],
        'belum_butuh' => [
            'label' => 'Belum butuh sekarang',
            'hint' => 'Tertarik, tapi belum waktunya. Bisa dihubungi lagi nanti.',
        ],
    ],

    /* How a follow-up is made. Kept here so the form and the rule agree. */
    'follow_up_via' => ['WhatsApp', 'Telepon', 'Email', 'Kunjungan', 'Meeting online'],

    'services' => [
        'PPh Badan',
        'PPN',
        'Payroll & PPh 21',
        'Tax Planning',
        'Audit Internal',
        'Pendirian PT',
        'Restitusi Pajak',
        'Konsultasi Umum',
    ],

];
