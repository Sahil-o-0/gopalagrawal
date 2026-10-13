import React, { useState, useEffect, useContext, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert,
  TextInput, ScrollView, ActivityIndicator, Image, Modal, StatusBar, Platform, RefreshControl,
  LayoutAnimation, UIManager
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthContext } from '../context/AuthContext';
import { useSite } from '../context/SiteContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import DraggableFormSections from '../components/DraggableFormSections';
import DraggableCardList from '../components/DraggableCardList';
import { API_BASE_URL } from '../config';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ComplianceVaultScreen({ navigation }) {
  const { userToken } = useContext(AuthContext);
  const { selectedSite } = useSite();

  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeFilter, setActiveFilter] = useState('ALL'); // ALL, EXPIRING_SOON, EXPIRED, EMI_DUE
  const [searchQuery, setSearchQuery] = useState('');

  // Accordion Fold / Unfold State (record id -> boolean)
  const [expandedCardIds, setExpandedCardIds] = useState({});

  // In-place Arrange Mode State & Scroll Refs
  const [isArrangeMode, setIsArrangeMode] = useState(false);
  const vaultScrollViewRef = useRef(null);
  const vaultScrollYRef = useRef(0);

  // Modal state for Add/Edit
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);

  // Form Fields
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [emiAmount, setEmiAmount] = useState('');
  const [emiDueDate, setEmiDueDate] = useState(null);
  const [insuranceExpiry, setInsuranceExpiry] = useState(null);
  const [insurancePremium, setInsurancePremium] = useState('');
  const [fitnessExpiry, setFitnessExpiry] = useState(null);
  const [fitnessFee, setFitnessFee] = useState('');
  const [roadTaxExpiry, setRoadTaxExpiry] = useState(null);
  const [roadTaxAmount, setRoadTaxAmount] = useState('');
  const [puccExpiry, setPuccExpiry] = useState(null);
  const [puccFee, setPuccFee] = useState('');
  const [registrationDate, setRegistrationDate] = useState(null);
  const [permitValidUpto, setPermitValidUpto] = useState(null);
  const [permitFee, setPermitFee] = useState('');
  const [financier, setFinancier] = useState('');
  const [notes, setNotes] = useState('');
  const [documentUrl, setDocumentUrl] = useState(null);

  // DatePicker state
  const [activeDatePicker, setActiveDatePicker] = useState(null); // 'emi', 'insurance', 'fitness', 'roadTax', 'pucc'

  // Image Viewer
  const [viewerUrl, setViewerUrl] = useState(null);

  const toggleCardFold = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCardIds(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const toggleAllCards = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const allExpanded = filteredRecords.length > 0 && filteredRecords.every(r => !!expandedCardIds[r.id]);
    if (allExpanded) {
      setExpandedCardIds({});
    } else {
      const newMap = {};
      filteredRecords.forEach(r => { newMap[r.id] = true; });
      setExpandedCardIds(newMap);
    }
  };

  const VEHICLES_ORDER_KEY = '@compliance_vehicle_order_v2';
  const [vehicleOrder, setVehicleOrder] = useState([]);

  useEffect(() => {
    loadVehicleOrder();
  }, []);

  const loadVehicleOrder = async () => {
    try {
      const saved = await AsyncStorage.getItem(VEHICLES_ORDER_KEY);
      if (saved) {
        setVehicleOrder(JSON.parse(saved));
      }
    } catch (e) {
      console.log('Error loading vehicle order:', e);
    }
  };

  const saveVehicleOrder = async (newOrder) => {
    setVehicleOrder(newOrder);
    try {
      await AsyncStorage.setItem(VEHICLES_ORDER_KEY, JSON.stringify(newOrder));
    } catch (e) {
      console.log('Error saving vehicle order:', e);
    }
  };

  const moveVehicleUp = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch(e){}
    setRecords(prev => {
      const index = prev.findIndex(r => r.id === id);
      if (index <= 0) return prev;
      const copy = [...prev];
      const temp = copy[index - 1];
      copy[index - 1] = copy[index];
      copy[index] = temp;
      saveVehicleOrder(copy.map(r => r.id));
      return copy;
    });
  };

  const moveVehicleDown = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch(e){}
    setRecords(prev => {
      const index = prev.findIndex(r => r.id === id);
      if (index === -1 || index >= prev.length - 1) return prev;
      const copy = [...prev];
      const temp = copy[index + 1];
      copy[index + 1] = copy[index];
      copy[index] = temp;
      saveVehicleOrder(copy.map(r => r.id));
      return copy;
    });
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedSite?.id]);

  const fetchRecords = async () => {
    try {
      setIsLoading(true);
      const url = `${API_BASE_URL}/workforce/emi${selectedSite?.id ? `?site_id=${selectedSite.id}` : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        let sorted = data;
        try {
          const savedOrderStr = await AsyncStorage.getItem(VEHICLES_ORDER_KEY);
          const currentOrder = savedOrderStr ? JSON.parse(savedOrderStr) : vehicleOrder;
          if (currentOrder && currentOrder.length > 0) {
            sorted = [...data].sort((a, b) => {
              const idxA = currentOrder.indexOf(a.id);
              const idxB = currentOrder.indexOf(b.id);
              if (idxA !== -1 && idxB !== -1) return idxA - idxB;
              if (idxA !== -1) return -1;
              if (idxB !== -1) return 1;
              return 0;
            });
          }
        } catch (e) {}
        setRecords(sorted);
      } else {
        Alert.alert('Error', 'Failed to fetch compliance records');
      }
    } catch (e) {
      console.error('Fetch compliance vault error', e);
      Alert.alert('Error', 'Network error while loading vault records');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const getDaysDiff = (dateStr) => {
    if (!dateStr) return null;
    const target = new Date(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    target.setHours(0, 0, 0, 0);
    const diff = target - today;
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getStatusBadge = (days) => {
    if (days === null) return { text: 'N/A', bg: '#F1F5F9', color: '#64748B' };
    if (days < 0) return { text: `${Math.abs(days)}d Overdue`, bg: '#FEE2E2', color: '#DC2626' };
    if (days === 0) return { text: 'Due Today', bg: '#FEF3C7', color: '#D97706' };
    if (days <= 7) return { text: `${days}d Left`, bg: '#FEF3C7', color: '#D97706' };
    if (days <= 30) return { text: `${days}d Left`, bg: '#EFF6FF', color: '#2563EB' };
    return { text: `${days}d Left`, bg: '#ECFDF5', color: '#059669' };
  };

  const formatDisplayDate = (d) => {
    if (!d) return 'Pick Date';
    if (typeof d === 'string') return d.split('T')[0];
    if (d instanceof Date && !isNaN(d)) return d.toISOString().split('T')[0];
    return 'Pick Date';
  };

  const openAddModal = () => {
    setEditingRecord(null);
    setVehicleNumber('');
    setEmiAmount('');
    setEmiDueDate(null);
    setInsuranceExpiry(null);
    setInsurancePremium('');
    setFitnessExpiry(null);
    setFitnessFee('');
    setRoadTaxExpiry(null);
    setRoadTaxAmount('');
    setPuccExpiry(null);
    setPuccFee('');
    setRegistrationDate(null);
    setPermitValidUpto(null);
    setPermitFee('');
    setFinancier('');
    setNotes('');
    setDocumentUrl(null);
    setIsModalVisible(true);
  };

  const openEditModal = (rec) => {
    setEditingRecord(rec);
    setVehicleNumber(rec.vehicle_number || '');
    setEmiAmount(rec.emi_amount ? String(rec.emi_amount) : '');
    setEmiDueDate(rec.emi_due_date ? new Date(rec.emi_due_date) : null);
    setInsuranceExpiry(rec.insurance_expiry ? new Date(rec.insurance_expiry) : null);
    setInsurancePremium(rec.insurance_premium ? String(rec.insurance_premium) : '');
    setFitnessExpiry(rec.fitness_expiry ? new Date(rec.fitness_expiry) : null);
    setFitnessFee(rec.fitness_fee ? String(rec.fitness_fee) : '');
    setRoadTaxExpiry(rec.road_tax_expiry ? new Date(rec.road_tax_expiry) : null);
    setRoadTaxAmount(rec.road_tax_amount ? String(rec.road_tax_amount) : '');
    setPuccExpiry(rec.pucc_expiry ? new Date(rec.pucc_expiry) : null);
    setPuccFee(rec.pucc_fee ? String(rec.pucc_fee) : '');
    setRegistrationDate(rec.registration_date ? new Date(rec.registration_date) : null);
    setPermitValidUpto(rec.permit_valid_upto ? new Date(rec.permit_valid_upto) : null);
    setPermitFee(rec.permit_fee ? String(rec.permit_fee) : '');
    setFinancier(rec.financier || '');
    setNotes(rec.notes || '');
    setDocumentUrl(rec.document_url || null);
    setIsModalVisible(true);
  };

  const handlePickDocument = async () => {
    Alert.alert('Upload Document', 'Choose source', [
      {
        text: 'Camera',
        onPress: async () => {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission needed', 'Camera permission required');
            return;
          }
          const res = await ImagePicker.launchCameraAsync({ quality: 0.5, base64: true });
          if (!res.canceled) {
            setDocumentUrl(`data:image/jpeg;base64,${res.assets[0].base64}`);
          }
        }
      },
      {
        text: 'Gallery',
        onPress: async () => {
          const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!perm.granted) {
            Alert.alert('Permission needed', 'Gallery permission required');
            return;
          }
          const res = await ImagePicker.launchImageLibraryAsync({ quality: 0.5, base64: true });
          if (!res.canceled) {
            setDocumentUrl(`data:image/jpeg;base64,${res.assets[0].base64}`);
          }
        }
      },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const saveRecord = async () => {
    if (!vehicleNumber.trim()) {
      Alert.alert('Validation Error', 'Vehicle Number is required');
      return;
    }

    const payload = {
      vehicle_number: vehicleNumber.trim().toUpperCase(),
      financier: financier.trim() || null,
      emi_amount: parseFloat(emiAmount) || 0.0,
      emi_due_date: emiDueDate ? emiDueDate.toISOString().split('T')[0] : null,
      insurance_expiry: insuranceExpiry ? insuranceExpiry.toISOString().split('T')[0] : null,
      insurance_premium: parseFloat(insurancePremium) || 0.0,
      fitness_expiry: fitnessExpiry ? fitnessExpiry.toISOString().split('T')[0] : null,
      fitness_fee: parseFloat(fitnessFee) || 0.0,
      road_tax_expiry: roadTaxExpiry ? roadTaxExpiry.toISOString().split('T')[0] : null,
      road_tax_amount: parseFloat(roadTaxAmount) || 0.0,
      pucc_expiry: puccExpiry ? puccExpiry.toISOString().split('T')[0] : null,
      pucc_fee: parseFloat(puccFee) || 0.0,
      registration_date: registrationDate ? registrationDate.toISOString().split('T')[0] : null,
      permit_valid_upto: permitValidUpto ? permitValidUpto.toISOString().split('T')[0] : null,
      permit_fee: parseFloat(permitFee) || 0.0,
      notes: notes.trim() || null,
      document_url: documentUrl,
      site_id: selectedSite?.id || 1,
    };

    try {
      let res;
      if (editingRecord) {
        res = await fetch(`${API_BASE_URL}/workforce/emi/${editingRecord.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch(`${API_BASE_URL}/workforce/emi`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${userToken}` },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setIsModalVisible(false);
        fetchRecords();
        Alert.alert('Success', `Vehicle compliance record ${editingRecord ? 'updated' : 'added'}!`);
      } else {
        const err = await res.json();
        Alert.alert('Error', err.detail || 'Failed to save record');
      }
    } catch (e) {
      Alert.alert('Error', 'Network error saving record');
    }
  };

  const markCostPaid = (id, costType, costLabel, amount) => {
    const formattedAmt = amount ? `₹${parseFloat(amount).toLocaleString()}` : '';
    Alert.alert(
      `Mark ${costLabel} Paid`,
      `Record payment for ${costLabel}${formattedAmt ? ` (${formattedAmt})` : ''}? The due date will be updated and an instant push notification will be sent.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm & Pay',
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/workforce/emi/${id}/mark_cost_paid?cost_type=${costType}`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${userToken}` }
              });
              if (res.ok) {
                Alert.alert('Payment Recorded', `${costLabel} marked as paid! Due date updated & notification dispatched.`);
                fetchRecords();
              } else {
                const err = await res.json().catch(() => ({}));
                Alert.alert('Error', err.detail || `Failed to mark ${costLabel} as paid`);
              }
            } catch (e) {
              Alert.alert('Error', 'Network error marking cost paid');
            }
          }
        }
      ]
    );
  };

  const markEmiPaid = (id, amount) => markCostPaid(id, 'EMI', 'Monthly EMI', amount);

  const deleteRecord = (id) => {
    Alert.alert(
      'Delete Record',
      'Are you sure you want to remove this vehicle compliance and EMI record?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE_URL}/workforce/emi/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${userToken}` }
              });
              if (res.ok) fetchRecords();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete record');
            }
          }
        }
      ]
    );
  };

  // Filter records
  const filteredRecords = records.filter(r => {
    const matchesSearch = !searchQuery || 
      (r.vehicle_number || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.financier || '').toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    const emiDays = getDaysDiff(r.emi_due_date);
    const insDays = getDaysDiff(r.insurance_expiry);
    const fitDays = getDaysDiff(r.fitness_expiry);
    const taxDays = getDaysDiff(r.road_tax_expiry);
    const pucDays = getDaysDiff(r.pucc_expiry);
    const permitDays = getDaysDiff(r.permit_valid_upto);

    if (activeFilter === 'ACTION_REQUIRED') {
      return (emiDays !== null && emiDays <= 7) ||
             (insDays !== null && insDays <= 7) ||
             (fitDays !== null && fitDays <= 7) ||
             (taxDays !== null && taxDays <= 7) ||
             (pucDays !== null && pucDays <= 7) ||
             (permitDays !== null && permitDays <= 7);
    }
    if (activeFilter === 'EMI_DUE') {
      return emiDays !== null && emiDays <= 10;
    }
    if (activeFilter === 'EXPIRING_SOON') {
      return (insDays !== null && insDays >= 0 && insDays <= 15) || 
             (fitDays !== null && fitDays >= 0 && fitDays <= 15) || 
             (taxDays !== null && taxDays >= 0 && taxDays <= 15) || 
             (pucDays !== null && pucDays >= 0 && pucDays <= 15) || 
             (permitDays !== null && permitDays >= 0 && permitDays <= 15) || 
             (emiDays !== null && emiDays >= 0 && emiDays <= 7);
    }
    if (activeFilter === 'EXPIRED') {
      return (insDays !== null && insDays < 0) || 
             (fitDays !== null && fitDays < 0) || 
             (taxDays !== null && taxDays < 0) || 
             (pucDays !== null && pucDays < 0) || 
             (permitDays !== null && permitDays < 0) || 
             (emiDays !== null && emiDays < 0);
    }

    return true;
  });

  const totalMonthlyEmi = records.reduce((sum, r) => sum + (parseFloat(r.emi_amount) || 0), 0);
  const urgentCount = records.filter(r => {
    const d1 = getDaysDiff(r.emi_due_date);
    const d2 = getDaysDiff(r.insurance_expiry);
    const d3 = getDaysDiff(r.fitness_expiry);
    const d4 = getDaysDiff(r.road_tax_expiry);
    const d5 = getDaysDiff(r.pucc_expiry);
    const d6 = getDaysDiff(r.permit_valid_upto);
    return (d1 !== null && d1 <= 7) || (d2 !== null && d2 <= 7) || (d3 !== null && d3 <= 7) || (d4 !== null && d4 <= 7) || (d5 !== null && d5 <= 7) || (d6 !== null && d6 <= 7);
  }).length;

  const modalScrollViewRef = useRef(null);
  const modalScrollYRef = useRef(0);

  const complianceFormSections = [
    {
      id: 'reg_date',
      title: 'Registration Date',
      icon: 'calendar-check',
      color: '#2563EB',
      height: 78,
      renderContent: () => (
        <View>
          <TouchableOpacity
            style={styles.datePickerBtn}
            onPress={() => setActiveDatePicker('regDate')}
          >
            <Text style={styles.datePickerBtnText}>
              {formatDisplayDate(registrationDate)}
            </Text>
            <MaterialCommunityIcons name="calendar-check" size={18} color="#2563EB" />
          </TouchableOpacity>
        </View>
      ),
    },
    {
      id: 'permit',
      title: 'Permit Validity & Fee',
      icon: 'file-certificate',
      color: '#059669',
      height: 78,
      renderContent: () => (
        <View style={styles.formRow}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => setActiveDatePicker('permit')}
            >
              <Text style={styles.datePickerBtnText}>
                {formatDisplayDate(permitValidUpto)}
              </Text>
              <MaterialCommunityIcons name="file-certificate" size={18} color="#059669" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="Fee ₹: e.g. 3500"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={permitFee}
              onChangeText={setPermitFee}
            />
          </View>
        </View>
      ),
    },
    {
      id: 'emi',
      title: 'Monthly EMI & Due Date',
      icon: 'credit-card-outline',
      color: '#2563EB',
      height: 78,
      renderContent: () => (
        <View style={styles.formRow}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="EMI ₹: e.g. 133687"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={emiAmount}
              onChangeText={setEmiAmount}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => setActiveDatePicker('emi')}
            >
              <Text style={styles.datePickerBtnText}>
                {formatDisplayDate(emiDueDate)}
              </Text>
              <MaterialCommunityIcons name="calendar" size={18} color="#2563EB" />
            </TouchableOpacity>
          </View>
        </View>
      ),
    },
    {
      id: 'insurance',
      title: 'Insurance Compliance',
      icon: 'shield-check-outline',
      color: '#059669',
      height: 78,
      renderContent: () => (
        <View style={styles.formRow}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => setActiveDatePicker('insurance')}
            >
              <Text style={styles.datePickerBtnText}>
                {formatDisplayDate(insuranceExpiry)}
              </Text>
              <MaterialCommunityIcons name="calendar" size={18} color="#059669" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="Premium ₹: e.g. 45000"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={insurancePremium}
              onChangeText={setInsurancePremium}
            />
          </View>
        </View>
      ),
    },
    {
      id: 'fitness',
      title: 'Fitness Compliance',
      icon: 'certificate-outline',
      color: '#D97706',
      height: 78,
      renderContent: () => (
        <View style={styles.formRow}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => setActiveDatePicker('fitness')}
            >
              <Text style={styles.datePickerBtnText}>
                {formatDisplayDate(fitnessExpiry)}
              </Text>
              <MaterialCommunityIcons name="calendar" size={18} color="#D97706" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="Fee ₹: e.g. 1500"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={fitnessFee}
              onChangeText={setFitnessFee}
            />
          </View>
        </View>
      ),
    },
    {
      id: 'road_tax',
      title: 'Road Tax Compliance',
      icon: 'road',
      color: '#D97706',
      height: 78,
      renderContent: () => (
        <View style={styles.formRow}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => setActiveDatePicker('roadTax')}
            >
              <Text style={styles.datePickerBtnText}>
                {formatDisplayDate(roadTaxExpiry)}
              </Text>
              <MaterialCommunityIcons name="calendar" size={18} color="#D97706" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="Tax ₹: e.g. 12500"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={roadTaxAmount}
              onChangeText={setRoadTaxAmount}
            />
          </View>
        </View>
      ),
    },
    {
      id: 'pucc',
      title: 'PUCC Compliance',
      icon: 'gauge',
      color: '#7C3AED',
      height: 78,
      renderContent: () => (
        <View style={styles.formRow}>
          <View style={{ flex: 1, marginRight: 6 }}>
            <TouchableOpacity
              style={styles.datePickerBtn}
              onPress={() => setActiveDatePicker('pucc')}
            >
              <Text style={styles.datePickerBtnText}>
                {formatDisplayDate(puccExpiry)}
              </Text>
              <MaterialCommunityIcons name="calendar" size={18} color="#7C3AED" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <TextInput
              style={[styles.input, { marginBottom: 0 }]}
              placeholder="Fee ₹: e.g. 150"
              placeholderTextColor="#94A3B8"
              keyboardType="numeric"
              value={puccFee}
              onChangeText={setPuccFee}
            />
          </View>
        </View>
      ),
    },
    {
      id: 'notes_doc',
      title: 'Remarks & Document Scan',
      icon: 'file-document-edit-outline',
      color: '#64748B',
      height: 140,
      renderContent: () => (
        <View>
          <TextInput
            style={[styles.input, { height: 42, marginBottom: 8 }]}
            placeholder="Optional notes, policy numbers, etc."
            placeholderTextColor="#94A3B8"
            multiline
            value={notes}
            onChangeText={setNotes}
          />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <TouchableOpacity style={styles.uploadBtn} onPress={handlePickDocument}>
              <MaterialCommunityIcons name="camera-plus" size={16} color="#2563EB" />
              <Text style={styles.uploadBtnText}>Upload Doc</Text>
            </TouchableOpacity>
            {documentUrl ? (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Image source={{ uri: documentUrl }} style={{ width: 34, height: 34, borderRadius: 6, marginRight: 6 }} />
                <TouchableOpacity onPress={() => setDocumentUrl(null)}>
                  <MaterialCommunityIcons name="close-circle" size={18} color="#DC2626" />
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={{ fontSize: 11, color: '#94A3B8' }}>No doc attached</Text>
            )}
          </View>
        </View>
      ),
    },
  ];

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
          <Text style={styles.headerSubtitle}>COMPLIANCE VAULT</Text>
          <Text style={styles.headerTitle}>EMI & Vehicle Vault</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity 
            style={[styles.addBtn, { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' }]} 
            onPress={async () => {
              try {
                const res = await fetch(`${API_BASE_URL}/workforce/emi/send-due-reminders?days_threshold=7`, {
                  method: 'POST',
                  headers: { 'Authorization': `Bearer ${userToken}` }
                });
                if (res.ok) {
                  const data = await res.json();
                  Alert.alert('Alert Check', `${data.message}\nChecked recipients: ${data.recipients_count}`);
                }
              } catch (e) {
                Alert.alert('Alert Check', 'Failed to trigger alert check');
              }
            }}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="bell-ring-outline" size={18} color="#1E293B" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.addBtn} onPress={openAddModal} activeOpacity={0.8}>
            <MaterialCommunityIcons name="plus" size={20} color="white" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Metric Summary Cards (Interactive Filters) */}
      <View style={styles.metricsContainer}>
        <TouchableOpacity 
          style={[
            styles.metricCard, 
            { borderLeftColor: '#2563EB' },
            activeFilter === 'EMI_DUE' && { backgroundColor: '#EFF6FF', borderColor: '#2563EB', borderWidth: 2 }
          ]}
          onPress={() => setActiveFilter(activeFilter === 'EMI_DUE' ? 'ALL' : 'EMI_DUE')}
          activeOpacity={0.8}
        >
          <Text style={styles.metricLabel}>TOTAL MONTHLY EMI</Text>
          <Text style={styles.metricValue}>₹{totalMonthlyEmi.toLocaleString()}</Text>
          <Text style={[styles.metricSub, activeFilter === 'EMI_DUE' && { color: '#2563EB', fontWeight: '800' }]}>
            {activeFilter === 'EMI_DUE' ? 'Filtering active (Tap to reset)' : `${records.length} Vehicles tracked`}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[
            styles.metricCard, 
            { borderLeftColor: urgentCount > 0 ? '#DC2626' : '#10B981' },
            activeFilter === 'ACTION_REQUIRED' && { 
              backgroundColor: urgentCount > 0 ? '#FEF2F2' : '#F0FDF4', 
              borderColor: urgentCount > 0 ? '#DC2626' : '#10B981', 
              borderWidth: 2 
            }
          ]}
          onPress={() => setActiveFilter(activeFilter === 'ACTION_REQUIRED' ? 'ALL' : 'ACTION_REQUIRED')}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={[styles.metricLabel, { color: urgentCount > 0 ? '#DC2626' : '#64748B' }]}>ACTION REQUIRED</Text>
            {urgentCount > 0 && <MaterialCommunityIcons name="alert-circle" size={14} color="#DC2626" />}
          </View>
          <Text style={[styles.metricValue, { color: urgentCount > 0 ? '#DC2626' : '#10B981' }]}>
            {urgentCount}
          </Text>
          <Text style={[styles.metricSub, activeFilter === 'ACTION_REQUIRED' && { color: '#DC2626', fontWeight: '800' }]}>
            {activeFilter === 'ACTION_REQUIRED' ? 'Filtering active (Tap to reset)' : 'Due / Expiring within 7d'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search & Filter Bar */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchBox}>
          <MaterialCommunityIcons name="magnify" size={20} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vehicle number or financier..."
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
          {[
            { id: 'ALL', label: 'All Vehicles' },
            { id: 'ACTION_REQUIRED', label: `🚨 Action Required (${urgentCount})` },
            { id: 'EXPIRING_SOON', label: '⚠️  Expiring Soon' },
            { id: 'EXPIRED', label: '🚨 Overdue / Expired' },
            { id: 'EMI_DUE', label: '💳 EMI Due' }
          ].map(f => (
            <TouchableOpacity
              key={f.id}
              style={[styles.filterChip, activeFilter === f.id && styles.filterChipActive]}
              onPress={() => setActiveFilter(f.id)}
            >
              <Text style={[styles.filterChipText, activeFilter === f.id && styles.filterChipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Records List Header & Toggle All */}
      {!isLoading && filteredRecords.length > 0 && (
        <View style={styles.listControlBar}>
          <Text style={styles.listCountText}>
            Showing <Text style={{ fontWeight: '800', color: '#0F172A' }}>{filteredRecords.length}</Text> {filteredRecords.length === 1 ? 'vehicle' : 'vehicles'}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity 
              style={[styles.foldAllBtn, isArrangeMode ? { backgroundColor: '#2563EB', borderColor: '#2563EB' } : { backgroundColor: '#F8FAFC', borderColor: '#CBD5E1' }]} 
              onPress={() => {
                try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch(e){}
                setIsArrangeMode(!isArrangeMode);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name={isArrangeMode ? "check" : "swap-vertical"} size={15} color={isArrangeMode ? "#FFFFFF" : "#0F172A"} />
              <Text style={[styles.foldAllBtnText, { color: isArrangeMode ? "#FFFFFF" : "#0F172A" }]}>
                {isArrangeMode ? "Done" : "Arrange"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.foldAllBtn} 
              onPress={toggleAllCards}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons 
                name={filteredRecords.every(r => !!expandedCardIds[r.id]) ? 'arrow-collapse-vertical' : 'arrow-expand-vertical'} 
                size={15} 
                color="#2563EB" 
              />
              <Text style={styles.foldAllBtnText}>
                {filteredRecords.every(r => !!expandedCardIds[r.id]) ? 'Collapse All' : 'Expand All'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Records List */}
      <ScrollView
        ref={vaultScrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        onScroll={(e) => {
          vaultScrollYRef.current = e.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => { setIsRefreshing(true); fetchRecords(); }}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text style={styles.loadingText}>Loading compliance records...</Text>
          </View>
        ) : filteredRecords.length === 0 ? (
          <View style={styles.emptyBox}>
            <MaterialCommunityIcons name="shield-car" size={60} color="#CBD5E1" />
            <Text style={styles.emptyTitle}>No Records Found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'No vehicle matched your search.' : 'Add your first vehicle EMI and compliance record above.'}
            </Text>
          </View>
        ) : isArrangeMode ? (
          <View style={{ width: '100%' }}>
            <View style={styles.arrangeModeBanner}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <MaterialCommunityIcons name="gesture-tap-hold" size={18} color="#2563EB" />
                <Text style={styles.arrangeModeBannerTitle}>Hold & Drag Cards to Arrange</Text>
              </View>
              <TouchableOpacity 
                style={styles.arrangeDoneBtn}
                onPress={() => setIsArrangeMode(false)}
                activeOpacity={0.8}
              >
                <MaterialCommunityIcons name="check" size={15} color="#FFFFFF" />
                <Text style={styles.arrangeDoneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>

            <DraggableCardList
              items={filteredRecords}
              itemHeight={76}
              gap={10}
              paddingHorizontal={0}
              storageKey={VEHICLES_ORDER_KEY}
              scrollViewRef={vaultScrollViewRef}
              scrollYRef={vaultScrollYRef}
              dragHint=""
              onOrderChange={(newOrderedList) => {
                setRecords(newOrderedList);
                saveVehicleOrder(newOrderedList.map(r => r.id));
              }}
              renderItem={(rec, index, isDragging) => (
                <View style={[styles.arrangeCard, isDragging && styles.arrangeCardDragging]}>
                  <View style={styles.arrangeCardLeft}>
                    <MaterialCommunityIcons name="drag-horizontal-variant" size={20} color="#64748B" style={{ marginRight: 8 }} />
                    <View style={styles.vehicleIconBox}>
                      <MaterialCommunityIcons name="truck" size={18} color="#2563EB" />
                    </View>
                    <View style={{ marginLeft: 10, flex: 1 }}>
                      <Text style={styles.arrangeVehicleNum} numberOfLines={1}>{rec.vehicle_number}</Text>
                      <Text style={styles.arrangeFinancier} numberOfLines={1}>{rec.financier ? `Financier: ${rec.financier}` : 'No Financier'}</Text>
                    </View>
                  </View>
                  <View style={styles.arrangeCardRight}>
                    <TouchableOpacity 
                      style={styles.arrangeArrowBtn} 
                      onPress={() => moveVehicleUp(rec.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <MaterialCommunityIcons name="chevron-up" size={18} color="#475569" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.arrangeArrowBtn} 
                      onPress={() => moveVehicleDown(rec.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    >
                      <MaterialCommunityIcons name="chevron-down" size={18} color="#475569" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          </View>
        ) : (
          filteredRecords.map(rec => {
            const isExpanded = !!expandedCardIds[rec.id];

            const emiDays = getDaysDiff(rec.emi_due_date);
            const insDays = getDaysDiff(rec.insurance_expiry);
            const fitDays = getDaysDiff(rec.fitness_expiry);
            const taxDays = getDaysDiff(rec.road_tax_expiry);
            const pucDays = getDaysDiff(rec.pucc_expiry);
            const permitDays = getDaysDiff(rec.permit_valid_upto);

            const emiBadge = getStatusBadge(emiDays);
            const insBadge = getStatusBadge(insDays);
            const fitBadge = getStatusBadge(fitDays);
            const taxBadge = getStatusBadge(taxDays);
            const pucBadge = getStatusBadge(pucDays);
            const permitBadge = getStatusBadge(permitDays);

            const emiAmt = parseFloat(rec.emi_amount) || 0;
            const insPrem = parseFloat(rec.insurance_premium) || 0;
            const permitFee = parseFloat(rec.permit_fee) || 0;
            const fitFee = parseFloat(rec.fitness_fee) || 0;
            const taxAmt = parseFloat(rec.road_tax_amount) || 0;
            const pucFee = parseFloat(rec.pucc_fee) || 0;

            const hasEmi = emiAmt > 0 || !!rec.emi_due_date;
            const hasInsurance = insPrem > 0 || !!rec.insurance_expiry;
            const hasPermit = permitFee > 0 || !!rec.permit_valid_upto;
            const hasFitness = fitFee > 0 || !!rec.fitness_expiry;
            const hasRoadTax = taxAmt > 0 || !!rec.road_tax_expiry;
            const hasPucc = pucFee > 0 || !!rec.pucc_expiry;
            const hasRegistration = !!rec.registration_date;
            const hasAnyCompliance = hasEmi || hasInsurance || hasPermit || hasFitness || hasRoadTax || hasPucc || hasRegistration;

            const hasUrgent = (emiDays !== null && emiDays <= 7) ||
              (insDays !== null && insDays <= 7) ||
              (fitDays !== null && fitDays <= 7) ||
              (taxDays !== null && taxDays <= 7) ||
              (pucDays !== null && pucDays <= 7) ||
              (permitDays !== null && permitDays <= 7);

            return (
              <View key={rec.id} style={[styles.card, hasUrgent && styles.cardUrgentBorder]}>
                {/* Card Top: Vehicle & Actions */}
                <View style={styles.cardHeader}>
                  <TouchableOpacity 
                    style={styles.vehicleBadge}
                    onPress={() => toggleCardFold(rec.id)}
                    onLongPress={() => {
                      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch(e){}
                      setIsArrangeMode(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.vehicleIconBox, isExpanded && styles.vehicleIconBoxActive]}>
                      <MaterialCommunityIcons 
                        name="truck" 
                        size={20} 
                        color={isExpanded ? "#2563EB" : "#1E293B"} 
                      />
                    </View>
                    <View style={{ marginLeft: 8, flexShrink: 1 }}>
                      <Text style={styles.vehicleText}>{rec.vehicle_number}</Text>
                      {rec.financier ? (
                        <Text style={styles.financierText} numberOfLines={1}>Financier: {rec.financier}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>

                  <View style={styles.actionRow}>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }]} 
                      onPress={() => {
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch(e){}
                        setIsArrangeMode(true);
                      }}
                      onLongPress={() => {
                        try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch(e){}
                        setIsArrangeMode(true);
                      }}
                      accessibilityLabel="Hold and drag to reorder"
                      hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                      <MaterialCommunityIcons name="drag-vertical" size={20} color="#475569" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.actionBtn} 
                      onPress={() => openEditModal(rec)}
                      accessibilityLabel="Edit record"
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={18} color="#2563EB" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, { backgroundColor: '#FEE2E2' }]} 
                      onPress={() => deleteRecord(rec.id)}
                      accessibilityLabel="Delete record"
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={18} color="#DC2626" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.actionBtn, styles.foldToggleBtn, isExpanded && styles.foldToggleBtnActive]} 
                      onPress={() => toggleCardFold(rec.id)}
                      accessibilityLabel={isExpanded ? "Collapse card" : "Expand card"}
                    >
                      <MaterialCommunityIcons 
                        name={isExpanded ? "chevron-up" : "chevron-down"} 
                        size={20} 
                        color={isExpanded ? "#FFFFFF" : "#2563EB"} 
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Collapsed Summary Row (When card is folded) */}
                {!isExpanded && (
                  <TouchableOpacity 
                    style={styles.collapsedSummaryContainer}
                    onPress={() => toggleCardFold(rec.id)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.compactChipsWrap}>
                      {hasEmi && (
                        <View style={[styles.miniChip, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                          <MaterialCommunityIcons name="bank-transfer-out" size={12} color="#2563EB" />
                          <Text style={[styles.miniChipText, { color: '#1E40AF' }]}>
                            EMI {emiAmt > 0 ? `₹${emiAmt.toLocaleString()}` : ''}
                          </Text>
                          {rec.emi_due_date ? (
                            <View style={[styles.miniPillBadge, { backgroundColor: emiBadge.bg }]}>
                              <Text style={[styles.miniPillBadgeText, { color: emiBadge.color }]}>{emiBadge.text}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {hasInsurance && (
                        <View style={[styles.miniChip, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                          <MaterialCommunityIcons name="shield-check-outline" size={12} color="#059669" />
                          <Text style={[styles.miniChipText, { color: '#166534' }]}>Ins</Text>
                          {rec.insurance_expiry ? (
                            <View style={[styles.miniPillBadge, { backgroundColor: insBadge.bg }]}>
                              <Text style={[styles.miniPillBadgeText, { color: insBadge.color }]}>{insBadge.text}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {hasFitness && (
                        <View style={[styles.miniChip, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                          <MaterialCommunityIcons name="certificate-outline" size={12} color="#059669" />
                          <Text style={[styles.miniChipText, { color: '#065F46' }]}>Fit</Text>
                          {rec.fitness_expiry ? (
                            <View style={[styles.miniPillBadge, { backgroundColor: fitBadge.bg }]}>
                              <Text style={[styles.miniPillBadgeText, { color: fitBadge.color }]}>{fitBadge.text}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {hasRoadTax && (
                        <View style={[styles.miniChip, { backgroundColor: '#FEF3C7', borderColor: '#FDE68A' }]}>
                          <MaterialCommunityIcons name="road" size={12} color="#D97706" />
                          <Text style={[styles.miniChipText, { color: '#92400E' }]}>Tax</Text>
                          {rec.road_tax_expiry ? (
                            <View style={[styles.miniPillBadge, { backgroundColor: taxBadge.bg }]}>
                              <Text style={[styles.miniPillBadgeText, { color: taxBadge.color }]}>{taxBadge.text}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {hasPucc && (
                        <View style={[styles.miniChip, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                          <MaterialCommunityIcons name="gauge" size={12} color="#7C3AED" />
                          <Text style={[styles.miniChipText, { color: '#5B21B6' }]}>PUC</Text>
                          {rec.pucc_expiry ? (
                            <View style={[styles.miniPillBadge, { backgroundColor: pucBadge.bg }]}>
                              <Text style={[styles.miniPillBadgeText, { color: pucBadge.color }]}>{pucBadge.text}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {hasPermit && (
                        <View style={[styles.miniChip, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }]}>
                          <MaterialCommunityIcons name="file-certificate-outline" size={12} color="#059669" />
                          <Text style={[styles.miniChipText, { color: '#166534' }]}>Permit</Text>
                          {rec.permit_valid_upto ? (
                            <View style={[styles.miniPillBadge, { backgroundColor: permitBadge.bg }]}>
                              <Text style={[styles.miniPillBadgeText, { color: permitBadge.color }]}>{permitBadge.text}</Text>
                            </View>
                          ) : null}
                        </View>
                      )}

                      {!hasAnyCompliance && (
                        <Text style={styles.noComplianceCompactText}>No compliance items configured</Text>
                      )}
                    </View>

                    <View style={styles.expandPromptRow}>
                      <Text style={styles.expandPromptText}>Tap to unfold details & pay</Text>
                      <MaterialCommunityIcons name="chevron-down" size={14} color="#2563EB" />
                    </View>
                  </TouchableOpacity>
                )}

                {/* Expanded Full Compliance Details (When card is unfolded) */}
                {isExpanded && (
                  <View style={styles.expandedDetailsContainer}>
                    {/* Section 1: Monthly EMI (Only if configured) */}
                    {hasEmi && (
                      <View style={styles.costBlock}>
                        <View style={styles.sectionHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MaterialCommunityIcons name="bank-transfer-out" size={16} color="#2563EB" />
                            <Text style={styles.sectionHeading}>MONTHLY EMI</Text>
                          </View>
                          {rec.emi_due_date && (
                            <View style={[styles.badge, { backgroundColor: emiBadge.bg }]}>
                              <Text style={[styles.badgeText, { color: emiBadge.color }]}>{emiBadge.text}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.infoRow}>
                          {emiAmt > 0 ? (
                            <View>
                              <Text style={styles.label}>AMOUNT</Text>
                              <Text style={styles.valAmount}>₹{emiAmt.toLocaleString()}</Text>
                            </View>
                          ) : null}
                          <View style={{ alignItems: emiAmt > 0 ? 'flex-end' : 'flex-start' }}>
                            <Text style={styles.label}>DUE DATE</Text>
                            <Text style={styles.valDate}>{rec.emi_due_date || 'Not Scheduled'}</Text>
                          </View>
                        </View>
                        {emiAmt > 0 && rec.emi_due_date ? (
                          <TouchableOpacity 
                            style={styles.markPaidBtn} 
                            onPress={() => markCostPaid(rec.id, 'EMI', 'Monthly EMI', emiAmt)} 
                            activeOpacity={0.8}
                          >
                            <MaterialCommunityIcons name="check-circle-outline" size={16} color="#059669" />
                            <Text style={styles.markPaidBtnText}>Mark EMI Paid (+1 Month)</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}

                    {/* Section 2: Insurance (Only if configured) */}
                    {hasInsurance && (
                      <View style={[styles.costBlock, hasEmi && { marginTop: 10 }]}>
                        <View style={styles.sectionHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MaterialCommunityIcons name="shield-check-outline" size={16} color="#2563EB" />
                            <Text style={styles.sectionHeading}>INSURANCE POLICY</Text>
                          </View>
                          {rec.insurance_expiry && (
                            <View style={[styles.badge, { backgroundColor: insBadge.bg }]}>
                              <Text style={[styles.badgeText, { color: insBadge.color }]}>{insBadge.text}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.infoRow}>
                          {insPrem > 0 ? (
                            <View>
                              <Text style={styles.label}>PREMIUM</Text>
                              <Text style={styles.valAmount}>₹{insPrem.toLocaleString()}</Text>
                            </View>
                          ) : null}
                          <View style={{ alignItems: insPrem > 0 ? 'flex-end' : 'flex-start' }}>
                            <Text style={styles.label}>EXPIRY DATE</Text>
                            <Text style={styles.valDate}>{rec.insurance_expiry || 'Not set'}</Text>
                          </View>
                        </View>
                        {insPrem > 0 ? (
                          <TouchableOpacity 
                            style={[styles.markPaidBtn, { backgroundColor: '#EFF6FF' }]} 
                            onPress={() => markCostPaid(rec.id, 'INSURANCE', 'Insurance Premium', insPrem)} 
                            activeOpacity={0.8}
                          >
                            <MaterialCommunityIcons name="shield-sync-outline" size={16} color="#2563EB" />
                            <Text style={[styles.markPaidBtnText, { color: '#2563EB' }]}>Mark Insurance Renewed (+1 Year)</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}

                    {/* Section 3: Permit (Only if configured) */}
                    {hasPermit && (
                      <View style={[styles.costBlock, (hasEmi || hasInsurance) && { marginTop: 10 }]}>
                        <View style={styles.sectionHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MaterialCommunityIcons name="file-certificate-outline" size={16} color="#059669" />
                            <Text style={styles.sectionHeading}>PERMIT VALIDITY & FEE</Text>
                          </View>
                          {rec.permit_valid_upto && (
                            <View style={[styles.badge, { backgroundColor: permitBadge.bg }]}>
                              <Text style={[styles.badgeText, { color: permitBadge.color }]}>{permitBadge.text}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.infoRow}>
                          {permitFee > 0 ? (
                            <View>
                              <Text style={styles.label}>PERMIT FEE</Text>
                              <Text style={styles.valAmount}>₹{permitFee.toLocaleString()}</Text>
                            </View>
                          ) : null}
                          <View style={{ alignItems: permitFee > 0 ? 'flex-end' : 'flex-start' }}>
                            <Text style={styles.label}>VALID UPTO</Text>
                            <Text style={styles.valDate}>{rec.permit_valid_upto || 'Not set'}</Text>
                          </View>
                        </View>
                        {permitFee > 0 ? (
                          <TouchableOpacity 
                            style={[styles.markPaidBtn, { backgroundColor: '#F0FDF4' }]} 
                            onPress={() => markCostPaid(rec.id, 'PERMIT', 'Permit Fee', permitFee)} 
                            activeOpacity={0.8}
                          >
                            <MaterialCommunityIcons name="file-check-outline" size={16} color="#059669" />
                            <Text style={[styles.markPaidBtnText, { color: '#059669' }]}>Mark Permit Paid (+1 Year)</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}

                    {/* Section 4: Fitness Certificate (Only if configured) */}
                    {hasFitness && (
                      <View style={[styles.costBlock, (hasEmi || hasInsurance || hasPermit) && { marginTop: 10 }]}>
                        <View style={styles.sectionHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MaterialCommunityIcons name="certificate-outline" size={16} color="#059669" />
                            <Text style={styles.sectionHeading}>FITNESS CERTIFICATE</Text>
                          </View>
                          {rec.fitness_expiry && (
                            <View style={[styles.badge, { backgroundColor: fitBadge.bg }]}>
                              <Text style={[styles.badgeText, { color: fitBadge.color }]}>{fitBadge.text}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.infoRow}>
                          {fitFee > 0 ? (
                            <View>
                              <Text style={styles.label}>FITNESS FEE</Text>
                              <Text style={styles.valAmount}>₹{fitFee.toLocaleString()}</Text>
                            </View>
                          ) : null}
                          <View style={{ alignItems: fitFee > 0 ? 'flex-end' : 'flex-start' }}>
                            <Text style={styles.label}>EXPIRY DATE</Text>
                            <Text style={styles.valDate}>{rec.fitness_expiry || 'Not set'}</Text>
                          </View>
                        </View>
                        {fitFee > 0 ? (
                          <TouchableOpacity 
                            style={[styles.markPaidBtn, { backgroundColor: '#ECFDF5' }]} 
                            onPress={() => markCostPaid(rec.id, 'FITNESS', 'Fitness Fee', fitFee)} 
                            activeOpacity={0.8}
                          >
                            <MaterialCommunityIcons name="certificate-outline" size={16} color="#059669" />
                            <Text style={[styles.markPaidBtnText, { color: '#059669' }]}>Mark Fitness Renewed (+1 Year)</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}

                    {/* Section 5: Road Tax (Only if configured) */}
                    {hasRoadTax && (
                      <View style={[styles.costBlock, (hasEmi || hasInsurance || hasPermit || hasFitness) && { marginTop: 10 }]}>
                        <View style={styles.sectionHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MaterialCommunityIcons name="road" size={16} color="#D97706" />
                            <Text style={styles.sectionHeading}>ROAD TAX</Text>
                          </View>
                          {rec.road_tax_expiry && (
                            <View style={[styles.badge, { backgroundColor: taxBadge.bg }]}>
                              <Text style={[styles.badgeText, { color: taxBadge.color }]}>{taxBadge.text}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.infoRow}>
                          {taxAmt > 0 ? (
                            <View>
                              <Text style={styles.label}>ROAD TAX AMOUNT</Text>
                              <Text style={styles.valAmount}>₹{taxAmt.toLocaleString()}</Text>
                            </View>
                          ) : null}
                          <View style={{ alignItems: taxAmt > 0 ? 'flex-end' : 'flex-start' }}>
                            <Text style={styles.label}>EXPIRY DATE</Text>
                            <Text style={styles.valDate}>{rec.road_tax_expiry || 'Not set'}</Text>
                          </View>
                        </View>
                        {taxAmt > 0 ? (
                          <TouchableOpacity 
                            style={[styles.markPaidBtn, { backgroundColor: '#FEF3C7' }]} 
                            onPress={() => markCostPaid(rec.id, 'ROAD_TAX', 'Road Tax', taxAmt)} 
                            activeOpacity={0.8}
                          >
                            <MaterialCommunityIcons name="check-decagram-outline" size={16} color="#D97706" />
                            <Text style={[styles.markPaidBtnText, { color: '#B45309' }]}>Mark Road Tax Paid (+1 Year)</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}

                    {/* Section 6: PUCC Certificate (Only if configured) */}
                    {hasPucc && (
                      <View style={[styles.costBlock, (hasEmi || hasInsurance || hasPermit || hasFitness || hasRoadTax) && { marginTop: 10 }]}>
                        <View style={styles.sectionHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MaterialCommunityIcons name="gauge" size={16} color="#7C3AED" />
                            <Text style={styles.sectionHeading}>PUCC (POLLUTION CHECK)</Text>
                          </View>
                          {rec.pucc_expiry && (
                            <View style={[styles.badge, { backgroundColor: pucBadge.bg }]}>
                              <Text style={[styles.badgeText, { color: pucBadge.color }]}>{pucBadge.text}</Text>
                            </View>
                          )}
                        </View>
                        <View style={styles.infoRow}>
                          {pucFee > 0 ? (
                            <View>
                              <Text style={styles.label}>PUCC FEE</Text>
                              <Text style={styles.valAmount}>₹{pucFee.toLocaleString()}</Text>
                            </View>
                          ) : null}
                          <View style={{ alignItems: pucFee > 0 ? 'flex-end' : 'flex-start' }}>
                            <Text style={styles.label}>EXPIRY DATE</Text>
                            <Text style={styles.valDate}>{rec.pucc_expiry || 'Not set'}</Text>
                          </View>
                        </View>
                        {pucFee > 0 ? (
                          <TouchableOpacity 
                            style={[styles.markPaidBtn, { backgroundColor: '#F5F3FF' }]} 
                            onPress={() => markCostPaid(rec.id, 'PUCC', 'PUCC Pollution Check', pucFee)} 
                            activeOpacity={0.8}
                          >
                            <MaterialCommunityIcons name="check-circle-outline" size={16} color="#7C3AED" />
                            <Text style={[styles.markPaidBtnText, { color: '#7C3AED' }]}>Mark PUCC Renewed (+6 Months)</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}

                    {/* Section 7: Registration Date (Only if configured) */}
                    {hasRegistration && (
                      <View style={[styles.costBlock, hasAnyCompliance && { marginTop: 10 }]}>
                        <View style={styles.sectionHeaderRow}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <MaterialCommunityIcons name="card-account-details-outline" size={16} color="#2563EB" />
                            <Text style={styles.sectionHeading}>REGISTRATION DATE</Text>
                          </View>
                        </View>
                        <Text style={styles.valDate}>{rec.registration_date}</Text>
                      </View>
                    )}

                    {/* If vehicle has NO compliance items filled yet */}
                    {!hasAnyCompliance && (
                      <View style={styles.emptyCostNotice}>
                        <MaterialCommunityIcons name="information-outline" size={18} color="#94A3B8" />
                        <Text style={styles.emptyCostNoticeText}>
                          No compliance items configured yet. Tap the âœï¸ edit icon above to add EMI, Insurance, or Permit details.
                        </Text>
                      </View>
                    )}

                    {/* Notes & Document Link */}
                    {(rec.notes || rec.document_url) && (
                      <View style={styles.cardFooter}>
                        {rec.notes ? (
                          <Text style={styles.notesText} numberOfLines={2}>💬 {rec.notes}</Text>
                        ) : null}
                        {rec.document_url ? (
                          <TouchableOpacity style={styles.docLink} onPress={() => setViewerUrl(rec.document_url)}>
                            <MaterialCommunityIcons name="file-document-outline" size={16} color="#2563EB" />
                            <Text style={styles.docLinkText}>View Attached Document</Text>
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    )}

                    {/* Bottom Fold / Collapse Button */}
                    <TouchableOpacity 
                      style={styles.collapsePromptRow}
                      onPress={() => toggleCardFold(rec.id)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.collapsePromptText}>Fold details</Text>
                      <MaterialCommunityIcons name="chevron-up" size={14} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Add / Edit Modal - 2-Column Grid Layout */}
      <Modal visible={isModalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingRecord ? 'Edit Vehicle Compliance' : 'New Vehicle & Compliance'}
              </Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            <ScrollView
              ref={modalScrollViewRef}
              showsVerticalScrollIndicator={false}
              style={{ maxHeight: 540 }}
              onScroll={(e) => {
                modalScrollYRef.current = e.nativeEvent.contentOffset.y;
              }}
              scrollEventThrottle={16}
            >
              <Text style={styles.inputLabel}>Vehicle Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. CG 04 MC 1234"
                placeholderTextColor="#94A3B8"
                autoCapitalize="characters"
                value={vehicleNumber}
                onChangeText={setVehicleNumber}
              />

              <Text style={styles.inputLabel}>Financier Name</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. HDFC / Tata Finance"
                placeholderTextColor="#94A3B8"
                value={financier}
                onChangeText={setFinancier}
              />

              {/* Draggable & Reorderable Compliance Form Sections */}
              <DraggableFormSections
                sections={complianceFormSections}
                scrollViewRef={modalScrollViewRef}
                scrollYRef={modalScrollYRef}
              />

              <TouchableOpacity style={[styles.confirmSaveBtn, { marginTop: 16 }]} onPress={saveRecord} activeOpacity={0.8}>
                <Text style={styles.confirmSaveBtnText}>{editingRecord ? 'Update Record' : 'Save Record'}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Date Pickers */}
      {activeDatePicker && (
        <DateTimePicker
          value={
            activeDatePicker === 'emi' ? (emiDueDate || new Date()) :
            activeDatePicker === 'insurance' ? (insuranceExpiry || new Date()) :
            activeDatePicker === 'fitness' ? (fitnessExpiry || new Date()) :
            activeDatePicker === 'roadTax' ? (roadTaxExpiry || new Date()) :
            activeDatePicker === 'pucc' ? (puccExpiry || new Date()) :
            activeDatePicker === 'regDate' ? (registrationDate || new Date()) :
            activeDatePicker === 'permit' ? (permitValidUpto || new Date()) :
            new Date()
          }
          mode="date"
          display="default"
          onChange={(event, selectedDate) => {
            const picker = activeDatePicker;
            setActiveDatePicker(null);
            if (event?.type !== 'dismissed' && selectedDate) {
              if (picker === 'emi') setEmiDueDate(selectedDate);
              if (picker === 'insurance') setInsuranceExpiry(selectedDate);
              if (picker === 'fitness') setFitnessExpiry(selectedDate);
              if (picker === 'roadTax') setRoadTaxExpiry(selectedDate);
              if (picker === 'pucc') setPuccExpiry(selectedDate);
              if (picker === 'regDate') setRegistrationDate(selectedDate);
              if (picker === 'permit') setPermitValidUpto(selectedDate);
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
    borderBottomColor: '#F1F5F9',
  },
  backBtn: { padding: 6, marginRight: 8 },
  headerSubtitle: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: { color: 'white', fontWeight: '700', fontSize: 13 },
  metricsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#F8FAFC',
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricLabel: { fontSize: 9, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  metricValue: { fontSize: 17, fontWeight: '900', color: '#0F172A', marginTop: 4 },
  metricSub: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
  searchBarContainer: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#0F172A' },
  filterScroll: { gap: 8, paddingBottom: 6 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  filterChipActive: { backgroundColor: '#EFF6FF', borderColor: '#2563EB' },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterChipTextActive: { color: '#2563EB', fontWeight: '700' },
  listControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  listCountText: {
    fontSize: 12,
    color: '#64748B',
  },
  foldAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: 4,
  },
  foldAllBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  loadingBox: { alignItems: 'center', marginTop: 40 },
  loadingText: { marginTop: 10, color: '#64748B', fontSize: 13 },
  emptyBox: { alignItems: 'center', marginTop: 50 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#475569', marginTop: 12 },
  emptySubtitle: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 4, paddingHorizontal: 30 },
  card: {
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
    elevation: 2,
  },
  cardUrgentBorder: {
    borderColor: '#F87171',
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleBadge: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  vehicleIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  vehicleIconBoxActive: {
    backgroundColor: '#EFF6FF',
  },
  vehicleText: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  financierText: { fontSize: 11, color: '#64748B', fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  actionBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
  },
  foldToggleBtn: {
    backgroundColor: '#EFF6FF',
  },
  foldToggleBtnActive: {
    backgroundColor: '#2563EB',
  },
  collapsedSummaryContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  compactChipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  miniChipText: {
    fontSize: 11,
    fontWeight: '700',
  },
  miniPillBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    marginLeft: 2,
  },
  miniPillBadgeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  noComplianceCompactText: {
    fontSize: 11,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  expandPromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 3,
  },
  expandPromptText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  expandedDetailsContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 12,
  },
  costBlock: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 4,
  },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  sectionHeading: { fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: 10, color: '#94A3B8', fontWeight: '700' },
  valAmount: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  valDate: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  markPaidBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ECFDF5',
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 10,
    gap: 6,
  },
  markPaidBtnText: { color: '#059669', fontWeight: '800', fontSize: 12 },
  emptyCostNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  emptyCostNoticeText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
    lineHeight: 18,
  },
  cardFooter: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notesText: { fontSize: 11, color: '#64748B', flex: 1, marginRight: 8 },
  docLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  docLinkText: { fontSize: 11, fontWeight: '700', color: '#2563EB' },
  collapsePromptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingVertical: 6,
    gap: 4,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
  },
  collapsePromptText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A' },
  inputLabel: { fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 4 },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    fontSize: 13,
    color: '#0F172A',
    marginBottom: 12,
  },
  formRow: { flexDirection: 'row', marginBottom: 4 },
  datePickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
  },
  datePickerBtnText: { fontSize: 13, fontWeight: '600', color: '#0F172A' },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  uploadBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
  confirmSaveBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  confirmSaveBtnText: { color: 'white', fontWeight: '800', fontSize: 14 },
  viewerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: { width: '92%', height: '80%' },
  viewerCloseText: { color: 'white', marginTop: 14, fontSize: 13, fontWeight: '600' },

  /* In-place Arrange Mode Styles */
  arrangeModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  arrangeModeBannerTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E40AF',
  },
  arrangeDoneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  arrangeDoneBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
  },
  arrangeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  arrangeCardDragging: {
    borderColor: '#2563EB',
    backgroundColor: '#F8FAFC',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  arrangeCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  arrangeVehicleNum: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0F172A',
  },
  arrangeFinancier: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  arrangeCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrangeArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
});