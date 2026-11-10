import { LeadForm } from '@/components/leads/lead-form';
import type { ContentOption } from '@/components/leads/lead-form';
import { clients, leads, letters } from '@/routes';
import { create as leadsCreate } from '@/routes/leads';
import { create as lettersCreate } from '@/routes/letters';

type Props = {
    services: string[];
    contents: Record<string, ContentOption[]>;
    /** The stage the form opens on: 'client' when it comes from the Client page. */
    stage: string;
    /** 'surat' when the form was opened from the letter form; saving returns there. */
    after: 'surat' | null;
    /** The offer template's name, so the form can draft one right after saving. */
    offer: string | null;
};

export default function LeadCreate({
    services,
    contents,
    stage,
    after,
    offer,
}: Props) {
    return (
        <LeadForm
            lead={null}
            services={services}
            contents={contents}
            initialStage={stage}
            after={after}
            offer={offer}
        />
    );
}

LeadCreate.layout = ({ stage, after }: Props) => ({
    breadcrumbs:
        after === 'surat'
            ? [
                  { title: 'Surat', href: letters() },
                  { title: 'Buat surat', href: lettersCreate() },
                  {
                      title: 'Tambah Client',
                      href: leadsCreate({ query: { lanjut: 'surat' } }),
                  },
              ]
            : stage === 'client'
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
