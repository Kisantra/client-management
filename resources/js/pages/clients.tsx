import { Briefcase } from 'lucide-react';
import { ModulePlaceholder } from '@/components/module-placeholder';
import { clients } from '@/routes';

export default function Client() {
    return (
        <ModulePlaceholder
            title="Client"
            icon={Briefcase}
            description="Client yang sudah berjalan: data perusahaan, PIC, layanan yang diambil, dan periode kerja samanya."
            planned={[
                'Daftar client aktif beserta nilai dan periode kerja sama.',
                'Halaman detail per client dengan riwayat lengkap sejak masih berstatus lead.',
                'Catatan internal dan dokumen yang menempel pada tiap client.',
            ]}
        />
    );
}

Client.layout = {
    breadcrumbs: [
        {
            title: 'Client',
            href: clients(),
        },
    ],
};
