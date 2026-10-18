import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  TextInput, ScrollView, ActivityIndicator, Image, Modal, StatusBar, Platform, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { API_BASE_URL } from '../config';
import { formatLocalDate, formatDisplayDate } from '../utils/dateUtils';

export default function ApprovalCenterScreen({ navigation }) {
  const { user, userToken } = useContext(AuthContext);
  const { selectedSite } = useSite();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20);

  const [activeTab, setActiveTab] = useState('advances'); // 'advances', 'leaves', 'repairs'
  const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL', 'PENDING', 'APPROVED', 'REJECTED'
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Data lists
  const [advances, setAdvances] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [summary, setSummary] = useState({
    pending_advances: 0,
    pending_leaves: 0,
    pending_repairs: 0,
    total_pending: 0
  });

  // Modal State for New Request (Staff / Admin submission)
  const [isRequestModalVisible, setIsRequestModalVisible] = useState(false);
  const [requestType, setRequestType] = useState('ADVANCE'); // 'ADVANCE', 'LEAVE', 'REPAIR'
  
  // Form states
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceReason, setAdvanceReason] = useState('');
  
  const [leaveStartDate, setLeaveStartDate] = useState(new Date());
  const [leaveEndDate, setLeaveEndDate] = useState(new Date());
  const [leaveReason, setLeaveReason] = useState('');
  const [activeDatePicker, setActiveDatePicker] = useState(null); // 'leave_start', 'leave_end'

  const [repairVehicle, setRepairVehicle] = useState('');
  const [repairDescription, setRepairDescription] = useState('');
  const [repairEstimatedCost, setRepairEstimatedCost] = useState('');
  const [repairReceiptUrl, setRepairReceiptUrl] = useState(null);

  // Image viewer modal
  const [viewerUrl, setViewerUrl] = useState(null);
  const [usersList, setUsersList] = useState([]);

  useEffect(() => {
    fetchAllData();
  }, [selectedSite?.id]);

  const fetchAllData = async () => {
    setIsLoading(true);
    try {
      const siteQuery = selectedSite?.id ? `?site_id=${selectedSite.id}` : '';
      
      const promises = [
        fetch(`${API_BASE_URL}/workforce/approvals/summary${siteQuery}`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        }),
        fetch(`${API_BASE_URL}/workforce/advances${siteQuery}`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        }),
        fetch(`${API_BASE_URL}/workforce/leaves${siteQuery}`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        }),
        fetch(`${API_BASE_URL}/workforce/repairs${siteQuery}`, {
          headers: { 'Authorization': `Bearer ${userToken}` }
        }),
      ];

      if (user?.role === 'ADMIN' || user?.role === 'MANAGER') {
        promises.push(
          fetch(`${API_BASE_URL}/users`, {
            headers: { 'Authorization': `Bearer ${userToken}` }
          })
        );
      }

      const results = await Promise.all(promises);
      const [sumRes, advRes, leaveRes, repRes, userRes] = results;

      if (sumRes?.ok) setSummary(await sumRes.json());
      if (advRes?.ok) setAdvances(await advRes.json());
      if (leaveRes?.ok) setLeaves(await leaveRes.json());
      if (repRes?.ok) setRepairs(await repRes.json());
      if (userRes?.ok) setUsersList(await userRes.json());
    } catch (e) {
      console.log('Error fetching approvals data:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const getStaffDisplayName = (item) => {
    if (item.staff_name && item.staff_name.trim()) {
      return item.staff_name;
    }
    const sid = item.staff_id;
    if (!sid) return 'Staff Member';
    const matched = usersList.find(u => Number(u.id) === Number(sid));
    if (matched) {
      return matched.full_name || matched.username;
    }
    return `Staff #${sid}`;
  };

  const getStaffDesignation = (item) => {
    if (item.staff_designation && item.staff_designation.trim()) {
      return item.staff_designation;
    }
    const sid = item.staff_id;
    if (!sid) return null;
    const matched = usersList.find(u => Number(u.id) === Number(sid));
    return matched?.designation || null;
  };

  // --- SUBMISSIONS ---
  const handlePickReceipt = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.5,
        base64: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        setRepairReceiptUrl(`data:image/jpeg;base64,${res.assets[0].base64}`);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not pick image');
    }
  };

  const submitNewRequest = async () => {
    try {
      const siteId = selectedSite?.id || 1;

      const sId = user?.id || user?.user_id;
      if (requestType === 'ADVANCE') {
        if (!advanceAmount || !advanceReason.trim()) {
          Alert.alert('Required', 'Please enter amount and reason');
          return;
        }
        const payload = {
          amount: parseFloat(advanceAmount),
          reason: advanceReason.trim(),
          site_id: siteId
        };
        if (sId) payload.staff_id = parseInt(sId);

        const res = await fetch(`${API_BASE_URL}/workforce/advances`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          Alert.alert('Success', 'Advance request submitted!');
          setAdvanceAmount('');
          setAdvanceReason('');
          setIsRequestModalVisible(false);
          fetchAllData();
        } else {
          const data = await res.json().catch(() => ({}));
          Alert.alert('Error', data?.detail || 'Failed to submit advance request');
        }
      } else if (requestType === 'LEAVE') {
        if (!leaveReason.trim()) {
          Alert.alert('Required', 'Please state the reason for leave');
          return;
        }
        const payload = {
          start_date: formatLocalDate(leaveStartDate),
          end_date: formatLocalDate(leaveEndDate),
          reason: leaveReason.trim(),
          site_id: siteId
        };
        if (sId) payload.staff_id = parseInt(sId);

        const res = await fetch(`${API_BASE_URL}/workforce/leaves`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          Alert.alert('Success', 'Leave request submitted!');
          setLeaveReason('');
          setIsRequestModalVisible(false);
          fetchAllData();
        } else {
          const data = await res.json().catch(() => ({}));
          Alert.alert('Error', data?.detail || 'Failed to submit leave request');
        }
      } else if (requestType === 'REPAIR') {
        if (!repairVehicle.trim() || !repairDescription.trim()) {
          Alert.alert('Required', 'Vehicle number and issue description are required');
          return;
        }
        const res = await fetch(`${API_BASE_URL}/workforce/repairs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${userToken}`
          },
          body: JSON.stringify({
            vehicle_number: repairVehicle.trim().toUpperCase(),
            issue_description: repairDescription.trim(),
            estimated_cost: parseFloat(repairEstimatedCost) || 0.0,
            receipt_photo_url: repairReceiptUrl,
            site_id: siteId
          })
        });
        if (res.ok) {
          Alert.alert('Success', 'Vehicle repair request submitted!');
          setRepairVehicle('');
          setRepairDescription('');
          setRepairEstimatedCost('');
          setRepairReceiptUrl(null);
          setIsRequestModalVisible(false);
          fetchAllData();
        } else {
          Alert.alert('Error', 'Failed to submit vehicle repair request');
        }
      }
    } catch (e) {
      Alert.alert('Error', 'Network error submitting request');
    }
  };

  // --- ACTIONS: APPROVE / REJECT ---
  const handleUpdateStatus = (type, id, newStatus) => {
    const isApprove = newStatus === 'APPROVED';
    const actionText = isApprove ? 'Approve' : 'Reject';

    Alert.alert(
      `${actionText} Request`,
      `Are you sure you want to ${actionText.toLowerCase()} this ${type} request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: actionText,
          style: isApprove ? 'default' : 'destructive',
          onPress: async () => {
            try {
              let endpoint = '';
              let body = { status: newStatus };

              if (type === 'advance') endpoint = `${API_BASE_URL}/workforce/advances/${id}/status`;
              if (type === 'leave') endpoint = `${API_BASE_URL}/workforce/leaves/${id}/status`;
              if (type === 'repair') endpoint = `${API_BASE_URL}/workforce/repairs/${id}/status`;

              const res = await fetch(endpoint, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify(body)
              });

              if (res.ok) {
                Alert.alert('Updated', `Request marked as ${newStatus}`);
                fetchAllData();
              } else {
                Alert.alert('Error', 'Failed to update request');
              }
            } catch (err) {
              Alert.alert('Error', 'Network error');
            }
          }
        }
      ]
    );
  };

  // Filter current list
  const getFilteredList = () => {
    let list = [];
    if (activeTab === 'advances') list = advances;
    if (activeTab === 'leaves') list = leaves;
    if (activeTab === 'repairs') list = repairs;

    if (statusFilter === 'ALL') return list;
    return list.filter(item => item.status === statusFilter);
  };

  const filteredItems = getFilteredList();

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'APPROVED': return { bg: '#DCFCE7', text: '#15803D', label: 'APPROVED' };
      case 'REJECTED': return { bg: '#FEE2E2', text: '#B91C1C', label: 'REJECTED' };
      default: return { bg: '#FEF3C7', text: '#B45309', label: 'PENDING' };
    }
  };

  return (
    <View style={[styles.safe, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSubtitle}>TAB C: WORKFORCE & APPROVALS</Text>
          <Text style={styles.headerTitle}>Approval Workflow</Text>
        </View>
        <TouchableOpacity 
          style={styles.addBtn}
          onPress={() => {
            if (activeTab === 'advances') setRequestType('ADVANCE');
            if (activeTab === 'leaves') setRequestType('LEAVE');
            if (activeTab === 'repairs') setRequestType('REPAIR');
            setIsRequestModalVisible(true);
          }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Request</Text>
        </TouchableOpacity>
      </View>

      {/* 3 Main Segmented Tabs with Badges */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'advances' && styles.tabActive]}
          onPress={() => setActiveTab('advances')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons 
            name="cash-fast" 
            size={18} 
            color={activeTab === 'advances' ? '#2563EB' : '#64748B'} 
          />
          <Text style={[styles.tabText, activeTab === 'advances' && styles.tabTextActive]}>Advances</Text>
          {summary.pending_advances > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{summary.pending_advances}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'leaves' && styles.tabActive]}
          onPress={() => setActiveTab('leaves')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons 
            name="calendar-clock" 
            size={18} 
            color={activeTab === 'leaves' ? '#2563EB' : '#64748B'} 
          />
          <Text style={[styles.tabText, activeTab === 'leaves' && styles.tabTextActive]}>Leaves</Text>
          {summary.pending_leaves > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{summary.pending_leaves}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'repairs' && styles.tabActive]}
          onPress={() => setActiveTab('repairs')}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons 
            name="wrench-outline" 
            size={18} 
            color={activeTab === 'repairs' ? '#2563EB' : '#64748B'} 
          />
          <Text style={[styles.tabText, activeTab === 'repairs' && styles.tabTextActive]}>Repairs</Text>
          {summary.pending_repairs > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{summary.pending_repairs}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Filter Row */}
      <View style={styles.filterRow}>
        {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[styles.filterChip, statusFilter === filter && styles.filterChipActive]}
            onPress={() => setStatusFilter(filter)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterChipText, statusFilter === filter && styles.filterChipTextActive]}>
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Request Cards Stream */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => { setIsRefreshing(true); fetchAllData(); }}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Fetching approval workflows...</Text>
          </View>
        ) : filteredItems.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons 
              name={activeTab === 'advances' ? 'cash-check' : activeTab === 'leaves' ? 'calendar-check' : 'wrench-check'} 
              size={52} 
              color="#CBD5E1" 
            />
            <Text style={styles.emptyTitle}>No {statusFilter.toLowerCase()} requests</Text>
            <Text style={styles.emptySubtitle}>All items in this queue are resolved or none exist.</Text>
          </View>
        ) : (
          filteredItems.map((item) => {
            const badge = getStatusBadgeStyle(item.status);
            const isPending = item.status === 'PENDING';
            const canManage = user?.role === 'ADMIN' || user?.role === 'MANAGER';

            return (
              <View key={`${activeTab}-${item.id}`} style={styles.requestCard}>
                {/* Card Top */}
                <View style={styles.cardTop}>
                  <View style={styles.cardHeaderLeft}>
                    <Text style={styles.cardId}>#{item.id}</Text>
                    <Text style={styles.cardDate}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: badge.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: badge.text }]}>{badge.label}</Text>
                  </View>
                </View>

                {/* Specific Tab Body */}
                {activeTab === 'advances' && (
                  <View style={styles.cardBody}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <MaterialCommunityIcons name="account-circle" size={20} color="#2563EB" />
                          <Text style={styles.staffTitle}>{getStaffDisplayName(item)}</Text>
                        </View>
                        {getStaffDesignation(item) ? (
                          <Text style={styles.staffSubtitle}>{getStaffDesignation(item)}</Text>
                        ) : null}
                      </View>
                      <Text style={styles.amountHighlight}>₹{item.amount?.toLocaleString()}</Text>
                    </View>
                    <Text style={styles.reasonText}>
                      <Text style={{ fontWeight: '700' }}>Reason: </Text>
                      {item.reason}
                    </Text>
                  </View>
                )}

                {activeTab === 'leaves' && (
                  <View style={styles.cardBody}>
                    <View style={styles.rowBetween}>
                      <View style={{ flex: 1, marginRight: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <MaterialCommunityIcons name="account-circle" size={20} color="#2563EB" />
                          <Text style={styles.staffTitle}>{getStaffDisplayName(item)}</Text>
                        </View>
                        {getStaffDesignation(item) ? (
                          <Text style={styles.staffSubtitle}>{getStaffDesignation(item)}</Text>
                        ) : null}
                      </View>
                      <View style={styles.dateBadge}>
                        <MaterialCommunityIcons name="calendar-range" size={14} color="#2563EB" style={{ marginRight: 4 }} />
                        <Text style={styles.dateBadgeText}>{item.start_date} to {item.end_date}</Text>
                      </View>
                    </View>
                    <Text style={styles.reasonText}>
                      <Text style={{ fontWeight: '700' }}>Reason: </Text>
                      {item.reason}
                    </Text>
                  </View>
                )}

                {activeTab === 'repairs' && (
                  <View style={styles.cardBody}>
                    <View style={styles.rowBetween}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <MaterialCommunityIcons name="truck" size={18} color="#0F172A" />
                        <Text style={styles.vehicleHighlight}>{item.vehicle_number}</Text>
                      </View>
                      <Text style={styles.amountHighlight}>Est: ₹{item.estimated_cost?.toLocaleString()}</Text>
                    </View>
                    {item.staff_id ? (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2, marginBottom: 2 }}>
                        <MaterialCommunityIcons name="account-outline" size={14} color="#64748B" />
                        <Text style={styles.subDetailText}>Requested by: {getStaffDisplayName(item)}</Text>
                      </View>
                    ) : null}
                    <Text style={styles.reasonText}>
                      <Text style={{ fontWeight: '700' }}>Issue: </Text>
                      {item.issue_description}
                    </Text>
                    {item.receipt_photo_url ? (
                      <TouchableOpacity 
                        style={styles.docThumbnailRow} 
                        onPress={() => setViewerUrl(item.receipt_photo_url)}
                        activeOpacity={0.8}
                      >
                        <Image source={{ uri: item.receipt_photo_url }} style={styles.docThumbnail} />
                        <Text style={styles.docThumbnailText}>View Attached Bill / Photo</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                )}

                {/* Card Action Buttons (Approve / Reject) for Admin & Manager */}
                {isPending && canManage && (
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={styles.rejectBtn}
                      onPress={() => handleUpdateStatus(
                        activeTab === 'advances' ? 'advance' : activeTab === 'leaves' ? 'leave' : 'repair',
                        item.id,
                        'REJECTED'
                      )}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="close-circle-outline" size={16} color="#DC2626" />
                      <Text style={styles.rejectBtnText}>Reject</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.approveBtn}
                      onPress={() => handleUpdateStatus(
                        activeTab === 'advances' ? 'advance' : activeTab === 'leaves' ? 'leave' : 'repair',
                        item.id,
                        'APPROVED'
                      )}
                      activeOpacity={0.8}
                    >
                      <MaterialCommunityIcons name="check-circle" size={16} color="#FFFFFF" />
                      <Text style={styles.approveBtnText}>Approve</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* SUBMISSION MODAL */}
      <Modal visible={isRequestModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>New {requestType} Request</Text>
              <TouchableOpacity onPress={() => setIsRequestModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Request Type Selector */}
            <View style={styles.typeSelectorRow}>
              {['ADVANCE', 'LEAVE', 'REPAIR'].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[styles.typeBtn, requestType === t && styles.typeBtnActive]}
                  onPress={() => setRequestType(t)}
                >
                  <Text style={[styles.typeBtnText, requestType === t && styles.typeBtnTextActive]}>
                    {t}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {requestType === 'ADVANCE' && (
                <>
                  <Text style={styles.inputLabel}>Advance Amount (₹)*</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 5000"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={advanceAmount}
                    onChangeText={setAdvanceAmount}
                  />

                  <Text style={styles.inputLabel}>Reason for Advance*</Text>
                  <TextInput
                    style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                    placeholder="Medical, family need, etc."
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={advanceReason}
                    onChangeText={setAdvanceReason}
                  />
                </>
              )}

              {requestType === 'LEAVE' && (
                <>
                  <View style={styles.rowBetween}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.inputLabel}>From Date</Text>
                      <TouchableOpacity 
                        style={styles.dateSelector} 
                        onPress={() => setActiveDatePicker('leave_start')}
                      >
                        <MaterialCommunityIcons name="calendar" size={16} color="#64748B" />
                        <Text style={styles.dateSelectorText}>
                          {formatDisplayDate(leaveStartDate)}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.inputLabel}>To Date</Text>
                      <TouchableOpacity 
                        style={styles.dateSelector} 
                        onPress={() => setActiveDatePicker('leave_end')}
                      >
                        <MaterialCommunityIcons name="calendar" size={16} color="#64748B" />
                        <Text style={styles.dateSelectorText}>
                          {formatDisplayDate(leaveEndDate)}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  <Text style={styles.inputLabel}>Reason for Leave*</Text>
                  <TextInput
                    style={[styles.input, { height: 75, textAlignVertical: 'top' }]}
                    placeholder="Reason (vacation, sickness, urgent work...)"
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={leaveReason}
                    onChangeText={setLeaveReason}
                  />
                </>
              )}

              {requestType === 'REPAIR' && (
                <>
                  <Text style={styles.inputLabel}>Vehicle Number*</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. CG04HA1234 / JCB-01"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="characters"
                    value={repairVehicle}
                    onChangeText={setRepairVehicle}
                  />

                  <Text style={styles.inputLabel}>Estimated Cost (₹)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 2500"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={repairEstimatedCost}
                    onChangeText={setRepairEstimatedCost}
                  />

                  <Text style={styles.inputLabel}>Issue Description*</Text>
                  <TextInput
                    style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                    placeholder="Tyre puncture, oil leak, hydraulic pipe issue..."
                    placeholderTextColor="#94A3B8"
                    multiline
                    value={repairDescription}
                    onChangeText={setRepairDescription}
                  />

                  <Text style={styles.inputLabel}>Bill / Damage Photo</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <TouchableOpacity style={styles.uploadBtn} onPress={handlePickReceipt}>
                      <MaterialCommunityIcons name="camera-plus" size={18} color="#2563EB" />
                      <Text style={styles.uploadBtnText}>Upload Bill / Photo</Text>
                    </TouchableOpacity>
                    {repairReceiptUrl && (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <Image source={{ uri: repairReceiptUrl }} style={{ width: 42, height: 42, borderRadius: 6, marginRight: 6 }} />
                        <TouchableOpacity onPress={() => setRepairReceiptUrl(null)}>
                          <MaterialCommunityIcons name="close-circle" size={18} color="#DC2626" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </>
              )}

              <TouchableOpacity style={styles.submitModalBtn} onPress={submitNewRequest} activeOpacity={0.8}>
                <Text style={styles.submitModalBtnText}>Submit Request</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {activeDatePicker && (
        <DateTimePicker
          value={activeDatePicker === 'leave_start' ? leaveStartDate : leaveEndDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            const picker = activeDatePicker;
            setActiveDatePicker(null);
            if (selectedDate) {
              if (picker === 'leave_start') setLeaveStartDate(selectedDate);
              if (picker === 'leave_end') setLeaveEndDate(selectedDate);
            }
          }}
        />
      )}

      {/* Image Viewer Modal */}
      <Modal visible={!!viewerUrl} transparent animationType="fade">
        <TouchableOpacity style={styles.viewerOverlay} onPress={() => setViewerUrl(null)} activeOpacity={1}>
          <Image source={{ uri: viewerUrl }} style={styles.fullImage} resizeMode="contain" />
          <Text style={styles.viewerCloseText}>Tap anywhere to close</Text>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  backBtn: { padding: 6, marginRight: 8 },
  headerSubtitle: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4
  },
  addBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0'
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  tabText: { fontSize: 13, fontWeight: '700', color: '#64748B' },
  tabTextActive: { color: '#2563EB' },
  tabBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tabBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9'
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F1F5F9'
  },
  filterChipActive: { backgroundColor: '#0F172A' },
  filterChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  filterChipTextActive: { color: '#FFFFFF' },
  scroll: { flex: 1, backgroundColor: '#F8FAFC' },
  scrollContent: { padding: 16, gap: 12 },
  loadingBox: { alignItems: 'center', marginTop: 40 },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 14 },
  emptyBox: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#475569', marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 4 },
  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    paddingBottom: 8
  },
  cardHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardId: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  cardDate: { fontSize: 11, color: '#94A3B8' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  cardBody: { gap: 6, marginBottom: 12 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  staffTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  staffSubtitle: { fontSize: 11, color: '#64748B', fontWeight: '600', marginLeft: 26, marginTop: 1 },
  subDetailText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  amountHighlight: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  vehicleHighlight: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  reasonText: { fontSize: 13, color: '#475569', lineHeight: 18 },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6
  },
  dateBadgeText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  docThumbnailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 6,
    padding: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 6
  },
  docThumbnail: { width: 36, height: 36, borderRadius: 4 },
  docThumbnailText: { fontSize: 12, fontWeight: '600', color: '#2563EB' },
  cardActions: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA'
  },
  rejectBtnText: { fontSize: 13, fontWeight: '800', color: '#DC2626' },
  approveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#16A34A',
  },
  approveBtnText: { fontSize: 13, fontWeight: '800', color: '#FFFFFF' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end'
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%'
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16
  },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  typeSelectorRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  typeBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#F1F5F9'
  },
  typeBtnActive: { backgroundColor: '#2563EB' },
  typeBtnText: { fontSize: 12, fontWeight: '700', color: '#64748B' },
  typeBtnTextActive: { color: '#FFFFFF' },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 14
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 6,
    marginBottom: 14
  },
  dateSelectorText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6
  },
  uploadBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  submitModalBtn: {
    backgroundColor: '#0F172A',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20
  },
  submitModalBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullImage: { width: '92%', height: '80%' },
  viewerCloseText: { color: '#FFFFFF', marginTop: 16, fontSize: 14, fontWeight: '600' }
});
