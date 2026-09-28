import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import {
  Server,
  Wifi,
  WifiOff,
  User,
  LogOut,
  HelpCircle,
  Globe,
  Radio,
  CheckCircle2,
  Download,
  Building2,
  Plus,
  Trash2,
  Check,
  Moon,
  Sun,
  Cpu,
  Clock,
  Sparkles,
  QrCode,
  Camera,
  X,
  ArrowRightLeft,
} from 'lucide-react-native';
import { Header } from '../components/Header';
import { useAuth } from '../context/AuthContext';
import { useConnection } from '../context/ConnectionContext';
import { useTheme } from '../context/ThemeContext';
import { api, getSavedBusinesses, saveBusinessesList, DEFAULT_HUB_URL } from '../services/api';
import { BusinessStore } from '../types';

const normalizeServerInput = (input: string): string => {
  let trimmed = input.trim();
  if (trimmed.startsWith('DLY-')) {
    // Format: DLY-192-168-0-145-8000
    const parts = trimmed.replace('DLY-', '').split('-');
    if (parts.length === 5) {
      const ip = `${parts[0]}.${parts[1]}.${parts[2]}.${parts[3]}`;
      const port = parts[4];
      return `http://${ip}:${port}`;
    }
  }
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    trimmed = `http://${trimmed}`;
  }
  return trimmed.replace(/\/$/, '');
};

export const SettingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const { colors, isDark, themeMode, setThemeMode } = useTheme();
  const {
    serverUrl,
    isOnline,
    isChecking,
    networkInfo,
    latencyMs,
    stores,
    activeStore,
    updateServerUrl,
    checkConnection,
    switchBusiness,
    switchStore,
    removeStore,
    addStoreByToken,
    refreshStores,
  } = useConnection();

  const [inputUrl, setInputUrl] = useState(serverUrl);
  const [saving, setSaving] = useState(false);
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [lastBackupTime, setLastBackupTime] = useState<string | null>(null);

  // QR Camera Scanner state
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedRecently, setScannedRecently] = useState(false);

  // Add store modal state
  const [isAddStoreModalOpen, setIsAddStoreModalOpen] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreUrl, setNewStoreUrl] = useState('');

  useEffect(() => {
    setInputUrl(serverUrl);
  }, [serverUrl]);

  const handleSaveAndTest = async () => {
    if (!inputUrl.trim()) {
      Alert.alert('Required', 'Please enter a server URL, IP, or Pairing Key (e.g. DLY-192-168-0-145-8000)');
      return;
    }

    const normalized = normalizeServerInput(inputUrl);
    setInputUrl(normalized);
    setSaving(true);
    const ok = await updateServerUrl(normalized);
    setSaving(false);

    if (ok) {
      Alert.alert(
        'Connected Successfully',
        `Successfully linked with Dolly POS at ${normalized} (Latency: ${latencyMs ?? 0}ms)`
      );
    } else {
      Alert.alert(
        'Connection Unreachable',
        'Could not reach Dolly POS. Please check if your POS laptop is on, uvicorn is running, and both devices are on the same Wi-Fi or using a valid Tunnel URL.'
      );
    }
  };

  // QR Code Scanner Handler
  const handleOpenScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert(
          'Permission Needed',
          'Camera access is required to scan the pairing QR code from your desktop screen.'
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
    let hubUrl = DEFAULT_HUB_URL;
    let isToken = false;

    try {
      const parsed = JSON.parse(data);
      if (parsed.store_token) {
        token = parsed.store_token;
        isToken = true;
      }
      if (parsed.hub_url) {
        hubUrl = parsed.hub_url;
      }
    } catch {
      if (token.startsWith('DLY-STR') || (token.startsWith('DLY-') && token.length < 20 && !token.includes('.'))) {
        isToken = true;
      }
    }

    if (isToken) {
      setSaving(true);
      const res = await addStoreByToken(token.toUpperCase(), hubUrl);
      setSaving(false);
      if (res.success && res.store) {
        Alert.alert(
          'Store Paired via QR Code!',
          `Successfully connected "${res.store.name}". Switched to this store.`
        );
      } else {
        Alert.alert(
          'Pairing Failed',
          res.error || 'Could not verify Store Access Token via Cloud Hub.'
        );
      }
      return;
    }

    const clean = normalizeServerInput(data);
    setInputUrl(clean);
    setSaving(true);
    const ok = await updateServerUrl(clean);
    setSaving(false);

    if (ok) {
      Alert.alert(
        'Paired via QR Code!',
        `Successfully connected to Dolly POS at ${clean}`
      );
    } else {
      Alert.alert(
        'QR Code Scanned',
        `Scanned URL: ${clean}\nCould not reach server yet. Check if laptop and phone are on the same Wi-Fi.`
      );
    }
  };

  // Switch Business (isolated connection, no merging)
  const handleSwitchStore = async (store: BusinessStore) => {
    setSaving(true);
    let ok = false;
    if (store.token) {
      ok = await switchStore(store.id);
    } else {
      ok = await switchBusiness(store.url || serverUrl, store.name);
    }
    setSaving(false);

    if (ok) {
      Alert.alert(
        'Switched Business',
        `Now connected to "${store.name}". Store data is freshly loaded.`
      );
    } else {
      Alert.alert(
        'Switched with Notice',
        `Switched to "${store.name}", but the server appears offline right now. Check if this store laptop is running.`
      );
    }
  };

  const handleAddStore = async () => {
    const rawInput = newStoreUrl.trim();
    const name = newStoreName.trim();
    if (!rawInput) {
      Alert.alert('Required', 'Please enter a Store Access Token or Server URL.');
      return;
    }

    // 1. If user entered a Store Access Token (e.g. DLY-STR...)
    if (rawInput.toUpperCase().startsWith('DLY-STR') || (!rawInput.includes('.') && !rawInput.includes('/') && rawInput.length >= 8)) {
      setSaving(true);
      const res = await addStoreByToken(rawInput.toUpperCase());
      setSaving(false);
      if (res.success && res.store) {
        setNewStoreName('');
        setNewStoreUrl('');
        setIsAddStoreModalOpen(false);
        Alert.alert(
          'Store Added Successfully',
          `"${res.store.name}" was added to your businesses list and is now active.`
        );
      } else {
        Alert.alert('Error', res.error || 'Could not verify Store Access Token.');
      }
      return;
    }

    // 2. Direct LAN IP / URL
    if (!name) {
      Alert.alert('Required', 'Please provide a Branch / Store Name.');
      return;
    }

    const cleanUrl = normalizeServerInput(rawInput);
    const newStore: BusinessStore = {
      id: `store_${Date.now()}`,
      name,
      url: cleanUrl,
      is_active: false,
    };

    const updated = [...stores, newStore];
    await saveBusinessesList(updated);
    await refreshStores();

    setNewStoreName('');
    setNewStoreUrl('');
    setIsAddStoreModalOpen(false);

    Alert.alert(
      'Business Added',
      `"${name}" was added to your stores list. You can tap "Switch to This Business" whenever you want to monitor it.`
    );
  };

  const handleDeleteStore = async (store: BusinessStore) => {
    if (stores.length <= 1) {
      Alert.alert('Action Denied', 'You must have at least one store registered.');
      return;
    }

    Alert.alert(
      'Remove Business',
      `Are you sure you want to remove "${store.name}" from this device?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeStore(store.id);
          },
        },
      ]
    );
  };

  const handleDownloadBackup = async () => {
    if (!isOnline) {
      Alert.alert('Offline', 'Cannot download backup while POS server is offline.');
      return;
    }

    setDownloadingBackup(true);
    try {
      await api.downloadFullBackup();
      const timeStr = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
      setLastBackupTime(timeStr);
      Alert.alert(
        'Database Snapshot Generated',
        'Complete Dolly POS database backup successfully saved to your phone. Use the share sheet to send via WhatsApp, Email, or save to Google Drive.'
      );
    } catch (e: any) {
      Alert.alert('Backup Error', e?.message || 'Failed to download database snapshot.');
    } finally {
      setDownloadingBackup(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out from Dolly POS Companion?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const isLocalLan = serverUrl.includes('192.168.') || serverUrl.includes('10.') || serverUrl.includes('172.');

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Header title="Settings" subtitle="Connection, Multi-Store & Backup" />

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: 40 + insets.bottom }]}>
        {/* 1. Connection Health Card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeader}>
            <Server size={18} color={colors.brand[600]} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Connection Health & Pairing
            </Text>
          </View>

          <View style={[styles.statusRow, { backgroundColor: colors.surfaceSubtle }]}>
            <View style={styles.statusIndicator}>
              {isChecking ? (
                <ActivityIndicator size="small" color={colors.brand[600]} />
              ) : isOnline ? (
                <Wifi size={20} color={colors.success} />
              ) : (
                <WifiOff size={20} color={colors.danger} />
              )}
              <View>
                <Text style={[styles.statusMainText, { color: colors.textPrimary }]}>
                  {isOnline ? 'Online & Paired' : 'Offline / Unreachable'}
                </Text>
                <Text style={[styles.statusSubText, { color: colors.textMuted }]}>
                  {isOnline
                    ? `Ping Latency: ${latencyMs ?? 0} ms (${(latencyMs ?? 0) < 60 ? 'Ultra Fast' : 'Remote Tunnel'})`
                    : 'Check Wi-Fi network or Tunnel URL'}
                </Text>
              </View>
            </View>

            {isOnline && (
              <View style={styles.badgeGroup}>
                <View style={[styles.onlineTag, { backgroundColor: colors.successLight }]}>
                  <CheckCircle2 size={12} color={colors.success} />
                  <Text style={[styles.onlineTagText, { color: colors.success }]}>LIVE</Text>
                </View>
                <View style={[styles.modeTag, isLocalLan ? styles.modeTagLan : styles.modeTagCloud]}>
                  <Text style={[styles.modeTagText, isLocalLan ? styles.modeTagTextLan : styles.modeTagTextCloud]}>
                    {isLocalLan ? 'Shop LAN' : 'Cloud Tunnel'}
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* URL / Pairing Key Input */}
          <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
            Server Base URL or Pairing Key
          </Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, color: colors.textPrimary }]}
            value={inputUrl}
            onChangeText={setInputUrl}
            placeholder="http://192.168.0.145:8000 or DLY-192-168-0-145-8000"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <View style={styles.actionBtnRow}>
            {/* Scan QR Button */}
            <TouchableOpacity
              style={[styles.scanQrBtn, { backgroundColor: colors.brand[50], borderColor: colors.brand[200] }]}
              onPress={handleOpenScanner}
              activeOpacity={0.8}
            >
              <QrCode size={15} color={colors.brand[600]} />
              <Text style={[styles.scanQrBtnText, { color: colors.brand[600] }]}>Scan QR</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.testBtn, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder }]}
              onPress={() => checkConnection(normalizeServerInput(inputUrl))}
              disabled={isChecking}
            >
              <Text style={[styles.testBtnText, { color: colors.textSecondary }]}>Ping</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.brand[600] }]}
              onPress={handleSaveAndTest}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Save & Pair</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Switch Business / Multi-Branch (Proper Independent Stores) */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeaderBetween}>
            <View style={styles.cardHeaderLeft}>
              <Building2 size={18} color={colors.brand[600]} />
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                Switch Business / Multi-Branch
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.addStoreSmallBtn, { backgroundColor: colors.brand[50], borderColor: colors.brand[200] }]}
              onPress={() => setIsAddStoreModalOpen(true)}
            >
              <Plus size={14} color={colors.brand[600]} />
              <Text style={[styles.addStoreSmallBtnText, { color: colors.brand[600] }]}>Add Branch</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.cardSubText, { color: colors.textSecondary }]}>
            Manage multiple shops or branches on this phone. Switching connects directly to that store's server without mixing data.
          </Text>

          <View style={styles.storeList}>
            {stores.map((b) => {
              const isActive = b.id === activeStore?.id;
              return (
                <View
                  key={b.id}
                  style={[
                    styles.storeCard,
                    {
                      backgroundColor: isActive ? (isDark ? '#2a1727' : '#fdf2f8') : colors.surfaceSubtle,
                      borderColor: isActive ? colors.brand[500] : colors.cardBorder,
                    },
                  ]}
                >
                  <View style={styles.storeCardHeader}>
                    <View style={styles.storeCardHeaderLeft}>
                      <View
                        style={[
                          styles.storeStatusDot,
                          { backgroundColor: isActive ? colors.success : colors.textMuted },
                        ]}
                      />
                      <Text style={[styles.storeName, { color: colors.textPrimary }]} numberOfLines={1}>
                        {b.name}
                      </Text>
                    </View>

                    {isActive ? (
                      <View style={[styles.activeStoreBadge, { backgroundColor: colors.successLight }]}>
                        <Check size={11} color={colors.success} />
                        <Text style={[styles.activeStoreBadgeText, { color: colors.success }]}>
                          ACTIVE
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <Text style={[styles.storeUrl, { color: colors.textMuted }]} numberOfLines={1}>
                    {b.token ? `Cloud Token: ${b.token}` : (b.url || 'Configured')}
                  </Text>

                  <View style={styles.storeCardActions}>
                    {!isActive ? (
                      <TouchableOpacity
                        style={[styles.switchStoreActionBtn, { backgroundColor: colors.brand[600] }]}
                        onPress={() => handleSwitchStore(b)}
                        activeOpacity={0.8}
                      >
                        <ArrowRightLeft size={13} color="#ffffff" />
                        <Text style={styles.switchStoreActionBtnText}>Switch to This Business</Text>
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.currentConnectedBox}>
                        <Text style={[styles.currentConnectedText, { color: colors.brand[600] }]}>
                          ✓ Currently Connected & Syncing
                        </Text>
                      </View>
                    )}

                    {!isActive && stores.length > 1 && (
                      <TouchableOpacity
                        style={[styles.deleteStoreBtn, { backgroundColor: colors.dangerLight }]}
                        onPress={() => handleDeleteStore(b)}
                      >
                        <Trash2 size={13} color={colors.danger} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        {/* 3. 1-Click Database Backup */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeader}>
            <Download size={18} color={colors.brand[600]} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              1-Click Full Database Backup
            </Text>
          </View>

          <Text style={[styles.cardSubText, { color: colors.textSecondary }]}>
            Download a complete JSON snapshot of your entire POS database (all products, bills, and expenses) directly to your mobile phone.
          </Text>

          {lastBackupTime && (
            <View style={[styles.lastBackupBox, { backgroundColor: colors.successLight }]}>
              <Clock size={13} color={colors.success} />
              <Text style={[styles.lastBackupText, { color: colors.success }]}>
                Last Snapshot downloaded at {lastBackupTime}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.backupDownloadBtn, (!isOnline || downloadingBackup) && styles.btnDisabled]}
            onPress={handleDownloadBackup}
            disabled={!isOnline || downloadingBackup}
            activeOpacity={0.85}
          >
            {downloadingBackup ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Download size={16} color="#ffffff" />
            )}
            <Text style={styles.backupDownloadBtnText}>
              {downloadingBackup ? 'Generating & Downloading...' : 'Download Full Database Backup to Phone'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 4. Active Store Details */}
        {networkInfo && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
            <View style={styles.cardHeader}>
              <Radio size={18} color={colors.brand[600]} />
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                Active Store System
              </Text>
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.cardBorder }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Shop Name</Text>
              <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{networkInfo.shop_name}</Text>
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.cardBorder }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Laptop LAN IP</Text>
              <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{networkInfo.local_ip}:{networkInfo.port}</Text>
            </View>

            <View style={[styles.infoRow, { borderBottomColor: colors.cardBorder }]}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>API Route</Text>
              <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{networkInfo.api_base_url}</Text>
            </View>
          </View>
        )}

        {/* 5. Theme & Appearance (Fully Functional Light/Dark Switching) */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeader}>
            <Sparkles size={18} color={colors.brand[600]} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Appearance & Theme
            </Text>
          </View>

          <View style={styles.themeChips}>
            <TouchableOpacity
              style={[
                styles.themeChip,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
                themeMode === 'LIGHT' && { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
              ]}
              onPress={() => setThemeMode('LIGHT')}
            >
              <Sun size={14} color={themeMode === 'LIGHT' ? '#ffffff' : colors.textSecondary} />
              <Text
                style={[
                  styles.themeChipText,
                  { color: colors.textSecondary },
                  themeMode === 'LIGHT' && styles.themeChipTextActive,
                ]}
              >
                Light
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeChip,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
                themeMode === 'DARK' && { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
              ]}
              onPress={() => setThemeMode('DARK')}
            >
              <Moon size={14} color={themeMode === 'DARK' ? '#ffffff' : colors.textSecondary} />
              <Text
                style={[
                  styles.themeChipText,
                  { color: colors.textSecondary },
                  themeMode === 'DARK' && styles.themeChipTextActive,
                ]}
              >
                Dark
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeChip,
                { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder },
                themeMode === 'SYSTEM' && { backgroundColor: colors.brand[600], borderColor: colors.brand[600] },
              ]}
              onPress={() => setThemeMode('SYSTEM')}
            >
              <Cpu size={14} color={themeMode === 'SYSTEM' ? '#ffffff' : colors.textSecondary} />
              <Text
                style={[
                  styles.themeChipText,
                  { color: colors.textSecondary },
                  themeMode === 'SYSTEM' && styles.themeChipTextActive,
                ]}
              >
                Auto
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 6. Operator Account */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeader}>
            <User size={18} color={colors.brand[600]} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              Operator Account
            </Text>
          </View>

          <View style={[styles.infoRow, { borderBottomColor: colors.cardBorder }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Username</Text>
            <Text style={[styles.infoVal, { color: colors.textPrimary }]}>{user?.username || 'admin'}</Text>
          </View>

          <View style={[styles.infoRow, { borderBottomColor: colors.cardBorder }]}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>Role</Text>
            <Text style={[styles.infoVal, { color: colors.brand[600], fontWeight: '700' }]}>
              {user?.role || 'OWNER'}
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.logoutBtn, { backgroundColor: colors.dangerLight }]}
            onPress={handleLogout}
          >
            <LogOut size={16} color={colors.danger} />
            <Text style={[styles.logoutText, { color: colors.danger }]}>Sign Out from Mobile App</Text>
          </TouchableOpacity>
        </View>

        {/* 7. Connectivity Guide */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.cardBorder }]}>
          <View style={styles.cardHeader}>
            <HelpCircle size={18} color={colors.brand[600]} />
            <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
              How Mobile Sync Works
            </Text>
          </View>

          <View style={styles.guideStep}>
            <View style={[styles.stepNum, { backgroundColor: colors.brand[50] }]}>
              <Text style={[styles.stepNumText, { color: colors.brand[600] }]}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                Shop Wi-Fi (Same Network)
              </Text>
              <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                Connect both your phone and POS laptop to your store Wi-Fi router. Enter the laptop's LAN IP (`http://192.168.0.145:8000`). Ultra-fast (&lt;20ms latency).
              </Text>
            </View>
          </View>

          <View style={styles.guideStep}>
            <View style={[styles.stepNum, { backgroundColor: colors.purpleLight }]}>
              <Globe size={14} color={colors.purple} />
            </View>
            <View style={styles.stepContent}>
              <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                Remote 4G / 5G Anywhere
              </Text>
              <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>
                When away from the store, scan the Pairing QR Code from Desktop POS Settings → Mobile Connect. Multiple phones can connect simultaneously without slowing down billing.
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

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
              <Text style={styles.cameraTitle}>Scan Pairing QR Code</Text>
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

      {/* Add Store / Branch Modal */}
      <Modal
        visible={isAddStoreModalOpen}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsAddStoreModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Add New Business Branch
            </Text>
            <Text style={[styles.modalSub, { color: colors.textSecondary }]}>
              Connect via 1-tap QR code scan or enter your branch Store Access Token / LAN IP.
            </Text>

            {/* 1-Tap QR Scan Button */}
            <TouchableOpacity
              style={[styles.modalQrBtn, { backgroundColor: colors.brand[600] }]}
              onPress={() => {
                setIsAddStoreModalOpen(false);
                setTimeout(() => {
                  handleOpenScanner();
                }, 300);
              }}
              activeOpacity={0.85}
            >
              <QrCode size={18} color="#ffffff" />
              <Text style={styles.modalQrBtnText}>Scan Store Pairing QR Code</Text>
            </TouchableOpacity>

            <View style={styles.modalOrRow}>
              <View style={[styles.modalOrLine, { backgroundColor: colors.cardBorder }]} />
              <Text style={[styles.modalOrText, { color: colors.textMuted }]}>OR ENTER DETAILS</Text>
              <View style={[styles.modalOrLine, { backgroundColor: colors.cardBorder }]} />
            </View>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Branch / Store Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, color: colors.textPrimary }]}
              value={newStoreName}
              onChangeText={setNewStoreName}
              placeholder="e.g. Branch 2 - MG Road"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Store Access Token or Laptop LAN IP</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.surfaceSubtle, borderColor: colors.cardBorder, color: colors.textPrimary }]}
              value={newStoreUrl}
              onChangeText={setNewStoreUrl}
              placeholder="e.g. DLY-STR2-9A3F or 192.168.0.150:8000"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { backgroundColor: colors.surfaceSubtle }]}
                onPress={() => setIsAddStoreModalOpen(false)}
              >
                <Text style={[styles.modalCancelBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: colors.brand[600] }]}
                onPress={handleAddStore}
              >
                <Text style={styles.modalSaveBtnText}>Add Store</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  cardHeaderBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardSubText: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  addStoreSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
  },
  addStoreSmallBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusMainText: {
    fontSize: 13,
    fontWeight: '700',
  },
  statusSubText: {
    fontSize: 11,
  },
  badgeGroup: {
    alignItems: 'flex-end',
    gap: 4,
  },
  onlineTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  onlineTagText: {
    fontSize: 10,
    fontWeight: '800',
  },
  modeTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  modeTagLan: {
    backgroundColor: '#eff6ff',
  },
  modeTagCloud: {
    backgroundColor: '#faf5ff',
  },
  modeTagText: {
    fontSize: 9,
    fontWeight: '700',
  },
  modeTagTextLan: {
    color: '#2563eb',
  },
  modeTagTextCloud: {
    color: '#7c3aed',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    marginBottom: 12,
  },
  actionBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  scanQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  scanQrBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  testBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '700',
  },
  saveBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  saveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  storeList: {
    gap: 10,
  },
  storeCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  storeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storeCardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  storeStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  storeName: {
    fontSize: 13,
    fontWeight: '700',
  },
  activeStoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeStoreBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  storeUrl: {
    fontSize: 11,
    fontFamily: 'monospace',
    marginLeft: 16,
  },
  storeCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  switchStoreActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  switchStoreActionBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  currentConnectedBox: {
    paddingVertical: 6,
  },
  currentConnectedText: {
    fontSize: 11,
    fontWeight: '700',
  },
  deleteStoreBtn: {
    padding: 7,
    borderRadius: 8,
  },
  lastBackupBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 12,
  },
  lastBackupText: {
    fontSize: 11,
    fontWeight: '600',
  },
  backupDownloadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
  },
  backupDownloadBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  themeChips: {
    flexDirection: 'row',
    gap: 8,
  },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
  },
  themeChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  themeChipTextActive: {
    color: '#ffffff',
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 12,
  },
  infoVal: {
    fontSize: 12,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    paddingVertical: 11,
    marginTop: 14,
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '700',
  },
  guideStep: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: '800',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  stepDesc: {
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  modalSub: {
    fontSize: 12,
    marginBottom: 14,
    lineHeight: 17,
  },
  modalLabel: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  modalCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  modalCancelBtnText: {
    fontSize: 12,
    fontWeight: '600',
  },
  modalSaveBtn: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalSaveBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalQrBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginTop: 6,
    marginBottom: 8,
  },
  modalQrBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalOrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 8,
  },
  modalOrLine: {
    flex: 1,
    height: 1,
  },
  modalOrText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
});
