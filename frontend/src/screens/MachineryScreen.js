import React, { useState, useEffect, useContext } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  TextInput, ScrollView, ActivityIndicator, Image, Modal, StatusBar, Platform, RefreshControl
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_BASE_URL } from '../config';
import { formatLocalDate, formatDisplayDate } from '../utils/dateUtils';

export default function MachineryScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { selectedSite } = useSite();

  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicle, setSelectedVehicle] = useState('ALL');
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState({
    total_trips: 0,
    total_km: 0,
    total_diesel_liters: 0,
    total_diesel_cost: 0,
    avg_mileage_km_per_liter: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Date filters
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [activeDatePicker, setActiveDatePicker] = useState(null); // 'start', 'end'

  // Image Viewer Modal
  const [viewerUrl, setViewerUrl] = useState(null);

  useEffect(() => {
    fetchVehiclesList();
  }, [selectedSite?.id]);

  useEffect(() => {
    fetchAnalytics();
  }, [selectedVehicle, startDate, endDate, selectedSite?.id]);

  const fetchVehiclesList = async () => {
    try {
      const url = `${API_BASE_URL}/trips/vehicles${selectedSite?.id ? `?site_id=${selectedSite.id}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (res.ok) {
        const list = await res.json();
        setVehicles(list);
      }
    } catch (e) {
      console.log('Error fetching vehicle list:', e);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      if (selectedSite?.id) params.append('site_id', selectedSite.id);
      if (selectedVehicle !== 'ALL') params.append('vehicle_number', selectedVehicle);
      if (startDate) params.append('start_date', formatLocalDate(startDate));
      if (endDate) params.append('end_date', formatLocalDate(endDate));

      const res = await fetch(`${API_BASE_URL}/trips/machinery-analytics?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });

      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary || {});
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.log('Error fetching machinery analytics:', e);
      Alert.alert('Error', 'Failed to load machinery data');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  // Filter logs by search query (e.g. material or driver or vehicle)
  const filteredLogs = logs.filter(log => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (log.vehicle_number || '').toLowerCase().includes(q) ||
      (log.material_type || '').toLowerCase().includes(q) ||
      (log.origin || '').toLowerCase().includes(q) ||
      (log.destination || '').toLowerCase().includes(q)
    );
  });

  const insets = useSafeAreaInsets();
  const topPadding = Math.max(insets.top, Platform.OS === 'android' ? 36 : 20);

  return (
    <View style={[styles.safe, { paddingTop: topPadding }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerSubtitle}>TAB B: MACHINERY & FLEET</Text>
          <Text style={styles.headerTitle}>Machinery & Fuel Logs</Text>
        </View>
        <TouchableOpacity 
          style={styles.refreshBtn} 
          onPress={() => { setIsRefreshing(true); fetchAnalytics(); }}
          activeOpacity={0.8}
        >
          <MaterialCommunityIcons name="refresh" size={20} color="#2563EB" />
        </TouchableOpacity>
      </View>

      {/* Vehicle Filter Selector (Horizontal Chips) */}
      <View style={styles.vehicleChipContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vehicleScroll}>
          <TouchableOpacity
            style={[styles.vehicleChip, selectedVehicle === 'ALL' && styles.vehicleChipActive]}
            onPress={() => setSelectedVehicle('ALL')}
            activeOpacity={0.8}
          >
            <Text style={[styles.vehicleChipText, selectedVehicle === 'ALL' && styles.vehicleChipTextActive]}>
              🚜 All Machinery ({vehicles.length})
            </Text>
          </TouchableOpacity>
          {vehicles.map(v => (
            <TouchableOpacity
              key={v}
              style={[styles.vehicleChip, selectedVehicle === v && styles.vehicleChipActive]}
              onPress={() => setSelectedVehicle(v)}
              activeOpacity={0.8}
            >
              <Text style={[styles.vehicleChipText, selectedVehicle === v && styles.vehicleChipTextActive]}>
                🚛 {v}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Metrics Row: Equipment Hours/KM + Diesel Consumption */}
      <View style={styles.metricsContainer}>
        <View style={[styles.metricCard, { borderLeftColor: '#F59E0B' }]}>
          <View style={styles.metricHeaderRow}>
            <Text style={styles.metricLabel}>USAGE (KM / HOURS)</Text>
            <MaterialCommunityIcons name="counter" size={16} color="#F59E0B" />
          </View>
          <Text style={styles.metricValue}>{summary.total_km?.toLocaleString()} KM</Text>
          <Text style={styles.metricSub}>{summary.total_trips} trips logged</Text>
        </View>

        <View style={[styles.metricCard, { borderLeftColor: '#EF4444' }]}>
          <View style={styles.metricHeaderRow}>
            <Text style={styles.metricLabel}>DIESEL CONSUMED</Text>
            <MaterialCommunityIcons name="gas-station" size={16} color="#EF4444" />
          </View>
          <Text style={styles.metricValue}>{summary.total_diesel_liters?.toLocaleString()} L</Text>
          <Text style={[styles.metricSub, { color: '#DC2626', fontWeight: '700' }]}>
            Cost: ₹{summary.total_diesel_cost?.toLocaleString()}
          </Text>
        </View>

        <View style={[styles.metricCard, { borderLeftColor: '#10B981' }]}>
          <View style={styles.metricHeaderRow}>
            <Text style={styles.metricLabel}>AVG MILEAGE</Text>
            <MaterialCommunityIcons name="speedometer" size={16} color="#10B981" />
          </View>
          <Text style={styles.metricValue}>{summary.avg_mileage_km_per_liter} KM/L</Text>
          <Text style={styles.metricSub}>Efficiency index</Text>
        </View>
      </View>

      {/* Date & Search Filters */}
      <View style={styles.filterBar}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={18} color="#64748B" style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search material, location, vehicle..."
            placeholderTextColor="#94A3B8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.dateRow}>
          <TouchableOpacity 
            style={[styles.datePill, startDate && styles.datePillActive]} 
            onPress={() => setActiveDatePicker('start')}
          >
            <MaterialCommunityIcons name="calendar-start" size={14} color={startDate ? "#2563EB" : "#64748B"} />
            <Text style={[styles.datePillText, startDate && styles.datePillTextActive]}>
              {startDate ? formatDisplayDate(startDate) : 'From Date'}
            </Text>
            {startDate && (
              <TouchableOpacity onPress={() => setStartDate(null)}>
                <MaterialCommunityIcons name="close" size={14} color="#2563EB" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.datePill, endDate && styles.datePillActive]} 
            onPress={() => setActiveDatePicker('end')}
          >
            <MaterialCommunityIcons name="calendar-end" size={14} color={endDate ? "#2563EB" : "#64748B"} />
            <Text style={[styles.datePillText, endDate && styles.datePillTextActive]}>
              {endDate ? formatDisplayDate(endDate) : 'To Date'}
            </Text>
            {endDate && (
              <TouchableOpacity onPress={() => setEndDate(null)}>
                <MaterialCommunityIcons name="close" size={14} color="#2563EB" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Logs List */}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => { setIsRefreshing(true); fetchAnalytics(); }}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Calculating machinery & fuel logs...</Text>
          </View>
        ) : filteredLogs.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="excavator" size={60} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Operational Logs</Text>
            <Text style={styles.emptySubtitle}>No machinery trip logs found for the selected filters.</Text>
          </View>
        ) : (
          filteredLogs.map(log => {
            const hasDiesel = (log.diesel_liters || 0) > 0;
            const tripEfficiency = hasDiesel && log.total_km ? (log.total_km / log.diesel_liters).toFixed(1) : null;

            return (
              <View key={log.id} style={styles.logCard}>
                {/* Log Header */}
                <View style={styles.logCardHeader}>
                  <View style={styles.vehicleBadge}>
                    <MaterialCommunityIcons name="truck-outline" size={20} color="#0F172A" />
                    <View style={{ marginLeft: 8 }}>
                      <Text style={styles.vehicleTitle}>{log.vehicle_number}</Text>
                      <Text style={styles.materialSub}>{log.material_type || 'General Cargo'} • {log.weight_tons ? `${log.weight_tons} Tons` : 'N/A'}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: log.status === 'APPROVED' ? '#ECFDF5' : '#FEF3C7' }]}>
                    <Text style={[styles.statusText, { color: log.status === 'APPROVED' ? '#059669' : '#D97706' }]}>
                      {log.status}
                    </Text>
                  </View>
                </View>

                {/* Meter Readings (Automatic Hours/KM Calculation) */}
                <View style={styles.meterBox}>
                  <View style={styles.meterItem}>
                    <Text style={styles.meterLabel}>START METER</Text>
                    <Text style={styles.meterVal}>{log.start_meter_reading || 0}</Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-right-thin" size={24} color="#94A3B8" />
                  <View style={styles.meterItem}>
                    <Text style={styles.meterLabel}>END METER</Text>
                    <Text style={styles.meterVal}>{log.end_meter_reading || 0}</Text>
                  </View>
                  <View style={styles.meterDivider} />
                  <View style={[styles.meterItem, { flex: 1.2 }]}>
                    <Text style={styles.meterLabel}>TOTAL RUN / WORK</Text>
                    <Text style={[styles.meterVal, { color: '#2563EB', fontWeight: '900' }]}>
                      {log.total_km || 0} KM
                    </Text>
                  </View>
                </View>

                {/* Fuel Accounting Box */}
                <View style={styles.fuelBox}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                    <MaterialCommunityIcons name="gas-station-outline" size={16} color="#DC2626" style={{ marginRight: 4 }} />
                    <Text style={styles.fuelTitle}>FUEL ACCOUNTING</Text>
                  </View>
                  <View style={styles.fuelRow}>
                    <View>
                      <Text style={styles.fuelLabel}>Diesel Consumed</Text>
                      <Text style={styles.fuelVal}>{log.diesel_liters || 0} Liters</Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text style={styles.fuelLabel}>Fuel Expense</Text>
                      <Text style={[styles.fuelVal, { color: '#DC2626' }]}>₹{(log.diesel_cost || 0).toLocaleString()}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.fuelLabel}>Mileage</Text>
                      <Text style={styles.fuelVal}>{tripEfficiency ? `${tripEfficiency} KM/L` : 'N/A'}</Text>
                    </View>
                  </View>
                </View>

                {/* Visual Verification Images: Odometer + Diesel Receipt */}
                {(log.odometer_photo_url || log.receipt_photo_url || log.loading_photo_url || log.unloading_photo_url) && (
                  <View style={styles.auditPhotosSection}>
                    <Text style={styles.auditHeading}>AUDIT RECEIPTS & METER PHOTOS</Text>
                    <View style={styles.photosRow}>
                      {log.odometer_photo_url && (
                        <TouchableOpacity style={styles.thumbWrapper} onPress={() => setViewerUrl(log.odometer_photo_url)}>
                          <Image source={{ uri: log.odometer_photo_url }} style={styles.thumbImg} />
                          <Text style={styles.thumbCaption}>Meter Photo</Text>
                        </TouchableOpacity>
                      )}
                      {log.receipt_photo_url && (
                        <TouchableOpacity style={styles.thumbWrapper} onPress={() => setViewerUrl(log.receipt_photo_url)}>
                          <Image source={{ uri: log.receipt_photo_url }} style={styles.thumbImg} />
                          <Text style={styles.thumbCaption}>Diesel Receipt</Text>
                        </TouchableOpacity>
                      )}
                      {log.loading_photo_url && (
                        <TouchableOpacity style={styles.thumbWrapper} onPress={() => setViewerUrl(log.loading_photo_url)}>
                          <Image source={{ uri: log.loading_photo_url }} style={styles.thumbImg} />
                          <Text style={styles.thumbCaption}>Loading</Text>
                        </TouchableOpacity>
                      )}
                      {log.unloading_photo_url && (
                        <TouchableOpacity style={styles.thumbWrapper} onPress={() => setViewerUrl(log.unloading_photo_url)}>
                          <Image source={{ uri: log.unloading_photo_url }} style={styles.thumbImg} />
                          <Text style={styles.thumbCaption}>Unloading</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}

                {/* Footer with Date & Bhada */}
                <View style={styles.cardFooter}>
                  <Text style={styles.footerDate}>
                    Logged: {log.created_at ? new Date(log.created_at).toLocaleDateString() : 'N/A'}
                  </Text>
                  {log.bhada > 0 && (
                    <Text style={styles.footerBhada}>Bhada / Revenue: ₹{log.bhada.toLocaleString()}</Text>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Date Pickers */}
      {activeDatePicker && (
        <DateTimePicker
          value={activeDatePicker === 'start' ? (startDate || new Date()) : (endDate || new Date())}
          mode="date"
          display="default"
          onChange={(event, selected) => {
            const picker = activeDatePicker;
            setActiveDatePicker(null);
            if (selected) {
              if (picker === 'start') setStartDate(selected);
              if (picker === 'end') setEndDate(selected);
            }
          }}
        />
      )}

      {/* Image Full-screen Viewer */}
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
  refreshBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF'
  },
  vehicleChipContainer: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC'
  },
  vehicleScroll: { paddingHorizontal: 16, gap: 8 },
  vehicleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  vehicleChipActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB'
  },
  vehicleChipText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  vehicleChipTextActive: { color: '#FFFFFF' },
  metricsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 10,
    backgroundColor: '#FFFFFF'
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0'
  },
  metricHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metricLabel: { fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  metricValue: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginTop: 4 },
  metricSub: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  filterBar: { paddingHorizontal: 16, paddingBottom: 10 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 38,
    marginBottom: 8
  },
  searchInput: { flex: 1, fontSize: 12, color: '#0F172A' },
  dateRow: { flexDirection: 'row', gap: 8 },
  datePill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 6,
    borderRadius: 6,
    gap: 6
  },
  datePillActive: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  datePillText: { fontSize: 11, fontWeight: '600', color: '#64748B' },
  datePillTextActive: { color: '#2563EB', fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  loadingBox: { alignItems: 'center', marginTop: 40 },
  loadingText: { marginTop: 10, color: '#64748B', fontSize: 13 },
  emptyBox: { alignItems: 'center', marginTop: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#475569', marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 4, paddingHorizontal: 30 },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 16,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  logCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  vehicleBadge: { flexDirection: 'row', alignItems: 'center' },
  vehicleTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  materialSub: { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 2 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 11, fontWeight: '800' },
  meterBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12
  },
  meterItem: { flex: 1, alignItems: 'center' },
  meterLabel: { fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  meterVal: { fontSize: 14, fontWeight: '800', color: '#1E293B', marginTop: 2 },
  meterDivider: { width: 1, height: 24, backgroundColor: '#CBD5E1', marginHorizontal: 6 },
  fuelBox: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FECACA',
    marginBottom: 12
  },
  fuelTitle: { fontSize: 10, fontWeight: '800', color: '#991B1B', letterSpacing: 0.5 },
  fuelRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  fuelLabel: { fontSize: 10, color: '#7F1D1D', fontWeight: '600' },
  fuelVal: { fontSize: 13, fontWeight: '800', color: '#1E293B', marginTop: 2 },
  auditPhotosSection: {
    marginBottom: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  auditHeading: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, marginBottom: 8 },
  photosRow: { flexDirection: 'row', gap: 10 },
  thumbWrapper: { alignItems: 'center' },
  thumbImg: { width: 56, height: 56, borderRadius: 8, borderWidth: 1, borderColor: '#CBD5E1' },
  thumbCaption: { fontSize: 10, color: '#475569', fontWeight: '700', marginTop: 4 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9'
  },
  footerDate: { fontSize: 11, color: '#94A3B8' },
  footerBhada: { fontSize: 12, fontWeight: '800', color: '#059669' },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center'
  },
  fullImage: { width: '92%', height: '80%' },
  viewerCloseText: { color: 'white', marginTop: 14, fontSize: 13, fontWeight: '600' }
});
