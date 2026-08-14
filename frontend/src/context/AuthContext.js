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
  const [isLoading, setIsLoading] = useState(false);

  // In a real application, we would use AsyncStorage from react-native-async-storage
  // to persist the token, but for now we'll hold it in memory.
  const login = async (username, password) => {
    setIsLoading(true);
    try {
      // Create x-www-form-urlencoded body for OAuth2
      const body = new URLSearchParams({
        username: username,
        password: password
      }).toString();

      // Replace 10.0.2.2 with local IP for Android emulator
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body
      });

      const data = await safeJson(response);
      
      if (response.ok && data) {
        setUserToken(data.access_token);
        setUser(data.user);
      } else if (!response.ok) {
        const msg = data?.detail || `Server error (${response.status}). Please try again.`;
        Alert.alert('Login Failed', msg);
      } else {
        Alert.alert('Login Failed', 'Unexpected response from server. Please try again.');
      }
    } catch (e) {
      console.log(e);
      Alert.alert('Network Error', `Could not connect to: ${API_BASE_URL}\n\nError details: ${e.message || e}`);
    }
    setIsLoading(false);
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

  const logout = () => {
    setUserToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ login, signup, logout, isLoading, userToken, user }}>
      {children}
    </AuthContext.Provider>
  );
};
