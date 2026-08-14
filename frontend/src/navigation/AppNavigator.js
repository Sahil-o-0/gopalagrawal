import React, { useContext } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { AuthContext } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import AdminDashboard from '../screens/AdminDashboard';
import ManagerDashboard from '../screens/ManagerDashboard';
import StaffDashboard from '../screens/StaffDashboard';
import DailyLedgerScreen from '../screens/DailyLedgerScreen';
import SiteManagementScreen from '../screens/SiteManagementScreen';
import UserProfileScreen from '../screens/UserProfileScreen';
import UserLedgerScreen from '../screens/UserLedgerScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { user, userToken } = useContext(AuthContext);

  // Unauthenticated — show Login
  if (!userToken) {
    return (
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Login" component={LoginScreen} />
      </Stack.Navigator>
    );
  }

  // Authenticated — route through HomeScreen first, then role-specific dashboards
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Universal Home (site selection + nav cards) */}
      <Stack.Screen name="Home" component={HomeScreen} />

      {/* Site Management — accessible to ADMIN / MANAGER */}
      <Stack.Screen name="SiteManagement" component={SiteManagementScreen} />

      {/* Daily Ledger — ADMIN */}
      <Stack.Screen name="DailyLedger" component={DailyLedgerScreen} />

      {/* Standalone full-screen pages for HR details */}
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="UserLedger" component={UserLedgerScreen} />

      {/* Role-specific dashboards reachable from Home cards */}
      {user?.role === 'ADMIN' && (
        <>
          <Stack.Screen name="LogBook" component={AdminDashboard} />
          <Stack.Screen name="Workforce" component={AdminDashboard} />
        </>
      )}
      {user?.role === 'MANAGER' && (
        <>
          <Stack.Screen name="LogBook" component={ManagerDashboard} />
          <Stack.Screen name="Workforce" component={ManagerDashboard} />
          <Stack.Screen name="DailyLedger" component={DailyLedgerScreen} />
        </>
      )}
      {user?.role === 'STAFF' && (
        <Stack.Screen name="LogBook" component={StaffDashboard} />
      )}
    </Stack.Navigator>
  );
}
