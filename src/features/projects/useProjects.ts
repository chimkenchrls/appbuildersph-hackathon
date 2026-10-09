import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { data } from '@/services/active';
import { useOperation } from '@/hooks/useOperation';
import type { Project } from '@/types/workspace';

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const operation = useOperation();
  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try { setProjects(await data.listProjects()); } catch (e) { setError(e); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void reload(); }, [reload]));
  const create = async (name: string) => {
    const result = await operation.run(async ({ beginSave }) => { beginSave(); return data.createProject(name); });
    return result.ok ? result.value : null;
  };
  return { projects, loading, error, reload, create, operation };
}
