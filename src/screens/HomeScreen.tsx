import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initializeBackendAsync, type AppServices } from '@/services/bootstrapService';
import { getDatabaseAsync } from '@/database/client';
import { seedDemoDataAsync } from '@/database/seed';
import { colors } from '@/constants/theme';
import { SlideTransition } from '@/components/SlideTransition';
import { BottomNavBar, type RootTab } from '@/components/BottomNavBar';
import { ProjectsScreen } from '@/screens/ProjectsScreen';
import { NewProjectScreen } from '@/screens/NewProjectScreen';
import { ScopeDraftScreen } from '@/screens/ScopeDraftScreen';
import { ProjectOverviewScreen } from '@/screens/ProjectOverviewScreen';
import { NewRequestScreen } from '@/screens/NewRequestScreen';
import { ScopeReviewScreen } from '@/screens/ScopeReviewScreen';
import { ProposalScreen } from '@/screens/ProposalScreen';
import { AgreementsScreen } from '@/screens/AgreementsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import type {
  Project,
  Agreement,
  ScopeDraft,
  ScopeGuardAnalysis,
  ChangeProposal,
} from '@/types/domain';

type SubScreen =
  | null
  | 'new_project'
  | 'draft'
  | 'overview'
  | 'new_request'
  | 'review'
  | 'proposal';

export function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [services, setServices] = useState<AppServices | null>(null);

  // Navigation states
  const [rootTab, setRootTab] = useState<RootTab>('projects');
  const [subScreen, setSubScreen] = useState<SubScreen>(null);
  const [stackDirection, setStackDirection] = useState<'forward' | 'backward'>('forward');
  const [tabDirection, setTabDirection] = useState<'forward' | 'backward'>('forward');
  const [draftReturnScreen, setDraftReturnScreen] = useState<'new_project' | 'overview'>('new_project');

  // Domain states
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectAgreements, setProjectAgreements] = useState<Record<string, Agreement[]>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);

  const [activeDraft, setActiveDraft] = useState<ScopeDraft | null>(null);
  const [analysis, setAnalysis] = useState<ScopeGuardAnalysis | null>(null);
  const [proposal, setProposal] = useState<ChangeProposal | null>(null);

  // Load backend and database records on mount
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const backend = await initializeBackendAsync();
        const loadedProjects = await backend.repositories.project.list();

        const agreementsMap: Record<string, Agreement[]> = {};
        for (const proj of loadedProjects) {
          const agmts = await backend.repositories.agreement.listByProjectId(proj.id);
          agreementsMap[proj.id] = agmts;
        }

        let latestAnalysis: ScopeGuardAnalysis | null = null;
        let latestProposal: ChangeProposal | null = null;

        const defaultProjId =
          loadedProjects.find((p) => p.id === 'proj_harbor_studio')?.id ||
          loadedProjects[0]?.id ||
          null;

        if (defaultProjId) {
          const analyses = await backend.repositories.scopeGuard.listAnalysesByProjectId(defaultProjId);
          if (analyses.length > 0) {
            latestAnalysis = analyses[0];
          }
          const proposals = await backend.repositories.proposal.listByProjectId(defaultProjId);
          if (proposals.length > 0) {
            latestProposal = proposals[0];
          }
        }

        if (isMounted) {
          setServices(backend);
          setProjects(loadedProjects);
          setProjectAgreements(agreementsMap);
          setSelectedProjectId(defaultProjId);

          if (defaultProjId && agreementsMap[defaultProjId]?.length > 0) {
            setSelectedAgreement(agreementsMap[defaultProjId][0]);
          }

          setAnalysis(latestAnalysis);
          setProposal(latestProposal);
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    }

    initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  const refreshData = useCallback(async () => {
    if (!services) return;
    try {
      const loadedProjects = await services.repositories.project.list();
      const agreementsMap: Record<string, Agreement[]> = {};
      for (const proj of loadedProjects) {
        const agmts = await services.repositories.agreement.listByProjectId(proj.id);
        agreementsMap[proj.id] = agmts;
      }
      setProjects(loadedProjects);
      setProjectAgreements(agreementsMap);
    } catch {
      // ignore
    }
  }, [services]);

  const activeProject = useMemo(() => {
    return (
      projects.find((p) => p.id === selectedProjectId) ||
      projects[0] || {
        id: 'proj_harbor_studio',
        title: 'Harbor Studio',
        clientName: 'Harbor Studio',
        description: 'Project field',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    );
  }, [projects, selectedProjectId]);

  const activeAgreements = useMemo(() => {
    return activeProject ? projectAgreements[activeProject.id] || [] : [];
  }, [activeProject, projectAgreements]);

  const activeAgreement = useMemo(() => {
    if (selectedAgreement && selectedAgreement.projectId === activeProject.id) {
      return selectedAgreement;
    }
    return activeAgreements[0] || null;
  }, [selectedAgreement, activeProject, activeAgreements]);

  // Default fallback draft matching the design specification
  const defaultDraft: ScopeDraft = useMemo(() => {
    return {
      title: activeProject ? activeProject.title : 'Harbor Studio',
      requirements: [
        {
          id: 'REQ-01',
          title: 'Five responsive pages',
          description: 'Home, About, Services, Work and Contact.',
          category: 'deliverable',
        },
        {
          id: 'REQ-02',
          title: 'Contact form',
          description: 'Send enquiries to the client.',
          category: 'deliverable',
        },
        {
          id: 'REQ-03',
          title: 'Design revisions',
          description: 'Two rounds of revisions to the agreed pages and contact form.',
          category: 'term',
        },
      ],
      budgetAmount: 15000,
      budgetCurrency: 'PHP',
      budgetNotes: 'Agreed fixed price for initial scope.',
      durationDays: 14,
      deadline: null,
      timelineNotes: '2 weeks turnaround from deposit.',
      revisionTerms: 'Two rounds of revisions included. Additional revisions quoted separately.',
      exclusions: [
        'User account authentication and member portal',
        'Appointment booking calendar engine',
      ],
      missingInformation: [
        'Delivery date is missing. Add the agreed date before confirming.',
      ],
      taxTreatment: 'none_specified',
    };
  }, [activeProject]);

  // Navigation helpers
  const navigateToSubScreen = useCallback(
    (target: SubScreen, direction: 'forward' | 'backward' = 'forward') => {
      setStackDirection(direction);
      setSubScreen(target);
    },
    [],
  );

  const handleSelectTab = useCallback(
    (tab: RootTab) => {
      if (tab === rootTab) return;
      const tabOrder: Record<RootTab, number> = {
        projects: 0,
        agreements: 1,
        settings: 2,
      };
      const currentIdx = tabOrder[rootTab];
      const targetIdx = tabOrder[tab];
      setTabDirection(targetIdx >= currentIdx ? 'forward' : 'backward');
      setRootTab(tab);
    },
    [rootTab],
  );

  // Android hardware back button handler
  useEffect(() => {
    const onBackPress = () => {
      if (subScreen === 'proposal') {
        navigateToSubScreen('review', 'backward');
        return true;
      }
      if (subScreen === 'review') {
        navigateToSubScreen('new_request', 'backward');
        return true;
      }
      if (subScreen === 'new_request') {
        navigateToSubScreen('overview', 'backward');
        return true;
      }
      if (subScreen === 'draft') {
        navigateToSubScreen(draftReturnScreen, 'backward');
        return true;
      }
      if (subScreen === 'overview' || subScreen === 'new_project') {
        navigateToSubScreen(null, 'backward');
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      onBackPress,
    );
    return () => subscription.remove();
  }, [subScreen, draftReturnScreen, navigateToSubScreen]);

  // Handlers
  const handleSelectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    const agmts = projectAgreements[projectId] || [];
    setSelectedAgreement(agmts[0] || null);

    const targetProject = projects.find((p) => p.id === projectId);
    if (targetProject?.draftScopeJson) {
      try {
        setActiveDraft(JSON.parse(targetProject.draftScopeJson));
      } catch {
        // ignore
      }
    }
    navigateToSubScreen('overview', 'forward');
  };

  const handleViewProjectOverview = (projectId: string) => {
    setSelectedProjectId(projectId);
    const agmts = projectAgreements[projectId] || [];
    setSelectedAgreement(agmts[0] || null);

    const targetProject = projects.find((p) => p.id === projectId);
    if (targetProject?.draftScopeJson) {
      try {
        setActiveDraft(JSON.parse(targetProject.draftScopeJson));
      } catch {
        // ignore
      }
    }
    navigateToSubScreen('overview', 'forward');
  };

  const handleSelectAgreementVersion = (agmt: Agreement) => {
    setSelectedAgreement(agmt);
  };

  const handleSelectProjectAgreementFromVault = (
    projectId: string,
    agreement: Agreement,
  ) => {
    setSelectedProjectId(projectId);
    setSelectedAgreement(agreement);
    navigateToSubScreen('overview', 'forward');
  };

  const handleReleaseProjectScope = async (projectId: string) => {
    if (!services) return;
    const project = projects.find((p) => p.id === projectId) || activeProject;
    if (!project) return;

    let draftToRelease: ScopeDraft = defaultDraft;
    if (activeDraft && project.id === activeProject.id) {
      draftToRelease = activeDraft;
    } else if (project.draftScopeJson) {
      try {
        draftToRelease = JSON.parse(project.draftScopeJson);
      } catch {
        draftToRelease = defaultDraft;
      }
    }

    try {
      const newAgmt = await services.services.kasunduanVault.confirmScope(
        project.id,
        draftToRelease,
      );
      setProjectAgreements((prev) => ({
        ...prev,
        [project.id]: [newAgmt, ...(prev[project.id] || [])],
      }));
      setSelectedProjectId(project.id);
      setSelectedAgreement(newAgmt);
      navigateToSubScreen('overview', 'forward');
    } catch {
      // ignore
    }
  };

  const handleEditProjectDraft = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects.find((p) => p.id === projectId) || activeProject;
    if (project?.draftScopeJson) {
      try {
        setActiveDraft(JSON.parse(project.draftScopeJson));
      } catch {
        // ignore
      }
    }
    setDraftReturnScreen('overview');
    navigateToSubScreen('draft', 'forward');
  };

  const handleCreateScopeDraft = async (data: {
    projectName: string;
    projectField: string;
    conversation: string;
  }) => {
    if (!services) return;

    // Fast brief extraction (local LLM or instant heuristic fallback)
    let extractedDraft: ScopeDraft;
    try {
      extractedDraft = await services.services.briefCraft.extractBrief(
        data.conversation,
        data.projectName,
      );
      extractedDraft.title = data.projectName;
    } catch {
      extractedDraft = services.services.briefCraft.extractBriefHeuristic(
        data.conversation,
        data.projectName,
      );
    }

    // Persist project with draftScopeJson in SQLite
    const newProjId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newProj = await services.repositories.project.create({
      id: newProjId,
      title: data.projectName,
      clientName: data.projectName,
      description: data.projectField,
      draftScopeJson: JSON.stringify(extractedDraft),
    });

    setProjects((prev) => [newProj, ...prev]);
    setSelectedProjectId(newProjId);
    setActiveDraft(extractedDraft);
    setDraftReturnScreen('new_project');
    navigateToSubScreen('draft', 'forward');
  };

  const handleConfirmScope = async (draftToConfirm: ScopeDraft) => {
    if (!services || !activeProject) return;
    try {
      // Update draftScopeJson in SQLite
      await services.repositories.project.update(activeProject.id, {
        draftScopeJson: JSON.stringify(draftToConfirm),
      });

      const newAgmt = await services.services.kasunduanVault.confirmScope(
        activeProject.id,
        draftToConfirm,
      );
      setProjectAgreements((prev) => ({
        ...prev,
        [activeProject.id]: [newAgmt, ...(prev[activeProject.id] || [])],
      }));
      setSelectedAgreement(newAgmt);
      navigateToSubScreen('overview', 'forward');
    } catch {
      navigateToSubScreen('overview', 'forward');
    }
  };

  const handleAnalyzeRequest = async (requestText: string) => {
    if (!services || !activeProject) return;

    try {
      const targetAgreement = activeAgreement || activeAgreements[0];
      if (!targetAgreement) return;

      const newAnalysis = await services.services.scopeGuard.analyzeRequest({
        projectId: activeProject.id,
        agreementId: targetAgreement.id,
        requestText,
      });
      setAnalysis(newAnalysis);

      // Generate proposal draft
      const newProposal = await services.services.changeDesk.draftProposal({
        projectId: activeProject.id,
        analysisId: newAnalysis.id,
        selectedItems: newAnalysis.findings
          .filter((f) => f.classification === 'potential_additional')
          .map((f) => f.item),
        freelancerFeeEstimate: 7000,
        freelancerDaysEstimate: 5,
        currency: targetAgreement.budgetCurrency || 'PHP',
      });
      setProposal(newProposal);

      navigateToSubScreen('review', 'forward');
    } catch {
      // Offline fallback
      navigateToSubScreen('review', 'forward');
    }
  };

  const handleDataReset = async () => {
    try {
      const db = await getDatabaseAsync();
      await seedDemoDataAsync(db, true);
    } catch {
      // ignore
    }
    await refreshData();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading Saklaw workspace...</Text>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.errorScreen}>
        <Text style={styles.errorTitle}>Failed to initialize</Text>
        <Text style={styles.errorText}>{error}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Viewport for Sub-Screens or Root Tabs */}
      <View style={styles.contentViewport}>
        <SlideTransition
          activeKey={subScreen ?? 'root'}
          direction={stackDirection}
          duration={280}
          style={styles.contentViewport}
        >
          {/* Sub-screens (Focused Module Flows) */}
          {subScreen === 'new_project' && (
            <NewProjectScreen
              onBack={() => navigateToSubScreen(null, 'backward')}
              onCreateScopeDraft={handleCreateScopeDraft}
            />
          )}

          {subScreen === 'draft' && (
            <ScopeDraftScreen
              project={activeProject}
              draft={activeDraft || defaultDraft}
              onBack={() => navigateToSubScreen(draftReturnScreen, 'backward')}
              onConfirmScope={handleConfirmScope}
            />
          )}

          {subScreen === 'overview' && (
            <ProjectOverviewScreen
              currentProject={activeProject}
              allProjects={projects}
              agreements={activeAgreements}
              selectedAgreement={activeAgreement}
              onSelectProject={(id) => {
                setSelectedProjectId(id);
                const agmts = projectAgreements[id] || [];
                setSelectedAgreement(agmts[0] || null);
              }}
              onSelectAgreementVersion={handleSelectAgreementVersion}
              onNavigateToNewRequest={() => navigateToSubScreen('new_request', 'forward')}
              onBack={() => navigateToSubScreen(null, 'backward')}
              onReleaseScope={() => handleReleaseProjectScope(activeProject.id)}
              onEditScopeDraft={() => handleEditProjectDraft(activeProject.id)}
            />
          )}

          {subScreen === 'new_request' && (
            <NewRequestScreen
              project={activeProject}
              agreement={activeAgreement}
              onBack={() => navigateToSubScreen('overview', 'backward')}
              onAnalyze={handleAnalyzeRequest}
              onViewConfirmedScope={() => navigateToSubScreen('overview', 'backward')}
            />
          )}

          {subScreen === 'review' && (
            <ScopeReviewScreen
              project={activeProject}
              agreement={activeAgreement}
              analysis={
                analysis || {
                  id: 'ana_fallback',
                  requestId: 'req_fallback',
                  agreementId: activeAgreement?.id || 'agmt_demo',
                  classification: 'potential_additional',
                  summary: 'Compared with Agreement v2. You decide what belongs in scope.',
                  findings: [
                    {
                      item: 'Customer accounts',
                      classification: 'potential_additional',
                      explanation: 'An account system is not listed in the recorded deliverables.',
                      evidenceRequirementIds: ['REQ-01', 'REQ-02'],
                    },
                    {
                      item: 'Appointment booking',
                      classification: 'potential_additional',
                      explanation: 'The agreed pages and enquiry form do not describe booking functionality.',
                      evidenceRequirementIds: ['REQ-01', 'REQ-02'],
                    },
                    {
                      item: 'Contact form colour update',
                      classification: 'included',
                      explanation: 'Fits the agreed contact form and revision terms. Confirm a revision round is available.',
                      evidenceRequirementIds: ['REQ-02', 'REQ-03'],
                    },
                    {
                      item: '“Make it feel more premium”',
                      classification: 'needs_clarification',
                      explanation: 'Which pages or visual details should change? Ask for examples before classifying.',
                      evidenceRequirementIds: ['REQ-01', 'REQ-03'],
                    },
                  ],
                  clarificationQuestions: [
                    'Which pages or visual details should change? Ask for examples before classifying.',
                  ],
                  createdAt: new Date().toISOString(),
                }
              }
              onBack={() => navigateToSubScreen('new_request', 'backward')}
              onProceedToProposal={() => navigateToSubScreen('proposal', 'forward')}
            />
          )}

          {subScreen === 'proposal' && (
            <ProposalScreen
              project={activeProject}
              agreement={activeAgreement}
              proposal={
                proposal || {
                  id: 'prop_fallback',
                  projectId: activeProject.id,
                  analysisId: 'ana_fallback',
                  selectedItems: ['Customer accounts', 'Appointment booking'],
                  freelancerFeeEstimate: null,
                  freelancerDaysEstimate: null,
                  currency: 'PHP',
                  draftMessage:
                    "Hi! Thanks for sharing the updates. Customer accounts and appointment booking would add to the pages and contact form in our current scope. Please review this proposed change and let me know if you would like to proceed. I'll record your approval before starting the additional work.",
                  status: 'draft',
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              }
              availableItems={
                analysis
                  ? analysis.findings
                      .filter((f) => f.classification === 'potential_additional')
                      .map((f) => f.item)
                  : ['Customer accounts', 'Appointment booking']
              }
              onBack={() => navigateToSubScreen('review', 'backward')}
              onSaveProposal={async (updatedProp) => {
                if (services) {
                  try {
                    const existing = await services.repositories.proposal.getById(updatedProp.id);
                    if (existing) {
                      await services.repositories.proposal.update(updatedProp.id, {
                        draftMessage: updatedProp.draftMessage,
                        freelancerFeeEstimate: updatedProp.freelancerFeeEstimate,
                        freelancerDaysEstimate: updatedProp.freelancerDaysEstimate,
                        status: updatedProp.status,
                      });
                    } else {
                      await services.repositories.proposal.create(updatedProp);
                    }
                  } catch {
                    // Fallback update in state
                  }
                }
                setProposal(updatedProp);
              }}
            />
          )}

          {/* Root Tabs (When not in a sub-screen) */}
          {subScreen === null && (
            <View style={styles.rootTabsWrapper}>
              <SlideTransition
                activeKey={rootTab}
                direction={tabDirection}
                duration={250}
                style={styles.tabContentArea}
              >
                {rootTab === 'projects' && (
                  <ProjectsScreen
                    projects={projects}
                    projectAgreements={projectAgreements}
                    onSelectProject={handleSelectProject}
                    onViewProjectOverview={handleViewProjectOverview}
                    onNewProject={() => navigateToSubScreen('new_project', 'forward')}
                    onReleaseProject={handleReleaseProjectScope}
                  />
                )}

                {rootTab === 'agreements' && (
                  <AgreementsScreen
                    projects={projects}
                    projectAgreements={projectAgreements}
                    onSelectProjectAgreement={handleSelectProjectAgreementFromVault}
                    onNewProject={() => navigateToSubScreen('new_project', 'forward')}
                  />
                )}

                {rootTab === 'settings' && (
                  <SettingsScreen
                    services={services}
                    onDataReset={handleDataReset}
                  />
                )}
              </SlideTransition>

              {/* Bottom Tab Bar matching Mockup */}
              <BottomNavBar
                activeTab={rootTab}
                onSelectTab={handleSelectTab}
              />
            </View>
          )}
        </SlideTransition>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  errorScreen: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.errorText,
  },
  errorText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  contentViewport: {
    flex: 1,
    backgroundColor: colors.background,
  },
  rootTabsWrapper: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabContentArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
