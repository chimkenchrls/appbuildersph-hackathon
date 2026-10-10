import { useLocalSearchParams } from 'expo-router';
import MissingRecordScreen from '@/screens/routed/MissingRecordScreen';
import ScopeGuardScreen from '@/screens/routed/ScopeGuardScreen';
import { routeId } from '@/utils/ids';

export default function RequestRoute() {
  const params = useLocalSearchParams();
  const projectId = routeId(params.projectId);
  // analysisId is optional, but when present it must be a valid identifier.
  const analysisId = params.analysisId === undefined ? undefined : routeId(params.analysisId);
  if (!projectId || analysisId === null) return <MissingRecordScreen />;
  return <ScopeGuardScreen key={`${projectId}/${analysisId ?? 'new'}`} projectId={projectId} analysisId={analysisId} />;
}
