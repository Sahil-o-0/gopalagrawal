import React, { useContext, useState } from 'react';
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
  Image, 
  StatusBar,
  Modal,
  Alert
} from 'react-native';
import * as Updates from 'expo-updates';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { AuthContext } from '../context/AuthContext';

export default function LoginScreen() {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secretKey, setSecretKey] = useState('');

  // 2-Step OTP Login State
  const [otpStep, setOtpStep] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSession, setOtpSession] = useState('');
  const [userHint, setUserHint] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [isResending, setIsResending] = useState(false);

  // Firebase Phone Auth reCAPTCHA states
  const [adminPhone, setAdminPhone] = useState('');
  const [showCaptchaModal, setShowCaptchaModal] = useState(false);
  const [captchaStatus, setCaptchaStatus] = useState('');
  const [smsSent, setSmsSent] = useState(false);
  const [captchaUrl, setCaptchaUrl] = useState('');
  const [verificationId, setVerificationId] = useState('');

  const { login, verifyOtp, resendOtp, registerFirebaseSession, signup, isLoading } = useContext(AuthContext);

  // Timer countdown for resending OTP
  React.useEffect(() => {
    let interval = null;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'READY') {
        setCaptchaStatus('Performing security verification...');
      } else if (data.type === 'SMS_SENT') {
        setCaptchaStatus('SMS OTP sent to Admin!');
        setSmsSent(true);
        if (data.verificationId) {
          setVerificationId(data.verificationId);
          if (otpSession && registerFirebaseSession) {
            registerFirebaseSession(otpSession, data.verificationId);
          }
        }
        setTimeout(() => {
          setShowCaptchaModal(false);
        }, 1200);
      } else if (data.type === 'ERROR') {
        console.warn('Firebase Phone Auth SMS notice:', data.message, data.code);
        setCaptchaStatus('Admin alerted via push notification. Enter OTP to proceed.');
        setTimeout(() => {
          setShowCaptchaModal(false);
        }, 1200);
      }
    } catch (e) {
      console.log('WebView message error:', e);
    }
  };

  const handleSubmit = async () => {
    if (isSignup) {
      const success = await signup(username, password, secretKey);
      if (success) {
        setIsSignup(false);
        setPassword('');
        setSecretKey('');
      }
    } else {
      const result = await login(username, password);
      if (result && result.requireOtp) {
        setOtpSession(result.otpSession);
        setUserHint(result.userHint || username);
        setOtpStep(true);
        setOtpCode('');
        setResendTimer(30);

        if (result.adminPhones && result.adminPhones.length > 0) {
          const targetPhone = result.adminPhones[0];
          setAdminPhone(targetPhone);
          setCaptchaStatus('Sending SMS to Admin via Firebase...');
          setCaptchaUrl(`https://aadarshila.dummysite.cloud/firebase-phone-auth.html?phone=${encodeURIComponent(targetPhone)}&session=${encodeURIComponent(result.otpSession)}&ts=${Date.now()}`);
          setShowCaptchaModal(true);
        }
      }
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode.trim()) {
      return;
    }
    await verifyOtp(otpSession, otpCode.trim(), verificationId);
  };

  const handleResendOtp = async () => {
    if (resendTimer > 0 || isResending) return;
    setIsResending(true);
    const res = await resendOtp(otpSession);
    if (res && res.success) {
      const activeSession = res.otpSession || otpSession;
      if (res.otpSession) {
        setOtpSession(res.otpSession);
      }
      setResendTimer(30);

      const targetPhone = (res.adminPhones && res.adminPhones.length > 0) ? res.adminPhones[0] : adminPhone;
      if (targetPhone) {
        setAdminPhone(targetPhone);
        setCaptchaStatus('Resending SMS to Admin via Firebase...');
        setCaptchaUrl(`https://aadarshila.dummysite.cloud/firebase-phone-auth.html?phone=${encodeURIComponent(targetPhone)}&session=${encodeURIComponent(activeSession)}&ts=${Date.now()}`);
        setShowCaptchaModal(true);
      }
    }
    setIsResending(false);
  };

  const handleBackToLogin = () => {
    setOtpStep(false);
    setOtpCode('');
    setOtpSession('');
    setShowCaptchaModal(false);
    setSmsSent(false);
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          
          {/* Brand Identity Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Image 
                source={require('../../assets/images/app-logo.png')} 
                style={styles.logoImage} 
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brandTitle}>GOPAL AGRAWAL ENT.</Text>
            <Text style={styles.brandSubtitle}>Enterprise Fleet Management System</Text>
          </View>

          {/* OTP Verification Card */}
          {otpStep ? (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.otpBadgeContainer}>
                  <MaterialCommunityIcons name="shield-lock" size={28} color="#006C49" />
                </View>
                <Text style={styles.welcomeTitle}>Admin Authorization</Text>
                <Text style={styles.welcomeSubtitle}>
                  A 6-digit OTP has been sent to the Admin for <Text style={{ fontWeight: '700', color: '#091426' }}>{userHint}</Text>.
                </Text>
              </View>

              <View style={styles.infoBanner}>
                <MaterialCommunityIcons name="information-outline" size={18} color="#006C49" style={{ marginRight: 6 }} />
                <Text style={styles.infoBannerText}>
                  Please ask your Admin to share the OTP to complete login.
                </Text>
              </View>

              {/* Cellular SMS Dispatch Confirmation */}
              {adminPhone ? (
                <View style={[styles.smsStatusBanner, smsSent ? styles.smsSuccessBanner : styles.smsPendingBanner]}>
                  <MaterialCommunityIcons 
                    name={smsSent ? "cellphone-check" : "cellphone-arrow-down"} 
                    size={18} 
                    color={smsSent ? "#006C49" : "#0284C7"} 
                    style={{ marginRight: 6 }} 
                  />
                  <Text style={[styles.smsStatusText, smsSent ? { color: "#006C49" } : { color: "#0369A1" }]}>
                    {smsSent 
                      ? `SMS OTP dispatched to Admin (+91 ${adminPhone.replace(/^\+91/, '')})`
                      : `Sending SMS to Admin (+91 ${adminPhone.replace(/^\+91/, '')})...`}
                  </Text>
                </View>
              ) : null}

              <View style={styles.form}>
                {/* OTP Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>ENTER 6-DIGIT OTP</Text>
                  <View style={[styles.inputWrapper, { borderColor: '#006C49', borderWidth: 1.5 }]}>
                    <MaterialCommunityIcons name="key-wireless" size={22} color="#006C49" style={styles.inputIcon} />
                    <TextInput
                      style={[styles.input, styles.otpInputText]}
                      placeholder="• • • • • •"
                      placeholderTextColor="#94A3B8"
                      value={otpCode}
                      onChangeText={(val) => setOtpCode(val.replace(/[^0-9]/g, '').slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      autoFocus
                    />
                  </View>
                </View>

                {/* Verify Button */}
                <TouchableOpacity 
                  style={[styles.loginButton, (!otpCode || otpCode.length < 6) && { opacity: 0.8 }]} 
                  onPress={handleVerifyOtp}
                  disabled={isLoading || otpCode.length < 4}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View style={styles.buttonInner}>
                      <Text style={styles.loginButtonText}>VERIFY & LOG IN</Text>
                      <MaterialCommunityIcons name="check-circle-outline" size={20} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Resend OTP */}
                <TouchableOpacity 
                  onPress={handleResendOtp} 
                  disabled={resendTimer > 0 || isResending}
                  style={[styles.toggleMode, { marginTop: 16 }]}
                >
                  <Text style={[styles.toggleModeText, resendTimer > 0 && { color: '#94A3B8' }]}>
                    {isResending ? "Resending..." : resendTimer > 0 ? `Resend OTP to Admin in ${resendTimer}s` : "Resend OTP to Admin"}
                  </Text>
                </TouchableOpacity>

                {/* Back to Login */}
                <TouchableOpacity onPress={handleBackToLogin} style={{ marginTop: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#45474C', fontSize: 13, fontWeight: '600' }}>
                    ← Back to Login
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Standard Login / Signup Card */
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.welcomeTitle}>Welcome Back</Text>
                <Text style={styles.welcomeSubtitle}>Access your operational dashboard</Text>
              </View>

              <View style={styles.form}>
                {/* Username Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>USERNAME</Text>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="account-outline" size={20} color="#75777D" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="Username"
                      placeholderTextColor="#75777D"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                    />
                  </View>
                </View>

                {/* Password Input */}
                <View style={styles.inputGroup}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>PASSWORD</Text>
                  </View>
                  <View style={styles.inputWrapper}>
                    <MaterialCommunityIcons name="lock-outline" size={20} color="#75777D" style={styles.inputIcon} />
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="#75777D"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry
                    />
                  </View>
                </View>

                {/* Admin Secret Key (for Signup) */}
                {isSignup && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>ADMIN SECRET PASSWORD</Text>
                    <View style={styles.inputWrapper}>
                      <MaterialCommunityIcons name="shield-key-outline" size={20} color="#75777D" style={styles.inputIcon} />
                      <TextInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#75777D"
                        value={secretKey}
                        onChangeText={setSecretKey}
                        secureTextEntry
                      />
                    </View>
                  </View>
                )}

                {/* Submit Button */}
                <TouchableOpacity 
                  style={styles.loginButton} 
                  onPress={handleSubmit}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <View style={styles.buttonInner}>
                      <Text style={styles.loginButtonText}>
                        {isSignup ? "SIGN UP" : "LOG IN"}
                      </Text>
                      <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity onPress={() => setIsSignup(!isSignup)} style={styles.toggleMode}>
                  <Text style={styles.toggleModeText}>
                    {isSignup ? "Already have an account? Log In" : "Create Admin Account"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Footer */}
          <View style={{ alignItems: 'center', marginTop: 20 }}>
            <Text style={{ color: '#C5C6CD', fontSize: 10 }}>Enterprise Access Portal</Text>
            <TouchableOpacity
              onPress={async () => {
                try {
                  if (!Updates.isEnabled) {
                    Alert.alert(
                      'OTA Status',
                      'Updates are disabled in this environment.\nRuntime: ' + (Updates.runtimeVersion || 'N/A') + '\nChannel: ' + (Updates.channel || 'N/A')
                    );
                    return;
                  }

                  const check = await Updates.checkForUpdateAsync();
                  if (check.isAvailable) {
                    Alert.alert('Update Found', 'Downloading the latest update...', [
                      {
                        text: 'Apply & Restart',
                        onPress: async () => {
                          try {
                            await Updates.fetchUpdateAsync();
                            await Updates.reloadAsync();
                          } catch (fetchErr) {
                            Alert.alert('Download Error', fetchErr.message || String(fetchErr));
                          }
                        }
                      }
                    ]);
                  } else {
                    Alert.alert(
                      'App Up to Date',
                      'You are on the latest update.\n\nChannel: ' + (Updates.channel || 'production') + '\nRuntime: ' + (Updates.runtimeVersion || '1.0.0') + '\nUpdate ID: ' + (Updates.updateId ? Updates.updateId.slice(0, 8) : 'Embedded')
                    );
                  }
                } catch (e) {
                  Alert.alert(
                    'OTA Update Check',
                    (e.message || String(e)) + '\n\nRuntime: ' + (Updates.runtimeVersion || 'N/A') + '\nChannel: ' + (Updates.channel || 'N/A')
                  );
                }
              }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}
              activeOpacity={0.7}
            >
              <Text style={styles.centerVersionTag}>App Version: v5.2</Text>
              <MaterialCommunityIcons name="refresh" size={12} color="#94A3B8" />
            </TouchableOpacity>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Firebase Phone Auth reCAPTCHA Verification Modal */}
      <Modal
        visible={showCaptchaModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowCaptchaModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialCommunityIcons name="shield-check" size={22} color="#006C49" style={{ marginRight: 8 }} />
                <Text style={styles.modalTitle}>Security Verification</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCaptchaModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalSubtitle}>
              {captchaStatus || 'Sending cellular SMS to Admin via Firebase...'}
            </Text>
            <View style={styles.webViewWrapper}>
              {captchaUrl ? (
                <WebView
                  source={{ uri: captchaUrl }}
                  onMessage={handleWebViewMessage}
                  javaScriptEnabled={true}
                  domStorageEnabled={true}
                  startInLoadingState={true}
                  style={{ flex: 1, backgroundColor: 'transparent' }}
                />
              ) : null}
            </View>
            <TouchableOpacity 
              onPress={() => setShowCaptchaModal(false)}
              style={{ marginTop: 14, paddingVertical: 10, alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10 }}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#006C49' }}>Enter OTP Directly ➔</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 88,
    height: 88,
    backgroundColor: '#023c69',
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#091426',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  logoImage: {
    width: 88,
    height: 88,
    borderRadius: 24,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '800', // Manrope ExtraBold
    color: '#091426',
    letterSpacing: -0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: '#45474C',
    fontWeight: '500',
    marginTop: 4,
  },
  card: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 32,
    borderWidth: 1,
    borderColor: 'rgba(197, 198, 205, 0.2)',
    // Editorial shadow
    shadowColor: '#091426',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 40,
    elevation: 8,
  },
  cardHeader: {
    marginBottom: 32,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#091426',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#45474C',
    marginTop: 4,
  },
  form: {
    width: '100%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: '#091426',
    letterSpacing: 1,
    marginBottom: 6,
    marginLeft: 4,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F4F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#191C1E',
  },
  loginButton: {
    backgroundColor: '#006C49',
    borderRadius: 12,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    // Editorial shadow
    shadowColor: '#006C49',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 2,
    marginRight: 8,
  },
  toggleMode: {
    marginTop: 20,
    alignItems: 'center',
  },
  toggleModeText: {
    color: '#006C49',
    fontWeight: '700',
    fontSize: 13,
  },
  centerVersionTag: {
    marginTop: 6,
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textAlign: 'center',
  },
  otpBadgeContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E6F4EA',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  otpInputText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 8,
    color: '#006C49',
    textAlign: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 12,
    color: '#166534',
    lineHeight: 18,
    fontWeight: '500',
  },
  smsStatusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  smsSuccessBanner: {
    backgroundColor: '#ECFDF5',
    borderColor: '#6EE7B7',
  },
  smsPendingBanner: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  smsStatusText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 20, 38, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#091426',
  },
  modalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 16,
  },
  webViewWrapper: {
    height: 220,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  }
});
