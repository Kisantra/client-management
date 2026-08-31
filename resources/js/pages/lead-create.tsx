import { LeadForm } from '@/components/leads/lead-form';
import type { ContentOption } from '@/components/leads/lead-form';
import { clients, leads } from '@/routes';
import { create as leadsCreate } from '@/routes/leads';

type Props = {
    services: string[];
    contents: Record<string, ContentOption[]>;
    /** The stage the form opens on: 'client' when it comes from the Client page. */
    stage: string;
};

export default function LeadCreate({ services, contents, stage }: Props) {
    return (
        <LeadForm
            lead={null}
            services={services}
            contents={contents}
            initialStage={stage}
        />
    );
}

LeadCreate.layout = ({ stage }: Props) => ({
    breadcrumbs:
        stage === 'client'
            ? [
                  { title: 'Client', href: clients() },
                  {
                      title: 'Tambah Client',
                      href: leadsCreate({ query: { tahap: 'client' } }),
                  },
              ]
            : [
                  { title: 'Leads', href: leads() },
                  { title: 'Tambah Lead', href: leadsCreate() },
              ],
});
