import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  ShieldCheck,
  Wifi,
  WifiOff,
  Server,
  Lock,
  User as UserIcon,
  Store,
  KeyRound,
  Globe,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  QrCode,
  X,
} from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useConnection } from '../context/ConnectionContext';
import { useTheme } from '../context/ThemeContext';
import { StoreSwitcherModal } from '../components/StoreSwitcherModal';
import { DEFAULT_HUB_URL } from '../services/api';

type ConnectionTab = 'CLOUD_TOKEN' | 'LOCAL_WIFI';

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { login, loginWithStore, logout, error: authError, clearError } = useAuth();
  const {
    serverUrl,
    isOnline,
    isPosOnline,
    isChecking,
    latencyMs,
    updateServerUrl,
    checkConnection,
    stores,
    activeStore,
    addStoreByToken,
    removeStore,
  } = useConnection();

  // Active Connection Tab (Cloud Token vs Local Wi-Fi)
  const [activeTab, setActiveTab] = useState<ConnectionTab>('CLOUD_TOKEN');

  // Cloud Token Setup State
  const [storeTokenInput, setStoreTokenInput] = useState('');
  const [hubUrlInput, setHubUrlInput] = useState(DEFAULT_HUB_URL);
  const [showAdvancedHub, setShowAdvancedHub] = useState(false);
  const [isVerifyingToken, setIsVerifyingToken] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Local Wi-Fi Login State
  const [localIpInput, setLocalIpInput] = useState(serverUrl);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoggingInLocal, setIsLoggingInLocal] = useState(false);

  // UI Modals
  const [showStoreSwitcher, setShowStoreSwitcher] = useState(false);

  // QR Scanner State
  const [permission, requestPermission] = useCameraPermissions();
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [scannedRecently, setScannedRecently] = useState(false);

  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(
          'Permission Needed',
          'Camera access is required to scan the Store Pairing QR code from your laptop screen.'
        );
        return;
      }
    }
    setScannedRecently(false);
    setIsQrScannerOpen(true);
  };

  const handleBarcodeScanned = async (data: string) => {
    if (scannedRecently || !data) return;
    setScannedRecently(true);
    setIsQrScannerOpen(false);

    let token = data.trim();
    let hubUrl = hubUrlInput;

    try {
      const parsed = JSON.parse(data);
      if (parsed.store_token) {
        token = parsed.store_token;
      }
      if (parsed.hub_url) {
        hubUrl = parsed.hub_url;
        setHubUrlInput(hubUrl);
      }
    } catch {
      if (token.startsWith('http')) {
        const parts = token.split('/');
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart.length > 5) {
          token = lastPart;
        }
      }
    }

    const cleanToken = token.trim().toUpperCase();
    setStoreTokenInput(cleanToken);
    setTokenError(null);
    clearError();

    setIsVerifyingToken(true);
    const cleanHub = hubUrl.trim().replace(/\/$/, '') || DEFAULT_HUB_URL;
    const result = await addStoreByToken(cleanToken, cleanHub);
    setIsVerifyingToken(false);

    if (result.success && result.store) {
      await loginWithStore(result.store);
      Alert.alert(
        'Store Connected!',
        `Successfully linked "${result.store.name}". Your store is now paired.`
      );
    } else {
      setTokenError(
        result.error ||
          'Could not verify Store Access Token. Please ensure your Cloud Hub is online.'
      );
    }
  };

  const hasConnectedStore = Boolean(activeStore && activeStore.token);

  // 1. Connect Store via Cloud Access Token (Recommended)
  const handleConnectStoreByToken = async () => {
    const cleanToken = storeTokenInput.trim().toUpperCase();
    if (!cleanToken) {
      setTokenError('Please enter the Store Access Token from your laptop POS.');
      return;
    }

    setIsVerifyingToken(true);
    setTokenError(null);
    clearError();

    const cleanHub = hubUrlInput.trim().replace(/\/$/, '') || DEFAULT_HUB_URL;
    const result = await addStoreByToken(cleanToken, cleanHub);
    setIsVerifyingToken(false);

    if (result.success && result.store) {
      // Auto-authenticate as Store Owner and navigate to dashboard
      await loginWithStore(result.store);
      Alert.alert(
        'Store Connected!',
        `Successfully linked "${result.store.name}". Your store is now saved for future use.`
      );
    } else {
      setTokenError(
        result.error ||
          'Could not verify Store Access Token. Please ensure your Cloud Hub is online and check the token on your laptop POS screen.'
      );
    }
  };

  // 2. Direct Local Wi-Fi Login (Shop Counter)
  const handleLocalWifiLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Required', 'Please enter your Dolly POS username and password');
      return;
    }

    setIsLoggingInLocal(true);
    clearError();

    try {
      if (localIpInput.trim() && localIpInput.trim() !== serverUrl) {
        await updateServerUrl(localIpInput.trim());
      }
      const success = await login(username.trim(), password);
      setIsLoggingInLocal(false);

      if (!success && !authError) {
        Alert.alert(
          'Login Failed',
          'Could not log in. Verify your username/password and make sure your phone is connected to the shop Wi-Fi.'
        );
      }
    } catch (err: any) {
      setIsLoggingInLocal(false);
      Alert.alert('Connection Error', err?.message || 'Could not reach local POS laptop.');
    }
  };

  // 3. Quick Enter Dashboard for already connected store
  const handleEnterDashboard = async () => {
    if (activeStore) {
      await loginWithStore(activeStore);
    }
  };

  // 4. Disconnect current store
  const handleDisconnectStore = async () => {
    if (!activeStore) return;
    Alert.alert(
      'Disconnect Store',
      `Disconnect "${activeStore.name}" from this device? You can reconnect anytime with your Store Access Token.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: async () => {
            await logout();
            await removeStore(activeStore.id);
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC' }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 20), paddingBottom: insets.bottom + 28 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Header */}
        <View style={styles.brandHero}>
          <View style={[styles.logoBadge, { backgroundColor: colors.brand[600] }]}>
            <ShieldCheck size={38} color="#ffffff" />
          </View>
          <Text style={[styles.brandTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
            Dolly POS
          </Text>
          <Text style={[styles.brandSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Executive Mobile Companion • Multi-Store
          </Text>
        </View>

        {/* ============================================================== */}
        {/* CASE 1: STORE IS ALREADY CONNECTED - SHOW STORE HERO & LAUNCH */}
        {/* ============================================================== */}
        {hasConnectedStore && activeStore ? (
          <View style={[styles.connectedCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
            <View style={styles.connectedCardHeader}>
              <View style={[styles.storeIconBox, { backgroundColor: 'rgba(225,29,72,0.1)' }]}>
                <Store size={22} color={colors.brand[600]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.connectedStoreName, { color: isDark ? '#F8FAFC' : '#0F172A' }]} numberOfLines={1}>
                  {activeStore.name}
                </Text>
                <View style={styles.tokenPillRow}>
                  <View style={styles.tokenPill}>
                    <Text style={styles.tokenPillText}>{activeStore.token}</Text>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: isPosOnline ? '#10B981' : '#F59E0B' }]} />
                  <Text style={[styles.statusLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    {isPosOnline ? 'POS Counter Online' : 'Cloud Standby (Laptop Off)'}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.connectedMetaBox}>
              <Text style={[styles.hubUrlLabel, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Cloud Hub: <Text style={{ fontFamily: 'monospace', color: colors.brand[600] }}>{activeStore.hub_url || DEFAULT_HUB_URL}</Text>
              </Text>
            </View>

            {/* Enter Dashboard Action */}
            <TouchableOpacity
              style={[styles.primaryActionBtn, { backgroundColor: colors.brand[600] }]}
              onPress={handleEnterDashboard}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryActionBtnText}>Open Store Dashboard</Text>
              <ArrowRight size={18} color="#FFFFFF" />
            </TouchableOpacity>

            {/* Secondary Actions (Switch Store & Disconnect) */}
            <View style={styles.storeActionsRow}>
              <TouchableOpacity
                style={[styles.outlineBtn, { borderColor: isDark ? '#334155' : '#CBD5E1' }]}
                onPress={() => setShowStoreSwitcher(true)}
              >
                <Store size={15} color={isDark ? '#94A3B8' : '#475569'} />
                <Text style={[styles.outlineBtnText, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                  Switch Store ({stores.length})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.outlineBtn, { borderColor: '#FCA5A5' }]}
                onPress={handleDisconnectStore}
              >
                <LogOut size={15} color="#EF4444" />
                <Text style={[styles.outlineBtnText, { color: '#EF4444' }]}>
                  Disconnect
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ============================================================== */
          /* CASE 2: FIRST TIME SETUP - PROMPT "CONNECT STORE FIRST"         */
          /* ============================================================== */
          <View style={[styles.onboardingCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
            {/* Step Banner */}
            <View style={styles.onboardingHeader}>
              <View style={styles.stepBadge}>
                <Text style={styles.stepBadgeText}>STEP 1</Text>
              </View>
              <Text style={[styles.onboardingTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                Connect Your Store First
              </Text>
              <Text style={[styles.onboardingSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Link this mobile app to your Dolly POS system to start monitoring live sales, profit margins, and inventory remotely.
              </Text>
            </View>

            {/* Connection Tabs: Cloud Token vs Local Wi-Fi */}
            <View style={[styles.tabSelector, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' }]}>
              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === 'CLOUD_TOKEN' && [styles.tabBtnActive, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }],
                ]}
                onPress={() => {
                  setActiveTab('CLOUD_TOKEN');
                  clearError();
                  setTokenError(null);
                }}
              >
                <KeyRound size={15} color={activeTab === 'CLOUD_TOKEN' ? colors.brand[600] : '#94A3B8'} />
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === 'CLOUD_TOKEN' && [styles.tabBtnTextActive, { color: isDark ? '#F8FAFC' : '#0F172A' }],
                  ]}
                >
                  Cloud Token (24/7)
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tabBtn,
                  activeTab === 'LOCAL_WIFI' && [styles.tabBtnActive, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }],
                ]}
                onPress={() => {
                  setActiveTab('LOCAL_WIFI');
                  clearError();
                  setTokenError(null);
                }}
              >
                <Wifi size={15} color={activeTab === 'LOCAL_WIFI' ? colors.brand[600] : '#94A3B8'} />
                <Text
                  style={[
                    styles.tabBtnText,
                    activeTab === 'LOCAL_WIFI' && [styles.tabBtnTextActive, { color: isDark ? '#F8FAFC' : '#0F172A' }],
                  ]}
                >
                  Local Shop Wi-Fi
                </Text>
              </TouchableOpacity>
            </View>

            {/* Error Message Box */}
            {(tokenError || authError) && (
              <View style={styles.errorBox}>
                <AlertCircle size={16} color="#DC2626" style={{ marginTop: 2 }} />
                <Text style={styles.errorText}>{tokenError || authError}</Text>
              </View>
            )}

            {/* TAB 1: CLOUD STORE TOKEN FORM */}
            {activeTab === 'CLOUD_TOKEN' ? (
              <View style={styles.formContent}>
                <View style={styles.inputGroup}>
                  <View style={styles.inputLabelRow}>
                    <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                      Store Access Token:
                    </Text>
                    <TouchableOpacity
                      style={[styles.scanBadgeBtn, { backgroundColor: colors.brand[600] }]}
                      onPress={handleOpenScanner}
                      activeOpacity={0.8}
                    >
                      <QrCode size={13} color="#FFFFFF" />
                      <Text style={styles.scanBadgeText}>Scan QR Code</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: isDark ? '#334155' : '#CBD5E1' }]}>
                    <KeyRound size={18} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? '#F8FAFC' : '#0F172A', fontFamily: 'monospace', letterSpacing: 1.5, fontWeight: '700' }]}
                      value={storeTokenInput}
                      onChangeText={(t) => {
                        setStoreTokenInput(t.toUpperCase());
                        setTokenError(null);
                      }}
                      placeholder="e.g. DLY-STR1-9A3F"
                      placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                      autoCapitalize="characters"
                      autoCorrect={false}
                    />
                    <TouchableOpacity
                      onPress={handleOpenScanner}
                      style={styles.inputScanIconBtn}
                      activeOpacity={0.7}
                    >
                      <QrCode size={20} color={colors.brand[600]} />
                    </TouchableOpacity>
                  </View>
                  <Text style={[styles.inputHelper, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    💡 Tap <Text style={{ fontWeight: '700' }}>Scan QR Code</Text> to point camera at your laptop screen in <Text style={{ fontWeight: '700' }}>Settings → Mobile Connect</Text>.
                  </Text>
                </View>

                {/* Advanced Cloud Hub Server URL Toggle */}
                <TouchableOpacity
                  style={styles.advancedToggleRow}
                  onPress={() => setShowAdvancedHub(!showAdvancedHub)}
                  activeOpacity={0.7}
                >
                  <Globe size={14} color={colors.brand[600]} />
                  <Text style={[styles.advancedToggleText, { color: colors.brand[600] }]}>
                    {showAdvancedHub ? 'Hide Custom Cloud Hub Gateway' : 'Configure Custom Cloud Hub Server (Optional)'}
                  </Text>
                  {showAdvancedHub ? (
                    <ChevronUp size={14} color={colors.brand[600]} />
                  ) : (
                    <ChevronDown size={14} color={colors.brand[600]} />
                  )}
                </TouchableOpacity>

                {showAdvancedHub && (
                  <View style={[styles.advancedBox, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: isDark ? '#334155' : '#E2E8F0' }]}>
                    <Text style={[styles.advancedBoxLabel, { color: isDark ? '#E2E8F0' : '#475569' }]}>
                      Cloud Hub Gateway URL:
                    </Text>
                    <TextInput
                      style={[styles.advancedInput, { color: isDark ? '#F8FAFC' : '#0F172A', borderColor: isDark ? '#334155' : '#CBD5E1' }]}
                      value={hubUrlInput}
                      onChangeText={setHubUrlInput}
                      placeholder="https://store1-hub.onrender.com"
                      placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <Text style={[styles.advancedSubtext, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                      Store owners can host their own separate Cloud Hub (Render / Railway / VPS) and enter its URL here.
                    </Text>
                  </View>
                )}

                {/* Connect Store Action */}
                <TouchableOpacity
                  style={[styles.primaryActionBtn, isVerifyingToken && styles.btnDisabled, { backgroundColor: colors.brand[600] }]}
                  onPress={handleConnectStoreByToken}
                  disabled={isVerifyingToken}
                  activeOpacity={0.85}
                >
                  {isVerifyingToken ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryActionBtnText}>Verify & Connect Store</Text>
                      <ArrowRight size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              /* TAB 2: LOCAL WI-FI LOGIN FORM */
              <View style={styles.formContent}>
                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                    Local POS Laptop IP Address:
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: isDark ? '#334155' : '#CBD5E1' }]}>
                    <Server size={18} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? '#F8FAFC' : '#0F172A' }]}
                      value={localIpInput}
                      onChangeText={setLocalIpInput}
                      placeholder="http://192.168.1.100:8000"
                      placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                    Username
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: isDark ? '#334155' : '#CBD5E1' }]}>
                    <UserIcon size={18} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? '#F8FAFC' : '#0F172A' }]}
                      value={username}
                      onChangeText={setUsername}
                      placeholder="e.g. admin or owner"
                      placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={[styles.inputLabel, { color: isDark ? '#E2E8F0' : '#334155' }]}>
                    Password
                  </Text>
                  <View style={[styles.inputWrapper, { backgroundColor: isDark ? '#0F172A' : '#F8FAFC', borderColor: isDark ? '#334155' : '#CBD5E1' }]}>
                    <Lock size={18} color="#94A3B8" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, { color: isDark ? '#F8FAFC' : '#0F172A' }]}
                      value={password}
                      onChangeText={setPassword}
                      placeholder="Enter password"
                      placeholderTextColor={isDark ? '#94A3B8' : '#64748B'}
                      secureTextEntry
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.primaryActionBtn, isLoggingInLocal && styles.btnDisabled, { backgroundColor: colors.brand[600] }]}
                  onPress={handleLocalWifiLogin}
                  disabled={isLoggingInLocal}
                  activeOpacity={0.85}
                >
                  {isLoggingInLocal ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.primaryActionBtnText}>Connect Local POS</Text>
                      <ArrowRight size={18} color="#FFFFFF" />
                    </>
                  )}
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Feature Badges Footer */}
        <View style={styles.footerNote}>
          <Text style={[styles.footerText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            24/7 Cloud Architecture • Multi-Store Isolation
          </Text>
          <Text style={[styles.footerSub, { color: isDark ? '#64748B' : '#94A3B8' }]}>
            Works even when the laptop is turned off • Zero counter slowdown
          </Text>
        </View>
      </ScrollView>

      {/* Multi-Store Switcher Modal */}
      <StoreSwitcherModal
        visible={showStoreSwitcher}
        onClose={() => setShowStoreSwitcher(false)}
      />

      {/* QR Code Scanner Camera Modal */}
      <Modal
        visible={isQrScannerOpen}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsQrScannerOpen(false)}
      >
        <View style={styles.cameraContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            onBarcodeScanned={(result) => handleBarcodeScanned(result.data)}
          />

          {/* Scanner Overlay UI */}
          <View style={[styles.cameraOverlay, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.cameraHeader}>
              <Text style={styles.cameraTitle}>Scan Store Pairing QR</Text>
              <TouchableOpacity
                style={styles.cameraCloseBtn}
                onPress={() => setIsQrScannerOpen(false)}
              >
                <X size={22} color="#ffffff" />
              </TouchableOpacity>
            </View>

            <View style={styles.viewfinderBox}>
              <View style={styles.viewfinderFrame} />
              <Text style={styles.cameraHint}>
                Point camera at the QR code in Dolly POS Desktop Settings → Mobile Connect
              </Text>
            </View>

            <View style={styles.cameraFooter}>
              <TouchableOpacity
                style={styles.cancelScanBtn}
                onPress={() => setIsQrScannerOpen(false)}
              >
                <Text style={styles.cancelScanBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  brandHero: {
    alignItems: 'center',
    marginVertical: 20,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  /* Connected Store Card */
  connectedCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 20,
  },
  connectedCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storeIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  connectedStoreName: {
    fontSize: 18,
    fontWeight: '800',
  },
  tokenPillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  tokenPill: {
    backgroundColor: 'rgba(225,29,72,0.1)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tokenPillText: {
    color: '#E11D48',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: '800',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  connectedMetaBox: {
    marginVertical: 14,
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  hubUrlLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  storeActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  outlineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  outlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  /* Onboarding "Connect Store First" Card */
  onboardingCard: {
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    marginBottom: 20,
  },
  onboardingHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  stepBadge: {
    backgroundColor: 'rgba(225,29,72,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 8,
  },
  stepBadgeText: {
    color: '#E11D48',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
  },
  onboardingTitle: {
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  onboardingSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
    paddingHorizontal: 10,
  },
  tabSelector: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  tabBtnActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabBtnTextActive: {
    fontWeight: '800',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    padding: 10,
    borderRadius: 12,
    marginBottom: 14,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: '#DC2626',
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
  },
  formContent: {
    gap: 14,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
  },
  inputHelper: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  advancedToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  advancedToggleText: {
    fontSize: 11,
    fontWeight: '700',
  },
  advancedBox: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  advancedBoxLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  advancedInput: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  advancedSubtext: {
    fontSize: 10,
    lineHeight: 14,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 4,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  footerNote: {
    alignItems: 'center',
    marginTop: 10,
    gap: 2,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  footerSub: {
    fontSize: 10,
    textAlign: 'center',
  },
  inputLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scanBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  scanBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  inputScanIconBtn: {
    padding: 6,
    marginLeft: 4,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraOverlay: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cameraTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  cameraCloseBtn: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  viewfinderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  viewfinderFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: '#db2777',
    borderRadius: 20,
    backgroundColor: 'transparent',
  },
  cameraHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 17,
  },
  cameraFooter: {
    alignItems: 'center',
  },
  cancelScanBtn: {
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  cancelScanBtnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
});
