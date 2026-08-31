import { LeadForm } from '@/components/leads/lead-form';
import type { ContentOption, EditableLead } from '@/components/leads/lead-form';
import { leads } from '@/routes';

export default function LeadEdit({
    lead,
    services,
    contents,
}: {
    lead: EditableLead;
    services: string[];
    contents: Record<string, ContentOption[]>;
}) {
    return <LeadForm lead={lead} services={services} contents={contents} />;
}

LeadEdit.layout = {
    breadcrumbs: [{ title: 'Leads', href: leads() }],
};
