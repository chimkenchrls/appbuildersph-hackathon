import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors } from '@/constants/theme';
import { BottomNavBar } from '@/components/BottomNavBar';
import { useMobileWorkspace } from '@/hooks/useMobileWorkspace';
import { ServiceError } from '@/services/errors';
import { ProjectsScreen } from './ProjectsScreen';
import { AgreementsScreen } from './AgreementsScreen';
import { NewProjectScreen } from './NewProjectScreen';
import { ScopeDraftScreen } from './ScopeDraftScreen';
import { ProjectOverviewScreen } from './ProjectOverviewScreen';
import { NewRequestScreen } from './NewRequestScreen';
import { ScopeReviewScreen } from './ScopeReviewScreen';
import { ProposalEditorScreen } from './ProposalEditorScreen';
import { SettingsScreen } from './SettingsScreen';

export function HomeScreen() {
  const { view, tab, services, projects, agreements, draft, source, analysis, proposal, loading, error,
    setRevision, project, history, agreement, navigate, back, run, confirm, createDraft, analyzeRequest, saveProposal, startProposal, saveDraft } = useMobileWorkspace();
  let content;
  if (loading) content = <ActivityIndicator accessibilityLabel="Loading workspace" color={colors.primary} />;
  else if (!services) content = <Pressable onPress={() => setRevision(value => value + 1)}><Text>Retry loading workspace</Text></Pressable>;
  else if (view === 'new_project') content = <NewProjectScreen onBack={back} onCreateScopeDraft={input => createDraft(input)} onCreateManualDraft={input => createDraft(input, true)} />;
  else if (view === 'draft' && project && draft) content = <ScopeDraftScreen key={project.id} project={project} draft={draft} sourceConversation={source} onBack={back} onConfirmScope={confirm} onSaveDraft={saveDraft} />;
  else if (view === 'overview' && project) content = <ProjectOverviewScreen currentProject={draft ? { ...project, draftScopeJson: JSON.stringify(draft) } : project} allProjects={projects} agreements={history} selectedAgreement={agreement}
    onBack={back} onSelectProject={id => navigate('overview', id)}
    onSelectAgreementVersion={value => navigate('overview', project.id, { agreementId: value.id })}
    onNavigateToNewRequest={() => navigate('new_request', project.id, agreement ? { agreementId: agreement.id } : {})}
    onEditScopeDraft={() => navigate('draft', project.id)} onReleaseScope={() => void run(async () => { if (!draft) throw new ServiceError('not_found'); await confirm(draft); })} />;
  else if (view === 'new_request' && project && agreement) content = <NewRequestScreen project={project} agreement={agreement} onBack={back} onViewConfirmedScope={back}
    onAnalyze={analyzeRequest} />;
  else if (view === 'review' && project && analysis && agreement) content = <ScopeReviewScreen project={project} agreement={agreement} analysis={analysis} onBack={back}
    onProceedToProposal={() => void run(startProposal)} />;
  else if (view === 'proposal' && project && proposal) content = <ProposalEditorScreen key={proposal.id} project={project} agreement={agreement} proposal={proposal} onBack={back}
    availableItems={analysis?.findings.filter(finding => finding.classification === 'potential_additional').map(finding => finding.item)}
    onSaveProposal={saveProposal} />;
  else if (view) content = <Text>This record is unavailable. Go back to your projects.</Text>;
  else content = <>
    <View style={styles.content}>
      {tab === 'projects' && <ProjectsScreen projects={projects} projectAgreements={agreements}
        onSelectProject={id => navigate('overview', id)} onViewProjectOverview={id => navigate('overview', id)}
        onNewProject={() => navigate('new_project')} onReleaseProject={id => navigate('draft', id)} />}
      {tab === 'agreements' && <AgreementsScreen projects={projects} projectAgreements={agreements}
        onSelectProjectAgreement={(id, selected) => navigate('overview', id, { agreementId: selected.id })} onNewProject={() => navigate('new_project')} />}
      {tab === 'settings' && <SettingsScreen services={services} onDataReset={async () => { throw new Error('Saved agreements are protected. Reset is unavailable; your records have been kept.'); }} />}
    </View>
    <BottomNavBar activeTab={tab} onSelectTab={selected => router.replace({ pathname: '/', params: { tab: selected } })} />
  </>;
  return <SafeAreaView style={styles.screen}>
    {error && <View accessibilityRole="alert" style={styles.error}><Text style={styles.errorText}>{error}</Text><Pressable onPress={back}><Text>Back to workspace</Text></Pressable></View>}
    {content}
  </SafeAreaView>;
}
const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: colors.background }, content: { flex: 1 },
  error: { padding: 16, backgroundColor: colors.errorSurface }, errorText: { color: colors.errorText } });
