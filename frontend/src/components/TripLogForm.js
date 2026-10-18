import React, { useState, useEffect, useContext } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Image, Modal, Platform , Keyboard } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { AuthContext } from '../context/AuthContext';
import { saveTripOffline } from '../context/OfflineStorage';
import { useBackgroundSync } from '../context/useBackgroundSync';
import { API_BASE_URL } from '../config';
import { formatLocalDate } from '../utils/dateUtils';

export default function TripLogForm({ isAdmin = false, staffList = [], onSuccess = null }) {
    const { userToken, user } = useContext(AuthContext);
    const { isOnline, pendingCount, syncPendingData } = useBackgroundSync();
    const [isLoading, setIsLoading] = useState(false);
    
    const isManagerOrAdmin = isAdmin || user?.role === 'ADMIN' || user?.role === 'MANAGER';

    // Admin/Manager staff selection
    const [staffId, setStaffId] = useState('');
    const [isStaffPickerVisible, setIsStaffPickerVisible] = useState(false);

    // Selected driver details
    const selectedDriver = isManagerOrAdmin && staffId ? staffList.find(u => u.id.toString() === staffId) : user;
    const assignedVehiclesList = (selectedDriver?.assigned_vehicle || '')
        .split(',')
        .map(v => v.trim().toUpperCase())
        .filter(Boolean);

    // Form state
    const [vehicleNumber, setVehicleNumber] = useState(assignedVehiclesList[0] || user?.assigned_vehicle || '');
    const [availableVehicles, setAvailableVehicles] = useState([]);
    const [clientName, setClientName] = useState('');
    const [clientsList, setClientsList] = useState([]);
    const [showClientDropdown, setShowClientDropdown] = useState(false);
    const [isClientPickerVisible, setIsClientPickerVisible] = useState(false);
    const [clientSearchModalText, setClientSearchModalText] = useState('');
    const [origin, setOrigin] = useState('');
    const [destination, setDestination] = useState('');
    const [materialType, setMaterialType] = useState('');
    const [weightTons, setWeightTons] = useState('');
    const [startMeter, setStartMeter] = useState('');
    const [endMeter, setEndMeter] = useState('');
    const [dieselLiters, setDieselLiters] = useState('');
    const [dieselCost, setDieselCost] = useState('');
    const [bhada, setBhada] = useState('');
    const [advanceFreight, setAdvanceFreight] = useState('');
    
    // Photo state
    const [loadingPhoto, setLoadingPhoto] = useState(null);
    const [unloadingPhoto, setUnloadingPhoto] = useState(null);
    const [odometerPhoto, setOdometerPhoto] = useState(null);
    const [receiptPhoto, setReceiptPhoto] = useState(null);

    // Fetch fleet vehicles for quick select
    useEffect(() => {
        const fetchFleetVehicles = async () => {
            try {
                const resp = await fetch(`${API_BASE_URL}/workforce/emi`, {
                    headers: { 'Authorization': `Bearer ${userToken}` }
                });
                if (resp.ok) {
                    const emiList = await resp.json();
                    const vehSet = new Set();
                    emiList.forEach(e => {
                        if (e.vehicle_number && e.vehicle_number.trim()) {
                            vehSet.add(e.vehicle_number.trim().toUpperCase());
                        }
                    });
                    // Also include staff assigned vehicles
                    staffList.forEach(s => {
                        if (s.assigned_vehicle && s.assigned_vehicle.trim()) {
                            s.assigned_vehicle.split(',').forEach(v => {
                                if (v.trim()) vehSet.add(v.trim().toUpperCase());
                            });
                        }
                    });
                    if (user?.assigned_vehicle) {
                        user.assigned_vehicle.split(',').forEach(v => {
                            if (v.trim()) vehSet.add(v.trim().toUpperCase());
                        });
                    }
                    setAvailableVehicles(Array.from(vehSet));
                }
            } catch (err) {
                console.log("Could not load fleet vehicles", err);
            }
        };

        const fetchClients = async () => {
            try {
                const resp = await fetch(`${API_BASE_URL}/clients/`, {
                    headers: { 'Authorization': `Bearer ${userToken}` }
                });
                if (resp.ok) {
                    const data = await resp.json();
                    setClientsList(data);
                }
            } catch (err) {
                console.log("Could not load clients list", err);
            }
        };

        fetchFleetVehicles();
        if (userToken) fetchClients();
    }, [userToken, staffList, user]);

    // Auto-sync trip bhada into Client Khata and Daily Ledger
    const syncTripFinancials = async (loggedTripId, finalBhada, targetParty, vehNum, rOrigin, rDest) => {
        if (!targetParty || !finalBhada || finalBhada <= 0) return;
        try {
            const todayStr = formatLocalDate(new Date());
            // 1. Find or create client in Client Khata
            let client = clientsList.find(c => c.name.toLowerCase() === targetParty.trim().toLowerCase());
            if (client && client.id) {
                // 2. Add BILLED transaction in Client Khata
                await fetch(`${API_BASE_URL}/clients/transactions`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${userToken}`
                    },
                    body: JSON.stringify({
                        client_id: client.id,
                        txn_type: 'BILLED',
                        amount: finalBhada,
                        date: todayStr,
                        payment_mode: 'CREDIT',
                        notes: `Trip #${loggedTripId} (${vehNum}): ${rOrigin || 'Start'} to ${rDest || 'End'}`
                    })
                });
            }

            // 3. Add TRIP_INCOME entry in Daily Ledger
            await fetch(`${API_BASE_URL}/workforce/daily-ledger`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${userToken}`
                },
                body: JSON.stringify({
                    transaction_type: 'INCOME',
                    category: 'TRIP_INCOME',
                    amount: finalBhada,
                    description: `Trip #${loggedTripId} Bhada - ${vehNum} (Party: ${targetParty.trim()})`,
                    date: todayStr,
                    site_id: user?.site_id || 1,
                    reference_id: loggedTripId,
                    reference_type: 'TRIP'
                })
            });
        } catch (syncErr) {
            console.warn("Auto-sync to Ledger & Client Khata notice:", syncErr);
        }
    };

    // Auto-prefill vehicle when assigned driver changes or is loaded
    useEffect(() => {
        if (!vehicleNumber && assignedVehiclesList.length > 0) {
            setVehicleNumber(assignedVehiclesList[0]);
        }
    }, [user, staffId]);

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

    const calculatedKm = ((parseFloat(endMeter) || 0) > 0 && (parseFloat(startMeter) || 0) > 0)
        ? (parseFloat(endMeter) || 0) - (parseFloat(startMeter) || 0)
        : 0;

    const handleSubmit = async () => {
        if (!vehicleNumber.trim() || !origin.trim() || !destination.trim() || !materialType.trim() || !weightTons) {
            Alert.alert("Missing Fields", "Please fill in all mandatory fields: Vehicle, Route (Origin & Destination), Material & Weight.");
            return;
        }

        const sMeter = startMeter ? parseFloat(startMeter) : 0;
        const eMeter = endMeter ? parseFloat(endMeter) : 0;

        if (sMeter > 0 && eMeter > 0 && eMeter < sMeter) {
            Alert.alert("Invalid Odometer", "End meter reading cannot be less than Start meter reading.");
            return;
        }

        setIsLoading(true);
        const body = {
            vehicle_number: vehicleNumber.trim().toUpperCase(),
            origin: origin.trim(),
            destination: destination.trim(),
            material_type: materialType.trim(),
            weight_tons: parseFloat(weightTons),
            start_meter_reading: sMeter,
            end_meter_reading: eMeter,
            diesel_liters: dieselLiters ? parseFloat(dieselLiters) : 0,
            diesel_cost: dieselCost ? parseFloat(dieselCost) : 0,
            bhada: isManagerOrAdmin && bhada ? parseFloat(bhada) : 0,
            advance_freight_received: isManagerOrAdmin && advanceFreight ? parseFloat(advanceFreight) : 0,
            loading_photo_url: loadingPhoto,
            unloading_photo_url: unloadingPhoto,
            odometer_photo_url: odometerPhoto,
            receipt_photo_url: receiptPhoto,
            freight_notes: isManagerOrAdmin && clientName.trim() ? clientName.trim() : null
        };

        if (isManagerOrAdmin && staffId) {
            body.staff_id = parseInt(staffId);
        }

        try {
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
                    const createdTrip = await response.json();
                    const finalBhada = parseFloat(bhada) || 0;
                    if (finalBhada > 0 && clientName.trim()) {
                        await syncTripFinancials(createdTrip?.id || '', finalBhada, clientName.trim(), vehicleNumber.trim().toUpperCase(), origin.trim(), destination.trim());
                    }
                    Alert.alert("Success", isManagerOrAdmin ? "Trip logged and automatically approved!" : "Trip log submitted! Sent to Manager/Admin for approval & Bhada entry.");
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
                if (onSuccess) onSuccess();
            }
        } catch (error) {
            console.log("Trip log network exception, saving offline:", error);
            await saveTripOffline(body, {});
            Alert.alert("Saved Offline", "Could not reach server. Trip saved locally and will auto-sync.");
            clearForm();
            if (onSuccess) onSuccess();
        }
        setIsLoading(false);
    };

    const clearForm = () => {
        setVehicleNumber(assignedVehiclesList[0] || user?.assigned_vehicle || ''); 
        setClientName(''); setShowClientDropdown(false); setIsClientPickerVisible(false); setClientSearchModalText('');
        setOrigin(''); setDestination(''); setMaterialType(''); setWeightTons('');
        setStartMeter(''); setEndMeter(''); setDieselLiters(''); setDieselCost('');
        setBhada(''); setAdvanceFreight('');
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

                {isManagerOrAdmin && (
                    <View style={styles.formGroup}>
                        <Text style={styles.inputLabel}>Assign Driver / Staff</Text>
                        <TouchableOpacity style={styles.pickerTrigger} onPress={() => setIsStaffPickerVisible(true)} activeOpacity={0.7}>
                            <Text style={staffId ? styles.pickerTriggerVal : styles.pickerTriggerPlaceholder}>
                                {staffList.find(u => u.id.toString() === staffId)?.full_name || staffList.find(u => u.id.toString() === staffId)?.username || "Select Driver (Optional)"}
                            </Text>
                            <MaterialCommunityIcons name="chevron-down" size={18} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.formGroup}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={styles.inputLabel}>Vehicle Number *</Text>
                        {assignedVehiclesList.includes(vehicleNumber.trim().toUpperCase()) ? (
                            <View style={styles.autoAssignedBadge}>
                                <MaterialCommunityIcons name="check-decagram" size={12} color="#059669" />
                                <Text style={styles.autoAssignedBadgeText}>Assigned Vehicle</Text>
                            </View>
                        ) : null}
                    </View>
                    <TextInput 
                        placeholderTextColor="#94A3B8" 
                        style={styles.textInput} 
                        placeholder="e.g. MH-12-FE-4920" 
                        value={vehicleNumber} 
                        onChangeText={setVehicleNumber}
                        autoCapitalize="characters"
                    />

                    {/* Assigned Vehicles for Driver / Staff */}
                    {assignedVehiclesList.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                            <Text style={[styles.quickSelectHeader, { color: '#059669' }]}>
                                {isManagerOrAdmin && staffId ? "Driver's Assigned Vehicles:" : "Your Assigned Vehicles:"}
                            </Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 4 }}>
                                {assignedVehiclesList.map(veh => {
                                    const isSelected = vehicleNumber.trim().toUpperCase() === veh.toUpperCase();
                                    return (
                                        <TouchableOpacity
                                            key={veh}
                                            onPress={() => setVehicleNumber(veh)}
                                            style={[styles.assignedVehChip, isSelected && styles.assignedVehChipActive]}
                                            activeOpacity={0.7}
                                        >
                                            <MaterialCommunityIcons 
                                                name="steering" 
                                                size={13} 
                                                color={isSelected ? '#FFFFFF' : '#059669'} 
                                                style={{ marginRight: 4 }} 
                                            />
                                            <Text style={[styles.assignedVehChipText, isSelected && styles.assignedVehChipTextActive]}>
                                                {veh}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}

                    {/* Fleet Vehicle Quick-Select Chips */}
                    {availableVehicles.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                            <Text style={styles.quickSelectHeader}>All Fleet Vehicles:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 4 }}>
                                {availableVehicles.map(veh => {
                                    const isSelected = vehicleNumber.trim().toUpperCase() === veh.toUpperCase();
                                    return (
                                        <TouchableOpacity
                                            key={veh}
                                            onPress={() => setVehicleNumber(veh)}
                                            style={[styles.vehicleChip, isSelected && styles.vehicleChipActive]}
                                            activeOpacity={0.7}
                                        >
                                            <MaterialCommunityIcons 
                                                name="truck" 
                                                size={12} 
                                                color={isSelected ? '#FFFFFF' : '#475569'} 
                                                style={{ marginRight: 4 }} 
                                            />
                                            <Text style={[styles.vehicleChipText, isSelected && styles.vehicleChipTextActive]}>
                                                {veh}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}
                </View>
            </View>

            {/* Section 2: Odometer & Distance */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <View style={[styles.iconCircle, { backgroundColor: '#F1F5F9' }]}>
                        <MaterialCommunityIcons name="speedometer" size={18} color="#0F172A" />
                    </View>
                    <Text style={styles.sectionTitle}>Odometer Readings (Optional)</Text>
                </View>

                <View style={styles.odoRow}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Start Meter (KM) (Optional)</Text>
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
                        <Text style={styles.inputLabel}>End Meter (KM) (Optional)</Text>
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
                        {calculatedKm > 0 ? `${calculatedKm} KM` : (startMeter || endMeter ? '0 KM' : 'Not Provided')}
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

                {/* Manager / Admin Only: Billing Party & Bhada Entry */}
                {isManagerOrAdmin ? (
                    <>
                        {/* Billing Party / Client Selection */}
                <View style={{ marginTop: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <Text style={styles.inputLabel}>Billing Party / Client Name</Text>
                        {!!clientName && (
                            <View style={styles.clientExistingBadge}>
                                <MaterialCommunityIcons name="check-circle" size={12} color="#059669" style={{ marginRight: 3 }} />
                                <Text style={styles.clientExistingBadgeText}>Client Khata Party</Text>
                            </View>
                        )}
                    </View>

                    {/* Selector Trigger Button */}
                    <TouchableOpacity 
                        style={styles.pickerTrigger} 
                        onPress={() => {
                            setClientSearchModalText('');
                            setIsClientPickerVisible(true);
                        }}
                        activeOpacity={0.7}
                    >
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                            <MaterialCommunityIcons name="account-tie" size={20} color={clientName ? "#2563EB" : "#64748B"} style={{ marginRight: 8 }} />
                            <Text style={clientName ? styles.pickerTriggerVal : styles.pickerTriggerPlaceholder} numberOfLines={1}>
                                {clientName || "Select Party from Client Khata"}
                            </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            {!!clientName && (
                                <TouchableOpacity onPress={(e) => { e.stopPropagation(); setClientName(''); }} style={{ padding: 4, marginRight: 4 }}>
                                    <MaterialCommunityIcons name="close-circle" size={18} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                            <MaterialCommunityIcons name="chevron-down" size={18} color="#64748B" />
                        </View>
                    </TouchableOpacity>

                    {/* Quick Select Client Chips (Existing Client Khata Only) */}
                    {clientsList.length > 0 && (
                        <View style={{ marginTop: 8 }}>
                            <Text style={styles.quickSelectHeader}>Parties from Client Khata:</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginTop: 4 }}>
                                {clientsList.slice(0, 10).map(c => {
                                    const isSelected = clientName.trim().toLowerCase() === c.name.toLowerCase();
                                    return (
                                        <TouchableOpacity
                                            key={c.id}
                                            onPress={() => setClientName(c.name)}
                                            style={[styles.vehicleChip, isSelected && styles.vehicleChipActive]}
                                            activeOpacity={0.7}
                                        >
                                            <MaterialCommunityIcons 
                                                name="account-outline" 
                                                size={12} 
                                                color={isSelected ? '#FFFFFF' : '#475569'} 
                                                style={{ marginRight: 4 }} 
                                            />
                                            <Text style={[styles.vehicleChipText, isSelected && styles.vehicleChipTextActive]}>
                                                {c.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {/* Freight / Bhada Accounting */}
                <View style={[styles.rowGrid, { marginTop: 12 }]}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Total Bhada / Freight (₹)</Text>
                        <TextInput 
                            placeholderTextColor="#94A3B8" 
                            style={styles.textInput} 
                            placeholder="e.g. 45000" 
                            keyboardType="numeric" 
                            value={bhada} 
                            onChangeText={setBhada} 
                        />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.inputLabel}>Advance Received (₹)</Text>
                        <TextInput 
                            placeholderTextColor="#94A3B8" 
                            style={styles.textInput} 
                            placeholder="e.g. 15000" 
                            keyboardType="numeric" 
                            value={advanceFreight} 
                            onChangeText={setAdvanceFreight} 
                        />
                    </View>
                </View>

                {!!bhada && (
                    <View style={{ marginTop: 10, padding: 10, backgroundColor: '#F1F5F9', borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialCommunityIcons name="calculator-variant" size={16} color="#64748B" style={{ marginRight: 6 }} />
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569' }}>Pending Freight Balance</Text>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: (parseFloat(bhada) || 0) - (parseFloat(advanceFreight) || 0) > 0 ? '#DC2626' : '#16A34A' }}>
                            ₹{Math.max(0, (parseFloat(bhada) || 0) - (parseFloat(advanceFreight) || 0)).toLocaleString('en-IN')}
                        </Text>
                    </View>
                )}
                    </>
                ) : (
                    <View style={{ marginTop: 14, backgroundColor: '#EFF6FF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#BFDBFE', flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="shield-account" size={18} color="#2563EB" style={{ marginRight: 8 }} />
                        <Text style={{ fontSize: 12, color: '#1E40AF', fontWeight: '700', flex: 1 }}>
                            Trip will be sent for Manager / Admin approval. Billing Party & Freight / Bhada rate will be entered upon validation.
                        </Text>
                    </View>
                )}
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
                                    onPress={() => { 
                                        setStaffId(u.id.toString()); 
                                        if (u.assigned_vehicle) {
                                            setVehicleNumber(u.assigned_vehicle);
                                        }
                                        setIsStaffPickerVisible(false); 
                                    }}
                                >
                                    <View>
                                        <Text style={styles.staffOptionName}>{u.full_name || u.username}</Text>
                                        <Text style={styles.staffOptionUsername}>
                                            @{u.username} • {u.designation || 'Staff'}
                                            {u.assigned_vehicle ? ` • 🚛 ${u.assigned_vehicle}` : ''}
                                        </Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={20} color="#94A3B8" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
                    {/* Dedicated Searchable Client Picker Modal */}
            <Modal visible={isClientPickerVisible} transparent animationType="fade" onRequestClose={() => setIsClientPickerVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsClientPickerVisible(false)}>
                    <View style={[styles.modalContent, { maxHeight: '80%' }]} onStartShouldSetResponder={() => true}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <View>
                                <Text style={styles.modalTitle}>Select Client / Party</Text>
                                <Text style={{ fontSize: 12, color: '#64748B' }}>Choose registered party from Client Khata</Text>
                            </View>
                            <TouchableOpacity onPress={() => setIsClientPickerVisible(false)} style={{ padding: 4 }}>
                                <MaterialCommunityIcons name="close" size={22} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalSearchRow}>
                            <MaterialCommunityIcons name="magnify" size={18} color="#64748B" style={{ marginRight: 8 }} />
                            <TextInput
                                placeholderTextColor="#94A3B8"
                                style={styles.modalSearchInput}
                                placeholder="Search party from Client Khata..."
                                value={clientSearchModalText}
                                onChangeText={setClientSearchModalText}
                                autoFocus={true}
                            />
                            {!!clientSearchModalText && (
                                <TouchableOpacity onPress={() => setClientSearchModalText('')}>
                                    <MaterialCommunityIcons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView style={{ maxHeight: 340 }} keyboardShouldPersistTaps="handled">
                            {clientsList
                                .filter(c => !clientSearchModalText.trim() || c.name.toLowerCase().includes(clientSearchModalText.trim().toLowerCase()) || (c.phone && c.phone.includes(clientSearchModalText.trim())))
                                .map(client => {
                                    const isSelected = clientName.trim().toLowerCase() === client.name.toLowerCase();
                                    return (
                                        <TouchableOpacity
                                            key={client.id}
                                            style={[styles.modalClientItem, isSelected && styles.modalClientItemSelected]}
                                            onPress={() => {
                                                setClientName(client.name);
                                                setIsClientPickerVisible(false);
                                            }}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={[styles.modalClientName, isSelected && { color: '#2563EB', fontWeight: '800' }]}>
                                                    {client.name}
                                                </Text>
                                                {client.phone ? (
                                                    <Text style={styles.modalClientSub}>📞 {client.phone}</Text>
                                                ) : null}
                                            </View>
                                            {isSelected && (
                                                <MaterialCommunityIcons name="check-circle" size={18} color="#2563EB" />
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            {clientsList.filter(c => !clientSearchModalText.trim() || c.name.toLowerCase().includes(clientSearchModalText.trim().toLowerCase())).length === 0 && (
                                <View style={{ alignItems: 'center', paddingVertical: 30 }}>
                                    <MaterialCommunityIcons name="account-search-outline" size={36} color="#CBD5E1" />
                                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B', marginTop: 8 }}>No matching party found</Text>
                                    <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Add parties in Client Khata screen first</Text>
                                </View>
                            )}
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
    
    autoAssignedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        gap: 3,
        borderWidth: 1,
        borderColor: '#A7F3D0'
    },
    autoAssignedBadgeText: { fontSize: 10, fontWeight: '800', color: '#059669' },
    quickSelectHeader: { fontSize: 10, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 },
    vehicleChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        marginRight: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    vehicleChipActive: {
        backgroundColor: '#2563EB',
        borderColor: '#2563EB',
    },
    vehicleChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569',
    },
    vehicleChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    assignedVehChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8,
        marginRight: 6,
        borderWidth: 1.5,
        borderColor: '#A7F3D0',
    },
    assignedVehChipActive: {
        backgroundColor: '#059669',
        borderColor: '#059669',
    },
    assignedVehChipText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#065F46',
    },
    assignedVehChipTextActive: {
        color: '#FFFFFF',
    },
    
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

    rowGrid: { flexDirection: 'row', gap: 10 },

    photoGrid: { 
        flexDirection: 'row', 
        flexWrap: 'wrap', 
        justifyContent: 'space-between',
        rowGap: 14 
    },
    photoBox: { 
        width: '48%', 
        alignItems: 'center' 
    },
    photoPlaceholder: {
        width: '100%',
        height: 84,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4
    },
    photoPlaceholderText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
    photoImg: { width: '100%', height: 84, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    photoLabel: { fontSize: 11, fontWeight: '700', color: '#475569', marginTop: 4, textAlign: 'center' },

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
    staffOptionUsername: { fontSize: 12, color: '#64748B', marginTop: 2 },

    clientInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        height: 44,
    },
    clientTextInput: {
        flex: 1,
        fontSize: 14,
        color: '#0F172A',
        fontWeight: '600',
    },
    clientDropdownContainer: {
        marginTop: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    clientDropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    clientDropdownItemText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1E293B',
    },
    clientExistingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    clientExistingBadgeText: { fontSize: 10, fontWeight: '700', color: '#059669' },
    clientNewBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    clientNewBadgeText: { fontSize: 10, fontWeight: '700', color: '#2563EB' },
    browseClientsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#BFDBFE',
    },
    browseClientsBtnText: { fontSize: 12, fontWeight: '700', color: '#2563EB' },
    suggestionsContainer: {
        marginTop: 4,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        overflow: 'hidden',
    },
    suggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    suggestionText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1E293B',
        flex: 1,
    },
    suggestionBal: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    newPartySuggestionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#F0FDF4',
    },
    newPartySuggestionText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#16A34A',
    },
    modalSearchRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        paddingHorizontal: 12,
        height: 42,
        marginBottom: 10,
    },
    modalSearchInput: {
        flex: 1,
        fontSize: 14,
        color: '#0F172A',
        fontWeight: '600',
    },
    modalAddNewPartyCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EFF6FF',
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#BFDBFE',
        marginBottom: 10,
    },
    modalClientItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    modalClientItemSelected: {
        backgroundColor: '#EFF6FF',
        borderRadius: 8,
    },
    modalClientName: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1E293B',
    },
    modalClientSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2,
    },
});

