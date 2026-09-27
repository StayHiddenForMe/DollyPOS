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
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ShieldCheck, Wifi, WifiOff, Server, Lock, User as UserIcon } from 'lucide-react-native';
import { useAuth } from '../context/AuthContext';
import { useConnection } from '../context/ConnectionContext';
import { colors } from '../theme/colors';

export const LoginScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { login, error, clearError } = useAuth();
  const { serverUrl, isOnline, isChecking, latencyMs, updateServerUrl, checkConnection } =
    useConnection();

  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showServerInput, setShowServerInput] = useState(false);
  const [customUrl, setCustomUrl] = useState(serverUrl);

  const handleLogin = async () => {
    if (!username.trim() || !password) {
      Alert.alert('Required', 'Please enter your Dolly POS username and password');
      return;
    }

    setIsSubmitting(true);
    clearError();
    const success = await login(username.trim(), password);
    setIsSubmitting(false);

    if (!success && !error) {
      Alert.alert(
        'Login Failed',
        'Could not log in. Please verify your Dolly POS credentials and ensure the POS server is reachable.'
      );
    }
  };

  const handleSaveUrl = async () => {
    if (!customUrl.trim()) return;
    const ok = await updateServerUrl(customUrl.trim());
    if (ok) {
      setShowServerInput(false);
      Alert.alert('Connected', `Successfully connected to Dolly POS server (${latencyMs ?? 0}ms)!`);
    } else {
      Alert.alert(
        'Connection Failed',
        'Could not reach Dolly POS at this address. Make sure your phone is connected to the same shop Wi-Fi network.'
      );
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: Math.max(insets.top, 24), paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Brand Hero */}
        <View style={styles.brandHero}>
          <View style={styles.logoBadge}>
            <ShieldCheck size={36} color="#ffffff" />
          </View>
          <Text style={styles.brandTitle}>Dolly POS</Text>
          <Text style={styles.brandSubtitle}>Mobile Executive Companion</Text>
        </View>

        {/* Server Connection Bar */}
        <View style={styles.serverStatusCard}>
          <TouchableOpacity
            style={styles.statusLeft}
            onPress={() => checkConnection()}
            activeOpacity={0.7}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color={colors.brand[600]} />
            ) : isOnline ? (
              <Wifi size={18} color={colors.success} />
            ) : (
              <WifiOff size={18} color={colors.danger} />
            )}
            <View>
              <Text style={styles.serverLabel}>
                {isOnline
                  ? `Connected (${latencyMs ?? 0}ms)`
                  : isChecking
                  ? 'Testing connection...'
                  : 'Server Unreachable (Tap to retry)'}
              </Text>
              <Text style={styles.serverSubtext} numberOfLines={1}>
                {serverUrl}
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.changeServerBtn}
            onPress={() => {
              setCustomUrl(serverUrl);
              setShowServerInput(!showServerInput);
            }}
          >
            <Server size={14} color={colors.brand[600]} />
            <Text style={styles.changeServerText}>Configure</Text>
          </TouchableOpacity>
        </View>

        {/* Change Server URL Panel */}
        {showServerInput && (
          <View style={styles.urlInputBox}>
            <Text style={styles.urlInputLabel}>Dolly POS Server Address:</Text>
            <TextInput
              style={styles.urlTextInput}
              value={customUrl}
              onChangeText={setCustomUrl}
              placeholder="http://192.168.0.145:8000"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.urlBtnRow}>
              <TouchableOpacity
                style={styles.testBtn}
                onPress={() => checkConnection(customUrl)}
              >
                <Text style={styles.testBtnText}>Test Ping</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveUrlBtn} onPress={handleSaveUrl}>
                <Text style={styles.saveUrlBtnText}>Save & Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Login Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Sign In</Text>
          <Text style={styles.formDescription}>
            Use your Dolly POS operator or owner credentials to monitor your store.
          </Text>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Username Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Username</Text>
            <View style={styles.inputWrapper}>
              <UserIcon size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={setUsername}
                placeholder="e.g. admin or owner"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Password</Text>
            <View style={styles.inputWrapper}>
              <Lock size={18} color={colors.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter password"
                secureTextEntry
              />
            </View>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.signInBtn, isSubmitting && styles.btnDisabled]}
            onPress={handleLogin}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.signInBtnText}>Log In to Dashboard</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.footerNote}>
          <Text style={styles.footerText}>
            Phase 1: Same Wi-Fi Network ('192.168.0.145:8000')
          </Text>
          <Text style={styles.footerSub}>
            Zero counter slowdown • Read-only encrypted sync
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  brandHero: {
    alignItems: 'center',
    marginVertical: 24,
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: 20,
    backgroundColor: colors.brand[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    shadowColor: colors.brand[600],
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
    marginTop: 2,
  },
  serverStatusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  serverLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  serverSubtext: {
    fontSize: 11,
    color: colors.textMuted,
    maxWidth: 180,
  },
  changeServerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.brand[50],
  },
  changeServerText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.brand[600],
  },
  urlInputBox: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.brand[200],
  },
  urlInputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  urlTextInput: {
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceSubtle,
    marginBottom: 10,
  },
  urlBtnRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  testBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: colors.surfaceSubtle,
  },
  testBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  saveUrlBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
    backgroundColor: colors.brand[600],
  },
  saveUrlBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  formCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  formDescription: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 16,
  },
  errorBox: {
    backgroundColor: colors.dangerLight,
    borderColor: '#fca5a5',
    borderWidth: 1,
    padding: 10,
    borderRadius: 8,
    marginBottom: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '600',
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.cardBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: colors.surfaceSubtle,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  signInBtn: {
    backgroundColor: colors.brand[600],
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  signInBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  footerNote: {
    marginTop: 24,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  footerSub: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
});
