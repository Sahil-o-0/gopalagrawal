import React, { createContext, useState, useEffect } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';

/**
 * Safely parse a fetch Response as JSON.
 * Returns null if the server returns HTML (e.g. nginx 404/502) instead of JSON.
 */
async function safeJson(response) {
  const ct = response.headers.get('content-type') || '';
  if (!ct.includes('application/json')) return null;
  try {
    return await response.json();
  } catch (_) {
    return null;
  }
}

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userToken, setUserToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true); // true while bootstrapping

  // Restore session from AsyncStorage on app launch
  useEffect(() => {
    const bootstrapToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('userToken');
        const storedUser = await AsyncStorage.getItem('userData');
        if (storedToken && storedUser) {
          setUserToken(storedToken);
          setUser(JSON.parse(storedUser));
          import('./NotificationService').then(({ registerForPushNotificationsAsync, clearPendingLocalNotifications }) => {
            registerForPushNotificationsAsync(storedToken);
            clearPendingLocalNotifications();
          }).catch(() => {});
        }
      } catch (e) {
        console.log('Failed to restore session:', e);
      } finally {
        setIsLoading(false);
      }
    };
    bootstrapToken();
  }, []);

  const login = async (username, password) => {
    setIsLoading(true);
    try {
      const body = new URLSearchParams({
        username: username,
        password: password
      }).toString();

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'bypass-tunnel-reminder': 'true'
        },
        body: body
      });

      const data = await safeJson(response);
      
      if (response.ok && data) {
        if (data.require_otp) {
          // OTP verification step required for non-admin user
          return {
            requireOtp: true,
            otpSession: data.otp_session,
            userHint: data.user_hint || username,
            adminPhones: data.admin_phones || [],
            message: data.message
          };
        }

        // Direct login (Admin)
        await AsyncStorage.setItem('userToken', data.access_token);
        await AsyncStorage.setItem('userData', JSON.stringify(data.user));
        setUserToken(data.access_token);
        setUser(data.user);
        // Register push token for background server push notifications
        import('./NotificationService').then(({ registerForPushNotificationsAsync, clearPendingLocalNotifications }) => {
          registerForPushNotificationsAsync(data.access_token);
          clearPendingLocalNotifications();
        }).catch(() => {});
        return { success: true, requireOtp: false };
      } else if (!response.ok) {
        let msg = `Server error (${response.status}). Please try again.`;
        if (typeof data?.detail === 'string') {
          msg = data.detail;
        } else if (Array.isArray(data?.detail)) {
          msg = data.detail.map(d => d.msg || JSON.stringify(d)).join('\n');
        } else if (data?.message) {
          msg = String(data.message);
        }
        Alert.alert('Login Failed', msg);
        return { success: false, error: msg };
      } else {
        Alert.alert('Login Failed', 'Unexpected response from server. Please try again.');
        return { success: false, error: 'Unexpected response' };
      }
    } catch (e) {
      console.log(e);
      Alert.alert('Network Error', `Could not connect to: ${API_BASE_URL}\n\nError details: ${e.message || e}`);
      return { success: false, error: e.message };
    } finally {
      setIsLoading(false);
    }
  };

  const registerFirebaseSession = async (otpSession, verificationId) => {
    try {
      await fetch(`${API_BASE_URL}/auth/register-firebase-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify({
          otp_session: otpSession,
          verification_id: verificationId
        })
      });
    } catch (e) {
      console.log('Register firebase session error:', e);
    }
  };

  const verifyOtp = async (otpSession, otp, verificationId = null) => {
    setIsLoading(true);
    try {
      const payload = {
        otp_session: otpSession,
        otp: otp.trim()
      };
      if (verificationId) {
        payload.verification_id = verificationId;
      }

      const response = await fetch(`${API_BASE_URL}/auth/verify-login-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify(payload)
      });

      const data = await safeJson(response);

      if (response.ok && data && data.access_token) {
        await AsyncStorage.setItem('userToken', data.access_token);
        await AsyncStorage.setItem('userData', JSON.stringify(data.user));
        setUserToken(data.access_token);
        setUser(data.user);
        import('./NotificationService').then(({ registerForPushNotificationsAsync, clearPendingLocalNotifications }) => {
          registerForPushNotificationsAsync(data.access_token);
          clearPendingLocalNotifications();
        }).catch(() => {});
        return { success: true };
      } else {
        const msg = data?.detail || `Invalid OTP (${response.status}). Please try again.`;
        Alert.alert('Verification Failed', msg);
        return { success: false, error: msg };
      }
    } catch (e) {
      console.log(e);
      Alert.alert('Network Error', `Could not verify OTP: ${e.message || e}`);
      return { success: false, error: e.message };
    } finally {
      setIsLoading(false);
    }
  };

  const resendOtp = async (otpSession) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/resend-login-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify({
          otp_session: otpSession
        })
      });

      const data = await safeJson(response);
      if (response.ok && data) {
        Alert.alert('OTP Dispatched', data.message || 'A new OTP has been sent to the Admin.');
        return { success: true, otpSession: data.otp_session, adminPhones: data.admin_phones || [] };
      } else {
        const msg = data?.detail || 'Failed to resend OTP.';
        Alert.alert('Resend Failed', msg);
        return { success: false, error: msg };
      }
    } catch (e) {
      Alert.alert('Network Error', `Could not resend OTP: ${e.message || e}`);
      return { success: false, error: e.message };
    }
  };

  const signup = async (username, password, secretKey) => {
    setIsLoading(true);
    try {
      const body = new URLSearchParams({
        username: username,
        password: password,
        secret_key: secretKey
      }).toString();

      const response = await fetch(`${API_BASE_URL}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      });

      const data = await safeJson(response);
      
      if (response.ok) {
        Alert.alert('Success', 'Admin Account Created! Please Login.');
      } else {
        const msg = data?.detail || `Server error (${response.status}). Could not create account.`;
        Alert.alert('Signup Failed', msg);
      }
      return response.ok;
    } catch (e) {
      console.log(e);
      Alert.alert('Network Error', 'Could not connect to the server');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
    } catch (e) {
      console.log('Failed to clear session:', e);
    }
    setUserToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ login, verifyOtp, resendOtp, registerFirebaseSession, signup, logout, isLoading, userToken, user }}>
      {children}
    </AuthContext.Provider>
  );
};
