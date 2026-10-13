import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity,
  TextInput, ScrollView, Alert, ActivityIndicator, Image, Platform
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_BASE_URL } from '../config';

export default function ManualAttendanceModal({
  visible,
  onClose,
  onSaveSuccess,
  initialStaff = null,
  initialDate = null,
  initialRecord = null,
  staffList = [],
  sites = [],
  userToken,
  currentRole = 'ADMIN',
  activeSiteId = null
}) {
  const [selectedStaff, setSelectedStaff] = useState(initialStaff);
  const [isStaffPickerOpen, setIsStaffPickerOpen] = useState(false);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // Date State
  const [attDate, setAttDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  // In-Time and Out-Time State
  const [inTime, setInTime] = useState(null); // Date object
  const [outTime, setOutTime] = useState(null); // Date object
  const [showInTimePicker, setShowInTimePicker] = useState(false);
  const [showOutTimePicker, setShowOutTimePicker] = useState(false);

  // Attendance Fields
  const [status, setStatus] = useState('PRESENT'); // PRESENT, HALF_DAY, ABSENT, ON_LEAVE
  const [hoursWorked, setHoursWorked] = useState('8.0');
  const [notes, setNotes] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState(activeSiteId || '');
  const [isSitePickerOpen, setIsSitePickerOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Format Time Helper (e.g. 09:30 AM)
  const formatTimeDisplay = (d) => {
    if (!d) return '--:--';
    try {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch (_) {
      return '--:--';
    }
  };

  // Calculate hours worked between In-Time and Out-Time (handles overnight shifts)
  const calculateDurationHours = (inD, outD) => {
    if (!inD || !outD) return null;
    let diffMs = outD.getTime() - inD.getTime();
    if (diffMs < 0) {
      // Overnight shift: Out time is past midnight on the following day
      diffMs += 24 * 60 * 60 * 1000;
    }
    const hours = diffMs / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100;
  };

  // Sync initial props on open
  useEffect(() => {
    if (visible) {
      // 1. Staff selection
      if (initialStaff) {
        setSelectedStaff(initialStaff);
      } else if (staffList.length > 0 && !selectedStaff) {
        setSelectedStaff(staffList[0]);
      }

      // 2. Date selection
      if (initialDate) {
        if (typeof initialDate === 'string') {
          const [y, m, d] = initialDate.split('T')[0].split('-').map(Number);
          setAttDate(new Date(y, m - 1, d));
        } else if (initialDate instanceof Date) {
          setAttDate(initialDate);
        }
      } else {
        setAttDate(new Date());
      }

      // 3. Populate existing record details or defaults
      if (initialRecord) {
        setStatus(initialRecord.status || 'PRESENT');
        setHoursWorked(initialRecord.hours_worked !== undefined && initialRecord.hours_worked !== null ? String(initialRecord.hours_worked) : '8.0');
        setNotes(initialRecord.notes || '');
        setSelectedSiteId(initialRecord.site_id ? String(initialRecord.site_id) : (activeSiteId || ''));

        if (initialRecord.punch_in_time) {
          try {
            setInTime(new Date(initialRecord.punch_in_time));
          } catch (_) { setInTime(null); }
        } else {
          setInTime(null);
        }

        if (initialRecord.punch_out_time) {
          try {
            setOutTime(new Date(initialRecord.punch_out_time));
          } catch (_) { setOutTime(null); }
        } else {
          setOutTime(null);
        }
      } else {
        setStatus('PRESENT');
        setHoursWorked('8.0');
        
        // Default In/Out times for new present entry (9:00 AM to 5:00 PM)
        const defaultIn = new Date();
        defaultIn.setHours(9, 0, 0, 0);
        const defaultOut = new Date();
        defaultOut.setHours(17, 0, 0, 0);
        setInTime(defaultIn);
        setOutTime(defaultOut);

        setNotes(`Manually marked by ${currentRole === 'ADMIN' ? 'Admin' : 'Manager'}`);
        setSelectedSiteId(initialStaff?.site_id ? String(initialStaff.site_id) : (activeSiteId || ''));
      }
    }
  }, [visible, initialStaff, initialDate, initialRecord]);

  // When In-Time changes
  const handleInTimeChange = (event, selectedTime) => {
    setShowInTimePicker(false);
    if (selectedTime) {
      setInTime(selectedTime);
      if (outTime) {
        const duration = calculateDurationHours(selectedTime, outTime);
        if (duration !== null) {
          setHoursWorked(String(duration));
          if (duration >= 6) setStatus('PRESENT');
          else if (duration > 0) setStatus('HALF_DAY');
        }
      }
    }
  };

  // When Out-Time changes
  const handleOutTimeChange = (event, selectedTime) => {
    setShowOutTimePicker(false);
    if (selectedTime) {
      setOutTime(selectedTime);
      if (inTime) {
        const duration = calculateDurationHours(inTime, selectedTime);
        if (duration !== null) {
          setHoursWorked(String(duration));
          if (duration >= 6) setStatus('PRESENT');
          else if (duration > 0) setStatus('HALF_DAY');
        }
      }
    }
  };

  // Quick Preset Handlers
  const handleStatusPreset = (presetStatus) => {
    setStatus(presetStatus);
    if (presetStatus === 'PRESENT') {
      // If currently 0 or empty, default to 8.0 hrs and 9:00 AM - 5:00 PM
      if (!hoursWorked || parseFloat(hoursWorked) === 0) {
        setHoursWorked('8.0');
        const defaultIn = new Date();
        defaultIn.setHours(9, 0, 0, 0);
        const defaultOut = new Date();
        defaultOut.setHours(17, 0, 0, 0);
        setInTime(defaultIn);
        setOutTime(defaultOut);
      }
    } else if (presetStatus === 'HALF_DAY') {
      if (!hoursWorked || parseFloat(hoursWorked) >= 8 || parseFloat(hoursWorked) === 0) {
        setHoursWorked('4.0');
        const defaultIn = new Date();
        defaultIn.setHours(9, 0, 0, 0);
        const defaultOut = new Date();
        defaultOut.setHours(13, 0, 0, 0);
        setInTime(defaultIn);
        setOutTime(defaultOut);
      }
    } else if (presetStatus === 'ABSENT' || presetStatus === 'ON_LEAVE') {
      setHoursWorked('0.0');
      setInTime(null);
      setOutTime(null);
    }
  };

  // Quick Shift Presets
  const applyShiftPreset = (inH, inM, outH, outM, defaultStatus = 'PRESENT') => {
    const newIn = new Date();
    newIn.setHours(inH, inM, 0, 0);
    const newOut = new Date();
    newOut.setHours(outH, outM, 0, 0);
    setInTime(newIn);
    setOutTime(newOut);

    const duration = calculateDurationHours(newIn, newOut);
    if (duration !== null) {
      setHoursWorked(String(duration));
    }
    setStatus(defaultStatus);
  };

  const formatDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  // Build full ISO timestamp by combining target date with selected time
  const buildIsoTimestamp = (targetDate, timeObj, isNextDay = false) => {
    if (!timeObj) return null;
    const y = targetDate.getFullYear();
    const m = targetDate.getMonth();
    let day = targetDate.getDate();
    if (isNextDay) day += 1;

    const fullD = new Date(y, m, day, timeObj.getHours(), timeObj.getMinutes(), 0, 0);
    return fullD.toISOString();
  };

  const handleSave = async () => {
    if (!selectedStaff) {
      return Alert.alert('Required', 'Please select a worker / staff member');
    }

    const parsedHours = parseFloat(hoursWorked);
    if (isNaN(parsedHours) || parsedHours < 0) {
      return Alert.alert('Invalid Hours', 'Please enter a valid number for working hours (e.g. 8.0, 9.5, 4.0)');
    }

    setIsLoading(true);
    try {
      const dateStr = formatDateStr(attDate);
      
      // Determine if outTime is next day (overnight shift)
      let isOvernight = false;
      if (inTime && outTime && outTime.getTime() < inTime.getTime()) {
        isOvernight = true;
      }

      const punchInIso = buildIsoTimestamp(attDate, inTime, false);
      const punchOutIso = buildIsoTimestamp(attDate, outTime, isOvernight);

      const payload = {
        staff_id: selectedStaff.id,
        date: dateStr,
        status: status,
        notes: notes.trim() || undefined,
        hours_worked: parsedHours,
        punch_in_time: punchInIso || undefined,
        punch_out_time: punchOutIso || undefined,
        site_id: selectedSiteId ? parseInt(selectedSiteId) : (selectedStaff.site_id || 1)
      };

      const resp = await fetch(`${API_BASE_URL}/workforce/attendance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userToken}`
        },
        body: JSON.stringify(payload)
      });

      if (resp.ok) {
        const data = await resp.json();
        Alert.alert('Success', `Attendance recorded for ${selectedStaff.full_name || selectedStaff.username}: ${status} (${parsedHours}h)`);
        if (onSaveSuccess) onSaveSuccess(data);
        onClose();
      } else {
        const err = await resp.json();
        Alert.alert('Error', err.detail || 'Failed to save attendance');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error while saving attendance');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = () => {
    if (!initialRecord?.id) return;
    Alert.alert(
      'Delete Attendance Record?',
      `Are you sure you want to remove the attendance record for ${selectedStaff?.full_name || selectedStaff?.username} on ${formatDateStr(attDate)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const resp = await fetch(`${API_BASE_URL}/workforce/attendance/${initialRecord.id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${userToken}` }
              });
              if (resp.ok) {
                Alert.alert('Deleted', 'Attendance record deleted successfully');
                if (onSaveSuccess) onSaveSuccess(null);
                onClose();
              } else {
                const err = await resp.json();
                Alert.alert('Error', err.detail || 'Could not delete record');
              }
            } catch (e) {
              Alert.alert('Error', 'Network error');
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const filteredStaffList = staffList.filter(s => {
    if (!staffSearchQuery) return true;
    const query = staffSearchQuery.toLowerCase();
    return (
      (s.full_name || '').toLowerCase().includes(query) ||
      (s.username || '').toLowerCase().includes(query) ||
      (s.designation || '').toLowerCase().includes(query) ||
      String(s.id).includes(query)
    );
  });

  const selectedSiteObj = sites.find(s => String(s.id) === String(selectedSiteId));
  const parsedHoursVal = parseFloat(hoursWorked) || 0;
  const isOvertime = parsedHoursVal > 8.0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.headerIconWrapper}>
                <MaterialCommunityIcons name="clipboard-clock-outline" size={22} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.title}>
                  {initialRecord ? 'Edit Attendance & Shift' : 'Mark Manual Attendance'}
                </Text>
                <Text style={styles.subtitle}>
                  {currentRole === 'ADMIN' ? 'Admin Access' : 'Manager Access'}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <MaterialCommunityIcons name="close" size={22} color="#64748B" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
            {/* 1. Worker / Staff Selection */}
            <Text style={styles.fieldLabel}>WORKER / STAFF MEMBER</Text>
            <TouchableOpacity
              style={styles.selectorBtn}
              onPress={() => setIsStaffPickerOpen(!isStaffPickerOpen)}
            >
              {selectedStaff?.profile_photo_url ? (
                <Image source={{ uri: selectedStaff.profile_photo_url }} style={styles.staffAvatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={{ fontSize: 16 }}>👤</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.staffNameText}>
                  {selectedStaff ? `${selectedStaff.full_name || selectedStaff.username} (#${selectedStaff.id})` : 'Select Worker'}
                </Text>
                {selectedStaff && (
                  <Text style={styles.staffRoleText}>
                    {selectedStaff.designation || selectedStaff.role} • {selectedStaff.employee_of === 'CONTRACTOR' ? 'Contractor' : 'Departmental'}
                  </Text>
                )}
              </View>
              <MaterialCommunityIcons name={isStaffPickerOpen ? "chevron-up" : "chevron-down"} size={20} color="#64748B" />
            </TouchableOpacity>

            {/* Staff Picker Dropdown */}
            {isStaffPickerOpen && (
              <View style={styles.dropdownBox}>
                <View style={styles.searchBar}>
                  <MaterialCommunityIcons name="magnify" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search worker name, ID..."
                    placeholderTextColor="#94A3B8"
                    value={staffSearchQuery}
                    onChangeText={setStaffSearchQuery}
                  />
                  {staffSearchQuery ? (
                    <TouchableOpacity onPress={() => setStaffSearchQuery('')}>
                      <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : null}
                </View>

                <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
                  {filteredStaffList.map(s => {
                    const isCurrent = selectedStaff?.id === s.id;
                    return (
                      <TouchableOpacity
                        key={s.id}
                        style={[styles.staffOptionRow, isCurrent && styles.staffOptionRowActive]}
                        onPress={() => {
                          setSelectedStaff(s);
                          setIsStaffPickerOpen(false);
                          if (s.site_id && !selectedSiteId) {
                            setSelectedSiteId(String(s.site_id));
                          }
                        }}
                      >
                        {s.profile_photo_url ? (
                          <Image source={{ uri: s.profile_photo_url }} style={styles.staffOptionAvatar} />
                        ) : (
                          <View style={styles.staffOptionPlaceholder}>
                            <Text style={{ fontSize: 13 }}>👤</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.staffOptionName, isCurrent && { color: '#2563EB', fontWeight: '800' }]}>
                            #{s.id} {s.full_name || s.username}
                          </Text>
                          <Text style={styles.staffOptionSub}>{s.designation || s.role}</Text>
                        </View>
                        {isCurrent && <MaterialCommunityIcons name="check" size={18} color="#2563EB" />}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {/* 2. Date Selection */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ATTENDANCE DATE</Text>
            <TouchableOpacity
              style={styles.dateSelector}
              onPress={() => setShowDatePicker(true)}
            >
              <MaterialCommunityIcons name="calendar" size={20} color="#2563EB" />
              <Text style={styles.dateText}>
                {attDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={18} color="#64748B" />
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={attDate}
                mode="date"
                display="default"
                onChange={(event, selected) => {
                  setShowDatePicker(false);
                  if (selected) setAttDate(selected);
                }}
              />
            )}

            {/* 3. In-Time and Out-Time Section */}
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.fieldLabel}>SHIFT IN & OUT TIMINGS</Text>
                {(inTime || outTime) && (
                  <TouchableOpacity
                    onPress={() => { setInTime(null); setOutTime(null); }}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#EF4444' }}>Clear Times</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.timePickerRow}>
                {/* In-Time Picker Button */}
                <TouchableOpacity
                  style={[styles.timeBtn, inTime && styles.timeBtnActive]}
                  onPress={() => setShowInTimePicker(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="login" size={18} color={inTime ? "#2563EB" : "#64748B"} />
                    <Text style={styles.timeBtnLabel}>IN TIME</Text>
                  </View>
                  <Text style={[styles.timeValueText, inTime && styles.timeValueTextActive]}>
                    {formatTimeDisplay(inTime)}
                  </Text>
                </TouchableOpacity>

                <MaterialCommunityIcons name="arrow-right" size={18} color="#94A3B8" style={{ alignSelf: 'center' }} />

                {/* Out-Time Picker Button */}
                <TouchableOpacity
                  style={[styles.timeBtn, outTime && styles.timeBtnActive]}
                  onPress={() => setShowOutTimePicker(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="logout" size={18} color={outTime ? "#2563EB" : "#64748B"} />
                    <Text style={styles.timeBtnLabel}>OUT TIME</Text>
                  </View>
                  <Text style={[styles.timeValueText, outTime && styles.timeValueTextActive]}>
                    {formatTimeDisplay(outTime)}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Shift Presets Bar */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetsRow}>
                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyShiftPreset(9, 0, 18, 0, 'PRESENT')}
                >
                  <Text style={styles.presetChipText}>9 AM - 6 PM (9h)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyShiftPreset(8, 0, 16, 0, 'PRESENT')}
                >
                  <Text style={styles.presetChipText}>8 AM - 4 PM (8h)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.presetChip}
                  onPress={() => applyShiftPreset(9, 0, 13, 0, 'HALF_DAY')}
                >
                  <Text style={styles.presetChipText}>9 AM - 1 PM (4h)</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.presetChip, { borderColor: '#8B5CF6' }]}
                  onPress={() => applyShiftPreset(20, 0, 4, 0, 'PRESENT')}
                >
                  <Text style={[styles.presetChipText, { color: '#7C3AED' }]}>🌙 Night 8 PM - 4 AM (8h)</Text>
                </TouchableOpacity>
              </ScrollView>

              {showInTimePicker && (
                <DateTimePicker
                  value={inTime || new Date()}
                  mode="time"
                  is24Hour={false}
                  display="default"
                  onChange={handleInTimeChange}
                />
              )}

              {showOutTimePicker && (
                <DateTimePicker
                  value={outTime || new Date()}
                  mode="time"
                  is24Hour={false}
                  display="default"
                  onChange={handleOutTimeChange}
                />
              )}
            </View>

            {/* 4. Total Hours Worked (Directly Editable) */}
            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.fieldLabel}>TOTAL WORKING HOURS (EDITABLE)</Text>
                {isOvertime && (
                  <View style={styles.overtimeBadge}>
                    <Text style={styles.overtimeBadgeText}>
                      +{((parsedHoursVal - 8)).toFixed(1)}h Overtime
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.hoursInputRow}>
                <View style={[styles.inputWrapper, { flex: 1 }]}>
                  <MaterialCommunityIcons name="clock-edit-outline" size={20} color="#2563EB" />
                  <TextInput
                    style={styles.textInput}
                    placeholder="8.0"
                    placeholderTextColor="#94A3B8"
                    keyboardType="numeric"
                    value={hoursWorked}
                    onChangeText={(val) => {
                      setHoursWorked(val);
                      const num = parseFloat(val);
                      if (!isNaN(num)) {
                        if (num >= 6) setStatus('PRESENT');
                        else if (num > 0 && num < 6) setStatus('HALF_DAY');
                        else if (num === 0) setStatus('ABSENT');
                      }
                    }}
                  />
                  <Text style={styles.inputUnit}>Hours</Text>
                </View>

                {/* Quick adjustments (+0.5h, +1h, 8h, 10h) */}
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={styles.quickAdjBtn}
                    onPress={() => setHoursWorked(String(Math.max(0, Math.round((parsedHoursVal - 0.5) * 10) / 10)))}
                  >
                    <Text style={styles.quickAdjText}>-0.5h</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.quickAdjBtn}
                    onPress={() => setHoursWorked(String(Math.round((parsedHoursVal + 0.5) * 10) / 10))}
                  >
                    <Text style={styles.quickAdjText}>+0.5h</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.quickAdjBtn, parsedHoursVal === 8 && styles.quickAdjBtnActive]}
                    onPress={() => setHoursWorked('8.0')}
                  >
                    <Text style={[styles.quickAdjText, parsedHoursVal === 8 && styles.quickAdjTextActive]}>8.0h</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 5. Attendance Status (Radio Cards) */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ATTENDANCE STATUS CATEGORY</Text>
            <View style={styles.statusGrid}>
              <TouchableOpacity
                style={[
                  styles.statusCard,
                  status === 'PRESENT' && styles.statusCardPresentActive
                ]}
                onPress={() => handleStatusPreset('PRESENT')}
              >
                <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                <Text style={[styles.statusCardTitle, status === 'PRESENT' && { color: '#065F46', fontWeight: '800' }]}>
                  Full Day
                </Text>
                <Text style={styles.statusCardSub}>Standard / Custom</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusCard,
                  status === 'HALF_DAY' && styles.statusCardHalfActive
                ]}
                onPress={() => handleStatusPreset('HALF_DAY')}
              >
                <View style={[styles.statusDot, { backgroundColor: '#F59E0B' }]} />
                <Text style={[styles.statusCardTitle, status === 'HALF_DAY' && { color: '#92400E', fontWeight: '800' }]}>
                  Half Day
                </Text>
                <Text style={styles.statusCardSub}>Partial Shift</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusCard,
                  status === 'ABSENT' && styles.statusCardAbsentActive
                ]}
                onPress={() => handleStatusPreset('ABSENT')}
              >
                <View style={[styles.statusDot, { backgroundColor: '#EF4444' }]} />
                <Text style={[styles.statusCardTitle, status === 'ABSENT' && { color: '#991B1B', fontWeight: '800' }]}>
                  Absent
                </Text>
                <Text style={styles.statusCardSub}>0h Unpaid</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.statusCard,
                  status === 'ON_LEAVE' && styles.statusCardLeaveActive
                ]}
                onPress={() => handleStatusPreset('ON_LEAVE')}
              >
                <View style={[styles.statusDot, { backgroundColor: '#8B5CF6' }]} />
                <Text style={[styles.statusCardTitle, status === 'ON_LEAVE' && { color: '#5B21B6', fontWeight: '800' }]}>
                  On Leave
                </Text>
                <Text style={styles.statusCardSub}>Approved Leave</Text>
              </TouchableOpacity>
            </View>

            {/* 6. Assigned Site */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>ASSIGNED SITE</Text>
            <TouchableOpacity
              style={styles.sitePickerBtn}
              onPress={() => setIsSitePickerOpen(!isSitePickerOpen)}
            >
              <MaterialCommunityIcons name="domain" size={18} color="#2563EB" />
              <Text style={styles.sitePickerText} numberOfLines={1}>
                {selectedSiteObj ? selectedSiteObj.name : 'Select Site'}
              </Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color="#64748B" />
            </TouchableOpacity>

            {/* Site Picker Dropdown */}
            {isSitePickerOpen && (
              <View style={[styles.dropdownBox, { marginTop: 6 }]}>
                <ScrollView style={{ maxHeight: 140 }} nestedScrollEnabled>
                  {sites.map(s => (
                    <TouchableOpacity
                      key={s.id}
                      style={[
                        styles.siteOptionRow,
                        String(selectedSiteId) === String(s.id) && styles.siteOptionRowActive
                      ]}
                      onPress={() => {
                        setSelectedSiteId(String(s.id));
                        setIsSitePickerOpen(false);
                      }}
                    >
                      <Text style={[
                        styles.siteOptionText,
                        String(selectedSiteId) === String(s.id) && { color: '#2563EB', fontWeight: '800' }
                      ]}>
                        {s.name}
                      </Text>
                      {String(selectedSiteId) === String(s.id) && (
                        <MaterialCommunityIcons name="check" size={16} color="#2563EB" />
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* 7. Remarks / Notes */}
            <Text style={[styles.fieldLabel, { marginTop: 16 }]}>REMARKS / NOTES</Text>
            <View style={styles.notesWrapper}>
              <TextInput
                style={styles.notesInput}
                placeholder="e.g. Completed 10.5 hrs concrete work on site..."
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={2}
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            {initialRecord && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={handleDelete}
                disabled={isDeleting || isLoading}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#EF4444" />
                ) : (
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#EF4444" />
                )}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.saveBtn, isLoading && { opacity: 0.7 }]}
              onPress={handleSave}
              disabled={isLoading || isDeleting}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check-bold" size={18} color="#FFFFFF" />
                  <Text style={styles.saveBtnText}>
                    {initialRecord ? 'Update Record' : 'Save Attendance'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(9, 20, 38, 0.65)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  headerIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F8FAFC',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  selectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  staffAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffNameText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  staffRoleText: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  dropdownBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    marginTop: 6,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 8,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 36,
    marginBottom: 8,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#0F172A',
    paddingVertical: 0,
  },
  staffOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 10,
  },
  staffOptionRowActive: {
    backgroundColor: '#EFF6FF',
  },
  staffOptionAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
  },
  staffOptionPlaceholder: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffOptionName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  staffOptionSub: {
    fontSize: 11,
    color: '#64748B',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 44,
  },
  dateText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
    marginLeft: 10,
  },
  timePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  timeBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
  },
  timeBtnLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  timeValueText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#94A3B8',
    marginTop: 4,
  },
  timeValueTextActive: {
    color: '#1E293B',
  },
  presetsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingVertical: 2,
  },
  presetChip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  presetChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  hoursInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overtimeBadge: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  overtimeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1D4ED8',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  inputUnit: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  quickAdjBtn: {
    height: 44,
    paddingHorizontal: 10,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickAdjBtnActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  quickAdjText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#475569',
  },
  quickAdjTextActive: {
    color: '#FFFFFF',
  },
  statusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  statusCard: {
    width: '48.5%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  statusCardPresentActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#10B981',
  },
  statusCardHalfActive: {
    backgroundColor: '#FFFBEB',
    borderColor: '#F59E0B',
  },
  statusCardAbsentActive: {
    backgroundColor: '#FEF2F2',
    borderColor: '#EF4444',
  },
  statusCardLeaveActive: {
    backgroundColor: '#F5F3FF',
    borderColor: '#8B5CF6',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  statusCardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusCardSub: {
    fontSize: 10,
    color: '#64748B',
    marginTop: 2,
  },
  sitePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 6,
  },
  sitePickerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  siteOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  siteOptionRowActive: {
    backgroundColor: '#EFF6FF',
  },
  siteOptionText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
  },
  notesWrapper: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },
  notesInput: {
    fontSize: 13,
    color: '#0F172A',
    minHeight: 48,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  deleteBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  saveBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2563EB',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
});
