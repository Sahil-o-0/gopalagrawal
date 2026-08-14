import React, { useState, useEffect, useContext } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, TextInput, Image, ScrollView, Modal, Platform, StatusBar, RefreshControl, Switch, Linking } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import SiteSelector from '../components/SiteSelector';
import AttendanceCalendar from '../components/AttendanceCalendar';
import TripLogForm from '../components/TripLogForm';
import { API_BASE_URL } from '../config';

export default function AdminDashboard({ navigation, route }) {
  const { user, userToken, logout } = useContext(AuthContext);
  const { selectedSite, sites = [] } = useSite();
  const [activeTab, setActiveTab] = useState(route?.params?.initialTab || 'trips');
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);

  // Sync activeTab when route parameters change
  useEffect(() => {
    if (route?.params?.initialTab) {
      setActiveTab(route.params.initialTab);
    }
  }, [route?.params?.initialTab]);

  useEffect(() => {
    fetchData();
  }, [selectedSite?.id]);
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

  // Designations states
  const [designationsList, setDesignationsList] = useState([]);
  const [newCustomDesignation, setNewCustomDesignation] = useState('');
  const [isDesignationModalVisible, setIsDesignationModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('WORKER'); // ADMIN, MANAGER, WORKER
  const [createUserStep, setCreateUserStep] = useState(1); // 1: Select Designation, 2: Fill Form
  const [desigSearchText, setDesigSearchText] = useState('');

  const { sites } = useSite();

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



  // Shared Modal States (Validation & Images)
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [isValidationModalVisible, setIsValidationModalVisible] = useState(false);
  const [bookedAmount, setBookedAmount] = useState('');
  const [receivedAmount, setReceivedAmount] = useState('');
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
          const resp = await fetch(`${API_BASE_URL}/trips/?${params.toString()}`, { headers });
          if (resp.ok) setTrips(await resp.json());
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
        Alert.alert("Required", "Please enter a valid amount");
        return;
    }

    try {
      const incomeVal = parseFloat(bookedAmount);
      console.log(`Validating trip ${tripId} with income ${incomeVal}`);

      const resp = await fetch(`${API_BASE_URL}/trips/${tripId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({ status: 'VALIDATED', bhada: incomeVal })
      });

      const ledgerResponse = await fetch(`${API_BASE_URL}/workforce/ledger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify({
          trip_id: tripId,
          total_amount_billed: incomeVal,
          amount_received: 0
        })
      });

      if (ledgerResponse.ok) {
        Alert.alert("Success", "Trip validated and income logged!");
        setIsValidationModalVisible(false);
        setBookedAmount('');
        setReceivedAmount('');
        fetchData();
      } else {
        Alert.alert("Warning", "Status updated but ledger failed.");
        setIsValidationModalVisible(false);
        fetchData();
      }
    } catch (error) { Alert.alert("Error", "Validation failed"); }
  };

  const openValidationModal = (trip) => {
    setSelectedTrip(trip);
    setBookedAmount('');
    setReceivedAmount('');
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
          starting_date: newStartingDate.toISOString().split('T')[0],
          employment_type: newEmploymentType,
          is_active: newIsActive,
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
        body: JSON.stringify({ vehicle_number: emiVehicle, emi_amount: parseFloat(emiAmount), emi_due_date: emiDate.toISOString().split('T')[0] })
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
        body: JSON.stringify({ vehicle_number: editEmiVehicle, emi_amount: parseFloat(editEmiAmount), emi_due_date: editEmiDate.toISOString().split('T')[0] })
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

            return (
              <TouchableOpacity 
                key={`hr-emp-${emp.id}`} 
                style={{ flexDirection: 'row', backgroundColor: 'white', borderRadius: 12, padding: 12, marginBottom: 12, borderBottomWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' }}
                onPress={() => {
                  if (record) {
                    setSelectedPunchRecordDetails({ emp, record });
                    setIsPunchDetailsModalVisible(true);
                  } else {
                    Alert.alert("No Entry", `${emp.full_name || emp.username} has not punched in for this date.`);
                  }
                }}
              >
                {/* User Image / Photo placeholder */}
                {record?.punch_in_photo_url ? (
                  <View>
                    <Image source={{ uri: record.punch_in_photo_url }} style={{ width: 50, height: 50, borderRadius: 6, marginRight: 12 }} />
                  </View>
                ) : emp.profile_photo_url ? (
                  <Image source={{ uri: emp.profile_photo_url }} style={{ width: 50, height: 50, borderRadius: 6, marginRight: 12 }} />
                ) : (
                  <View style={{ width: 50, height: 50, borderRadius: 6, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                    <Text style={{ fontSize: 20 }}>👤</Text>
                  </View>
                )}

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E293B' }}>#{emp.id} {emp.full_name || emp.username}</Text>
                    <Text style={{ fontSize: 11, color: '#64748B', marginLeft: 6 }}>({emp.employee_of === 'CONTRACTOR' ? 'C' : 'D'})</Text>
                    {/* Active Status indicator */}
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: record ? '#10B981' : '#F59E0B', marginLeft: 8 }} />
                  </View>

                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                    <MaterialCommunityIcons name="clock-outline" size={14} color="#2563EB" />
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#2563EB', marginLeft: 4 }}>
                      {record?.punch_in_time ? new Date(record.punch_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                    </Text>
                  </View>

                  <Text style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>Role: {emp.designation || emp.role}</Text>

                  {/* If punched out, show the punch-out time & 2nd image callback preview */}
                  {record?.punch_out_time && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, paddingTop: 6, borderTopWidth: 1, borderTopColor: '#F1F5F9' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="clock-check-outline" size={14} color="#DC2626" />
                        <Text style={{ fontSize: 11, fontWeight: '600', color: '#DC2626', marginLeft: 4 }}>
                          Out: {new Date(record.punch_out_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>

                {/* Working hours display */}
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontSize: 9, fontWeight: '800', color: '#9CA3AF' }}>WORKING HOUR</Text>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#1E293B', marginTop: 2 }}>
                    {record?.hours_worked ? `${record.hours_worked.toFixed(2)} Hrs` : '0.00 Hrs'}
                  </Text>
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

        {/* Floating punch clock menu selections */}
        {isPunchMenuVisible && (
          <View style={{ position: 'absolute', right: 24, bottom: 90, gap: 10, zIndex: 10, alignItems: 'flex-end' }}>
            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#10B981', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}
              onPress={() => {
                setPunchingType('in');
                setIsPunchStaffModalVisible(true);
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800', marginRight: 6, fontSize: 13 }}>Punch In</Text>
              <MaterialCommunityIcons name="login" size={18} color="white" />
            </TouchableOpacity>

            <TouchableOpacity 
              style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#DC2626', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 }}
              onPress={() => {
                setPunchingType('out');
                setIsPunchStaffModalVisible(true);
              }}
            >
              <Text style={{ color: 'white', fontWeight: '800', marginRight: 6, fontSize: 13 }}>Punch Out</Text>
              <MaterialCommunityIcons name="logout" size={18} color="white" />
            </TouchableOpacity>
          </View>
        )}

        {/* Modal: Select employee to punch in/out */}
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
      </View>
    );
  };

  const renderUsersTab = () => (
    <View style={{flex: 1}}>
      <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 16, paddingBottom: 80}}>
         <View style={styles.emiHeader}>
            <View><Text style={styles.emiHeaderLabel}>TEAM MANAGEMENT</Text><Text style={styles.emiHeaderTitle}>Staff & Managers</Text></View>
         </View>
         {users.map(u => {
           // Calculate current balance: dailyLedgerEntries filtered by u.id (staff_id) + u.opening_balance
           const uLedgerEntries = dailyLedgerEntries.filter(e => e.staff_id === u.id);
           const ledgerSum = uLedgerEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
           const currentBalance = ledgerSum + (u.opening_balance || 0);
           const site = sites.find(s => s.id === u.site_id);
           const siteName = site ? site.name : 'No Site';
           
           // Format added/created date
           const createdDate = u.created_at ? new Date(u.created_at).toLocaleString() : 'N/A';
           const createdBy = u.created_by || 'N/A';

           return (
             <TouchableOpacity key={`u-${u.id}`} style={styles.emiCard} onPress={() => navigation.navigate('UserLedger', { user: u, userToken, dailyLedgerEntries, sites })}>
               <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                 {/* Photo or fallback placeholder */}
                 {u.profile_photo_url ? (
                   <Image source={{ uri: u.profile_photo_url }} style={{ width: 50, height: 50, borderRadius: 25, marginRight: 12 }} />
                 ) : (
                   <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: u.role === 'MANAGER' ? '#DBEAFE' : '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                     <Text style={{ fontSize: 18 }}>{u.role === 'MANAGER' ? '👔' : '👤'}</Text>
                   </View>
                 )}
                 
                 <View style={{ flex: 1 }}>
                   <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                     <Text style={{ fontSize: 12, fontWeight: '700', color: '#6B7280', marginRight: 6 }}>#{u.id}</Text>
                     <Text style={{ fontSize: 16, fontWeight: '800', color: '#111827' }}>{u.full_name || u.username}</Text>
                     {/* Green or Orange active dot */}
                     <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: u.is_active ? '#10B981' : '#F59E0B', marginLeft: 8 }} />
                   </View>
                   
                   {/* Role / Designation */}
                   <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{u.designation || u.role}</Text>
                   
                   {/* Phone & Site */}
                   <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 2 }}>📞 {u.phone_number || 'N/A'}</Text>
                   <Text style={{ fontSize: 12, color: '#4B5563', marginTop: 1 }}>📍 Site: {siteName}</Text>
                   
                   {/* Audit Trail */}
                   <Text style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4 }}>Add By: {createdBy} | {createdDate}</Text>
                 </View>
                 
                 {/* Current Balance */}
                 <View style={{ alignItems: 'flex-end', marginLeft: 8 }}>
                   <Text style={{ fontSize: 10, fontWeight: '800', color: '#6B7280', marginBottom: 2 }}>BALANCE</Text>
                   <Text style={{ fontSize: 15, fontWeight: '900', color: currentBalance < 0 ? '#DC2626' : '#111827' }}>
                     ₹{currentBalance.toLocaleString()}
                   </Text>
                 </View>
               </View>
             </TouchableOpacity>
           );
         })}
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
      >
        <View style={styles.emiHeader}>
          <View><Text style={styles.emiHeaderLabel}>OPERATIONAL LOGS</Text><Text style={styles.emiHeaderTitle}>Trip Records</Text></View>
          <TouchableOpacity style={styles.emiAddBtn} onPress={() => setIsTripModalVisible(true)}><Text style={styles.emiAddBtnText}>+ Log Trip</Text></TouchableOpacity>
        </View>
        <View style={styles.filterBar}>
           <TouchableOpacity style={[styles.dateSelector, {flex: 1}]} onPress={() => setShowStartPicker(true)}>
              <MaterialCommunityIcons name="calendar-import" size={16} color="#64748B" />
              <Text style={styles.dateSelectorText}>{tripStartDate || "From"}</Text>
           </TouchableOpacity>
           <TouchableOpacity style={[styles.dateSelector, {flex: 1, marginHorizontal: 8}]} onPress={() => setShowEndPicker(true)}>
              <MaterialCommunityIcons name="calendar-export" size={16} color="#64748B" />
              <Text style={styles.dateSelectorText}>{tripEndDate || "To"}</Text>
           </TouchableOpacity>
           <TextInput 
              style={[styles.input, {flex: 1.5, marginBottom: 0, height: 40}]} 
              placeholder="Vehicle #" 
              value={vehicleSearch} 
              onChangeText={setVehicleSearch} 
           />
           <TouchableOpacity style={[styles.emiAddBtn, {marginLeft: 8}]} onPress={fetchData}><MaterialCommunityIcons name="magnify" size={20} color="white" /></TouchableOpacity>
        </View>

        {showStartPicker && (
            <DateTimePicker
                value={tripStartDateDt} mode="date" display="default"
                onChange={(event, date) => {
                    setShowStartPicker(false);
                    if (date) { setTripStartDateDt(date); setTripStartDate(date.toISOString().split('T')[0]); }
                }}
            />
        )}
        {showEndPicker && (
            <DateTimePicker
                value={tripEndDateDt} mode="date" display="default"
                onChange={(event, date) => {
                    setShowEndPicker(false);
                    if (date) { setTripEndDateDt(date); setTripEndDate(date.toISOString().split('T')[0]); }
                }}
            />
        )}

        {trips.map(t => (
           <View key={`t-${t.id}`} style={styles.emiCard}>
            <View style={styles.emiCardTop}>
              <View style={[styles.emiCardIcon, {backgroundColor: '#F3F4F6'}]}><Text style={styles.emiCardIconText}>🚚</Text></View>
              <View style={{flex: 1, marginLeft: 12}}><Text style={styles.emiCardVehicle}>{t.vehicle_number}</Text><Text style={styles.emiCardSub}>{t.staff_name || 'Assigned Staff'}</Text></View>
              <View style={[styles.emiUrgencyBadge, {backgroundColor: t.status === 'VALIDATED' ? '#D1FAE5' : '#FEF3C7'}]}><Text style={[styles.emiUrgencyBadgeText, {color: t.status === 'VALIDATED' ? '#065F46' : '#92400E'}]}>{t.status}</Text></View>
            </View>
            
            <View style={{marginTop: 10}}>
              <Text style={styles.ledgerDesc}>Material: {t.material_type} ({t.weight_tons}t)</Text>
              <Text style={styles.ledgerDesc}>Route: {t.origin} ➡️ {t.destination}</Text>
              <Text style={styles.ledgerDesc}>Distance: {t.total_km} KM</Text>
              {t.diesel_liters > 0 && <Text style={styles.ledgerDesc}>Diesel: {t.diesel_liters}L (₹{t.diesel_cost})</Text>}
            </View>

            {/* Photos row */}
            <View style={{flexDirection: 'row', marginTop: 12, marginBottom: 12}}>
                {t.loading_photo_url && (
                  <TouchableOpacity onPress={() => openImage(t.loading_photo_url)}>
                    <Image source={{uri: t.loading_photo_url}} style={[styles.emiCardIcon, {width: 50, height: 50, borderRadius: 8, marginRight: 8}]} />
                  </TouchableOpacity>
                )}
                {t.unloading_photo_url && (
                  <TouchableOpacity onPress={() => openImage(t.unloading_photo_url)}>
                    <Image source={{uri: t.unloading_photo_url}} style={[styles.emiCardIcon, {width: 50, height: 50, borderRadius: 8, marginRight: 8}]} />
                  </TouchableOpacity>
                )}
                {t.receipt_photo_url && (
                  <TouchableOpacity onPress={() => openImage(t.receipt_photo_url)}>
                    <Image source={{uri: t.receipt_photo_url}} style={[styles.emiCardIcon, {width: 50, height: 50, borderRadius: 8, marginRight: 8}]} />
                  </TouchableOpacity>
                )}
            </View>

            <View style={styles.emiCardMid}>
              <View>
                <Text style={styles.emiCardAmountLabel}>DATE LOGGED</Text>
                <Text style={styles.emiCardDueDate}>
                  {(() => {
                    const d = new Date(t.created_at);
                    const dd = String(d.getDate()).padStart(2, '0');
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const yyyy = d.getFullYear();
                    return `${dd}-${mm}-${yyyy}`;
                  })()}
                </Text>
              </View>
              <View style={{alignItems: 'flex-end'}}><Text style={styles.emiCardAmountLabel}>INCOME</Text><Text style={styles.emiCardAmount}>₹{t.bhada || 0}</Text></View>
            </View>
            
            {t.status === 'PENDING' && ( 
              <TouchableOpacity style={[styles.emiMarkPaidBtn, {backgroundColor: '#10B981', marginTop: 10}]} onPress={() => openValidationModal(t)}>
                <Text style={styles.emiMarkPaidText}>✅ VALIDATE TRIP</Text>
              </TouchableOpacity> 
            )}
           </View>
        ))}
      </ScrollView>
    </View>
  );

  const renderEmiTab = () => {
    const totalOutflow = emis.reduce((sum, e) => sum + (parseFloat(e.emi_amount) || 0), 0);
    const due7 = emis.filter(e => { const d = getDaysRemaining(e.emi_due_date); return d >= 0 && d <= 7; }).length;
    return (
      <ScrollView style={{flex: 1}} contentContainerStyle={{padding: 16, paddingBottom: 40}}>
        <View style={styles.emiHeader}>
          <View><Text style={styles.emiHeaderLabel}>FINANCIALS</Text><Text style={styles.emiHeaderTitle}>EMI Tracker</Text></View>
          <TouchableOpacity style={styles.emiAddBtn} onPress={() => setIsEmiModalVisible(true)}><Text style={styles.emiAddBtnText}>+ New</Text></TouchableOpacity>
        </View>
        <View style={styles.emiMetricsRow}>
          <View style={[styles.emiMetricCard, {borderLeftColor: '#111827'}]}><Text style={styles.emiMetricLabel}>TOTAL MONTHLY</Text><Text style={styles.emiMetricValue}>₹{totalOutflow.toLocaleString()}</Text></View>
          <View style={[styles.emiMetricCard, {borderLeftColor: '#DC2626'}]}><Text style={styles.emiMetricLabel}>DUE SOON</Text><Text style={[styles.emiMetricValue, {color: '#DC2626'}]}>{due7}</Text></View>
        </View>
        {emis.map(e => {
          const days = getDaysRemaining(e.emi_due_date);
          return (
            <View key={`e-${e.id}`} style={styles.emiCard}>
              <View style={styles.emiCardTop}>
                <View style={styles.emiCardIcon}><Text style={styles.emiCardIconText}>🚛</Text></View>
                <View style={{flex: 1, marginLeft: 12}}><Text style={styles.emiCardVehicle}>{e.vehicle_number}</Text><Text style={styles.emiCardSub}>Monthly</Text></View>
                <View style={[styles.emiUrgencyBadge, {backgroundColor: days <= 7 ? '#FEE2E2' : '#EFF6FF'}]}>
                  <Text style={[styles.emiUrgencyBadgeText, {color: days <= 7 ? '#991B1B' : '#2563EB'}]}>{days > 0 ? `${days}d LEFT` : days === 0 ? "DUE" : "OVER"}</Text>
                </View>
              </View>
              <View style={styles.emiCardMid}>
                <View><Text style={styles.emiCardAmountLabel}>AMOUNT</Text><Text style={styles.emiCardAmount}>₹{parseFloat(e.emi_amount).toLocaleString()}</Text></View>
                <View style={{alignItems: 'flex-end'}}><Text style={styles.emiCardAmountLabel}>DUE DATE</Text><Text style={styles.emiCardDueDate}>{e.emi_due_date}</Text></View>
              </View>
              <View style={styles.emiCardActions}>
                <TouchableOpacity style={styles.emiMarkPaidBtn} onPress={() => markEmiPaid(e.id)}><Text style={styles.emiMarkPaidText}>✓ Paid</Text></TouchableOpacity>
                <View style={{flexDirection: 'row', gap: 8}}>
                  <TouchableOpacity style={styles.emiIconBtn} onPress={() => openEditEmiModal(e)}><Text style={styles.emiIconBtnText}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.emiIconBtn, {backgroundColor: '#FEE2E2'}]} onPress={() => deleteEmi(e.id)}><Text style={styles.emiIconBtnText}>🗑️</Text></TouchableOpacity>
                </View>
              </View>
            </View>
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
            <View style={styles.drawerProfileIcon}><Text style={styles.drawerProfileInitial}>{user?.username?.charAt(0) || 'A'}</Text></View>
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
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.mainHeader}>
        <TouchableOpacity onPress={() => navigation.navigate('Home')} style={{ paddingRight: 10 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
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
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsValidationModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => validateTrip(selectedTrip?.id)}>
                <Text style={styles.confirmBtnText}>Confirm Data</Text>
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
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white', paddingTop: Platform.OS === 'android' ? 30 : 0 }}>
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
        </SafeAreaView>
      </Modal>



      <Modal visible={isUserModalVisible} transparent={false} animationType="slide" statusBarTranslucent={true}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white', paddingTop: Platform.OS === 'android' ? 30 : 0 }}>
          
          {createUserStep === 1 ? (
            <View style={{ flex: 1, padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <TouchableOpacity onPress={() => { setIsUserModalVisible(false); setCreateUserStep(1); }} style={{ paddingRight: 16 }}>
                  <MaterialCommunityIcons name="arrow-left" size={26} color="#1E293B" />
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
                <TouchableOpacity onPress={() => setCreateUserStep(1)} style={{ paddingRight: 16 }}>
                  <MaterialCommunityIcons name="arrow-left" size={26} color="#1E293B" />
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
                <TextInput style={styles.input} placeholder="e.g. sahil123" value={newUsername} onChangeText={setNewUsername} autoCapitalize="none" />

                <Text style={styles.inputLabel}>Password *</Text>
                <TextInput style={styles.input} placeholder="Min 6 characters" secureTextEntry value={newPassword} onChangeText={setNewPassword} />

                <Text style={styles.inputLabel}>Full Name *</Text>
                <TextInput style={styles.input} placeholder="e.g. Sahil Sharma" value={newFullName} onChangeText={setNewFullName} />

                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput style={styles.input} placeholder="e.g. 9876543210" keyboardType="phone-pad" value={newPhoneNumber} onChangeText={setNewPhoneNumber} />

                <Text style={styles.inputLabel}>Aadhar ID Number</Text>
                <TextInput style={styles.input} placeholder="12-digit Aadhar number" keyboardType="numeric" maxLength={12} value={newAadharId} onChangeText={setNewAadharId} />

                <Text style={styles.inputLabel}>Address</Text>
                <TextInput style={[styles.input, { height: 80 }]} placeholder="Full Address" multiline value={newAddress} onChangeText={setNewAddress} />

                <Text style={styles.inputLabel}>Emergency Relative Name</Text>
                <TextInput style={styles.input} placeholder="Relative Full Name" value={newRelativeName} onChangeText={setNewRelativeName} />

                <Text style={styles.inputLabel}>Relationship</Text>
                <TextInput style={styles.input} placeholder="e.g. Father, Mother, Brother" value={newRelativeRelation} onChangeText={setNewRelativeRelation} />

                <Text style={styles.inputLabel}>Relative Phone Number</Text>
                <TextInput style={styles.input} placeholder="Relative Contact Number" keyboardType="phone-pad" value={newRelativePhone} onChangeText={setNewRelativePhone} />

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

                <Text style={styles.inputLabel}>Opening Balance (₹)</Text>
                <TextInput style={styles.input} placeholder="e.g. 0.0" keyboardType="numeric" value={newOpeningBalance} onChangeText={setNewOpeningBalance} />

                <Text style={styles.inputLabel}>Salary Amount (₹)</Text>
                <TextInput style={styles.input} placeholder="Monthly Salary" keyboardType="numeric" value={newSalary} onChangeText={setNewSalary} />

                {/* Starting Date */}
                <Text style={styles.inputLabel}>Starting Date</Text>
                <TouchableOpacity style={[styles.input, { justifyContent: 'center', height: 48 }]} onPress={() => setShowStartingDatePicker(true)}>
                  <Text style={{ color: '#111827' }}>{newStartingDate.toISOString().split('T')[0]}</Text>
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

        </SafeAreaView>
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
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsTripModalVisible(false)}>
          <View style={[styles.modalContent, {maxHeight: '90%', padding: 0, overflow: 'hidden'}]}>
             <ScrollView><TripLogForm isAdmin={true} staffList={users} onSuccess={() => { setIsTripModalVisible(false); fetchData(); }} /></ScrollView>
          </View>
        </TouchableOpacity>
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

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) : 0 },
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
  emiCardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  emiMarkPaidBtn: { backgroundColor: '#059669', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  emiMarkPaidText: { color: 'white', fontWeight: '800', fontSize: 13 },
  emiIconBtn: { width: 38, height: 38, borderRadius: 10, backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  emiIconBtnText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '90%', backgroundColor: 'white', borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  input: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginBottom: 10, color: '#111827' },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#4B5563', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
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
});
