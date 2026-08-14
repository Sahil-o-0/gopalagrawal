import React, { useContext } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { SiteProvider } from './src/context/SiteContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <SiteProvider>
        <StatusBar style="dark" />
        <NavigationContainer>
          <AppNavigator />
        </NavigationContainer>
      </SiteProvider>
    </AuthProvider>
  );
}
