import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { Text, TextInput } from 'react-native';
import * as Updates from 'expo-updates';
import { AuthProvider } from './src/context/AuthContext';
import { SiteProvider } from './src/context/SiteContext';
import AppNavigator from './src/navigation/AppNavigator';

// Protect app layouts against extreme OS-level font scaling (e.g. Android Large/Largest display settings)
if (Text.defaultProps == null) Text.defaultProps = {};
Text.defaultProps.maxFontSizeMultiplier = 1.15;

if (TextInput.defaultProps == null) TextInput.defaultProps = {};
TextInput.defaultProps.maxFontSizeMultiplier = 1.15;

export default function App() {
  useEffect(() => {
    async function checkForOTAUpdate() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        // Dev client or offline
      }
    }
    if (!__DEV__) {
      checkForOTAUpdate();
    }
  }, []);

  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <AuthProvider>
        <SiteProvider>
          <StatusBar style="dark" />
          <NavigationContainer>
            <AppNavigator />
          </NavigationContainer>
        </SiteProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
