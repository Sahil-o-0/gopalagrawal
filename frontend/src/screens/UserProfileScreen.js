import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ScrollView,
  TextInput, Alert, Linking, StatusBar, Platform, ActivityIndicator
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import ManualAttendanceModal from '../components/ManualAttendanceModal';
import { API_BASE_URL } from '../config';

export default function UserProfileScreen({ route, navigation }) {
  const { userProfile, userToken, dailyLedgerEntries = [], sites = [] } = route.params;

  const [currentUserProfile, setCurrentUserProfile] = useState(userProfile || {});
  const [isProfileEditMode, setIsProfileEditMode] = useState(false);
  const [isBasicDetailsCollapsed, setIsBasicDetailsCollapsed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isManualAttModalVisible, setIsManualAttModalVisible] = useState(false);

  // Form Fields
  const [profileName, setProfileName] = useState(userProfile?.full_name || '');
  const [profilePhone, setProfilePhone] = useState(userProfile?.phone_number || '');
  const [profileDesignation, setProfileDesignation] = useState(userProfile?.designation || '');
  const [profileRole, setProfileRole] = useState(userProfile?.role || 'STAFF');
  const [profileRelation, setProfileRelation] = useState(userProfile?.relative_relation || '');
  const [profileRelativeName, setProfileRelativeName] = useState(userProfile?.relative_name || '');
  const [profileRelativePhone, setProfileRelativePhone] = useState(userProfile?.relative_phone_number || '');
  const [profileEmployeeOf, setProfileEmployeeOf] = useState(userProfile?.employee_of || 'DEPARTMENTAL');
  const [profileDepartment, setProfileDepartment] = useState(userProfile?.department || '');
  const [profileEmploymentType, setProfileEmploymentType] = useState(userProfile?.employment_type || 'PERMANENT');
  const [profileEmployeeIdCustom, setProfileEmployeeIdCustom] = useState(userProfile?.employee_id_custom || '');
  const [profileSiteId, setProfileSiteId] = useState(userProfile?.site_id ? String(userProfile.site_id) : '');
  const [profileAddress, setProfileAddress] = useState(userProfile?.address || '');
  const [profileAadhar, setProfileAadhar] = useState(userProfile?.aadhar_id || '');
  const [profileSalary, setProfileSalary] = useState(userProfile?.salary ? String(userProfile.salary) : '');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState(userProfile?.profile_photo_url || null);
  const [profileAssignedVehicle, setProfileAssignedVehicle] = useState(userProfile?.assigned_vehicle || '');
  const [fleetVehicles, setFleetVehicles] = useState([]);

  // Sync state if currentUserProfile changes
  useEffect(() => {
    if (currentUserProfile) {
      setProfileName(currentUserProfile.full_name || '');
      setProfilePhone(currentUserProfile.phone_number || '');
      setProfileDesignation(currentUserProfile.designation || '');
      setProfileRole(currentUserProfile.role || 'STAFF');
      setProfileRelation(currentUserProfile.relative_relation || '');
      setProfileRelativeName(currentUserProfile.relative_name || '');
      setProfileRelativePhone(currentUserProfile.relative_phone_number || '');
      setProfileEmployeeOf(currentUserProfile.employee_of || 'DEPARTMENTAL');
      setProfileDepartment(currentUserProfile.department || '');
      setProfileEmploymentType(currentUserProfile.employment_type || 'PERMANENT');
      setProfileEmployeeIdCustom(currentUserProfile.employee_id_custom || '');
      setProfileSiteId(currentUserProfile.site_id ? String(currentUserProfile.site_id) : '');
      setProfileAddress(currentUserProfile.address || '');
      setProfileAadhar(currentUserProfile.aadhar_id || '');
      setProfileSalary(currentUserProfile.salary ? String(currentUserProfile.salary) : '');
      setProfilePhotoUrl(currentUserProfile.profile_photo_url || null);
      setProfileAssignedVehicle(currentUserProfile.assigned_vehicle || '');
    }
  }, [currentUserProfile]);

  const fetchFreshUser = async () => {
    if (!currentUserProfile?.id || !userToken) return;
    try {
      const resp = await fetch(`${API_BASE_URL}/auth/users`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (resp.ok) {
        const allUsers = await resp.json();
        const found = allUsers.find(u => u.id === currentUserProfile.id);
        if (found) {
          setCurrentUserProfile(found);
        }
      }
    } catch (e) {
      console.error("Failed to refresh user profile", e);
    }
  };

  useEffect(() => {
    fetchFreshUser();
  }, [userToken]);

  useEffect(() => {
    const loadFleet = async () => {
      try {
        const resp = await fetch(`${API_BASE_URL}/workforce/emi`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        });
        if (resp.ok) {
          const emis = await resp.json();
          const set = new Set(emis.map(e => e.vehicle_number).filter(Boolean));
          setFleetVehicles(Array.from(set));
        }
      } catch (_) {}
    };
    loadFleet();
  }, [userToken]);

  // Check if any field has been changed compared to original profile
  const hasUnsavedChanges = 
    profilePhotoUrl !== (currentUserProfile.profile_photo_url || null) ||
    profileName !== (currentUserProfile.full_name || '') ||
    profilePhone !== (currentUserProfile.phone_number || '') ||
    profileDesignation !== (currentUserProfile.designation || '') ||
    profileRole !== (currentUserProfile.role || 'STAFF') ||
    profileRelation !== (currentUserProfile.relative_relation || '') ||
    profileRelativeName !== (currentUserProfile.relative_name || '') ||
    profileRelativePhone !== (currentUserProfile.relative_phone_number || '') ||
    profileEmployeeOf !== (currentUserProfile.employee_of || 'DEPARTMENTAL') ||
    profileDepartment !== (currentUserProfile.department || '') ||
    profileEmploymentType !== (currentUserProfile.employment_type || 'PERMANENT') ||
    profileEmployeeIdCustom !== (currentUserProfile.employee_id_custom || '') ||
    profileSiteId !== (currentUserProfile.site_id ? String(currentUserProfile.site_id) : '') ||
    profileAddress !== (currentUserProfile.address || '') ||
    profileAadhar !== (currentUserProfile.aadhar_id || '') ||
    profileSalary !== (currentUserProfile.salary ? String(currentUserProfile.salary) : '') ||
    profileAssignedVehicle !== (currentUserProfile.assigned_vehicle || '');

  // Balance Calculation
  const uLedgerEntries = (dailyLedgerEntries || []).filter(e => e.staff_id === currentUserProfile.id);
  const ledgerSum = uLedgerEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  const currentBalance = ledgerSum + (currentUserProfile.opening_balance || 0);

  const assignedSite = (sites || []).find(s => s.id === (profileSiteId ? parseInt(profileSiteId) : currentUserProfile.site_id));
  const siteName = assignedSite ? assignedSite.name : 'None';

  /**
   * Opens Image Picker with Native Cropper & Rotator
   */
  const handleChoosePhoto = async () => {
    Alert.alert(
      'Profile Picture',
      'Select a photo from library or take a new one (crop & rotation supported)',
      [
        {
          text: 'Camera 📷',
          onPress: async () => {
            try {
              const perm = await ImagePicker.requestCameraPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Permission needed', 'Camera permission is required');
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                allowsEditing: true,
                aspect: [1, 1], // Square avatar crop
                quality: 0.9,
                base64: true,
              });
              if (!res.canceled && res.assets && res.assets[0]) {
                const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
                setProfilePhotoUrl(uri);
                setIsProfileEditMode(true);
              }
            } catch (err) {
              Alert.alert('Error', 'Could not open camera');
            }
          }
        },
        {
          text: 'Choose from Gallery 🖼️',
          onPress: async () => {
            try {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Permission needed', 'Gallery permission is required');
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1], // Square avatar crop & rotate
                quality: 0.9,
                base64: true,
              });
              if (!res.canceled && res.assets && res.assets[0]) {
                const uri = `data:image/jpeg;base64,${res.assets[0].base64}`;
                setProfilePhotoUrl(uri);
                setIsProfileEditMode(true);
              }
            } catch (err) {
              Alert.alert('Error', 'Could not open gallery');
            }
          }
        },
        {
          text: 'Remove Photo',
          style: 'destructive',
          onPress: () => {
            setProfilePhotoUrl(null);
            setIsProfileEditMode(true);
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const saveUserProfile = async () => {
    try {
      setIsSaving(true);
      const body = {
        full_name: profileName.trim(),
        phone_number: profilePhone.trim() || null,
        designation: profileDesignation.trim() || null,
        role: profileRole,
        relative_relation: profileRelation || null,
        relative_name: profileRelativeName.trim() || null,
        relative_phone_number: profileRelativePhone.trim() || null,
        employee_of: profileEmployeeOf,
        department: profileDepartment.trim() || null,
        employment_type: profileEmploymentType,
        employee_id_custom: profileEmployeeIdCustom.trim() || null,
        site_id: profileSiteId ? parseInt(profileSiteId) : null,
        address: profileAddress.trim() || null,
        aadhar_id: profileAadhar.trim() || null,
        salary: parseFloat(profileSalary) || 0.0,
        assigned_vehicle: profileAssignedVehicle.trim() || null,
        profile_photo_url: profilePhotoUrl,
      };

      const resp = await fetch(`${API_BASE_URL}/auth/users/${currentUserProfile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify(body)
      });

      if (resp.ok) {
        const updatedUser = await resp.json();
        setCurrentUserProfile(updatedUser);
        setIsProfileEditMode(false);
        Alert.alert("Success 🎉", "Profile has been updated successfully!");
      } else {
        const err = await resp.json();
        Alert.alert("Error", err.detail || "Could not update profile");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to save profile changes");
    } finally {
      setIsSaving(false);
    }
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
            if (resp.ok) {
              Alert.alert("Success", "User deleted");
              navigation.goBack();
            }
          } catch (e) { Alert.alert("Error deleting user"); }
        }}
      ]
    );
  };

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20);

  return (
    <View style={[styles.container, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
          <Text style={styles.headerTitle}>User Profile</Text>
        </TouchableOpacity>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <TouchableOpacity 
            style={[
              styles.editModeToggleBtn, 
              (hasUnsavedChanges || isProfileEditMode) && styles.editModeToggleBtnActive
            ]} 
            onPress={() => {
              if (hasUnsavedChanges || isProfileEditMode) {
                saveUserProfile();
              } else {
                setIsProfileEditMode(true);
              }
            }}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <MaterialCommunityIcons 
                  name={hasUnsavedChanges || isProfileEditMode ? "check" : "pencil"} 
                  size={16} 
                  color={hasUnsavedChanges || isProfileEditMode ? "#FFFFFF" : "#2563EB"} 
                />
                <Text style={[styles.editModeToggleText, (hasUnsavedChanges || isProfileEditMode) && { color: '#FFFFFF' }]}>
                  {hasUnsavedChanges ? "Save Changes" : (isProfileEditMode ? "Save" : "Edit")}
                </Text>
              </>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => {
            Alert.alert(
              "Options",
              "Choose an action",
              [
                { text: "Mark Attendance", onPress: () => setIsManualAttModalVisible(true) },
                { text: "View Staff Ledger", onPress: () => navigation.navigate('UserLedger', { user: currentUserProfile, userToken, dailyLedgerEntries, sites }) },
                { text: isProfileEditMode ? "Cancel Editing" : "Edit Profile Info", onPress: () => setIsProfileEditMode(!isProfileEditMode) },
                { text: "Delete User", style: "destructive", onPress: () => deleteUser(currentUserProfile.id) },
                { text: "Cancel", style: "cancel" }
              ]
            );
          }}>
            <MaterialCommunityIcons name="dots-vertical" size={24} color="#1E293B" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: hasUnsavedChanges ? 90 : 30 }}>
        {/* Profile Card / Avatar Section */}
        <View style={styles.collapsibleCard}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Profile Details</Text>
            {hasUnsavedChanges ? (
              <View style={styles.unsavedBadge}>
                <MaterialCommunityIcons name="alert-circle-outline" size={12} color="#D97706" style={{ marginRight: 3 }} />
                <Text style={styles.unsavedBadgeText}>UNSAVED EDITS</Text>
              </View>
            ) : isProfileEditMode ? (
              <View style={styles.editBadge}>
                <Text style={styles.editBadgeText}>EDITING MODE</Text>
              </View>
            ) : null}
          </View>

          <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 14 }}>
            {/* Avatar with Camera Overlay */}
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <TouchableOpacity onPress={handleChoosePhoto} style={styles.avatarContainer} activeOpacity={0.8}>
                {profilePhotoUrl ? (
                  <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={{ fontSize: 28 }}>👤</Text>
                  </View>
                )}
                <View style={styles.cameraIconBadge}>
                  <MaterialCommunityIcons name="camera" size={14} color="#FFFFFF" />
                </View>
              </TouchableOpacity>

              <View style={{ flex: 1, marginLeft: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
                  <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 5, borderWidth: 1, borderColor: '#BFDBFE' }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#1E40AF' }}>User ID: {currentUserProfile.username}</Text>
                  </View>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#64748B' }}>#{currentUserProfile.id}</Text>
                </View>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#1F2937' }}>{currentUserProfile.full_name || currentUserProfile.username}</Text>
                <Text style={{ fontSize: 12, color: '#6B7280', fontWeight: '600', marginTop: 1 }}>Role: {currentUserProfile.designation || currentUserProfile.role}</Text>
                
                <TouchableOpacity onPress={handleChoosePhoto} style={{ marginTop: 4, flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialCommunityIcons name="crop" size={13} color="#2563EB" />
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB', marginLeft: 4 }}>
                    {profilePhotoUrl ? 'Change / Crop Photo' : 'Upload Profile Photo'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Contact Actions */}
            <View style={styles.contactRow}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: '#374151' }}>📞 {currentUserProfile.phone_number || 'No phone set'}</Text>
              {currentUserProfile.phone_number && (
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity onPress={() => Linking.openURL(`tel:${currentUserProfile.phone_number}`).catch(() => Alert.alert("Error", "Could not open dialer"))}>
                    <MaterialCommunityIcons name="phone" size={20} color="#10B981" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => Linking.openURL(`whatsapp://send?phone=+91${currentUserProfile.phone_number}`).catch(() => {
                    Linking.openURL(`https://api.whatsapp.com/send?phone=+91${currentUserProfile.phone_number}`).catch(() => Alert.alert("Error", "Could not launch WhatsApp"));
                  })}>
                    <MaterialCommunityIcons name="whatsapp" size={20} color="#25D366" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => Linking.openURL(`sms:${currentUserProfile.phone_number}`).catch(() => Alert.alert("Error", "Could not launch message app"))}>
                    <MaterialCommunityIcons name="message-text" size={20} color="#3B82F6" />
                  </TouchableOpacity>
                </View>
              )}
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>User ID (Login):</Text>
              <Text style={[styles.infoValue, { fontWeight: '800', color: '#1E293B' }]}>{currentUserProfile.username}</Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Current Balance:</Text>
              <Text style={[styles.infoValue, { color: currentBalance < 0 ? '#DC2626' : '#111827' }]}>
                ₹{currentBalance.toLocaleString()}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Assigned Site:</Text>
              <Text style={styles.infoValue}>{siteName}</Text>
            </View>

            {currentUserProfile.assigned_vehicle ? (
              <View style={[styles.infoRow, { alignItems: 'flex-start' }]}>
                <Text style={styles.infoLabel}>Assigned Vehicles:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1, justifyContent: 'flex-end' }}>
                  {currentUserProfile.assigned_vehicle.split(',').map((v, i) => (
                    <View key={i} style={{ backgroundColor: '#EFF6FF', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#BFDBFE' }}>
                      <Text style={{ fontSize: 12, color: '#1D4ED8', fontWeight: '700' }}>🚛 {v.trim()}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ) : null}

            {/* Action Buttons: Mark Attendance & View Ledger */}
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity 
                style={{ flex: 1, backgroundColor: '#EFF6FF', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#BFDBFE' }}
                onPress={() => setIsManualAttModalVisible(true)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="clipboard-check-outline" size={16} color="#2563EB" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#2563EB' }}>Mark Attendance</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={{ flex: 1.1, backgroundColor: '#F8FAFC', paddingVertical: 10, paddingHorizontal: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}
                onPress={() => navigation.navigate('UserLedger', { user: currentUserProfile, userToken, dailyLedgerEntries, sites })}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="book-open-outline" size={16} color="#475569" style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>View Ledger</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Profile Inputs (Read-Only / Edit Mode) */}
        <View style={styles.formContainer}>
          <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>Employment & Personal Info</Text>
          
          <Text style={styles.inputLabel}>Full Name</Text>
          {isProfileEditMode ? (
            <TextInput style={styles.input} value={profileName} onChangeText={setProfileName} placeholder="Employee Full Name" placeholderTextColor="#94A3B8" />
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.full_name || 'None'}</Text>
          )}

          <Text style={styles.inputLabel}>Phone Number</Text>
          {isProfileEditMode ? (
            <TextInput style={styles.input} value={profilePhone} onChangeText={setProfilePhone} placeholder="10-digit Mobile Number" keyboardType="phone-pad" placeholderTextColor="#94A3B8" />
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.phone_number || 'None'}</Text>
          )}

          <Text style={styles.inputLabel}>Designation / Role Title</Text>
          {isProfileEditMode ? (
            <TextInput style={styles.input} value={profileDesignation} onChangeText={setProfileDesignation} placeholder="e.g. JCB Operator / Driver" placeholderTextColor="#94A3B8" />
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.designation || 'None'}</Text>
          )}

          <Text style={styles.inputLabel}>System Access Role</Text>
          {isProfileEditMode ? (
            <View style={styles.radioGroup}>
              {['STAFF', 'MANAGER'].map(r => (
                <TouchableOpacity 
                  key={r} 
                  style={[styles.radioBtn, profileRole === r && styles.radioBtnActive]}
                  onPress={() => setProfileRole(r)}
                >
                  <Text style={profileRole === r ? styles.roleTextActive : styles.roleText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.role || 'STAFF'}</Text>
          )}

          <Text style={styles.inputLabel}>Relation</Text>
          {isProfileEditMode ? (
            <View style={styles.radioGroup}>
              {['Father', 'Mother', 'Husband', 'Other'].map(r => (
                <TouchableOpacity 
                  key={r} 
                  style={[styles.radioBtn, profileRelation === r && styles.radioBtnActive]}
                  onPress={() => setProfileRelation(r)}
                >
                  <Text style={profileRelation === r ? styles.radioTextActive : styles.radioText}>{r}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.relative_relation || 'None'}</Text>
          )}

          <Text style={styles.inputLabel}>Relative Name</Text>
          {isProfileEditMode ? (
            <TextInput style={styles.input} value={profileRelativeName} onChangeText={setProfileRelativeName} placeholder="Relative Full Name" placeholderTextColor="#94A3B8" />
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.relative_name || 'None'}</Text>
          )}

          <Text style={styles.inputLabel}>Employee Of</Text>
          {isProfileEditMode ? (
            <View style={styles.radioGroup}>
              {['DEPARTMENTAL', 'CONTRACTOR'].map(empType => (
                <TouchableOpacity 
                  key={empType} 
                  style={[styles.radioBtn, profileEmployeeOf === empType && styles.radioBtnActive]}
                  onPress={() => setProfileEmployeeOf(empType)}
                >
                  <Text style={profileEmployeeOf === empType ? styles.roleTextActive : styles.roleText}>{empType}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.employee_of || 'DEPARTMENTAL'}</Text>
          )}

          <Text style={styles.inputLabel}>Department</Text>
          {isProfileEditMode ? (
            <TextInput style={styles.input} value={profileDepartment} onChangeText={setProfileDepartment} placeholder="e.g. Operations / Logistics" placeholderTextColor="#94A3B8" />
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.department || 'None'}</Text>
          )}

          <Text style={styles.inputLabel}>Employee ID (Custom)</Text>
          {isProfileEditMode ? (
            <TextInput style={styles.input} value={profileEmployeeIdCustom} onChangeText={setProfileEmployeeIdCustom} placeholder="Custom Employee ID" placeholderTextColor="#94A3B8" />
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.employee_id_custom || 'None'}</Text>
          )}

          <Text style={styles.inputLabel}>Employment Type</Text>
          {isProfileEditMode ? (
            <View style={styles.radioGroup}>
              {['PERMANENT', 'TRIAL'].map(empMode => (
                <TouchableOpacity 
                  key={empMode} 
                  style={[styles.radioBtn, profileEmploymentType === empMode && styles.radioBtnActive]}
                  onPress={() => setProfileEmploymentType(empMode)}
                >
                  <Text style={profileEmploymentType === empMode ? styles.roleTextActive : styles.roleText}>{empMode}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.employment_type || 'PERMANENT'}</Text>
          )}

          <Text style={styles.inputLabel}>Monthly Salary (₹)</Text>
          {isProfileEditMode ? (
            <TextInput style={styles.input} value={profileSalary} onChangeText={setProfileSalary} placeholder="e.g. 25000" keyboardType="numeric" placeholderTextColor="#94A3B8" />
          ) : (
            <Text style={styles.readOnlyText}>₹{(currentUserProfile.salary || 0).toLocaleString()}</Text>
          )}

          <Text style={styles.inputLabel}>Assigned Site</Text>
          {isProfileEditMode ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginVertical: 6 }}>
              {(sites || []).map(s => (
                <TouchableOpacity
                  key={s.id}
                  style={[styles.radioBtn, { marginRight: 8, paddingHorizontal: 12 }, String(profileSiteId) === String(s.id) && styles.radioBtnActive]}
                  onPress={() => setProfileSiteId(String(s.id))}
                >
                  <Text style={String(profileSiteId) === String(s.id) ? styles.radioTextActive : styles.radioText}>{s.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <Text style={styles.readOnlyText}>{siteName}</Text>
          )}

          <Text style={styles.inputLabel}>Assigned Vehicle (Fleet / Logistics)</Text>
          {isProfileEditMode ? (
            <View>
              <TextInput 
                style={styles.input} 
                value={profileAssignedVehicle} 
                onChangeText={setProfileAssignedVehicle} 
                placeholder="e.g. MH-12-FE-4920 (or select below)" 
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
              />
              {fleetVehicles.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 10 }}>
                  {fleetVehicles.map(veh => {
                    const isSelected = profileAssignedVehicle.toUpperCase().split(',').map(s => s.trim()).includes(veh.toUpperCase());
                    return (
                      <TouchableOpacity
                        key={veh}
                        style={[
                          styles.radioBtn, 
                          { marginRight: 8, paddingHorizontal: 12, paddingVertical: 8 }, 
                          isSelected && styles.radioBtnActive
                        ]}
                        onPress={() => {
                          const currentList = profileAssignedVehicle.split(',').map(v => v.trim().toUpperCase()).filter(Boolean);
                          if (currentList.includes(veh.toUpperCase())) {
                            setProfileAssignedVehicle(currentList.filter(v => v !== veh.toUpperCase()).join(', '));
                          } else {
                            setProfileAssignedVehicle(currentList.concat(veh.toUpperCase()).join(', '));
                          }
                        }}
                      >
                        <Text style={isSelected ? styles.radioTextActive : styles.radioText}>
                          🚛 {veh}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.assigned_vehicle ? `🚛 ${currentUserProfile.assigned_vehicle}` : 'None Assigned'}</Text>
          )}

          {(hasUnsavedChanges || isProfileEditMode) && (
            <TouchableOpacity style={styles.saveBtn} onPress={saveUserProfile} disabled={isSaving} activeOpacity={0.8}>
              {isSaving ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.saveBtnText}>Save Profile Changes</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* Floating Save Action Bar when changes exist */}
      {hasUnsavedChanges && (
        <View style={styles.floatingSaveBar}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.floatingSaveTitle}>Unsaved Changes</Text>
            <Text style={styles.floatingSaveSub}>Tap to save updated photo & details</Text>
          </View>
          <TouchableOpacity 
            style={styles.floatingSaveBtn} 
            onPress={saveUserProfile} 
            disabled={isSaving}
            activeOpacity={0.85}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save-check" size={18} color="white" />
                <Text style={styles.floatingSaveBtnText}>Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Manual Attendance Modal */}
      <ManualAttendanceModal
        visible={isManualAttModalVisible}
        onClose={() => setIsManualAttModalVisible(false)}
        onSaveSuccess={() => {}}
        initialStaff={currentUserProfile}
        initialDate={new Date()}
        staffList={[currentUserProfile]}
        sites={sites}
        userToken={userToken}
        currentRole="ADMIN"
        activeSiteId={currentUserProfile?.site_id}
      />
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
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 14, 
    backgroundColor: 'white', 
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0' 
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginLeft: 8 },
  editModeToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 4
  },
  editModeToggleBtnActive: {
    backgroundColor: '#059669',
    borderColor: '#059669'
  },
  editModeToggleText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  collapsibleCard: { 
    backgroundColor: 'white', 
    borderRadius: 14, 
    padding: 16, 
    borderLeftWidth: 4, 
    borderLeftColor: '#2563EB', 
    marginBottom: 16, 
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.5 },
  editBadge: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  editBadgeText: { fontSize: 9, fontWeight: '800', color: '#D97706' },
  avatarContainer: { position: 'relative' },
  avatarImage: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: '#2563EB' },
  avatarPlaceholder: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#BFDBFE' },
  cameraIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2563EB',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF'
  },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: '#64748B', fontWeight: '600' },
  infoValue: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
  formContainer: { backgroundColor: 'white', borderRadius: 14, padding: 16, elevation: 1, marginBottom: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', marginBottom: 4, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 8, padding: 12, marginBottom: 6, color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0', fontSize: 13, fontWeight: '600' },
  readOnlyText: { fontSize: 14, color: '#0F172A', paddingVertical: 6, fontWeight: '700' },
  radioGroup: { flexDirection: 'row', gap: 8, marginVertical: 6, flexWrap: 'wrap' },
  radioBtn: { flex: 1, minWidth: 80, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  radioBtnActive: { backgroundColor: '#1E293B', borderColor: '#1E293B' },
  radioText: { color: '#64748B', fontWeight: '800', fontSize: 12 },
  radioTextActive: { color: 'white', fontWeight: '800', fontSize: 12 },
  saveBtn: { backgroundColor: '#2563EB', padding: 14, borderRadius: 10, alignItems: 'center', marginTop: 22, elevation: 2 },
  saveBtnText: { color: 'white', fontWeight: '800', fontSize: 14 },
  unsavedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A'
  },
  unsavedBadgeText: { fontSize: 9, fontWeight: '800', color: '#D97706' },
  floatingSaveBar: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: '#334155',
    zIndex: 999
  },
  floatingSaveTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  floatingSaveSub: { color: '#94A3B8', fontSize: 11, fontWeight: '600', marginTop: 1 },
  floatingSaveBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6
  },
  floatingSaveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
