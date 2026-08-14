import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView, TextInput, Alert, SafeAreaView, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { API_BASE_URL } from '../config';

export default function UserProfileScreen({ route, navigation }) {
  const { userProfile, userToken, dailyLedgerEntries, sites } = route.params;

  const [profileDesignation, setProfileDesignation] = useState(userProfile.designation || '');
  const [profileName, setProfileName] = useState(userProfile.full_name || '');
  const [profileRelation, setProfileRelation] = useState(userProfile.relative_relation || '');
  const [profileRelativeName, setProfileRelativeName] = useState(userProfile.relative_name || '');
  const [profileEmployeeOf, setProfileEmployeeOf] = useState(userProfile.employee_of || 'DEPARTMENTAL');
  const [profileDepartment, setProfileDepartment] = useState(userProfile.department || '');
  const [profileEmploymentType, setProfileEmploymentType] = useState(userProfile.employment_type || 'PERMANENT');
  const [profileEmployeeIdCustom, setProfileEmployeeIdCustom] = useState(userProfile.employee_id_custom || '');
  const [profileSiteId, setProfileSiteId] = useState(userProfile.site_id ? String(userProfile.site_id) : '');

  const [isProfileEditMode, setIsProfileEditMode] = useState(false);
  const [isBasicDetailsCollapsed, setIsBasicDetailsCollapsed] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState(userProfile);

  // Balance Calculation
  const uLedgerEntries = dailyLedgerEntries.filter(e => e.staff_id === currentUserProfile.id);
  const ledgerSum = uLedgerEntries.reduce((sum, entry) => sum + (entry.amount || 0), 0);
  const currentBalance = ledgerSum + (currentUserProfile.opening_balance || 0);

  const assignedSite = sites.find(s => s.id === currentUserProfile.site_id);
  const siteName = assignedSite ? assignedSite.name : 'None';

  const saveUserProfile = async () => {
    try {
      const body = {
        designation: profileDesignation,
        full_name: profileName,
        relative_relation: profileRelation,
        relative_name: profileRelativeName,
        employee_of: profileEmployeeOf,
        department: profileDepartment,
        employment_type: profileEmploymentType,
        employee_id_custom: profileEmployeeIdCustom,
        site_id: profileSiteId ? parseInt(profileSiteId) : null,
      };

      const resp = await fetch(`${API_BASE_URL}/auth/users/${currentUserProfile.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
        body: JSON.stringify(body)
      });

      if (resp.ok) {
        Alert.alert("Success", "Profile updated successfully!");
        setIsProfileEditMode(false);
        const updatedUser = await resp.json();
        setCurrentUserProfile(updatedUser);
      } else {
        const err = await resp.json();
        Alert.alert("Error", err.detail || "Could not update profile");
      }
    } catch (e) {
      Alert.alert("Error", "Failed to save profile changes");
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ flexDirection: 'row', alignItems: 'center' }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
          <Text style={styles.headerTitle}>Human Resource Detail</Text>
        </TouchableOpacity>
        
        <TouchableOpacity onPress={() => {
          Alert.alert(
            "Options",
            "Choose an action",
            [
              { text: isProfileEditMode ? "Cancel Editing" : "Edit Profile Info", onPress: () => setIsProfileEditMode(!isProfileEditMode) },
              { text: "Delete User", style: "destructive", onPress: () => deleteUser(currentUserProfile.id) },
              { text: "Cancel", style: "cancel" }
            ]
          );
        }}>
          <MaterialCommunityIcons name="dots-vertical" size={24} color="#1E293B" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16 }}>
        {/* Accordion / Collapsible Header (Basic Details) */}
        <TouchableOpacity 
          style={styles.collapsibleCard}
          onPress={() => setIsBasicDetailsCollapsed(!isBasicDetailsCollapsed)}
        >
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.sectionTitle}>Basic Details</Text>
            <MaterialCommunityIcons name={isBasicDetailsCollapsed ? "chevron-down" : "chevron-up"} size={20} color="#6B7280" />
          </View>

          {!isBasicDetailsCollapsed && (
            <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                {currentUserProfile.profile_photo_url ? (
                  <Image source={{ uri: currentUserProfile.profile_photo_url }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text style={{ fontSize: 24 }}>👤</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#2563EB' }}>Staff ID: #{currentUserProfile.id}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#1F2937' }}>{currentUserProfile.full_name || currentUserProfile.username}</Text>
                  <Text style={{ fontSize: 12, color: '#6B7280' }}>Role: {currentUserProfile.designation || currentUserProfile.role}</Text>
                </View>
              </View>

              {/* Contact Actions */}
              <View style={styles.contactRow}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>📞 {currentUserProfile.phone_number || 'N/A'}</Text>
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
                <Text style={styles.infoLabel}>Current Balance:</Text>
                <Text style={[styles.infoValue, { color: currentBalance < 0 ? '#DC2626' : '#111827' }]}>
                  ₹{currentBalance.toLocaleString()}
                </Text>
              </View>

              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Assigned Site:</Text>
                <Text style={styles.infoValue}>{siteName}</Text>
              </View>

              <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 8 }}>
                <Text style={{ fontSize: 10, color: '#9CA3AF' }}>Created By: {currentUserProfile.created_by || 'N/A'} on {currentUserProfile.created_at ? new Date(currentUserProfile.created_at).toLocaleString() : 'N/A'}</Text>
              </View>
            </View>
          )}
        </TouchableOpacity>

        {/* Profile Inputs (Read-Only / Edit Mode) */}
        <View style={styles.formContainer}>
          <Text style={[styles.sectionTitle, { marginBottom: 14 }]}>Employment Profile</Text>
          
          <Text style={styles.inputLabel}>Designation</Text>
          {isProfileEditMode ? (
            <TextInput style={styles.input} value={profileDesignation} onChangeText={setProfileDesignation} placeholder="e.g. Jcb Operator" />
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.designation || 'None'}</Text>
          )}

          <Text style={styles.inputLabel}>Full Name</Text>
          {isProfileEditMode ? (
            <TextInput style={styles.input} value={profileName} onChangeText={setProfileName} />
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.full_name || 'None'}</Text>
          )}

          <Text style={styles.inputLabel}>Relation</Text>
          {isProfileEditMode ? (
            <View style={styles.radioGroup}>
              {['Father', 'Mother', 'Husband'].map(r => (
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
            <TextInput style={styles.input} value={profileRelativeName} onChangeText={setProfileRelativeName} placeholder="Relative Full Name" />
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
            <TextInput style={styles.input} value={profileDepartment} onChangeText={setProfileDepartment} placeholder="e.g. Operations" />
          ) : (
            <Text style={styles.readOnlyText}>{currentUserProfile.department || 'None'}</Text>
          )}

          <Text style={styles.inputLabel}>Employee ID (Custom)</Text>
          {isProfileEditMode ? (
            <TextInput style={styles.input} value={profileEmployeeIdCustom} onChangeText={setProfileEmployeeIdCustom} placeholder="Custom Database ID" />
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

          <Text style={styles.inputLabel}>Reference</Text>
          <Text style={styles.referenceText}>
            #{currentUserProfile.id} {currentUserProfile.full_name || currentUserProfile.username} ({currentUserProfile.role})
          </Text>

          <Text style={styles.inputLabel}>Current Working Site</Text>
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

          {isProfileEditMode && (
            <TouchableOpacity style={styles.saveBtn} onPress={saveUserProfile}>
              <Text style={styles.saveBtnText}>Save Profile Changes</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'white' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginLeft: 8 },
  collapsibleCard: { backgroundColor: 'white', borderRadius: 12, padding: 14, borderLeftWidth: 4, borderLeftColor: '#2563EB', marginBottom: 16, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1E293B', textTransform: 'uppercase', letterSpacing: 0.5 },
  avatarImage: { width: 60, height: 60, borderRadius: 30, marginRight: 12 },
  avatarPlaceholder: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  contactRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, marginBottom: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  infoLabel: { fontSize: 13, color: '#6B7280' },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#374151' },
  formContainer: { backgroundColor: 'white', borderRadius: 12, padding: 16, elevation: 1, marginBottom: 24 },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#4B5563', marginBottom: 6, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#F3F4F6', borderRadius: 8, padding: 12, marginBottom: 10, color: '#111827' },
  readOnlyText: { fontSize: 15, color: '#1F2937', paddingVertical: 6, fontWeight: '600' },
  radioGroup: { flexDirection: 'row', gap: 10, marginVertical: 6 },
  radioBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  radioBtnActive: { backgroundColor: '#1E293B' },
  radioText: { color: '#6B7280', fontWeight: '800', fontSize: 13 },
  radioTextActive: { color: 'white', fontWeight: '800', fontSize: 13 },
  roleTextActive: { color: 'white', fontWeight: '800', fontSize: 13 },
  saveBtn: { backgroundColor: '#2563EB', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 20 },
  saveBtnText: { color: 'white', fontWeight: 'bold' },
  referenceText: { fontSize: 15, color: '#6B7280', paddingVertical: 6, fontStyle: 'italic' }
});
