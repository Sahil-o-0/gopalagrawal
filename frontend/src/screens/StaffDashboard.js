import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView, TextInput, ScrollView, ActivityIndicator, StatusBar, Platform, Image } from 'react-native';
import { AuthContext } from '../context/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import DateTimePicker from '@react-native-community/datetimepicker';
import TripLogForm from '../components/TripLogForm';
import { API_BASE_URL } from '../config';

export default function StaffDashboard({ navigation, route }) {
  const { user, userToken, logout } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'trips'); // 'trips' or 'hr'

  // Sync activeTab when route parameters change
  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);
  const [isLoading, setIsLoading] = useState(false);
  const [attendanceMarked, setAttendanceMarked] = useState(false);

  // Leave Request State
  const [leaveStart, setLeaveStart] = useState('');
  const [leaveEnd, setLeaveEnd] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Advance Request State
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');

  // Punch Clock States
  const [todayRecord, setTodayRecord] = useState(null);
  const [punchPhoto, setPunchPhoto] = useState(null);
  const [punchNotes, setPunchNotes] = useState('');

  const checkAttendance = async () => {
    try {
      setIsLoading(true);
      const resp = await fetch(`${API_BASE_URL}/workforce/attendance`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (resp.ok) {
        const records = await resp.json();
        const d = new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const todayStr = `${yyyy}-${mm}-${dd}`;
        const record = records.find(r => r.date === todayStr);
        setTodayRecord(record || null);
        setAttendanceMarked(!!record);
      }
    } catch (_) {}
    finally {
      setIsLoading(false);
    }
  };

  // Check on mount
  useEffect(() => {
    checkAttendance();
  }, []);

  const takePunchPhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required to scan your face.');
      return;
    }
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'images',
      allowsEditing: false,
      quality: 0.3,
      base64: true,
    });
    if (!result.canceled) {
      setPunchPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handlePunch = async (type) => {
    if (!punchPhoto) {
      Alert.alert("Face Scan Required", "Please capture a face photo before punching.");
      return;
    }

    let locationStr = 'Location Unknown';
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        locationStr = `Lat: ${loc.coords.latitude.toFixed(6)}, Lon: ${loc.coords.longitude.toFixed(6)}`;
      } else {
        locationStr = 'Location Denied';
      }
    } catch (e) {
      console.warn("Failed to get location:", e);
    }

    try {
      setIsLoading(true);
      const resp = await fetch(`${API_BASE_URL}/workforce/attendance/punch`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${userToken}` 
        },
        body: JSON.stringify({
          punch_type: type,
          photo: punchPhoto,
          notes: punchNotes.trim() || undefined,
          site_id: user.site_id || 1,
          location: locationStr
        })
      });
      const data = await resp.json();
      if (resp.ok) {
        Alert.alert("Success", `Punched ${type === 'in' ? 'In' : 'Out'} successfully!`);
        setPunchPhoto(null);
        setPunchNotes('');
        checkAttendance();
      } else {
        Alert.alert("Failed", data.detail || `Punch ${type} failed`);
      }
    } catch (e) {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const requestLeave = async () => {
    if (!leaveStart || !leaveEnd || !leaveReason) return Alert.alert("Required", "Please fill all leave fields");
    try {
      setIsLoading(true);
      const resp = await fetch(`${API_BASE_URL}/workforce/leaves`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ staff_id: user.id, start_date: leaveStart, end_date: leaveEnd, reason: leaveReason })
      });
      if (resp.ok) {
        Alert.alert("Success", "Leave request submitted");
        setLeaveStart(''); setLeaveEnd(''); setLeaveReason('');
      } else {
        const data = await resp.json();
        Alert.alert("Error", data.detail || "Could not submit leave");
      }
    } catch (e) { Alert.alert("Error", "Network error"); } finally { setIsLoading(false); }
  };

  const requestAdvance = async () => {
    if (!advanceAmount || !advanceReason) return Alert.alert("Required", "Please fill advance fields");
    try {
      setIsLoading(true);
      const resp = await fetch(`${API_BASE_URL}/workforce/advances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ staff_id: user.id, amount: parseFloat(advanceAmount), reason: advanceReason })
      });
      if (resp.ok) {
        Alert.alert("Success", "Advance request submitted");
        setAdvanceAmount(''); setAdvanceReason('');
      } else {
        Alert.alert("Error", "Could not submit advance");
      }
    } catch (e) { Alert.alert("Error", "Network error"); } finally { setIsLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ paddingRight: 12 }}>
            <MaterialCommunityIcons name="arrow-left" size={26} color="#1F2937" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Staff Portal</Text>
            <Text style={styles.headerSubtitle}>Logs & HR</Text>
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
        <TouchableOpacity style={[styles.tab, activeTab === 'hr' && styles.activeTab]} onPress={() => setActiveTab('hr')}>
            <Text style={[styles.tabText, activeTab === 'hr' && styles.activeTabText]}>Attendance & HR</Text>
        </TouchableOpacity>
      </View>

      <View style={{flex: 1}}>
        {activeTab === 'trips' ? (
           <TripLogForm />
         ) : (
            <ScrollView contentContainerStyle={styles.hrContainer}>
               <View style={styles.sectionHeaderContainer}>
                  <MaterialCommunityIcons name="account-cog" size={20} color="#111827" />
                  <Text style={styles.sectionHeaderTitle}>Self Service</Text>
               </View>

               {/* Daily Attendance Face Scan Punch Clock */}
               <View style={[styles.hrCard, { borderLeftColor: '#10B981', borderLeftWidth: 4 }]}>
                 <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Face Scan Attendance</Text>
                    <MaterialCommunityIcons name="face-recognition" size={22} color="#10B981" />
                 </View>
                 
                 {isLoading && <ActivityIndicator color="#10B981" style={{ marginBottom: 10 }} />}

                 {/* Case 1: Not Punched In yet */}
                 {!todayRecord && (
                   <View>
                     <Text style={styles.cardSubtitle}>Scan your face to Punch In for today's shift.</Text>
                     
                     <View style={{ alignItems: 'center', marginBottom: 12 }}>
                       {punchPhoto ? (
                         <Image source={{ uri: punchPhoto }} style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 8 }} />
                       ) : (
                         <TouchableOpacity style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }} onPress={takePunchPhoto}>
                           <MaterialCommunityIcons name="camera" size={32} color="#9CA3AF" />
                         </TouchableOpacity>
                       )}
                       <TouchableOpacity onPress={takePunchPhoto}>
                         <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 13 }}>{punchPhoto ? "Change Face Photo" : "Capture Face Photo"}</Text>
                       </TouchableOpacity>
                     </View>

                     <TextInput 
                       style={[styles.input, { marginBottom: 12 }]} 
                       placeholder="Punch In Notes (optional)" 
                       placeholderTextColor="#9CA3AF"
                       value={punchNotes}
                       onChangeText={setPunchNotes}
                     />

                     <TouchableOpacity
                       style={[styles.actionBtn, { backgroundColor: '#10B981' }]}
                       onPress={() => handlePunch('in')}
                       disabled={isLoading || !punchPhoto}
                     >
                       <Text style={styles.actionBtnText}>Punch In Now</Text>
                     </TouchableOpacity>
                   </View>
                 )}

                 {/* Case 2: Punched In, waiting to Punch Out */}
                 {todayRecord && !todayRecord.punch_out_time && (
                   <View>
                     <View style={{ backgroundColor: '#ECFDF5', padding: 12, borderRadius: 8, marginBottom: 12 }}>
                       <Text style={{ color: '#065F46', fontWeight: '800', fontSize: 14 }}>✓ Punched In</Text>
                       <Text style={{ color: '#047857', fontSize: 12, marginTop: 4 }}>
                         Time: {todayRecord.punch_in_time ? new Date(todayRecord.punch_in_time).toLocaleTimeString() : 'N/A'}
                       </Text>
                     </View>

                     <Text style={styles.cardSubtitle}>Scan your face again to Punch Out and record hours.</Text>
                     
                     <View style={{ alignItems: 'center', marginBottom: 12 }}>
                       {punchPhoto ? (
                         <Image source={{ uri: punchPhoto }} style={{ width: 100, height: 100, borderRadius: 50, marginBottom: 8 }} />
                       ) : (
                         <TouchableOpacity style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginBottom: 8 }} onPress={takePunchPhoto}>
                           <MaterialCommunityIcons name="camera" size={32} color="#9CA3AF" />
                         </TouchableOpacity>
                       )}
                       <TouchableOpacity onPress={takePunchPhoto}>
                         <Text style={{ color: '#2563EB', fontWeight: '700', fontSize: 13 }}>{punchPhoto ? "Change Face Photo" : "Capture Face Photo"}</Text>
                       </TouchableOpacity>
                     </View>

                     <TextInput 
                       style={[styles.input, { marginBottom: 12 }]} 
                       placeholder="Punch Out Notes (optional)" 
                       placeholderTextColor="#9CA3AF"
                       value={punchNotes}
                       onChangeText={setPunchNotes}
                     />

                     <TouchableOpacity
                       style={[styles.actionBtn, { backgroundColor: '#EF4444' }]}
                       onPress={() => handlePunch('out')}
                       disabled={isLoading || !punchPhoto}
                     >
                       <Text style={styles.actionBtnText}>Punch Out Now</Text>
                     </TouchableOpacity>
                   </View>
                 )}

                 {/* Case 3: Fully Completed Shift today */}
                 {todayRecord && todayRecord.punch_out_time && (
                   <View style={{ backgroundColor: '#F3F4F6', padding: 16, borderRadius: 10, alignItems: 'center' }}>
                     <MaterialCommunityIcons name="check-decagram" size={36} color="#10B981" />
                     <Text style={{ fontSize: 16, fontWeight: '800', color: '#1F2937', marginTop: 8 }}>Shift Complete Today</Text>
                     <Text style={{ fontSize: 13, color: '#4B5563', marginTop: 6 }}>
                       Punch In: {new Date(todayRecord.punch_in_time).toLocaleTimeString()}
                     </Text>
                     <Text style={{ fontSize: 13, color: '#4B5563', marginTop: 2 }}>
                       Punch Out: {new Date(todayRecord.punch_out_time).toLocaleTimeString()}
                     </Text>
                     <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, marginTop: 10 }}>
                       <Text style={{ color: '#065F46', fontWeight: '800', fontSize: 12 }}>
                         Hours Worked: {todayRecord.hours_worked} hrs
                       </Text>
                     </View>
                   </View>
                 )}
               </View>

               {/* Leave Request Card */}
               <View style={[styles.hrCard, {borderLeftColor: '#F59E0B', borderLeftWidth: 4}]}>
                 <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Request Leave</Text>
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
                    <TextInput placeholderTextColor="#6B7280" style={styles.groupedInput} placeholder="Reason for leave" value={leaveReason} onChangeText={setLeaveReason} />
                 </View>

                 <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#F59E0B'}]} onPress={requestLeave} disabled={isLoading}>
                    <Text style={styles.actionBtnText}>Submit Leave Request</Text>
                 </TouchableOpacity>
               </View>

               {/* Advance Wage Card */}
               <View style={[styles.hrCard, {borderLeftColor: '#2563EB', borderLeftWidth: 4}]}>
                 <View style={styles.cardHeader}>
                    <Text style={styles.cardTitle}>Request Advance Wage</Text>
                    <MaterialCommunityIcons name="cash-plus" size={20} color="#2563EB" />
                 </View>

                 <View style={styles.inputGroup}>
                    <MaterialCommunityIcons name="currency-inr" size={20} color="#6B7280" style={styles.inputIcon} />
                    <TextInput placeholderTextColor="#6B7280" style={styles.groupedInput} placeholder="Amount (₹)" keyboardType="numeric" value={advanceAmount} onChangeText={setAdvanceAmount} />
                 </View>
                 <View style={styles.inputGroup}>
                    <MaterialCommunityIcons name="comment-text-outline" size={20} color="#6B7280" style={styles.inputIcon} />
                    <TextInput placeholderTextColor="#6B7280" style={styles.groupedInput} placeholder="Reason for advance" value={advanceReason} onChangeText={setAdvanceReason} />
                 </View>

                 <TouchableOpacity style={[styles.actionBtn, {backgroundColor: '#2563EB'}]} onPress={requestAdvance} disabled={isLoading}>
                    <Text style={styles.actionBtnText}>Request Advance</Text>
                 </TouchableOpacity>
               </View>
            </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: '5%', backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#1F2937' },
  headerSubtitle: { fontSize: 14, color: '#374151', fontWeight: '600' },
  logoutBtn: { backgroundColor: '#EF4444', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 8 },
  logoutText: { color: 'white', fontWeight: 'bold' },
  
  tabContainer: { flexDirection: 'row', backgroundColor: 'white', padding: 10, justifyContent: 'space-around', borderBottomWidth: 1, borderColor: '#E5E7EB'},
  tab: { paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20 },
  activeTab: { backgroundColor: '#DBEAFE' },
  tabText: { color: '#6B7280', fontWeight: 'bold' },
  activeTabText: { color: '#1D4ED8' },

  hrContainer: { padding: '5%', paddingBottom: 50 },
  hrCard: { backgroundColor: 'white', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#E5E7EB' },
  cardTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 5 },
  cardSubtitle: { fontSize: 14, color: '#374151', marginBottom: 15, fontWeight: '500' },
  input: { backgroundColor: '#FFFFFF', borderRadius: 8, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#374151', fontSize: 16, color: '#000000' },
  actionBtn: { backgroundColor: '#2563EB', padding: 12, borderRadius: 8, alignItems: 'center' },
  actionBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  statusToggle: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#E5E7EB', alignItems: 'center', borderWidth: 1, borderColor: '#D1D5DB' },
  statusToggleActive: { backgroundColor: '#DBEAFE', borderColor: '#2563EB' },
  statusToggleText: { color: '#6B7280', fontWeight: 'bold', fontSize: 14 },
  statusToggleTextActive: { color: '#1D4ED8' },
  emiAlertText: { color: '#B91C1C', fontWeight: 'bold', fontSize: 13, textAlign: 'center' },
  
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionHeaderContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15, marginTop: 10, paddingHorizontal: 5, gap: 10 },
  sectionHeaderTitle: { fontSize: 18, fontWeight: 'bold', color: '#111827' },
  inputGroup: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 10, marginBottom: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  inputIcon: { marginRight: 10 },
  groupedInput: { flex: 1, height: 48, fontSize: 15, color: '#111827' }
});
