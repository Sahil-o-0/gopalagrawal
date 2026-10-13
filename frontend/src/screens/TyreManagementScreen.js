import React, { useState, useEffect, useContext, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
  StatusBar,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { API_BASE_URL } from '../config';

const TYRE_POSITIONS = [
  'Front Left',
  'Front Right',
  'Axle 1 Left Outer',
  'Axle 1 Left Inner',
  'Axle 1 Right Inner',
  'Axle 1 Right Outer',
  'Axle 2 Left Outer',
  'Axle 2 Left Inner',
  'Axle 2 Right Inner',
  'Axle 2 Right Outer',
  'Axle 3 Left Outer',
  'Axle 3 Left Inner',
  'Axle 3 Right Inner',
  'Axle 3 Right Outer',
  'Spare 1',
  'Spare 2',
  'Other / Custom',
];

const POPULAR_BRANDS = ['MRF', 'Apollo', 'JK Tyre', 'CEAT', 'Bridgestone', 'BKT', 'Michelin', 'Goodyear'];

export default function TyreManagementScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { selectedSite } = useSite();
  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20);

  const [tyres, setTyres] = useState([]);
  const [vehiclesList, setVehiclesList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedVehicleFilter, setSelectedVehicleFilter] = useState('ALL');

  // Add/Batch Modal
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [batchPurchaseDate, setBatchPurchaseDate] = useState(new Date());
  const [showBatchDatePicker, setShowBatchDatePicker] = useState(false);
  const [activeDatePickerIndex, setActiveDatePickerIndex] = useState(null); // for per-row date pickers

  // Dynamic Tyre Rows in Modal (supports multiple tyres for heavy vehicles)
  const [tyreRows, setTyreRows] = useState([
    {
      id: 1,
      serial_number: '',
      tyre_position: 'Front Left',
      brand_model: 'MRF',
      purchase_cost: '',
      purchase_date: new Date(),
      odometer_at_fitting: '',
      notes: '',
    },
  ]);

  // Edit Modal
  const [editingTyre, setEditingTyre] = useState(null);
  const [editVehicleNumber, setEditVehicleNumber] = useState('');
  const [editSerialNumber, setEditSerialNumber] = useState('');
  const [editPurchaseDate, setEditPurchaseDate] = useState(new Date());
  const [showEditDatePicker, setShowEditDatePicker] = useState(false);
  const [editPosition, setEditPosition] = useState('Front Left');
  const [editBrand, setEditBrand] = useState('MRF');
  const [editCost, setEditCost] = useState('');
  const [editOdometer, setEditOdometer] = useState('');
  const [editStatus, setEditStatus] = useState('FITTED');
  const [editNotes, setEditNotes] = useState('');
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const siteQuery = selectedSite?.id ? `?site_id=${selectedSite.id}` : '';

      // 1. Fetch compliance vehicles list
      const emiRes = await fetch(`${API_BASE_URL}/workforce/emi${siteQuery}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (emiRes.ok) {
        const emiData = await emiRes.json();
        setVehiclesList(emiData);
        if (emiData.length > 0 && !selectedVehicle) {
          setSelectedVehicle(emiData[0].vehicle_number);
        }
      }

      // 2. Fetch tyres list
      const tyresRes = await fetch(`${API_BASE_URL}/workforce/tyres${siteQuery}`, {
        headers: { Authorization: `Bearer ${userToken}` },
      });
      if (tyresRes.ok) {
        const tyresData = await tyresRes.json();
        setTyres(tyresData);
      }
    } catch (err) {
      console.error('Error fetching tyre data:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [selectedSite?.id, userToken]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper date formatter
  const formatDisplayDate = (d) => {
    if (!d) return 'Select Date';
    if (typeof d === 'string') return d;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Add another tyre row to batch form
  const addTyreRow = () => {
    const nextId = tyreRows.length > 0 ? Math.max(...tyreRows.map((r) => r.id)) + 1 : 1;
    // Guess next position
    const nextPosIndex = Math.min(tyreRows.length, TYRE_POSITIONS.length - 1);
    const nextPos = TYRE_POSITIONS[nextPosIndex] || 'Other / Custom';

    setTyreRows([
      ...tyreRows,
      {
        id: nextId,
        serial_number: '',
        tyre_position: nextPos,
        brand_model: tyreRows[tyreRows.length - 1]?.brand_model || 'MRF',
        purchase_cost: tyreRows[tyreRows.length - 1]?.purchase_cost || '',
        purchase_date: batchPurchaseDate,
        odometer_at_fitting: '',
        notes: '',
      },
    ]);
  };

  const removeTyreRow = (rowId) => {
    if (tyreRows.length <= 1) {
      Alert.alert('Cannot Remove', 'At least one tyre entry is required.');
      return;
    }
    setTyreRows(tyreRows.filter((r) => r.id !== rowId));
  };

  const updateTyreRow = (rowId, key, value) => {
    setTyreRows(
      tyreRows.map((r) => (r.id === rowId ? { ...r, [key]: value } : r))
    );
  };

  const openAddModal = () => {
    if (vehiclesList.length > 0) {
      setSelectedVehicle(vehiclesList[0].vehicle_number);
    }
    setBatchPurchaseDate(new Date());
    setTyreRows([
      {
        id: 1,
        serial_number: '',
        tyre_position: 'Front Left',
        brand_model: 'MRF',
        purchase_cost: '',
        purchase_date: new Date(),
        odometer_at_fitting: '',
        notes: '',
      },
    ]);
    setIsAddModalVisible(true);
  };

  const handleSaveBatch = async () => {
    if (!selectedVehicle.trim()) {
      Alert.alert('Vehicle Required', 'Please select or enter a vehicle number.');
      return;
    }

    // Validate that all rows have serial numbers
    const emptySerialIndex = tyreRows.findIndex((r) => !r.serial_number.trim());
    if (emptySerialIndex !== -1) {
      Alert.alert('Serial Number Missing', `Please enter a serial number for Tyre #${emptySerialIndex + 1}.`);
      return;
    }

    try {
      const payload = {
        vehicle_number: selectedVehicle.trim().toUpperCase(),
        site_id: selectedSite?.id || 1,
        purchase_date: formatDisplayDate(batchPurchaseDate),
        tyres: tyreRows.map((r) => ({
          serial_number: r.serial_number.trim(),
          purchase_date: formatDisplayDate(r.purchase_date || batchPurchaseDate),
          tyre_position: r.tyre_position,
          brand_model: r.brand_model,
          purchase_cost: parseFloat(r.purchase_cost) || 0.0,
          odometer_at_fitting: parseFloat(r.odometer_at_fitting) || 0.0,
          status: 'FITTED',
          notes: r.notes || null,
        })),
      };

      const res = await fetch(`${API_BASE_URL}/workforce/tyres/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        Alert.alert('Success', `Successfully logged ${tyreRows.length} tyre(s) for vehicle ${selectedVehicle}.`);
        setIsAddModalVisible(false);
        fetchData();
      } else {
        const err = await res.json();
        Alert.alert('Failed to Save', err.detail || 'Could not save tyre records.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error while saving tyre records.');
    }
  };

  const openEditModal = (tyre) => {
    setEditingTyre(tyre);
    setEditVehicleNumber(tyre.vehicle_number);
    setEditSerialNumber(tyre.serial_number);
    setEditPurchaseDate(tyre.purchase_date ? new Date(tyre.purchase_date) : new Date());
    setEditPosition(tyre.tyre_position || 'Front Left');
    setEditBrand(tyre.brand_model || 'MRF');
    setEditCost(tyre.purchase_cost ? String(tyre.purchase_cost) : '');
    setEditOdometer(tyre.odometer_at_fitting ? String(tyre.odometer_at_fitting) : '');
    setEditStatus(tyre.status || 'FITTED');
    setEditNotes(tyre.notes || '');
    setIsEditModalVisible(true);
  };

  const handleUpdateTyre = async () => {
    if (!editSerialNumber.trim()) {
      Alert.alert('Serial Number Required', 'Please enter a tyre serial number.');
      return;
    }

    try {
      const payload = {
        vehicle_number: editVehicleNumber.trim().toUpperCase(),
        serial_number: editSerialNumber.trim(),
        purchase_date: formatDisplayDate(editPurchaseDate),
        tyre_position: editPosition,
        brand_model: editBrand,
        purchase_cost: parseFloat(editCost) || 0.0,
        odometer_at_fitting: parseFloat(editOdometer) || 0.0,
        status: editStatus,
        notes: editNotes || null,
      };

      const res = await fetch(`${API_BASE_URL}/workforce/tyres/${editingTyre.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        Alert.alert('Success', 'Tyre record updated successfully.');
        setIsEditModalVisible(false);
        fetchData();
      } else {
        const err = await res.json();
        Alert.alert('Update Failed', err.detail || 'Could not update tyre record.');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error while updating tyre record.');
    }
  };

  const handleDeleteTyre = (tyreId, serialNo) => {
    Alert.alert(
      'Delete Tyre Record',
      `Are you sure you want to delete tyre record (S/N: ${serialNo})?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/workforce/tyres/${tyreId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${userToken}` },
              });
              if (res.ok) {
                fetchData();
              } else {
                Alert.alert('Error', 'Failed to delete tyre record.');
              }
            } catch (e) {
              Alert.alert('Error', 'Network error.');
            }
          },
        },
      ]
    );
  };

  // Filtered Tyres
  const filteredTyres = tyres.filter((t) => {
    const matchesVehicle =
      selectedVehicleFilter === 'ALL' ||
      t.vehicle_number.toUpperCase() === selectedVehicleFilter.toUpperCase();

    const matchesSearch =
      !searchQuery.trim() ||
      t.serial_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.vehicle_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.brand_model?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tyre_position?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesVehicle && matchesSearch;
  });

  // Calculate Metrics
  const totalTyresCount = filteredTyres.length;
  const fittedCount = filteredTyres.filter((t) => t.status === 'FITTED').length;
  const totalInvestment = filteredTyres.reduce((acc, t) => acc + (parseFloat(t.purchase_cost) || 0), 0);

  // Distinct vehicles in filter chips
  const vehicleFilterOptions = [
    'ALL',
    ...Array.from(
      new Set([
        ...vehiclesList.map((v) => v.vehicle_number),
        ...tyres.map((t) => t.vehicle_number),
      ])
    ).filter(Boolean),
  ];

  return (
    <View style={[styles.safe, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSubtitle}>FLEET ASSET TRACKING</Text>
          <Text style={styles.headerTitle}>Tyre Management</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
          <Text style={styles.addBtnText}>+ Add Tyre(s)</Text>
        </TouchableOpacity>
      </View>

      {/* Metrics Bar */}
      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, { borderLeftColor: '#2563EB' }]}>
          <Text style={styles.metricLabel}>TOTAL TYRES</Text>
          <Text style={styles.metricValue}>{totalTyresCount}</Text>
          <Text style={styles.metricSub}>{fittedCount} Active on Wheels</Text>
        </View>
        <View style={[styles.metricCard, { borderLeftColor: '#059669' }]}>
          <Text style={styles.metricLabel}>TYRE INVESTMENT</Text>
          <Text style={[styles.metricValue, { color: '#059669' }]}>
            ₹{totalInvestment.toLocaleString()}
          </Text>
          <Text style={styles.metricSub}>Across filtered fleet</Text>
        </View>
      </View>

      {/* Search & Vehicle Filter Chips */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#94A3B8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search serial no, brand, vehicle, position..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
          {vehicleFilterOptions.map((vNum) => (
            <TouchableOpacity
              key={vNum}
              style={[
                styles.filterChip,
                selectedVehicleFilter === vNum && styles.filterChipActive,
              ]}
              onPress={() => setSelectedVehicleFilter(vNum)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedVehicleFilter === vNum && styles.filterChipTextActive,
                ]}
              >
                {vNum === 'ALL' ? '🚛 All Vehicles' : `🚛 ${vNum}`}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tyres List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              fetchData();
            }}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading tyre records...</Text>
          </View>
        ) : filteredTyres.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="tire" size={60} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Tyre Records Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery
                ? 'No tyres matched your search criteria.'
                : 'Tap "+ Add Tyre(s)" above to log your first tyre purchase and serial number.'}
            </Text>
          </View>
        ) : (
          filteredTyres.map((tyre) => (
            <View key={tyre.id} style={styles.tyreCard}>
              {/* Card Top: Vehicle & Actions */}
              <View style={styles.cardHeader}>
                <View style={styles.vehicleBadge}>
                  <MaterialCommunityIcons name="truck" size={18} color="#1E293B" />
                  <Text style={styles.vehicleText}>{tyre.vehicle_number}</Text>
                </View>

                <View style={styles.actionRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      {
                        backgroundColor:
                          tyre.status === 'FITTED'
                            ? '#ECFDF5'
                            : tyre.status === 'SPARE'
                            ? '#FEF3C7'
                            : '#FEE2E2',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusBadgeText,
                        {
                          color:
                            tyre.status === 'FITTED'
                              ? '#059669'
                              : tyre.status === 'SPARE'
                              ? '#D97706'
                              : '#DC2626',
                        },
                      ]}
                    >
                      {tyre.status || 'FITTED'}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => openEditModal(tyre)}
                  >
                    <MaterialCommunityIcons name="pencil-outline" size={18} color="#2563EB" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]}
                    onPress={() => handleDeleteTyre(tyre.id, tyre.serial_number)}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={18} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Serial Number & Brand Row */}
              <View style={styles.serialBox}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>TYRE SERIAL NUMBER</Text>
                  <Text style={styles.serialText}>{tyre.serial_number}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.label}>MAKE / BRAND</Text>
                  <Text style={styles.brandText}>{tyre.brand_model || 'Standard'}</Text>
                </View>
              </View>

              {/* Position & Cost Grid */}
              <View style={styles.detailGrid}>
                <View style={styles.detailItem}>
                  <Text style={styles.label}>WHEEL POSITION</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <MaterialCommunityIcons name="circle-slice-8" size={14} color="#2563EB" />
                    <Text style={styles.valText}>{tyre.tyre_position || 'Not Assigned'}</Text>
                  </View>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.label}>PURCHASE DATE</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 }}>
                    <MaterialCommunityIcons name="calendar-range" size={14} color="#059669" />
                    <Text style={styles.valText}>{tyre.purchase_date || 'N/A'}</Text>
                  </View>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.label}>PURCHASE COST</Text>
                  <Text style={styles.costText}>
                    ₹{(parseFloat(tyre.purchase_cost) || 0).toLocaleString()}
                  </Text>
                </View>
                {tyre.odometer_at_fitting ? (
                  <View style={styles.detailItem}>
                    <Text style={styles.label}>FITTING ODOMETER</Text>
                    <Text style={styles.valText}>{tyre.odometer_at_fitting} KM</Text>
                  </View>
                ) : null}
              </View>

              {/* Notes */}
              {tyre.notes ? (
                <View style={styles.notesBox}>
                  <Text style={styles.notesText}>💬 {tyre.notes}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>

      {/* ================= ADD / BATCH TYRES MODAL ================= */}
      <Modal visible={isAddModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Add Vehicle Tyre(s)</Text>
                <Text style={styles.modalSubtitle}>Support for heavy vehicles & multiple tyres</Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddModalVisible(false)} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 540 }}>
              {/* Select Vehicle from Compliance Vault */}
              <Text style={styles.inputLabel}>Select Vehicle * (From Compliance Vault)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {vehiclesList.map((veh) => (
                  <TouchableOpacity
                    key={veh.id}
                    style={[
                      styles.vehOptionChip,
                      selectedVehicle === veh.vehicle_number && styles.vehOptionChipActive,
                    ]}
                    onPress={() => setSelectedVehicle(veh.vehicle_number)}
                  >
                    <Text
                      style={[
                        styles.vehOptionChipText,
                        selectedVehicle === veh.vehicle_number && styles.vehOptionChipTextActive,
                      ]}
                    >
                      🚛 {veh.vehicle_number}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Manual Input if not in list */}
              <TextInput
                style={[styles.input, { marginBottom: 12 }]}
                placeholder="Or type custom vehicle number..."
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                value={selectedVehicle}
                onChangeText={setSelectedVehicle}
              />

              {/* Batch Purchase Date */}
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.inputLabel}>Default Purchase Date</Text>
                <TouchableOpacity
                  style={styles.datePickerBtn}
                  onPress={() => setShowBatchDatePicker(true)}
                >
                  <Text style={styles.datePickerBtnText}>
                    {formatDisplayDate(batchPurchaseDate)}
                  </Text>
                  <MaterialCommunityIcons name="calendar-check" size={18} color="#2563EB" />
                </TouchableOpacity>
              </View>

              {/* Tyre Entries List */}
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionHeading}>TYRE ENTRIES ({tyreRows.length})</Text>
                <TouchableOpacity style={styles.addRowBtn} onPress={addTyreRow}>
                  <MaterialCommunityIcons name="plus-circle" size={16} color="#2563EB" />
                  <Text style={styles.addRowBtnText}>+ Add Another Tyre</Text>
                </TouchableOpacity>
              </View>

              {tyreRows.map((row, index) => (
                <View key={row.id} style={styles.tyreRowBox}>
                  <View style={styles.rowTopBar}>
                    <View style={styles.rowNumberBadge}>
                      <Text style={styles.rowNumberText}>Tyre #{index + 1}</Text>
                    </View>
                    {tyreRows.length > 1 && (
                      <TouchableOpacity onPress={() => removeTyreRow(row.id)}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color="#DC2626" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Serial Number (Required) */}
                  <Text style={styles.inputLabel}>Serial Number *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. MRF-9823472918"
                    placeholderTextColor="#94A3B8"
                    value={row.serial_number}
                    onChangeText={(val) => updateTyreRow(row.id, 'serial_number', val)}
                  />

                  {/* Position & Brand */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.inputLabel}>Position</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Front Left"
                        placeholderTextColor="#94A3B8"
                        value={row.tyre_position}
                        onChangeText={(val) => updateTyreRow(row.id, 'tyre_position', val)}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.inputLabel}>Brand / Model</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. Apollo / MRF"
                        placeholderTextColor="#94A3B8"
                        value={row.brand_model}
                        onChangeText={(val) => updateTyreRow(row.id, 'brand_model', val)}
                      />
                    </View>
                  </View>

                  {/* Cost & Odometer */}
                  <View style={styles.formRow}>
                    <View style={{ flex: 1, marginRight: 6 }}>
                      <Text style={styles.inputLabel}>Cost (₹)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 18500"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={row.purchase_cost}
                        onChangeText={(val) => updateTyreRow(row.id, 'purchase_cost', val)}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 6 }}>
                      <Text style={styles.inputLabel}>Fitting Odometer (KM)</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="e.g. 45000"
                        placeholderTextColor="#94A3B8"
                        keyboardType="numeric"
                        value={row.odometer_at_fitting}
                        onChangeText={(val) => updateTyreRow(row.id, 'odometer_at_fitting', val)}
                      />
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.confirmSaveBtn} onPress={handleSaveBatch} activeOpacity={0.8}>
                <Text style={styles.confirmSaveBtnText}>Save {tyreRows.length} Tyre(s) Record</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= EDIT SINGLE TYRE MODAL ================= */}
      <Modal visible={isEditModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Tyre Record</Text>
              <TouchableOpacity onPress={() => setIsEditModalVisible(false)} style={{ padding: 4 }}>
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 520 }}>
              <Text style={styles.inputLabel}>Vehicle Number</Text>
              <TextInput
                style={styles.input}
                value={editVehicleNumber}
                onChangeText={setEditVehicleNumber}
                autoCapitalize="characters"
              />

              <Text style={styles.inputLabel}>Serial Number *</Text>
              <TextInput
                style={styles.input}
                value={editSerialNumber}
                onChangeText={setEditSerialNumber}
              />

              <Text style={styles.inputLabel}>Purchase Date</Text>
              <TouchableOpacity
                style={[styles.datePickerBtn, { marginBottom: 12 }]}
                onPress={() => setShowEditDatePicker(true)}
              >
                <Text style={styles.datePickerBtnText}>
                  {formatDisplayDate(editPurchaseDate)}
                </Text>
                <MaterialCommunityIcons name="calendar-check" size={18} color="#2563EB" />
              </TouchableOpacity>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Position</Text>
                  <TextInput
                    style={styles.input}
                    value={editPosition}
                    onChangeText={setEditPosition}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>Brand / Make</Text>
                  <TextInput
                    style={styles.input}
                    value={editBrand}
                    onChangeText={setEditBrand}
                  />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1, marginRight: 6 }}>
                  <Text style={styles.inputLabel}>Purchase Cost (₹)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editCost}
                    onChangeText={setEditCost}
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 6 }}>
                  <Text style={styles.inputLabel}>Odometer (KM)</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={editOdometer}
                    onChangeText={setEditOdometer}
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Status</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                {['FITTED', 'SPARE', 'REPLACED', 'SCRAPPED'].map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.statusChip,
                      editStatus === st && styles.statusChipActive,
                    ]}
                    onPress={() => setEditStatus(st)}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        editStatus === st && styles.statusChipTextActive,
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>Notes / Remarks</Text>
              <TextInput
                style={[styles.input, { height: 55 }]}
                placeholder="Optional fitting notes, puncture history, etc."
                placeholderTextColor="#94A3B8"
                multiline
                value={editNotes}
                onChangeText={setEditNotes}
              />

              <TouchableOpacity style={styles.confirmSaveBtn} onPress={handleUpdateTyre} activeOpacity={0.8}>
                <Text style={styles.confirmSaveBtnText}>Update Tyre Record</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {showBatchDatePicker && (
        <DateTimePicker
          value={batchPurchaseDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowBatchDatePicker(false);
            if (event?.type !== 'dismissed' && selectedDate) {
              setBatchPurchaseDate(selectedDate);
            }
          }}
        />
      )}

      {showEditDatePicker && (
        <DateTimePicker
          value={editPurchaseDate || new Date()}
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            setShowEditDatePicker(false);
            if (event?.type !== 'dismissed' && selectedDate) {
              setEditPurchaseDate(selectedDate);
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  headerSubtitle: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 14,
    paddingTop: 12,
    gap: 10,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderLeftWidth: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.4,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    marginTop: 3,
  },
  metricSub: {
    fontSize: 10.5,
    color: '#94A3B8',
    marginTop: 2,
  },
  filterSection: {
    backgroundColor: '#FFFFFF',
    marginTop: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    marginHorizontal: 14,
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: '#1E293B',
    marginLeft: 6,
  },
  filterScroll: {
    paddingHorizontal: 14,
    paddingTop: 8,
    gap: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
  },
  filterChipActive: {
    backgroundColor: '#2563EB',
  },
  filterChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 14,
    paddingBottom: 40,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 13,
  },
  emptyBox: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#334155',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  tyreCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  vehicleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 5,
  },
  vehicleText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#0F172A',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  actionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
  },
  serialBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 10,
    backgroundColor: '#F8FAFC',
    padding: 10,
    borderRadius: 10,
  },
  label: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  serialText: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  brandText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#2563EB',
    marginTop: 2,
  },
  detailGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  detailItem: {
    width: '47%',
  },
  valText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#334155',
  },
  costText: {
    fontSize: 13.5,
    fontWeight: '900',
    color: '#059669',
    marginTop: 2,
  },
  notesBox: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  notesText: {
    fontSize: 11.5,
    color: '#64748B',
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 10,
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  datePickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  datePickerBtnText: {
    fontSize: 13,
    color: '#0F172A',
    fontWeight: '600',
  },
  vehOptionChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 6,
  },
  vehOptionChipActive: {
    backgroundColor: '#2563EB',
  },
  vehOptionChipText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#64748B',
  },
  vehOptionChipTextActive: {
    color: '#FFFFFF',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
    letterSpacing: 0.5,
  },
  addRowBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addRowBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
  },
  tyreRowBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
  },
  rowTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowNumberBadge: {
    backgroundColor: '#E0E7FF',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  rowNumberText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#3730A3',
  },
  confirmSaveBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 10,
  },
  confirmSaveBtnText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
  },
  statusChipActive: {
    backgroundColor: '#059669',
  },
  statusChipText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748B',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
  },
});
