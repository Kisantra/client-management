import { ListChecks } from 'lucide-react';
import { ModulePlaceholder } from '@/components/module-placeholder';
import { tasks } from '@/routes';

export default function Task() {
    return (
        <ModulePlaceholder
            title="Task"
            icon={ListChecks}
            description="Semua tugas tim beserta penanggung jawab dan tenggatnya, tidak hanya yang jatuh tempo hari ini."
            planned={[
                'Daftar tugas dengan filter per anggota, per client, dan per tenggat.',
                'Penugasan dan perpindahan tugas antar anggota tim.',
                'Riwayat penyelesaian untuk melihat pola tugas yang sering telat.',
            ]}
        />
    );
}

Task.layout = {
    breadcrumbs: [
        {
            title: 'Task',
            href: tasks(),
        },
    ],
};
