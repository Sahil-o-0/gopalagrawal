import React, { useState, useEffect, useCallback, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ScrollView, ActivityIndicator, Image, Modal, StatusBar, Platform, FlatList, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import SiteSelector from '../components/SiteSelector';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AttendanceCalendar from '../components/AttendanceCalendar';
import ManualAttendanceModal from '../components/ManualAttendanceModal';
import DateTimePicker from '@react-native-community/datetimepicker';
import TripLogForm from '../components/TripLogForm';
import { API_BASE_URL } from '../config';
import { formatLocalDate, formatDisplayDate } from '../utils/dateUtils';

export default function ManagerDashboard({ navigation, route }) {
  const { user, userToken, logout } = useContext(AuthContext);
  const { selectedSite, sites = [] } = useSite();
  
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'trips'); // trips, attendance, advances

  // Sync activeTab when route parameters change
  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [activeTab, selectedSite?.id, userToken])
  );

  const [trips, setTrips] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelfMarking, setIsSelfMarking] = useState(false);
  const [selfAttendanceMarked, setSelfAttendanceMarked] = useState(false);
  const [isManualTripModalVisible, setIsManualTripModalVisible] = useState(false);

  // Manager Attendance Sub-Tab & States
  const [attSubTab, setAttSubTab] = useState('staff'); // 'staff' or 'my'
  const [managerSelectedDate, setManagerSelectedDate] = useState(new Date());
  const [showManagerDatePicker, setShowManagerDatePicker] = useState(false);
  const [managerSearchText, setManagerSearchText] = useState('');
  const [showCalendarView, setShowCalendarView] = useState(false);

  // Manual Attendance Modal States
  const [isManualAttendanceModalVisible, setIsManualAttendanceModalVisible] = useState(false);
  const [manualAttendanceStaff, setManualAttendanceStaff] = useState(null);
  const [manualAttendanceRecord, setManualAttendanceRecord] = useState(null);

  // HR States
  const [selectedStaffId, setSelectedStaffId] = useState(user?.id || user?.user_id || null);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Validation State
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [bookedAmount, setBookedAmount] = useState(''); // Trip Bhada
  const [validationRate, setValidationRate] = useState('');
  const [validationQuantity, setValidationQuantity] = useState('');
  const [validationRateType, setValidationRateType] = useState('TON'); // 'TON' | 'TRIP'
  const [validationTripCount, setValidationTripCount] = useState('1');
  const [validationLedgerType, setValidationLedgerType] = useState('INCOME'); // 'INCOME' | 'EXPENSE'
  const [validationPartyName, setValidationPartyName] = useState('');
  const [showValidationClientDropdown, setShowValidationClientDropdown] = useState(false);
  const [clients, setClients] = useState([]);
  
  // Self Service States (Leave/Advance)
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  // Image Viewer State
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);

  useEffect(() => {
    fetchData();
  }, [activeTab, selectedSite?.id]);

  const fetchClients = async () => {
    try {
      const cResp = await fetch(`${API_BASE_URL}/clients/`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (cResp.ok) setClients(await cResp.json());
    } catch (e) {}
  };

  const fetchData = async () => {
    setIsLoading(true);
    fetchClients();
    try {
      if (activeTab === 'trips') {
         const [tripsResp, usersResp] = await Promise.all([
           fetch(`${API_BASE_URL}/trips/`, { headers: { 'Authorization': `Bearer ${userToken}` } }),
           fetch(`${API_BASE_URL}/auth/users`, { headers: { 'Authorization': `Bearer ${userToken}` } })
         ]);
         if (tripsResp.ok) setTrips(await tripsResp.json());
         if (usersResp.ok) {
           const all = await usersResp.json();
           setUsers(all.filter(u => u.role === 'STAFF' || u.role === 'MANAGER'));
         }
      } else if (activeTab === 'attendance') {
         const [attResp, usersResp] = await Promise.all([
           fetch(`${API_BASE_URL}/workforce/attendance`, { headers: { 'Authorization': `Bearer ${userToken}` } }),
           fetch(`${API_BASE_URL}/auth/users`, { headers: { 'Authorization': `Bearer ${userToken}` } })
         ]);
         if (attResp.ok) {
           const attData = await attResp.json();
           setAttendance(attData);
           // Check if manager themselves marked attendance today
           const today = formatLocalDate(new Date());
           setSelfAttendanceMarked(attData.some(r => r.staff_id === (user?.id || user?.user_id) && r.date === today));
         }
         if (usersResp.ok) {
           const all = await usersResp.json();
           setUsers(all.filter(u => u.role === 'STAFF' || u.role === 'MANAGER'));
         }
      } else if (activeTab === 'advances') {
         const resp = await fetch(`${API_BASE_URL}/workforce/advances`, { headers: { 'Authorization': `Bearer ${userToken}` }});
         if (resp.ok) setAdvances(await resp.json());
      }
    } catch (e) {
      Alert.alert("Error", "Could not fetch data");
    } finally {
      setIsLoading(false);
    }
  };

  const openValidationModal = (trip) => {
    setSelectedTrip(trip);
    setValidationRateType('TON');
    setValidationTripCount('1');
    setValidationLedgerType('INCOME');
    const qty = trip?.weight_tons ? String(trip.weight_tons) : '';
    setValidationQuantity(qty);
    const bAmt = trip?.bhada ? parseFloat(trip.bhada) : 0;
    const qNum = parseFloat(qty) || 0;
    if (bAmt > 0 && qNum > 0) {
      setValidationRate(String(Math.round((bAmt / qNum) * 100) / 100));
      setBookedAmount(String(bAmt));
    } else {
      setValidationRate('');
      setBookedAmount(bAmt > 0 ? String(bAmt) : '');
    }
    setReceivedAmount(trip?.advance_freight_received ? String(trip.advance_freight_received) : '');
    setValidationPartyName(trip?.freight_notes || '');
    setShowValidationClientDropdown(false);
    setIsModalVisible(true);
  };

  const handleRateTypeChange = (newType) => {
    setValidationRateType(newType);
    const r = parseFloat(validationRate);
    if (!isNaN(r) && r > 0) {
      if (newType === 'TON') {
        const q = parseFloat(validationQuantity) || 0;
        if (q > 0) setBookedAmount(String(Math.round(r * q)));
      } else {
        const count = parseFloat(validationTripCount) || 1;
        setBookedAmount(String(Math.round(r * count)));
      }
    }
  };

  const handleRateChange = (rVal) => {
    setValidationRate(rVal);
    const r = parseFloat(rVal);
    if (validationRateType === 'TON') {
      const q = parseFloat(validationQuantity);
      if (!isNaN(r) && !isNaN(q) && q > 0) {
        setBookedAmount(String(Math.round(r * q)));
      }
    } else {
      const count = parseFloat(validationTripCount) || 1;
      if (!isNaN(r) && count > 0) {
        setBookedAmount(String(Math.round(r * count)));
      }
    }
  };

  const handleQuantityChange = (qVal) => {
    setValidationQuantity(qVal);
    if (validationRateType === 'TON') {
      const q = parseFloat(qVal);
      const r = parseFloat(validationRate);
      if (!isNaN(r) && !isNaN(q) && r > 0) {
        setBookedAmount(String(Math.round(r * q)));
      }
    }
  };

  const handleTripCountChange = (countVal) => {
    setValidationTripCount(countVal);
    if (validationRateType === 'TRIP') {
      const count = parseFloat(countVal) || 0;
      const r = parseFloat(validationRate);
      if (!isNaN(r) && count > 0) {
        setBookedAmount(String(Math.round(r * count)));
      }
    }
  };

  const handleAmountChange = (amtVal) => {
    setBookedAmount(amtVal);
    const a = parseFloat(amtVal);
    if (validationRateType === 'TON') {
      const q = parseFloat(validationQuantity);
      if (!isNaN(a) && !isNaN(q) && q > 0) {
        setValidationRate(String(Math.round((a / q) * 100) / 100));
      }
    } else {
      const count = parseFloat(validationTripCount) || 1;
      if (!isNaN(a) && count > 0) {
        setValidationRate(String(Math.round((a / count) * 100) / 100));
      }
    }
  };

  const openImage = (url) => {
    if (!url) return;
    setViewerUrl(url);
    setViewerVisible(true);
  };

  const submitValidation = async () => {
    if (!bookedAmount || isNaN(parseFloat(bookedAmount))) {
      return Alert.alert("Required", `Please enter a valid ${validationLedgerType === 'INCOME' ? 'bhada / income' : 'expense'} amount`);
    }

    try {
      const tripId = selectedTrip?.id;
      const incomeVal = parseFloat(bookedAmount);
      const party = validationPartyName.trim();
      const todayStr = formatLocalDate(new Date());
      const vehNum = selectedTrip?.vehicle_number || '';
      const rOrigin = selectedTrip?.origin || '';
      const rDest = selectedTrip?.destination || '';
      const rateVal = parseFloat(validationRate) || 0;
      const qtyVal = parseFloat(validationQuantity) || selectedTrip?.weight_tons || 0;
      const tripCountVal = parseFloat(validationTripCount) || 1;
      const isIncome = validationLedgerType === 'INCOME';
      const calcSummary = validationRateType === 'TON' 
        ? `${qtyVal}T @ ₹${rateVal}/T` 
        : `${tripCountVal} Trips @ ₹${rateVal}/Trip`;

      // 1. Update Trip Status, Bhada, Party, and Weight
      await fetch(`${API_BASE_URL}/trips/${tripId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({
          status: 'VALIDATED',
          bhada: incomeVal,
          freight_notes: party || null,
          weight_tons: qtyVal
        })
      });

      // 2. Add to Daily Ledger (TRIP_INCOME or TRIP_EXPENSE)
      try {
        await fetch(`${API_BASE_URL}/workforce/daily-ledger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
          body: JSON.stringify({
            transaction_type: isIncome ? 'INCOME' : 'EXPENSE',
            category: isIncome ? 'TRIP_INCOME' : 'TRIP_EXPENSE',
            amount: incomeVal,
            description: `Trip #${tripId} ${isIncome ? 'Bhada' : 'Expense'} (${calcSummary}) - ${vehNum}${party ? ` (Party: ${party})` : ''}`,
            date: todayStr,
            site_id: selectedSite?.id || 1,
            reference_id: tripId,
            reference_type: 'TRIP'
          })
        });
      } catch (dlErr) {
        console.warn("Daily ledger sync notice:", dlErr);
      }

      // 3. Add to Client Khata if party name is provided
      if (party) {
        try {
          let targetClient = clients.find(c => c.name.toLowerCase() === party.toLowerCase());
          if (targetClient && targetClient.id) {
            await fetch(`${API_BASE_URL}/clients/transactions`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
              body: JSON.stringify({
                client_id: targetClient.id,
                txn_type: isIncome ? 'BILLED' : 'RECEIVED',
                amount: incomeVal,
                date: todayStr,
                payment_mode: 'CREDIT',
                notes: `Trip #${tripId} ${isIncome ? 'Bhada' : 'Expense'} (${vehNum}): ${rOrigin || 'Start'} to ${rDest || 'End'} [${calcSummary}]`
              })
            });
          }
        } catch (khataErr) {
          console.warn("Client Khata sync notice:", khataErr);
        }
      }

      // 4. Also post to workforce/ledger for backwards compatibility
      try {
        await fetch(`${API_BASE_URL}/workforce/ledger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
          body: JSON.stringify({
            trip_id: tripId,
            total_amount_billed: incomeVal,
            amount_received: 0
          })
        });
      } catch (lErr) {}

      Alert.alert(
        "Trip Validated",
        `Trip #${tripId} approved! ${isIncome ? 'Income' : 'Expense'} (₹${incomeVal.toLocaleString('en-IN')}) synced to Daily Ledger${party ? ` & Client Khata (${party})` : ''}.`
      );
      setIsModalVisible(false);
      setBookedAmount('');
      setReceivedAmount('');
      setValidationPartyName('');
      setValidationRate('');
      setValidationQuantity('');
      setValidationTripCount('1');
      setValidationRateType('TON');
      setValidationLedgerType('INCOME');
      setShowValidationClientDropdown(false);
      fetchData();
    } catch (error) {
      Alert.alert("Error", "Validation failed");
    }
  };

  const [selfAttendanceStatus, setSelfAttendanceStatus] = useState('PRESENT');

  const handleMarkAttendance = async (staffId, date, status = "PRESENT") => {
    try {
      const resp = await fetch(`${API_BASE_URL}/workforce/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ 
            staff_id: staffId, 
            date: date,
            status: status,
            notes: "Marked by Manager" 
        })
      });
      if (resp.ok) {
        Alert.alert("Success", `Attendance marked as ${status === 'PRESENT' ? 'Full Day' : 'Half Day'}!`);
        fetchData();
      } else {
        const err = await resp.json();
        Alert.alert("Error", err.detail || "Could not mark attendance");
      }
    } catch (e) { Alert.alert("Error", "Network error"); }
  };

  const markSelfAttendance = async () => {
    try {
      setIsSelfMarking(true);
      const today = formatLocalDate(new Date());
      const resp = await fetch(`${API_BASE_URL}/workforce/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ 
            staff_id: user?.id || user?.user_id, 
            date: today,
            status: selfAttendanceStatus,
            notes: "Self-marked via Manager Dashboard" 
        })
      });
      if (resp.ok) {
        setSelfAttendanceMarked(true);
        Alert.alert("Success", `Your attendance is marked as ${selfAttendanceStatus === 'PRESENT' ? 'Full Day' : 'Half Day'}!`);
        fetchData();
      } else {
        const err = await resp.json();
        Alert.alert("Error", err.detail || "Could not mark attendance");
      }
    } catch (e) { Alert.alert("Error", "Network error"); }
    finally { setIsSelfMarking(false); }
  };

  const requestLeave = async () => {
    if (!leaveStart || !leaveEnd || !leaveReason) return Alert.alert("Required", "Fill all fields");
    try {
      const resp = await fetch(`${API_BASE_URL}/workforce/leaves`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ staff_id: user?.id || user?.user_id, start_date: leaveStart, end_date: leaveEnd, reason: leaveReason })
      });
      if (resp.ok) { Alert.alert("Success", "Leave request sent"); setLeaveStart(''); setLeaveEnd(''); setLeaveReason(''); fetchData(); }
    } catch (e) { Alert.alert("Error", "Network error"); }
  };

  const requestAdvance = async () => {
    if (!advanceAmount || !advanceReason) return Alert.alert("Required", "Fill all fields");
    try {
      const resp = await fetch(`${API_BASE_URL}/workforce/advances`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ staff_id: user?.id || user?.user_id, amount: parseFloat(advanceAmount), reason: advanceReason })
      });
      if (resp.ok) { Alert.alert("Success", "Advance request sent"); setAdvanceAmount(''); setAdvanceReason(''); fetchData(); }
    } catch (e) { Alert.alert("Error", "Network error"); }
  };

  // --- Renderers ---
  const renderTripItem = ({ item }) => {
    const isValidated = item.status === 'VALIDATED' || item.status === 'APPROVED';
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <MaterialCommunityIcons name="truck-fast-outline" size={20} color="#0F172A" />
            <Text style={[styles.cardTitle, { marginLeft: 8 }]}>{item.vehicle_number}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: isValidated ? '#ECFDF5' : '#FEF3C7', borderWidth: 1, borderColor: isValidated ? '#A7F3D0' : '#FDE68A' }]}>
            <Text style={{ color: isValidated ? '#065F46' : '#92400E', fontSize: 11, fontWeight: '800' }}>
              {item.status}
            </Text>
          </View>
        </View>

        {/* Route Box */}
        <View style={{ backgroundColor: '#F8FAFC', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#F1F5F9', gap: 4 }}>
          <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>
            <Text style={{ fontWeight: '800', color: '#059669' }}>ORIGIN: </Text>{item.origin || 'N/A'}
          </Text>
          <Text style={{ fontSize: 12, color: '#475569', fontWeight: '600' }}>
            <Text style={{ fontWeight: '800', color: '#2563EB' }}>DEST: </Text>{item.destination || 'N/A'}
          </Text>
        </View>
        
        {/* Metrics Row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#FFFFFF', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 }}>
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: '#64748B' }}>MATERIAL</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>{item.material_type || 'N/A'}</Text>
          </View>
          <View style={{ width: 1, height: '100%', backgroundColor: '#E2E8F0' }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: '#64748B' }}>DISTANCE</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>{item.total_km || 0} KM</Text>
          </View>
          <View style={{ width: 1, height: '100%', backgroundColor: '#E2E8F0' }} />
          <View style={{ alignItems: 'center', flex: 1 }}>
            <Text style={{ fontSize: 9, fontWeight: '800', color: '#64748B' }}>DIESEL</Text>
            <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>{item.diesel_liters ? `${item.diesel_liters}L` : '0L'}</Text>
          </View>
        </View>

        <Text style={styles.dateText}>Logged: {new Date(item.created_at).toLocaleDateString()}</Text>

        {/* Photos row */}
        {(item.loading_photo_url || item.unloading_photo_url || item.receipt_photo_url) && (
          <View style={{flexDirection: 'row', marginTop: 10, marginBottom: 10, gap: 8}}>
              {item.loading_photo_url && (
                <TouchableOpacity onPress={() => openImage(item.loading_photo_url)}>
                   <Image source={{uri: item.loading_photo_url}} style={styles.thumbnail} />
                </TouchableOpacity>
              )}
              {item.unloading_photo_url && (
                 <TouchableOpacity onPress={() => openImage(item.unloading_photo_url)}>
                     <Image source={{uri: item.unloading_photo_url}} style={styles.thumbnail} />
                 </TouchableOpacity>
              )}
              {item.receipt_photo_url && (
                 <TouchableOpacity onPress={() => openImage(item.receipt_photo_url)}>
                     <Image source={{uri: item.receipt_photo_url}} style={styles.thumbnail} />
                 </TouchableOpacity>
              )}
          </View>
        )}

        {item.status === 'PENDING' && (
          <TouchableOpacity style={styles.validateBtn} onPress={() => openValidationModal(item)} activeOpacity={0.85}>
            <Text style={styles.validateBtnText}>Validate Trip</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderAttendanceItem = ({ item }) => (
    <View style={styles.card}>
       <View style={styles.cardHeader}>
         <Text style={styles.cardTitle}>Staff ID: {item.staff_id}</Text>
         <Text style={styles.statusBadge}>{item.status}</Text>
       </View>
       <Text style={styles.dateText}>Date: {item.date}</Text>
       {item.recorded_by_id && <Text style={styles.detailText}>Recorded By Admin/Manager: {item.recorded_by_id}</Text>}
    </View>
  );

  const renderAdvanceItem = ({ item }) => (
    <View style={styles.card}>
       <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Staff ID: {item.staff_id}</Text>
          <Text style={[styles.statusBadge, item.status === 'APPROVED' ? styles.statusValidated : item.status === 'REJECTED' ? {backgroundColor: '#FEE2E2', color: '#B91C1C'} : styles.statusPending]}>{item.status}</Text>
       </View>
       <Text style={styles.detailText}>Amount: ₹{item.amount}</Text>
       <Text style={styles.detailText}>Reason: {item.reason}</Text>
       <Text style={styles.dateText}>Req Date: {new Date(item.created_at).toLocaleDateString()}</Text>
    </View>
  );

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ paddingRight: 10 }}>
            <MaterialCommunityIcons name="arrow-left" size={26} color="#111827" />
          </TouchableOpacity>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <SiteSelector compact={true} />
          </View>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tab, activeTab === 'trips' && styles.activeTab]} onPress={() => setActiveTab('trips')}>
            <Text style={[styles.tabText, activeTab === 'trips' && styles.activeTabText]}>Trip Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'attendance' && styles.activeTab]} onPress={() => setActiveTab('attendance')}>
            <Text style={[styles.tabText, activeTab === 'attendance' && styles.activeTabText]}>Attendance</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, activeTab === 'advances' && styles.activeTab]} onPress={() => setActiveTab('advances')}>
            <Text style={[styles.tabText, activeTab === 'advances' && styles.activeTabText]}>Advances & HR</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.listContainer}>
        {isLoading ? (
          <ActivityIndicator size="large" color="#10B981" />
        ) : activeTab === 'trips' ? (
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: '#64748B' }}>TOTAL TRIPS: {trips.length}</Text>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#059669', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, gap: 5 }}
                onPress={() => setIsManualTripModalVisible(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="plus-circle" size={16} color="#FFFFFF" />
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 12 }}>+ Log Trip (Manual)</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={trips}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderTripItem}
              contentContainerStyle={styles.flatListContent}
              ListEmptyComponent={<Text style={styles.emptyText}>No trips found or pending.</Text>}
            />
          </View>
        ) : activeTab === 'attendance' ? (
          <View style={{ flex: 1 }}>
            {/* Sub-Tab Selector: Staff Attendance vs My Attendance */}
            <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 4, marginHorizontal: 16, marginTop: 12, marginBottom: 8, borderRadius: 10 }}>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 }, attSubTab === 'staff' && { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }]}
                onPress={() => setAttSubTab('staff')}
              >
                <Text style={[{ fontSize: 13, fontWeight: '700', color: '#64748B' }, attSubTab === 'staff' && { color: '#2563EB', fontWeight: '800' }]}>
                  👷 Staff Attendance
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[{ flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 }, attSubTab === 'my' && { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 }]}
                onPress={() => setAttSubTab('my')}
              >
                <Text style={[{ fontSize: 13, fontWeight: '700', color: '#64748B' }, attSubTab === 'my' && { color: '#059669', fontWeight: '800' }]}>
                  👤 My Attendance
                </Text>
              </TouchableOpacity>
            </View>

            {attSubTab === 'staff' ? (
              <View style={{ flex: 1, paddingHorizontal: 16 }}>
                {/* Date Row & Search */}
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 6, marginBottom: 10 }}>
                  <TouchableOpacity
                    style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, height: 40 }}
                    onPress={() => setShowManagerDatePicker(true)}
                  >
                    <MaterialCommunityIcons name="calendar" size={18} color="#2563EB" />
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>
                      {managerSelectedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                    </Text>
                    <MaterialCommunityIcons name="chevron-down" size={16} color="#64748B" />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ backgroundColor: '#2563EB', paddingHorizontal: 14, height: 40, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    onPress={() => {
                      setManualAttendanceStaff(null);
                      setManualAttendanceRecord(null);
                      setIsManualAttendanceModalVisible(true);
                    }}
                  >
                    <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
                    <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Mark Manual</Text>
                  </TouchableOpacity>
                </View>

                {showManagerDatePicker && (
                  <DateTimePicker
                    value={managerSelectedDate}
                    mode="date"
                    display="default"
                    onChange={(event, selected) => {
                      setShowManagerDatePicker(false);
                      if (selected) setManagerSelectedDate(selected);
                    }}
                  />
                )}

                {/* Search Bar */}
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 10, height: 38, marginBottom: 10 }}>
                  <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" style={{ marginRight: 6 }} />
                  <TextInput
                    style={{ flex: 1, fontSize: 13, color: '#0F172A' }}
                    placeholder="Search staff name..."
                    placeholderTextColor="#94A3B8"
                    value={managerSearchText}
                    onChangeText={setManagerSearchText}
                  />
                  {managerSearchText ? (
                    <TouchableOpacity onPress={() => setManagerSearchText('')}>
                      <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Staff List for Selected Date */}
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
                  {(() => {
                    const yearLocal = managerSelectedDate.getFullYear();
                    const monthLocal = String(managerSelectedDate.getMonth() + 1).padStart(2, '0');
                    const dayLocal = String(managerSelectedDate.getDate()).padStart(2, '0');
                    const isoDateStr = `${yearLocal}-${monthLocal}-${dayLocal}`;

                    const filteredStaff = users.filter(u => {
                      if (!managerSearchText) return true;
                      const q = managerSearchText.toLowerCase();
                      return (
                        (u.full_name || '').toLowerCase().includes(q) ||
                        (u.username || '').toLowerCase().includes(q) ||
                        (u.designation || '').toLowerCase().includes(q) ||
                        String(u.id).includes(q)
                      );
                    });

                    if (filteredStaff.length === 0) {
                      return <Text style={styles.emptyText}>No staff members found.</Text>;
                    }

                    return filteredStaff.map(emp => {
                      const record = attendance.find(r =>
                        Number(r.staff_id) === Number(emp.id) &&
                        r.date?.split('T')[0] === isoDateStr
                      );

                      const isPresent = record?.status === 'PRESENT';
                      const isHalfDay = record?.status === 'HALF_DAY';
                      const isAbsent = record?.status === 'ABSENT';
                      const isLeave = record?.status === 'ON_LEAVE';

                      let badgeBg = '#F1F5F9';
                      let badgeText = '#64748B';
                      let badgeLabel = 'Not Marked';

                      if (isPresent) {
                        badgeBg = '#ECFDF5';
                        badgeText = '#059669';
                        badgeLabel = record.hours_worked ? `Present (${record.hours_worked}h)` : 'Present';
                      } else if (isHalfDay) {
                        badgeBg = '#FFFBEB';
                        badgeText = '#D97706';
                        badgeLabel = record.hours_worked ? `Half Day (${record.hours_worked}h)` : 'Half Day';
                      } else if (isAbsent) {
                        badgeBg = '#FEF2F2';
                        badgeText = '#DC2626';
                        badgeLabel = 'Absent';
                      } else if (isLeave) {
                        badgeBg = '#F5F3FF';
                        badgeText = '#7C3AED';
                        badgeLabel = 'On Leave';
                      }

                      return (
                        <TouchableOpacity
                          key={`mgr-att-emp-${emp.id}`}
                          style={{ flexDirection: 'row', backgroundColor: 'white', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: record ? '#E2E8F0' : '#F1F5F9', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
                          onPress={() => {
                            setManualAttendanceStaff(emp);
                            setManualAttendanceRecord(record || null);
                            setIsManualAttendanceModalVisible(true);
                          }}
                        >
                          {emp.profile_photo_url ? (
                            <Image source={{ uri: emp.profile_photo_url }} style={{ width: 44, height: 44, borderRadius: 10, marginRight: 12 }} />
                          ) : (
                            <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                              <Text style={{ fontSize: 20 }}>👤</Text>
                            </View>
                          )}

                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                                  #{emp.id} {emp.full_name || emp.username}
                                </Text>
                                <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#475569' }}>{emp.username}</Text>
                                </View>
                              </View>
                              <View style={{ backgroundColor: badgeBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: `${badgeText}30` }}>
                                <Text style={{ fontSize: 10, fontWeight: '800', color: badgeText }}>{badgeLabel}</Text>
                              </View>
                            </View>

                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 }}>
                              <Text style={{ fontSize: 11, color: '#64748B' }}>{emp.designation || emp.role}</Text>
                              {record?.notes ? (
                                <Text style={{ fontSize: 10, color: '#94A3B8', flex: 1 }} numberOfLines={1}>
                                  • {record.notes}
                                </Text>
                              ) : null}
                            </View>
                          </View>

                          <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" style={{ marginLeft: 6 }} />
                        </TouchableOpacity>
                      );
                    });
                  })()}
                </ScrollView>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.flatListContent}>
                <View style={styles.selfAttendanceCard}>
                  <Text style={styles.cardTitle}>My Attendance</Text>
                  <Text style={styles.detailText}>Mark your own presence for today's work.</Text>
                  
                  {!selfAttendanceMarked && (
                    <View style={{ flexDirection: 'row', marginBottom: 15, gap: 10, marginTop: 10 }}>
                      <TouchableOpacity 
                        style={[styles.statusToggle, selfAttendanceStatus === 'PRESENT' && styles.statusToggleActive]} 
                        onPress={() => setSelfAttendanceStatus('PRESENT')}
                      >
                        <Text style={[styles.statusToggleText, selfAttendanceStatus === 'PRESENT' && styles.statusToggleTextActive]}>Full Day</Text>
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={[styles.statusToggle, selfAttendanceStatus === 'HALF_DAY' && styles.statusToggleActive]} 
                        onPress={() => setSelfAttendanceStatus('HALF_DAY')}
                      >
                        <Text style={[styles.statusToggleText, selfAttendanceStatus === 'HALF_DAY' && styles.statusToggleTextActive]}>Half Day</Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  <TouchableOpacity 
                    style={[styles.selfMarkBtn, selfAttendanceMarked && styles.selfMarkBtnDone]} 
                    onPress={markSelfAttendance}
                    disabled={isSelfMarking || selfAttendanceMarked}
                  >
                    <Text style={styles.selfMarkBtnText}>
                      {isSelfMarking ? "Verifying..." : selfAttendanceMarked ? "Already Marked ✓" : `Mark ${selfAttendanceStatus === 'PRESENT' ? 'Present' : 'Half Day'}`}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={{marginTop: 10}}>
                  <Text style={styles.sectionHeader}>Attendance History</Text>
                  <AttendanceCalendar 
                    records={attendance} 
                    staffList={[user]} 
                    onMarkAttendance={handleMarkAttendance} 
                    selectedStaffId={selectedStaffId}
                    setSelectedStaffId={setSelectedStaffId}
                    year={currentYear}
                    setYear={setCurrentYear}
                    month={currentMonth}
                    setMonth={setCurrentMonth}
                  />
                </View>
              </ScrollView>
            )}
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.flatListContent}>
             <View style={styles.sectionHeaderContainer}>
                <MaterialCommunityIcons name="account-cog" size={20} color="#111827" />
                <Text style={styles.sectionHeaderTitle}>Self Service</Text>
             </View>

             {/* Leave Request Card */}
             <View style={[styles.selfAttendanceCard, {borderLeftColor: '#F59E0B', marginBottom: 15}]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Leave Request</Text>
                  <MaterialCommunityIcons name="calendar-clock" size={20} color="#F59E0B" />
                </View>
                 <TouchableOpacity style={styles.inputGroup} onPress={() => setShowStartPicker(true)}>
                   <MaterialCommunityIcons name="calendar-start" size={20} color="#6B7280" style={styles.inputIcon} />
                   <Text style={[styles.groupedInput, {paddingTop: 14, color: leaveStart ? '#111827' : '#6B7280'}]}>
                       {leaveStart || "Start Date"}
                   </Text>
                 </TouchableOpacity>
                 {showStartPicker && (
                    <DateTimePicker
                        value={leaveStart ? new Date(leaveStart) : new Date()}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                            setShowStartPicker(false);
                            if (selectedDate) setLeaveStart(formatLocalDate(selectedDate));
                        }}
                    />
                 )}

                 <TouchableOpacity style={styles.inputGroup} onPress={() => setShowEndPicker(true)}>
                   <MaterialCommunityIcons name="calendar-end" size={20} color="#6B7280" style={styles.inputIcon} />
                   <Text style={[styles.groupedInput, {paddingTop: 14, color: leaveEnd ? '#111827' : '#6B7280'}]}>
                       {leaveEnd || "End Date"}
                   </Text>
                 </TouchableOpacity>
                 {showEndPicker && (
                    <DateTimePicker
                        value={leaveEnd ? new Date(leaveEnd) : new Date()}
                        mode="date"
                        display="default"
                        onChange={(event, selectedDate) => {
                            setShowEndPicker(false);
                            if (selectedDate) setLeaveEnd(formatLocalDate(selectedDate));
                        }}
                    />
                 )}

                <View style={styles.inputGroup}>
                  <MaterialCommunityIcons name="text-box-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                  <TextInput style={styles.groupedInput} placeholder="Reason for leave" value={leaveReason} onChangeText={setLeaveReason} placeholderTextColor="#6B7280" />
                </View>

                <TouchableOpacity style={[styles.confirmBtn, {backgroundColor: '#F59E0B', marginTop: 10}]} onPress={requestLeave}>
                  <Text style={styles.confirmBtnText}>Submit Leave Request</Text>
                </TouchableOpacity>
             </View>

             {/* Advance Wage Card */}
             <View style={[styles.selfAttendanceCard, {borderLeftColor: '#2563EB', marginBottom: 20}]}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>Advance Wage</Text>
                  <MaterialCommunityIcons name="cash-plus" size={20} color="#2563EB" />
                </View>

                <View style={styles.inputGroup}>
                  <MaterialCommunityIcons name="currency-inr" size={20} color="#6B7280" style={styles.inputIcon} />
                  <TextInput style={styles.groupedInput} placeholder="Amount (₹)" value={advanceAmount} onChangeText={setAdvanceAmount} keyboardType="numeric" placeholderTextColor="#6B7280" />
                </View>

                <View style={styles.inputGroup}>
                  <MaterialCommunityIcons name="comment-text-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                  <TextInput style={styles.groupedInput} placeholder="Reason for advance" value={advanceReason} onChangeText={setAdvanceReason} placeholderTextColor="#6B7280" />
                </View>

                <TouchableOpacity style={[styles.confirmBtn, {marginTop: 10}]} onPress={requestAdvance}>
                  <Text style={styles.confirmBtnText}>Request Advance</Text>
                </TouchableOpacity>
             </View>

             <View style={styles.sectionHeaderContainer}>
                <MaterialCommunityIcons name="account-group" size={20} color="#111827" />
                <Text style={styles.sectionHeaderTitle}>Staff Oversight</Text>
             </View>

             {advances.map(item => (
               <View key={item.id || item.date + item.staff_id}>
                 {renderAdvanceItem({item})}
               </View>
             ))}
             {advances.length === 0 && <Text style={styles.emptyText}>No staff advances recorded.</Text>}
          </ScrollView>
        )}
      </View>

      {/* Validation Modal */}
      <Modal visible={isModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={[styles.modalTitle, { textAlign: 'left', marginBottom: 2 }]}>Validate & Approve Trip</Text>
                <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '700' }}>Trip #{selectedTrip?.id} • {selectedTrip?.vehicle_number}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalVisible(false)} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              {/* Trip Quick Summary Card */}
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <MaterialCommunityIcons name="map-marker-distance" size={16} color="#059669" style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>
                    {selectedTrip?.origin || 'Start'} ➔ {selectedTrip?.destination || 'End'}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>Material: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{selectedTrip?.material_type || 'N/A'}</Text> ({selectedTrip?.weight_tons || 0}T)</Text>
                  <Text style={{ fontSize: 12, color: '#64748B' }}>Distance: <Text style={{ fontWeight: '700', color: '#1E293B' }}>{selectedTrip?.total_km || 0} KM</Text></Text>
                </View>
                {(Number(selectedTrip?.diesel_cost || 0) > 0 || Number(selectedTrip?.diesel_liters || 0) > 0) && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, marginTop: 8, borderWidth: 1, borderColor: '#FDE68A' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="gas-station" size={14} color="#D97706" style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400E' }}>
                        Diesel Logged: {selectedTrip.diesel_liters || 0} L
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#B45309' }}>
                        ₹{Number(selectedTrip.diesel_cost || 0).toLocaleString('en-IN')} (Fuel Expense)
                      </Text>
                      {selectedTrip?.receipt_photo_url ? (
                        <TouchableOpacity onPress={() => openImage(selectedTrip.receipt_photo_url)} style={{ marginLeft: 6 }}>
                          <MaterialCommunityIcons name="receipt" size={16} color="#B45309" />
                        </TouchableOpacity>
                      ) : null}
                    </View>
                  </View>
                )}
              </View>

              {/* Billing Party / Client Selection */}
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Billing Party (From Client Khata)
                  </Text>
                  {!!validationPartyName && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#ECFDF5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWidth: 1, borderColor: '#A7F3D0' }}>
                      <MaterialCommunityIcons name="check-circle" size={12} color="#059669" style={{ marginRight: 3 }} />
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>Khata Party</Text>
                    </View>
                  )}
                </View>

                {/* Input with Auto-filter from Cloud Clients */}
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 10, height: 44 }}>
                  <MaterialCommunityIcons name="account-tie" size={18} color="#2563EB" style={{ marginRight: 8 }} />
                  <TextInput 
                    style={{ flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '600' }}
                    placeholder="Search party from Client Khata"
                    placeholderTextColor="#94A3B8"
                    value={validationPartyName}
                    onChangeText={(val) => {
                      setValidationPartyName(val);
                      setShowValidationClientDropdown(true);
                    }}
                    onFocus={() => setShowValidationClientDropdown(true)}
                  />
                  {!!validationPartyName ? (
                    <TouchableOpacity onPress={() => { setValidationPartyName(''); setShowValidationClientDropdown(false); }}>
                      <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                {/* Direct Suggestions from Cloud Client Khata */}
                {showValidationClientDropdown && validationPartyName.trim().length > 0 && (
                  <View style={{ marginTop: 4, backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', overflow: 'hidden' }}>
                    {clients
                      .filter(c => c.name.toLowerCase().includes(validationPartyName.trim().toLowerCase()))
                      .slice(0, 4)
                      .map(c => (
                        <TouchableOpacity
                          key={c.id}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}
                          onPress={() => {
                            setValidationPartyName(c.name);
                            setShowValidationClientDropdown(false);
                            Keyboard.dismiss();
                          }}
                        >
                          <MaterialCommunityIcons name="account" size={15} color="#475569" style={{ marginRight: 8 }} />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B', flex: 1 }}>{c.name}</Text>
                          {c.pending_balance ? (
                            <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>Bal: ₹{Number(c.pending_balance).toLocaleString('en-IN')}</Text>
                          ) : null}
                        </TouchableOpacity>
                      ))}
                    {clients.filter(c => c.name.toLowerCase().includes(validationPartyName.trim().toLowerCase())).length === 0 && (
                      <View style={{ paddingVertical: 8, paddingHorizontal: 12 }}>
                        <Text style={{ fontSize: 12, color: '#94A3B8' }}>No party found in Client Khata. Add party in Client Khata first.</Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Existing Clients Quick Chips */}
                {clients.length > 0 && (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 }}>Select Party from Khata:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                      {clients.slice(0, 10).map(c => {
                        const isSelected = validationPartyName.trim().toLowerCase() === c.name.toLowerCase();
                        return (
                          <TouchableOpacity
                            key={c.id}
                            onPress={() => {
                              setValidationPartyName(c.name);
                              setShowValidationClientDropdown(false);
                              Keyboard.dismiss();
                            }}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              backgroundColor: isSelected ? '#2563EB' : '#F1F5F9',
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 8,
                              marginRight: 6,
                              borderWidth: 1,
                              borderColor: isSelected ? '#2563EB' : '#E2E8F0'
                            }}
                            activeOpacity={0.7}
                          >
                            <MaterialCommunityIcons name="account-outline" size={12} color={isSelected ? '#FFFFFF' : '#475569'} style={{ marginRight: 4 }} />
                            <Text style={{ fontSize: 11, fontWeight: isSelected ? '800' : '600', color: isSelected ? '#FFFFFF' : '#475569' }}>
                              {c.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              {/* Ledger Entry Category: Income vs Expense */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Ledger Entry Type *
                </Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setValidationLedgerType('INCOME')}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: validationLedgerType === 'INCOME' ? '#059669' : '#E2E8F0',
                      backgroundColor: validationLedgerType === 'INCOME' ? '#ECFDF5' : '#FFFFFF'
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons 
                      name={validationLedgerType === 'INCOME' ? "radiobox-marked" : "radiobox-blank"} 
                      size={16} 
                      color={validationLedgerType === 'INCOME' ? '#059669' : '#94A3B8'} 
                      style={{ marginRight: 6 }} 
                    />
                    <MaterialCommunityIcons name="arrow-bottom-left" size={16} color={validationLedgerType === 'INCOME' ? '#059669' : '#64748B'} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: validationLedgerType === 'INCOME' ? '#059669' : '#64748B' }}>
                      Income (+)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setValidationLedgerType('EXPENSE')}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      borderWidth: 2,
                      borderColor: validationLedgerType === 'EXPENSE' ? '#DC2626' : '#E2E8F0',
                      backgroundColor: validationLedgerType === 'EXPENSE' ? '#FEF2F2' : '#FFFFFF'
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons 
                      name={validationLedgerType === 'EXPENSE' ? "radiobox-marked" : "radiobox-blank"} 
                      size={16} 
                      color={validationLedgerType === 'EXPENSE' ? '#DC2626' : '#94A3B8'} 
                      style={{ marginRight: 6 }} 
                    />
                    <MaterialCommunityIcons name="arrow-top-right" size={16} color={validationLedgerType === 'EXPENSE' ? '#DC2626' : '#64748B'} style={{ marginRight: 4 }} />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: validationLedgerType === 'EXPENSE' ? '#DC2626' : '#64748B' }}>
                      Expense (-)
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Rate and Quantity -> Amount Calculation */}
              <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#CBD5E1', marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Freight Calculation Basis
                  </Text>
                </View>

                {/* Rate Mode Selector: Ton Wise vs Trip Wise */}
                <View style={{ flexDirection: 'row', backgroundColor: '#E2E8F0', borderRadius: 8, padding: 3, marginBottom: 10 }}>
                  <TouchableOpacity
                    onPress={() => handleRateTypeChange('TON')}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 7,
                      borderRadius: 6,
                      backgroundColor: validationRateType === 'TON' ? '#FFFFFF' : 'transparent',
                      elevation: validationRateType === 'TON' ? 1 : 0,
                      shadowColor: '#000',
                      shadowOpacity: validationRateType === 'TON' ? 0.08 : 0,
                      shadowOffset: { width: 0, height: 1 }
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons 
                      name="scale" 
                      size={14} 
                      color={validationRateType === 'TON' ? '#2563EB' : '#64748B'} 
                      style={{ marginRight: 4 }} 
                    />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: validationRateType === 'TON' ? '#2563EB' : '#64748B' }}>
                      Ton Wise (₹/Ton)
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleRateTypeChange('TRIP')}
                    style={{
                      flex: 1,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      paddingVertical: 7,
                      borderRadius: 6,
                      backgroundColor: validationRateType === 'TRIP' ? '#FFFFFF' : 'transparent',
                      elevation: validationRateType === 'TRIP' ? 1 : 0,
                      shadowColor: '#000',
                      shadowOpacity: validationRateType === 'TRIP' ? 0.08 : 0,
                      shadowOffset: { width: 0, height: 1 }
                    }}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons 
                      name="truck-fast" 
                      size={14} 
                      color={validationRateType === 'TRIP' ? '#2563EB' : '#64748B'} 
                      style={{ marginRight: 4 }} 
                    />
                    <Text style={{ fontSize: 12, fontWeight: '800', color: validationRateType === 'TRIP' ? '#2563EB' : '#64748B' }}>
                      Trip Wise (₹/Trip)
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* Dynamic Inputs: Ton Wise vs Trip Wise */}
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                  {validationRateType === 'TON' ? (
                    <>
                      {/* Quantity / Weight */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 }}>
                          Quantity (Tons) *
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 10, height: 44 }}>
                          <TextInput 
                            style={{ flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '700' }}
                            placeholder="e.g. 25.4"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            value={validationQuantity}
                            onChangeText={handleQuantityChange}
                          />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>Tons</Text>
                        </View>
                      </View>

                      {/* Rate per Ton */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 }}>
                          Rate (₹ / Ton) *
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 10, height: 44 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#2563EB', marginRight: 4 }}>₹</Text>
                          <TextInput 
                            style={{ flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '700' }}
                            placeholder="e.g. 1500"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            value={validationRate}
                            onChangeText={handleRateChange}
                          />
                        </View>
                      </View>
                    </>
                  ) : (
                    <>
                      {/* Number of Trips */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 }}>
                          Number of Trips *
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 10, height: 44 }}>
                          <TextInput 
                            style={{ flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '700' }}
                            placeholder="e.g. 1"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            value={validationTripCount}
                            onChangeText={handleTripCountChange}
                          />
                          <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B' }}>Trips</Text>
                        </View>
                      </View>

                      {/* Rate per Trip */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4 }}>
                          Rate (₹ / Trip) *
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1', paddingHorizontal: 10, height: 44 }}>
                          <Text style={{ fontSize: 13, fontWeight: '800', color: '#2563EB', marginRight: 4 }}>₹</Text>
                          <TextInput 
                            style={{ flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '700' }}
                            placeholder="e.g. 15000"
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            value={validationRate}
                            onChangeText={handleRateChange}
                          />
                        </View>
                      </View>
                    </>
                  )}
                </View>

                {/* Calculated Total Amount / Bhada */}
                <View style={{ marginTop: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#1E293B' }}>
                      Total {validationLedgerType === 'INCOME' ? 'Bhada / Income' : 'Expense'} Amount (₹) *
                    </Text>
                    {!!validationRate && (validationRateType === 'TON' ? !!validationQuantity : !!validationTripCount) && (
                      <Text style={{ fontSize: 10, fontWeight: '700', color: '#059669' }}>
                        Auto-Calculated ({validationRateType === 'TON' ? 'Rate × Qty' : 'Rate × Trips'})
                      </Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 8, borderWidth: 1.5, borderColor: validationLedgerType === 'INCOME' ? '#059669' : '#DC2626', paddingHorizontal: 10, height: 46 }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: validationLedgerType === 'INCOME' ? '#059669' : '#DC2626', marginRight: 4 }}>₹</Text>
                    <TextInput 
                      style={{ flex: 1, fontSize: 16, color: '#0F172A', fontWeight: '800' }}
                      placeholder="e.g. 38100"
                      placeholderTextColor="#94A3B8"
                      keyboardType="numeric"
                      value={bookedAmount}
                      onChangeText={handleAmountChange}
                    />
                  </View>
                </View>

                {/* Formula Breakdown Banner */}
                {!!validationRate && (validationRateType === 'TON' ? !!validationQuantity : !!validationTripCount) && (
                  <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#EFF6FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 }}>
                    <MaterialCommunityIcons name="calculator" size={14} color="#2563EB" style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E40AF' }}>
                      {validationRateType === 'TON' 
                        ? `₹${validationRate} / Ton × ${validationQuantity} Tons = ₹${Number(bookedAmount || 0).toLocaleString('en-IN')}`
                        : `₹${validationRate} / Trip × ${validationTripCount} Trips = ₹${Number(bookedAmount || 0).toLocaleString('en-IN')}`
                      }
                    </Text>
                  </View>
                )}
              </View>

              {/* Auto Sync Banner */}
              <View style={{ 
                backgroundColor: validationLedgerType === 'INCOME' ? '#F0FDF4' : '#FEF2F2', 
                borderRadius: 10, 
                padding: 10, 
                borderWidth: 1, 
                borderColor: validationLedgerType === 'INCOME' ? '#BBF7D0' : '#FECACA', 
                flexDirection: 'row', 
                alignItems: 'center', 
                marginBottom: 16 
              }}>
                <MaterialCommunityIcons 
                  name={validationLedgerType === 'INCOME' ? "check-decagram" : "alert-circle-outline"} 
                  size={16} 
                  color={validationLedgerType === 'INCOME' ? "#16A34A" : "#DC2626"} 
                  style={{ marginRight: 8 }} 
                />
                <Text style={{ fontSize: 11, fontWeight: '700', color: validationLedgerType === 'INCOME' ? '#166534' : '#991B1B', flex: 1 }}>
                  Validating will log this as {validationLedgerType === 'INCOME' ? 'Trip Income (+)' : 'Trip Expense (-)'} in Daily Ledger{validationPartyName.trim() ? ` and update Client Khata (${validationPartyName.trim()}).` : '.'}
                </Text>
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.cancelBtn, { flex: 1, marginTop: 0 }]} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { flex: 2 }]} onPress={submitValidation}>
                <Text style={styles.confirmBtnText}>Validate & Sync Ledger</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal visible={viewerVisible} transparent={true} animationType="fade">
          <TouchableOpacity style={styles.imageViewerOverlay} onPress={() => setViewerVisible(false)}>
             <Image source={{uri: viewerUrl}} style={styles.fullScreenImage} />
             <Text style={styles.imageViewerCloseText}>Tap anywhere to close</Text>
          </TouchableOpacity>
      </Modal>

      {/* Manual Attendance Modal */}
      <ManualAttendanceModal
        visible={isManualAttendanceModalVisible}
        onClose={() => setIsManualAttendanceModalVisible(false)}
        onSaveSuccess={() => fetchData()}
        initialStaff={manualAttendanceStaff}
        initialDate={managerSelectedDate}
        initialRecord={manualAttendanceRecord}
        staffList={users.filter(u => u.is_active !== false)}
        sites={sites}
        userToken={userToken}
        currentRole="MANAGER"
        activeSiteId={selectedSite?.id || user.site_id}
      />

      {/* Manual Trip Entry Modal */}
      <Modal visible={isManualTripModalVisible} animationType="slide" onRequestClose={() => setIsManualTripModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: '#FFFFFF', paddingTop: Platform.OS === 'android' ? 36 : 48 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialCommunityIcons name="truck-plus" size={24} color="#059669" />
              <Text style={{ fontSize: 17, fontWeight: '800', color: '#0F172A' }}>Manual Trip Entry</Text>
            </View>
            <TouchableOpacity onPress={() => setIsManualTripModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="close" size={24} color="#64748B" />
            </TouchableOpacity>
          </View>
          <TripLogForm 
            isAdmin={true} 
            staffList={users} 
            onSuccess={() => {
              setIsManualTripModalVisible(false);
              fetchData();
            }} 
          />
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: '5%', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  headerSubtitle: { fontSize: 14, color: '#374151', fontWeight: '600' },
  logoutBtn: { backgroundColor: '#EF4444', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: 'white', fontWeight: 'bold' },
  
  tabContainer: { flexDirection: 'row', backgroundColor: 'white', padding: 10, justifyContent: 'space-around', borderBottomWidth: 1, borderColor: '#E5E7EB'},
  tab: { paddingVertical: 8, paddingHorizontal: 15, borderRadius: 20 },
  activeTab: { backgroundColor: '#D1FAE5' },
  tabText: { color: '#6B7280', fontWeight: 'bold' },
  activeTabText: { color: '#059669' },

  listContainer: { flex: 1, padding: '5%' },
  flatListContent: { paddingBottom: 20 },
  
  card: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 15, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6', paddingBottom: 8 },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: '#1F2937' },
  
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, fontSize: 12, fontWeight: 'bold', overflow: 'hidden', backgroundColor: '#F3F4F6' },
  statusPending: { backgroundColor: '#FEF3C7', color: '#D97706' },
  statusValidated: { backgroundColor: '#D1FAE5', color: '#059669' },
  
  detailText: { fontSize: 14, color: '#4B5563', marginBottom: 4 },
  dateText: { fontSize: 13, color: '#374151', marginTop: 4, fontWeight: '600' },
  
  thumbnail: { width: 60, height: 60, borderRadius: 8, marginRight: 10, backgroundColor: '#E5E7EB' },
  
  validateBtn: { backgroundColor: '#10B981', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 10 },
  validateBtnText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
  emptyText: { textAlign: 'center', color: '#6B7280', marginTop: 20 },

  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { width: '90%', backgroundColor: 'white', borderRadius: 16, padding: 20, elevation: 5 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#111827', marginBottom: 4 },
  modalSubtitle: { fontSize: 14, color: '#374151', marginBottom: 20, fontWeight: '600' },
  input: { width: '100%', height: 50, backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 15, marginBottom: 15, fontSize: 16, borderWidth: 1, borderColor: '#374151', color: '#000000' },
  modalActionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  cancelBtn: { padding: 12, marginRight: 10 },
  cancelBtnText: { color: '#6B7280', fontWeight: 'bold', fontSize: 16 },
  confirmBtn: { backgroundColor: '#2563EB', borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12 },
  confirmBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },

  imageViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '90%', height: '80%', resizeMode: 'contain' },
  imageViewerCloseText: { color: 'white', marginTop: 20, fontSize: 16 },

  selfAttendanceCard: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 15, borderLeftWidth: 4, borderLeftColor: '#10B981' },
  selfMarkBtn: { backgroundColor: '#10B981', paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  selfMarkBtnDone: { backgroundColor: '#D1D5DB' },
  selfMarkBtnText: { color: 'white', fontWeight: 'bold' },
  sectionHeader: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginVertical: 10, marginLeft: 5 },
  statusToggle: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#E5E7EB', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB' },
  statusToggleActive: { backgroundColor: '#D1FAE5', borderColor: '#059669' },
  statusToggleText: { color: '#6B7280', fontWeight: 'bold', fontSize: 14 },
  statusToggleTextActive: { color: '#059669' },
  emiAlert: { backgroundColor: '#FEE2E2', padding: 12, borderBottomWidth: 1, borderBottomColor: '#FECACA' },
  emiAlertText: { color: '#B91C1C', fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  
  sectionHeaderContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginTop: 10, paddingHorizontal: 5, gap: 10 },
  sectionHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, marginBottom: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  inputIcon: { marginRight: 10 },
  groupedInput: { flex: 1, height: 48, fontSize: 15, color: '#111827' }
});
