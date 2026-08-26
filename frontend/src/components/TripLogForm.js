import React, { useState, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Image, Modal, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { saveTripOffline } from '../context/OfflineStorage';
import { useBackgroundSync } from '../context/useBackgroundSync';
import { API_BASE_URL } from '../config';

export default function TripLogForm({ isAdmin = false, staffList = [], onSuccess = null }) {
    const { userToken } = useContext(AuthContext);
    const { isOnline, pendingCount, syncPendingData } = useBackgroundSync();
    const [isLoading, setIsLoading] = useState(false);
    
    // Form state
    const [vehicleNumber, setVehicleNumber] = useState('');
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [materialType, setMaterialType] = useState('');
    const [weightTons, setWeightTons] = useState('');
    const [startMeter, setStartMeter] = useState('');
    const [endMeter, setEndMeter] = useState('');
    const [dieselLiters, setDieselLiters] = useState('');
    const [dieselCost, setDieselCost] = useState('');
    
    // Photo state
    const [loadingPhoto, setLoadingPhoto] = useState(null);
    const [unloadingPhoto, setUnloadingPhoto] = useState(null);
    const [odometerPhoto, setOdometerPhoto] = useState(null);
    const [receiptPhoto, setReceiptPhoto] = useState(null);

    // Admin-specific state
    const [staffId, setStaffId] = useState('');
    const [isStaffPickerVisible, setIsStaffPickerVisible] = useState(false);

    const takePhoto = async (setter) => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'Camera permission is required');
            return;
        }

        let result = await ImagePicker.launchCameraAsync({
            mediaTypes: 'images',
            allowsEditing: false,
            quality: 0.3,
            base64: true,
        });

        if (!result.canceled) {
            setter(`data:image/jpeg;base64,${result.assets[0].base64}`);
        }
    };

    const calculatedKm = (parseFloat(endMeter) || 0) - (parseFloat(startMeter) || 0);

    const handleSubmit = async () => {
        if (!vehicleNumber.trim() || !origin.trim() || !destination.trim() || !materialType.trim() || !weightTons || !startMeter || !endMeter) {
            Alert.alert("Missing Fields", "Please fill in all mandatory fields (Vehicle, Route, Cargo & Odometer readings).");
            return;
        }

        if (calculatedKm < 0) {
            Alert.alert("Invalid Odometer", "End meter reading cannot be less than Start meter reading.");
            return;
        }

        setIsLoading(true);
        try {
            const body = {
                vehicle_number: vehicleNumber.trim().toUpperCase(),
                origin: origin.trim(),
                destination: destination.trim(),
                material_type: materialType.trim(),
                weight_tons: parseFloat(weightTons),
                start_meter_reading: parseFloat(startMeter),
                end_meter_reading: parseFloat(endMeter),
                diesel_liters: dieselLiters ? parseFloat(dieselLiters) : 0,
                diesel_cost: dieselCost ? parseFloat(dieselCost) : 0,
                loading_photo_url: loadingPhoto,
                unloading_photo_url: unloadingPhoto,
                odometer_photo_url: odometerPhoto,
                receipt_photo_url: receiptPhoto
            };

            if (isAdmin && staffId) {
                body.staff_id = parseInt(staffId);
            }

            if (isOnline) {
                const response = await fetch(`${API_BASE_URL}/trips/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify(body)
                });

                if (response.ok) {
                    Alert.alert("Success", isAdmin ? "Trip logged and automatically approved!" : "Trip log submitted successfully!");
                    clearForm();
                    if (onSuccess) onSuccess();
                } else {
                    const data = await response.json();
                    Alert.alert("Error", data.detail || "Failed to submit trip log");
                }
            } else {
                await saveTripOffline(body, {});
                Alert.alert("Saved Offline", "Trip saved locally. It will automatically upload when internet is restored.");
                clearForm();
            }
        } catch (error) {
            console.log(error);
            await saveTripOffline(body, {});
            Alert.alert("Network Issue", "Could not reach server. Trip saved offline.");
            clearForm();
        }
        setIsLoading(false);
    };

    const clearForm = () => {
        setVehicleNumber(''); setOrigin(''); setDestination(''); setMaterialType(''); setWeightTons('');
        setStartMeter(''); setEndMeter(''); setDieselLiters(''); setDieselCost('');
        setLoadingPhoto(null); setUnloadingPhoto(null); setOdometerPhoto(null); setReceiptPhoto(null);
        setStaffId('');
    };

    return (
        <ScrollView 
            style={styles.container} 
            contentContainerStyle={styles.contentContainer} 
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
            keyboardShouldPersistTaps="handled"
        >
            {/* Network Banner */}
            {!isOnline && (
                <View style={styles.offlineBanner}>
                    <MaterialCommunityIcons name="wifi-off" size={16} color="white" style={{marginRight: 8}} />
                    <Text style={styles.offlineText}>Offline Mode - Logs stored locally</Text>
                </View>
            )}
            
            {pendingCount > 0 && isOnline && (
                <TouchableOpacity style={styles.syncBanner} onPress={syncPendingData} activeOpacity={0.8}>
                    <MaterialCommunityIcons name="sync" size={16} color="white" style={{marginRight: 8}} />
                    <Text style={styles.syncText}>{pendingCount} Pending Uploads • Tap to Sync</Text>
                </TouchableOpacity>
            )}

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerBadge}>
                    <MaterialCommunityIcons name="truck-cargo-container" size={14} color="#2563EB" />
                    <Text style={styles.headerBadgeText}>FLEET OPERATIONS</Text>
                </View>
                <Text style={styles.headerTitle}>New Trip Dispatch</Text>
                <Text style={styles.headerSubtitle}>Record complete cargo, route, odometer & fuel metrics</Text>
            </View>

            {/* Section 1: Vehicle & Staff Assignment */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                        <MaterialCommunityIcons name="truck-fast-outline" size={18} color="#2563EB" />
                    </View>
                    <Text style={styles.sectionTitle}>Vehicle & Assignment</Text>
                </View>

                {isAdmin && (
                    <View style={styles.formGroup}>
                        <Text style={styles.inputLabel}>Assign Driver / Staff</Text>
                        <TouchableOpacity style={styles.pickerTrigger} onPress={() => setIsStaffPickerVisible(true)} activeOpacity={0.7}>
                            <Text style={staffId ? styles.pickerTriggerVal : styles.pickerTriggerPlaceholder}>
                                {staffList.find(u => u.id.toString() === staffId)?.full_name || staffList.find(u => u.id.toString() === staffId)?.username || "Select Assigned Driver"}
                            </Text>
                            <MaterialCommunityIcons name="chevron-down" size={18} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.formGroup}>
                    <Text style={styles.inputLabel}>Vehicle Number *</Text>
                    <TextInput 
                        placeholderTextColor="#94A3B8" 
                        style={styles.textInput} 
                        placeholder="e.g. MH-12-FE-4920" 
                        value={vehicleNumber} 
                        onChangeText={setVehicleNumber}
                        autoCapitalize="characters"
                    />
                </View>
            </View>

            {/* Section 2: Odometer & Distance */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: '#F1F5F9' }]}>
                        <MaterialCommunityIcons name="speedometer" size={18} color="#0F172A" />
                    </View>
                    <Text style={styles.sectionTitle}>Odometer Readings</Text>
                </View>

                <View style={styles.odoRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Start Meter (KM) *</Text>
                        <TextInput 
                            placeholderTextColor="#94A3B8" 
                            style={styles.odoInput} 
                            placeholder="00000" 
                            keyboardType="numeric" 
                            value={startMeter} 
                            onChangeText={setStartMeter} 
                        />
                    </View>
                    <View style={styles.odoDivider} />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>End Meter (KM) *</Text>
                        <TextInput 
                            placeholderTextColor="#94A3B8" 
                            style={styles.odoInput} 
                            placeholder="00000" 
                            keyboardType="numeric" 
                            value={endMeter} 
                            onChangeText={setEndMeter} 
                        />
                    </View>
                </View>

                {/* Live Distance Pill */}
                <View style={styles.distanceBanner}>
                    <Text style={styles.distanceBannerLabel}>TOTAL TRIP DISTANCE</Text>
                    <Text style={[styles.distanceBannerVal, calculatedKm < 0 && { color: '#EF4444' }]}>
                        {calculatedKm >= 0 ? `${calculatedKm} KM` : 'Invalid KM'}
                    </Text>
                </View>
            </View>

            {/* Section 3: Route & Cargo Details */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: '#ECFDF5' }]}>
                        <MaterialCommunityIcons name="map-marker-distance" size={18} color="#059669" />
                    </View>
                    <Text style={styles.sectionTitle}>Route & Cargo</Text>
                </View>

                <View style={styles.routeContainer}>
                    <View style={styles.routeInputRow}>
                        <View style={[styles.routeDot, { backgroundColor: '#059669' }]} />
                        <TextInput 
                            placeholderTextColor="#94A3B8" 
                            style={styles.routeInput} 
                            placeholder="Origin / Loading Location *" 
                            value={origin} 
                            onChangeText={setOrigin} 
                        />
                    </View>
                    <View style={styles.routeConnectLine} />
                    <View style={styles.routeInputRow}>
                        <View style={[styles.routeDot, { backgroundColor: '#2563EB' }]} />
                        <TextInput 
                            placeholderTextColor="#94A3B8" 
                            style={styles.routeInput} 
                            placeholder="Destination / Unloading Location *" 
                            value={destination} 
                            onChangeText={setDestination} 
                        />
                    </View>
                </View>

                <View style={styles.rowGrid}>
                    <View style={{ flex: 2 }}>
                        <Text style={styles.inputLabel}>Material Type *</Text>
                        <TextInput 
                            placeholderTextColor="#94A3B8" 
                            style={styles.textInput} 
                            placeholder="e.g. Coal, Iron Ore" 
                            value={materialType} 
                            onChangeText={setMaterialType} 
                        />
                    </View>
                    <View style={{ flex: 1.2 }}>
                        <Text style={styles.inputLabel}>Weight (Tons) *</Text>
                        <TextInput 
                            placeholderTextColor="#94A3B8" 
                            style={styles.textInput} 
                            placeholder="e.g. 25.4" 
                            keyboardType="numeric" 
                            value={weightTons} 
                            onChangeText={setWeightTons} 
                        />
                    </View>
                </View>
            </View>

            {/* Section 4: Fuel Tracking */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                        <MaterialCommunityIcons name="gas-station-outline" size={18} color="#D97706" />
                    </View>
                    <Text style={styles.sectionTitle}>Fuel & Expenses (Optional)</Text>
                </View>
                <View style={styles.rowGrid}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Diesel Liters</Text>
                        <TextInput 
                            placeholderTextColor="#94A3B8" 
                            style={styles.textInput} 
                            placeholder="0 L" 
                            keyboardType="numeric" 
                            value={dieselLiters} 
                            onChangeText={setDieselLiters} 
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Diesel Cost (₹)</Text>
                        <TextInput 
                            placeholderTextColor="#94A3B8" 
                            style={styles.textInput} 
                            placeholder="₹ 0" 
                            keyboardType="numeric" 
                            value={dieselCost} 
                            onChangeText={setDieselCost} 
                        />
                    </View>
                </View>
            </View>

            {/* Section 5: Photo Verification Evidence */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: '#F3E8FF' }]}>
                        <MaterialCommunityIcons name="camera-outline" size={18} color="#9333EA" />
                    </View>
                    <Text style={styles.sectionTitle}>Proof & Document Photos</Text>
                </View>
                
                <View style={styles.photoGrid}>
                    {/* Loading */}
                    <TouchableOpacity style={styles.photoBox} onPress={() => takePhoto(setLoadingPhoto)} activeOpacity={0.8}>
                        {loadingPhoto ? (
                            <Image source={{uri: loadingPhoto}} style={styles.photoImg} />
                        ) : (
                            <View style={styles.photoPlaceholder}>
                                <MaterialCommunityIcons name="camera-plus-outline" size={24} color="#64748B" />
                                <Text style={styles.photoPlaceholderText}>Loading</Text>
                            </View>
                        )}
                        <Text style={styles.photoLabel}>Loading Photo</Text>
                    </TouchableOpacity>

                    {/* Unloading */}
                    <TouchableOpacity style={styles.photoBox} onPress={() => takePhoto(setUnloadingPhoto)} activeOpacity={0.8}>
                        {unloadingPhoto ? (
                            <Image source={{uri: unloadingPhoto}} style={styles.photoImg} />
                        ) : (
                            <View style={styles.photoPlaceholder}>
                                <MaterialCommunityIcons name="camera-plus-outline" size={24} color="#64748B" />
                                <Text style={styles.photoPlaceholderText}>Unloading</Text>
                            </View>
                        )}
                        <Text style={styles.photoLabel}>Unloading</Text>
                    </TouchableOpacity>

                    {/* Odometer */}
                    <TouchableOpacity style={styles.photoBox} onPress={() => takePhoto(setOdometerPhoto)} activeOpacity={0.8}>
                        {odometerPhoto ? (
                            <Image source={{uri: odometerPhoto}} style={styles.photoImg} />
                        ) : (
                            <View style={styles.photoPlaceholder}>
                                <MaterialCommunityIcons name="camera-plus-outline" size={24} color="#64748B" />
                                <Text style={styles.photoPlaceholderText}>Odometer</Text>
                            </View>
                        )}
                        <Text style={styles.photoLabel}>Odometer Meter</Text>
                    </TouchableOpacity>

                    {/* Bill / Bilty */}
                    <TouchableOpacity style={styles.photoBox} onPress={() => takePhoto(setReceiptPhoto)} activeOpacity={0.8}>
                        {receiptPhoto ? (
                            <Image source={{uri: receiptPhoto}} style={styles.photoImg} />
                        ) : (
                            <View style={styles.photoPlaceholder}>
                                <MaterialCommunityIcons name="camera-plus-outline" size={24} color="#64748B" />
                                <Text style={styles.photoPlaceholderText}>Bilty / Bill</Text>
                            </View>
                        )}
                        <Text style={styles.photoLabel}>Receipt / Bill</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Submit Action Row */}
            <View style={styles.actionRow}>
                <TouchableOpacity style={styles.clearBtn} onPress={clearForm} activeOpacity={0.7}>
                    <Text style={styles.clearBtnText}>Clear</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={isLoading} activeOpacity={0.85}>
                    {isLoading ? <ActivityIndicator color="white" /> : (
                        <>
                            <MaterialCommunityIcons name="check-circle" size={20} color="white" />
                            <Text style={styles.submitBtnText}>Submit Trip Log</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Staff Picker Modal */}
            <Modal visible={isStaffPickerVisible} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsStaffPickerVisible(false)}>
                    <View style={styles.modalContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={styles.modalTitle}>Select Assigned Driver</Text>
                            <TouchableOpacity onPress={() => setIsStaffPickerVisible(false)}>
                                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 300 }}>
                            {staffList.filter(u => u.role !== 'ADMIN').map(u => (
                                <TouchableOpacity 
                                    key={u.id} 
                                    style={styles.staffOption} 
                                    onPress={() => { setStaffId(u.id.toString()); setIsStaffPickerVisible(false); }}
                                >
                                    <View>
                                        <Text style={styles.staffOptionName}>{u.full_name || u.username}</Text>
                                        <Text style={styles.staffOptionUsername}>@{u.username} • {u.designation || 'Staff'}</Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    contentContainer: { padding: 16, paddingBottom: 80, flexGrow: 1 },
    
    offlineBanner: { 
        backgroundColor: '#D97706', 
        padding: 10, 
        borderRadius: 10, 
        marginBottom: 12, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    offlineText: { color: 'white', fontWeight: '700', fontSize: 12 },
    
    syncBanner: { 
        backgroundColor: '#2563EB', 
        padding: 10, 
        borderRadius: 10, 
        marginBottom: 12, 
        flexDirection: 'row', 
        alignItems: 'center', 
        justifyContent: 'center' 
    },
    syncText: { color: 'white', fontWeight: '700', fontSize: 12 },
    
    header: { marginBottom: 16 },
    headerBadge: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        alignSelf: 'flex-start',
        backgroundColor: '#EFF6FF', 
        paddingHorizontal: 8, 
        paddingVertical: 3, 
        borderRadius: 6,
        gap: 4,
        marginBottom: 6
    },
    headerBadgeText: { fontSize: 10, fontWeight: '800', color: '#2563EB', letterSpacing: 0.5 },
    headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
    headerSubtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },

    sectionCard: { 
        backgroundColor: '#FFFFFF', 
        borderRadius: 16, 
        padding: 16, 
        marginBottom: 14, 
        borderWidth: 1, 
        borderColor: '#E2E8F0',
        shadowColor: '#000', 
        shadowOffset: { width: 0, height: 1 }, 
        shadowOpacity: 0.04, 
        shadowRadius: 3, 
        elevation: 2 
    },
    sectionHeader: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        gap: 10, 
        marginBottom: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    iconCircle: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },
    sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },

    formGroup: { marginBottom: 12 },
    inputLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
    textInput: { 
        backgroundColor: '#F8FAFC', 
        borderRadius: 10, 
        paddingHorizontal: 14, 
        paddingVertical: 11, 
        fontSize: 14, 
        color: '#0F172A', 
        borderWidth: 1, 
        borderColor: '#E2E8F0',
        fontWeight: '600'
    },

    pickerTrigger: { 
        backgroundColor: '#F8FAFC', 
        borderRadius: 10, 
        paddingHorizontal: 14, 
        paddingVertical: 12, 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    pickerTriggerVal: { color: '#0F172A', fontWeight: '700', fontSize: 14 },
    pickerTriggerPlaceholder: { color: '#94A3B8', fontSize: 14 },

    odoRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
    odoInput: { 
        backgroundColor: '#F8FAFC', 
        borderRadius: 10, 
        paddingHorizontal: 14, 
        paddingVertical: 12, 
        fontSize: 18, 
        fontWeight: '800', 
        color: '#0F172A', 
        borderWidth: 1, 
        borderColor: '#E2E8F0',
        textAlign: 'center'
    },
    odoDivider: { width: 1, height: 36, backgroundColor: '#E2E8F0', marginTop: 16 },

    distanceBanner: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginTop: 12
    },
    distanceBannerLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
    distanceBannerVal: { color: '#60A5FA', fontSize: 16, fontWeight: '900' },

    routeContainer: { marginBottom: 12 },
    routeInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        height: 44,
        gap: 10
    },
    routeDot: { width: 8, height: 8, borderRadius: 4 },
    routeInput: { flex: 1, fontSize: 14, color: '#0F172A', fontWeight: '600' },
    routeConnectLine: { width: 2, height: 10, backgroundColor: '#CBD5E1', marginLeft: 15, marginVertical: 2 },

    rowGrid: { flexDirection: 'row', gap: 12 },

    photoGrid: { flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
    photoBox: { flex: 1, alignItems: 'center' },
    photoPlaceholder: {
        width: '100%',
        aspectRatio: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4
    },
    photoPlaceholderText: { fontSize: 10, fontWeight: '700', color: '#64748B' },
    photoImg: { width: '100%', aspectRatio: 1, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    photoLabel: { fontSize: 10, fontWeight: '700', color: '#64748B', marginTop: 4, textAlign: 'center' },

    actionRow: { flexDirection: 'row', gap: 12, marginTop: 6, alignItems: 'center' },
    clearBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#FFFFFF' },
    clearBtnText: { color: '#64748B', fontWeight: '700', fontSize: 14 },
    submitBtn: { 
        flex: 2.5, 
        backgroundColor: '#0F172A', 
        paddingVertical: 14, 
        borderRadius: 12, 
        flexDirection: 'row', 
        justifyContent: 'center', 
        alignItems: 'center', 
        gap: 8,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4
    },
    submitBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, elevation: 10 },
    modalTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    staffOption: { 
        flexDirection: 'row', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        paddingVertical: 14, 
        borderBottomWidth: 1, 
        borderBottomColor: '#F1F5F9' 
    },
    staffOptionName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    staffOptionUsername: { fontSize: 12, color: '#64748B', marginTop: 2 }
});

