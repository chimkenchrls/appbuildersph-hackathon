import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  BackHandler,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initializeBackendAsync, type AppServices } from '@/services/domain/bootstrapService';
import { getDatabaseAsync } from '@/database/client';
import { seedDemoDataAsync } from '@/database/seed';
import { colors } from '@/constants/theme';
import { SlideTransition } from '@/components/workspace/SlideTransition';
import { BottomNavBar, type RootTab } from '@/components/workspace/BottomNavBar';
import { ProjectsScreen } from '@/screens/workspace/ProjectsScreen';
import { NewProjectScreen } from '@/screens/workspace/NewProjectScreen';
import { ScopeDraftScreen } from '@/screens/workspace/ScopeDraftScreen';
import { ProjectOverviewScreen } from '@/screens/workspace/ProjectOverviewScreen';
import { NewRequestScreen } from '@/screens/workspace/NewRequestScreen';
import { ScopeReviewScreen } from '@/screens/workspace/ScopeReviewScreen';
import { ProposalEditorScreen } from '@/screens/workspace/ProposalEditorScreen';
import { AgreementsScreen } from '@/screens/workspace/AgreementsScreen';
import { SettingsScreen } from '@/screens/workspace/SettingsScreen';
import { OnboardingScreen } from '@/screens/workspace/OnboardingScreen';
import type {
  Project,
  Agreement,
  ScopeDraft,
  ScopeGuardAnalysis,
  ChangeProposal,
  ClientRequest,
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
  const [projectRequests, setProjectRequests] = useState<Record<string, ClientRequest[]>>({});
  const [analysesMap, setAnalysesMap] = useState<Record<string, ScopeGuardAnalysis>>({});
  const [proposalsMap, setProposalsMap] = useState<Record<string, ChangeProposal>>({});
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null);
  const [currentDraftProjectId, setCurrentDraftProjectId] = useState<string | null>(null);

  const [activeDraft, setActiveDraft] = useState<ScopeDraft | null>(null);
  const [analysis, setAnalysis] = useState<ScopeGuardAnalysis | null>(null);
  const [proposal, setProposal] = useState<ChangeProposal | null>(null);

  // Onboarding & Freelancer Profile states
  const [isOnboardingCompleted, setIsOnboardingCompleted] = useState<boolean | null>(null);
  const [freelancerName, setFreelancerName] = useState<string>('');
  const [freelancerRole, setFreelancerRole] = useState<string>('');

  // Load backend and database records on mount
  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      try {
        const backend = await initializeBackendAsync();
        // Clean up duplicate projects if any exist in the database
        await backend.repositories.project.cleanupDuplicates();
        const loadedProjects = await backend.repositories.project.list();

        const agreementsMap: Record<string, Agreement[]> = {};
        const requestsMap: Record<string, ClientRequest[]> = {};
        const analysesDict: Record<string, ScopeGuardAnalysis> = {};
        const proposalsDict: Record<string, ChangeProposal> = {};

        for (const proj of loadedProjects) {
          const agmts = await backend.repositories.agreement.listByProjectId(proj.id);
          agreementsMap[proj.id] = agmts;

          const reqs = await backend.repositories.scopeGuard.listRequestsByProjectId(proj.id);
          requestsMap[proj.id] = reqs;

          const proAnalyses = await backend.repositories.scopeGuard.listAnalysesByProjectId(proj.id);
          for (const a of proAnalyses) {
            analysesDict[a.requestId] = a;
          }

          const proProposals = await backend.repositories.proposal.listByProjectId(proj.id);
          for (const p of proProposals) {
            proposalsDict[p.analysisId] = p;
          }
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

        const onboarded = await backend.repositories.settings.get('onboarding_completed');
        const savedName = await backend.repositories.settings.get('freelancer_name');
        const savedRole = await backend.repositories.settings.get('freelancer_role');

        if (isMounted) {
          setServices(backend);
          setIsOnboardingCompleted(onboarded === 'true');
          setFreelancerName(savedName || '');
          setFreelancerRole(savedRole || '');
          setProjects(loadedProjects);
          setProjectAgreements(agreementsMap);
          setProjectRequests(requestsMap);
          setAnalysesMap(analysesDict);
          setProposalsMap(proposalsDict);
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
      const requestsMap: Record<string, ClientRequest[]> = {};
      const analysesDict: Record<string, ScopeGuardAnalysis> = {};
      const proposalsDict: Record<string, ChangeProposal> = {};

      for (const proj of loadedProjects) {
        const agmts = await services.repositories.agreement.listByProjectId(proj.id);
        agreementsMap[proj.id] = agmts;

        const reqs = await services.repositories.scopeGuard.listRequestsByProjectId(proj.id);
        requestsMap[proj.id] = reqs;

        const proAnalyses = await services.repositories.scopeGuard.listAnalysesByProjectId(proj.id);
        for (const a of proAnalyses) {
          analysesDict[a.requestId] = a;
        }

        const proProposals = await services.repositories.proposal.listByProjectId(proj.id);
        for (const p of proProposals) {
          proposalsDict[p.analysisId] = p;
        }
      }

      setProjects(loadedProjects);
      setProjectAgreements(agreementsMap);
      setProjectRequests(requestsMap);
      setAnalysesMap(analysesDict);
      setProposalsMap(proposalsDict);

      const storedName = await services.repositories.settings.get('freelancer_name');
      const storedRole = await services.repositories.settings.get('freelancer_role');
      if (storedName) setFreelancerName(storedName);
      if (storedRole) setFreelancerRole(storedRole);
    } catch {
      // ignore
    }
  }, [services]);

  const refreshProjectRequests = useCallback(
    async (projectId: string) => {
      if (!services) return;
      try {
        const reqs = await services.repositories.scopeGuard.listRequestsByProjectId(projectId);
        setProjectRequests((prev) => ({
          ...prev,
          [projectId]: reqs,
        }));
        const proAnalyses = await services.repositories.scopeGuard.listAnalysesByProjectId(projectId);
        setAnalysesMap((prev) => {
          const updated = { ...prev };
          for (const a of proAnalyses) {
            updated[a.requestId] = a;
          }
          return updated;
        });
      } catch {
        // ignore
      }
    },
    [services],
  );

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

  // Default fallback draft
  const defaultDraft: ScopeDraft = useMemo(() => {
    return {
      title: activeProject ? activeProject.title : 'Project Scope',
      requirements: [],
      budgetAmount: null,
      budgetCurrency: 'PHP',
      budgetNotes: null,
      durationDays: null,
      deadline: null,
      timelineNotes: null,
      revisionTerms: null,
      exclusions: [],
      missingInformation: [],
      taxTreatment: 'none_specified',
      extractedWithAi: false,
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

    const normalizedName = data.projectName.trim().toLowerCase();
    const existingDuplicate = projects.find(
      (p) =>
        p.id !== currentDraftProjectId &&
        p.title.trim().toLowerCase() === normalizedName,
    );
    if (existingDuplicate) {
      throw new Error(`A project named "${data.projectName}" already exists.`);
    }

    // Fast brief extraction (local LLM or instant heuristic fallback)
    let extractedDraft: ScopeDraft;
    try {
      extractedDraft = await services.services.briefCraft.extractBrief(
        data.conversation,
        data.projectName,
      );
      extractedDraft.title = data.projectName;
      extractedDraft.sourceConversation = data.conversation;
    } catch {
      extractedDraft = services.services.briefCraft.extractBriefHeuristic(
        data.conversation,
        data.projectName,
      );
      extractedDraft.sourceConversation = data.conversation;
    }

    let targetProj: Project;
    if (currentDraftProjectId) {
      // Re-use and update existing unconfirmed draft project from this session instead of creating duplicate
      const updated = await services.repositories.project.update(currentDraftProjectId, {
        title: data.projectName,
        clientName: data.projectName,
        description: data.projectField,
        draftScopeJson: JSON.stringify(extractedDraft),
      });
      targetProj = updated || {
        id: currentDraftProjectId,
        title: data.projectName,
        clientName: data.projectName,
        description: data.projectField,
        draftScopeJson: JSON.stringify(extractedDraft),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setProjects((prev) =>
        prev.map((p) => (p.id === currentDraftProjectId ? targetProj : p)),
      );
    } else {
      // Persist project with draftScopeJson in SQLite
      const newProjId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      targetProj = await services.repositories.project.create({
        id: newProjId,
        title: data.projectName,
        clientName: data.projectName,
        description: data.projectField,
        draftScopeJson: JSON.stringify(extractedDraft),
      });
      setCurrentDraftProjectId(newProjId);
      setProjects((prev) => [targetProj, ...prev.filter((p) => p.id !== newProjId)]);
    }

    setSelectedProjectId(targetProj.id);
    setActiveDraft(extractedDraft);
    setDraftReturnScreen('new_project');
    navigateToSubScreen('draft', 'forward');
  };

  // The draft editor saves edits when the freelancer leaves it, so unconfirmed work is kept.
  const handleSaveDraft = async (draftToSave: ScopeDraft) => {
    if (!services || !activeProject) throw new Error('The project is unavailable.');
    await services.repositories.project.update(activeProject.id, {
      draftScopeJson: JSON.stringify(draftToSave),
    });
    setActiveDraft(draftToSave);
  };

  const handleConfirmScope = async (draftToConfirm: ScopeDraft) => {
    if (!services || !activeProject) return;
    try {
      setCurrentDraftProjectId(null);
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

  const handleDeleteProject = async (projectId: string) => {
    if (!services) return;
    try {
      await services.repositories.project.delete(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
      setProjectAgreements((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      setProjectRequests((prev) => {
        const next = { ...prev };
        delete next[projectId];
        return next;
      });
      if (selectedProjectId === projectId) {
        const remaining = projects.filter((p) => p.id !== projectId);
        setSelectedProjectId(remaining[0]?.id || null);
      }
      if (currentDraftProjectId === projectId) {
        setCurrentDraftProjectId(null);
      }
      if (subScreen === 'overview') {
        navigateToSubScreen(null, 'backward');
      }
    } catch {
      // ignore
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

      // Generate proposal draft from findings
      const potentialItems = newAnalysis.findings
        .filter((f) => f.classification === 'potential_additional')
        .map((f) => f.item);

      const newProposal = await services.services.changeDesk.draftProposal({
        projectId: activeProject.id,
        analysisId: newAnalysis.id,
        selectedItems: potentialItems,
        freelancerFeeEstimate: 0,
        freelancerDaysEstimate: 0,
        currency: targetAgreement.budgetCurrency || 'PHP',
      });
      setProposal(newProposal);

      await refreshProjectRequests(activeProject.id);
      navigateToSubScreen('review', 'forward');
    } catch {
      // Offline fallback
      navigateToSubScreen('review', 'forward');
    }
  };

  const handleSaveRequest = async (requestText: string) => {
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

      const potentialItems = newAnalysis.findings
        .filter((f) => f.classification === 'potential_additional')
        .map((f) => f.item);

      const newProposal = await services.services.changeDesk.draftProposal({
        projectId: activeProject.id,
        analysisId: newAnalysis.id,
        selectedItems: potentialItems,
        freelancerFeeEstimate: 0,
        freelancerDaysEstimate: 0,
        currency: targetAgreement.budgetCurrency || 'PHP',
      });
      setProposal(newProposal);

      await refreshProjectRequests(activeProject.id);
      navigateToSubScreen('overview', 'backward');
    } catch {
      navigateToSubScreen('overview', 'backward');
    }
  };

  const handleAcceptRequest = async (
    request: ClientRequest,
    additions: string[],
    additionalFee: number | null,
    additionalDays: number | null,
    signatoryName?: string | null,
    approvalNotes?: string | null,
  ) => {
    if (!services || !activeProject) return;
    const targetAgreement = activeAgreement || activeAgreements[0];
    if (!targetAgreement) return;

    try {
      const nextAgmt = await services.services.kasunduanVault.acceptScopeChange({
        projectId: activeProject.id,
        currentAgreement: targetAgreement,
        additionalDeliverables: additions,
        additionalFee: additionalFee ?? undefined,
        additionalDays: additionalDays ?? undefined,
        clientSignatoryName: signatoryName || undefined,
        clientSignatureData: approvalNotes || undefined,
      });

      await services.repositories.scopeGuard.updateRequestStatus(
        request.id,
        'accepted',
        new Date().toISOString(),
      );

      setProjectAgreements((prev) => ({
        ...prev,
        [activeProject.id]: [nextAgmt, ...(prev[activeProject.id] || [])],
      }));
      setSelectedAgreement(nextAgmt);
      await refreshProjectRequests(activeProject.id);
    } catch {
      // ignore
    }
  };

  const handleRecordClientApproval = async (
    agreementId: string,
    signatoryName: string,
    signatureNotes?: string,
  ) => {
    if (!services || !activeProject) return;
    try {
      const updatedAgmt = await services.services.kasunduanVault.recordClientApproval(
        agreementId,
        signatoryName,
        signatureNotes,
      );
      if (!updatedAgmt) return;

      setProjectAgreements((prev) => ({
        ...prev,
        [activeProject.id]: (prev[activeProject.id] || []).map((agmt) =>
          agmt.id === agreementId ? updatedAgmt : agmt,
        ),
      }));
      if (selectedAgreement?.id === agreementId) {
        setSelectedAgreement(updatedAgmt);
      }
    } catch {
      // ignore
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!services || !activeProject) return;
    try {
      await services.services.scopeGuard.deleteRequest(requestId);
      await refreshProjectRequests(activeProject.id);
    } catch {
      // ignore
    }
  };

  const handleReviewStoredRequest = (request: ClientRequest) => {
    const matchedAnalysis = analysesMap[request.id];
    if (matchedAnalysis) {
      setAnalysis(matchedAnalysis);
      const matchedProposal = proposalsMap[matchedAnalysis.id];
      if (matchedProposal) {
        setProposal(matchedProposal);
      }
    }
    navigateToSubScreen('review', 'forward');
  };

  const handleAcceptProposalFromScreen = async (
    selectedItems?: string[],
    fee?: number | null,
    days?: number | null,
  ) => {
    if (!services || !activeProject) return;
    const targetAgreement = activeAgreement || activeAgreements[0];
    if (!targetAgreement) return;

    const additionsToInclude =
      selectedItems && selectedItems.length > 0
        ? selectedItems
        : proposal?.selectedItems && proposal.selectedItems.length > 0
        ? proposal.selectedItems
        : ['Additional client requested deliverables'];

    try {
      const nextAgmt = await services.services.kasunduanVault.acceptScopeChange({
        projectId: activeProject.id,
        currentAgreement: targetAgreement,
        additionalDeliverables: additionsToInclude,
        additionalFee: fee ?? (proposal?.freelancerFeeEstimate ?? undefined),
        additionalDays: days ?? (proposal?.freelancerDaysEstimate ?? undefined),
      });

      if (analysis?.requestId) {
        await services.repositories.scopeGuard.updateRequestStatus(
          analysis.requestId,
          'accepted',
          new Date().toISOString(),
        );
      }

      setProjectAgreements((prev) => ({
        ...prev,
        [activeProject.id]: [nextAgmt, ...(prev[activeProject.id] || [])],
      }));
      setSelectedAgreement(nextAgmt);
      await refreshProjectRequests(activeProject.id);
      navigateToSubScreen('overview', 'backward');
    } catch {
      navigateToSubScreen('overview', 'backward');
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

  const handleCompleteOnboarding = async (profile: { name: string; role: string }) => {
    if (!services) return;
    await services.repositories.settings.set('freelancer_name', profile.name);
    await services.repositories.settings.set('freelancer_role', profile.role);
    await services.repositories.settings.set('onboarding_completed', 'true');
    setFreelancerName(profile.name);
    setFreelancerRole(profile.role);
    setIsOnboardingCompleted(true);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Loading OwlSet workspace...</Text>
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

  if (isOnboardingCompleted === false) {
    return <OnboardingScreen onComplete={handleCompleteOnboarding} />;
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
              services={services}
              existingProjects={projects}
              onBack={() => {
                setCurrentDraftProjectId(null);
                navigateToSubScreen(null, 'backward');
              }}
              onCreateScopeDraft={handleCreateScopeDraft}
            />
          )}

          {subScreen === 'draft' && (
            <ScopeDraftScreen
              project={activeProject}
              draft={activeDraft || defaultDraft}
              onBack={() => navigateToSubScreen(draftReturnScreen, 'backward')}
              onConfirmScope={handleConfirmScope}
              onSaveDraft={handleSaveDraft}
            />
          )}

          {subScreen === 'overview' && (
            <ProjectOverviewScreen
              currentProject={activeProject}
              allProjects={projects}
              agreements={activeAgreements}
              selectedAgreement={activeAgreement}
              requests={projectRequests[activeProject.id] || []}
              analyses={analysesMap}
              proposals={proposalsMap}
              freelancerName={freelancerName}
              freelancerRole={freelancerRole}
              onSelectProject={(id) => {
                setSelectedProjectId(id);
                const agmts = projectAgreements[id] || [];
                setSelectedAgreement(agmts[0] || null);
              }}
              onSelectAgreementVersion={handleSelectAgreementVersion}
              onNavigateToNewRequest={() => navigateToSubScreen('new_request', 'forward')}
              onReviewRequest={handleReviewStoredRequest}
              onAcceptRequest={handleAcceptRequest}
              onRecordClientApproval={handleRecordClientApproval}
              onDeleteRequest={handleDeleteRequest}
              onDeleteProject={handleDeleteProject}
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
              onSaveRequest={handleSaveRequest}
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
                  agreementId: activeAgreement?.id || '',
                  classification: 'potential_additional',
                  summary: 'No active analysis. Enter a request to evaluate against your baseline agreement.',
                  findings: [],
                  clarificationQuestions: [],
                  createdAt: new Date().toISOString(),
                }
              }
              onBack={() => navigateToSubScreen('new_request', 'backward')}
              onProceedToProposal={() => navigateToSubScreen('proposal', 'forward')}
            />
          )}

          {subScreen === 'proposal' && (
            <ProposalEditorScreen
              project={activeProject}
              agreement={activeAgreement}
              proposal={
                proposal || {
                  id: 'prop_fallback',
                  projectId: activeProject.id,
                  analysisId: analysis?.id || 'ana_fallback',
                  selectedItems: [],
                  freelancerFeeEstimate: null,
                  freelancerDaysEstimate: null,
                  currency: activeAgreement?.budgetCurrency || 'PHP',
                  draftMessage:
                    'Hi! Thanks for sharing your request. Based on our agreed scope, the requested changes introduce additional deliverables. Please review this proposed change and let me know if you would like to proceed.',
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
              onAcceptProposal={handleAcceptProposalFromScreen}
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
                    onNewProject={() => {
                      setCurrentDraftProjectId(null);
                      navigateToSubScreen('new_project', 'forward');
                    }}
                    onReleaseProject={handleReleaseProjectScope}
                    onDeleteProject={handleDeleteProject}
                  />
                )}

                {rootTab === 'agreements' && (
                  <AgreementsScreen
                    projects={projects}
                    projectAgreements={projectAgreements}
                    onSelectProjectAgreement={handleSelectProjectAgreementFromVault}
                    onNewProject={() => {
                      setCurrentDraftProjectId(null);
                      navigateToSubScreen('new_project', 'forward');
                    }}
                  />
                )}

                {rootTab === 'settings' && (
                  <SettingsScreen
                    services={services}
                    onDataReset={handleDataReset}
                    onProfileUpdated={(name, role) => {
                      setFreelancerName(name);
                      setFreelancerRole(role);
                    }}
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
