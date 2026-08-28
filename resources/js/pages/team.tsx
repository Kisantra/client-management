import { UsersRound } from 'lucide-react';
import { ModulePlaceholder } from '@/components/module-placeholder';
import { team } from '@/routes';

export default function Anggota() {
    return (
        <ModulePlaceholder
            title="Anggota"
            icon={UsersRound}
            description="Anggota tim digital marketing, peran masing-masing, dan sebaran beban kerjanya."
            planned={[
                'Daftar anggota tim beserta peran dan kapasitas tugas per minggu.',
                'Beban kerja per anggota supaya penugasan tidak menumpuk di satu orang.',
                'Pembagian hak akses — masih menunggu keputusan pembagian peran.',
            ]}
        />
    );
}

Anggota.layout = {
    breadcrumbs: [
        {
            title: 'Anggota',
            href: team(),
        },
    ],
};
