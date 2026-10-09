import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { data, workflows } from '@/services/active';
import { useOperation } from '@/hooks/useOperation';
import { DraftWriter } from '@/services/draftWriter';
import { checkCancelled, ServiceError } from '@/services/errors';
import { parseEstimate } from '@/safety/parseEstimate';
import { newId } from '@/utils/ids';
import type { Agreement, Analysis, Project, Proposal, ScopeDraft } from '@/types/workspace';

type Form = { draft: ScopeDraft; budget: string };
export function useWorkspace(projectId: string) {
  const [project, setProject] = useState<Project | null>(null);
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [form, setFormState] = useState<Form | null>(null);
  const current = useRef<Form | null>(null);
  const saved = useRef('null');
  const [savedKey, setSavedKey] = useState('null');
  const [sourceText, setSourceState] = useState('');
  const source = useRef('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const operation = useOperation();
  const [writer] = useState(() => new DraftWriter<ScopeDraft>(snapshot => data.saveDraft(snapshot)));
  const setForm = useCallback((next: Form | null) => { current.current = next; setFormState(next); }, []);
  const markSaved = useCallback((snapshot: Form | null) => { saved.current = JSON.stringify(snapshot); setSavedKey(saved.current); }, []);
  const setSourceText = (value: string) => { if (operation.busy) return; source.current = value; setSourceState(value); };
  const load = useCallback((isActive: () => boolean) => {
    setLoading(true); setError(null);
    void (async () => {
      try {
        const p = await data.getProject(projectId);
        if (!p) throw new ServiceError('not_found');
        const [d, a, history, messages] = await Promise.all([data.getDraft(projectId), data.getAgreement(projectId), data.listAnalyses(projectId), data.listProposals(projectId)]);
        if (!isActive()) return;
        setProject(p); setAgreement(a); setAnalyses(history); setProposals(messages);
        if (JSON.stringify(current.current) === saved.current) {
          const next = d ? { draft: d, budget: d.terms.budgetAmount === null ? '' : String(d.terms.budgetAmount) } : null;
          setForm(next); markSaved(next);
        }
      } catch (e) { if (isActive()) setError(e); } finally { if (isActive()) setLoading(false); }
    })();
  }, [projectId, setForm, markSaved]);
  useFocusEffect(useCallback(() => {
    let active = true;
    load(() => active);
    return () => { active = false; };
  }, [load]));

  const updateDraft = (change: (value: ScopeDraft) => ScopeDraft) => {
    if (!current.current || operation.busy || agreement) return;
    setForm({ ...current.current, draft: change(current.current.draft) });
  };
  const setBudget = (budget: string) => { if (current.current && !operation.busy) setForm({ ...current.current, budget }); };
  const toDraft = (snapshot: Form): ScopeDraft => ({ ...snapshot.draft, terms: { ...snapshot.draft.terms, budgetAmount: parseEstimate(snapshot.budget) } });
  let budgetError = '';
  try { parseEstimate(form?.budget ?? ''); } catch { budgetError = 'Use a positive number or 0, with up to two decimal places.'; }
  const saveDraft = async () => {
    const snapshot = current.current;
    if (!snapshot || JSON.stringify(snapshot) === saved.current) return true;
    const result = await operation.run(async ({ beginSave }) => {
      const payload = toDraft(snapshot);
      await writer.flush();
      beginSave();
      await writer.save(payload);
      markSaved(snapshot);
    });
    return result.ok;
  };
  const enterManual = () => {
    if (operation.busy || agreement) return;
    setForm({ budget: '', draft: { projectId, sourceText: source.current, origin: 'manual', deliverables: [{ key: newId(), text: '' }], exclusions: [], terms: { budgetAmount: null, currency: 'PHP', timeline: null, revisionTerms: null }, missingInformation: [], updatedAt: new Date().toISOString() } });
  };
  const extract = async () => {
    const text = current.current?.draft.sourceText || source.current;
    await operation.run(async ({ signal, beginSave }) => {
      await writer.flush(); checkCancelled(signal);
      const draft = await workflows.extractDraft(projectId, text, signal);
      checkCancelled(signal);
      const next = { draft, budget: draft.terms.budgetAmount === null ? '' : String(draft.terms.budgetAmount) };
      beginSave(); setForm(next);
      await writer.save(draft); markSaved(next);
    });
  };
  const confirm = async () => {
    const snapshot = current.current;
    if (!snapshot) return;
    await operation.run(async ({ beginSave }) => {
      const draft = toDraft(snapshot);
      await writer.flush(); beginSave();
      const confirmed = await workflows.confirmDraft(projectId, draft);
      setAgreement(confirmed); setForm(null); markSaved(null);
      source.current = ''; setSourceState('');
      setProject(p => p ? { ...p, scopeStatus: 'confirmed', agreementVersion: 1 } : p);
    });
  };
  const prepareExit = async () => {
    operation.cancel(); await operation.settle(); await writer.flush();
    if (current.current) return saveDraft();
    return !source.current.trim() || Boolean(agreement);
  };
  const discard = async () => { operation.cancel(); await operation.settle(); await writer.flush(); };
  return { project, agreement, analyses, proposals, draft: form?.draft ?? null, budgetText: form?.budget ?? '', budgetError, sourceText, setSourceText, setBudget, updateDraft, enterManual, extract, confirm, saveDraft, operation, dirty: JSON.stringify(form) !== savedKey, loading, error, reload: () => load(() => true), prepareExit, discard };
}
