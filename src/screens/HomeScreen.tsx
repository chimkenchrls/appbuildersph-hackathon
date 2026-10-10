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
import { KasunduanVaultService } from '@/services/kasunduanVaultService';
import { ServiceError, errorMessage, extractionFailure } from '@/services/errors';
import { limits } from '@/safety/validation';
import { notifyError } from '@/utils/notify';
import { composeProposalMessage } from '@/safety/proposalMessage';
import { colors } from '@/constants/theme';
import { SlideTransition } from '@/components/SlideTransition';
import { BottomNavBar, type RootTab } from '@/components/BottomNavBar';
import { ProjectsScreen } from '@/screens/ProjectsScreen';
import { NewProjectScreen } from '@/screens/NewProjectScreen';
import { ScopeDraftScreen } from '@/screens/ScopeDraftScreen';
import { ProjectOverviewScreen } from '@/screens/ProjectOverviewScreen';
import { NewRequestScreen } from '@/screens/NewRequestScreen';
import { ScopeReviewScreen } from '@/screens/ScopeReviewScreen';
import { ProposalEditorScreen } from '@/screens/ProposalEditorScreen';
import { AgreementsScreen } from '@/screens/AgreementsScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { OnboardingScreen } from '@/screens/OnboardingScreen';
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

/** The saved working draft that belongs to a project, or null when it has none or it cannot be read. */
function draftOf(target: { draftScopeJson?: string | null } | undefined): ScopeDraft | null {
  if (!target?.draftScopeJson) return null;
  try {
    return JSON.parse(target.draftScopeJson) as ScopeDraft;
  } catch {
    return null;
  }
}

/** A failed write as a typed error, for screens that choose their own wording from its code. */
function saveError(reason: unknown): ServiceError {
  return reason instanceof ServiceError ? reason : new ServiceError('save_failed');
}

/** A failed write, as the message the user sees. */
function saveFailure(reason: unknown): Error {
  return new Error(errorMessage(saveError(reason)));
}

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

    // The draft in memory always belongs to the project being opened.
    setActiveDraft(draftOf(projects.find((p) => p.id === projectId)));
    navigateToSubScreen('overview', 'forward');
  };

  const handleViewProjectOverview = (projectId: string) => {
    setSelectedProjectId(projectId);
    const agmts = projectAgreements[projectId] || [];
    setSelectedAgreement(agmts[0] || null);

    // The draft in memory always belongs to the project being opened.
    setActiveDraft(draftOf(projects.find((p) => p.id === projectId)));
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
    setActiveDraft(draftOf(projects.find((p) => p.id === projectId)));
    navigateToSubScreen('overview', 'forward');
  };

  const handleReleaseProjectScope = async (projectId: string) => {
    if (!services) return;
    const project = projects.find((p) => p.id === projectId) || activeProject;
    if (!project) return;

    // Release exactly this project's own saved draft, never one left from another project.
    const draftToRelease: ScopeDraft | null =
      project.id === activeProject.id && activeDraft ? activeDraft : draftOf(project);
    if (!draftToRelease) {
      notifyError('Nothing to confirm', 'This project has no saved draft to confirm. Open it and add the deliverables first.');
      return;
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
    } catch (reason) {
      notifyError('Could not confirm the scope', saveFailure(reason).message);
    }
  };

  const handleEditProjectDraft = (projectId: string) => {
    setSelectedProjectId(projectId);
    const project = projects.find((p) => p.id === projectId) || activeProject;
    setActiveDraft(draftOf(project));
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

    // Only text can be read. A very long paste or a list of attachments with no text is refused
    // here, before any model or fallback runs, and the user's text stays in the form.
    const pasted = data.conversation.trim();
    if (pasted.length > limits.source) {
      throw new Error(
        `This conversation is too long (${pasted.length.toLocaleString('en-US')} characters). The limit is ${limits.source.toLocaleString('en-US')}. Paste only the relevant messages.`,
      );
    }
    if (!pasted.replace(/\[Attached [^\]]*\]/gi, '').trim()) {
      throw new Error('Attached files cannot be read yet. Paste the text of the conversation or type the requirements.');
    }

    // The service answers with the model, or with its labelled rule-based extractor when no
    // engine is available. Any other failure (too long, timeout, unusable answer) is shown to
    // the user; it is never turned into a draft that looks like a model result.
    let extractedDraft: ScopeDraft;
    try {
      extractedDraft = await services.services.briefCraft.extractBrief(
        data.conversation,
        data.projectName,
      );
    } catch (reason) {
      throw extractionFailure(reason);
    }
    extractedDraft.title = data.projectName;
    extractedDraft.sourceConversation = data.conversation;

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
    // A failure is rethrown so the draft screen shows it and keeps the user's edits.
    try {
      // Update draftScopeJson in SQLite
      await services.repositories.project.update(activeProject.id, {
        draftScopeJson: JSON.stringify(draftToConfirm),
      });

      const newAgmt = await services.services.kasunduanVault.confirmScope(
        activeProject.id,
        draftToConfirm,
      );
      setCurrentDraftProjectId(null);
      setProjectAgreements((prev) => ({
        ...prev,
        [activeProject.id]: [newAgmt, ...(prev[activeProject.id] || [])],
      }));
      setSelectedAgreement(newAgmt);
      navigateToSubScreen('overview', 'forward');
    } catch (reason) {
      throw saveError(reason);
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
    } catch (reason) {
      notifyError('Could not delete the project', saveFailure(reason).message);
    }
  };

  const handleAnalyzeRequest = async (requestText: string, storedRequest?: ClientRequest) => {
    if (!services || !activeProject) throw new Error(errorMessage(new ServiceError('not_found')));
    const targetAgreement = storedRequest
      ? await services.repositories.agreement.getById(storedRequest.agreementId)
      : activeAgreement || activeAgreements[0];
    if (!targetAgreement) throw new Error('Confirm your project scope before analyzing a request.');
    setAnalysis(null);
    setProposal(null);

    try {
      const newAnalysis = await services.services.scopeGuard.analyzeRequest({
        projectId: activeProject.id,
        agreementId: targetAgreement.id,
        requestText,
        requestId: storedRequest?.id,
      });
      // Generate proposal draft from findings, once per analysis. Fee and days stay unset until
      // the freelancer enters them: an unset estimate is not zero.
      const potentialItems = newAnalysis.findings
        .filter((f) => f.classification === 'potential_additional')
        .map((f) => f.item);

      let newProposal: ChangeProposal | null =
        (await services.repositories.proposal.listByProjectId(activeProject.id))
          .find((p) => p.analysisId === newAnalysis.id) ?? null;
      if (!newProposal && potentialItems.length) {
        try {
          newProposal = await services.services.changeDesk.draftProposal({
            projectId: activeProject.id,
            analysisId: newAnalysis.id,
            selectedItems: potentialItems,
            freelancerFeeEstimate: null,
            freelancerDaysEstimate: null,
            currency: targetAgreement.budgetCurrency || 'PHP',
          });
        } catch (reason) {
          // The analysis is already saved; show it in the list so a retry only drafts the proposal.
          await refreshProjectRequests(activeProject.id);
          throw reason;
        }
      }
      setAnalysis(newAnalysis);
      setProposal(newProposal);
      if (newProposal) setProposalsMap(previous => ({ ...previous, [newAnalysis.id]: newProposal }));

      await refreshProjectRequests(activeProject.id);
      navigateToSubScreen('review', 'forward');
    } catch (reason) {
      throw extractionFailure(reason);
    }
  };

  const handleSaveRequest = async (requestText: string) => {
    if (!services || !activeProject) throw new Error(errorMessage(new ServiceError('not_found')));
    const targetAgreement = activeAgreement || activeAgreements[0];
    if (!targetAgreement) throw new Error('Confirm your project scope before saving a request.');

    let savedRequest: ClientRequest;
    try {
      savedRequest = await services.services.scopeGuard.saveRequest({
        projectId: activeProject.id,
        agreementId: targetAgreement.id,
        requestText,
      });
    } catch (reason) {
      throw new Error(errorMessage(reason instanceof ServiceError ? reason : new ServiceError('save_failed')));
    }
    setProjectRequests(prev => ({
      ...prev,
      [activeProject.id]: [savedRequest, ...(prev[activeProject.id] || [])],
    }));
    navigateToSubScreen('overview', 'backward');
  };

  const handleAcceptRequest = async (
    request: ClientRequest,
    additions: string[],
    additionalFee: number | null,
    additionalDays: number | null,
    signatoryName?: string | null,
    approvalNotes?: string | null,
  ) => {
    if (!services || !activeProject) throw new ServiceError('not_found');
    const targetAgreement = activeAgreement || activeAgreements[0];
    if (!targetAgreement) throw new ServiceError('not_found');

    try {
      const nextAgmt = await services.transaction(async repos => {
        const storedRequest = await repos.scopeGuard.getRequestById(request.id);
        if (!storedRequest || storedRequest.projectId !== activeProject.id) throw new ServiceError('not_found');
        if (storedRequest.status === 'accepted') throw new ServiceError('conflict');
        const next = await new KasunduanVaultService(repos.agreement).acceptScopeChange({
          projectId: activeProject.id, currentAgreement: targetAgreement,
          additionalDeliverables: additions, additionalFee: additionalFee ?? undefined,
          additionalDays: additionalDays ?? undefined,
          clientSignatoryName: signatoryName || undefined, clientSignatureData: approvalNotes || undefined,
        });
        await repos.scopeGuard.updateRequestStatus(request.id, 'accepted', new Date().toISOString());
        return next;
      });

      setProjectAgreements((prev) => ({
        ...prev,
        [activeProject.id]: [nextAgmt, ...(prev[activeProject.id] || [])],
      }));
      setSelectedAgreement(nextAgmt);
      await refreshProjectRequests(activeProject.id);
    } catch (reason) {
      throw reason instanceof ServiceError ? reason : new ServiceError('save_failed');
    }
  };

  const handleResolveExclusionConflicts = async () => {
    if (!services || !activeAgreement) throw new ServiceError('not_found');
    try {
      const next = await new KasunduanVaultService(services.repositories.agreement)
        .resolveExclusionConflicts(activeProject.id, activeAgreement);
      setProjectAgreements(previous => ({ ...previous, [activeProject.id]: [next, ...(previous[activeProject.id] || [])] }));
      setSelectedAgreement(next);
    } catch (reason) {
      throw reason instanceof ServiceError ? reason : new ServiceError('save_failed');
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
    } catch (reason) {
      throw saveError(reason);
    }
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!services || !activeProject) return;
    try {
      await services.services.scopeGuard.deleteRequest(requestId);
      await refreshProjectRequests(activeProject.id);
    } catch (reason) {
      notifyError('Could not delete the request', saveFailure(reason).message);
    }
  };

  const handleReviewStoredRequest = async (request: ClientRequest) => {
    const matchedAnalysis = analysesMap[request.id];
    const matchedProposal = matchedAnalysis ? proposalsMap[matchedAnalysis.id] : null;
    if (!matchedAnalysis || (!matchedProposal && matchedAnalysis.findings.some(f => f.classification === 'potential_additional'))) {
      await handleAnalyzeRequest(request.rawText, request);
      return;
    }
    setAnalysis(matchedAnalysis);
    setProposal(matchedProposal || null);
    navigateToSubScreen('review', 'forward');
  };

  /** Opens the proposal for the analysis on screen, creating its draft first if it has none. */
  const handleProceedToProposal = async () => {
    if (!services || !activeProject || !analysis) {
      notifyError('Nothing to propose', 'Check a request first.');
      return;
    }
    const additions = analysis.findings
      .filter((f) => f.classification === 'potential_additional')
      .map((f) => f.item);
    if (!additions.length) {
      notifyError(
        'No additional work to propose',
        'This request looks covered by the confirmed scope, or it needs clarifying first. A change proposal is for work that goes beyond the scope.',
      );
      return;
    }
    if (!proposal || proposal.analysisId !== analysis.id) {
      try {
        const now = new Date().toISOString();
        const currency = activeAgreement?.budgetCurrency || 'PHP';
        const created = await services.repositories.proposal.create({
          id: `prop_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          projectId: activeProject.id,
          analysisId: analysis.id,
          selectedItems: additions,
          freelancerFeeEstimate: null,
          freelancerDaysEstimate: null,
          currency,
          draftMessage: composeProposalMessage('Please review the proposed additions to our recorded scope.', {
            deliverables: additions, feeAmount: null, currency, extraWorkingDays: null,
          }),
          status: 'draft',
          createdAt: now,
          updatedAt: now,
        });
        setProposal(created);
        setProposalsMap((previous) => ({ ...previous, [analysis.id]: created }));
      } catch (reason) {
        notifyError('Could not prepare the proposal', saveFailure(reason).message);
        return;
      }
    }
    navigateToSubScreen('proposal', 'forward');
  };

  /** Saves the editor's proposal. A failure is thrown so the editor shows it; nothing pretends to be saved. */
  const handleSaveProposal = async (updatedProp: ChangeProposal) => {
    if (!services) throw saveError(new ServiceError('not_found'));
    try {
      const existing = await services.repositories.proposal.getById(updatedProp.id);
      const saved = existing
        ? await services.repositories.proposal.update(updatedProp.id, {
            selectedItems: updatedProp.selectedItems,
            draftMessage: updatedProp.draftMessage,
            freelancerFeeEstimate: updatedProp.freelancerFeeEstimate,
            freelancerDaysEstimate: updatedProp.freelancerDaysEstimate,
            status: updatedProp.status,
          })
        : await services.repositories.proposal.create(updatedProp);
      if (!saved) throw new ServiceError('save_failed');
      setProposal(saved);
      setProposalsMap((previous) => ({ ...previous, [saved.analysisId]: saved }));
    } catch (reason) {
      throw saveError(reason);
    }
  };

  const handleAcceptProposalFromScreen = async (
    selectedItems?: string[],
    fee?: number | null,
    days?: number | null,
  ) => {
    if (!services || !activeProject || !analysis) throw new ServiceError('not_found');

    if (proposal && proposal.analysisId !== analysis.id) throw new ServiceError('not_found');
    const additionsToInclude = selectedItems ?? proposal?.selectedItems ?? [];
    const request = await services.repositories.scopeGuard.getRequestById(analysis.requestId);
    if (!request) throw new ServiceError('not_found');
    await handleAcceptRequest(request, additionsToInclude,
      fee === undefined ? proposal?.freelancerFeeEstimate ?? null : fee,
      days === undefined ? proposal?.freelancerDaysEstimate ?? null : days);
    navigateToSubScreen('overview', 'backward');
  };

  const handleDataReset = async () => {
    // Resetting would erase confirmed agreements, which are meant to stay. It is turned off.
    throw new Error('Workspace reset is turned off to protect your confirmed agreements.');
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
              onResolveExclusionConflicts={handleResolveExclusionConflicts}
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
              onProceedToProposal={() => void handleProceedToProposal()}
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
                  : proposal?.selectedItems ?? []
              }
              onBack={() => navigateToSubScreen('review', 'backward')}
              onAcceptProposal={handleAcceptProposalFromScreen}
              onSaveProposal={handleSaveProposal}
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
