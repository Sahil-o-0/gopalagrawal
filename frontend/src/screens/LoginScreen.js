import React, { useContext, useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  Image,
  StatusBar
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';

export default function LoginScreen() {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const { login, signup, isLoading } = useContext(AuthContext);

  const handleSubmit = async () => {
    if (isSignup) {
      const success = await signup(username, password, secretKey);
      if (success) {
        setIsSignup(false);
        setPassword('');
        setSecretKey('');
      }
    } else {
      login(username, password);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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
                source={require('../../assets/images/gopal.jpeg')} 
                style={styles.logoImage} 
                resizeMode="cover"
              />
            </View>
            <Text style={styles.brandTitle}>GOPAL AGRAWAL ENT.</Text>
            <Text style={styles.brandSubtitle}>Enterprise Fleet Management System</Text>
          </View>

          {/* Login Card */}
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
                  <Text style={styles.label}>ADMIN PASSWORD</Text>
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

          {/* Footer removed mapping user request */}
          <Text style={{ marginTop: 20, color: '#C5C6CD', fontSize: 10 }}>Enterprise Access Portal</Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 10 : 10
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
    width: 64,
    height: 64,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    // Editorial shadow
    shadowColor: '#091426',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 4,
  },
  logoImage: {
    width: '100%',
    height: '100%',
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
  }
});
