import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/constants/theme';
import { ProjectOverviewScreen } from '@/screens/workspace/ProjectOverviewScreen';
import { ProposalEditorScreen } from '@/screens/workspace/ProposalEditorScreen';
import { ScopeDraftScreen } from '@/screens/workspace/ScopeDraftScreen';
import { ProjectsScreen } from '@/screens/workspace/ProjectsScreen';
import { AgreementsScreen } from '@/screens/workspace/AgreementsScreen';
import { NewRequestScreen } from '@/screens/workspace/NewRequestScreen';
import { ScopeReviewScreen } from '@/screens/workspace/ScopeReviewScreen';
import type { Agreement, ChangeProposal, ClientRequest, Project, ScopeDraft, ScopeGuardAnalysis } from '@/types/domain';

/**
 * Renders the app's real screens with labelled demo data, one per `?screen=` value.
 * scripts/capture-app-screens.mjs photographs them for the landing page. It is reachable only in
 * a build made with EXPO_PUBLIC_APP_SCREENSHOTS=1; see src/app/capture.tsx.
 */
const NOW = '2026-10-08T09:30:00.000Z';

const baseProject: Project = {
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

const baseDraft: ScopeDraft = {
  title: baseProject.title,
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

const baseAgreement: Agreement = {
  ...baseDraft,
  id: 'agmt_demo_cafe_v1',
  projectId: baseProject.id,
  versionNumber: 1,
  title: 'Café Amihan website, Agreement v1',
  confirmedAt: NOW,
  clientApprovedAt: null,
};

const request: ClientRequest = {
  id: 'req_demo_cafe_1',
  projectId: baseProject.id,
  agreementId: baseAgreement.id,
  rawText: 'Can we add customer accounts with login, swap the hero photo, and make sure the Menu page works on phones?',
  createdAt: NOW,
  status: 'analyzed',
};

const analysis: ScopeGuardAnalysis = {
  id: 'ana_demo_cafe_1',
  requestId: request.id,
  agreementId: baseAgreement.id,
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
  projectId: baseProject.id,
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

// Stress data for layout checks: ?data=worst or ?data=empty on the capture route.
const LONG = 'Extraordinarily long deliverable name that keeps going and going without any natural break so the layout has to cope';
const UNBROKEN = 'averyveryveryveryveryverylongunbrokenwordwithnospacesatallthatcannotwrapnaturally1234567890';
const worstRequirements = Array.from({ length: 40 }, (_, index) => ({
  id: `REQ-${String(index + 1).padStart(2, '0')}`,
  title: index % 3 === 0 ? `${LONG} ${index}` : index % 3 === 1 ? `${UNBROKEN}${index}` : `Café 🦉 ${index} 日本語のテスト`,
  description: `${LONG}. ${LONG}.`,
  category: 'deliverable' as const,
}));
const worst = {
  project: { ...baseProject, title: `${LONG} ${UNBROKEN}`, clientName: UNBROKEN, description: LONG },
  draft: { ...baseDraft, title: `${LONG}`, requirements: worstRequirements, budgetAmount: 999999999999, durationDays: 99999,
    timelineNotes: LONG, revisionTerms: LONG, missingInformation: [LONG, UNBROKEN], exclusions: [LONG, UNBROKEN] },
};
const empty = {
  project: { ...baseProject, title: 'Untitled', clientName: null, description: null },
  draft: { ...baseDraft, requirements: [], budgetAmount: null, durationDays: null, timelineNotes: null, revisionTerms: null,
    missingInformation: [], exclusions: [] },
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
  const { screen, data } = useLocalSearchParams<{ screen?: string; data?: string }>();
  const set = data === 'worst' ? worst : data === 'empty' ? empty : null;
  const project = set ? set.project : baseProject;
  const draft = set ? set.draft : baseDraft;
  const agreement: Agreement = set
    ? { ...baseAgreement, ...set.draft, id: baseAgreement.id, projectId: baseProject.id, versionNumber: 1, title: set.project.title, confirmedAt: NOW, clientApprovedAt: null }
    : baseAgreement;

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
    case 'projects':
      return (
        <Frame>
          <ProjectsScreen
            projects={data === 'empty' ? [] : [project, { ...project, id: 'proj_two', title: 'Second 🦉 project' }]}
            projectAgreements={data === 'empty' ? {} : { [project.id]: [agreement] }}
            onSelectProject={noop} onViewProjectOverview={noop} onNewProject={noop}
          />
        </Frame>
      );
    case 'agreements':
      return (
        <Frame>
          <AgreementsScreen
            projects={data === 'empty' ? [] : [project]}
            projectAgreements={data === 'empty' ? {} : { [project.id]: [agreement] }}
            onSelectProjectAgreement={noop} onNewProject={noop}
          />
        </Frame>
      );
    case 'newrequest':
      return (
        <Frame>
          <NewRequestScreen project={project} agreement={agreement} onBack={noop} onAnalyze={asyncNoop} onSaveRequest={asyncNoop} onViewConfirmedScope={noop} />
        </Frame>
      );
    default:
      return null;
  }
}
