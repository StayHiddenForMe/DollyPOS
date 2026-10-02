import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {
  Store,
  Check,
  Plus,
  Trash2,
  X,
  Radio,
  Wifi,
  WifiOff,
  Sparkles,
} from 'lucide-react-native';
import { useConnection } from '../context/ConnectionContext';
import { useTheme } from '../context/ThemeContext';
import { BusinessStore } from '../types';

interface StoreSwitcherModalProps {
  visible: boolean;
  onClose: () => void;
}

export const StoreSwitcherModal: React.FC<StoreSwitcherModalProps> = ({ visible, onClose }) => {
  const { stores, activeStore, switchStore, addStoreByToken, removeStore, isPosOnline } = useConnection();
  const { colors, isDark } = useTheme();

  const [isAddingMode, setIsAddingMode] = useState(false);
  const [newTokenInput, setNewTokenInput] = useState('');
  const [newHubInput, setNewHubInput] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSelectStore = async (store: BusinessStore) => {
    if (store.id === activeStore?.id) {
      onClose();
      return;
    }
    await switchStore(store.id);
    onClose();
  };

  const handleConnectNewStore = async () => {
    const cleanToken = newTokenInput.trim().toUpperCase();
    if (!cleanToken) {
      setErrorMessage('Please enter a Store Access Token.');
      return;
    }

    setIsConnecting(true);
    setErrorMessage(null);

    const cleanHub = newHubInput.trim().replace(/\/$/, '') || undefined;
    const res = await addStoreByToken(cleanToken, cleanHub);
    setIsConnecting(false);

    if (res.success) {
      setNewTokenInput('');
      setNewHubInput('');
      setIsAddingMode(false);
      onClose();
    } else {
      setErrorMessage(res.error || 'Store Token not found. Please verify the code on your laptop.');
    }
  };

  const handleConfirmDelete = (store: BusinessStore) => {
    Alert.alert(
      'Remove Store',
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

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.modalCard, { backgroundColor: isDark ? '#1E293B' : '#FFFFFF' }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={styles.titleContainer}>
              <Store size={22} color="#E11D48" />
              <Text style={[styles.modalTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                Switch Store
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={isDark ? '#94A3B8' : '#64748B'} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
            Select a store to monitor live sales or add a new branch using its Store Access Token.
          </Text>

          {/* Store List */}
          <ScrollView style={styles.storesList} contentContainerStyle={styles.storesListContent}>
            {stores.map((s, idx) => {
              const isActive = s.id === activeStore?.id;
              return (
                <TouchableOpacity
                  key={`${s.id || s.token || idx}-${idx}`}
                  style={[
                    styles.storeItem,
                    {
                      backgroundColor: isActive
                        ? isDark
                          ? '#881337'
                          : '#FFE4E6'
                        : isDark
                        ? '#0F172A'
                        : '#F8FAFC',
                      borderColor: isActive
                        ? '#E11D48'
                        : isDark
                        ? '#334155'
                        : '#E2E8F0',
                    },
                  ]}
                  onPress={() => handleSelectStore(s)}
                  activeOpacity={0.8}
                >
                  <View style={styles.storeIconBox}>
                    <Store size={18} color={isActive ? '#E11D48' : '#94A3B8'} />
                  </View>

                  <View style={styles.storeInfo}>
                    <View style={styles.storeNameRow}>
                      <Text
                        style={[
                          styles.storeName,
                          { color: isDark ? '#F8FAFC' : '#0F172A', fontWeight: isActive ? '800' : '600' },
                        ]}
                        numberOfLines={1}
                      >
                        {s.name}
                      </Text>
                      {isActive && (
                        <View style={styles.activePill}>
                          <Text style={styles.activePillText}>ACTIVE</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.storeMetaRow}>
                      {s.token ? (
                        <Text style={styles.tokenPillText}>{s.token}</Text>
                      ) : (
                        <Text style={styles.tokenPillText}>Direct LAN</Text>
                      )}
                      <View style={styles.statusDotRow}>
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor: isActive
                                ? isPosOnline
                                  ? '#10B981'
                                  : '#F59E0B'
                                : '#94A3B8',
                            },
                          ]}
                        />
                        <Text style={[styles.statusText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                          {isActive
                            ? isPosOnline
                              ? 'POS Online'
                              : 'POS Offline (Snapshot)'
                            : 'Linked'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Actions */}
                  <View style={styles.actionCol}>
                    {isActive ? (
                      <View style={styles.checkCircle}>
                        <Check size={16} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    ) : stores.length > 1 ? (
                      <TouchableOpacity
                        onPress={() => handleConfirmDelete(s)}
                        style={styles.deleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Trash2 size={16} color="#EF4444" />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Add Store Section */}
          {isAddingMode ? (
            <View style={[styles.addSection, { backgroundColor: isDark ? '#0F172A' : '#F1F5F9' }]}>
              <Text style={[styles.addTitle, { color: isDark ? '#F8FAFC' : '#0F172A' }]}>
                Add Another Store
              </Text>
              <Text style={[styles.addSubtitle, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                Enter the Store Access Token shown on the store laptop screen (Settings → Mobile Connect).
              </Text>

              <TextInput
                style={[
                  styles.tokenInput,
                  {
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                    marginBottom: 8,
                  },
                ]}
                placeholder="Store Token: e.g. DLY-STR2-8A4F"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={newTokenInput}
                onChangeText={(t) => {
                  setNewTokenInput(t.toUpperCase());
                  setErrorMessage(null);
                }}
                autoCapitalize="characters"
                autoCorrect={false}
              />

              <TextInput
                style={[
                  styles.tokenInput,
                  {
                    backgroundColor: isDark ? '#1E293B' : '#FFFFFF',
                    color: isDark ? '#F8FAFC' : '#0F172A',
                    borderColor: isDark ? '#334155' : '#CBD5E1',
                    fontSize: 12,
                    fontFamily: 'monospace',
                  },
                ]}
                placeholder="Cloud Hub URL (optional, defaults to hub)"
                placeholderTextColor={isDark ? '#64748B' : '#94A3B8'}
                value={newHubInput}
                onChangeText={setNewHubInput}
                autoCapitalize="none"
                autoCorrect={false}
              />

              {errorMessage && (
                <Text style={styles.errorText}>{errorMessage}</Text>
              )}

              <View style={styles.addBtnRow}>
                <TouchableOpacity
                  style={[styles.cancelBtn, { borderColor: isDark ? '#334155' : '#CBD5E1' }]}
                  onPress={() => {
                    setIsAddingMode(false);
                    setErrorMessage(null);
                    setNewTokenInput('');
                  }}
                  disabled={isConnecting}
                >
                  <Text style={[styles.cancelBtnText, { color: isDark ? '#94A3B8' : '#64748B' }]}>
                    Cancel
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.connectBtn}
                  onPress={handleConnectNewStore}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.connectBtnText}>Link Store</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.openAddBtn}
              onPress={() => setIsAddingMode(true)}
              activeOpacity={0.8}
            >
              <Plus size={18} color="#E11D48" />
              <Text style={styles.openAddBtnText}>Add Another Store</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 20,
    maxHeight: '85%',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  closeBtn: {
    padding: 6,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 16,
  },
  storesList: {
    maxHeight: 280,
  },
  storesListContent: {
    gap: 10,
    paddingBottom: 8,
  },
  storeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1.5,
  },
  storeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: 'rgba(225,29,72,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  storeInfo: {
    flex: 1,
  },
  storeNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  storeName: {
    fontSize: 14,
    flexShrink: 1,
  },
  activePill: {
    backgroundColor: '#E11D48',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  activePillText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  storeMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  tokenPillText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#E11D48',
    fontWeight: '700',
  },
  statusDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
  },
  actionCol: {
    marginLeft: 8,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#E11D48',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    padding: 6,
  },
  openAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#E11D48',
    marginTop: 12,
  },
  openAddBtnText: {
    color: '#E11D48',
    fontSize: 13,
    fontWeight: '700',
  },
  addSection: {
    padding: 16,
    borderRadius: 20,
    marginTop: 12,
  },
  addTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  addSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginBottom: 12,
  },
  tokenInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: 'monospace',
    fontWeight: '700',
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: 8,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  addBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  connectBtn: {
    flex: 2,
    backgroundColor: '#E11D48',
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
});
