import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, StatusBar, Platform, Alert, Image
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import SiteSelector from '../components/SiteSelector';
import ErrorCard from '../components/ErrorCard';
import DraggableDashboardGrid from '../components/DraggableDashboardGrid';
import { checkAndTriggerAutomatedAlerts } from '../context/NotificationService';

const getNavCards = (userRole) => [
  {
    id: 'attendance',
    title: 'Attendance',
    subtitle: 'Mark and track employee attendance',
    icon: '📅',
    color: '#EFF6FF',
    accent: '#3B82F6',
    screen: userRole === 'STAFF' ? 'LogBook' : 'Workforce',
    params: { initialTab: userRole === 'MANAGER' ? 'attendance' : 'hr' },
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    id: 'approvals',
    title: 'Approval Workflow',
    subtitle: 'Approve or reject advances & leaves',
    icon: '📋',
    color: '#F0FDF4',
    accent: '#16A34A',
    screen: 'ApprovalCenter',
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    id: 'ledger',
    title: 'Daily Ledger',
    subtitle: 'Income, expenses & financial summary',
    icon: '📒',
    color: '#F0FDF4',
    accent: '#22C55E',
    screen: 'DailyLedger',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'logbook',
    title: 'Log Book',
    subtitle: 'Trip logs & operational logistics',
    icon: '🚛',
    color: '#FFF7ED',
    accent: '#F97316',
    screen: 'LogBook',
    params: { initialTab: 'trips' },
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    id: 'machinery',
    title: 'Machinery Logs',
    subtitle: 'Track equipment hours & fuel usage',
    icon: '🚜',
    color: '#FEFCE8',
    accent: '#CA8A04',
    screen: 'Machinery',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'users',
    title: 'User Management',
    subtitle: 'Manage team, staff & user roles',
    icon: '👤',
    color: '#EEF2F6',
    accent: '#64748B',
    screen: 'Workforce',
    params: { initialTab: 'users' },
    roles: ['ADMIN'],
  },
  {
    id: 'compliance',
    title: 'EMI & Compliance',
    subtitle: 'Track EMIs, insurance & fitness expiry',
    icon: '🛡️',
    color: '#FEF2F2',
    accent: '#EF4444',
    screen: 'ComplianceVault',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'tyres',
    title: 'Tyre Management',
    subtitle: 'Track purchase dates, serials & multi-axle tyres',
    icon: '🛞',
    color: '#F0FDF4',
    accent: '#0D9488',
    screen: 'TyreManagement',
    roles: ['ADMIN', 'MANAGER'],
  },
  {
    id: 'financial_reports',
    title: 'Financial Reports',
    subtitle: 'Net Profit & 1-click PDF reports',
    icon: '📊',
    color: '#F0F9FF',
    accent: '#0284C7',
    screen: 'FinancialReport',
    roles: ['ADMIN'],
  },
  {
    id: 'sites',
    title: 'Site Management',
    subtitle: 'Add & manage multiple sites',
    icon: '🏗️',
    color: '#F5F3FF',
    accent: '#8B5CF6',
    screen: 'SiteManagement',
    roles: ['ADMIN', 'MANAGER'],
  },
];

export default function HomeScreen({ navigation }) {
  const { user, userToken, logout } = useContext(AuthContext);
  const { selectedSite, loading: siteLoading, error: siteError, fetchSites } = useSite();
  const [alertsSummary, setAlertsSummary] = useState(null);
  const scrollViewRef = useRef(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    if (userToken && (user?.role === 'ADMIN' || user?.role === 'MANAGER')) {
      checkAndTriggerAutomatedAlerts(userToken, selectedSite?.id).then(data => {
        setAlertsSummary(data);
      }).catch(() => {});
    }
  }, [userToken, selectedSite?.id]);

  const allowedCards = getNavCards(user?.role).filter(card => card.roles.includes(user?.role));
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20);

  const handleCardPress = (card) => {
    if (!selectedSite && card.id !== 'sites') {
      Alert.alert('Active Site Required', 'Please select an active site from the dropdown before accessing this section.');
      return;
    }
    navigation.navigate(card.screen, card.params);
  };

  return (
    <View style={[styles.safe, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Image 
            source={require('../../assets/images/app-logo.png')} 
            style={styles.headerLogo} 
            resizeMode="contain"
          />
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.username}>{user?.full_name || user?.username}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={styles.roleTag}>{user?.role}</Text>
              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '800' }}>• v6.9</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          scrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
      >
        {/* Site Selector Section */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACTIVE SITE</Text>

          {siteError ? (
            <ErrorCard
              title="Failed to load sites"
              message={siteError}
              onRetry={fetchSites}
            />
          ) : siteLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color="#3B82F6" />
              <Text style={styles.loadingText}>Loading sites…</Text>
            </View>
          ) : (
            <SiteSelector />
          )}
        </View>

        {/* Automated Alerts Banner (Due in 2 days) */}
        {alertsSummary && alertsSummary.alerts && alertsSummary.alerts.length > 0 && (
          <TouchableOpacity 
            style={{
              backgroundColor: alertsSummary.due_in_2_days_count > 0 ? '#FEF2F2' : '#FFFBEB',
              borderWidth: 1,
              borderColor: alertsSummary.due_in_2_days_count > 0 ? '#FECACA' : '#FDE68A',
              borderRadius: 12,
              padding: 12,
              marginHorizontal: 16,
              marginTop: 16,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
            onPress={() => {
              if (user?.role === 'ADMIN') {
                navigation.navigate('FinancialReport');
              } else {
                navigation.navigate('ComplianceVault');
              }
            }}
            activeOpacity={0.8}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <MaterialCommunityIcons 
                name={alertsSummary.due_in_2_days_count > 0 ? "bell-alert" : "calendar-clock"} 
                size={22} 
                color={alertsSummary.due_in_2_days_count > 0 ? "#DC2626" : "#D97706"} 
              />
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: alertsSummary.due_in_2_days_count > 0 ? '#991B1B' : '#92400E' }}>
                  {alertsSummary.due_in_2_days_count > 0 
                    ? `⚠️ ${alertsSummary.due_in_2_days_count} Payment / EMI Due in 2 Days!` 
                    : `Upcoming Compliance Reminders (${alertsSummary.total_alerts})`}
                </Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                  Tap to view Financial Dashboard & automated alerts
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
          </TouchableOpacity>
        )}

        {/* Interactive 2x2 Draggable Grid of Pages */}
        <DraggableDashboardGrid
          items={allowedCards}
          onItemPress={handleCardPress}
          isLockedItem={(card) => !selectedSite && card.id !== 'sites'}
          storageKey={user?.role || 'default'}
          scrollViewRef={scrollViewRef}
          scrollYRef={scrollYRef}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerLogo: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  greeting: {
    fontSize: 13,
    color: '#6B7280',
  },
  username: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  roleTag: {
    fontSize: 11,
    color: '#3B82F6',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontWeight: '700',
    fontSize: 13,
  },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  section: {
    paddingHorizontal: 16,
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 14,
  },
});

