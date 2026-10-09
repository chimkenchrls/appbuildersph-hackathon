import { useLocalSearchParams } from 'expo-router';
import MissingRecordScreen from '@/screens/MissingRecordScreen';
import WorkspaceScreen from '@/screens/WorkspaceScreen';
import { routeId } from '@/utils/ids';

export default function ProjectRoute() {
  const params = useLocalSearchParams();
  const projectId = routeId(params.projectId);
  if (!projectId) return <MissingRecordScreen />;
  return <WorkspaceScreen key={projectId} projectId={projectId} />;
}
