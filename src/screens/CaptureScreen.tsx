import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { ProjectOverviewScreen } from '@/screens/ProjectOverviewScreen';
import { ProposalEditorScreen } from '@/screens/ProposalEditorScreen';
import { ScopeDraftScreen } from '@/screens/ScopeDraftScreen';
import { ScopeReviewScreen } from '@/screens/ScopeReviewScreen';
import type { Agreement, ChangeProposal, ClientRequest, Project, ScopeDraft, ScopeGuardAnalysis } from '@/types/domain';

/**
 * Renders the app's real screens with labelled demo data, one per `?screen=` value.
 * scripts/capture-app-screens.mjs photographs them for the landing page. It is reachable only in
 * a build made with EXPO_PUBLIC_APP_SCREENSHOTS=1; see src/app/capture.tsx.
 */
const NOW = '2026-10-08T09:30:00.000Z';

const project: Project = {
  id: 'proj_demo_cafe',
  title: 'Café Amihan website',
  clientName: 'Café Amihan (Rina)',
  description: 'Five-page website with a contact form, agreed over chat.',
  createdAt: NOW,
  updatedAt: NOW,
};

const requirements = [
  { id: 'R1', title: 'Five responsive pages', description: 'Home, Menu, About, Gallery and Contact, built for phones and desktop.', category: 'deliverable' as const },
  { id: 'R2', title: 'Contact form', description: 'Inquiry form on the Contact page, sent to the client’s inbox.', category: 'deliverable' as const },
  { id: 'R3', title: 'Two revision rounds', description: 'Two rounds of revisions during design and staging.', category: 'term' as const },
];

const draft: ScopeDraft = {
  title: project.title,
  requirements,
  budgetAmount: 15000,
  budgetCurrency: 'PHP',
  budgetNotes: null,
  durationDays: 14,
  deadline: null,
  timelineNotes: 'Two weeks from the first payment.',
  revisionTerms: 'Two revision rounds included.',
  exclusions: [],
  missingInformation: ['Start date', 'Payment schedule'],
  taxTreatment: 'none_specified',
  extractedWithAi: true,
};

const agreement: Agreement = {
  ...draft,
  id: 'agmt_demo_cafe_v1',
  projectId: project.id,
  versionNumber: 1,
  title: 'Café Amihan website, Agreement v1',
  confirmedAt: NOW,
  clientApprovedAt: null,
};

const request: ClientRequest = {
  id: 'req_demo_cafe_1',
  projectId: project.id,
  agreementId: agreement.id,
  rawText: 'Can we add customer accounts with login, swap the hero photo, and make sure the Menu page works on phones?',
  createdAt: NOW,
  status: 'analyzed',
};

const analysis: ScopeGuardAnalysis = {
  id: 'ana_demo_cafe_1',
  requestId: request.id,
  agreementId: agreement.id,
  classification: 'potential_additional',
  summary: 'One item looks like additional work, one needs a decision, and one is already covered.',
  findings: [
    {
      item: 'Customer accounts with login',
      classification: 'potential_additional',
      explanation: 'Accounts and login are not part of the recorded deliverables.',
      evidenceRequirementIds: ['R1', 'R2'],
    },
    {
      item: 'Swap the hero photo',
      classification: 'needs_clarification',
      explanation: 'This could use one of the two revision rounds. Ask whether the photo is final.',
      evidenceRequirementIds: ['R3'],
    },
    {
      item: 'Menu page works on phones',
      classification: 'included',
      explanation: 'Responsive pages are part of the first deliverable.',
      evidenceRequirementIds: ['R1'],
    },
  ],
  clarificationQuestions: ['Is the new hero photo final, or should it count as a revision round?'],
  createdAt: NOW,
};

const proposal: ChangeProposal = {
  id: 'prop_demo_cafe_1',
  projectId: project.id,
  analysisId: analysis.id,
  selectedItems: ['Customer accounts with login'],
  freelancerFeeEstimate: 7000,
  freelancerDaysEstimate: 5,
  currency: 'PHP',
  draftMessage:
    'Hi Rina! Customer accounts with login are not part of what we recorded for the site, so I would treat them as additional work. For that I would propose PHP 7,000 and five extra working days. The five pages and the contact form stay as agreed.',
  status: 'draft',
  createdAt: NOW,
  updatedAt: NOW,
};

const noop = () => undefined;
const asyncNoop = async () => undefined;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ flex: 1 }}>{children}</View>
    </SafeAreaView>
  );
}

export function CaptureScreen() {
  const { screen } = useLocalSearchParams<{ screen?: string }>();

  switch (screen) {
    case 'draft':
      return (
        <Frame>
          <ScopeDraftScreen project={project} draft={draft} onBack={noop} onConfirmScope={asyncNoop} onSaveDraft={asyncNoop} />
        </Frame>
      );
    case 'agreement':
      return (
        <Frame>
          <ProjectOverviewScreen
            currentProject={project}
            allProjects={[project]}
            agreements={[agreement]}
            selectedAgreement={agreement}
            requests={[]}
            analyses={{}}
            proposals={{}}
            freelancerName="Rina Santos"
            freelancerRole="Web designer"
            onSelectProject={noop}
            onSelectAgreementVersion={noop}
            onNavigateToNewRequest={noop}
            onBack={noop}
          />
        </Frame>
      );
    case 'scopeguard':
      return (
        <Frame>
          <ScopeReviewScreen project={project} agreement={agreement} analysis={analysis} onBack={noop} onProceedToProposal={noop} />
        </Frame>
      );
    case 'proposal':
      return (
        <Frame>
          <ProposalEditorScreen
            project={project}
            agreement={agreement}
            proposal={proposal}
            availableItems={['Customer accounts with login']}
            onBack={noop}
            onSaveProposal={asyncNoop}
          />
        </Frame>
      );
    default:
      return null;
  }
}
