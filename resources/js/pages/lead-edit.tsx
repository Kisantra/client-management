import { LeadForm } from '@/components/leads/lead-form';
import type { EditableLead } from '@/components/leads/lead-form';
import { leads } from '@/routes';

export default function LeadEdit({
    lead,
    services,
}: {
    lead: EditableLead;
    services: string[];
}) {
    return <LeadForm lead={lead} services={services} />;
}

LeadEdit.layout = {
    breadcrumbs: [{ title: 'Leads', href: leads() }],
};
