import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, TextInput, StatusBar, Platform, ScrollView, ActivityIndicator, Modal
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { API_BASE_URL } from '../config';

export default function UserLedgerScreen({ route, navigation }) {
  const { user, userToken, dailyLedgerEntries = [], sites = [] } = route.params;

  const [staffLedgerEntries, setStaffLedgerEntries] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State for Payout / Advance
  const [isAddLedgerModalVisible, setIsAddLedgerModalVisible] = useState(false);
  const [newLedgerAmount, setNewLedgerAmount] = useState('');
  const [newLedgerDescription, setNewLedgerDescription] = useState('');
  const [newLedgerType, setNewLedgerType] = useState('SALARY'); // SALARY (Wage Payout), ADVANCE, PAYMENT

  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  const fetchStaffData = async () => {
    setIsLoading(true);
    try {
      // 1. Fetch Staff Ledger
      const ledgerPromise = fetch(`${API_BASE_URL}/workforce/staff-ledger/${user.id}`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      // 2. Fetch Staff Attendance (Working hours)
      const attendancePromise = fetch(`${API_BASE_URL}/workforce/attendance?staff_id=${user.id}`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      const [ledgerRes, attRes] = await Promise.allSettled([ledgerPromise, attendancePromise]);

      if (ledgerRes.status === 'fulfilled' && ledgerRes.value.ok) {
        setStaffLedgerEntries(await ledgerRes.value.json());
      }
      if (attRes.status === 'fulfilled' && attRes.value.ok) {
        setAttendanceRecords(await attRes.value.json());
      }
    } catch (e) {
      console.error("Error fetching staff profile data", e);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchStaffData();
  }, []);

  // Compute monthly metrics
  const thisMonthAttendance = attendanceRecords.filter(att => {
    if (!att.date) return false;
    const d = new Date(att.date);
    return (d.getMonth() + 1) === currentMonth && d.getFullYear() === currentYear;
  });

  const totalMonthlyHours = thisMonthAttendance.reduce((acc, curr) => acc + (parseFloat(curr.hours_worked) || 0), 0);
  const totalDaysPresent = thisMonthAttendance.filter(att => att.status === 'PRESENT').length;

  // Advance Calculation
  const totalAdvanceOutstanding = Math.abs(
    staffLedgerEntries
      .filter(e => e.transaction_type === "ADVANCE")
      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
  );

  // Overall Balance Calculation
  const ledgerSum = staffLedgerEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  const netBalance = ledgerSum + (user.opening_balance || 0);

  const createLedgerEntry = async () => {
    if (!newLedgerAmount || parseFloat(newLedgerAmount) <= 0) {
      Alert.alert("Required", "Please enter a valid payout amount");
      return;
    }
    try {
      const isAdvance = newLedgerType === 'ADVANCE';
      const amountVal = parseFloat(newLedgerAmount) * (isAdvance ? -1 : -1); // Both wage payout & advance are debited/paid

      const resp = await fetch(`${API_BASE_URL}/workforce/staff-ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({
          staff_id: user.id,
          amount: amountVal,
          transaction_type: newLedgerType,
          description: newLedgerDescription || `${newLedgerType} to ${user.full_name || user.username}`
        })
      });

      if (resp.ok) {
        Alert.alert("Success", `${newLedgerType === 'ADVANCE' ? 'Advance' : 'Wage Payout'} of ₹${newLedgerAmount} logged in staff & daily ledger!`);
        setNewLedgerAmount('');
        setNewLedgerDescription('');
        setIsAddLedgerModalVisible(false);
        fetchStaffData();
      } else {
        Alert.alert("Error", "Could not process ledger entry");
      }
    } catch (e) {
      Alert.alert("Error", "Network connection issue");
    }
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.headerTitle}>{user.full_name || user.username}</Text>
          <Text style={styles.headerSub}>@{user.username} • {user.designation || user.role}</Text>
        </View>
        <TouchableOpacity 
          style={styles.profileEditBtn} 
          onPress={() => navigation.navigate('UserProfile', { userProfile: user, userToken, dailyLedgerEntries, sites })}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="account-edit-outline" size={20} color="#0F172A" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.contentContainer}>
        
        {/* Working Hours & Shift Stats Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroCardTop}>
            <View style={styles.heroBadge}>
              <MaterialCommunityIcons name="clock-time-four-outline" size={16} color="#60A5FA" />
              <Text style={styles.heroBadgeText}>MONTHLY WORK STATS</Text>
            </View>
            <Text style={styles.heroMonthText}>
              {new Date().toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </Text>
          </View>

          <View style={styles.heroMetricsGrid}>
            <View style={styles.heroMetricItem}>
              <Text style={styles.heroMetricLabel}>TOTAL WORKING HOURS</Text>
              <Text style={styles.heroMetricValue}>{totalMonthlyHours.toFixed(1)} <Text style={{ fontSize: 14, color: '#94A3B8' }}>hrs</Text></Text>
              <Text style={styles.heroMetricSub}>Logged via face-punch</Text>
            </View>
            <View style={styles.heroDivider} />
            <View style={styles.heroMetricItem}>
              <Text style={styles.heroMetricLabel}>DAYS PRESENT</Text>
              <Text style={styles.heroMetricValue}>{totalDaysPresent} <Text style={{ fontSize: 14, color: '#94A3B8' }}>days</Text></Text>
              <Text style={styles.heroMetricSub}>Attendance marked</Text>
            </View>
          </View>
        </View>

        {/* Financial Overview Bento */}
        <View style={styles.bentoRow}>
          {/* Outstanding Advance */}
          <View style={[styles.bentoCard, { borderLeftColor: '#EF4444' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.bentoLabel}>TOTAL ADVANCE</Text>
              <MaterialCommunityIcons name="hand-coin-outline" size={18} color="#DC2626" />
            </View>
            <Text style={[styles.bentoValue, { color: '#DC2626' }]}>
              ₹{totalAdvanceOutstanding.toLocaleString()}
            </Text>
            <Text style={styles.bentoSub}>Pending advances</Text>
          </View>

          {/* Net Balance */}
          <View style={[styles.bentoCard, { borderLeftColor: netBalance < 0 ? '#DC2626' : '#10B981' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={styles.bentoLabel}>NET BALANCE</Text>
              <MaterialCommunityIcons name="wallet-outline" size={18} color={netBalance < 0 ? '#DC2626' : '#059669'} />
            </View>
            <Text style={[styles.bentoValue, { color: netBalance < 0 ? '#DC2626' : '#059669' }]}>
              {netBalance < 0 ? '-' : ''}₹{Math.abs(netBalance).toLocaleString()}
            </Text>
            <Text style={styles.bentoSub}>Ledger settlement</Text>
          </View>
        </View>

        {/* Action Buttons: Pay Wage & Give Advance */}
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#0F172A' }]}
            onPress={() => {
              setNewLedgerAmount('');
              setNewLedgerDescription('');
              setNewLedgerType('SALARY');
              setIsAddLedgerModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="cash-check" size={20} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Pay Wage / Salary</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
            onPress={() => {
              setNewLedgerAmount('');
              setNewLedgerDescription('');
              setNewLedgerType('ADVANCE');
              setIsAddLedgerModalVisible(true);
            }}
            activeOpacity={0.85}
          >
            <MaterialCommunityIcons name="hand-coin" size={20} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Give Advance</Text>
          </TouchableOpacity>
        </View>

        {/* Ledger Transactions Stream */}
        <View style={styles.streamHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <MaterialCommunityIcons name="receipt-text-outline" size={18} color="#0F172A" />
            <Text style={styles.streamTitle}>Payout & Advance History</Text>
          </View>
          <Text style={styles.streamCount}>{staffLedgerEntries.length} records</Text>
        </View>

        {isLoading ? (
          <ActivityIndicator size="large" color="#0F172A" style={{ marginTop: 24 }} />
        ) : staffLedgerEntries.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="notebook-outline" size={40} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Ledger Entries</Text>
            <Text style={styles.emptySub}>No salaries, advances, or deductions logged yet.</Text>
          </View>
        ) : (
          staffLedgerEntries.map((item) => {
            const isAdvance = item.transaction_type === 'ADVANCE';
            return (
              <View key={item.id} style={styles.ledgerCard}>
                <View style={[styles.ledgerTypeIcon, { backgroundColor: isAdvance ? '#FEF2F2' : '#EFF6FF' }]}>
                  <MaterialCommunityIcons 
                    name={isAdvance ? "arrow-top-right" : "cash"} 
                    size={20} 
                    color={isAdvance ? "#DC2626" : "#2563EB"} 
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text style={styles.ledgerTypeLabel}>{item.transaction_type?.replace(/_/g, ' ')}</Text>
                    <Text style={[styles.ledgerAmountText, { color: isAdvance ? '#DC2626' : '#0F172A' }]}>
                      ₹{Math.abs(item.amount).toLocaleString()}
                    </Text>
                  </View>
                  {item.description ? (
                    <Text style={styles.ledgerDescText}>{item.description}</Text>
                  ) : null}
                  <Text style={styles.ledgerDateText}>
                    {(() => {
                      const d = new Date(item.date);
                      const dd = String(d.getDate()).padStart(2, '0');
                      const mm = String(d.getMonth() + 1).padStart(2, '0');
                      const yyyy = d.getFullYear();
                      return `${dd}-${mm}-${yyyy}`;
                    })()}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Wage & Advance Payout Modal */}
      <Modal visible={isAddLedgerModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>
                  {newLedgerType === 'ADVANCE' ? 'Log Staff Advance' : 'Process Wage / Salary Payout'}
                </Text>
                <Text style={styles.modalSub}>
                  For {user.full_name || user.username} ({totalMonthlyHours.toFixed(1)} hrs worked this month)
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddLedgerModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Type Switcher */}
            <View style={styles.typeSwitcher}>
              <TouchableOpacity 
                style={[styles.typeBtn, newLedgerType === 'SALARY' && styles.typeBtnActiveSalary]}
                onPress={() => setNewLedgerType('SALARY')}
              >
                <Text style={[styles.typeBtnText, newLedgerType === 'SALARY' && styles.typeBtnTextActive]}>
                  Wage / Salary
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.typeBtn, newLedgerType === 'ADVANCE' && styles.typeBtnActiveAdvance]}
                onPress={() => setNewLedgerType('ADVANCE')}
              >
                <Text style={[styles.typeBtnText, newLedgerType === 'ADVANCE' && styles.typeBtnTextActive]}>
                  Staff Advance
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.typeBtn, newLedgerType === 'PAYMENT' && styles.typeBtnActiveAdjustment]}
                onPress={() => setNewLedgerType('PAYMENT')}
              >
                <Text style={[styles.typeBtnText, newLedgerType === 'PAYMENT' && styles.typeBtnTextActive]}>
                  Adjustment
                </Text>
              </TouchableOpacity>
            </View>

            {/* Amount */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Payout Amount (₹) *</Text>
              <View style={styles.amountInputBox}>
                <Text style={styles.currencyPrefix}>₹</Text>
                <TextInput 
                  style={styles.amountInput}
                  placeholder="0"
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={newLedgerAmount}
                  onChangeText={setNewLedgerAmount}
                  autoFocus={true}
                />
              </View>
            </View>

            {/* Description */}
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>Remark / Notes (Optional)</Text>
              <TextInput 
                style={styles.textInput}
                placeholder="e.g. Month end settlement, medical advance..."
                placeholderTextColor="#94A3B8"
                value={newLedgerDescription}
                onChangeText={setNewLedgerDescription}
              />
            </View>

            <TouchableOpacity 
              style={[styles.submitPayoutBtn, { backgroundColor: newLedgerType === 'ADVANCE' ? '#EF4444' : '#0F172A' }]} 
              onPress={createLedgerEntry}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="check-circle" size={20} color="#FFFFFF" />
              <Text style={styles.submitPayoutText}>Confirm & Post Entry</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    backgroundColor: '#FFFFFF', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0' 
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 1 },
  profileEditBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },

  contentContainer: { padding: 16, paddingBottom: 40 },

  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4
  },
  heroCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  heroBadgeText: { fontSize: 10, fontWeight: '800', color: '#60A5FA', letterSpacing: 0.8 },
  heroMonthText: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '700' },

  heroMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  heroMetricItem: { flex: 1 },
  heroDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 14 },
  heroMetricLabel: { fontSize: 9, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.8, marginBottom: 4 },
  heroMetricValue: { fontSize: 24, fontWeight: '900', color: '#FFFFFF' },
  heroMetricSub: { fontSize: 11, color: '#64748B', marginTop: 2 },

  bentoRow: { flexDirection: 'row', gap: 12, marginBottom: 14 },
  bentoCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderLeftWidth: 4,
    elevation: 2
  },
  bentoLabel: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  bentoValue: { fontSize: 20, fontWeight: '900', marginTop: 6 },
  bentoSub: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 12,
    elevation: 3
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  streamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  streamTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  streamCount: { fontSize: 12, fontWeight: '700', color: '#64748B' },

  ledgerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 1
  },
  ledgerTypeIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12
  },
  ledgerTypeLabel: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  ledgerAmountText: { fontSize: 15, fontWeight: '900' },
  ledgerDescText: { fontSize: 12, color: '#64748B', marginTop: 3 },
  ledgerDateText: { fontSize: 11, color: '#94A3B8', marginTop: 4, fontWeight: '600' },

  emptyState: { alignItems: 'center', paddingTop: 30 },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 8 },
  emptySub: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.6)',
    justifyContent: 'flex-end'
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    elevation: 20
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16
  },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  modalSub: { fontSize: 12, color: '#64748B', marginTop: 2 },

  typeSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16
  },
  typeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: 'center'
  },
  typeBtnActiveSalary: { backgroundColor: '#0F172A' },
  typeBtnActiveAdvance: { backgroundColor: '#EF4444' },
  typeBtnActiveAdjustment: { backgroundColor: '#2563EB' },
  typeBtnText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  typeBtnTextActive: { color: '#FFFFFF' },

  formGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  amountInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14
  },
  currencyPrefix: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginRight: 6 },
  amountInput: { flex: 1, fontSize: 22, fontWeight: '900', color: '#0F172A', paddingVertical: 10 },
  textInput: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600'
  },

  submitPayoutBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 6
  },
  submitPayoutText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' }
});
