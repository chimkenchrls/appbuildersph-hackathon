import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { initializeBackendAsync } from '@/services/bootstrapService';
import type { Project, Agreement } from '@/types/domain';

export function HomeScreen() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [latestAgreement, setLatestAgreement] = useState<Agreement | null>(null);
  const [lmStudioAvailable, setLmStudioAvailable] = useState<boolean | null>(null);

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

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={styles.title}>
            Saklaw
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
            <Text style={styles.errorTitle}>Backend Initialization Notice</Text>
            <Text style={styles.cardText}>{error}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardHeader}>Backend Diagnostics & Status</Text>

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>SQLite Database:</Text>
              <Text style={styles.statusValueSuccess}>Connected (WAL Mode)</Text>
            </View>

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>Projects Loaded:</Text>
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
                <Text style={styles.statusLabel}>Kasunduan Vault:</Text>
                <Text style={styles.statusValue}>
                  {latestAgreement.title} ({latestAgreement.requirements.length} requirements, {latestAgreement.budgetCurrency} {latestAgreement.budgetAmount?.toLocaleString()})
                </Text>
              </View>
            )}

            <View style={styles.statusRow}>
              <Text style={styles.statusLabel}>LM Studio Status:</Text>
              <Text style={lmStudioAvailable ? styles.statusValueSuccess : styles.statusValueWarning}>
                {lmStudioAvailable ? 'Server Reachable' : 'Standby (Start LM Studio server on port 1234)'}
              </Text>
            </View>
          </View>
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
});
