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

// React 19 / Modern RN JSX Runtime interceptor for universal font capping
try {
  const JsxRuntime = require('react/jsx-runtime');
  const origJsx = JsxRuntime.jsx;
  const origJsxs = JsxRuntime.jsxs;

  const wrapJsx = (orig) => {
    if (!orig) return orig;
    return function (type, config, maybeKey) {
      if (
        config &&
        (type === Text ||
          type === TextInput ||
          type?.displayName === 'Text' ||
          type?.displayName === 'TextInput' ||
          type?.name === 'Text' ||
          type?.name === 'TextInput')
      ) {
        if (config.maxFontSizeMultiplier === undefined) {
          config = { ...config, maxFontSizeMultiplier: 1.15 };
        }
      }
      return orig(type, config, maybeKey);
    };
  };

  if (origJsx) JsxRuntime.jsx = wrapJsx(origJsx);
  if (origJsxs) JsxRuntime.jsxs = wrapJsx(origJsxs);

  const JsxDevRuntime = require('react/jsx-dev-runtime');
  if (JsxDevRuntime && JsxDevRuntime.jsxDEV) {
    const origJsxDev = JsxDevRuntime.jsxDEV;
    JsxDevRuntime.jsxDEV = function (type, props, key, isStaticChildren, source, self) {
      if (
        props &&
        (type === Text ||
          type === TextInput ||
          type?.displayName === 'Text' ||
          type?.displayName === 'TextInput' ||
          type?.name === 'Text' ||
          type?.name === 'TextInput')
      ) {
        if (props.maxFontSizeMultiplier === undefined) {
          props = { ...props, maxFontSizeMultiplier: 1.15 };
        }
      }
      return origJsxDev(type, props, key, isStaticChildren, source, self);
    };
  }
} catch (e) {
  // Ignore in environments where jsx-runtime isn't configurable
}

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
