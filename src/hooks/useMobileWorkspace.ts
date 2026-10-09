import { useCallback, useEffect, useRef, useState } from 'react';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { initializeBackendAsync, type AppServices } from '@/services/bootstrapService';
import type { RootTab } from '@/components/BottomNavBar';
import { LLMEngineUnavailableError, LLMGenerationTimeoutError, LLMParseError } from '@/llm/contracts';
import { ScopeDraftSchema } from '@/types/schemas';
import { AgreementSchema } from '@/safety/persistedSchemas';
import { routeId, newId } from '@/utils/ids';
import { ServiceError, errorMessage } from '@/services/errors';
import { limits, textValue } from '@/safety/validation';
import { draftKey, parseStoredDraft } from '@/safety/scopeDraft';
import { toBackendDraft } from '@/services/backend/mappers';
import type { Project, Agreement, ScopeDraft, ScopeGuardAnalysis, ChangeProposal } from '@/types/domain';

const VIEWS = ['new_project', 'draft', 'overview', 'new_request', 'review', 'proposal'] as const;
type Screen = typeof VIEWS[number];

/** Validates routes and coordinates staging UI through the existing backend services. */
export function useMobileWorkspace() {
  const params = useLocalSearchParams<{ view?: string; tab?: string; projectId?: string; agreementId?: string; analysisId?: string; proposalId?: string }>();
  const view = VIEWS.find(value => value === params.view);
  const tab: RootTab = params.tab === 'agreements' || params.tab === 'settings' ? params.tab : 'projects';
  const projectId = routeId(params.projectId);
  const agreementId = routeId(params.agreementId);
  const analysisId = routeId(params.analysisId);
  const proposalId = routeId(params.proposalId);
  const [services, setServices] = useState<AppServices | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [agreements, setAgreements] = useState<Record<string, Agreement[]>>({});
  const [draft, setDraft] = useState<ScopeDraft | null>(null);
  const [source, setSource] = useState('');
  const [analysis, setAnalysis] = useState<ScopeGuardAnalysis | null>(null);
  const [proposal, setProposal] = useState<ChangeProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    setRevision(value => value + 1);
    return () => { focused.current = false; };
  }, []));
  const navigate = useCallback((target?: Screen, id?: string, extra: Record<string, string> = {}) => {
    if (!focused.current) return;
    router.push({ pathname: '/', params: { tab, ...(target ? { view: target } : {}), ...(id ? { projectId: id } : {}), ...extra } });
  }, [tab]);
  const back = () => router.canGoBack() ? router.back() : router.replace('/');

  useEffect(() => {
    let active = true;
    async function load() {
      await Promise.resolve();
      if (!active) return;
      setLoading(true); setError(null);
      const backend = await initializeBackendAsync();
      const records = await backend.repositories.project.list();
      const entries = await Promise.all(records.map(async project =>
        [project.id, await backend.repositories.agreement.listByProjectId(project.id)] as const));
      const project = records.find(record => record.id === projectId);
      if (view && view !== 'new_project' && !project) throw new ServiceError('not_found');
      let savedDraft: ScopeDraft | null = null;
      let sourceText = '';
      if (project) {
        const legacy = await backend.repositories.settings.get(draftKey(project.id));
        const legacyDraft = legacy ? parseStoredDraft(legacy, project.id) : null;
        savedDraft = project.draftScopeJson ? ScopeDraftSchema.parse(JSON.parse(project.draftScopeJson))
          : legacyDraft ? toBackendDraft(project.title, legacyDraft) : null;
        sourceText = await backend.repositories.settings.get(`saklaw_source:${project.id}`) ?? legacyDraft?.sourceText ?? '';
      }
      let [savedAnalysis, savedProposal] = await Promise.all([
        analysisId ? backend.repositories.scopeGuard.getAnalysisById(analysisId) : null,
        proposalId ? backend.repositories.proposal.getById(proposalId) : null,
      ]);
      if (savedProposal) {
        if (analysisId && analysisId !== savedProposal.analysisId) throw new ServiceError('not_found');
        savedAnalysis = await backend.repositories.scopeGuard.getAnalysisById(savedProposal.analysisId);
      }
      const projectAgreements = Object.fromEntries(entries);
      if (agreementId && !projectAgreements[projectId ?? '']?.some(record => record.id === agreementId)) throw new ServiceError('not_found');
      if (view === 'draft' && !savedDraft) throw new ServiceError('not_found');
      if (view === 'review' && (!savedAnalysis || !projectAgreements[projectId ?? '']?.some(record => record.id === savedAnalysis.agreementId))) throw new ServiceError('not_found');
      if (view === 'proposal' && (!savedProposal || savedProposal.projectId !== projectId || !savedAnalysis || !projectAgreements[projectId ?? '']?.some(record => record.id === savedAnalysis?.agreementId))) throw new ServiceError('not_found');
      if (active) {
        setServices(backend); setProjects(records); setAgreements(projectAgreements);
        setDraft(savedDraft); setSource(sourceText); setAnalysis(savedAnalysis); setProposal(savedProposal);
      }
    }
    void load().catch(reason => { if (active) { setServices(null); setProposal(null); setAnalysis(null); setError(errorMessage(reason)); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [projectId, agreementId, analysisId, proposalId, view, revision]);

  const project = projects.find(record => record.id === projectId);
  const history = agreements[projectId ?? ''] ?? [];
  const agreement = history.find(record => record.id === (analysis?.agreementId ?? agreementId)) ?? history[0] ?? null;
  const run = async (action: () => Promise<void>) => {
    try { setError(null); await action(); } catch (reason) { setError(errorMessage(reason)); }
  };
  const saveDraft = async (updated: ScopeDraft) => {
    if (!services || !project) throw new ServiceError('not_found');
    const checked = ScopeDraftSchema.parse(updated);
    const saved = await services.repositories.project.update(project.id, { draftScopeJson: JSON.stringify(checked) });
    if (!saved) throw new ServiceError('save_failed');
  };
  const confirm = async (updated: ScopeDraft) => {
    if (!services || !project) throw new ServiceError('not_found');
    const checked = ScopeDraftSchema.parse(updated);
    if (!checked.requirements.some(requirement => requirement.category === 'deliverable')) throw new ServiceError('invalid_input');
    const result = await services.transaction(async repos => {
      await repos.project.update(project.id, { draftScopeJson: JSON.stringify(checked) });
      return repos.agreement.createInitial(AgreementSchema.parse({ ...checked, id: newId('agmt'),
        projectId: project.id, versionNumber: 1, confirmedAt: new Date().toISOString() }));
    });
    navigate('overview', project.id, { agreementId: result.id });
  };

  const inference = async <T,>(action: () => Promise<T>) => {
    try { return await action(); } catch (reason) {
      if (reason instanceof LLMGenerationTimeoutError) throw new ServiceError('generation_timeout');
      if (reason instanceof LLMEngineUnavailableError) throw new ServiceError('model_unavailable');
      if (reason instanceof LLMParseError) throw new ServiceError('invalid_output');
      throw reason;
    }
  };
  const startProposal = async () => {
    if (!services || !project || !analysis || !agreement) throw new ServiceError('not_found');
    const items = analysis.findings.filter(finding => finding.classification === 'potential_additional').map(finding => finding.item);
    if (!items.length) throw new ServiceError('invalid_input');
    const now = new Date().toISOString();
    const created = await services.repositories.proposal.create({ id: newId('prop'), projectId: project.id, analysisId: analysis.id,
      selectedItems: items, freelancerFeeEstimate: null, freelancerDaysEstimate: null, currency: agreement.budgetCurrency,
      draftMessage: '', status: 'draft', createdAt: now, updatedAt: now });
    navigate('proposal', project.id, { proposalId: created.id, analysisId: analysis.id });
  };
  const createDraft = async (input: { projectName: string; projectField: string; conversation: string }, manual = false) => {
    if (!services) throw new ServiceError('not_found');
    const title = textValue(input.projectName, limits.name);
    const conversation = textValue(input.conversation, limits.source, manual);
    const extracted = manual ? { title, requirements: [], budgetAmount: null, budgetCurrency: 'PHP', budgetNotes: null, durationDays: null, deadline: null, timelineNotes: null, revisionTerms: null, exclusions: [], missingInformation: [], taxTreatment: 'none_specified' as const } : await inference(() => services.services.briefCraft.extractBrief(conversation));
    const checked = ScopeDraftSchema.parse({ ...extracted, title });
    if (!focused.current) throw new ServiceError('cancelled');
    const saved = await services.transaction(async repos => {
      const created = await repos.project.create({ id: newId('proj'), title, description: input.projectField,
        draftScopeJson: JSON.stringify(checked) });
      await repos.settings.set(`saklaw_source:${created.id}`, conversation);
      return created;
    });
    navigate('draft', saved.id);
  };
  const analyzeRequest = async (requestText: string) => {
    if (!services || !project || !agreement) throw new ServiceError('not_found');

      const result = await inference(() => services.services.scopeGuard.analyzeRequest({ projectId: project.id, agreementId: agreement.id,
        requestText: textValue(requestText, limits.request) }));
      navigate('review', project.id, { analysisId: result.id });
  };
  const saveProposal = async (updated: ChangeProposal) => {
    if (!services || !project || !proposal) throw new ServiceError('not_found');

      const stored = await services.repositories.proposal.getById(proposal.id);
      if (!stored || stored.projectId !== project.id) throw new ServiceError('not_found');
      const owner = await services.repositories.scopeGuard.getAnalysisById(stored.analysisId);
      if (!owner || updated.selectedItems.some(item => !owner.findings.some(finding => finding.item === item && finding.classification === 'potential_additional'))) throw new ServiceError('invalid_input');
      const saved = await services.repositories.proposal.update(stored.id, updated);
      if (!saved) throw new ServiceError('save_failed');
      setProposal(saved);
  };
  return { view, tab, services, projects, agreements, draft, source, analysis, proposal, loading, error,
    setRevision, project, history, agreement, navigate, back, run, confirm, createDraft, analyzeRequest, saveProposal, startProposal, saveDraft };
}
