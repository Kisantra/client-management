<?php

/*
|--------------------------------------------------------------------------
| Surat keluar
|--------------------------------------------------------------------------
|
| Who the letters go out as, and how they are numbered. The identity is the
| office's own letterhead, so it lives here rather than in a template: every
| template prints the same closing, the same signature block and the same
| footer, and only the words in between are its own.
|
| Override any value in .env before letters go out from a different office.
|
*/

return [

    'company' => [
        'name' => env('LETTER_COMPANY_NAME', 'Kisantra'),
        // Printed under "Hormat kami,".
        'legal_name' => env('LETTER_COMPANY_LEGAL_NAME', 'PT Kinara Sadayatra Nusantara'),
        'tagline' => env('LETTER_COMPANY_TAGLINE', 'Clear. Trusted. Reliable'),
        'address' => env('LETTER_COMPANY_ADDRESS', 'Jln. P. Suryanata, Gg. Kopta No. 47'),
        // Opens the date line: "Samarinda, 28 Agustus 2026".
        'city' => env('LETTER_COMPANY_CITY', 'Samarinda'),
        'phone' => env('LETTER_COMPANY_PHONE', '0811-8000-9787'),
        'email' => env('LETTER_COMPANY_EMAIL', 'kisantra.official@gmail.com'),
        // Where an offer letter tells the reader to write back.
        'marketing_email' => env('LETTER_MARKETING_EMAIL', 'marketing@kisantra.com'),
    ],

    /*
    | Who signs, unless a letter says otherwise. Each letter copies these at
    | creation so a change here never rewrites what already went out.
    */
    'signer' => [
        'name' => env('LETTER_SIGNER_NAME', 'Iqal Azhari'),
        'title' => env('LETTER_SIGNER_TITLE', 'Direktur'),
        // Optional image printed above the name, relative to /public. Null leaves the space blank.
        'image' => env('LETTER_SIGNER_IMAGE'),
    ],

    /*
    | Full-page A4 artwork (header and footer) drawn behind every page, relative
    | to /public. Null prints on plain paper. The content insets below clear
    | the header art and the footer strip of this particular file.
    */
    'letterhead' => [
        'image' => env('LETTER_LETTERHEAD_IMAGE', 'images/letterhead/kisantra-a4.jpg'),
        'margins' => ['top' => '44mm', 'right' => '18mm', 'bottom' => '28mm', 'left' => '18mm'],
    ],

    /*
    | The office template is set in Arial. The files are in resources/fonts and
    | embedded in the PDF, so the printed page matches whatever machine renders it.
    */
    'fonts' => [
        ['weight' => 400, 'style' => 'normal', 'file' => 'arial.ttf'],
        ['weight' => 700, 'style' => 'normal', 'file' => 'arialbd.ttf'],
        ['weight' => 400, 'style' => 'italic', 'file' => 'ariali.ttf'],
        ['weight' => 700, 'style' => 'italic', 'file' => 'arialbi.ttf'],
    ],

    /*
    | PEN-011/KSN-MS/VIII/2026. Tokens: {prefix} from the template, {seq} the
    | running number, {code} the office code, {inisial} the client's initials,
    | {roman} the month, {year}. The sequence restarts every year, per prefix.
    */
    'number' => [
        'format' => env('LETTER_NUMBER_FORMAT', '{prefix}-{seq}/{code}-{inisial}/{roman}/{year}'),
        'code' => env('LETTER_NUMBER_CODE', 'KSN'),
        'digits' => 3,
    ],

];
