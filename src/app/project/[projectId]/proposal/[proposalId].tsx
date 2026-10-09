import { useLocalSearchParams } from 'expo-router';
import MissingRecordScreen from '@/screens/MissingRecordScreen';
import ProposalScreen from '@/screens/ProposalScreen';
import { routeId } from '@/utils/ids';

export default function ProposalRoute() {
  const params = useLocalSearchParams();
  const projectId = routeId(params.projectId);
  const proposalId = routeId(params.proposalId);
  if (!projectId || !proposalId) return <MissingRecordScreen />;
  return <ProposalScreen key={`${projectId}/${proposalId}`} projectId={projectId} proposalId={proposalId} />;
}
