import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initializeBackendAsync } from '@/services/bootstrapService';
import { ContractGeneratorService } from '@/services/contractGeneratorService';
import { ShareService } from '@/services/shareService';
import type { Project, Agreement } from '@/types/domain';

export function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [latestAgreement, setLatestAgreement] = useState<Agreement | null>(null);
  const [lmStudioAvailable, setLmStudioAvailable] = useState<boolean | null>(null);
  const [contractPreview, setContractPreview] = useState<string | null>(null);
  const [showFullContract, setShowFullContract] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const { repositories, services, llmEngine } = await initializeBackendAsync();
        const loadedProjects = await repositories.project.list();

        let agmt: Agreement | null = null;
        if (loadedProjects.length > 0) {
          agmt = await services.kasunduanVault.getLatestAgreement(loadedProjects[0].id);
        }

        const isAvailable = await llmEngine.isAvailable();

        if (mounted) {
          setProjects(loadedProjects);
          setLatestAgreement(agmt);
          setLmStudioAvailable(isAvailable);

          if (agmt) {
            const preview = ContractGeneratorService.generateContractText(agmt, {
              freelancerName: 'Independent Developer',
              clientName: loadedProjects[0]?.clientName || 'Client',
              paymentMethod: 'Bank Transfer / GCash / Maya',
            });
            setContractPreview(preview);
          }

          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setError((err as Error).message);
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  const handleShareContract = async () => {
    if (!latestAgreement) return;
    try {
      const shared = await ShareService.shareContract(latestAgreement, {
        freelancerName: 'Independent Developer',
        clientName: projects[0]?.clientName || 'Client',
        paymentMethod: 'Bank Transfer / GCash / Maya',
      });
      setShareFeedback(shared ? 'Contract shared successfully.' : 'Share dialog dismissed.');
    } catch {
      setShareFeedback('Unable to launch share dialog.');
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            OwlSet
          </Text>
          <Text style={styles.tagline}>
            Clear agreements. Controlled revisions. Confident freelancing.
          </Text>
        </View>

        {loading ? (
          <View style={styles.card}>
            <ActivityIndicator size="small" color="#2b6cb0" />
            <Text style={styles.cardText}>Initializing SQLite database and backend services...</Text>
          </View>
        ) : error ? (
          <View style={[styles.card, styles.errorCard]}>
            <Text style={styles.errorTitle}>Backend initialization notice</Text>
            <Text style={styles.cardText}>{error}</Text>
          </View>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Backend diagnostics and status</Text>

              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>SQLite database:</Text>
                <Text style={styles.statusValueSuccess}>Connected (WAL Mode)</Text>
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>Projects loaded:</Text>
                <Text style={styles.statusValue}>{projects.length} project(s)</Text>
              </View>

              {projects.length > 0 && (
                <View style={styles.projectInfo}>
                  <Text style={styles.projectTitle}>{projects[0].title}</Text>
                  <Text style={styles.clientLabel}>Client: {projects[0].clientName || 'N/A'}</Text>
                </View>
              )}

              {latestAgreement && (
                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Kasunduan vault:</Text>
                  <Text style={styles.statusValue}>
                    {latestAgreement.title} ({latestAgreement.requirements.length} requirements, {latestAgreement.budgetCurrency} {latestAgreement.budgetAmount?.toLocaleString()})
                  </Text>
                </View>
              )}

              <View style={styles.statusRow}>
                <Text style={styles.statusLabel}>LM Studio status:</Text>
                <Text style={lmStudioAvailable ? styles.statusValueSuccess : styles.statusValueWarning}>
                  {lmStudioAvailable ? 'Server reachable' : 'Standby (Start LM Studio server on port 1234)'}
                </Text>
              </View>
            </View>

            {latestAgreement && contractPreview && (
              <View style={styles.card}>
                <Text style={styles.cardHeader}>Auto-generated legal contract</Text>
                <Text style={styles.subText}>
                  Compliant with Philippine commercial law, Ease of Paying Taxes (RA 11976), BIR Form 2307 withholding rules, RA 8293 (IP Code), and RA 10173 (Data Privacy).
                </Text>

                <View style={styles.badgeContainer}>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>EOPT RA 11976</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>BIR Form 2307</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>RA 8293 IP Code</Text>
                  </View>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>RA 10173 Privacy</Text>
                  </View>
                </View>

                <View style={styles.buttonRow}>
                  <Pressable
                    style={styles.primaryButton}
                    onPress={handleShareContract}
                    accessibilityRole="button"
                    accessibilityLabel="Share contract via native share sheet"
                  >
                    <Text style={styles.primaryButtonText}>Share contract (Native sheet)</Text>
                  </Pressable>

                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() => setShowFullContract(!showFullContract)}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle contract text preview"
                  >
                    <Text style={styles.secondaryButtonText}>
                      {showFullContract ? 'Hide full text' : 'View full text'}
                    </Text>
                  </Pressable>
                </View>

                {shareFeedback && (
                  <Text style={styles.feedbackText}>{shareFeedback}</Text>
                )}

                <View style={styles.previewBox}>
                  <Text
                    style={styles.previewText}
                    numberOfLines={showFullContract ? undefined : 14}
                  >
                    {contractPreview}
                  </Text>
                </View>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f5f6fa',
  },
  scrollContent: {
    padding: 24,
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  header: {
    marginBottom: 8,
    gap: 6,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#182135',
  },
  tagline: {
    fontSize: 16,
    color: '#49556b',
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 14,
  },
  errorCard: {
    borderColor: '#feb2b2',
    backgroundColor: '#fff5f5',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#c53030',
  },
  cardHeader: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: 4,
  },
  subText: {
    fontSize: 14,
    color: '#4a5568',
    lineHeight: 20,
  },
  cardText: {
    fontSize: 15,
    color: '#4a5568',
  },
  statusRow: {
    flexDirection: 'column',
    gap: 4,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#edf2f7',
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#718096',
    textTransform: 'uppercase',
  },
  statusValue: {
    fontSize: 15,
    color: '#2d3748',
  },
  statusValueSuccess: {
    fontSize: 15,
    color: '#2f855a',
    fontWeight: '600',
  },
  statusValueWarning: {
    fontSize: 15,
    color: '#d69e2e',
    fontWeight: '500',
  },
  projectInfo: {
    backgroundColor: '#f7fafc',
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  projectTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2b6cb0',
  },
  clientLabel: {
    fontSize: 13,
    color: '#718096',
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    backgroundColor: '#ebf8ff',
    borderColor: '#bee3f8',
    borderWidth: 1,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2b6cb0',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#2b6cb0',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButton: {
    backgroundColor: '#edf2f7',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#2d3748',
    fontSize: 14,
    fontWeight: '600',
  },
  feedbackText: {
    fontSize: 13,
    color: '#2f855a',
    fontStyle: 'italic',
  },
  previewBox: {
    backgroundColor: '#1a202c',
    padding: 14,
    borderRadius: 8,
  },
  previewText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#e2e8f0',
    lineHeight: 18,
  },
});
