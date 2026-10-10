import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { HeaderBar } from '@/components/HeaderBar';
import { colors, radii, spacing, shadows } from '@/constants/theme';
import { AppIcon } from '@/components/Icon';
import { hapticSuccess } from '@/utils/haptics';
import type { AppServices } from '@/services/bootstrapService';
import { USER_CONFIGURED_KEY } from '@/database/settingKeys';
import type { NativeModelInfo, OnDeviceInferenceResult } from '@/llm/adapters/nativeLlamaAdapter';
import type { LlmEngineMode } from '@/llm/adapters/hybridLlmAdapter';

interface SettingsScreenProps {
  services: AppServices | null;
  onDataReset: () => Promise<void>;
  onProfileUpdated?: (name: string, role: string) => void;
}

export function SettingsScreen({ services, onDataReset, onProfileUpdated }: SettingsScreenProps) {
  const [resetting, setResetting] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  // Freelancer Profile State
  const [freelancerName, setFreelancerName] = useState('');
  const [freelancerRole, setFreelancerRole] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileFeedback, setProfileFeedback] = useState<string | null>(null);

  // Local LLM State
  const [llmMode, setLlmMode] = useState<LlmEngineMode>('auto');
  const [nativeModelInfo, setNativeModelInfo] = useState<NativeModelInfo | null>(null);
  const [importingModel, setImportingModel] = useState(false);
  const [testingOnDevice, setTestingOnDevice] = useState(false);
  const [freeingMemory, setFreeingMemory] = useState(false);
  const [onDeviceResult, setOnDeviceResult] = useState<OnDeviceInferenceResult | null>(null);
  const [onDeviceError, setOnDeviceError] = useState<string | null>(null);

  const [llmUrl, setLlmUrl] = useState('');
  const [llmModel, setLlmModel] = useState('');
  const [testingLlm, setTestingLlm] = useState(false);
  const [savingLlm, setSavingLlm] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    models?: string[];
  } | null>(null);

  React.useEffect(() => {
    async function loadSettings() {
      if (!services) return;
      try {
        const name = await services.repositories.settings.get('freelancer_name');
        const role = await services.repositories.settings.get('freelancer_role');
        if (name) setFreelancerName(name);
        if (role) setFreelancerRole(role);

        const mode = (await services.repositories.settings.get('llm_mode')) as LlmEngineMode | null;
        if (mode && (mode === 'on_device' || mode === 'auto' || mode === 'network')) {
          setLlmMode(mode);
        }

        const info = await services.llmEngine.nativeAdapter.getModelInfo();
        setNativeModelInfo(info);

        const url = await services.repositories.settings.get('lm_studio_url');
        const model = await services.repositories.settings.get('lm_studio_model');
        const effectiveUrl = await services.llmEngine.getEffectiveUrl();
        setLlmUrl(url || effectiveUrl);
        setLlmModel(model || 'local-model');
      } catch {
        // ignore
      }
    }
    loadSettings();
  }, [services]);

  const handleSelectMode = async (mode: LlmEngineMode) => {
    if (!services) return;
    try {
      await services.repositories.settings.set('llm_mode', mode);
      await services.llmEngine.setMode(mode);
      setLlmMode(mode);
      setTestResult(null);
      setOnDeviceResult(null);
      setOnDeviceError(null);
      await hapticSuccess();
    } catch (err) {
      setFeedbackMessage('Failed to change engine mode: ' + (err as Error).message);
    }
  };

  const handleImportModel = async () => {
    if (!services) return;
    setImportingModel(true);
    setOnDeviceError(null);
    setOnDeviceResult(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const imported = await services.llmEngine.nativeAdapter.importModel(asset.uri, asset.name);
        await services.repositories.settings.set('on_device_model_path', imported.path);
        await services.repositories.settings.set('llm_mode', 'on_device');
        await services.llmEngine.setMode('on_device');
        setLlmMode('on_device');

        const info = await services.llmEngine.nativeAdapter.getModelInfo();
        setNativeModelInfo(info);
        setFeedbackMessage(`Model "${asset.name}" imported (${info.fileSizeFormatted ?? 'GGUF'}) and activated.`);
        await hapticSuccess();
      }
    } catch (err) {
      setOnDeviceError('Failed to import model: ' + (err as Error).message);
    } finally {
      setImportingModel(false);
    }
  };

  const handleTestOnDevice = async () => {
    if (!services) return;
    setTestingOnDevice(true);
    setOnDeviceResult(null);
    setOnDeviceError(null);
    try {
      const result = await services.llmEngine.nativeAdapter.testInference();
      setOnDeviceResult(result);
      const info = await services.llmEngine.nativeAdapter.getModelInfo();
      setNativeModelInfo(info);
      await hapticSuccess();
    } catch (err) {
      setOnDeviceError('On-device test failed: ' + (err as Error).message);
    } finally {
      setTestingOnDevice(false);
    }
  };

  const handleUnloadModel = async () => {
    if (!services) return;
    setFreeingMemory(true);
    try {
      await services.llmEngine.nativeAdapter.release();
      const info = await services.llmEngine.nativeAdapter.getModelInfo();
      setNativeModelInfo(info);
      setFeedbackMessage('On-device model unloaded from memory.');
      await hapticSuccess();
    } catch (err) {
      setFeedbackMessage('Failed to release model: ' + (err as Error).message);
    } finally {
      setFreeingMemory(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!services) return;
    const trimmed = freelancerName.trim();
    if (!trimmed) {
      setProfileFeedback('Name cannot be empty.');
      return;
    }
    setSavingProfile(true);
    setProfileFeedback(null);
    try {
      await services.repositories.settings.set('freelancer_name', trimmed);
      await services.repositories.settings.set('freelancer_role', freelancerRole.trim());
      onProfileUpdated?.(trimmed, freelancerRole.trim());
      setProfileFeedback('Freelancer profile updated for contracts and PDF exports.');
      await hapticSuccess();
    } catch (err) {
      setProfileFeedback('Failed to update profile: ' + (err as Error).message);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleTestConnection = async () => {
    if (!services) return;
    setTestingLlm(true);
    setTestResult(null);
    try {
      if (llmUrl.trim()) {
        await services.repositories.settings.set('lm_studio_url', llmUrl.trim());
        await services.repositories.settings.set(USER_CONFIGURED_KEY, '1');
      }
      if (llmModel.trim()) {
        await services.repositories.settings.set('lm_studio_model', llmModel.trim());
        await services.repositories.settings.set(USER_CONFIGURED_KEY, '1');
      }
      const status = await services.llmEngine.checkConnection();
      if (status.available) {
        setTestResult({
          ok: true,
          message: status.models.length > 0
            ? `Connected! Loaded models: ${status.models.slice(0, 3).join(', ')}${status.models.length > 3 ? ` (+${status.models.length - 3} more)` : ''}`
            : 'Connected successfully to Local AI server.',
          models: status.models,
        });
      } else {
        setTestResult({
          ok: false,
          message: status.error || `Server unreachable at ${status.url}. Make sure LM Studio / Ollama is running with CORS enabled.`,
        });
      }
    } catch (err) {
      setTestResult({
        ok: false,
        message: (err as Error).message || 'Failed to connect to local server.',
      });
    } finally {
      setTestingLlm(false);
    }
  };

  const handleSaveLlm = async () => {
    if (!services) return;
    setSavingLlm(true);
    try {
      await services.repositories.settings.set('lm_studio_url', llmUrl.trim());
      await services.repositories.settings.set('lm_studio_model', llmModel.trim());
      await services.repositories.settings.set(USER_CONFIGURED_KEY, '1');
      setFeedbackMessage('Local LLM configuration saved.');
    } catch (err) {
      setFeedbackMessage('Failed to save settings: ' + (err as Error).message);
    } finally {
      setSavingLlm(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    setFeedbackMessage(null);
    try {
      await onDataReset();
      setFeedbackMessage('Workspace data reset successfully.');
    } catch (err) {
      setFeedbackMessage((err as Error).message || 'Failed to reset database.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <View style={styles.container}>
      <HeaderBar
        title="OwlSet"
        subtitle="Your Private Workspace"
        showBack={false}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerSection}>
          <Text style={styles.eyebrow}>SYSTEM & VAULT</Text>
          <Text style={styles.headline}>Workspace Settings</Text>
          <Text style={styles.subhead}>
            Local workspace storage and development inference status.
          </Text>
        </View>

        {/* Card 0: Freelancer Profile */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Freelancer Identity</Text>
            <View style={styles.badgeSuccess}>
              <Text style={styles.badgeSuccessText}>Active</Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>
            Your legal name and professional title stamped on generated Kasunduan contracts and PDF exports.
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Full Legal Name</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={freelancerName}
                onChangeText={setFreelancerName}
                placeholder="e.g. Maria Santos or Juan Dela Cruz"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Professional Role or Title</Text>
            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                value={freelancerRole}
                onChangeText={setFreelancerRole}
                placeholder="e.g. Full-Stack Developer or UI/UX Designer"
                placeholderTextColor={colors.placeholder}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>
          </View>

          {profileFeedback && (
            <View style={styles.testResultSuccess}>
              <AppIcon name="check" size={14} color={colors.successText} />
              <Text style={styles.testResultSuccessText}>{profileFeedback}</Text>
            </View>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.saveLlmButton,
              { marginTop: spacing.sm },
              pressed && styles.saveLlmButtonPressed,
              savingProfile && styles.buttonDisabled,
            ]}
            onPress={handleSaveProfile}
            disabled={savingProfile}
            accessibilityRole="button"
            accessibilityLabel="Save Freelancer Profile"
          >
            {savingProfile ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Text style={styles.saveLlmButtonText}>Update Profile</Text>
            )}
          </Pressable>
        </View>

        {/* Card 1: AI Inference Engine Configuration */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>AI Inference Engine</Text>
            <View style={llmMode === 'on_device' ? styles.badgeOnDevice : testResult?.ok ? styles.badgeSuccess : styles.badgeNeutral}>
              <Text style={llmMode === 'on_device' ? styles.badgeOnDeviceText : testResult?.ok ? styles.badgeSuccessText : styles.badgeNeutralText}>
                {llmMode === 'on_device' ? 'On-Device (Offline)' : llmMode === 'auto' ? 'Auto Engine' : 'Network Server'}
              </Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>
            Run on-device inference directly on this device using local llama.rn weights, or connect to an LM Studio / Ollama server.
          </Text>

          {/* Mode Selector Row */}
          <View style={styles.modeSelectorRow}>
            <Pressable
              style={[styles.modeTab, llmMode === 'on_device' && styles.modeTabActive]}
              onPress={() => handleSelectMode('on_device')}
            >
              <AppIcon name="cpu" size={14} color={llmMode === 'on_device' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.modeTabText, llmMode === 'on_device' && styles.modeTabTextActive]}>On-Device</Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, llmMode === 'auto' && styles.modeTabActive]}
              onPress={() => handleSelectMode('auto')}
            >
              <AppIcon name="zap" size={14} color={llmMode === 'auto' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.modeTabText, llmMode === 'auto' && styles.modeTabTextActive]}>Auto</Text>
            </Pressable>
            <Pressable
              style={[styles.modeTab, llmMode === 'network' && styles.modeTabActive]}
              onPress={() => handleSelectMode('network')}
            >
              <AppIcon name="wifi" size={14} color={llmMode === 'network' ? colors.primary : colors.textSecondary} />
              <Text style={[styles.modeTabText, llmMode === 'network' && styles.modeTabTextActive]}>Network</Text>
            </Pressable>
          </View>

          {/* On-Device Section */}
          {(llmMode === 'on_device' || llmMode === 'auto') && (
            <View style={styles.sectionContainer}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>On-Device Model (llama.rn)</Text>
                <View style={nativeModelInfo?.modelPath ? styles.badgeSuccess : styles.badgeNeutral}>
                  <Text style={nativeModelInfo?.modelPath ? styles.badgeSuccessText : styles.badgeNeutralText}>
                    {nativeModelInfo?.modelPath ? 'Model Ready' : 'No Model'}
                  </Text>
                </View>
              </View>

              <View style={styles.modelStatusBox}>
                <View style={styles.modelStatusRow}>
                  <Text style={styles.modelStatusLabel}>Status:</Text>
                  <Text style={styles.modelStatusValue}>
                    {nativeModelInfo?.modelFilename ? `${nativeModelInfo.modelFilename} (${nativeModelInfo.fileSizeFormatted ?? 'GGUF'})` : 'No .gguf model found'}
                  </Text>
                </View>
                {nativeModelInfo?.modelPath && (
                  <View style={styles.modelStatusRow}>
                    <Text style={styles.modelStatusLabel}>Path:</Text>
                    <Text style={styles.modelStatusPath} numberOfLines={1} ellipsizeMode="middle">
                      {nativeModelInfo.modelPath}
                    </Text>
                  </View>
                )}
                <View style={styles.modelStatusRow}>
                  <Text style={styles.modelStatusLabel}>Memory:</Text>
                  <Text style={styles.modelStatusValue}>
                    {nativeModelInfo?.isLoaded ? 'Loaded in RAM' : 'Standby (loads on demand)'}
                  </Text>
                </View>
              </View>

              {onDeviceError && (
                <View style={styles.testResultError}>
                  <AppIcon name="alert-circle" size={14} color={colors.errorText} />
                  <Text style={styles.testResultErrorText}>{onDeviceError}</Text>
                </View>
              )}

              {onDeviceResult && (
                <View style={styles.testResultSuccess}>
                  <AppIcon name="check" size={14} color={colors.successText} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.testResultSuccessText}>
                      On-Device Test Passed! ({(onDeviceResult.durationMs / 1000).toFixed(1)}s
                      {onDeviceResult.tokensPerSecond ? ` · ${onDeviceResult.tokensPerSecond.toFixed(1)} tok/s` : ''})
                    </Text>
                    <Text style={styles.testResultPreview} numberOfLines={3}>
                      {onDeviceResult.text}
                    </Text>
                  </View>
                </View>
              )}

              <View style={styles.onDeviceActionsRow}>
                <Pressable
                  style={[styles.actionButton, styles.importButton]}
                  onPress={handleImportModel}
                  disabled={importingModel}
                >
                  {importingModel ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <AppIcon name="paperclip" size={14} color={colors.primary} />
                      <Text style={styles.actionButtonText}>Import .gguf Model</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={[
                    styles.actionButton,
                    styles.testOnDeviceButton,
                    (!nativeModelInfo?.modelPath || testingOnDevice) && styles.buttonDisabled,
                  ]}
                  onPress={handleTestOnDevice}
                  disabled={testingOnDevice || !nativeModelInfo?.modelPath}
                >
                  {testingOnDevice ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <>
                      <AppIcon name="play" size={14} color={colors.onPrimary} />
                      <Text style={styles.testOnDeviceButtonText}>Test On-Device</Text>
                    </>
                  )}
                </Pressable>
              </View>

              {nativeModelInfo?.isLoaded && (
                <Pressable
                  style={styles.unloadButton}
                  onPress={handleUnloadModel}
                  disabled={freeingMemory}
                >
                  <Text style={styles.unloadButtonText}>Free Model RAM</Text>
                </Pressable>
              )}
            </View>
          )}

          {/* Network Server Section */}
          {(llmMode === 'network' || llmMode === 'auto') && (
            <View style={[styles.sectionContainer, { marginTop: spacing.md }]}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Network Server (LM Studio / Ollama)</Text>
              </View>

              {/* Endpoint Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Server Base URL</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.textInput}
                    value={llmUrl}
                    onChangeText={setLlmUrl}
                    placeholder="http://10.0.2.2:1234/v1"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Quick Preset Buttons */}
              <View style={styles.presetsRow}>
                <Pressable
                  style={styles.presetPill}
                  onPress={() => setLlmUrl('http://10.0.2.2:1234/v1')}
                >
                  <Text style={styles.presetPillText}>Android Emulator</Text>
                </Pressable>
                <Pressable
                  style={styles.presetPill}
                  onPress={() => setLlmUrl('http://127.0.0.1:1234/v1')}
                >
                  <Text style={styles.presetPillText}>Localhost (1234)</Text>
                </Pressable>
                <Pressable
                  style={styles.presetPill}
                  onPress={() => setLlmUrl('http://127.0.0.1:11434/v1')}
                >
                  <Text style={styles.presetPillText}>Ollama (11434)</Text>
                </Pressable>
              </View>

              {/* Model Name Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Model Identifier</Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.textInput}
                    value={llmModel}
                    onChangeText={setLlmModel}
                    placeholder="local-model or qwen2.5-coder-7b-instruct"
                    placeholderTextColor={colors.placeholder}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>

              {/* Test Result Message */}
              {testResult && (
                <View
                  style={testResult.ok ? styles.testResultSuccess : styles.testResultError}
                >
                  <AppIcon
                    name={testResult.ok ? 'check' : 'alert-circle'}
                    size={14}
                    color={testResult.ok ? colors.successText : colors.errorText}
                  />
                  <Text
                    style={testResult.ok ? styles.testResultSuccessText : styles.testResultErrorText}
                  >
                    {testResult.message}
                  </Text>
                </View>
              )}

              {/* Action Buttons Row */}
              <View style={styles.llmActionsRow}>
                <Pressable
                  style={({ pressed }) => [
                    styles.testButton,
                    pressed && styles.testButtonPressed,
                    testingLlm && styles.buttonDisabled,
                  ]}
                  onPress={handleTestConnection}
                  disabled={testingLlm}
                  accessibilityRole="button"
                  accessibilityLabel="Test Local LLM connection"
                >
                  {testingLlm ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <>
                      <AppIcon name="sparkles" size={14} color={colors.primary} />
                      <Text style={styles.testButtonText}>Test Connection</Text>
                    </>
                  )}
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.saveLlmButton,
                    pressed && styles.saveLlmButtonPressed,
                    savingLlm && styles.buttonDisabled,
                  ]}
                  onPress={handleSaveLlm}
                  disabled={savingLlm}
                  accessibilityRole="button"
                  accessibilityLabel="Save LLM Configuration"
                >
                  {savingLlm ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={styles.saveLlmButtonText}>Save Config</Text>
                  )}
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {/* Card 2: Privacy Architecture */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Offline Architecture</Text>
            <View style={styles.badgeSuccess}>
              <Text style={styles.badgeSuccessText}>Active</Text>
            </View>
          </View>
          <Text style={styles.cardSubtitle}>
            All scopes, contracts, and proposals stay strictly on this device.
          </Text>

          <View style={styles.featureList}>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={16} color={colors.successText} />
              <Text style={styles.featureText}>SQLite on-device database</Text>
            </View>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={16} color={colors.successText} />
              <Text style={styles.featureText}>Zero remote analytics or tracking</Text>
            </View>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={16} color={colors.successText} />
              <Text style={styles.featureText}>User-selected tax treatment</Text>
            </View>
            <View style={styles.featureItem}>
              <AppIcon name="check" size={16} color={colors.successText} />
              <Text style={styles.featureText}>LM Studio HTTP development adapter; on-device inference unverified</Text>
            </View>
          </View>
        </View>

        {/* Card 3: Legal Engine & Tax Compliance */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Philippine Legal Standard</Text>
          <Text style={styles.cardSubtitle}>
            Tax treatment and contract wording require your review; legal compliance is not verified.
          </Text>

          <View style={styles.pillRow}>
            <View style={styles.pill}>
              <Text style={styles.pillText}>RA 11976 (EOPT)</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>BIR Form 2307</Text>
            </View>
            <View style={styles.pill}>
              <Text style={styles.pillText}>RA 8293 IP Code</Text>
            </View>
          </View>
        </View>

        {/* Card 4: Storage & Maintenance */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Data Maintenance</Text>
          <Text style={styles.cardSubtitle}>
            Reset workspace to default clean baseline state.
          </Text>

          {feedbackMessage ? (
            <View style={styles.feedbackBanner}>
              <Text style={styles.feedbackText}>{feedbackMessage}</Text>
            </View>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.resetButton,
              pressed && styles.resetButtonPressed,
              resetting && styles.resetButtonDisabled,
            ]}
            onPress={handleReset}
            disabled={true}
            accessibilityRole="button"
            accessibilityLabel="Reset workspace data"
          >
            {resetting ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Text style={styles.resetButtonText}>Reset Workspace Baseline</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxxl,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
    gap: spacing.lg,
  },
  headerSection: {
    marginBottom: spacing.md,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textPrimary,
    lineHeight: 34,
    letterSpacing: -0.4,
  },
  subhead: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
    gap: spacing.md,
    ...shadows.card,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  cardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  badgeSuccess: {
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  badgeSuccessText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.successText,
  },
  featureList: {
    gap: 8,
    marginTop: 4,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureText: {
    fontSize: 13,
    color: colors.textPrimary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  feedbackBanner: {
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    padding: spacing.md,
    borderRadius: radii.md,
  },
  feedbackText: {
    fontSize: 13,
    color: colors.successText,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.button,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.subtle,
  },
  resetButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  badgeNeutral: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  badgeNeutralText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12.5,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  inputWrapper: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textInput: {
    fontSize: 13,
    color: colors.textPrimary,
    padding: 0,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: -2,
  },
  presetPill: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  presetPillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  testResultSuccess: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.successSurface,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: radii.md,
    padding: 10,
  },
  testResultSuccessText: {
    fontSize: 12,
    color: colors.successText,
    fontWeight: '600',
    flex: 1,
  },
  testResultError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.errorSurface,
    borderWidth: 1,
    borderColor: colors.errorBorder,
    borderRadius: radii.md,
    padding: 10,
  },
  testResultErrorText: {
    fontSize: 12,
    color: colors.errorText,
    fontWeight: '600',
    flex: 1,
  },
  llmActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  testButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: radii.button,
    paddingVertical: 11,
    ...shadows.subtle,
  },
  testButtonPressed: {
    backgroundColor: colors.primaryLight,
  },
  testButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  saveLlmButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.button,
    paddingHorizontal: 20,
    paddingVertical: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveLlmButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  saveLlmButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  badgeOnDevice: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  badgeOnDeviceText: {
    color: '#065F46',
    fontSize: 11,
    fontWeight: '700',
  },
  modeSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeTabActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  modeTabText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modeTabTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  sectionContainer: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radii.md,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  modelStatusBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginBottom: 10,
  },
  modelStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modelStatusLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  modelStatusValue: {
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  modelStatusPath: {
    fontSize: 11,
    color: colors.textMuted,
    maxWidth: '70%',
  },
  onDeviceActionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.button,
  },
  importButton: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  testOnDeviceButton: {
    backgroundColor: colors.primary,
  },
  testOnDeviceButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.onPrimary,
  },
  testResultPreview: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  unloadButton: {
    marginTop: 8,
    alignSelf: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  unloadButtonText: {
    fontSize: 11,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});
