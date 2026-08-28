import { CalendarDays } from 'lucide-react';
import { ModulePlaceholder } from '@/components/module-placeholder';
import { content } from '@/routes';

export default function Konten() {
    return (
        <ModulePlaceholder
            title="Konten"
            icon={CalendarDays}
            description="Rencana dan jadwal tayang konten per channel, dengan alur status draft → review → approved → published. Seluruh review bersifat internal."
            planned={[
                'Kalender tayang untuk Instagram, TikTok, LinkedIn, dan Web/SEO.',
                'Alur produksi konten dengan penanggung jawab dan tenggat tiap tahap.',
                'Penanda konten yang tertahan di satu tahap lebih lama dari seharusnya.',
            ]}
        />
    );
}

Konten.layout = {
    breadcrumbs: [
        {
            title: 'Konten',
            href: content(),
        },
    ],
};
