import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, StatusBar, Platform, Alert, Image, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import SiteSelector from '../components/SiteSelector';
import ErrorCard from '../components/ErrorCard';
import DraggableDashboardGrid from '../components/DraggableDashboardGrid';
import { checkAndTriggerAutomatedAlerts } from '../context/NotificationService';
import { API_BASE_URL } from '../config';

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
  const { user, userToken, logout, deleteAccount } = useContext(AuthContext);
  const { selectedSite, loading: siteLoading, error: siteError, fetchSites } = useSite();
  const [alertsSummary, setAlertsSummary] = useState(null);
  const [showBellModal, setShowBellModal] = useState(false);
  const [pendingOtps, setPendingOtps] = useState([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState([]);
  const [loadingBell, setLoadingBell] = useState(false);
  const scrollViewRef = useRef(null);
  const scrollYRef = useRef(0);

  useEffect(() => {
    AsyncStorage.getItem('dismissedBellAlertIds_v1')
      .then((val) => {
        if (val) {
          const parsed = JSON.parse(val);
          if (Array.isArray(parsed)) setDismissedAlertIds(parsed);
        }
      })
      .catch(() => {});
  }, []);

  const fetchBellNotifications = useCallback(async (silent = false) => {
    if (!userToken) return;
    if (!silent) setLoadingBell(true);
    try {
      const headers = {
        'Authorization': `Bearer ${userToken}`,
        'bypass-tunnel-reminder': 'true',
      };
      // 1. Fetch Staff Login OTPs for Admin
      if (user?.role === 'ADMIN') {
        const otpRes = await fetch(`${API_BASE_URL}/auth/admin/pending-otps`, { headers });
        if (otpRes.ok) {
          const otpData = await otpRes.json();
          if (Array.isArray(otpData)) {
            setPendingOtps(otpData);
          }
        }
      }
      // 2. Fetch Automated Compliance & EMI Alerts for Admin / Manager
      if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
        const siteQuery = selectedSite?.id ? `?site_id=${selectedSite.id}` : '';
        const alertRes = await fetch(`${API_BASE_URL}/reports/automated-alerts${siteQuery}`, { headers });
        if (alertRes.ok) {
          const alertData = await alertRes.json();
          setAlertsSummary(alertData);
        }
      }
    } catch (e) {
      // ignore background poll errors
    } finally {
      if (!silent) setLoadingBell(false);
    }
  }, [userToken, user?.role, selectedSite?.id]);

  useEffect(() => {
    if (userToken && (user?.role === 'ADMIN' || user?.role === 'MANAGER')) {
      checkAndTriggerAutomatedAlerts(userToken, selectedSite?.id).catch(() => {});
      fetchBellNotifications(true);
      const interval = setInterval(() => {
        fetchBellNotifications(true);
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [userToken, user?.role, selectedSite?.id, fetchBellNotifications]);

  useEffect(() => {
    if (showBellModal && user?.role === 'ADMIN') {
      fetchBellNotifications(false);
      const fastPoll = setInterval(() => {
        fetchBellNotifications(true);
      }, 5000);
      return () => clearInterval(fastPoll);
    }
  }, [showBellModal, user?.role, fetchBellNotifications]);

  const nowUtcMs = Date.now();
  const activeOtpCount = pendingOtps.filter(otp => {
    if (otp.is_used) return false;
    const expStr = otp.expires_at ? (otp.expires_at.endsWith('Z') ? otp.expires_at : `${otp.expires_at}Z`) : null;
    return expStr ? new Date(expStr).getTime() > nowUtcMs : true;
  }).length;
  const visibleComplianceAlerts = (alertsSummary?.alerts || []).filter(
    (a, idx) => !dismissedAlertIds.includes(a.id || `${a.vehicle_number}_${a.type}_${idx}`)
  );
  const totalAlertCount = activeOtpCount + visibleComplianceAlerts.length;
  const hasAnyBellHistory = pendingOtps.length > 0 || visibleComplianceAlerts.length > 0;

  const handleMarkAllAsRead = async () => {
    try {
      setLoadingBell(true);
      if (user?.role === 'ADMIN' && userToken) {
        await fetch(`${API_BASE_URL}/auth/admin/clear-otps`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${userToken}`,
            'bypass-tunnel-reminder': 'true',
          },
        }).catch(() => {});
        setPendingOtps([]);
      }
      const allIds = (alertsSummary?.alerts || []).map(
        (a, idx) => a.id || `${a.vehicle_number}_${a.type}_${idx}`
      );
      const mergedIds = Array.from(new Set([...dismissedAlertIds, ...allIds]));
      setDismissedAlertIds(mergedIds);
      await AsyncStorage.setItem('dismissedBellAlertIds_v1', JSON.stringify(mergedIds)).catch(() => {});
    } finally {
      setLoadingBell(false);
    }
  };

  const allowedCards = getNavCards(user?.role).filter(card => card.roles.includes(user?.role));
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20);

  const confirmDeleteAccount = () => {
    Alert.alert(
      'Delete Account?',
      'This will permanently erase your personal data and deactivate your login. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: async () => {
          try { await deleteAccount(); } catch (e) { Alert.alert('Error', e.message || 'Failed to delete account'); }
        }}
      ]
    );
  };

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
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
          <Image 
            source={require('../../assets/images/app-logo.png')} 
            style={styles.headerLogo} 
            resizeMode="contain"
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.username} numberOfLines={1}>{user?.full_name || user?.username}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <Text style={styles.roleTag}>{user?.role}</Text>
              <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '800' }}>• v7.8</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
            <TouchableOpacity
              style={[
                styles.bellBtn,
                activeOtpCount > 0 && { backgroundColor: '#ECFDF5', borderColor: '#10B981' }
              ]}
              onPress={() => {
                setShowBellModal(true);
                fetchBellNotifications(false);
              }}
              activeOpacity={0.75}
            >
              <MaterialCommunityIcons
                name={activeOtpCount > 0 ? 'bell-ring' : 'bell-outline'}
                size={22}
                color={activeOtpCount > 0 ? '#059669' : '#1E293B'}
              />
              {totalAlertCount > 0 && (
                <View style={[styles.bellBadge, activeOtpCount > 0 && { backgroundColor: '#059669' }]}>
                  <Text style={styles.bellBadgeText}>
                    {totalAlertCount > 99 ? '99+' : totalAlertCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          <View style={{ alignItems: 'flex-end', gap: 6 }}>
            <TouchableOpacity style={styles.logoutBtn} onPress={logout} activeOpacity={0.8}>
              <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmDeleteAccount} activeOpacity={0.7}>
              <Text style={{ fontSize: 11, color: '#DC2626', fontWeight: '700' }}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        </View>
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

      {/* Notification Bell Popup Modal (Live Staff Login OTPs & Compliance Alerts) */}
      <Modal
        visible={showBellModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowBellModal(false)}
      >
        <View style={styles.bellModalOverlay}>
          <View style={styles.bellModalCard}>
            {/* Modal Header */}
            <View style={styles.bellModalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={styles.bellHeaderIconBox}>
                  <MaterialCommunityIcons name="bell-ring-outline" size={22} color="#006C49" />
                </View>
                <View>
                  <Text style={styles.bellModalTitle}>Notifications & OTPs</Text>
                  <Text style={styles.bellModalSubtitle}>
                    {user?.role === 'ADMIN' ? 'Live Staff Login OTPs & Fleet Alerts' : 'Fleet & Compliance Alerts'}
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                {hasAnyBellHistory && (
                  <TouchableOpacity
                    onPress={handleMarkAllAsRead}
                    style={styles.markAllReadBtn}
                    activeOpacity={0.75}
                  >
                    <MaterialCommunityIcons name="check-all" size={16} color="#006C49" />
                    <Text style={styles.markAllReadBtnText}>Mark All as Read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => fetchBellNotifications(false)}
                  style={styles.bellRefreshBtn}
                  activeOpacity={0.7}
                >
                  {loadingBell ? (
                    <ActivityIndicator size="small" color="#006C49" />
                  ) : (
                    <MaterialCommunityIcons name="refresh" size={18} color="#006C49" />
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setShowBellModal(false)}
                  style={styles.bellCloseBtn}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="close" size={20} color="#475569" />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView
              style={{ maxHeight: 500 }}
              contentContainerStyle={{ paddingBottom: 20 }}
              showsVerticalScrollIndicator={true}
            >
              {/* SECTION 1: Admin Live Staff Login OTPs */}
              {user?.role === 'ADMIN' && (
                <View style={{ marginBottom: 18 }}>
                  <View style={styles.bellSectionHeaderRow}>
                    <MaterialCommunityIcons name="shield-key-outline" size={16} color="#006C49" />
                    <Text style={styles.bellSectionTitle}>STAFF LOGIN OTP REQUESTS</Text>
                    {activeOtpCount > 0 && (
                      <View style={styles.activeCountPill}>
                        <Text style={styles.activeCountPillText}>{activeOtpCount} ACTIVE</Text>
                      </View>
                    )}
                  </View>

                  {pendingOtps.length === 0 ? (
                    <View style={styles.emptyBellBox}>
                      <MaterialCommunityIcons name="key-outline" size={24} color="#94A3B8" />
                      <Text style={styles.emptyBellText}>No recent staff login OTP requests in the last hour.</Text>
                    </View>
                  ) : (
                    pendingOtps.map((otp) => {
                      const expStr = otp.expires_at
                        ? (otp.expires_at.endsWith('Z') ? otp.expires_at : `${otp.expires_at}Z`)
                        : null;
                      const createdStr = otp.created_at
                        ? (otp.created_at.endsWith('Z') ? otp.created_at : `${otp.created_at}Z`)
                        : null;
                      const expMs = expStr ? new Date(expStr).getTime() : 0;
                      const isExpired = expMs > 0 && expMs <= Date.now();
                      const isActive = !otp.is_used && !isExpired;
                      const minsLeft = isActive && expMs > 0 ? Math.max(1, Math.ceil((expMs - Date.now()) / 60000)) : 0;
                      const timeLabel = createdStr
                        ? new Date(createdStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';

                      return (
                        <View
                          key={otp.id || otp.session_id}
                          style={[
                            styles.otpItemCard,
                            isActive ? styles.otpItemCardActive : styles.otpItemCardInactive
                          ]}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1, paddingRight: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={styles.otpUserTitle}>{otp.full_name || otp.username}</Text>
                                <View style={styles.otpRoleBadge}>
                                  <Text style={styles.otpRoleBadgeText}>{otp.role}</Text>
                                </View>
                              </View>
                              <Text style={styles.otpMetaText}>
                                @{otp.username} {timeLabel ? `• Requested at ${timeLabel}` : ''}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.otpStatusBadge,
                                isActive
                                  ? { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }
                                  : otp.is_used
                                  ? { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1' }
                                  : { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' }
                              ]}
                            >
                              <Text
                                style={[
                                  styles.otpStatusBadgeText,
                                  isActive
                                    ? { color: '#15803D' }
                                    : otp.is_used
                                    ? { color: '#475569' }
                                    : { color: '#B91C1C' }
                                ]}
                              >
                                {isActive ? `ACTIVE (${minsLeft}m left)` : otp.is_used ? 'USED' : 'EXPIRED'}
                              </Text>
                            </View>
                          </View>

                          <View style={[styles.otpCodeDisplayBox, !isActive && { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}>
                            <Text style={styles.otpCodeLabel}>6-DIGIT LOGIN OTP</Text>
                            <Text style={[styles.otpCodeValue, !isActive && { color: '#94A3B8' }]}>
                              {String(otp.otp_code || '').split('').join(' ')}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              )}

              {/* SECTION 2: Fleet & Compliance Alerts */}
              <View>
                <View style={styles.bellSectionHeaderRow}>
                  <MaterialCommunityIcons name="alert-decagram-outline" size={16} color="#D97706" />
                  <Text style={styles.bellSectionTitle}>FLEET & COMPLIANCE REMINDERS</Text>
                </View>

                {visibleComplianceAlerts.length === 0 ? (
                  <View style={styles.emptyBellBox}>
                    <MaterialCommunityIcons name="check-decagram-outline" size={24} color="#10B981" />
                    <Text style={styles.emptyBellText}>All fleet EMIs and compliance certificates are up to date!</Text>
                  </View>
                ) : (
                  visibleComplianceAlerts.map((alertItem, idx) => {
                    const isCrit = alertItem.severity === 'CRITICAL' || alertItem.days_until_due < 0;
                    return (
                      <TouchableOpacity
                        key={alertItem.id || idx}
                        style={[
                          styles.alertItemCard,
                          isCrit ? { backgroundColor: '#FEF2F2', borderColor: '#FECACA' } : { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }
                        ]}
                        activeOpacity={0.8}
                        onPress={() => {
                          setShowBellModal(false);
                          navigation.navigate('ComplianceVault');
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: isCrit ? '#991B1B' : '#92400E' }}>
                            {alertItem.vehicle_number} • {alertItem.type}
                          </Text>
                          <MaterialCommunityIcons name="chevron-right" size={18} color="#64748B" />
                        </View>
                        <Text style={{ fontSize: 12, color: '#334155', lineHeight: 17 }}>
                          {alertItem.message}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  bellBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#EF4444',
    minWidth: 19,
    height: 19,
    borderRadius: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
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
  bellModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'flex-end',
  },
  bellModalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 28,
    maxHeight: '85%',
  },
  bellModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 14,
  },
  bellHeaderIconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellModalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  bellModalSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  bellRefreshBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  markAllReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  markAllReadBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#006C49',
  },
  bellCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  bellSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
  },
  activeCountPill: {
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 4,
  },
  activeCountPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  emptyBellBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    gap: 6,
  },
  emptyBellText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    fontWeight: '500',
  },
  otpItemCard: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
  },
  otpItemCardActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#6EE7B7',
  },
  otpItemCardInactive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  otpUserTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  otpRoleBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  otpRoleBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#2563EB',
  },
  otpMetaText: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  otpStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  otpStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },
  otpCodeDisplayBox: {
    marginTop: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  otpCodeLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#047857',
    letterSpacing: 0.6,
  },
  otpCodeValue: {
    fontSize: 20,
    fontWeight: '900',
    color: '#006C49',
    letterSpacing: 2,
  },
  alertItemCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
  },
});

