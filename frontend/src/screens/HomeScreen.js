import React, { useContext } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, SafeAreaView, StatusBar, Platform
} from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import SiteSelector from '../components/SiteSelector';
import ErrorCard from '../components/ErrorCard';

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
    id: 'ledger',
    title: 'Accounting (Daily Ledger)',
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
    subtitle: 'Trip logs, vehicle EMIs & logistics',
    icon: '🚛',
    color: '#FFF7ED',
    accent: '#F97316',
    screen: 'LogBook',
    params: { initialTab: 'trips' },
    roles: ['ADMIN', 'MANAGER', 'STAFF'],
  },
  {
    id: 'users',
    title: 'Users',
    subtitle: 'Manage team and user roles',
    icon: '👤',
    color: '#EEF2F6',
    accent: '#64748B',
    screen: 'Workforce',
    params: { initialTab: 'users' },
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
  const { user, logout } = useContext(AuthContext);
  const { selectedSite, loading: siteLoading, error: siteError, fetchSites } = useSite();

  const allowedCards = getNavCards(user?.role).filter(card => card.roles.includes(user?.role));

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.username}>{user?.full_name || user?.username}</Text>
          <Text style={styles.roleTag}>{user?.role}</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
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

        {/* Navigation Cards */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>NAVIGATE TO</Text>
          {allowedCards.map(card => (
            <TouchableOpacity
              key={card.id}
              style={[styles.card, { backgroundColor: card.color, borderLeftColor: card.accent }]}
              onPress={() => navigation.navigate(card.screen, card.params)}
              activeOpacity={0.75}
              disabled={!selectedSite && card.id !== 'sites'}
            >
              <Text style={styles.cardIcon}>{card.icon}</Text>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, { color: card.accent }]}>{card.title}</Text>
                <Text style={styles.cardSubtitle}>{card.subtitle}</Text>
              </View>
              {!selectedSite && card.id !== 'sites' && (
                <Text style={styles.cardLock}>🔒</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0,
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 18,
    borderLeftWidth: 5,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  cardText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 3,
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  cardLock: {
    fontSize: 16,
    marginLeft: 8,
    opacity: 0.4,
  },
});
