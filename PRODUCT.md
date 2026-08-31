# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Tim digital marketing **in-house** pada sebuah firma konsultan perpajakan & bisnis. Tim berukuran 8–20 orang.

- **Akses tertutup untuk internal saja.** Client firma tidak pernah menyentuh sistem ini: tidak ada portal client, tidak ada share link publik, tidak ada akun eksternal. Semua yang login adalah anggota firma.
- **Dua situasi pemakaian yang bergantian, bukan terpisah:** aplikasi ini adalah tempat kerja harian tim (buka pagi, lihat yang harus dikerjakan, update status) *sekaligus* alat evaluasi (melihat konten mana yang menghasilkan, siapa mengerjakan apa, client mana yang berjalan).
- **Granularitas role/permission di dalam tim belum diputuskan.** Belum dikonfirmasi apakah ada pembedaan hak akses antara lead/manager dan anggota tim.

## Product Purpose

Melacak perjalanan client firma — dari lead sampai client aktif — sekaligus melacak dan mengevaluasi konten pemasaran yang diproduksi tim untuk firma itu sendiri.

Berhasil bila tim bisa menjawab, tanpa menyusun laporan terpisah: konten apa yang sudah kami keluarkan, konten mana yang menghasilkan lead, lead mana yang jadi client aktif, dan siapa di tim yang sedang mengerjakan apa.

## Positioning

Rantai **konten → lead → client aktif** dalam satu sistem. Itu pertanyaan yang tidak bisa dijawab oleh CRM generik maupun content calendar generik secara terpisah: CRM tahu leadnya ada tapi tidak tahu asalnya dari konten mana; content calendar tahu kontennya tayang tapi tidak tahu ujungnya jadi client atau tidak.

Konteksnya jasa profesional (konsultan pajak & bisnis), bukan e-commerce: satu client bernilai besar dan siklusnya panjang, sehingga jumlah konversi kecil dan tiap lead layak ditelusuri satu per satu — bukan dioptimasi secara agregat.

## Operating Context

**Pipeline client (tahapan resmi yang dikonfirmasi):**

`Lead → Kontak → Konsultasi → Proposal → Deal → Client aktif`

Tahap **Konsultasi** adalah bagian nyata dari alur jasa profesional ini dan tidak boleh dilebur ke dalam Proposal.

**Channel konten yang dikelola dan dievaluasi tim:**

- Instagram & TikTok — feed, reels, story, short video
- LinkedIn — konten profesional B2B
- Website / blog & SEO — artikel edukasi pajak, update regulasi, halaman layanan
- WhatsApp — jalur masuk langsung (chat, broadcast, referensi), dikonfirmasi
  kemudian. Bukan channel penerbitan konten, jadi ia muncul sebagai asal lead
  tetapi tidak masuk evaluasi performa konten.

Ads berbayar (Meta/Google) **tidak** termasuk lingkup yang dikonfirmasi saat ini. Tidak ada asumsi tentang budget, spend, atau ROAS sampai dinyatakan sebaliknya.

**Volume yang harus ditampung:** ratusan lead per bulan. Daftar dan tabel harus tetap terbaca dan cepat dipakai dalam keadaan padat; pencarian, filter, dan pagination adalah kebutuhan sejak awal, bukan penyempurnaan belakangan.

## Capabilities and Constraints

**Lingkup versi pertama — empat modul, semuanya dikonfirmasi:**

1. **CRM & pipeline client** — data client, kontak, status kerja sama, catatan, riwayat interaksi.
2. **Kalender & alur produksi konten** — rencana konten, jadwal tayang per channel, status draft → review → approved → published. **Review dan approval sepenuhnya internal.** Tidak ada langkah persetujuan client di mana pun dalam alur ini.
3. **Performa & evaluasi konten** — metrik per konten dan per channel, dievaluasi terhadap konten yang diproduksi tim untuk firma.
4. **Task & workload tim** — assignment, deadline, siapa mengerjakan apa, sebaran beban kerja.

**Sumber data metrik:** input manual dan import CSV pada v1. Struktur data harus dirancang sejak awal agar integrasi API platform bisa ditambahkan belakangan **tanpa migrasi ulang**. Platform mana yang diintegrasikan lebih dulu belum diputuskan.

**Bahasa antarmuka:** Bahasa Indonesia untuk navigasi, aksi, label, dan pesan sistem; istilah domain marketing dibiarkan dalam Bahasa Inggris karena itu yang dipakai tim sehari-hari (Reach, Engagement, Pipeline, Lead, Deal, Draft, Published).

**Stack yang sudah terpasang di repo** (bukan keputusan terbuka): Laravel 12 + Inertia, React 19 + TypeScript, Tailwind v4, shadcn/ui (style `new-york`, base color `neutral`), ikon Lucide. Autentikasi sudah lengkap via Fortify termasuk two-factor dan passkeys. Layout app shell (sidebar + header) dan halaman settings sudah ada. Domain model modul Leads sudah berjalan (`leads`, `lead_stage_events`, `lead_notes`, `lead_attachments`, `lead_follow_ups`), dengan tahap, batas mandek, dan aturan dokumen wajib dibaca dari `config/pipeline.php`. Halaman Client membaca lead di tahap Client aktif dari tabel yang sama. Modul Konten sudah berjalan (`contents`, `content_status_events`, dan `leads.content_id` yang menautkan lead ke konten yang membawanya), dengan channel penerbit, format, status, dan batas tertahan dibaca dari `config/content.php`. Modul task dan tim belum punya model sama sekali.

**Status penutup (dikonfirmasi):** selain enam tahap di atas, sebuah lead bisa **berhenti**. Ini bukan tahap ketujuh — lead yang berhenti tetap menyimpan tahap terakhirnya, supaya bisa dibaca di tahap mana lead biasanya gugur. Alasannya dicatat dan dibedakan karena maknanya berbeda: **ditolak** (client bilang tidak), **hilang kontak** (tidak ada kabar — ini juga sinyal soal tim, bukan cuma soal client), dan **belum butuh sekarang** (bisa dihubungi lagi nanti). Lead yang berhenti keluar dari papan, berhenti dihitung mandek, dan bisa dibuka lagi dengan hitungan hari mulai dari nol.

**Belum diputuskan (jangan diisi dengan tebakan):**

- Pembagian role dan hak akses di dalam tim.
- Jenis layanan firma yang dijual dan apakah perlu dicatat per client.
- Field spesifik data client (mis. NPWP, badan usaha, periode kontrak).
- Urutan prioritas integrasi API.

## Brand Commitments

Belum ada. Nama, logo, warna, dan identitas visual untuk tool ini belum ditentukan dan bebas disusun. Firma induknya bergerak di konsultan perpajakan & bisnis — nama firma belum diberikan dan tidak boleh dikarang.

## Evidence on Hand

Tidak ada aset atau data nyata yang diserahkan sejauh ini: tidak ada logo, tidak ada data client atau lead sungguhan, tidak ada angka performa konten, tidak ada nama firma.

Pengguna mengirim empat screenshot dashboard produk lain (Donezo, Coursue, Pivora, Uxerflow) sebagai referensi. Itu materi rujukan visual, bukan bukti produk — belum dikonfirmasi mengikat, dan penanganannya milik tahap arah visual, bukan catatan produk ini.

Angka, testimoni, nama client, dan metrik apa pun yang muncul di pekerjaan mendatang adalah **data contoh** dan harus jelas terbaca demikian sampai data asli tersedia.

## Product Principles

1. **Rantai konten → lead → client harus selalu bisa ditelusuri.** Kalau satu keputusan desain memutus rantai itu, keputusan itu salah, sekalipun layarnya jadi lebih rapi.
2. **Evaluasi lahir dari pekerjaan harian, bukan dari laporan terpisah.** Angka yang dibahas saat evaluasi harus berasal dari data yang sudah tercatat karena tim bekerja di sini setiap hari.
3. **Input manual harus semurah mungkin.** Seluruh nilai sistem ini bergantung pada data yang benar-benar diisi. Setiap friksi tambahan saat mengisi adalah risiko langsung terhadap kegunaannya.
4. **Siap padat sejak hari pertama.** Ratusan lead per bulan adalah keadaan normal, bukan kasus ekstrem. Tampilan harus tetap terbaca dan terarah saat penuh.
5. **Internal berarti internal.** Tidak ada permukaan yang menghadap client. Nada, kepadatan informasi, dan istilah boleh sepenuhnya mengikuti kebiasaan orang dalam tim.
