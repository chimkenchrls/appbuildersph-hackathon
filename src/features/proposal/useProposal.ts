import { useEffect, useRef, useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { data, workflows } from '@/services/active';
import { useOperation } from '@/hooks/useOperation';
import { checkCancelled, ServiceError } from '@/services/errors';
import { parseEstimate, parseWorkingDays } from '@/safety/parseEstimate';
import type { DraftItem, Proposal } from '@/types/workspace';
import { newId } from '@/utils/ids';

export interface ProposalForm { deliverables: DraftItem[]; fee: string; days: string; message: string }
export function useProposal(projectId: string, proposalId: string) {
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [form, setForm] = useState<ProposalForm | null>(null);
  const current = useRef<ProposalForm | null>(null);
  const saved = useRef('null');
  const [savedKey, setSavedKey] = useState('null');
  const [manuallyEdited, setManuallyEdited] = useState(false);
  const [copyState, setCopyState] = useState('');
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Loading is derived: a load has settled only when its key matches the current one.
  const loadKey = `${projectId}/${proposalId}/${reloadKey}`;
  const [settled, setSettled] = useState<{ key: string; error: unknown } | null>(null);
  const loading = settled?.key !== loadKey;
  const error = settled?.key === loadKey ? settled.error : null;
  const operation = useOperation();
  const assign = (value: ProposalForm) => { current.current = value; setForm(value); };
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const value = await data.getProposal(projectId, proposalId);
        if (!value || value.projectId !== projectId) throw new ServiceError('not_found');
        const analysis = await data.getAnalysis(projectId, value.analysisId);
        const agreement = await data.getAgreement(projectId);
        if (!analysis || !agreement || analysis.projectId !== projectId || analysis.agreementId !== agreement.id || analysis.agreementVersion !== agreement.version) throw new ServiceError('not_found');
        if (!active) return;
        setProposal(value);
        const next = { deliverables: value.deliverables.map(text => ({ key: newId(), text })), fee: value.feeAmount === null ? '' : String(value.feeAmount), days: value.extraWorkingDays === null ? '' : String(value.extraWorkingDays), message: value.message };
        assign(next); saved.current = JSON.stringify(next); setSavedKey(saved.current);
        setManuallyEdited(Boolean(value.message));
        setSettled({ key: loadKey, error: null });
      } catch (e) { if (active) setSettled({ key: loadKey, error: e }); }
    })();
    return () => { active = false; if (copyTimer.current) clearTimeout(copyTimer.current); };
  }, [projectId, proposalId, loadKey]);
  const update = (change: Partial<ProposalForm>) => {
    if (!current.current || operation.busy) return;
    assign({ ...current.current, ...change }); setCopyState('');
    if (change.message !== undefined) setManuallyEdited(true);
  };
  const errors: { fee?: string; days?: string; deliverables?: string } = {};
  try { parseEstimate(form?.fee ?? ''); } catch { errors.fee = 'Enter a non-negative amount, up to two decimal places.'; }
  try { parseWorkingDays(form?.days ?? ''); } catch { errors.days = 'Enter a whole number of non-negative working days.'; }
  if (form && !form.deliverables.some(item => item.text.trim())) errors.deliverables = 'Add at least one additional deliverable.';
  const snapshot = (): Proposal => {
    if (!proposal || !current.current) throw new ServiceError('not_found');
    const f = current.current;
    const deliverables = f.deliverables.map(item => item.text.trim()).filter(Boolean);
    if (!deliverables.length) throw new ServiceError('invalid_input');
    return { ...proposal, deliverables, feeAmount: parseEstimate(f.fee), extraWorkingDays: parseWorkingDays(f.days), message: f.message };
  };
  const save = async () => {
    const formSnapshot = current.current;
    const result = await operation.run(async ({ beginSave }) => {
      const value = snapshot(); beginSave();
      const stored = await data.saveProposal(value);
      setProposal(stored); saved.current = JSON.stringify(formSnapshot); setSavedKey(saved.current);
    });
    return result.ok;
  };
  const generate = async () => {
    await operation.run(async ({ signal }) => {
      const captured = snapshot();
      const message = await workflows.generateMessage(captured, signal);
      checkCancelled(signal);
      if (current.current) assign({ ...current.current, message });
      setManuallyEdited(false); setCopyState('');
    });
  };
  const copy = async () => {
    try {
      if (!current.current?.message.trim()) return;
      if (!(await Clipboard.setStringAsync(current.current.message))) throw new Error();
      setCopyState('Copied. Not sent.');
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopyState(''), 4000);
    } catch { setCopyState('Could not copy. Please try again.'); }
  };
  const prepareExit = async () => { operation.cancel(); await operation.settle(); return JSON.stringify(current.current) === saved.current; };
  const discard = async () => { operation.cancel(); await operation.settle(); };
  return { proposal, form, update, manuallyEdited, errors, dirty: JSON.stringify(form) !== savedKey, loading, error, operation, save, generate, copy, copyState, prepareExit, discard, reload: () => setReloadKey(key => key + 1) };
}
