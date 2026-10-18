import React, { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, TextInput, Image, ScrollView, Modal, Platform, StatusBar, RefreshControl, Switch, Linking , Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import SiteSelector from '../components/SiteSelector';
import AttendanceCalendar from '../components/AttendanceCalendar';
import ManualAttendanceModal from '../components/ManualAttendanceModal';
import TripLogForm from '../components/TripLogForm';
import DraggableCardList from '../components/DraggableCardList';
import { API_BASE_URL } from '../config';
import { formatLocalDate, formatDisplayDate, parseLocalDate } from '../utils/dateUtils';

export default function AdminDashboard({ navigation, route }) {
  const { user, userToken, logout } = useContext(AuthContext);
  const { selectedSite, sites = [] } = useSite();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20);
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'trips');
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const usersScrollViewRef = useRef(null);
  const usersScrollYRef = useRef(0);

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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [trips, setTrips] = useState([]);
  const [users, setUsers] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [emis, setEmis] = useState([]);
  const [dailyLedgerEntries, setDailyLedgerEntries] = useState([]);
  const [businessIncomeEntries, setBusinessIncomeEntries] = useState([]);

  // Filters
  const [tripStartDate, setTripStartDate] = useState('');
  const [tripEndDate, setTripEndDate] = useState('');
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [tripStartDateDt, setTripStartDateDt] = useState(new Date());
  const [tripEndDateDt, setTripEndDateDt] = useState(new Date());

  // Form States
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPhoneNumber, setNewPhoneNumber] = useState('');
  const [newRole, setNewRole] = useState('STAFF');
  const [isUserModalVisible, setIsUserModalVisible] = useState(false);

  // Expanded fields states
  const [newDesignation, setNewDesignation] = useState('');
  const [newProfilePhoto, setNewProfilePhoto] = useState(null);
  const [newAadharId, setNewAadharId] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newRelativeName, setNewRelativeName] = useState('');
  const [newRelativeRelation, setNewRelativeRelation] = useState('');
  const [newRelativePhone, setNewRelativePhone] = useState('');
  const [newOpeningBalance, setNewOpeningBalance] = useState('0');
  const [newSalary, setNewSalary] = useState('0');
  const [newStartingDate, setNewStartingDate] = useState(new Date());
  const [showStartingDatePicker, setShowStartingDatePicker] = useState(false);
  const [newIsActive, setNewIsActive] = useState(true);
  const [newEmploymentType, setNewEmploymentType] = useState('PERMANENT'); // PERMANENT, TRIAL
  const [newAadharFront, setNewAadharFront] = useState(null);
  const [newAadharBack, setNewAadharBack] = useState(null);
  const [newSiteId, setNewSiteId] = useState('');
  const [newAssignedVehicle, setNewAssignedVehicle] = useState('');

  // Designations states
  const [designationsList, setDesignationsList] = useState([]);
  const [newCustomDesignation, setNewCustomDesignation] = useState('');
  const [isDesignationModalVisible, setIsDesignationModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('WORKER'); // ADMIN, MANAGER, WORKER
  const [createUserStep, setCreateUserStep] = useState(1); // 1: Select Designation, 2: Fill Form
  const [desigSearchText, setDesigSearchText] = useState('');

  const takeUserPhoto = async (setter) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required');
      return;
    }
    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'images',
      allowsEditing: false,
      quality: 0.3,
      base64: true,
    });
    if (!result.canceled) {
      setter(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const [emiVehicle, setEmiVehicle] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [emiDate, setEmiDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isEmiModalVisible, setIsEmiModalVisible] = useState(false);
  const [isTripModalVisible, setIsTripModalVisible] = useState(false);

  // Edit States for Users
  const [editingUser, setEditingUser] = useState(null);
  const [editUsername, setEditUsername] = useState('');
  const [editFullName, setEditFullName] = useState('');
  const [editPhoneNumber, setEditPhoneNumber] = useState('');
  const [editRole, setEditRole] = useState('STAFF');
  const [editPassword, setEditPassword] = useState('');
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isUserArrangeMode, setIsUserArrangeMode] = useState(false);

  // Edit States for EMI
  const [editingEmi, setEditingEmi] = useState(null);
  const [editEmiVehicle, setEditEmiVehicle] = useState('');
  const [editEmiAmount, setEditEmiAmount] = useState('');
  const [editEmiDate, setEditEmiDate] = useState(new Date());
  const [showEditEmiDatePicker, setShowEditEmiDatePicker] = useState(false);
  const [isEmiEditModalVisible, setIsEmiEditModalVisible] = useState(false);

  // Attendance (HR) Tab States
  const [hrSearchText, setHrSearchText] = useState('');
  const [hrSelectedDate, setHrSelectedDate] = useState(new Date());
  const [showHrDatePicker, setShowHrDatePicker] = useState(false);
  const [hrSelectedDesignation, setHrSelectedDesignation] = useState('All');
  const [hrSelectedSiteId, setHrSelectedSiteId] = useState('');
  const [isSiteDropdownVisible, setIsSiteDropdownVisible] = useState(false);
  
  // Punch Options Floating Action States
  const [isPunchMenuVisible, setIsPunchMenuVisible] = useState(false);
  const [selectedStaffForPunch, setSelectedStaffForPunch] = useState(null);
  const [punchingType, setPunchingType] = useState('in'); // 'in' or 'out'
  const [isPunchStaffModalVisible, setIsPunchStaffModalVisible] = useState(false);
  const [selectedPunchRecordDetails, setSelectedPunchRecordDetails] = useState(null);
  const [isPunchDetailsModalVisible, setIsPunchDetailsModalVisible] = useState(false);
  // Manual Attendance States
  const [isManualAttendanceModalVisible, setIsManualAttendanceModalVisible] = useState(false);
  const [manualAttendanceStaff, setManualAttendanceStaff] = useState(null);
  const [manualAttendanceRecord, setManualAttendanceRecord] = useState(null);



  // Shared Modal States (Validation & Images)
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [isValidationModalVisible, setIsValidationModalVisible] = useState(false);
  const [bookedAmount, setBookedAmount] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
  const [validationPartyName, setValidationPartyName] = useState('');
  const [showValidationClientDropdown, setShowValidationClientDropdown] = useState(false);
  const [clients, setClients] = useState([]);
  const [viewerUrl, setViewerUrl] = useState('');
  const [viewerVisible, setViewerVisible] = useState(false);

  const fetchDesignations = async () => {
    if (!userToken) return;
    try {
      const resp = await fetch(`${API_BASE_URL}/auth/designations/`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (resp.ok) {
        setDesignationsList(await resp.json());
      }
    } catch (err) {
      console.error("Failed to load designations", err);
    }
  };

  useEffect(() => {
    fetchDesignations();
  }, [userToken, isUserModalVisible]);

  useEffect(() => { fetchData(); }, [activeTab]);



  const fetchData = async () => {
    setIsLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${userToken}` };
      const params = new URLSearchParams();
      if (tripStartDate) params.append('start_date', tripStartDate);
      if (tripEndDate) params.append('end_date', tripEndDate);
      if (vehicleSearch) params.append('vehicle_number', vehicleSearch);
      if (selectedSite?.id) params.append('site_id', selectedSite.id);
      
      if (activeTab === 'trips') {
        try {
          const [tripRes, userRes] = await Promise.allSettled([
            fetch(`${API_BASE_URL}/trips/?${params.toString()}`, { headers }),
            fetch(`${API_BASE_URL}/auth/users`, { headers })
          ]);
          if (tripRes.status === 'fulfilled' && tripRes.value.ok) setTrips(await tripRes.value.json());
          if (userRes.status === 'fulfilled' && userRes.value.ok) {
            const allUsers = await userRes.value.json();
            setUsers(allUsers);
          }
        } catch (tripErr) { console.error("Trips fetch error", tripErr); }
      } else if (activeTab === 'users') {
        try {
          const resp = await fetch(`${API_BASE_URL}/auth/users`, { headers });
          if (resp.ok) setUsers(await resp.json());
        } catch (userErr) { console.error("Users fetch error", userErr); }
      } else if (activeTab === 'hr') {
        try {
          const [lRes, aRes, atRes, uRes] = await Promise.allSettled([
            fetch(`${API_BASE_URL}/workforce/leaves${selectedSite?.id ? `?site_id=${selectedSite.id}` : ''}`, { headers }),
            fetch(`${API_BASE_URL}/workforce/advances${selectedSite?.id ? `?site_id=${selectedSite.id}` : ''}`, { headers }),
            fetch(`${API_BASE_URL}/workforce/attendance${selectedSite?.id ? `?site_id=${selectedSite.id}` : ''}`, { headers }),
            fetch(`${API_BASE_URL}/auth/users`, { headers })
          ]);
          if (lRes.status === 'fulfilled' && lRes.value.ok) setLeaves(await lRes.value.json());
          if (aRes.status === 'fulfilled' && aRes.value.ok) setAdvances(await aRes.value.json());
          if (atRes.status === 'fulfilled' && atRes.value.ok) setAttendance(await atRes.value.json());
          if (uRes.status === 'fulfilled' && uRes.value.ok) {
             const allUsers = await uRes.value.json();
             setUsers(allUsers.filter(u => u.role !== 'ADMIN'));
          }
        } catch (hrErr) { console.error("HR fetch error", hrErr); }
      } else if (activeTab === 'emi') {
        try {
          const resp = await fetch(`${API_BASE_URL}/workforce/emi${selectedSite?.id ? `?site_id=${selectedSite.id}` : ''}`, { headers });
          if (resp.ok) setEmis(await resp.json());
        } catch (emiErr) { console.error("EMI fetch error", emiErr); }
      }
    } catch (e) { 
      console.error("fetchData top-level error", e);
    } finally {
      try {
        const staffLedgerResp = await fetch(`${API_BASE_URL}/workforce/staff-ledger${selectedSite?.id ? `?site_id=${selectedSite.id}` : ''}`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (staffLedgerResp.ok) {
          setDailyLedgerEntries(await staffLedgerResp.json());
        }
      } catch (ledgerErr) { console.error("Staff ledger fetch error", ledgerErr); }

      try {
        const bizResp = await fetch(`${API_BASE_URL}/workforce/daily-ledger?month=${new Date().getMonth()+1}&year=${new Date().getFullYear()}${selectedSite?.id ? `&site_id=${selectedSite.id}` : ''}`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (bizResp.ok) {
          const bizData = await bizResp.json();
          setBusinessIncomeEntries(bizData);
        }
      } catch (bizErr) { console.error("Biz daily ledger fetch error", bizErr); }

      try {
        const desigResp = await fetch(`${API_BASE_URL}/auth/designations/`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (desigResp.ok) {
          setDesignationsList(await desigResp.json());
        }
      } catch (desigErr) {
        console.error("Failed to fetch designations", desigErr);
      }

      try {
        const cResp = await fetch(`${API_BASE_URL}/clients/`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (cResp.ok) {
          setClients(await cResp.json());
        }
      } catch (cErr) {
        console.error("Failed to fetch clients", cErr);
      }
      
      setIsLoading(false);
    }
  };

  const updateStatus = async (url, statusLabel) => {
    try {
      const resp = await fetch(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ status: statusLabel })
      });
      if (resp.ok) fetchData();
    } catch (e) { Alert.alert("Error updating status"); }
  };

  const validateTrip = async (tripId) => {
    if (!bookedAmount || isNaN(parseFloat(bookedAmount))) {
      Alert.alert("Required", "Please enter a valid bhada / income amount");
      return;
    }

    try {
      const incomeVal = parseFloat(bookedAmount);
      const party = validationPartyName.trim();
      const todayStr = formatLocalDate(new Date());
      const vehNum = selectedTrip?.vehicle_number || '';
      const rOrigin = selectedTrip?.origin || '';
      const rDest = selectedTrip?.destination || '';

      // 1. Update Trip Status & freight_notes (Party Name)
      await fetch(`${API_BASE_URL}/trips/${tripId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({
          status: 'VALIDATED',
          bhada: incomeVal,
          freight_notes: party || null
        })
      });

      // 2. Add to Daily Ledger (TRIP_INCOME)
      try {
        await fetch(`${API_BASE_URL}/workforce/daily-ledger`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
          body: JSON.stringify({
            transaction_type: 'INCOME',
            category: 'TRIP_INCOME',
            amount: incomeVal,
            description: `Trip #${tripId} Bhada - ${vehNum}${party ? ` (Party: ${party})` : ''}`,
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
                txn_type: 'BILLED',
                amount: incomeVal,
                date: todayStr,
                payment_mode: 'CREDIT',
                notes: `Trip #${tripId} (${vehNum}): ${rOrigin || 'Start'} to ${rDest || 'End'}`
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
        `Trip #${tripId} approved! Bhada (₹${incomeVal.toLocaleString('en-IN')}) synced to Daily Ledger${party ? ` & Client Khata (${party})` : ''}.`
      );
      setIsValidationModalVisible(false);
      setBookedAmount('');
      setReceivedAmount('');
      setValidationPartyName('');
      setShowValidationClientDropdown(false);
      fetchData();
    } catch (error) {
      Alert.alert("Error", "Validation failed");
    }
  };

  const openValidationModal = (trip) => {
    setSelectedTrip(trip);
    setBookedAmount(trip?.bhada ? String(trip.bhada) : '');
    setReceivedAmount(trip?.advance_freight_received ? String(trip.advance_freight_received) : '');
    setValidationPartyName(trip?.freight_notes || '');
    setShowValidationClientDropdown(false);
    setIsValidationModalVisible(true);
  };

  const openImage = (url) => {
    setViewerUrl(url);
    setViewerVisible(true);
  };

  const deleteUser = (uid) => {
    Alert.alert(
      "Delete User?",
      "Are you sure you want to permanently remove this user?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
          try {
            const resp = await fetch(`${API_BASE_URL}/auth/users/${uid}`, { 
              method: 'DELETE', headers: { 'Authorization': `Bearer ${userToken}` }
            });
            if (resp.ok) fetchData();
          } catch (e) { Alert.alert("Error deleting user"); }
        }}
      ]
    );
  };

  const createUser = async () => {
    if (!newDesignation) {
      Alert.alert("Required Field", "Please select a Designation first.");
      return;
    }
    if (!newUsername || !newPassword || !newFullName) {
      Alert.alert("Required Fields", "Please enter username, password and full name.");
      return;
    }
    
    // Auto-derive access level role from selectedCategory
    let derivedRole = 'STAFF';
    if (selectedCategory === 'ADMIN') derivedRole = 'ADMIN';
    else if (selectedCategory === 'MANAGER') derivedRole = 'MANAGER';

    try {
      const resp = await fetch(`${API_BASE_URL}/auth/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: derivedRole,
          full_name: newFullName,
          phone_number: newPhoneNumber,
          site_id: newSiteId ? parseInt(newSiteId) : (sites[0]?.id || 1),
          designation: newDesignation,
          profile_photo_url: newProfilePhoto,
          aadhar_id: newAadharId,
          address: newAddress,
          relative_name: newRelativeName,
          relative_relation: newRelativeRelation,
          relative_phone_number: newRelativePhone,
          opening_balance: parseFloat(newOpeningBalance) || 0.0,
          salary: parseFloat(newSalary) || 0.0,
          starting_date: formatLocalDate(newStartingDate),
          employment_type: newEmploymentType,
          is_active: newIsActive,
          assigned_vehicle: newAssignedVehicle.trim() || null,
          aadhar_front_url: newAadharFront,
          aadhar_back_url: newAadharBack
        })
      });
      if (resp.ok) {
        setNewUsername('');
        setNewPassword('');
        setNewFullName('');
        setNewPhoneNumber('');
        setNewDesignation('');
        setNewProfilePhoto(null);
        setNewAadharId('');
        setNewAddress('');
        setNewRelativeName('');
        setNewRelativeRelation('');
        setNewRelativePhone('');
        setNewOpeningBalance('0');
        setNewSalary('0');
        setNewStartingDate(new Date());
        setNewIsActive(true);
        setNewEmploymentType('PERMANENT');
        setNewAssignedVehicle('');
        setNewAadharFront(null);
        setNewAadharBack(null);
        setNewSiteId('');
        fetchData();
        setIsUserModalVisible(false);
        Alert.alert("Success", "User created successfully!");
      } else {
        const err = await resp.json();
        Alert.alert("Error", err.detail || "Could not create user.");
      }
    } catch (e) { Alert.alert("Error creating user", e.message); }
  };

  const handleCreateDesignation = async () => {
    if (!newCustomDesignation.trim()) {
      Alert.alert("Error", "Designation name cannot be empty");
      return;
    }
    try {
      setIsLoading(true);
      const resp = await fetch(`${API_BASE_URL}/auth/designations/`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify({ 
          name: newCustomDesignation.trim().toUpperCase(),
          category: selectedCategory
        })
      });
      if (resp.ok) {
        Alert.alert("Success", "Designation added!");
        setNewCustomDesignation('');
        setIsDesignationModalVisible(false);
        // Refresh designations
        const desigResp = await fetch(`${API_BASE_URL}/auth/designations/`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (desigResp.ok) setDesignationsList(await desigResp.json());
      } else {
        const data = await resp.json();
        Alert.alert("Error", data.detail || "Could not add designation");
      }
    } catch (e) {
      Alert.alert("Error", "Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDesignation = async (id) => {
    try {
      setIsLoading(true);
      const resp = await fetch(`${API_BASE_URL}/auth/designations/${id}/`, {
        method: 'DELETE',
        headers: { 
          'Authorization': `Bearer ${userToken}`
        }
      });
      if (resp.ok) {
        Alert.alert("Success", "Designation deleted!");
        fetchDesignations();
      } else {
        const data = await resp.json();
        Alert.alert("Error", data.detail || "Could not delete designation");
      }
    } catch (e) {
      Alert.alert("Error", "Network error");
    } finally {
      setIsLoading(false);
    }
  };

  const openEditModal = (u) => {
    setEditingUser(u); setEditUsername(u.username); setEditFullName(u.full_name || ''); setEditPhoneNumber(u.phone_number || ''); setEditRole(u.role); setEditPassword('');
    setIsEditModalVisible(true);
  };

  const submitEditUser = async () => {
    try {
      const body = { username: editUsername, role: editRole, full_name: editFullName, phone_number: editPhoneNumber };
      if (editPassword) body.password = editPassword;
      const resp = await fetch(`${API_BASE_URL}/auth/users/${editingUser.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify(body)
      });
      if (resp.ok) { setIsEditModalVisible(false); fetchData(); }
    } catch (e) { Alert.alert("Error updating user"); }
  };

  const createEmi = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/workforce/emi`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ vehicle_number: emiVehicle, emi_amount: parseFloat(emiAmount), emi_due_date: formatLocalDate(emiDate) })
      });
      if (resp.ok) { setEmiVehicle(''); setEmiAmount(''); fetchData(); setIsEmiModalVisible(false); }
    } catch (e) { Alert.alert("Error scheduling EMI"); }
  };

  const deleteEmi = (id) => {
    Alert.alert(
      "Delete EMI Record?",
      "Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: async () => {
          try {
            const resp = await fetch(`${API_BASE_URL}/workforce/emi/${id}`, { 
              method: 'DELETE', headers: { 'Authorization': `Bearer ${userToken}` }
            });
            if (resp.ok) fetchData();
          } catch (e) { Alert.alert("Error deleting EMI"); }
        }}
      ]
    );
  };

  const openEditEmiModal = (e) => {
    setEditingEmi(e); setEditEmiVehicle(e.vehicle_number); setEditEmiAmount(e.emi_amount.toString()); setEditEmiDate(new Date(e.emi_due_date));
    setIsEmiEditModalVisible(true);
  };

  const submitEditEmi = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/workforce/emi/${editingEmi.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ vehicle_number: editEmiVehicle, emi_amount: parseFloat(editEmiAmount), emi_due_date: formatLocalDate(editEmiDate) })
      });
      if (resp.ok) { setIsEmiEditModalVisible(false); fetchData(); }
    } catch (e) { Alert.alert("Error updating EMI"); }
  };

  const markEmiPaid = async (id) => {
    try {
      const resp = await fetch(`${API_BASE_URL}/workforce/emi/${id}/mark_paid`, { method: 'PATCH', headers: { 'Authorization': `Bearer ${userToken}` }});
      if (resp.ok) { Alert.alert("Success", "Paid!"); fetchData(); }
    } catch (e) { Alert.alert("Error marking paid"); }
  };

  const handleMarkAttendance = async (sid, date, status = "PRESENT") => {
    try {
      const resp = await fetch(`${API_BASE_URL}/workforce/attendance`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ staff_id: sid, date, status, notes: "Admin mark" })
      });
      if (resp.ok) fetchData();
    } catch (e) { Alert.alert("Error marking attendance"); }
  };



  const getDaysRemaining = (d) => {
    const diff = new Date(d) - new Date().setHours(0,0,0,0);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const performPunchClockAction = async (punchType) => {
    if (!selectedStaffForPunch) {
      Alert.alert("Select Employee", "Please select a staff member first.");
      return;
    }
    
    // Request permissions
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraStatus !== 'granted') {
      Alert.alert('Permission Denied', 'Camera permission is required');
      return;
    }

    try {
      // Launch Camera
      let cameraResult = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'images',
        allowsEditing: false,
        quality: 0.3,
        base64: true,
      });

      if (cameraResult.canceled) return;

      const base64Photo = `data:image/jpeg;base64,${cameraResult.assets[0].base64}`;

      // Simulate location coordinates for tracking
      const simulatedLoc = `Lat: ${(22 + Math.random()).toFixed(4)}, Lon: ${(81 + Math.random()).toFixed(4)}`;

      // Post punch to backend
      const resp = await fetch(`${API_BASE_URL}/workforce/attendance/punch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({
          punch_type: punchType,
          photo: base64Photo,
          notes: `Marked by Admin (${user.username})`,
          site_id: hrSelectedSiteId ? parseInt(hrSelectedSiteId) : (selectedStaffForPunch.site_id || 1),
          location: simulatedLoc,
          staff_id: selectedStaffForPunch.id
        })
      });

      if (resp.ok) {
        Alert.alert("Success", `Punch ${punchType.toUpperCase()} marked successfully!`);
        setIsPunchStaffModalVisible(false);
        setIsPunchMenuVisible(false);
        fetchData();
      } else {
        const err = await resp.json();
        Alert.alert("Error", err.detail || "Punch action failed.");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to complete punch action.");
    }
  };

  const renderHrTab = () => {
    // 1. Filter employees based on search, designation and site selection
    const filteredStaff = users.filter(u => {
      // Search term filter
      const matchesSearch = !hrSearchText || 
        (u.full_name || '').toLowerCase().includes(hrSearchText.toLowerCase()) ||
        (u.username || '').toLowerCase().includes(hrSearchText.toLowerCase()) ||
        String(u.id).includes(hrSearchText);

      // Designation filter
      const matchesDesig = hrSelectedDesignation === 'All' || 
        (u.designation || u.role) === hrSelectedDesignation;

      // Site filter
      const matchesSite = !hrSelectedSiteId || 
        String(u.site_id) === String(hrSelectedSiteId);

      return matchesSearch && matchesDesig && matchesSite;
    });

    // Get list of unique designations to populate filter list dynamically
    const designations = ['All', ...new Set(users.map(u => u.designation || u.role).filter(Boolean))];

    // Format selected date
    const formattedDateString = hrSelectedDate.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' });

    // Date compare string format: YYYY-MM-DD (Formed locally instead of using UTC .toISOString() to prevent offset mismatches)
    const yearLocal = hrSelectedDate.getFullYear();
    const monthLocal = String(hrSelectedDate.getMonth() + 1).padStart(2, '0');
    const dayLocal = String(hrSelectedDate.getDate()).padStart(2, '0');
    const isoDateStr = `${yearLocal}-${monthLocal}-${dayLocal}`;

    const selectedSite = sites.find(s => String(s.id) === String(hrSelectedSiteId));
    const siteLabel = selectedSite ? selectedSite.name : 'All Sites';

    return (
      <View style={{ flex: 1, backgroundColor: 'white' }}>
        {/* Safe Area Wrapper Area White instead of Grey */}
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6, zIndex: 50 }}>
          {/* Header Row: Title & Site Selector Dropdown */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#1E293B' }}>Attendance</Text>
            </View>
            <View style={{ position: 'relative', zIndex: 99 }}>
              <TouchableOpacity 
                style={{ flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, height: 36, paddingHorizontal: 12, backgroundColor: '#F8FAFC', gap: 6 }}
                onPress={() => setIsSiteDropdownVisible(!isSiteDropdownVisible)}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>{siteLabel}</Text>
                <MaterialCommunityIcons name={isSiteDropdownVisible ? "chevron-up" : "chevron-down"} size={18} color="#64748B" />
              </TouchableOpacity>
              
              {isSiteDropdownVisible && (
                <View style={{ position: 'absolute', top: 40, right: 0, width: 140, backgroundColor: 'white', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 5, paddingVertical: 4 }}>
                  <TouchableOpacity 
                    style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: !hrSelectedSiteId ? '#F1F5F9' : 'transparent' }}
                    onPress={() => {
                      setHrSelectedSiteId('');
                      setIsSiteDropdownVisible(false);
                      fetchData();
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#1E293B' }}>All Sites</Text>
                  </TouchableOpacity>
                  {(sites || []).map(s => (
                    <TouchableOpacity 
                      key={s.id}
                      style={{ paddingHorizontal: 12, paddingVertical: 8, backgroundColor: String(hrSelectedSiteId) === String(s.id) ? '#F1F5F9' : 'transparent' }}
                      onPress={() => {
                        setHrSelectedSiteId(String(s.id));
                        setIsSiteDropdownVisible(false);
                        fetchData();
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#1E293B' }}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Search bar input row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, height: 42, marginBottom: 10 }}>
            <MaterialCommunityIcons name="magnify" size={20} color="#64748B" style={{ marginRight: 8 }} />
            <TextInput 
              style={{ flex: 1, color: '#1E293B', fontSize: 14 }} 
              placeholder="Search here..." 
              placeholderTextColor="#94A3B8"
              value={hrSearchText}
              onChangeText={setHrSearchText}
            />
            <MaterialCommunityIcons name="microphone" size={20} color="#64748B" />
          </View>

          {/* Date Picker trigger & Designation selection row */}
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <TouchableOpacity 
              style={{ flex: 1.2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, paddingHorizontal: 10, height: 38 }}
              onPress={() => setShowHrDatePicker(true)}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B' }}>{formattedDateString}</Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>

            <View style={{ flex: 2, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8, height: 38, justifyContent: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 4 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', gap: 6 }}>
                {designations.map(des => (
                  <TouchableOpacity 
                    key={des} 
                    style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, backgroundColor: hrSelectedDesignation === des ? '#E2E8F0' : 'transparent' }}
                    onPress={() => setHrSelectedDesignation(des)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#334155' }}>{des}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          {showHrDatePicker && (
            <DateTimePicker
              value={hrSelectedDate}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowHrDatePicker(false);
                if (selectedDate) setHrSelectedDate(selectedDate);
              }}
            />
          )}

          {/* Stats Bar */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6, marginBottom: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: '#334155', textTransform: 'uppercase' }}>Filtered Results: {filteredStaff.length}</Text>
          </View>
        </View>

        {/* Scrollable list of day's attendance logs */}
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 80 }}>
          {filteredStaff.map(emp => {
            // Find today's specific attendance entry
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
                key={`hr-emp-${emp.id}`} 
                style={{ flexDirection: 'row', backgroundColor: 'white', borderRadius: 14, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: record ? '#E2E8F0' : '#F1F5F9', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 }}
                onPress={() => {
                  setManualAttendanceStaff(emp);
                  setManualAttendanceRecord(record || null);
                  setIsManualAttendanceModalVisible(true);
                }}
              >
                {/* User Image / Photo placeholder */}
                {record?.punch_in_photo_url ? (
                  <TouchableOpacity onPress={() => {
                    setSelectedPunchRecordDetails({ emp, record });
                    setIsPunchDetailsModalVisible(true);
                  }}>
                    <Image source={{ uri: record.punch_in_photo_url }} style={{ width: 50, height: 50, borderRadius: 10, marginRight: 12 }} />
                  </TouchableOpacity>
                ) : emp.profile_photo_url ? (
                  <Image source={{ uri: emp.profile_photo_url }} style={{ width: 50, height: 50, borderRadius: 10, marginRight: 12 }} />
                ) : (
                  <View style={{ width: 50, height: 50, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Text style={{ fontSize: 22 }}>👤</Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, flexWrap: 'wrap' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>#{emp.id} {emp.full_name || emp.username}</Text>
                        <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' }}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: '#475569' }}>{emp.username}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 11, color: '#64748B', marginLeft: 4 }}>({emp.employee_of === 'CONTRACTOR' ? 'C' : 'D'})</Text>
                    </View>
                    
                    {/* Status Badge */}
                    <View style={{ backgroundColor: badgeBg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: `${badgeText}30` }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: badgeText }}>{badgeLabel}</Text>
                    </View>
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="clock-outline" size={13} color="#2563EB" />
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginLeft: 3 }}>
                        {record?.punch_in_time ? new Date(record.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : (record ? 'Manual' : '--:--')}
                      </Text>
                    </View>

                    {record?.punch_out_time && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="clock-check-outline" size={13} color="#DC2626" />
                        <Text style={{ fontSize: 11, fontWeight: '700', color: '#DC2626', marginLeft: 3 }}>
                          Out: {new Date(record.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    )}

                    <Text style={{ fontSize: 11, color: '#64748B' }}>
                      {emp.designation || emp.role}
                    </Text>
                  </View>

                  {record?.notes ? (
                    <Text style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }} numberOfLines={1}>
                      📝 {record.notes}
                    </Text>
                  ) : null}
                </View>

                {/* Edit / Action indicator */}
                <View style={{ marginLeft: 8, padding: 4 }}>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Floating actions menu trigger button */}
        <TouchableOpacity 
          style={{ position: 'absolute', right: 24, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.27, shadowRadius: 4.65 }}
          onPress={() => setIsPunchMenuVisible(!isPunchMenuVisible)}
        >
          <MaterialCommunityIcons name={isPunchMenuVisible ? "close" : "plus"} size={30} color="white" />
        </TouchableOpacity>

        {/* Floating punch & manual attendance menu selections */}
        {isPunchMenuVisible && (
          <View style={{ position: 'absolute', right: 24, bottom: 90, gap: 10, zIndex: 10, alignItems: 'flex-end' }}>
            {/* 1. Manual Attendance Option */}
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#2563EB', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}
              onPress={() => {
                setManualAttendanceStaff(null);
                setManualAttendanceRecord(null);
                setIsManualAttendanceModalVisible(true);
                setIsPunchMenuVisible(false);
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800', marginRight: 8, fontSize: 13 }}>Manual Attendance</Text>
              <MaterialCommunityIcons name="clipboard-check-outline" size={18} color="white" />
            </TouchableOpacity>

            {/* 2. Face Punch In */}
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}
              onPress={() => {
                setPunchingType('in');
                setIsPunchStaffModalVisible(true);
                setIsPunchMenuVisible(false);
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800', marginRight: 8, fontSize: 13 }}>Punch In (Face Scan)</Text>
              <MaterialCommunityIcons name="camera-outline" size={18} color="white" />
            </TouchableOpacity>

            {/* 3. Face Punch Out */}
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#DC2626', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}
              onPress={() => {
                setPunchingType('out');
                setIsPunchStaffModalVisible(true);
                setIsPunchMenuVisible(false);
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800', marginRight: 8, fontSize: 13 }}>Punch Out (Face Scan)</Text>
              <MaterialCommunityIcons name="camera-off-outline" size={18} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* Modal: Select employee to punch in/out via face scan */}
        {isPunchStaffModalVisible && (
          <View style={{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', zIndex: 99 }}>
            <View style={{ width: '90%', maxHeight: '80%', backgroundColor: 'white', borderRadius: 16, padding: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' }}>
                Select Staff to Punch {punchingType === 'in' ? 'In' : 'Out'}
              </Text>
              
              <FlatList
                data={users.filter(u => u.is_active)}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    onPress={() => {
                      setSelectedStaffForPunch(item);
                      performPunchClockAction(punchingType);
                    }}
                  >
                    <Text style={{ fontSize: 15, fontWeight: '700', color: '#1E293B' }}>{item.full_name || item.username}</Text>
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>{item.designation || item.role}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#9CA3AF', marginVertical: 20 }}>No active staff found.</Text>}
              />

              <TouchableOpacity 
                style={[styles.cancelBtn, { marginTop: 15 }]} 
                onPress={() => setIsPunchStaffModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Manual Attendance Modal */}
        <ManualAttendanceModal
          visible={isManualAttendanceModalVisible}
          onClose={() => setIsManualAttendanceModalVisible(false)}
          onSaveSuccess={() => fetchData()}
          initialStaff={manualAttendanceStaff}
          initialDate={hrSelectedDate}
          initialRecord={manualAttendanceRecord}
          staffList={users.filter(u => u.is_active)}
          sites={sites}
          userToken={userToken}
          currentRole="ADMIN"
          activeSiteId={hrSelectedSiteId || selectedSite?.id}
        />
      </View>
    );
  };

  const renderUsersTab = () => (
    <View style={{flex: 1}}>
      <ScrollView 
        ref={usersScrollViewRef}
        style={{flex: 1}} 
        contentContainerStyle={{padding: 16, paddingBottom: 80}}
        onScroll={(e) => { usersScrollYRef.current = e.nativeEvent.contentOffset.y; }}
        scrollEventThrottle={16}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={async () => { setIsRefreshing(true); await fetchData(); setIsRefreshing(false); }} />}
      >
         <View style={styles.emiHeader}>
            <View>
              <Text style={styles.emiHeaderLabel}>TEAM MANAGEMENT</Text>
              <Text style={styles.emiHeaderTitle}>Staff & Managers</Text>
            </View>
            {users.length > 1 && (
              <TouchableOpacity 
                style={[styles.reorderToggleBtn, isUserArrangeMode && styles.reorderToggleBtnActive]} 
                onPress={() => setIsUserArrangeMode(!isUserArrangeMode)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name={isUserArrangeMode ? "check-circle" : "swap-vertical"} size={16} color={isUserArrangeMode ? "#FFFFFF" : "#2563EB"} />
                <Text style={[styles.reorderToggleBtnText, isUserArrangeMode && { color: "#FFFFFF" }]}>
                  {isUserArrangeMode ? "Done Arranging" : "Arrange Order"}
                </Text>
              </TouchableOpacity>
            )}
         </View>
         {users.length === 0 ? (
           <View style={{ alignItems: 'center', justifyContent: 'center', paddingVertical: 40 }}>
             <MaterialCommunityIcons name="account-group-outline" size={48} color="#94A3B8" />
             <Text style={{ fontSize: 16, fontWeight: '700', color: '#64748B', marginTop: 10 }}>No Staff Found</Text>
             <Text style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>Add your first team member using the + button below.</Text>
           </View>
         ) : isUserArrangeMode ? (
           <DraggableCardList
             items={users}
             itemHeight={64}
             gap={8}
             paddingHorizontal={0}
             storageKey="@admin_users_order_v1"
             scrollViewRef={usersScrollViewRef}
             scrollYRef={usersScrollYRef}
             dragHint="Hold & drag row to arrange staff order"
             onOrderChange={(reordered) => setUsers(reordered)}
             renderItem={(u) => (
               <View style={styles.reorderCompactCard}>
                 <MaterialCommunityIcons name="drag-horizontal-variant" size={22} color="#64748B" style={{ marginRight: 10 }} />
                 {u.profile_photo_url && typeof u.profile_photo_url === 'string' && u.profile_photo_url.trim().length > 0 ? (
                   <Image 
                     source={{ uri: u.profile_photo_url }} 
                     style={{ width: 36, height: 36, borderRadius: 18, marginRight: 10, backgroundColor: '#E2E8F0' }} 
                     resizeMode="cover"
                   />
                 ) : (
                   <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: u.role === 'MANAGER' ? '#DBEAFE' : '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginRight: 10 }}>
                     <Text style={{ fontSize: 16 }}>{u.role === 'MANAGER' ? '👔' : '👤'}</Text>
                   </View>
                 )}
                 <View style={{ flex: 1 }}>
                   <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }} numberOfLines={1}>
                     {u.full_name || u.username}
                   </Text>
                   <Text style={{ fontSize: 11, color: '#64748B' }} numberOfLines={1}>
                     {u.designation || u.role} • ID: {u.username}
                   </Text>
                 </View>
                 <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: u.is_active ? '#10B981' : '#F59E0B' }} />
               </View>
             )}
           />
         ) : (
           users.map((u) => {
             // Calculate current balance: dailyLedgerEntries filtered by u.id (staff_id) + u.opening_balance
             const uLedgerEntries = dailyLedgerEntries.filter(e => e.staff_id === u.id);
             const ledgerSum = uLedgerEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
             const currentBalance = ledgerSum + (u.opening_balance || 0);
             const site = sites.find(s => s.id === u.site_id);
             const siteName = site ? site.name : 'No Site';
             
             // Format added/created date
              const createdDate = u.created_at ? (() => { const d = new Date(u.created_at); const dd = String(d.getDate()).padStart(2, '0'); const mm = String(d.getMonth() + 1).padStart(2, '0'); const yyyy = d.getFullYear(); return `${dd}-${mm}-${yyyy}`; })() : 'N/A';
             const createdBy = u.created_by || 'N/A';

             return (
               <TouchableOpacity 
                 key={`u-${u.id}`} 
                 style={styles.staffCardFluid} 
                 activeOpacity={0.85}
                 onPress={() => navigation.navigate('UserProfile', { userProfile: u, userToken, dailyLedgerEntries, sites })}
               >
                 <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                   {/* Photo or fallback placeholder */}
                   {u.profile_photo_url && typeof u.profile_photo_url === 'string' && u.profile_photo_url.trim().length > 0 ? (
                     <Image 
                       source={{ uri: u.profile_photo_url }} 
                       style={{ width: 48, height: 48, borderRadius: 24, marginRight: 12, backgroundColor: '#E2E8F0', borderWidth: 1.5, borderColor: '#CBD5E1', marginTop: 2 }} 
                       resizeMode="cover"
                     />
                   ) : (
                     <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: u.role === 'MANAGER' ? '#DBEAFE' : '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginRight: 12, borderWidth: 1.5, borderColor: u.role === 'MANAGER' ? '#BFDBFE' : '#A7F3D0', marginTop: 2 }}>
                       <Text style={{ fontSize: 18 }}>{u.role === 'MANAGER' ? '👔' : '👤'}</Text>
                     </View>
                   )}
                   
                   <View style={{ flex: 1, marginRight: 8 }}>
                     <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' }}>
                       <Text style={{ fontSize: 15, fontWeight: '800', color: '#111827', marginRight: 6 }}>{u.full_name || u.username}</Text>
                       <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: u.is_active ? '#10B981' : '#F59E0B' }} />
                     </View>
                     
                     {/* User ID (Username) Badge & Role */}
                     <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                       <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' }}>
                         <Text style={{ fontSize: 10, fontWeight: '800', color: '#334155' }}>User ID: {u.username}</Text>
                       </View>
                       <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748B' }}>#{u.id}</Text>
                       <Text style={{ fontSize: 11, color: '#6B7280', fontWeight: '600' }}>• {u.designation || u.role}</Text>
                     </View>
                     
                     {/* Phone Dialer & Site */}
                     <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                       {u.phone_number ? (
                         <TouchableOpacity
                           onPress={() => {
                             const clean = String(u.phone_number).replace(/[^0-9+]/g, '');
                             if (clean) Linking.openURL(`tel:${clean}`);
                           }}
                           activeOpacity={0.7}
                           style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                         >
                           <MaterialCommunityIcons name="phone" size={12} color="#2563EB" />
                           <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '700' }}>{u.phone_number}</Text>
                         </TouchableOpacity>
                       ) : (
                         <Text style={{ fontSize: 11, color: '#94A3B8' }}>📞 N/A</Text>
                       )}
                       <Text style={{ fontSize: 11, color: '#64748B' }}>📍 {siteName}</Text>
                     </View>

                     {u.assigned_vehicle ? (
                       <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                         {u.assigned_vehicle.split(',').map((v, idx) => (
                           <View key={idx} style={{ backgroundColor: '#EFF6FF', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#BFDBFE' }}>
                             <Text style={{ fontSize: 10, color: '#1D4ED8', fontWeight: '700' }}>🚛 {v.trim()}</Text>
                           </View>
                         ))}
                       </View>
                     ) : null}
                     
                     {/* Audit Trail */}
                     <Text style={{ fontSize: 9.5, color: '#9CA3AF', marginTop: 4 }}>Add By: {createdBy} | {createdDate}</Text>
                   </View>
                   
                   {/* Current Balance */}
                   <View style={{ alignItems: 'flex-end', marginLeft: 4, alignSelf: 'flex-start' }}>
                     <Text style={{ fontSize: 9, fontWeight: '800', color: '#6B7280', marginBottom: 2 }}>BALANCE</Text>
                     <Text style={{ fontSize: 14, fontWeight: '900', color: currentBalance < 0 ? '#DC2626' : '#111827' }}>
                       ₹{currentBalance.toLocaleString()}
                     </Text>
                   </View>
                 </View>
               </TouchableOpacity>
             );
           })
         )}
      </ScrollView>
      {/* Floating circular + New User button */}
      <TouchableOpacity 
        style={{ position: 'absolute', right: 24, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.27, shadowRadius: 4.65 }}
        onPress={() => setIsUserModalVisible(true)}
      >
        <MaterialCommunityIcons name="plus" size={30} color="white" />
      </TouchableOpacity>
    </View>
  );

  const renderTripsList = () => (
    <View style={{flex: 1}}>
      <ScrollView 
        style={{flex: 1}} 
        contentContainerStyle={{padding: 16, paddingBottom: 40}}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={async () => { setIsRefreshing(true); await fetchData(); setIsRefreshing(false); }} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.emiHeader}>
          <View>
            <Text style={styles.emiHeaderLabel}>OPERATIONAL LOGS</Text>
            <Text style={styles.emiHeaderTitle}>Log Book</Text>
          </View>
          <TouchableOpacity style={styles.emiAddBtn} onPress={() => setIsTripModalVisible(true)} activeOpacity={0.8}>
            <MaterialCommunityIcons name="plus" size={18} color="white" />
            <Text style={styles.emiAddBtnText}>Log Trip</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Bar */}
        <View style={styles.tripFilterContainer}>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
            <TouchableOpacity style={styles.dateSelectorPill} onPress={() => setShowStartPicker(true)}>
              <MaterialCommunityIcons name="calendar-import" size={15} color="#0284C7" />
              <Text style={styles.dateSelectorPillText}>{tripStartDate || "Start Date"}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dateSelectorPill} onPress={() => setShowEndPicker(true)}>
              <MaterialCommunityIcons name="calendar-export" size={15} color="#0284C7" />
              <Text style={styles.dateSelectorPillText}>{tripEndDate || "End Date"}</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={styles.tripSearchBox}>
              <MaterialCommunityIcons name="magnify" size={18} color="#64748B" />
              <TextInput 
                style={styles.tripSearchInput} 
                placeholder="Search Vehicle (e.g. MH04)" 
                placeholderTextColor="#94A3B8"
                value={vehicleSearch} 
                onChangeText={setVehicleSearch} 
              />
            </View>
            <TouchableOpacity style={styles.filterApplyBtn} onPress={fetchData} activeOpacity={0.8}>
              <MaterialCommunityIcons name="filter-variant" size={18} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {showStartPicker && (
            <DateTimePicker
                value={tripStartDateDt} mode="date" display="default"
                onChange={(event, date) => {
                    setShowStartPicker(false);
                    if (date) { setTripStartDateDt(date); setTripStartDate(formatLocalDate(date)); }
                }}
            />
        )}
        {showEndPicker && (
            <DateTimePicker
                value={tripEndDateDt} mode="date" display="default"
                onChange={(event, date) => {
                    setShowEndPicker(false);
                    if (date) { setTripEndDateDt(date); setTripEndDate(formatLocalDate(date)); }
                }}
            />
        )}

        {trips.length === 0 ? (
          <View style={styles.emptyTripState}>
            <View style={styles.emptyTripIconBox}>
              <MaterialCommunityIcons name="truck-cargo-container" size={38} color="#94A3B8" />
            </View>
            <Text style={styles.emptyTripTitle}>No Trip Records</Text>
            <Text style={styles.emptyTripSub}>No trip logs matched the selected date or vehicle criteria.</Text>
          </View>
        ) : (
          trips.map(t => {
            const isValidated = t.status === 'VALIDATED' || t.status === 'APPROVED';
            return (
              <View key={`t-${t.id}`} style={styles.tripCard}>
                {/* Header */}
                <View style={styles.tripCardHeader}>
                  <View style={styles.tripVehicleBadge}>
                    <MaterialCommunityIcons name="truck-fast-outline" size={20} color="#0F172A" />
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.tripVehicleNum} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{t.vehicle_number}</Text>
                      <Text style={styles.tripDriverName} numberOfLines={1}>Driver: {t.staff_name || 'Assigned Staff'}</Text>
                    </View>
                  </View>
                  <View style={[styles.tripStatusTag, { backgroundColor: isValidated ? '#ECFDF5' : '#FEF3C7', borderColor: isValidated ? '#A7F3D0' : '#FDE68A' }]}>
                    <View style={[styles.tripStatusDot, { backgroundColor: isValidated ? '#10B981' : '#D97706' }]} />
                    <Text style={[styles.tripStatusText, { color: isValidated ? '#065F46' : '#92400E' }]}>{t.status}</Text>
                  </View>
                </View>

                {/* Route Pill Box */}
                <View style={styles.tripRouteBox}>
                  <View style={styles.tripRouteRow}>
                    <MaterialCommunityIcons name="map-marker-radius" size={16} color="#059669" />
                    <Text style={styles.tripRouteLabel}>Origin:</Text>
                    <Text style={styles.tripRouteValue} numberOfLines={1}>{t.origin || 'Not specified'}</Text>
                  </View>
                  <View style={styles.tripRouteRow}>
                    <MaterialCommunityIcons name="flag-checkered" size={16} color="#2563EB" />
                    <Text style={styles.tripRouteLabel}>Dest:</Text>
                    <Text style={styles.tripRouteValue} numberOfLines={1}>{t.destination || 'Not specified'}</Text>
                  </View>
                  {!!t.freight_notes && (
                    <View style={[styles.tripRouteRow, { marginTop: 4, paddingTop: 4, borderTopWidth: 1, borderTopColor: '#E2E8F0' }]}>
                      <MaterialCommunityIcons name="account-tie" size={16} color="#7C3AED" />
                      <Text style={[styles.tripRouteLabel, { color: '#7C3AED' }]}>Party:</Text>
                      <Text style={[styles.tripRouteValue, { fontWeight: '700', color: '#1E293B' }]} numberOfLines={1}>{t.freight_notes}</Text>
                    </View>
                  )}
                </View>

                {/* Metrics Grid */}
                <View style={styles.tripMetricsGrid}>
                  <View style={styles.tripMetricItem}>
                    <Text style={styles.tripMetricLabel}>MATERIAL</Text>
                    <Text style={styles.tripMetricVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t.material_type || 'N/A'}</Text>
                    <Text style={styles.tripMetricSub} numberOfLines={1}>{t.weight_tons ? `${t.weight_tons} Tons` : ''}</Text>
                  </View>
                  <View style={styles.tripMetricDivider} />
                  <View style={styles.tripMetricItem}>
                    <Text style={styles.tripMetricLabel}>DISTANCE</Text>
                    <Text style={styles.tripMetricVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t.total_km || 0} KM</Text>
                    <Text style={styles.tripMetricSub} numberOfLines={1}>Logged odometer</Text>
                  </View>
                  <View style={styles.tripMetricDivider} />
                  <View style={styles.tripMetricItem}>
                    <Text style={styles.tripMetricLabel}>DIESEL</Text>
                    <Text style={styles.tripMetricVal} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{t.diesel_liters ? `${t.diesel_liters}L` : '0L'}</Text>
                    <Text style={styles.tripMetricSub} numberOfLines={1}>{t.diesel_cost ? `₹${t.diesel_cost}` : '₹0'}</Text>
                  </View>
                </View>

                {/* Photos Row */}
                {(t.loading_photo_url || t.unloading_photo_url || t.receipt_photo_url) && (
                  <View style={styles.tripPhotosRow}>
                    {t.loading_photo_url && (
                      <TouchableOpacity onPress={() => openImage(t.loading_photo_url)} style={styles.photoBox}>
                        <Image source={{uri: t.loading_photo_url}} style={styles.tripThumbnail} />
                        <Text style={styles.photoLabel}>Loading</Text>
                      </TouchableOpacity>
                    )}
                    {t.unloading_photo_url && (
                      <TouchableOpacity onPress={() => openImage(t.unloading_photo_url)} style={styles.photoBox}>
                        <Image source={{uri: t.unloading_photo_url}} style={styles.tripThumbnail} />
                        <Text style={styles.photoLabel}>Unloading</Text>
                      </TouchableOpacity>
                    )}
                    {t.receipt_photo_url && (
                      <TouchableOpacity onPress={() => openImage(t.receipt_photo_url)} style={styles.photoBox}>
                        <Image source={{uri: t.receipt_photo_url}} style={styles.tripThumbnail} />
                        <Text style={styles.photoLabel}>Bilty/Bill</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}

                {/* Footer Bar */}
                <View style={styles.tripCardFooter}>
                  <View>
                    <Text style={styles.tripDateLabel}>LOGGED DATE</Text>
                    <Text style={styles.tripDateValue}>
                      {(() => {
                        const d = new Date(t.created_at);
                        const dd = String(d.getDate()).padStart(2, '0');
                        const mm = String(d.getMonth() + 1).padStart(2, '0');
                        const yyyy = d.getFullYear();
                        return `${dd}-${mm}-${yyyy}`;
                      })()}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', flex: 1, marginLeft: 8 }}>
                    <Text style={styles.tripDateLabel}>BHADA / INCOME</Text>
                    <Text style={styles.tripIncomeValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>₹{t.bhada || 0}</Text>
                  </View>
                </View>

                {t.status === 'PENDING' && (
                  <TouchableOpacity 
                    style={styles.tripValidateBtn} 
                    onPress={() => openValidationModal(t)}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons name="check-decagram" size={18} color="white" />
                    <Text style={styles.tripValidateBtnText}>VALIDATE & APPROVE TRIP</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  const renderEmiTab = () => {
    const totalOutflow = emis.reduce((sum, e) => sum + (parseFloat(e.emi_amount) || 0), 0);
    const due7 = emis.filter(e => { const d = getDaysRemaining(e.emi_due_date); return d >= 0 && d <= 7; }).length;
    const expiringCompliance = emis.filter(e => {
      const ins = getDaysRemaining(e.insurance_expiry);
      const fit = getDaysRemaining(e.fitness_expiry);
      return (ins !== null && ins <= 15) || (fit !== null && fit <= 15);
    }).length;

    return (
      <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 16, paddingBottom: 40}}>
        <View style={styles.emiHeader}>
          <View>
            <Text style={styles.emiHeaderLabel}>FINANCIALS & COMPLIANCE</Text>
            <Text style={styles.emiHeaderTitle}>EMI & Compliance Vault</Text>
          </View>
          <TouchableOpacity style={styles.emiAddBtn} onPress={() => navigation.navigate('ComplianceVault')}>
            <MaterialCommunityIcons name="shield-car" size={18} color="white" />
            <Text style={styles.emiAddBtnText}>Open Vault</Text>
          </TouchableOpacity>
        </View>

        {/* Responsive EMI Metrics: 2 cards on top, 1 full-width on bottom */}
        <View style={{ marginBottom: 20 }}>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
            <View style={[styles.emiMetricCard, { flex: 1, borderLeftColor: '#111827' }]}>
              <Text style={styles.emiMetricLabel}>TOTAL MONTHLY</Text>
              <Text style={styles.emiMetricValue} numberOfLines={1} adjustsFontSizeToFit>
                ₹{totalOutflow.toLocaleString()}
              </Text>
            </View>
            <View style={[styles.emiMetricCard, { flex: 1, borderLeftColor: '#DC2626' }]}>
              <Text style={styles.emiMetricLabel}>DUE SOON</Text>
              <Text style={[styles.emiMetricValue, { color: '#DC2626' }]} numberOfLines={1}>
                {due7}
              </Text>
            </View>
          </View>

          <View style={[styles.emiMetricCard, { borderLeftColor: '#D97706', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.emiMetricLabel}>EXPIRING COMPLIANCE</Text>
              <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 }}>
                Insurance & Fitness within 15 days
              </Text>
            </View>
            <Text style={[styles.emiMetricValue, { color: '#D97706' }]}>
              {expiringCompliance}
            </Text>
          </View>
        </View>

        {emis.map(e => {
          const days = getDaysRemaining(e.emi_due_date);
          const insDays = getDaysRemaining(e.insurance_expiry);
          const fitDays = getDaysRemaining(e.fitness_expiry);
          return (
            <TouchableOpacity key={`e-${e.id}`} style={styles.emiCard} activeOpacity={0.9} onPress={() => navigation.navigate('ComplianceVault')}>
              <View style={styles.emiCardTop}>
                <View style={styles.emiCardIcon}><Text style={styles.emiCardIconText}>🚛</Text></View>
                <View style={{flex: 1, marginLeft: 12}}>
                  <Text style={styles.emiCardVehicle}>{e.vehicle_number}</Text>
                  <Text style={styles.emiCardSub}>{e.financier || 'Monthly EMI'}</Text>
                </View>
                <View style={[styles.emiUrgencyBadge, {backgroundColor: days <= 7 ? '#FEE2E2' : '#EFF6FF'}]}>
                  <Text style={[styles.emiUrgencyBadgeText, {color: days <= 7 ? '#991B1B' : '#2563EB'}]}>{days > 0 ? `${days}d LEFT` : days === 0 ? "DUE" : "OVER"}</Text>
                </View>
              </View>

              <View style={styles.emiCardMid}>
                <View><Text style={styles.emiCardAmountLabel}>AMOUNT</Text><Text style={styles.emiCardAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>₹{parseFloat(e.emi_amount || 0).toLocaleString()}</Text></View>
                <View style={{alignItems: 'flex-end'}}><Text style={styles.emiCardAmountLabel}>DUE DATE</Text><Text style={styles.emiCardDueDate}>{e.emi_due_date ? (() => { const d = new Date(e.emi_due_date); if (isNaN(d.getTime())) return e.emi_due_date; return `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`; })() : 'N/A'}</Text></View>
              </View>

              {/* Compliance Badges Row */}
              {(e.insurance_expiry || e.fitness_expiry) && (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderColor: '#F1F5F9' }}>
                  {e.insurance_expiry && (
                    <View style={{ flex: 1, backgroundColor: '#EFF6FF', padding: 6, borderRadius: 6 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#1E40AF' }}>INSURANCE</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#1E293B' }}>{(() => { const d = new Date(e.insurance_expiry); return isNaN(d.getTime()) ? e.insurance_expiry : `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`; })()}</Text>
                      <Text style={{ fontSize: 9, color: insDays <= 7 ? '#DC2626' : '#2563EB', fontWeight: '700' }}>
                        {insDays !== null ? (insDays < 0 ? `${Math.abs(insDays)}d Expired` : `${insDays}d left`) : ''}
                      </Text>
                    </View>
                  )}
                  {e.fitness_expiry && (
                    <View style={{ flex: 1, backgroundColor: '#F0FDF4', padding: 6, borderRadius: 6 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#166534' }}>FITNESS EXPIRY</Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#1E293B' }}>{(() => { const d = new Date(e.fitness_expiry); return isNaN(d.getTime()) ? e.fitness_expiry : `${String(d.getDate()).padStart(2,'0')}-${String(d.getMonth()+1).padStart(2,'0')}-${d.getFullYear()}`; })()}</Text>
                      <Text style={{ fontSize: 9, color: fitDays <= 7 ? '#DC2626' : '#16A34A', fontWeight: '700' }}>
                        {fitDays !== null ? (fitDays < 0 ? `${Math.abs(fitDays)}d Expired` : `${fitDays}d left`) : ''}
                      </Text>
                    </View>
                  )}
                </View>
              )}

              <View style={styles.emiCardActions}>
                <TouchableOpacity style={styles.emiMarkPaidBtn} onPress={() => markEmiPaid(e.id)}><Text style={styles.emiMarkPaidText}>✓ Paid (+1 Month)</Text></TouchableOpacity>
                <View style={{flexDirection: 'row', gap: 8}}>
                  <TouchableOpacity style={styles.emiIconBtn} onPress={() => openEditEmiModal(e)}><Text style={styles.emiIconBtnText}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.emiIconBtn, {backgroundColor: '#FEE2E2'}]} onPress={() => deleteEmi(e.id)}><Text style={styles.emiIconBtnText}>🗑️</Text></TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const renderDrawer = () => (
    <Modal visible={isDrawerVisible} transparent animationType="fade" onRequestClose={() => setIsDrawerVisible(false)}>
      <TouchableOpacity style={styles.drawerOverlay} activeOpacity={1} onPress={() => setIsDrawerVisible(false)}>
        <View style={styles.drawerContent} onStartShouldSetResponder={() => true}>
          <View style={styles.drawerHeader}>
            <Image 
              source={require('../../assets/images/app-logo.png')} 
              style={{ width: 44, height: 44, borderRadius: 10, marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }} 
              resizeMode="contain"
            />
            <View><Text style={styles.drawerName}>{user?.username || 'Admin'}</Text><Text style={styles.drawerRole}>Control Center</Text></View>
          </View>
          {['trips', 'users', 'hr', 'emi'].map(id => (
            <TouchableOpacity key={id} style={[styles.drawerItem, activeTab === id && styles.drawerItemActive]} onPress={() => { setActiveTab(id); setIsDrawerVisible(false); }}>
              <MaterialCommunityIcons name={id === 'trips' ? 'truck-delivery' : id === 'users' ? 'account-group' : id === 'hr' ? 'calendar-check' : 'finance'} size={22} color={activeTab === id ? '#2563EB' : '#4B5563'} />
              <Text style={[styles.drawerItemText, activeTab === id && styles.drawerItemTextActive]}>{id.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
          
          <View style={{height: 1, backgroundColor: '#F1F5F9', marginVertical: 10}} />
          
          <TouchableOpacity style={styles.drawerItem} onPress={() => { navigation.navigate('DailyLedger'); setIsDrawerVisible(false); }}>
              <MaterialCommunityIcons name="book-open-variant" size={22} color="#4B5563" />
              <Text style={styles.drawerItemText}>DAILY LEDGER</Text>
          </TouchableOpacity>
          <View style={{flex: 1}} />
          <TouchableOpacity style={styles.drawerLogoutBtn} onPress={logout}><MaterialCommunityIcons name="logout" size={20} color="#EF4444" /><Text style={styles.drawerLogoutText}>Sign Out</Text></TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mainHeader}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ paddingRight: 10 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Image 
          source={require('../../assets/images/app-logo.png')} 
          style={{ width: 34, height: 34, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#FFFFFF' }} 
          resizeMode="contain" 
        />
        <View style={{ flex: 1, alignItems: 'center' }}>
          <SiteSelector compact={true} />
        </View>
        <TouchableOpacity onPress={() => setIsDrawerVisible(true)} style={{ paddingLeft: 10 }}>
          <MaterialCommunityIcons name="menu" size={28} color="#111827" />
        </TouchableOpacity>
      </View>
      {renderDrawer()}
      <View style={{flex: 1}}>
        {isLoading && activeTab !== 'hr' ? <ActivityIndicator size="large" color="#2563EB" style={{marginTop: 50}} /> : (
          <>
            {activeTab === 'trips' && renderTripsList()}
            {activeTab === 'users' && renderUsersTab()}
            {activeTab === 'hr' && renderHrTab()}
            {activeTab === 'emi' && renderEmiTab()}
          </>
        )}
      </View>

      {/* TRIP VALIDATION MODAL */}
      <Modal visible={isValidationModalVisible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <View>
                <Text style={[styles.modalTitle, { textAlign: 'left', marginBottom: 2 }]}>Validate & Approve Trip</Text>
                <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '700' }}>Trip #{selectedTrip?.id} • {selectedTrip?.vehicle_number}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsValidationModalVisible(false)} style={{ padding: 4 }}>
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

              {/* Trip Bhada / Income */}
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '800', color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Total Trip Bhada / Freight (₹) *
                </Text>
                <TextInput 
                  style={[styles.input, { marginBottom: 0 }]} 
                  placeholder="e.g. 45000" 
                  placeholderTextColor="#94A3B8"
                  keyboardType="numeric"
                  value={bookedAmount}
                  onChangeText={setBookedAmount}
                />
              </View>

              {/* Auto Sync Banner */}
              <View style={{ backgroundColor: '#F0FDF4', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: '#BBF7D0', flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <MaterialCommunityIcons name="check-decagram" size={16} color="#16A34A" style={{ marginRight: 8 }} />
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#166534', flex: 1 }}>
                  Validating will automatically log this Bhada to Daily Ledger (Trip Income) and Client Khata.
                </Text>
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.cancelBtn, { flex: 1, marginTop: 0 }]} onPress={() => setIsValidationModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, { flex: 2 }]} onPress={() => validateTrip(selectedTrip?.id)}>
                <Text style={styles.confirmBtnText}>Validate & Sync Ledger</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* IMAGE VIEWER MODAL */}
      <Modal visible={viewerVisible} transparent={true} animationType="fade">
          <TouchableOpacity style={styles.imageViewerOverlay} onPress={() => setViewerVisible(false)}>
             <Image source={{uri: viewerUrl}} style={styles.fullScreenImage} />
             <Text style={styles.imageViewerCloseText}>Tap anywhere to close</Text>
          </TouchableOpacity>
      </Modal>

      {/* PUNCH DETAILS MODAL */}
      <Modal visible={isPunchDetailsModalVisible} transparent={false} animationType="slide" statusBarTranslucent={true}>
        <View style={{ flex: 1, backgroundColor: 'white', paddingTop: topPadding }}>
          <View style={{ flex: 1, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
              <TouchableOpacity onPress={() => setIsPunchDetailsModalVisible(false)} style={{ paddingRight: 16 }}>
                <MaterialCommunityIcons name="arrow-left" size={26} color="#1E293B" />
              </TouchableOpacity>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>Shift Punch Details</Text>
            </View>

            {selectedPunchRecordDetails && (
              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Employee Profile Preview */}
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#2563EB', marginBottom: 20 }}>
                  {selectedPunchRecordDetails.emp.profile_photo_url ? (
                    <Image source={{ uri: selectedPunchRecordDetails.emp.profile_photo_url }} style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }} />
                  ) : (
                    <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                      <Text style={{ fontSize: 20 }}>👤</Text>
                    </View>
                  )}
                  <View>
                    <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E293B' }}>{selectedPunchRecordDetails.emp.full_name || selectedPunchRecordDetails.emp.username}</Text>
                    <Text style={{ fontSize: 12, color: '#6B7280' }}>ID: #{selectedPunchRecordDetails.emp.id} | {selectedPunchRecordDetails.emp.designation || selectedPunchRecordDetails.emp.role}</Text>
                  </View>
                </View>

                {/* Punch In Details */}
                <View style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Punch In Information</Text>
                  
                  {selectedPunchRecordDetails.record.punch_in_photo_url ? (
                    <Image source={{ uri: selectedPunchRecordDetails.record.punch_in_photo_url }} style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 12, resizeMode: 'cover', backgroundColor: '#F3F4F6' }} />
                  ) : (
                    <View style={{ height: 120, backgroundColor: '#F3F4F6', borderRadius: 8, marginBottom: 12, justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="face-recognition" size={36} color="#9CA3AF" />
                      <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>No Photo Recorded</Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Punch In Time:</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>
                      {selectedPunchRecordDetails.record.punch_in_time ? new Date(selectedPunchRecordDetails.record.punch_in_time).toLocaleString() : 'N/A'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Location:</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>
                      {selectedPunchRecordDetails.record.punch_in_location || 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* Punch Out Details */}
                <View style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#DC2626', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Punch Out Information</Text>
                  
                  {selectedPunchRecordDetails.record.punch_out_photo_url ? (
                    <Image source={{ uri: selectedPunchRecordDetails.record.punch_out_photo_url }} style={{ width: '100%', height: 200, borderRadius: 8, marginBottom: 12, resizeMode: 'cover', backgroundColor: '#F3F4F6' }} />
                  ) : (
                    <View style={{ height: 120, backgroundColor: '#F3F4F6', borderRadius: 8, marginBottom: 12, justifyContent: 'center', alignItems: 'center' }}>
                      <MaterialCommunityIcons name="clock-alert-outline" size={36} color="#9CA3AF" />
                      <Text style={{ color: '#9CA3AF', fontSize: 12, marginTop: 4 }}>Active Shift (Not Punched Out)</Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Punch Out Time:</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>
                      {selectedPunchRecordDetails.record.punch_out_time ? new Date(selectedPunchRecordDetails.record.punch_out_time).toLocaleString() : 'Active Shift'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 }}>
                    <Text style={{ fontSize: 13, color: '#6B7280' }}>Location:</Text>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#111827' }}>
                      {selectedPunchRecordDetails.record.punch_out_location || 'N/A'}
                    </Text>
                  </View>
                </View>

                {/* Total Working hours Summary */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#E2E8F0', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 8, marginBottom: 30 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#334155' }}>Total Shift Hours:</Text>
                  <Text style={{ fontSize: 16, fontWeight: '900', color: '#0F172A' }}>
                    {selectedPunchRecordDetails.record.hours_worked ? `${selectedPunchRecordDetails.record.hours_worked.toFixed(2)} Hours` : '0.00 Hours'}
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>



      <Modal visible={isUserModalVisible} transparent={false} animationType="slide" statusBarTranslucent={true} onRequestClose={() => {
        if (createUserStep === 2) {
          setCreateUserStep(1);
        } else {
          setIsUserModalVisible(false);
          setCreateUserStep(1);
        }
      }}>
        <View style={{ flex: 1, backgroundColor: 'white', paddingTop: topPadding }}>
          
          {createUserStep === 1 ? (
            <View style={{ flex: 1, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity 
                  onPress={() => { setIsUserModalVisible(false); setCreateUserStep(1); }} 
                  style={{ padding: 8, marginRight: 8, borderRadius: 8, backgroundColor: '#F1F5F9' }}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>Select Designation</Text>
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 10, paddingHorizontal: 12, height: 48, marginBottom: 12 }}>
                <MaterialCommunityIcons name="magnify" size={22} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput 
                  style={{ flex: 1, color: '#1E293B', fontSize: 15 }} 
                  placeholder="Search here..." 
                  placeholderTextColor="#94A3B8"
                  value={desigSearchText}
                  onChangeText={setDesigSearchText}
                />
                <MaterialCommunityIcons name="microphone" size={22} color="#64748B" />
              </View>



              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {/* Group 1: Admin Category */}
                {(() => {
                  const items = designationsList.filter(d => 
                    d.category === 'ADMIN' && 
                    d.name.toLowerCase().includes(desigSearchText.toLowerCase())
                  );
                  if (items.length === 0) return null;
                  return (
                    <View style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#334155', textTransform: 'uppercase' }}>Admin ({items.length})</Text>
                        <MaterialCommunityIcons name="chevron-up" size={18} color="#334155" />
                      </View>
                      {items.map(item => (
                        <TouchableOpacity 
                          key={item.id} 
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 12 }}
                          onPress={() => {
                            setNewDesignation(item.name);
                            setSelectedCategory(item.category);
                            setCreateUserStep(2);
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#FECACA', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                              <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 13 }}>{item.name.slice(0, 2).toUpperCase()}</Text>
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{item.name}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, color: '#64748B', marginRight: 8 }}>Work Force</Text>
                            <TouchableOpacity
                              style={{ padding: 4 }}
                              onPress={() => {
                                Alert.alert(
                                  "Delete Designation",
                                  `Are you sure you want to delete the designation "${item.name}"?`,
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Delete", style: "destructive", onPress: () => handleDeleteDesignation(item.id) }
                                  ]
                                );
                              }}
                            >
                              <MaterialCommunityIcons name="dots-vertical" size={20} color="#64748B" />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })()}

                {/* Group 2: Manager Category */}
                {(() => {
                  const items = designationsList.filter(d => 
                    d.category === 'MANAGER' && 
                    d.name.toLowerCase().includes(desigSearchText.toLowerCase())
                  );
                  if (items.length === 0) return null;
                  return (
                    <View style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#334155', textTransform: 'uppercase' }}>Manager ({items.length})</Text>
                        <MaterialCommunityIcons name="chevron-up" size={18} color="#334155" />
                      </View>
                      {items.map(item => (
                        <TouchableOpacity 
                          key={item.id} 
                          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 12 }}
                          onPress={() => {
                            setNewDesignation(item.name);
                            setSelectedCategory(item.category);
                            setCreateUserStep(2);
                          }}
                        >
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                              <Text style={{ color: '#2563EB', fontWeight: '800', fontSize: 13 }}>{item.name.slice(0, 2).toUpperCase()}</Text>
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{item.name}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 12, color: '#64748B', marginRight: 8 }}>Work Force</Text>
                            <TouchableOpacity
                              style={{ padding: 4 }}
                              onPress={() => {
                                Alert.alert(
                                  "Delete Designation",
                                  `Are you sure you want to delete the designation "${item.name}"?`,
                                  [
                                    { text: "Cancel", style: "cancel" },
                                    { text: "Delete", style: "destructive", onPress: () => handleDeleteDesignation(item.id) }
                                  ]
                                );
                              }}
                            >
                              <MaterialCommunityIcons name="dots-vertical" size={20} color="#64748B" />
                            </TouchableOpacity>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  );
                })()}

                {/* Group 3: Workers Category */}
                {(() => {
                  const items = designationsList.filter(d => 
                    d.category === 'WORKER' && 
                    d.name.toLowerCase().includes(desigSearchText.toLowerCase())
                  );
                  if (items.length === 0) return null;
                  return (
                    <View style={{ marginBottom: 16 }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 8 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#334155', textTransform: 'uppercase' }}>Workers ({items.length})</Text>
                        <MaterialCommunityIcons name="chevron-up" size={18} color="#334155" />
                      </View>
                      {items.map(item => {
                        const initials = item.name.slice(0, 2);
                        return (
                          <TouchableOpacity 
                            key={item.id} 
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingVertical: 12 }}
                            onPress={() => {
                              setNewDesignation(item.name);
                              setSelectedCategory(item.category);
                              setCreateUserStep(2);
                            }}
                          >
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <View style={{ width: 36, height: 36, borderRadius: 6, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                <Text style={{ color: '#059669', fontWeight: '800', fontSize: 13 }}>{initials}</Text>
                              </View>
                              <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E293B' }}>{item.name}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                              <Text style={{ fontSize: 12, color: '#64748B', marginRight: 8 }}>Work Force</Text>
                              <TouchableOpacity
                                style={{ padding: 4 }}
                                onPress={() => {
                                  Alert.alert(
                                    "Delete Designation",
                                    `Are you sure you want to delete the designation "${item.name}"?`,
                                    [
                                      { text: "Cancel", style: "cancel" },
                                      { text: "Delete", style: "destructive", onPress: () => handleDeleteDesignation(item.id) }
                                    ]
                                  );
                                }}
                              >
                                <MaterialCommunityIcons name="dots-vertical" size={20} color="#64748B" />
                              </TouchableOpacity>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })()}
              </ScrollView>

              {/* Floating Add Button */}
              <TouchableOpacity 
                style={{ position: 'absolute', right: 24, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', elevation: 4 }}
                onPress={() => setIsDesignationModalVisible(true)}
              >
                <MaterialCommunityIcons name="plus" size={30} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            /* ================= STEP 2: FILL REGISTRATION DETAILS ================= */
            <View style={{ flex: 1, padding: 16 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity 
                  onPress={() => setCreateUserStep(1)} 
                  style={{ padding: 8, marginRight: 8, borderRadius: 8, backgroundColor: '#F1F5F9' }}
                  hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
                </TouchableOpacity>
                <View>
                  <Text style={{ fontSize: 18, fontWeight: '800', color: '#1E293B' }}>New Profile Details</Text>
                  <Text style={{ fontSize: 12, color: '#2563EB', fontWeight: '700' }}>Role: {newDesignation}</Text>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
                {/* Profile Photo */}
                <Text style={styles.inputLabel}>Profile Photo *</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 }}>
                  <TouchableOpacity style={[styles.emiAddBtn, { backgroundColor: '#10B981', paddingVertical: 8 }]} onPress={() => takeUserPhoto(setNewProfilePhoto)}>
                    <Text style={styles.emiAddBtnText}>📸 Capture Photo</Text>
                  </TouchableOpacity>
                  {newProfilePhoto ? (
                    <Image source={{ uri: newProfilePhoto }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                  ) : (
                    <Text style={{ color: '#9CA3AF', fontSize: 13 }}>No photo captured</Text>
                  )}
                </View>

                <Text style={styles.inputLabel}>Username *</Text>
                <TextInput style={styles.input} placeholder="e.g. sahil123" placeholderTextColor="#64748B" value={newUsername} onChangeText={setNewUsername} autoCapitalize="none" />

                <Text style={styles.inputLabel}>Password *</Text>
                <TextInput style={styles.input} placeholder="Min 6 characters" placeholderTextColor="#64748B" secureTextEntry value={newPassword} onChangeText={setNewPassword} />

                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput style={styles.input} placeholder="e.g. Sahil Sharma" placeholderTextColor="#64748B" value={newFullName} onChangeText={setNewFullName} />

                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput style={styles.input} placeholder="e.g. 9876543210" placeholderTextColor="#64748B" keyboardType="phone-pad" value={newPhoneNumber} onChangeText={setNewPhoneNumber} />

                <Text style={styles.inputLabel}>Aadhar ID Number</Text>
                <TextInput style={styles.input} placeholder="12-digit Aadhar number" placeholderTextColor="#64748B" keyboardType="numeric" maxLength={12} value={newAadharId} onChangeText={setNewAadharId} />

                <Text style={styles.inputLabel}>Address</Text>
                <TextInput style={[styles.input, { height: 80 }]} placeholder="Full Address" placeholderTextColor="#64748B" multiline value={newAddress} onChangeText={setNewAddress} />

                <Text style={styles.inputLabel}>Emergency Relative Name</Text>
                <TextInput style={styles.input} placeholder="Relative Full Name" placeholderTextColor="#64748B" value={newRelativeName} onChangeText={setNewRelativeName} />

                <Text style={styles.inputLabel}>Relationship</Text>
                <TextInput style={styles.input} placeholder="e.g. Father, Mother, Brother" placeholderTextColor="#64748B" value={newRelativeRelation} onChangeText={setNewRelativeRelation} />

                <Text style={styles.inputLabel}>Relative Phone Number</Text>
                <TextInput style={styles.input} placeholder="Relative Contact Number" placeholderTextColor="#64748B" keyboardType="phone-pad" value={newRelativePhone} onChangeText={setNewRelativePhone} />

                {/* Working Site */}
                <Text style={styles.inputLabel}>Assigned Site</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 16 }}>
                  {(sites || []).map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={[styles.roleBtn, { marginRight: 8, paddingHorizontal: 12 }, String(newSiteId) === String(s.id) && styles.roleBtnActive]}
                      onPress={() => setNewSiteId(String(s.id))}
                    >
                      <Text style={String(newSiteId) === String(s.id) ? styles.roleTextActive : styles.roleText}>{s.name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Assigned Vehicle */}
                <Text style={styles.inputLabel}>Assigned Vehicle (Optional)</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. MH-12-FE-4920 (or select below)" 
                  placeholderTextColor="#64748B"
                  value={newAssignedVehicle} 
                  onChangeText={setNewAssignedVehicle} 
                  autoCapitalize="characters"
                />
                {emis && emis.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 14 }}>
                    {Array.from(new Set(emis.map(e => e.vehicle_number).filter(Boolean))).map(veh => (
                      <TouchableOpacity
                        key={veh}
                        style={[
                          styles.roleBtn, 
                          { marginRight: 8, paddingHorizontal: 12, paddingVertical: 8 }, 
                          newAssignedVehicle.toUpperCase().split(',').map(s => s.trim()).includes(veh.toUpperCase()) && styles.roleBtnActive
                        ]}
                        onPress={() => {
                          const currentList = newAssignedVehicle.split(',').map(v => v.trim().toUpperCase()).filter(Boolean);
                          if (currentList.includes(veh.toUpperCase())) {
                            setNewAssignedVehicle(currentList.filter(v => v !== veh.toUpperCase()).join(', '));
                          } else {
                            setNewAssignedVehicle(currentList.concat(veh.toUpperCase()).join(', '));
                          }
                        }}
                      >
                        <Text style={newAssignedVehicle.toUpperCase().split(',').map(s => s.trim()).includes(veh.toUpperCase()) ? styles.roleTextActive : styles.roleText}>
                          🚛 {veh}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                <Text style={styles.inputLabel}>Opening Balance (₹)</Text>
                <TextInput style={styles.input} placeholder="e.g. 0.0" placeholderTextColor="#64748B" keyboardType="numeric" value={newOpeningBalance} onChangeText={setNewOpeningBalance} />

                <Text style={styles.inputLabel}>Salary Amount (₹)</Text>
                <TextInput style={styles.input} placeholder="Monthly Salary" placeholderTextColor="#64748B" keyboardType="numeric" value={newSalary} onChangeText={setNewSalary} />

                {/* Starting Date */}
                <Text style={styles.inputLabel}>Starting Date</Text>
                <TouchableOpacity style={[styles.input, { justifyContent: 'center', height: 48 }]} onPress={() => setShowStartingDatePicker(true)}>
                  <Text style={{ color: '#0F172A', fontWeight: '700', fontSize: 14 }}>{formatDisplayDate(newStartingDate)}</Text>
                </TouchableOpacity>
                {showStartingDatePicker && (
                  <DateTimePicker
                    value={newStartingDate}
                    mode="date"
                    display="default"
                    onChange={(event, selectedDate) => {
                      setShowStartingDatePicker(false);
                      if (selectedDate) setNewStartingDate(selectedDate);
                    }}
                  />
                )}

                {/* Employment Type */}
                <Text style={styles.inputLabel}>Employment Type</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
                  <TouchableOpacity onPress={() => setNewEmploymentType('PERMANENT')} style={[styles.roleBtn, { flex: 1 }, newEmploymentType === 'PERMANENT' && styles.roleBtnActive]}>
                    <Text style={newEmploymentType === 'PERMANENT' ? styles.roleTextActive : styles.roleText}>Permanent</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setNewEmploymentType('TRIAL')} style={[styles.roleBtn, { flex: 1 }, newEmploymentType === 'TRIAL' && styles.roleBtnActive]}>
                    <Text style={newEmploymentType === 'TRIAL' ? styles.roleTextActive : styles.roleText}>Trial</Text>
                  </TouchableOpacity>
                </View>

                {/* Active Toggle */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Text style={styles.inputLabel}>Is Active employee</Text>
                  <Switch value={newIsActive} onValueChange={setNewIsActive} trackColor={{ false: "#767577", true: "#10B981" }} />
                </View>

                {/* Aadhar front and back photos */}
                <Text style={styles.inputLabel}>Aadhar Front Photo</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 }}>
                  <TouchableOpacity style={[styles.emiAddBtn, { backgroundColor: '#2563EB', paddingVertical: 8 }]} onPress={() => takeUserPhoto(setNewAadharFront)}>
                    <Text style={styles.emiAddBtnText}>📸 Capture Front</Text>
                  </TouchableOpacity>
                  {newAadharFront ? (
                    <Image source={{ uri: newAadharFront }} style={{ width: 80, height: 50, borderRadius: 6 }} />
                  ) : (
                    <Text style={{ color: '#9CA3AF', fontSize: 13 }}>No front photo</Text>
                  )}
                </View>

                <Text style={styles.inputLabel}>Aadhar Back Photo</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 }}>
                  <TouchableOpacity style={[styles.emiAddBtn, { backgroundColor: '#2563EB', paddingVertical: 8 }]} onPress={() => takeUserPhoto(setNewAadharBack)}>
                    <Text style={styles.emiAddBtnText}>📸 Capture Back</Text>
                  </TouchableOpacity>
                  {newAadharBack ? (
                    <Image source={{ uri: newAadharBack }} style={{ width: 80, height: 50, borderRadius: 6 }} />
                  ) : (
                    <Text style={{ color: '#9CA3AF', fontSize: 13 }}>No back photo</Text>
                  )}
                </View>

                <TouchableOpacity style={[styles.confirmBtn, { paddingVertical: 14 }]} onPress={createUser}>
                  <Text style={styles.confirmBtnText}>Create Employee</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.cancelBtn, { marginBottom: 20 }]} onPress={() => { setIsUserModalVisible(false); setCreateUserStep(1); }}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          )}

        </View>
      </Modal>



      <Modal visible={isEditModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit User Profile</Text>
            
            <Text style={styles.inputLabel}>Full Name</Text>
            <TextInput style={styles.input} placeholder="Full Name" value={editFullName} onChangeText={setEditFullName} />
            
            <Text style={styles.inputLabel}>Phone Number</Text>
            <TextInput style={styles.input} placeholder="Phone" value={editPhoneNumber} onChangeText={setEditPhoneNumber} />
            
            <Text style={styles.inputLabel}>Reset Password (Optional)</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Enter new password to reset" 
              secureTextEntry
              value={editPassword} 
              onChangeText={setEditPassword} 
            />
            <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 15 }}>Leave blank to keep current password.</Text>
            
            <TouchableOpacity style={styles.confirmBtn} onPress={submitEditUser}><Text style={styles.confirmBtnText}>Save Changes</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setIsEditModalVisible(false); setEditPassword(''); }}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={isEmiModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>New EMI</Text>
          <TextInput style={styles.input} placeholder="Vehicle" value={emiVehicle} onChangeText={setEmiVehicle} />
          <TextInput style={styles.input} placeholder="Amount" keyboardType="numeric" value={emiAmount} onChangeText={setEmiAmount} />
          <TouchableOpacity style={styles.confirmBtn} onPress={createEmi}><Text style={styles.confirmBtnText}>Schedule</Text></TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEmiModalVisible(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={isEmiEditModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}><View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Edit EMI</Text>
          <TextInput style={styles.input} placeholder="Vehicle" value={editEmiVehicle} onChangeText={setEditEmiVehicle} />
          <TextInput style={styles.input} placeholder="Amount" value={editEmiAmount} onChangeText={setEditEmiAmount} />
          <TouchableOpacity style={styles.confirmBtn} onPress={submitEditEmi}><Text style={styles.confirmBtnText}>Update</Text></TouchableOpacity>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsEmiEditModalVisible(false)}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>

      <Modal visible={isTripModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { height: '88%', width: '92%', padding: 0, overflow: 'hidden', borderRadius: 20 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: '#0F172A' }}>Log New Trip</Text>
              <TouchableOpacity onPress={() => setIsTripModalVisible(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>
            <View style={{ flex: 1 }}>
              <TripLogForm isAdmin={true} staffList={users} onSuccess={() => { setIsTripModalVisible(false); fetchData(); }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isDesignationModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Designation</Text>
            <Text style={styles.cardSubtitle}>Enter a new job category which will fall under the selected power level.</Text>
            
            <Text style={[styles.inputLabel, { marginTop: 14 }]}>Designation Category *</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {['ADMIN', 'MANAGER', 'WORKER'].map(cat => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.roleBtn, { flex: 1, paddingVertical: 8 }, selectedCategory === cat && styles.roleBtnActive]}
                  onPress={() => setSelectedCategory(cat)}
                >
                  <Text style={selectedCategory === cat ? styles.roleTextActive : styles.roleText}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Designation Name *</Text>
            <TextInput 
              style={[styles.input, { marginTop: 6 }]} 
              placeholder="e.g. Electrician" 
              placeholderTextColor="#9CA3AF"
              value={newCustomDesignation} 
              onChangeText={setNewCustomDesignation} 
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.confirmBtn} onPress={handleCreateDesignation}><Text style={styles.confirmBtnText}>Add Designation</Text></TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setIsDesignationModalVisible(false); setNewCustomDesignation(''); }}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  mainHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  mainHeaderTitle: { fontSize: 16, fontWeight: '900', color: '#111827', letterSpacing: 1 },
  emiHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20 },
  emiHeaderLabel: { fontSize: 10, fontWeight: '800', color: '#6B7280', letterSpacing: 2, textTransform: 'uppercase' },
  emiHeaderTitle: { fontSize: 24, fontWeight: '900', color: '#111827' },
  emiAddBtn: { backgroundColor: '#111827', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  emiAddBtnText: { color: 'white', fontWeight: 'bold' },
  emiMetricsRow: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  emiMetricCard: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 12, borderLeftWidth: 4, elevation: 2 },
  emiMetricLabel: { fontSize: 9, fontWeight: '800', color: '#6B7280', marginBottom: 4 },
  emiMetricValue: { fontSize: 22, fontWeight: '900', color: '#111827' },
  emiSectionLabel: { fontSize: 9, fontWeight: '800', color: '#6B7280', letterSpacing: 1.5, marginBottom: 12 },
  staffCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    height: '100%',
    justifyContent: 'center',
  },
  staffCardFluid: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    marginBottom: 10,
  },
  reorderToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  reorderToggleBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  reorderToggleBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2563EB',
  },
  reorderCompactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 56,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  emiCard: { backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 14, elevation: 3 },
  emiCardTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  emiCardIcon: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  emiCardIconText: { fontSize: 20 },
  emiCardVehicle: { fontSize: 16, fontWeight: '800' },
  emiCardSub: { fontSize: 12, color: '#9CA3AF' },
  emiUrgencyBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  emiUrgencyBadgeText: { fontSize: 13, fontWeight: '900' },
  emiCardMid: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F3F4F6', marginBottom: 14 },
  emiCardAmountLabel: { fontSize: 9, fontWeight: '800', color: '#9CA3AF' },
  emiCardAmount: { fontSize: 18, fontWeight: '900' },
  emiCardDueDate: { fontSize: 14, fontWeight: '700' },
  emiCardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  emiMarkPaidBtn: { backgroundColor: '#059669', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  emiMarkPaidText: { color: 'white', fontWeight: '800', fontSize: 13 },
  emiIconBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  emiIconBtnText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: 'white', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  input: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, marginBottom: 10, color: '#0F172A', fontSize: 14, fontWeight: '600', borderWidth: 1, borderColor: '#CBD5E1' },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#1E293B', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  confirmBtn: { backgroundColor: '#2563EB', padding: 12, borderRadius: 8, alignItems: 'center' },
  drawerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawerContent: { width: '75%', height: '100%', backgroundColor: 'white', padding: 20 },
  drawerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
  drawerProfileIcon: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  drawerName: { fontSize: 18, fontWeight: 'bold' },
  drawerRole: { fontSize: 12, color: '#6B7280' },
  drawerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 12, borderRadius: 10 },
  drawerItemActive: { backgroundColor: '#EFF6FF' },
  drawerItemText: { fontSize: 15, fontWeight: '600', color: '#4B5563', marginLeft: 15 },
  drawerItemTextActive: { color: '#2563EB' },
  drawerLogoutBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 'auto' },
  drawerLogoutText: { fontSize: 15, fontWeight: 'bold', color: '#EF4444', marginLeft: 15 },
  filterBar: { flexDirection: 'row', marginBottom: 15 },
  hrSummaryCard: { backgroundColor: '#0F172A', borderRadius: 16, padding: 20, marginBottom: 20 },
  hrSummaryLabel: { fontSize: 10, fontWeight: '800', color: '#94A3B8', letterSpacing: 1.5 },
  hrStatGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  hrStatSlot: { flex: 1 },
  hrStatValue: { fontSize: 28, fontWeight: '900', color: 'white' },
  hrStatSub: { fontSize: 9, fontWeight: '800', color: '#64748B', marginTop: 4 },
  hrRequestHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 15, marginBottom: 12 },
  hrActionBadge: { backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  hrActionBadgeText: { fontSize: 9, fontWeight: '900', color: '#B91C1C' },
  hrRequestItem: { backgroundColor: 'white', borderRadius: 12, marginBottom: 12, flexDirection: 'row', overflow: 'hidden' },
  hrRequestTypeBar: { width: 4 },
  hrRequestTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  hrRequestTime: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  hrRequestReason: { fontSize: 11, color: '#9CA3AF', marginTop: 4 },
  hrRequestActionRow: { flexDirection: 'row', gap: 15, marginTop: 12 },
  hrActionTextApprove: { fontSize: 11, fontWeight: '900', color: '#059669' },
  hrActionTextReject: { fontSize: 11, fontWeight: '900', color: '#DC2626' },
  cancelBtn: { backgroundColor: '#F3F4F6', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 10 },
  cancelBtnText: { color: '#4B5563', fontWeight: 'bold' },
  confirmBtnText: { color: 'white', fontWeight: 'bold' },
  ledgerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  ledgerDate: { fontSize: 13, fontWeight: '700', color: '#111827' },
  ledgerType: { fontSize: 10, fontWeight: '800', color: '#6B7280', textTransform: 'uppercase', marginTop: 2 },
  ledgerDesc: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  ledgerAmount: { fontSize: 16, fontWeight: '800' },
  roleBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  roleBtnActive: { backgroundColor: '#1E293B' },
  roleText: { color: '#6B7280', fontWeight: '800', fontSize: 13 },
  roleTextActive: { color: 'white', fontWeight: '800', fontSize: 13 },
  
  dateSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 10, borderRadius: 8, height: 40, borderWidth: 1, borderColor: '#E2E8F0' },
  dateSelectorText: { fontSize: 12, fontWeight: '700', color: '#1E293B', marginLeft: 6 },
  
  modalSubtitle: { fontSize: 14, color: '#374151', marginBottom: 20, fontWeight: '600', textAlign: 'center' },
  modalActionRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 10 },
  
  imageViewerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '90%', height: '80%', resizeMode: 'contain' },
  imageViewerCloseText: { color: 'white', marginTop: 20, fontSize: 16 },

  // Trip / LogBook Modern Theme Styles
  tripFilterContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 2,
  },
  dateSelectorPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  dateSelectorPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
  },
  tripSearchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    gap: 6,
  },
  tripSearchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  filterApplyBtn: {
    backgroundColor: '#0F172A',
    height: 40,
    width: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  tripCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  tripVehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  tripVehicleNum: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: 0.5,
  },
  tripDriverName: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    marginTop: 1,
  },
  tripStatusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  tripStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  tripStatusText: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },

  tripRouteBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    marginBottom: 12,
    gap: 6,
  },
  tripRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripRouteLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    textTransform: 'uppercase',
    width: 48,
  },
  tripRouteValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
    flex: 1,
  },

  tripMetricsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  tripMetricItem: {
    flex: 1,
    alignItems: 'center',
  },
  tripMetricDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E2E8F0',
  },
  tripMetricLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.8,
  },
  tripMetricVal: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  tripMetricSub: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
    marginTop: 1,
  },

  tripPhotosRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  photoBox: {
    alignItems: 'center',
  },
  tripThumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  photoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 3,
  },

  tripCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  tripDateLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1,
  },
  tripDateValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2,
  },
  tripIncomeValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#059669',
    marginTop: 1,
  },

  tripValidateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 12,
    gap: 6,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  tripValidateBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },

  emptyTripState: {
    alignItems: 'center',
    paddingTop: 48,
    paddingHorizontal: 20,
  },
  emptyTripIconBox: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTripTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 4,
  },
  emptyTripSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
  },
});
