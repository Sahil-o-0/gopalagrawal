import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, TextInput, ScrollView, ActivityIndicator, Image, Modal, StatusBar, Platform, FlatList } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AttendanceCalendar from '../components/AttendanceCalendar';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_BASE_URL } from '../config';

export default function ManagerDashboard({ navigation, route }) {
  const { user, userToken, logout } = useContext(AuthContext);
  
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'trips'); // trips, attendance, advances

  // Sync activeTab when route parameters change
  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  const [trips, setTrips] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSelfMarking, setIsSelfMarking] = useState(false);
  const [selfAttendanceMarked, setSelfAttendanceMarked] = useState(false);

  // HR States
  const [selectedStaffId, setSelectedStaffId] = useState(user.id);
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

  // Validation State
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [receivedAmount, setReceivedAmount] = useState('');
  const [bookedAmount, setBookedAmount] = useState(''); // Trip Bhada
  
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
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'trips') {
         const resp = await fetch(`${API_BASE_URL}/trips/`, { headers: { 'Authorization': `Bearer ${userToken}` }});
         if (resp.ok) setTrips(await resp.json());
      } else if (activeTab === 'attendance') {
         const [attResp, usersResp] = await Promise.all([
           fetch(`${API_BASE_URL}/workforce/attendance`, { headers: { 'Authorization': `Bearer ${userToken}` } }),
           fetch(`${API_BASE_URL}/auth/users`, { headers: { 'Authorization': `Bearer ${userToken}` } })
         ]);
         if (attResp.ok) {
           const attData = await attResp.json();
           setAttendance(attData);
           // Check if manager themselves marked attendance today
           const today = new Date().toISOString().split('T')[0];
           setSelfAttendanceMarked(attData.some(r => r.staff_id === user.id && r.date === today));
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
    setIsModalVisible(true);
  };

  const openImage = (url) => {
    if (!url) return;
    setViewerUrl(url);
    setViewerVisible(true);
  };

  const submitValidation = async () => {
    if (!bookedAmount) return Alert.alert("Required", "Please enter the Trip Bhada amount");

    if (!bookedAmount || isNaN(parseFloat(bookedAmount))) { return Alert.alert("Error", "Enter valid income amount"); }
    try {
      const incomeVal = parseFloat(bookedAmount);
      await fetch(`${API_BASE_URL}/trips/${selectedTrip.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ status: 'VALIDATED', bhada: incomeVal })
      });

      const ledgerResponse = await fetch(`${API_BASE_URL}/workforce/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({
          trip_id: selectedTrip.id,
          total_amount_billed: incomeVal,
          amount_received: 0
        })
      });

      if (ledgerResponse.ok) {
        Alert.alert("Success", "Trip validated and ledger created!");
        setIsModalVisible(false);
        setBookedAmount(''); setReceivedAmount('');
        fetchData(); 
      } else {
        Alert.alert("Warning", "Validated, but ledger failed.");
        setIsModalVisible(false);
        fetchData();
      }
    } catch (error) { Alert.alert("Error", "Validation failed"); }
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
      const today = new Date().toISOString().split('T')[0];
      const resp = await fetch(`${API_BASE_URL}/workforce/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ 
            staff_id: user.id, 
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
        body: JSON.stringify({ staff_id: user.id, start_date: leaveStart, end_date: leaveEnd, reason: leaveReason })
      });
      if (resp.ok) { Alert.alert("Success", "Leave request sent"); setLeaveStart(''); setLeaveEnd(''); setLeaveReason(''); fetchData(); }
    } catch (e) { Alert.alert("Error", "Network error"); }
  };

  const requestAdvance = async () => {
    if (!advanceAmount || !advanceReason) return Alert.alert("Required", "Fill all fields");
    try {
      const resp = await fetch(`${API_BASE_URL}/workforce/advances`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ staff_id: user.id, amount: parseFloat(advanceAmount), reason: advanceReason })
      });
      if (resp.ok) { Alert.alert("Success", "Advance request sent"); setAdvanceAmount(''); setAdvanceReason(''); fetchData(); }
    } catch (e) { Alert.alert("Error", "Network error"); }
  };

  // --- Renderers ---
  const renderTripItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{item.vehicle_number}</Text>
        <Text style={[styles.statusBadge, item.status === 'VALIDATED' || item.status === 'APPROVED' ? styles.statusValidated : styles.statusPending]}>
          {item.status}
        </Text>
      </View>
      
      <Text style={styles.detailText}>Material: {item.material_type} ({item.weight_tons}t)</Text>
      <Text style={styles.detailText}>Route: {item.origin || 'N/A'} ➡️ {item.destination || 'N/A'}</Text>
      <Text style={styles.detailText}>Distance: {item.total_km} KM</Text>
      {item.diesel_liters > 0 && <Text style={styles.detailText}>Diesel log: {item.diesel_liters}L (₹{item.diesel_cost})</Text>}
      <Text style={styles.dateText}>Logged: {new Date(item.created_at).toLocaleDateString()}</Text>

      {/* Photos row */}
      <View style={{flexDirection: 'row', marginTop: 10, marginBottom: 10}}>
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

      {item.status === 'PENDING' && (
        <TouchableOpacity style={styles.validateBtn} onPress={() => openValidationModal(item)}>
          <Text style={styles.validateBtnText}>Validate Trip</Text>
        </TouchableOpacity>
      )}
    </View>
  );

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ paddingRight: 12 }}>
            <MaterialCommunityIcons name="arrow-left" size={26} color="#111827" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Manager Dashboard</Text>
            <Text style={styles.headerSubtitle}>Oversight & Tracking</Text>
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
          <FlatList
            data={trips}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderTripItem}
            contentContainerStyle={styles.flatListContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No trips found or pending.</Text>}
          />
        ) : activeTab === 'attendance' ? (
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
                            if (selectedDate) setLeaveStart(selectedDate.toISOString().split('T')[0]);
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
                            if (selectedDate) setLeaveEnd(selectedDate.toISOString().split('T')[0]);
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
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Validate Trip #{selectedTrip?.id}</Text>
            <Text style={styles.modalSubtitle}>{selectedTrip?.vehicle_number} - {selectedTrip?.total_km} KM</Text>
            
            <TextInput 
              style={styles.input} 
              placeholder="Trip Bhada / Income (₹) REQUIRED" 
              placeholderTextColor="#4B5563"
              keyboardType="numeric"
              value={bookedAmount}
              onChangeText={setBookedAmount}
            />

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={submitValidation}>
                <Text style={styles.confirmBtnText}>Confirm Data</Text>
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 },
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
