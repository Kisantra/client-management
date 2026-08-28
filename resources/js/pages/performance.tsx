import { ChartNoAxesColumn } from 'lucide-react';
import { ModulePlaceholder } from '@/components/module-placeholder';
import { performance } from '@/routes';

export default function Performa() {
    return (
        <ModulePlaceholder
            title="Performa"
            icon={ChartNoAxesColumn}
            description="Evaluasi konten yang diproduksi tim: mana yang bekerja, mana yang tidak, dan berapa lead yang benar-benar dihasilkan tiap channel."
            planned={[
                'Metrik per konten dan per channel, diisi manual atau lewat import CSV.',
                'Struktur data yang siap menerima integrasi API Meta, GA4, dan TikTok tanpa migrasi ulang.',
                'Perbandingan antar periode untuk sesi evaluasi berkala.',
            ]}
        />
    );
}

Performa.layout = {
    breadcrumbs: [
        {
            title: 'Performa',
            href: performance(),
        },
    ],
};
