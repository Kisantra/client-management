import { LeadForm } from '@/components/leads/lead-form';
import { leads } from '@/routes';
import { create as leadsCreate } from '@/routes/leads';

export default function LeadCreate({ services }: { services: string[] }) {
    return <LeadForm lead={null} services={services} />;
}

LeadCreate.layout = {
    breadcrumbs: [
        { title: 'Leads', href: leads() },
        { title: 'Tambah Lead', href: leadsCreate() },
    ],
};
