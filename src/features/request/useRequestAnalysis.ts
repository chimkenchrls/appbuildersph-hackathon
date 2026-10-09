import { useEffect, useRef, useState } from 'react';
import { data, workflows } from '@/services/active';
import { checkCancelled, ServiceError } from '@/services/errors';
import { useOperation } from '@/hooks/useOperation';
import { validateFindings } from '@/safety/validateFindings';
import type { Agreement, Analysis, NewAnalysis } from '@/types/workspace';

export function useRequestAnalysis(projectId: string, analysisId?: string) {
  const [agreement, setAgreement] = useState<Agreement | null>(null);
  const [requestText, setRequest] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [candidate, setCandidate] = useState<NewAnalysis | null>(null);
  const [selectedIds, setSelected] = useState<string[]>([]);
  const currentRequest = useRef('');
  const savedRequest = useRef('');
  // Mirrors savedRequest for rendering; the ref serves callbacks that outlive a render.
  const [savedText, setSavedText] = useState('');
  const markSaved = (text: string) => { savedRequest.current = text; setSavedText(text); };
  const [reloadKey, setReloadKey] = useState(0);
  // Loading is derived: a load has settled only when its key matches the current one.
  const loadKey = `${projectId}/${analysisId ?? ''}/${reloadKey}`;
  const [settled, setSettled] = useState<{ key: string; error: unknown } | null>(null);
  const loading = settled?.key !== loadKey;
  const error = settled?.key === loadKey ? settled.error : null;
  const operation = useOperation();
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        if (!(await data.getProject(projectId))) throw new ServiceError('not_found');
        const a = await data.getAgreement(projectId);
        if (a && a.projectId !== projectId) throw new ServiceError('not_found');
        const result = analysisId ? await data.getAnalysis(projectId, analysisId) : null;
        if (analysisId && (!result || !a || result.projectId !== projectId || result.agreementId !== a.id || result.agreementVersion !== a.version)) throw new ServiceError('not_found');
        if (result && a) validateFindings(result.findings, a);
        if (!active) return;
        setAgreement(a); setAnalysis(result);
        if (result) { currentRequest.current = result.requestText; savedRequest.current = result.requestText; setSavedText(result.requestText); setRequest(result.requestText); }
        setSettled({ key: loadKey, error: null });
      } catch (e) { if (active) setSettled({ key: loadKey, error: e }); }
    })();
    return () => { active = false; };
  }, [projectId, analysisId, loadKey]);
  const changeRequest = (value: string) => {
    if (operation.busy || analysisId) return;
    currentRequest.current = value; setRequest(value); setAnalysis(null); setCandidate(null); setSelected([]);
  };
  const analyze = async () => {
    const captured = currentRequest.current;
    setAnalysis(null); setCandidate(null); setSelected([]);
    await operation.run(async ({ signal, beginSave }) => {
      const result = await workflows.analyzeRequest(projectId, captured, signal);
      checkCancelled(signal); beginSave(); setCandidate(result);
      const stored = await data.saveAnalysis(result);
      setAnalysis(stored); setCandidate(null); markSaved(captured);
    });
  };
  const retrySave = async () => {
    if (!candidate) return;
    const captured = candidate;
    await operation.run(async ({ beginSave }) => {
      beginSave(); const stored = await data.saveAnalysis(captured);
      setAnalysis(stored); setCandidate(null); markSaved(captured.requestText);
    });
  };
  const toggle = (id: string) => {
    if (operation.busy || !analysis?.findings.some(f => f.id === id && f.classification === 'potential_additional')) return;
    setSelected(ids => ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
  };
  const startProposal = async () => {
    if (!analysis) return null;
    const result = await operation.run(async ({ beginSave }) => { beginSave(); return workflows.startProposal(projectId, analysis.id, selectedIds); });
    return result.ok ? result.value : null;
  };
  const prepareExit = async () => { operation.cancel(); await operation.settle(); return !currentRequest.current.trim() || currentRequest.current === savedRequest.current; };
  return { agreement, requestText, changeRequest, analysis, candidate, selectedIds, toggle, loading, error, operation, analyze, retrySave, startProposal, prepareExit, dirty: Boolean(requestText.trim()) && requestText !== savedText, reload: () => setReloadKey(key => key + 1) };
}
